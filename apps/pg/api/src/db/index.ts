import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export interface DbConfig {
  connectionString: string;
  schema?: Record<string, any>;
  maxConnections?: number;
  idleTimeout?: number;
}

let cachedDb: PostgresJsDatabase<Record<string, any>> | null = null;

/**
 * Get or create a cached database connection
 */
export function getDb(config: DbConfig): PostgresJsDatabase<Record<string, any>> {
  if (cachedDb) {
    return cachedDb;
  }

  if (!config.connectionString) {
    throw new Error('DATABASE_URL or connectionString is required');
  }

  const client = postgres(config.connectionString, {
    max: config.maxConnections || 10,
    idle_timeout: config.idleTimeout || 30,
  });

  cachedDb = drizzle(client, {
    schema: config.schema,
  });

  return cachedDb;
}

/**
 * Create a new database connection (bypassing cache)
 */
export function createDb(config: DbConfig): PostgresJsDatabase<Record<string, any>> {
  if (!config.connectionString) {
    throw new Error('DATABASE_URL or connectionString is required');
  }

  const client = postgres(config.connectionString, {
    max: config.maxConnections || 10,
    idle_timeout: config.idleTimeout || 30,
  });

  return drizzle(client, {
    schema: config.schema,
  });
}

/**
 * Create a connection and return the underlying client so the caller can close it.
 * Necessary on serverless runtimes such as Cloudflare Workers to prevent cross-request socket reuse.
 */
export function createDbWithClient(config: DbConfig): {
  db: PostgresJsDatabase<Record<string, any>>;
  client: postgres.Sql;
  close: () => Promise<void>;
} {
  if (!config.connectionString) {
    throw new Error('DATABASE_URL or connectionString is required');
  }

  const client = postgres(config.connectionString, {
    max: config.maxConnections || 1,
    idle_timeout: config.idleTimeout || 30,
  });

  return {
    db: drizzle(client, { schema: config.schema }),
    client,
    close: async () => {
      try {
        await client.end({ timeout: 5 });
      } catch {
        /* connection already closed or aborted */
      }
    },
  };
}

/**
 * Close cached database connection
 */
export async function closeDb(): Promise<void> {
  if (cachedDb) {
    cachedDb = null;
  }
}

export type Database = PostgresJsDatabase<Record<string, any>>;
