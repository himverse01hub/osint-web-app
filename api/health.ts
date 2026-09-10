import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isDatabaseConfigured, requireDatabase } from './_lib/db.js';

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  if (!isDatabaseConfigured) {
    return response.status(503).json({
      ok: false,
      database: 'not_configured',
      message: 'Set DATABASE_URL in the Vercel environment variables.',
    });
  }

  try {
    const database = requireDatabase();
    await database`SELECT 1 AS connected`;

    return response.status(200).json({
      ok: true,
      database: 'connected',
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database health check failed:', error);

    return response.status(503).json({
      ok: false,
      database: 'unavailable',
      message: 'The database connection could not be established.',
    });
  }
}
