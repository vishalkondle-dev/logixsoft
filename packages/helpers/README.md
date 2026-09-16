# @logixsoft/helpers

Shared helpers, infrastructure primitives, cryptography, HTTP response utilities, string tools, validation, currency, and date/data utilities for Logixsoft applications.

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
| **`currency`** | `@logixsoft/helpers/currency` | Safe paise/rupee conversions, Indian numbering system currency formatting (`formatINR`), and UPI URI generators |
| **`validators`** | `@logixsoft/helpers/validators` | Zero-dependency validators for emails, URLs, Indian phone numbers, UPI VPAs, UUIDs, and PIN codes |
| **`date`** | `@logixsoft/helpers/date` | Relative time formatting, human duration parser, token expiry checks, and IST day boundaries |
| **`data`** | `@logixsoft/helpers/data` | Type-safe object picking/omitting, array chunking, groupBy, deduplication, deep cloning, and empty checks |

All helpers are also accessible directly or namespaced from the root import:
```typescript
import { createDbWithClient, generateId, successResponse, toPaise, isVpa } from '@logixsoft/helpers';
// or namespaced:
import { db, crypto, http, string, currency, validators, date, data } from '@logixsoft/helpers';
```

---

## Module: `currency` (`@logixsoft/helpers/currency`)

Precision-safe currency conversions, Indian Rupee (`INR`) formatting, and UPI URI generation.

### Exported API

| Name | Type | Description |
| :--- | :--- | :--- |
| `toPaise(rupees)` | Function | Converts decimal rupees to integer paise without floating-point rounding bugs. |
| `toRupees(paise)` | Function | Converts integer paise to rupees with 2-decimal precision. |
| `formatINR(paise, options?)` | Function | Formats paise into Indian currency notation (e.g. `125000` -> `"₹1,250.00"`). |
| `buildUpiUri(params)` | Function | Constructs standardized UPI deep link payment URI (`upi://pay?...`). |
| `parseUpiUri(uri)` | Function | Parses a `upi://pay?...` payment URI back into structured parameters. |
| `UpiUriParams` | Type | Interface for UPI payment parameters (`pa`, `pn`, `amount`, `tr`, `tn`, etc.). |

### Usage Examples

```typescript
import { toPaise, toRupees, formatINR, buildUpiUri } from '@logixsoft/helpers/currency';

// Safe conversions (prevents 19.99 * 100 float bug)
toPaise(19.99); // 1999
toRupees(1999); // 19.99

// Indian currency notation
formatINR(125000); // "₹1,250.00"
formatINR(10000000); // "₹1,00,000.00"

// Generate UPI QR / deep link
const upiUri = buildUpiUri({
  pa: 'merchant@okhdfcbank',
  pn: 'Logixsoft',
  amount: 50000,
  isPaise: true,
  tr: 'order_1024',
  tn: 'Payment for Order #1024',
});
// "upi://pay?pa=merchant%40okhdfcbank&pn=Logixsoft&am=500.00&tr=order_1024&cu=INR&tn=Payment+for+Order+%231024"
```

---

## Module: `validators` (`@logixsoft/helpers/validators`)

Zero-dependency validation primitives.

### Exported API

| Name | Type | Description |
| :--- | :--- | :--- |
| `isEmail(val)` | Function | RFC 5322 compliant email validator. |
| `isUrl(val)` | Function | Validates HTTP/HTTPS URLs. |
| `isIndianPhone(val)` | Function | Validates 10-digit Indian mobile numbers (supports +91/91/0 prefixes). |
| `isVpa(val)` | Function | Validates UPI Virtual Payment Addresses (`name@bank`, `9876543210@paytm`). |
| `isUuid(val)` | Function | Validates UUID strings (v1-v5). |
| `isNumeric(val)` | Function | Checks if value is a valid finite number or numeric string. |
| `isPostalCode(val)` | Function | Validates 6-digit Indian PIN codes. |
| `isNonEmptyString(val)` | Function | Type predicate asserting string is non-empty after trimming. |

### Usage Examples

```typescript
import { isVpa, isIndianPhone, isEmail } from '@logixsoft/helpers/validators';

isVpa('merchant@okhdfcbank'); // true
isIndianPhone('+919876543210'); // true
isEmail('support@logixsoft.in'); // true
```

---

## Module: `date` (`@logixsoft/helpers/date`)

Date manipulation, durations, relative time, and IST boundaries.

### Exported API

| Name | Type | Description |
| :--- | :--- | :--- |
| `parseDuration(duration)` | Function | Converts duration strings to milliseconds (`'15m'` -> `900_000`, `'2h'`, `'7d'`). |
| `formatRelativeTime(date)` | Function | Human-readable relative time (`"just now"`, `"2 minutes ago"`, `"in 5 minutes"`). |
| `isExpired(date)` | Function | Checks if a timestamp or date is in the past. |
| `addDuration(date, duration)` | Function | Adds duration string or ms to a date. |
| `getStartOfDay(date?, timezone?)` | Function | Start of day (00:00:00.000) for a timezone (defaults to `'Asia/Kolkata'`). |
| `getEndOfDay(date?, timezone?)` | Function | End of day (23:59:59.999) for a timezone (defaults to `'Asia/Kolkata'`). |

### Usage Examples

```typescript
import { parseDuration, formatRelativeTime, isExpired, getStartOfDay } from '@logixsoft/helpers/date';

parseDuration('15m'); // 900000
formatRelativeTime(new Date(Date.now() - 120_000)); // "2 minutes ago"
isExpired(order.expiresAt); // true / false

// Indian Standard Time day boundary for daily revenue dashboards
const todayStart = getStartOfDay(); // 2026-09-16T00:00:00.000+05:30
```

---

## Module: `data` (`@logixsoft/helpers/data`)

Object and array manipulation utilities.

### Exported API

| Name | Type | Description |
| :--- | :--- | :--- |
| `pick(obj, keys)` | Function | Typesafe object property picker. |
| `omit(obj, keys)` | Function | Typesafe object property omitter. |
| `chunk(array, size)` | Function | Splits an array into batches of a given size. |
| `groupBy(array, keyFn)` | Function | Groups array elements by key or extractor function. |
| `unique(array, keyFn?)` | Function | Deduplicates array items. |
| `deepClone(obj)` | Function | Deep clone using `structuredClone` (with fallback). |
| `isEmpty(val)` | Function | Checks if value is empty (`null`, `undefined`, `""`, `[]`, `{}`). |

### Usage Examples

```typescript
import { pick, omit, chunk, groupBy } from '@logixsoft/helpers/data';

pick({ id: 1, name: 'Logixsoft', secret: 'abc' }, ['id', 'name']); // { id: 1, name: 'Logixsoft' }
omit({ id: 1, name: 'Logixsoft', secret: 'abc' }, ['secret']);     // { id: 1, name: 'Logixsoft' }
chunk([1, 2, 3, 4, 5], 2);                                        // [[1, 2], [3, 4], [5]]
groupBy(orders, (o) => o.status);                                  // { SUCCESS: [...], PENDING: [...] }
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
