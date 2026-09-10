import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { requireDatabase } from './_lib/db.js';

const allowedTypes = new Set([
  'phone_shared', 'email_shared', 'username_shared', 'location_shared',
  'organization_shared', 'crypto_shared', 'social_connection',
  'vehicle_shared', 'document_shared', 'known_associate', 'family',
  'business_partner', 'financial_transaction', 'communication', 'co_occurrence',
]);

const toRelationship = (row: any) => ({
  id: row.id,
  sourceId: row.sourceId,
  targetId: row.targetId,
  type: row.type,
  strength: row.confidence,
  confidence: row.confidence,
  description: row.description ?? `${row.type.replaceAll('_', ' ')} connection`,
  sources: row.metadata?.sources ?? [],
  discoveredAt: row.discoveredAt,
  verified: row.verified ?? Boolean(row.metadata?.verified),
  sourceLabel: row.sourceLabel,
  sourceType: row.sourceType,
  targetLabel: row.targetLabel,
  targetType: row.targetType,
  metadata: row.metadata ?? {},
});

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const database = requireDatabase();

    if (request.method === 'GET') {
      const rows = await database`
        SELECT r.id, r.source_entity_id AS "sourceId", r.target_entity_id AS "targetId",
               r.relationship_type AS type, r.confidence, r.metadata,
               r.created_at AS "discoveredAt",
               s.label AS "sourceLabel", s.type AS "sourceType",
               t.label AS "targetLabel", t.type AS "targetType"
        FROM relationships r
        JOIN entities s ON s.id = r.source_entity_id
        JOIN entities t ON t.id = r.target_entity_id
        ORDER BY r.created_at DESC
        LIMIT 2000
      `;
      return response.status(200).json({ relationships: rows.map(toRelationship) });
    }

    if (request.method === 'POST') {
      const body = request.body ?? {};
      const sourceId = String(body.sourceId ?? '').trim();
      const targetId = String(body.targetId ?? '').trim();
      const type = String(body.type ?? '').trim();
      const confidence = Number(body.confidence === undefined ? 70 : body.confidence);
      const description = body.description === undefined ? null : String(body.description).trim();
      const verified = Boolean(body.verified);

      if (!sourceId || !targetId) {
        return response.status(400).json({ error: 'sourceId and targetId are required' });
      }
      if (sourceId === targetId) {
        return response.status(400).json({ error: 'sourceId and targetId must be different' });
      }
      if (!allowedTypes.has(type)) {
        return response.status(400).json({ error: `Invalid relationship type. Allowed: ${[...allowedTypes].join(', ')}` });
      }
      if (!Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
        return response.status(400).json({ error: 'confidence must be an integer from 0 to 100' });
      }

      const existing = await database`
        SELECT id FROM relationships
        WHERE source_entity_id = ${sourceId} AND target_entity_id = ${targetId} AND relationship_type = ${type}
        LIMIT 1
      `;
      if (existing[0]) {
        return response.status(409).json({ error: 'This relationship already exists' });
      }

      const [createdRow] = await database`
        INSERT INTO relationships (id, source_entity_id, target_entity_id, relationship_type, confidence, metadata)
        VALUES (${randomUUID()}, ${sourceId}, ${targetId}, ${type}, ${confidence},
          ${JSON.stringify({ sources: body.sources ?? [], description: description ?? null, verified }) })
        RETURNING id, source_entity_id AS "sourceId", target_entity_id AS "targetId",
                  relationship_type AS type, confidence, metadata, created_at AS "discoveredAt"
      `;

      const [sourceRow, targetRow] = await Promise.all([
        database`SELECT label, type FROM entities WHERE id = ${sourceId} LIMIT 1`,
        database`SELECT label, type FROM entities WHERE id = ${targetId} LIMIT 1`,
      ]);

      return response.status(201).json({
        relationship: toRelationship({
          ...createdRow,
          description,
          verified,
          sourceLabel: sourceRow[0]?.label ?? sourceId,
          sourceType: sourceRow[0]?.type ?? 'unknown',
          targetLabel: targetRow[0]?.label ?? targetId,
          targetType: targetRow[0]?.type ?? 'unknown',
        }),
      });
    }

    if (request.method === 'DELETE') {
      const id = String(request.query.id ?? '').trim();
      if (!id) return response.status(400).json({ error: 'Relationship id is required' });
      const deleted = await database`DELETE FROM relationships WHERE id = ${id} RETURNING id`;
      if (!deleted[0]) return response.status(404).json({ error: 'Relationship not found' });
      return response.status(204).end();
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Relationships request failed:', error);
    return response.status(503).json({ error: 'Relationships are unavailable' });
  }
}