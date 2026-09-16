# @logixsoft/helpers

Shared helpers and utilities for Logixsoft applications.

## Installation

Within the monorepo workspace:

```json
{
  "dependencies": {
    "@logixsoft/helpers": "workspace:*"
  }
}
```

---

## Available Modules

| Module | Import Path | Description |
| :--- | :--- | :--- |
| **`db`** | `@logixsoft/helpers/db` (or `@logixsoft/helpers`) | Database connection lifecycle, pooling, serverless cleanup, and health checks |

---

## Module: `db` (`@logixsoft/helpers/db`)

Database connection initialization, connection pooling, Cloudflare Workers / serverless socket lifecycle management, and connection health checks powered by Drizzle ORM and Postgres-JS.

> **Schema Design Note:**
> `@logixsoft/helpers/db` deliberately contains **no schemas**. All database schemas (tables, relations, enums) are application-specific and must remain inside each consuming app (e.g., `apps/pg/api/src/db/schema.ts`). Consuming apps pass their schema into helper functions via TypeScript generics.

### Exported API

| Name | Type | Description |
| :--- | :--- | :--- |
| `createDb<TSchema>(config)` | Function | Creates a new standalone Drizzle database instance (bypassing cache). |
| `getDb<TSchema>(config)` | Function | Creates or returns a cached singleton database connection (for Node.js servers). |
| `createDbWithClient<TSchema>(config)` | Function | Returns `{ db, client, close }` with single-connection pool and teardown method (for serverless). |
| `closeDb()` | Function | Gracefully terminates and releases cached client connections. |
| `checkConnection(dbOrClient)` | Function | Pings the database (`SELECT 1`) and returns `{ ok, latencyMs, error? }`. |
| `DbConfig<TSchema>` | Type | Configuration options for connection string, generic schema, pool size, timeouts, and SSL. |
| `Database<TSchema>` | Type | Strongly-typed Drizzle ORM database instance parameterized by application schema. |
| `DbClientResult<TSchema>` | Type | Return structure for `createDbWithClient` containing `db`, `client`, and `close()`. |
| `ConnectionHealth` | Type | Health check report structure. |

### Usage Examples

#### 1. Serverless / Cloudflare Workers (`createDbWithClient`)

In serverless or edge environments (such as Cloudflare Workers), reusing persistent connection pools across requests can cause socket timeouts or cross-request connection reuse issues. Use `createDbWithClient` to obtain a scoped instance with a single connection limit (`max: 1`) and an explicit `close()` cleanup function:

```typescript
import { createDbWithClient, type Database } from '@logixsoft/helpers/db';
import * as schema from './db/schema'; // Application-specific schema

export function getScopedDb(connectionString: string) {
  return createDbWithClient<typeof schema>({
    connectionString,
    schema,
    maxConnections: 1,
    idleTimeout: 30,
  });
}

// Inside a request handler:
export async function handleRequest(env: Env) {
  const { db, close } = getScopedDb(env.DATABASE_URL);
  try {
    const orders = await db.query.paymentOrder.findMany();
    return Response.json(orders);
  } finally {
    await close();
  }
}
```

#### 2. Stateful Node.js Server (`getDb` Singleton)

For standard persistent Node.js servers, use `getDb` to maintain a pooled singleton connection:

```typescript
import { getDb, closeDb } from '@logixsoft/helpers/db';
import * as schema from './db/schema';

export const db = getDb<typeof schema>({
  connectionString: process.env.DATABASE_URL,
  schema,
  maxConnections: 10,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});
```

#### 3. Database Health Check (`checkConnection`)

Verify database connectivity and measure query latency (e.g., in a `/health` endpoint):

```typescript
import { checkConnection, getDb } from '@logixsoft/helpers/db';

const db = getDb();
const health = await checkConnection(db);

console.log(health);
// { ok: true, latencyMs: 14 }
```
