# @logixsoft/helpers

Shared helpers, infrastructure primitives, cryptography, HTTP response utilities, and string manipulation tools for Logixsoft applications.

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

| Module | Subpath Import | Description |
| :--- | :--- | :--- |
| **`db`** | `@logixsoft/helpers/db` | Database connection lifecycle, connection pooling, Cloudflare Workers cleanup, and health checks |
| **`crypto`** | `@logixsoft/helpers/crypto` | Cryptographically secure prefixed IDs, random tokens, OTP generation, and timing-safe HMAC verification |
| **`http`** | `@logixsoft/helpers/http` | Standard API response envelopes (`successResponse`, `errorResponse`), HTTP status constants, and status predicates |
| **`string`** | `@logixsoft/helpers/string` | Privacy masking (email, phone, secrets), slugification, casing transformations, truncation, and sanitization |

All helpers are also accessible directly or namespaced from the root import:
```typescript
import { createDbWithClient, generateId, successResponse, maskEmail } from '@logixsoft/helpers';
// or namespaced:
import { db, crypto, http, string } from '@logixsoft/helpers';
```

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

```typescript
import { checkConnection, getDb } from '@logixsoft/helpers/db';

const db = getDb();
const health = await checkConnection(db);

console.log(health);
// { ok: true, latencyMs: 14 }
```

---

## Module: `crypto` (`@logixsoft/helpers/crypto`)

Cryptographically secure ID generators, random tokens, OTP generation, and timing-safe signature verification.

### Exported API

| Name | Type | Description |
| :--- | :--- | :--- |
| `generateId(prefix?, length?)` | Function | Generates Stripe-style prefixed Base62 IDs (e.g. `order_k7x9...`, `user_8ab2...`). |
| `generateToken(byteLength?)` | Function | Generates secure hex tokens for session IDs, password resets, and API keys. |
| `generateNumericOtp(length?)` | Function | Generates cryptographically secure numeric OTPs (default: 6 digits). |
| `generateRandomString(length?)` | Function | Generates random Base62 alphanumeric strings. |
| `hashSha256(data)` | Function | Computes SHA-256 hex digest. |
| `signHmacSha256(data, secret)` | Function | Computes HMAC-SHA256 hex signature. |
| `verifyHmacSha256(data, secret, signature)` | Function | Timing-safe HMAC verification (protects webhooks/APIs against timing attacks). |
| `timingSafeEqual(a, b)` | Function | Constant-time string comparison. |

### Usage Examples

#### 1. Generate Prefixed IDs and Tokens

```typescript
import { generateId, generateToken, generateNumericOtp } from '@logixsoft/helpers/crypto';

const orderId = generateId('order');    // "order_2p8Xk9Lm4Q1vA0..."
const apiKey = `pg_live_${generateToken(24)}`; // "pg_live_7f8a9e..."
const otp = generateNumericOtp(6);      // "582910"
```

#### 2. Sign and Verify Webhook Payloads (Timing-Safe)

```typescript
import { signHmacSha256, verifyHmacSha256 } from '@logixsoft/helpers/crypto';

// When dispatching a webhook:
const signature = signHmacSha256(payloadJson, webhookSecret);

// When receiving and verifying a webhook:
const isValid = verifyHmacSha256(payloadJson, webhookSecret, incomingSignature);
if (!isValid) {
  return Response.json({ error: 'Invalid signature' }, { status: 401 });
}
```

---

## Module: `http` (`@logixsoft/helpers/http`)

Standardized JSON API response envelopes, HTTP status codes, and status predicates for consistent API contracts across Cloudflare Workers, Hono, and Next.js.

### Exported API

| Name | Type | Description |
| :--- | :--- | :--- |
| `successResponse(data, meta?)` | Function | Constructs `{ success: true, data, meta?, timestamp }`. |
| `errorResponse(message, code?, details?)` | Function | Constructs `{ success: false, error: { code, message, details? }, timestamp }`. |
| `HttpStatus` | Object | Standard HTTP status code constants (`OK: 200`, `NOT_FOUND: 404`, etc.). |
| `isSuccessStatus(status)` | Function | Returns `true` for 2xx status codes. |
| `isClientError(status)` | Function | Returns `true` for 4xx status codes. |
| `isServerError(status)` | Function | Returns `true` for 5xx status codes. |
| `ApiResponse<T>` | Type | Union type (`ApiSuccessResponse<T> \| ApiErrorResponse`). |
| `ApiSuccessResponse<T>` | Type | Successful response structure. |
| `ApiErrorResponse` | Type | Error response structure. |
| `ApiError` | Type | Error body containing `code`, `message`, and optional `details`. |

### Usage Examples

#### 1. Standard Success Response

```typescript
import { successResponse, HttpStatus } from '@logixsoft/helpers/http';

export async function getOrderHandler(c: Context) {
  const order = await getOrderById(c.req.param('id'));
  return c.json(successResponse(order), HttpStatus.OK);
}
```

#### 2. Standard Error Response

```typescript
import { errorResponse, HttpStatus } from '@logixsoft/helpers/http';

export async function createPaymentHandler(c: Context) {
  if (!isValidAmount) {
    return c.json(
      errorResponse('Amount must be at least 100 paise', 'INVALID_AMOUNT', { minAmount: 100 }),
      HttpStatus.BAD_REQUEST
    );
  }
}
```

---

## Module: `string` (`@logixsoft/helpers/string`)

String manipulation, PII privacy masking, slugification, casing utilities, truncation, and sanitization.

### Exported API

| Name | Type | Description |
| :--- | :--- | :--- |
| `maskEmail(email)` | Function | Masks email address preserving domain (e.g. `v***e@logixsoft.in`). |
| `maskPhone(phone, visibleDigits?)` | Function | Masks phone number preserving trailing digits (e.g. `******3210`). |
| `maskSecret(secret, prefixLen?, suffixLen?)` | Function | Masks secret string preserving prefix/suffix (e.g. `pg_live_...d019`). |
| `slugify(text)` | Function | Converts string into clean URL-friendly hyphenated slug. |
| `capitalize(text)` | Function | Capitalizes the first letter of a string. |
| `titleCase(text)` | Function | Converts snake_case, kebab-case, or camelCase to Title Case words. |
| `camelCase(text)` | Function | Converts string to camelCase format. |
| `snakeCase(text)` | Function | Converts string to snake_case format. |
| `kebabCase(text)` | Function | Converts string to kebab-case format. |
| `truncate(text, maxLen, options?)` | Function | Truncates string with ellipsis, optionally preserving word boundaries. |
| `getInitials(name, maxInitials?)` | Function | Extracts up to N initials from full name for user avatars (e.g. `'VK'`). |
| `stripHtml(html)` | Function | Strips HTML tags and decodes common HTML entities. |
| `normalizeWhitespace(text)` | Function | Collapses multiple consecutive spaces and newlines into single spaces. |
| `pluralize(count, singular, plural?)` | Function | Pluralizes word based on numerical count (e.g. `'1 order'`, `'5 orders'`). |

### Usage Examples

#### 1. Privacy Masking

```typescript
import { maskEmail, maskPhone, maskSecret } from '@logixsoft/helpers/string';

maskEmail('vishal.kondle@logixsoft.in');   // "v***e@logixsoft.in"
maskPhone('+919876543210');                // "+91 ****** 3210"
maskSecret('whsec_8f3a9e21b7c4d019a8bc4'); // "whsec_8f...8bc4"
```

#### 2. Slugification & Casing

```typescript
import { slugify, titleCase } from '@logixsoft/helpers/string';

slugify('Logixsoft UPI Payment Gateway!'); // "logixsoft-upi-payment-gateway"
titleCase('payment_order_status');          // "Payment Order Status"
```

#### 3. Truncation & Initials

```typescript
import { truncate, getInitials, pluralize } from '@logixsoft/helpers/string';

truncate('Payment received for Invoice #1024', 20); // "Payment received..."
getInitials('Vishal Kondle');                         // "VK"
pluralize(3, 'transaction');                         // "3 transactions"
```
