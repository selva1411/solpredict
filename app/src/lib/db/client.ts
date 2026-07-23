import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

// Initialize Neon HTTP client if DATABASE_URL is available
const sql = databaseUrl ? neon(databaseUrl) : null;
export const db = sql ? drizzle(sql, { schema }) : null;

export const isDbConnected = (): boolean => {
  return Boolean(process.env.DATABASE_URL && db);
};
