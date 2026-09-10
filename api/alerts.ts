import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { requireDatabase } from './_lib/db.js';

const allowedSeverities = new Set(['low', 'medium', 'high', 'critical']);

const toAlert = (row: any) => ({
  id: row.id,
  type: row.type,
  severity: row.severity,
  title: row.title,
  description: row.description,
  entityId: row.entityId ?? undefined,
  entityType: row.entityType ?? undefined,
  caseId: row.caseId ?? undefined,
  createdAt: row.createdAt,
  acknowledgedAt: row.acknowledgedAt ?? undefined,
  status: row.status,
  metadata: row.metadata ?? {},
});

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const database = requireDatabase();

    if (request.method === 'POST') {
      const body = request.body ?? {};
      const title = String(body.title ?? '').trim();
      const description = String(body.description ?? '').trim();
      const severity = String(body.severity ?? 'medium');
      const type = String(body.type ?? 'high_risk_activity');
      if (!title || !description) return response.status(400).json({ error: 'title and description are required' });
      if (!allowedSeverities.has(severity)) return response.status(400).json({ error: 'Invalid severity' });

      const [created] = await database`
        INSERT INTO alerts (id, type, title, description, severity, case_id, entity_id, entity_type)
        VALUES (${randomUUID()}, ${type}, ${title}, ${description}, ${severity},
          ${body.caseId ? String(body.caseId) : null},
          ${body.entityId ? String(body.entityId) : null},
          ${body.entityType ? String(body.entityType) : null})
        RETURNING id, type, title, description, severity, status,
                  case_id AS "caseId", entity_id AS "entityId",
                  entity_type AS "entityType", acknowledged_at AS "acknowledgedAt",
                  created_at AS "createdAt"
      `;
      return response.status(201).json({ alert: toAlert(created) });
    }

    if (request.method === 'PATCH') {
      const id = String(request.query.id ?? '').trim();
      if (!id) return response.status(400).json({ error: 'Alert id is required' });
      const [updated] = await database`
        UPDATE alerts
        SET status = 'acknowledged', acknowledged_at = NOW()
        WHERE id = ${id}
        RETURNING id, type, title, description, severity, status,
                  case_id AS "caseId", entity_id AS "entityId",
                  entity_type AS "entityType", acknowledged_at AS "acknowledgedAt",
                  created_at AS "createdAt"
      `;
      if (!updated) return response.status(404).json({ error: 'Alert not found' });
      return response.status(200).json({ alert: toAlert(updated) });
    }

    if (request.method !== 'GET') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const page = Math.max(1, parseInt(String(request.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(request.query.limit || '50'), 10)));
    const offset = (page - 1) * limit;
    const severityFilter = request.query.severity && allowedSeverities.has(String(request.query.severity))
      ? database`WHERE severity = ${String(request.query.severity)}`
      : database``;
    const typeFilter = request.query.type
      ? (severityFilter ? database`AND type = ${String(request.query.type)}` : database`WHERE type = ${String(request.query.type)}`)
      : database``;
    const acknowledgedFilter = request.query.acknowledged === 'true'
      ? (severityFilter || typeFilter ? database`AND acknowledged_at IS NOT NULL` : database`WHERE acknowledged_at IS NOT NULL`)
      : request.query.acknowledged === 'false'
        ? (severityFilter || typeFilter ? database`AND acknowledged_at IS NULL` : database`WHERE acknowledged_at IS NULL`)
        : database``;
    const whereClause = severityFilter || typeFilter || acknowledgedFilter;

    const [rows, countRows, statsRows] = await Promise.all([
      database`
        SELECT id, type, title, description, severity, status,
               case_id AS "caseId", entity_id AS "entityId",
               entity_type AS "entityType", acknowledged_at AS "acknowledgedAt",
               created_at AS "createdAt"
        FROM alerts ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      database`
        SELECT COUNT(*) as total FROM alerts ${whereClause}
      `,
      database`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE acknowledged_at IS NULL) as "unacknowledged",
          COUNT(*) FILTER (WHERE severity = 'high' OR severity = 'critical') as "highRisk"
        FROM alerts
      `,
    ]);
    const total = parseInt(countRows[0]?.total || '0', 10);
    return response.status(200).json({ 
      alerts: rows.map(toAlert),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        total: parseInt(statsRows[0]?.total || '0', 10),
        unacknowledged: parseInt(statsRows[0]?.unacknowledged || '0', 10),
        highRisk: parseInt(statsRows[0]?.highRisk || '0', 10),
      }
    });
  } catch (error) {
    console.error('Alerts request failed:', error);
    return response.status(503).json({ error: 'Alerts are unavailable' });
  }
}