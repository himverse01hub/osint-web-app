import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
  console.error('Create .env.local with DATABASE_URL=... (or run `npx vercel env pull .env.local`) and retry.');
  process.exit(1);
}

const migrationsDir = resolve(root, 'db', 'migrations');
const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

function stripComments(sqlText) {
  let out = '';
  let i = 0;
  while (i < sqlText.length) {
    const c = sqlText[i];
    const n = sqlText[i + 1];
    if (c === '-' && n === '-') {
      while (i < sqlText.length && sqlText[i] !== '\n') i += 1;
      continue;
    }
    if (c === "'") {
      out += c;
      i += 1;
      while (i < sqlText.length) {
        out += sqlText[i];
        if (sqlText[i] === "'") {
          if (sqlText[i + 1] === "'") { out += "'"; i += 2; continue; }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function splitStatements(sqlText) {
  const cleaned = stripComments(sqlText);
  return cleaned
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

console.log(`Found ${migrationFiles.length} migration file(s).`);

console.log('Connecting to database...');
const execute = neon(databaseUrl);
let appliedStatements = 0;
for (const file of migrationFiles) {
  const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
  const statements = splitStatements(sql);
  console.log(`-- ${file} (${statements.length} statement(s))`);
  for (const statement of statements) {
    const preview = statement.slice(0, 60).replace(/\s+/g, ' ').trim();
    try {
      await execute.query(statement, []);
      console.log(`  OK   -> ${preview}...`);
      appliedStatements += 1;
    } catch (error) {
      console.error(`  FAIL -> ${preview}`);
      console.error(error instanceof Error ? error.message : error);
      console.error('Migration aborted.');
      process.exit(1);
    }
  }
}
console.log(`Migration complete (${appliedStatements} statement(s) applied).`);