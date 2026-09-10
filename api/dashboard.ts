import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireDatabase } from './_lib/db.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const database = requireDatabase();
    const [entityRows, relationshipRows, caseRows, alertRows] = await Promise.all([
      database`
        SELECT type, COUNT(*)::int AS count
        FROM entities
        GROUP BY type
      `,
      database`SELECT COUNT(*)::int AS count FROM relationships`,
      database`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status IN ('active', 'open'))::int AS active
        FROM cases
      `,
      database`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE severity IN ('high', 'critical'))::int AS high_priority
        FROM alerts
      `,
    ]);

    const counts = Object.fromEntries(entityRows.map((row) => [row.type, row.count]));
    const caseStats = caseRows[0] ?? { total: 0, active: 0 };
    const alertStats = alertRows[0] ?? { total: 0, high_priority: 0 };

    return response.status(200).json({
      stats: {
        totalPersons: counts.person ?? 0,
        totalPhones: counts.phone ?? 0,
        totalEmails: counts.email ?? 0,
        totalUsernames: counts.username ?? 0,
        totalOrganizations: counts.organization ?? 0,
        totalLocations: counts.location ?? 0,
        totalCryptoWallets: counts.crypto_wallet ?? 0,
        totalSocialAccounts: counts.social_account ?? 0,
        totalVehicles: counts.vehicle ?? 0,
        totalDocuments: counts.document ?? 0,
        totalRelationships: relationshipRows[0]?.count ?? 0,
        activeCases: caseStats.active,
        totalCases: caseStats.total,
        totalAlerts: alertStats.total,
        highPriorityAlerts: alertStats.high_priority,
      },
    });
  } catch (error) {
    console.error('Dashboard data request failed:', error);
    return response.status(503).json({ error: 'Dashboard data is unavailable' });
  }
}