import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync } from 'node:crypto';
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
const mode = process.argv[2];

if (mode === 'inspect') {
  const users = await execute.query('SELECT id, username, name, role, email FROM users ORDER BY created_at ASC');
  console.log('USERS:');
  for (const u of users) {
    console.log(`  ${u.id} | ${u.username ?? '(no login)'} | ${u.name} | ${u.role} | ${u.email}`);
  }
}

if (mode === 'create') {
  const username = 'selftest';
  const password = 'temp1234';
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  const stored = `${salt}:${hash}`;
  const existing = await execute.query("SELECT id FROM users WHERE username = 'selftest'");
  if (existing.length) {
    await execute.query("DELETE FROM users WHERE username = 'selftest'");
  }
  await execute.query(
    `INSERT INTO users (id, email, name, username, password_hash, role, department, rank, phone, badge_number, last_login)
     VALUES ('user_selftest', 'selftest@haryanapolice.local', 'Self Test User', $1, $2, 'investigator', 'Cyber Cell', 'Constable', '9999999999', 'HP-TEST-1', NOW())`,
    [username, stored]
  );
  console.log('selftest created with password temp1234');
}

if (mode === 'cleanup') {
  await execute.query("DELETE FROM users WHERE username = 'selftest'");
  await execute.query("DELETE FROM users WHERE username = 'cleanupuser'");
  console.log('test users removed');
}