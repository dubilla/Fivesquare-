import * as schema from './schema';
import { neon } from '@neondatabase/serverless';
import {
  drizzle as drizzleNeon,
  type NeonHttpDatabase,
} from 'drizzle-orm/neon-http';
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

// Neon HTTP is the production type. Local `pg` is cast to the same surface so
// a Neon|Pg union doesn't collapse `.returning(selection)` to "0 args" (TS2554).
type AppDb = NeonHttpDatabase<typeof schema>;

// Neon serverless (HTTP) in production/preview; node-postgres against a local
// Postgres so `pnpm dev` works without a Neon project (PostGIS still required).
export const db: AppDb = (
  isLocalPostgres(connectionString)
    ? drizzlePg(new Pool({ connectionString }), { schema })
    : drizzleNeon(neon(connectionString), { schema })
) as AppDb;
