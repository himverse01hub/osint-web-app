import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { requireDatabase } from './_lib/db.js';

const allowedTypes = new Set([
  'person', 'phone', 'email', 'username', 'organization', 'location',
  'crypto_wallet', 'social_account', 'vehicle', 'document',
]);

const allowedSources = new Set([
  'social_media', 'news', 'public_records', 'forum', 'database', 'dark_web',
  'leaked_data', 'government', 'corporate', 'other', 'blockchain', 'intelligence',
]);

const entityDetails = (body: any) => ({
  coAccused: Array.isArray(body.coAccused) ? body.coAccused.map((name: unknown) => String(name)).filter(Boolean) : [],
  phone: body.phone === undefined ? '' : String(body.phone).trim(),
  email: body.email === undefined ? '' : String(body.email).trim(),
  address: body.address === undefined ? '' : String(body.address).trim(),
  anyId: body.anyId === undefined ? '' : String(body.anyId).trim(),
});

const toEntity = (row: any) => ({
  ...(row.metadata ?? {}),
  id: row.id,
  type: row.type,
  value: row.value,
  label: row.label,
  confidence: row.confidence,
  source: row.source,
  sourceName: row.sourceName,
  sourceUrl: row.sourceUrl ?? undefined,
  discoveredAt: row.discoveredAt,
  verified: row.verified,
  tags: row.metadata?.tags ?? [],
  metadata: row.metadata ?? {},
});

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const database = requireDatabase();

    if (request.method === 'GET') {
      const id = String(request.query.id ?? '').trim();
      if (id) {
        const [rows, relationshipRows] = await Promise.all([
          database`
            SELECT id, type, value, label, confidence, source,
                   source_name AS "sourceName", source_url AS "sourceUrl",
                   discovered_at AS "discoveredAt", verified, metadata
            FROM entities WHERE id = ${id} LIMIT 1
          `,
          database`
            SELECT id, source_entity_id AS "sourceId", target_entity_id AS "targetId",
                   relationship_type AS type, confidence, metadata, created_at AS "discoveredAt"
            FROM relationships
            WHERE source_entity_id = ${id} OR target_entity_id = ${id}
            ORDER BY created_at DESC
          `,
        ]);
        if (!rows[0]) return response.status(404).json({ error: 'Entity not found' });
        return response.status(200).json({ entity: toEntity(rows[0]), relationships: relationshipRows });
      }
      const page = Math.max(1, parseInt(String(request.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(request.query.limit || '50'), 10)));
      const offset = (page - 1) * limit;
      const typeFilter = request.query.type ? database`WHERE type = ${String(request.query.type)}` : database``;
      
      const [rows, countRows, relationshipRows] = await Promise.all([
        database`
          SELECT id, type, value, label, confidence, source,
                 source_name AS "sourceName", source_url AS "sourceUrl",
                 discovered_at AS "discoveredAt", verified, metadata
          FROM entities ${typeFilter}
          ORDER BY discovered_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        database`
          SELECT COUNT(*) as total FROM entities ${typeFilter}
        `,
        database`
          SELECT id, source_entity_id AS "sourceId", target_entity_id AS "targetId",
                 relationship_type AS type, confidence, metadata, created_at AS "discoveredAt"
          FROM relationships ORDER BY created_at DESC LIMIT 1000
        `,
      ]);
      const total = parseInt(countRows[0]?.total || '0', 10);
      return response.status(200).json({ 
        entities: rows.map(toEntity), 
        relationships: relationshipRows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    }

    const body = request.body ?? {};
    if (request.method === 'POST') {
      const type = String(body.type ?? '').trim();
      const value = String(body.value ?? '').trim();
      const label = String(body.label ?? value).trim();
      const source = String(body.source ?? 'other').trim();
      const confidence = Number(body.confidence ?? 0);

      if (!allowedTypes.has(type) || !value || !label || !allowedSources.has(source)) {
        return response.status(400).json({ error: 'type, value, label, and a valid source are required' });
      }
      if (!Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
        return response.status(400).json({ error: 'confidence must be an integer from 0 to 100' });
      }

      const [created] = await database`
        INSERT INTO entities (id, type, value, label, confidence, source, source_name, source_url, verified, metadata)
        VALUES (${randomUUID()}, ${type}, ${value}, ${label}, ${confidence}, ${source},
          ${String(body.sourceName ?? 'Investigator entry').trim()}, ${body.sourceUrl ? String(body.sourceUrl).trim() : null},
          ${Boolean(body.verified)}, ${JSON.stringify({ ...(body.metadata ?? {}), tags: body.tags ?? [], ...entityDetails(body) })})
        RETURNING id, type, value, label, confidence, source,
            source_name AS "sourceName", source_url AS "sourceUrl",
            discovered_at AS "discoveredAt", verified, metadata
      `;
      return response.status(201).json({ entity: toEntity(created) });
    }

    if (request.method === 'PATCH') {
      const id = String(request.query.id ?? '').trim();
      if (!id) return response.status(400).json({ error: 'Entity id is required' });

      const existingRows = await database`SELECT metadata FROM entities WHERE id = ${id}`;
      if (!existingRows[0]) return response.status(404).json({ error: 'Entity not found' });
      const type = body.type === undefined ? null : String(body.type).trim();
      const source = body.source === undefined ? null : String(body.source).trim();
      const confidence = body.confidence === undefined ? null : Number(body.confidence);
      if (type && !allowedTypes.has(type)) return response.status(400).json({ error: 'Invalid entity type' });
      if (source && !allowedSources.has(source)) return response.status(400).json({ error: 'Invalid source' });
      if (confidence !== null && (!Number.isInteger(confidence) || confidence < 0 || confidence > 100)) {
        return response.status(400).json({ error: 'confidence must be an integer from 0 to 100' });
      }

      const details = entityDetails(body);
      const hasDetails = ['coAccused', 'phone', 'email', 'address', 'anyId'].some(key => body[key] !== undefined);
      const metadata = body.tags === undefined && body.metadata === undefined && !hasDetails
        ? null
        : { ...existingRows[0].metadata, ...(body.metadata ?? {}), ...(body.tags === undefined ? {} : { tags: body.tags }), ...(hasDetails ? details : {}) };
      const [updated] = await database`
        UPDATE entities SET
          type = COALESCE(${type}, type), value = COALESCE(${body.value === undefined ? null : String(body.value).trim()}, value),
          label = COALESCE(${body.label === undefined ? null : String(body.label).trim()}, label),
          confidence = COALESCE(${confidence}, confidence), source = COALESCE(${source}, source),
          source_name = COALESCE(${body.sourceName === undefined ? null : String(body.sourceName).trim()}, source_name),
          source_url = COALESCE(${body.sourceUrl === undefined ? null : String(body.sourceUrl).trim()}, source_url),
          verified = COALESCE(${body.verified === undefined ? null : Boolean(body.verified)}, verified),
          metadata = COALESCE(${metadata ? JSON.stringify(metadata) : null}, metadata)
        WHERE id = ${id}
        RETURNING id, type, value, label, confidence, source,
            source_name AS "sourceName", source_url AS "sourceUrl",
            discovered_at AS "discoveredAt", verified, metadata
      `;
      return response.status(200).json({ entity: toEntity(updated) });
    }

    if (request.method === 'DELETE') {
      const id = String(request.query.id ?? '').trim();
      if (!id) return response.status(400).json({ error: 'Entity id is required' });
      const deleted = await database`DELETE FROM entities WHERE id = ${id} RETURNING id`;
      if (!deleted[0]) return response.status(404).json({ error: 'Entity not found' });
      return response.status(204).end();
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Entities request failed:', error);
    if (error?.code === '23505') return response.status(409).json({ error: 'An entity with this type and value already exists' });
    return response.status(503).json({ error: 'Entities are unavailable' });
  }
}