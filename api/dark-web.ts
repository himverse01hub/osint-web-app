import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { requireDatabase } from './_lib/db.js';

const allowedSeverities = new Set(['low', 'medium', 'high', 'critical']);
const allowedStatuses = new Set(['open', 'investigating', 'resolved']);

const toMention = (row: any) => ({
  id: row.id,
  entityId: row.entityId ?? undefined,
  entityType: row.entityType ?? 'document',
  entityValue: row.entityValue ?? 'Manual entry',
  marketPlace: row.marketPlace,
  listingTitle: row.listingTitle,
  description: row.description,
  price: row.price ?? undefined,
  currency: row.currency ?? undefined,
  seller: row.seller ?? undefined,
  datePosted: row.datePosted ? new Date(row.datePosted).toISOString() : new Date(row.createdAt).toISOString(),
  dataTypes: row.dataTypes ?? [],
  severity: row.severity,
  verified: row.verified,
  status: row.status,
  sourceUrl: row.sourceUrl ?? undefined,
  createdAt: row.createdAt,
});

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const database = requireDatabase();

    if (request.method === 'GET') {
      const page = Math.max(1, parseInt(String(request.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(request.query.limit || '50'), 10)));
      const offset = (page - 1) * limit;
      const severityFilter = request.query.severity && allowedSeverities.has(String(request.query.severity))
        ? database`WHERE severity = ${String(request.query.severity)}`
        : database``;
      const statusFilter = request.query.status && allowedStatuses.has(String(request.query.status))
        ? (Boolean(severityFilter) ? database`AND status = ${String(request.query.status)}` : database`WHERE status = ${String(request.query.status)}`)
        : database``;
      const whereClause = severityFilter || statusFilter;

      const [rows, countRows, statsRows] = await Promise.all([
        database`
          SELECT id, entity_id AS "entityId", entity_type AS "entityType",
                 entity_value AS "entityValue", market_place AS "marketPlace",
                 listing_title AS "listingTitle", description, price, currency, seller,
                 date_posted AS "datePosted", data_types AS "dataTypes", severity,
                 verified, status, source_url AS "sourceUrl", created_at AS "createdAt"
          FROM dark_web_mentions ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        database`
          SELECT COUNT(*) as total FROM dark_web_mentions ${whereClause}
        `,
        database`
          SELECT 
            COUNT(*) FILTER (WHERE severity = 'high' OR severity = 'critical') as "highRisk",
            COUNT(*) FILTER (WHERE verified = true) as "verified",
            COUNT(*) FILTER (WHERE status = 'open' OR status = 'investigating' OR status IS NULL) as "openItems"
          FROM dark_web_mentions
        `,
      ]);
      const total = parseInt(countRows[0]?.total || '0', 10);
      return response.status(200).json({ 
        mentions: rows.map(toMention),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          highRisk: parseInt(statsRows[0]?.highRisk || '0', 10),
          verified: parseInt(statsRows[0]?.verified || '0', 10),
          openItems: parseInt(statsRows[0]?.openItems || '0', 10),
        }
      });
    }

    if (request.method === 'POST') {
      const body = request.body ?? {};
      const marketPlace = String(body.marketPlace ?? '').trim();
      const listingTitle = String(body.listingTitle ?? '').trim();
      const description = String(body.description ?? '').trim();
      const severity = String(body.severity ?? 'medium');
      let entityId = body.entityId ? String(body.entityId).trim() : null;
      let entityType = String(body.entityType ?? '').trim();
      let entityValue = String(body.entityValue ?? '').trim();

      if (!marketPlace || !listingTitle || !description) {
        return response.status(400).json({ error: 'marketPlace, listingTitle, and description are required' });
      }
      if (!allowedSeverities.has(severity)) {
        return response.status(400).json({ error: 'Invalid severity' });
      }

      if (entityId) {
        const entity = await database`
          SELECT type, value FROM entities WHERE id = ${entityId} LIMIT 1
        `;
        if (entity[0]) {
          entityType = entity[0].type;
          entityValue = entity[0].value;
        } else {
          entityId = null;
        }
      }

      const dataTypes = Array.isArray(body.dataTypes)
        ? body.dataTypes.map((t: unknown) => String(t).trim()).filter(Boolean)
        : typeof body.dataTypes === 'string' && body.dataTypes.trim()
          ? body.dataTypes.split(',').map((t: string) => t.trim()).filter(Boolean)
          : [];
      const sourceUrl = body.sourceUrl ? String(body.sourceUrl).trim() : null;
      const datePosted = body.datePosted ? String(body.datePosted) : null;

      const [created] = await database`
        INSERT INTO dark_web_mentions (
          id, entity_id, entity_type, entity_value, market_place, listing_title,
          description, price, currency, seller, date_posted, data_types,
          severity, verified, status, source_url
        )
        VALUES (
          ${randomUUID()}, ${entityId}, ${entityType || 'document'}, ${entityValue || 'Manual entry'},
          ${marketPlace}, ${listingTitle}, ${description},
          ${body.price === undefined || body.price === '' ? null : String(body.price)},
          ${body.currency === undefined || body.currency === '' ? null : String(body.currency)},
          ${body.seller === undefined || body.seller === '' ? null : String(body.seller)},
          ${datePosted}, ${JSON.stringify(dataTypes)},
          ${severity}, ${Boolean(body.verified)}, 'open', ${sourceUrl}
        )
        RETURNING id, entity_id AS "entityId", entity_type AS "entityType",
          entity_value AS "entityValue", market_place AS "marketPlace",
          listing_title AS "listingTitle", description, price, currency, seller,
          date_posted AS "datePosted", data_types AS "dataTypes", severity,
          verified, status, source_url AS "sourceUrl", created_at AS "createdAt"
      `;

      if (severity === 'high' || severity === 'critical') {
        await database`
          INSERT INTO alerts (id, type, title, description, severity, entity_id, entity_type)
          VALUES (${randomUUID()}, 'darkweb_mention', ${`Dark web listing: ${listingTitle}`},
                  ${description}, ${severity}, ${entityId}, ${entityType || null})
        `.catch(() => undefined);
      }

      return response.status(201).json({ mention: toMention(created) });
    }

    if (request.method === 'PATCH') {
      const id = String(request.query.id ?? '').trim();
      if (!id) return response.status(400).json({ error: 'Mention id is required' });
      const body = request.body ?? {};
      const status = body.status === undefined ? null : String(body.status);
      const verified = body.verified === undefined ? null : Boolean(body.verified);
      if (status && !allowedStatuses.has(status)) {
        return response.status(400).json({ error: 'Invalid status' });
      }

      const [updated] = await database`
        UPDATE dark_web_mentions
        SET status = COALESCE(${status}, status),
            verified = COALESCE(${verified}, verified)
        WHERE id = ${id}
        RETURNING id, entity_id AS "entityId", entity_type AS "entityType",
          entity_value AS "entityValue", market_place AS "marketPlace",
          listing_title AS "listingTitle", description, price, currency, seller,
          date_posted AS "datePosted", data_types AS "dataTypes", severity,
          verified, status, source_url AS "sourceUrl", created_at AS "createdAt"
      `;
      if (!updated) return response.status(404).json({ error: 'Mention not found' });
      return response.status(200).json({ mention: toMention(updated) });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Dark web intelligence request failed:', error);
    return response.status(503).json({ error: 'Dark web intelligence is unavailable' });
  }
}