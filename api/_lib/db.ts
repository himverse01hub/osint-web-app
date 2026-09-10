import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

export const isDatabaseConfigured = Boolean(databaseUrl);

export const sql = databaseUrl ? neon(databaseUrl) : null;

export const requireDatabase = () => {
  if (!sql) {
    throw new Error('DATABASE_URL is not configured');
  }

  return sql;
};
