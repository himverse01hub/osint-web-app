import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireDatabase } from './_lib/db.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  try {
    const database = requireDatabase();
    const rows = await database`
      SELECT logs.id, logs.user_id AS "userId", COALESCE(users.name, 'System') AS "userName",
             logs.action, COALESCE(logs.resource_type, 'system') AS "resourceType",
             logs.resource_id AS "resourceId", logs.metadata AS details,
             logs.created_at AS timestamp
      FROM audit_logs logs LEFT JOIN users ON users.id = logs.user_id
      ORDER BY logs.created_at DESC LIMIT 500
    `;
    return response.status(200).json({ logs: rows.map((row: any) => ({
      ...row,
      ipAddress: String(row.details?.ipAddress ?? 'Unavailable'),
      userAgent: String(row.details?.userAgent ?? 'Unavailable'),
      status: row.details?.status === 'failure' ? 'failure' : 'success',
    })) });
  } catch (error) {
    console.error('Audit logs request failed:', error);
    return response.status(503).json({ error: 'Audit logs are unavailable' });
  }
}