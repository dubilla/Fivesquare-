import * as schema from './schema';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const connectionString = process.env.DATABASE_URL;

function isLocalPostgres(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

// Neon serverless (HTTP) in production/preview; node-postgres against a local
// Postgres so `pnpm dev` works without a Neon project (PostGIS still required).
export const db = isLocalPostgres(connectionString)
  ? drizzlePg(new Pool({ connectionString }), { schema })
  : drizzleNeon(neon(connectionString), { schema });
