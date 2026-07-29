import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let dbInstance: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> | null {
  if (dbInstance) return dbInstance;
  const url = process.env.DATABASE_URL;
  if (url && url.trim().length > 0) {
    try {
      const sql = neon(url);
      dbInstance = drizzle(sql, { schema });
    } catch (e) {
      console.warn("Neon DB init failed:", e);
    }
  }
  return dbInstance;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    const instance = getDb();
    if (!instance) return undefined;
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
}) as NeonHttpDatabase<typeof schema> | null;

export const isDbConnected = (): boolean => {
  return Boolean(process.env.DATABASE_URL && getDb() !== null);
};
