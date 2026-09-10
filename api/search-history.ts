import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireDatabase } from './_lib/db.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const database = requireDatabase();
    const rows = await database`
      SELECT id, search_type AS "searchType", search_value AS query,
             result_count AS "resultsCount", created_at AS timestamp
      FROM search_runs
      ORDER BY created_at DESC
      LIMIT 3
    `;

    return response.status(200).json({ searches: rows });
  } catch (error) {
    console.error('Search history request failed:', error);
    return response.status(503).json({ error: 'Search history is unavailable' });
  }
}