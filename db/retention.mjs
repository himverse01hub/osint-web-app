/**
 * Data-retention purger (spec §22/§31 — retention policies).
 *
 * Deletes rows older than the configured retention period. Table names are
 * whitelisted (never interpolated from user input); periods come from the
 * retention_config table, so operators tune retention without code changes.
 *
 * Usage:  node db/retention.mjs [--dry-run]
 * Schedule via CI cron, Vercel cron (calling an authorised endpoint), or an
 * operator-run scheduled task.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const root = fileURLToPath(new URL('..', import.meta.url));
function loadEnv() {
  const parsed = {};
  for (const name of ['.env.local', '.env']) {
    const file = resolve(root, name);
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      parsed[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return parsed;
}

const databaseUrl = process.env.DATABASE_URL || loadEnv().DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not found.');
  process.exit(1);
}
const execute = neon(databaseUrl);
const dryRun = process.argv.includes('--dry-run');

// Whitelist: tables eligible for retention purging, all keyed on created_at.
const PURGEABLE = new Set(['audit_logs', 'search_runs', 'sessions', 'mfa_challenges']);

const config = await execute`SELECT resource, retain_days FROM retention_config ORDER BY resource`;
let totalDeleted = 0;
for (const { resource, retain_days: retainDays } of config) {
  if (!PURGEABLE.has(resource)) continue;
  const deleted = await execute(
    `DELETE FROM ${resource} WHERE created_at < NOW() - ($1 || ' days')::interval RETURNING id`,
    [String(retainDays)],
  );
  totalDeleted += deleted.length;
  console.log(`${dryRun ? '[dry-run] would purge' : 'purged'} ${resource}: ${deleted.length} row(s) older than ${retainDays}d`);
}
console.log(`${dryRun ? 'Dry run complete.' : 'Retention purge complete.'} ${totalDeleted} row(s) eligible.`);
