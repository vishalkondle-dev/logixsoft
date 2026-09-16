import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Configuration for database connection initialization
 */
export interface DbConfig<TSchema extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * PostgreSQL connection string (URI).
   * If omitted, will default to process.env.DATABASE_URL
   */
  connectionString?: string;

  /**
   * Application-specific schema definition passed by the consuming application.
   * Never hardcoded in this generic package.
   */
  schema?: TSchema;

  /**
   * Maximum number of connections in the pool.
   * Defaults to 10 for persistent servers, 1 for serverless/edge runtimes.
   */
  maxConnections?: number;

  /**
   * Idle timeout in seconds before closing idle connections.
   * Defaults to 30 seconds.
   */
  idleTimeout?: number;

  /**
   * Connection timeout in seconds.
   * Defaults to 10 seconds.
   */
  connectTimeout?: number;

  /**
   * SSL options for PostgreSQL connection
   */
  ssl?: boolean | 'require' | 'allow' | 'prefer' | 'verify-full' | Record<string, unknown>;

  /**
   * Additional options passed directly to the underlying postgres client
   */
  options?: Partial<postgres.Options<Record<string, postgres.PostgresType>>>;

  /**
   * Enable query logging in Drizzle ORM
   */
  logger?: boolean;
}

/**
 * Generic Database type parameterized by application schema
 */
export type Database<TSchema extends Record<string, unknown> = Record<string, unknown>> =
  PostgresJsDatabase<TSchema>;

/**
 * Result structure returned when instantiating database with direct client access
 * and explicit teardown capability (essential for Cloudflare Workers and serverless).
 */
export interface DbClientResult<TSchema extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * Typed Drizzle ORM instance
   */
  db: Database<TSchema>;

  /**
   * Underlying Postgres client instance
   */
  client: postgres.Sql;

  /**
   * Safely terminate client connections and sockets
   */
  close: () => Promise<void>;
}

/**
 * Health check result
 */
export interface ConnectionHealth {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

let cachedDb: Database<any> | null = null;
let cachedClient: postgres.Sql | null = null;

function resolveConnectionString(config: DbConfig<any>): string {
  const url =
    config.connectionString ||
    (typeof process !== 'undefined' ? process.env?.DATABASE_URL : undefined);

  if (!url) {
    throw new Error('DATABASE_URL or connectionString is required');
  }

  return url;
}

function buildPostgresOptions(
  config: DbConfig<any>,
  defaultMax: number
): postgres.Options<Record<string, postgres.PostgresType>> {
  const options: Record<string, any> = {
    max: config.maxConnections ?? defaultMax,
    idle_timeout: config.idleTimeout ?? 30,
    connect_timeout: config.connectTimeout ?? 10,
    ...config.options,
  };

  if (config.ssl !== undefined) {
    options.ssl = config.ssl;
  }

  return options as postgres.Options<Record<string, postgres.PostgresType>>;
}

/**
 * Get or create a cached database connection (singleton).
 * Best suited for standard persistent Node.js servers.
 */
export function getDb<TSchema extends Record<string, unknown> = Record<string, unknown>>(
  config: DbConfig<TSchema> = {}
): Database<TSchema> {
  if (cachedDb) {
    return cachedDb as Database<TSchema>;
  }

  const connectionString = resolveConnectionString(config);
  const client = postgres(connectionString, buildPostgresOptions(config, 10));

  cachedClient = client;
  cachedDb = drizzle(client, {
    schema: config.schema,
    logger: config.logger,
  });

  return cachedDb as Database<TSchema>;
}

/**
 * Create a new standalone database connection (bypassing singleton cache).
 */
export function createDb<TSchema extends Record<string, unknown> = Record<string, unknown>>(
  config: DbConfig<TSchema>
): Database<TSchema> {
  const connectionString = resolveConnectionString(config);
  const client = postgres(connectionString, buildPostgresOptions(config, 10));

  return drizzle(client, {
    schema: config.schema,
    logger: config.logger,
  });
}

/**
 * Create a database connection and return both Drizzle instance and underlying client.
 * Includes a safe `close()` method.
 *
 * Essential on serverless runtimes such as Cloudflare Workers or AWS Lambda
 * to prevent socket leaks and cross-request socket reuse.
 */
export function createDbWithClient<TSchema extends Record<string, unknown> = Record<string, unknown>>(
  config: DbConfig<TSchema>
): DbClientResult<TSchema> {
  const connectionString = resolveConnectionString(config);
  const client = postgres(connectionString, buildPostgresOptions(config, 1));

  const db = drizzle(client, {
    schema: config.schema,
    logger: config.logger,
  });

  return {
    db,
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
 * Close cached database connection and release socket pool
 */
export async function closeDb(): Promise<void> {
  if (cachedClient) {
    try {
      await cachedClient.end({ timeout: 5 });
    } catch {
      /* ignore */
    }
    cachedClient = null;
  }
  cachedDb = null;
}

/**
 * Quick ping / health check to verify database reachability and measure query latency.
 */
export async function checkConnection(
  dbOrClient: Database<any> | postgres.Sql
): Promise<ConnectionHealth> {
  const start = Date.now();
  try {
    if (typeof (dbOrClient as any).execute === 'function') {
      await (dbOrClient as Database<any>).execute(sql`SELECT 1`);
    } else {
      await (dbOrClient as postgres.Sql)`SELECT 1`;
    }

    return {
      ok: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err?.message || String(err),
    };
  }
}
