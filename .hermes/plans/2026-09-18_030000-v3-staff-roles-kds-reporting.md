# v3 — Staff Roles, KDS, Reporting

> **For Hermes:** Do NOT start development until explicitly told to. This is a planning document only.
> When development starts: implement task-by-task; `npx tsc --noEmit` before every deploy; commit + push after every verified task.
> Deploy API: `npx wrangler deploy --minify` in `apps/logix-dine/api`.
> Deploy web: `pnpm run deploy` in `apps/logix-dine/web` (OpenNext — never plain wrangler).

---

## Goals

1. **Staff roles + invites** — Owner invites staff by phone; MANAGER gets outlet-scoped access; WAITER can only place + settle orders
2. **Outlet-scoped access via junction table** — clean many-to-many between members and outlets
3. **Kitchen Display Screen** — KITCHEN role, read-only KOT board, auto-refreshing
4. **Reporting dashboard** — sales summary (today / week / month), top items, order stats
5. **Audit columns** — `createdBy` / `updatedBy` (phone number) on all POS tables

---

## Role Model

```
Platform role (user.role)     Restaurant role (restaurantMember.role)
─────────────────────────     ──────────────────────────────────────
ADMIN                         OWNER   → all outlets, all permissions
OWNER (platform)              MANAGER → assigned outlets only, full ops
CUSTOMER                      WAITER  → assigned outlets only, order:create + order:settle
                              KITCHEN → assigned outlets only, order:read only
```

### Outlet access rule

| Role    | memberOutletAccess rows | Effective access |
|---------|------------------------|-----------------|
| OWNER   | 0 (no rows required)   | All outlets, no junction check |
| MANAGER | 1+ rows                | Only listed outlet(s) |
| WAITER  | 1+ rows                | Only listed outlet(s) |
| KITCHEN | 1+ rows                | Only listed outlet(s) |

Permission check pseudocode (in `tenancy.ts`):
```ts
if (member.role === 'OWNER') → pass
else → assert memberOutletAccess row exists for (memberId, requested outletId)
```

### WAITER permissions (updated from v2)

```ts
WAITER: ['menu:read', 'order:create', 'order:read', 'order:settle'],
```
Previously WAITER could not settle. v3 adds `order:settle`.

---

## Schema Changes

### New table: `memberOutletAccess`

```ts
export const memberOutletAccess = pgTable(
  'memberOutletAccess',
  {
    id:         text('id').primaryKey(),
    memberId:   text('memberId').notNull().references(() => restaurantMember.id, { onDelete: 'cascade' }),
    outletId:   text('outletId').notNull().references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    createdAt:  timestamp('createdAt').notNull().defaultNow(),
    createdBy:  text('createdBy'),   // phone number of actor
  },
  (t) => [
    unique('memberOutletAccess_memberId_outletId_uniq').on(t.memberId, t.outletId),
    index('memberOutletAccess_memberId_idx').on(t.memberId),
    index('memberOutletAccess_outletId_idx').on(t.outletId),
  ]
);
```

### New table: `posTable`

Proper table registry (replaces free-text `tableNo` on orders). `tableNo` on `saleOrder` stays as a snapshot (name at time of order, since tables can be renamed).

```ts
export const posTable = pgTable(
  'posTable',
  {
    id:           text('id').primaryKey(),
    restaurantId: text('restaurantId').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId:     text('outletId').notNull().references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    name:         text('name').notNull(),       // "T1", "Window 3", "Bar 2"
    section:      text('section'),              // "Ground Floor", "Terrace"
    capacity:     integer('capacity'),
    active:       boolean('active').notNull().default(true),
    sortOrder:    integer('sortOrder').notNull().default(0),
    createdAt:    timestamp('createdAt').notNull().defaultNow(),
    updatedAt:    timestamp('updatedAt').notNull().defaultNow(),
    createdBy:    text('createdBy'),            // phone number
    updatedBy:    text('updatedBy'),            // phone number
  },
  (t) => [
    index('posTable_outletId_idx').on(t.outletId),
    unique('posTable_outletId_name_uniq').on(t.outletId, t.name),
  ]
);
```

### Audit columns added to existing POS tables

Every existing POS table gets `createdBy text` + `updatedBy text` (phone number of the acting user). Auth tables (`user`, `session`, `verification`, `account`) are owned by better-auth — do NOT modify them.

Tables to migrate:

| Table | Add columns |
|-------|-------------|
| `restaurant` | `createdBy`, `updatedBy` |
| `restaurantMember` | `createdBy`, `updatedBy`, `updatedAt` (currently missing) |
| `restaurantOutlet` | `createdBy`, `updatedBy` |
| `menuCategory` | `createdBy`, `updatedBy` |
| `menuItem` | `createdBy`, `updatedBy` |
| `saleOrder` | `createdBy`, `updatedBy` |
| `saleOrderItem` | `createdBy`, `updatedBy` |

Schema pattern for each:
```ts
createdBy: text('createdBy'),   // nullable — populated from session user's phoneNumber
updatedBy: text('updatedBy'),   // nullable — set on every update
```

**How phone number is sourced:** `tenancy.ts` already has `c.set('sessionUser', user)`. The `user.phoneNumber` field is set during OTP login — available in every authenticated route handler. Pass it down to every `insert`/`update` call.

### `restaurantMember` — add `inviteStatus` + `phone`

Members are invited by phone before they have a user account. The invite flow:
- Owner enters phone number → member row created with `inviteStatus: 'PENDING'`, `userId: null`
- Staff logs in via OTP → system finds pending invite for their phone → `userId` filled in, `inviteStatus: 'ACCEPTED'`

```ts
// Add to restaurantMember:
phone:         text('phone').notNull(),          // denormalised for invite lookup before userId exists
inviteStatus:  text('inviteStatus').notNull().default('ACCEPTED'), // PENDING | ACCEPTED
userId:        text('userId').references(() => user.id, { onDelete: 'set null' }),  // nullable until accepted
```

Note: `userId` becomes **nullable** (was notNull in v2). The `unique(restaurantId, userId)` constraint must be scoped to `WHERE userId IS NOT NULL` — use a partial unique index or handle in application logic.

---

## New API Endpoints

### Staff management (Owner only)

```
POST   /staff/invite           → create member row (PENDING), assign outlet(s)
GET    /staff                  → list all members with outlet access
PUT    /staff/:id              → update role or outlet assignments
DELETE /staff/:id              → remove member + cascade outlet access rows
```

### Outlet access assignment

```
POST   /staff/:id/outlets          → add outlet access
DELETE /staff/:id/outlets/:outletId → remove outlet access
```

### Kitchen Display Screen

```
GET    /billing/orders/kitchen     → list OPEN orders for the caller's outlet(s),
                                     ordered by createdAt asc. Requires order:read.
PATCH  /billing/orders/:id/mark-ready → sets readyAt = now(). Requires order:read.
```

### Reporting

```
GET    /reports/summary            → { today, week, month } — requires restaurant:read
GET    /reports/top-items          → top N items by qty/revenue — requires restaurant:read
GET    /reports/orders-by-status   → count per status — requires restaurant:read
```

All report endpoints are outlet-aware: OWNER sees all outlets aggregated (or per-outlet with `?outletId=`); MANAGER sees only their outlet(s).

### Table management

```
GET    /tables                     → list tables for outlet
POST   /tables                     → create table
PUT    /tables/:id                 → update name/section/capacity
PATCH  /tables/:id/toggle          → active/inactive
DELETE /tables/:id                 → soft-delete (set active=false)
```

---

## Invite + Auto-Accept Flow

```
Owner enters phone "9876543210" in Settings → Staff
        │
        ▼
POST /staff/invite
  → generates member row { phone: "+919876543210", inviteStatus: "PENDING", userId: null, role: "WAITER" }
  → creates memberOutletAccess rows for assigned outlet(s)
  → sends WhatsApp: "You've been invited to Vishal Diner. Open dine.logixsoft.in and sign in."
        │
Staff opens dine.logixsoft.in, enters their number → OTP 123456 → logs in
        │
        ▼
POST /auth/phone/verify (existing flow)
  After verify: check restaurantMember WHERE phone = normalizedPhone AND inviteStatus = 'PENDING'
  → for each: set userId = newUser.id, inviteStatus = 'ACCEPTED'
  (This happens in handleVerifyOtp in index.ts, same place we update user.name)
        │
Staff lands on POS — sees only their outlet, restricted to WAITER permissions
```

No extra verify step, no magic link. The invite is accepted silently on first login.

---

## Outlet-Scoped Permission Check (updated `tenancy.ts`)

```ts
export function requirePermission(permission: Permission) {
  return async (c, next) => {
    // 1. Auth check (existing)
    const sessionUser = c.get('sessionUser');
    if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);

    // 2. Restaurant + member lookup (existing)
    const restaurantId = c.req.header('X-Restaurant-Id');
    const member = await db.query.restaurantMember.findFirst({
      where: and(eq(restaurantMember.restaurantId, restaurantId),
                 eq(restaurantMember.userId, sessionUser.id))
    });
    if (!member) return c.json({ error: 'Forbidden' }, 403);

    // 3. Permission check (existing)
    if (!hasPermission(member.role, permission)) return c.json({ error: 'Forbidden' }, 403);

    // 4. NEW — outlet scope check for non-OWNER
    const outletId = c.req.header('X-Outlet-Id') ?? body?.outletId;
    if (member.role !== 'OWNER' && outletId) {
      const access = await db.query.memberOutletAccess.findFirst({
        where: and(eq(memberOutletAccess.memberId, member.id),
                   eq(memberOutletAccess.outletId, outletId))
      });
      if (!access) return c.json({ error: 'Forbidden', message: 'No access to this outlet' }, 403);
    }

    c.set('tenant', { restaurantId, member, outletId });
    c.set('actorPhone', sessionUser.phoneNumber); // for audit columns
    await next();
  };
}
```

A new `X-Outlet-Id` header is added to the web `apiFetch` wrapper alongside `X-Restaurant-Id`. The web already knows the active outlet from `useRestaurant()` → `activeOutlet.id`.

---

## Web Changes

### New pages

| Page | Route | Who sees it |
|------|-------|-------------|
| Staff management | `/settings` → Staff tab | OWNER only |
| Kitchen Display | `/kitchen` | KITCHEN role |
| Reports | `/reports` | OWNER + MANAGER |

### Settings → Staff tab

- List current members: name / phone / role / assigned outlets / status badge (PENDING / ACCEPTED)
- "Invite Staff" button → modal: phone number, role select, outlet multi-select (OWNER sees all outlets)
- Remove member → confirm → DELETE /staff/:id
- Change role inline → PUT /staff/:id

### Kitchen Display `/kitchen`

- Full-screen layout, designed for a tablet mounted in the kitchen
- Cards per open order: order # + table + item list + time elapsed since order placed
- Colour-coded urgency: green < 10 min, amber 10–20 min, red > 20 min
- "Ready ✓" button on each card → PATCH /billing/orders/:id/mark-ready
- Auto-refresh every 10 seconds (no WebSocket needed at v3 scale)
- No navigation header — full screen, KITCHEN role sees only this

### POS page — outlet header sent on every request

`apiFetch` currently sends `X-Restaurant-Id`. v3 also sends `X-Outlet-Id: activeOutlet.id`.

### POS table picker (optional upgrade)

Replace free-text `tableNo` input with a table picker grid (from `GET /tables`). Falls back to free text if no tables are configured (so it's backwards compatible, owner doesn't have to set up tables).

---

## Reporting Dashboard `/reports`

### Architecture — extensible by design

Left sidebar (desktop) / scrollable top tabs (mobile) lists all report types.
Each report is a self-contained panel. Adding a new report = one API handler + one component, zero restructuring.

**Shared controls (all reports):**
- Period selector: Today / Week / Month (default: Today)
- Outlet filter: OWNER sees all outlets or filtered; MANAGER sees own outlet only (no selector shown)

**API pattern:** `GET /reports/:type?from=2026-09-18&to=2026-09-18&outletId=`

- `from` / `to` are ISO date strings (YYYY-MM-DD, IST) — always explicit, never a period slug
- The web converts period presets to date ranges before calling the API
- All times compared in IST (UTC+5:30): `from` = start of day IST, `to` = end of day IST

### Period presets (web → API translation)

| Preset | `from` | `to` |
|--------|--------|------|
| Today | today (IST) | today (IST) |
| Yesterday | yesterday (IST) | yesterday (IST) |
| This Week | Monday of current week (IST) | today (IST) |
| This Month | 1st of current month (IST) | today (IST) |
| This Year | Jan 1 of current year (IST) | today (IST) |
| All Time | `1970-01-01` | today (IST) |
| Custom | user-picked start | user-picked end |

Period selector UI: pill buttons for the 6 presets + a "Custom" button that opens a `@mantine/dates` `DatePickerInput` range picker.

### v3 Report Types

| Slug | Title | What it shows |
|------|-------|---------------|
| `summary` | Sales Summary | Revenue + order count + avg order value, 3 period cards side by side |
| `top-items` | Top Items | Ranked by qty sold + by revenue; CSS bar chart, no extra libs |
| `orders-by-status` | Order Status | OPEN / PAID / VOID counts + % of total for the period |
| `payment-methods` | Payment Methods | Cash vs UPI vs QR — count + revenue per method |
| `hourly` | Hourly Sales | Revenue by hour of day (0–23), bar chart — shows peak hours |
| `daily-trend` | Daily Trend | Revenue per calendar day in the period — line/bar chart |

### Future report types (zero code change to add)

- `staff-performance` — orders settled per waiter (unlocks after staff roles)
- `table-turnover` — orders per table number
- `void-analysis` — voided orders by reason/actor
- `category-performance` — revenue/qty by menu category
- `peak-heatmap` — day-of-week × hour-of-day heatmap

### SQL for each report

**Summary (single query):**
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'PAID') AS "paidCount",
  COALESCE(SUM("subtotalPaise") FILTER (WHERE status = 'PAID'), 0) AS "revenuePaise",
  COUNT(*) FILTER (WHERE status = 'OPEN') AS "openCount",
  COUNT(*) FILTER (WHERE status = 'VOID') AS "voidCount",
  COUNT(*) AS "totalCount"
FROM "saleOrder"
WHERE "restaurantId" = $1
  AND "createdAt" >= $2 AND "createdAt" < $3
  AND ($4::text IS NULL OR "outletId" = $4)
```

**Hourly (aggregation by hour in IST):**
```sql
SELECT
  EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'Asia/Kolkata') AS hour,
  COUNT(*) FILTER (WHERE status = 'PAID') AS "paidCount",
  COALESCE(SUM("subtotalPaise") FILTER (WHERE status = 'PAID'), 0) AS "revenuePaise"
FROM "saleOrder"
WHERE "restaurantId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
  AND ($4::text IS NULL OR "outletId" = $4)
GROUP BY hour ORDER BY hour
```

**Daily trend:**
```sql
SELECT
  DATE("createdAt" AT TIME ZONE 'Asia/Kolkata') AS day,
  COUNT(*) FILTER (WHERE status = 'PAID') AS "paidCount",
  COALESCE(SUM("subtotalPaise") FILTER (WHERE status = 'PAID'), 0) AS "revenuePaise"
FROM "saleOrder"
WHERE "restaurantId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
  AND ($4::text IS NULL OR "outletId" = $4)
GROUP BY day ORDER BY day
```

**Payment methods:**
```sql
SELECT
  COALESCE("paymentMethod", 'Unknown') AS method,
  COUNT(*) AS "count",
  COALESCE(SUM("subtotalPaise"), 0) AS "revenuePaise"
FROM "saleOrder"
WHERE "restaurantId" = $1 AND status = 'PAID'
  AND "createdAt" >= $2 AND "createdAt" < $3
  AND ($4::text IS NULL OR "outletId" = $4)
GROUP BY method
```

---

## Migration Plan

Since this is a running app with real data, schema changes need SQL migrations (not `drizzle-kit push` which drops/recreates):

```sql
-- 1. Add audit columns (all nullable, no data loss)
ALTER TABLE restaurant        ADD COLUMN IF NOT EXISTS "createdBy" text, ADD COLUMN IF NOT EXISTS "updatedBy" text;
ALTER TABLE "restaurantMember" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp, ADD COLUMN IF NOT EXISTS "createdBy" text, ADD COLUMN IF NOT EXISTS "updatedBy" text, ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS "inviteStatus" text NOT NULL DEFAULT 'ACCEPTED';
ALTER TABLE "restaurantOutlet" ADD COLUMN IF NOT EXISTS "createdBy" text, ADD COLUMN IF NOT EXISTS "updatedBy" text;
ALTER TABLE "menuCategory"    ADD COLUMN IF NOT EXISTS "createdBy" text, ADD COLUMN IF NOT EXISTS "updatedBy" text;
ALTER TABLE "menuItem"        ADD COLUMN IF NOT EXISTS "createdBy" text, ADD COLUMN IF NOT EXISTS "updatedBy" text;
ALTER TABLE "saleOrder"       ADD COLUMN IF NOT EXISTS "createdBy" text, ADD COLUMN IF NOT EXISTS "updatedBy" text, ADD COLUMN IF NOT EXISTS "paymentMethod" text;
ALTER TABLE "saleOrderItem"   ADD COLUMN IF NOT EXISTS "createdBy" text, ADD COLUMN IF NOT EXISTS "updatedBy" text;

-- 2. Make restaurantMember.userId nullable (existing rows stay, constraint relaxed)
ALTER TABLE "restaurantMember" ALTER COLUMN "userId" DROP NOT NULL;

-- 3. Backfill phone on existing member rows from user table
UPDATE "restaurantMember" rm
SET phone = u."phoneNumber"
FROM "user" u WHERE rm."userId" = u.id AND rm.phone IS NULL;

-- 4. Create new tables
CREATE TABLE IF NOT EXISTS "memberOutletAccess" ( ... );
CREATE TABLE IF NOT EXISTS "posTable" ( ... );
```

Run via `sudo -u postgres psql -p 5432 -d payment -f migration-v3.sql` before deploying the new API version.

---

## Task List

**Task 1 — Schema + drizzle types**
- Add `memberOutletAccess` + `posTable` to `packages/logix-dine/schemas/pos-schema.ts`
- Add `createdBy`/`updatedBy` to all existing POS tables
- Add `phone`, `inviteStatus`, nullable `userId` to `restaurantMember`
- Update `types/pos-schema.ts` JSON row types
- Update `types/roles.ts`: WAITER gains `order:settle`
- Add `saleOrder.readyAt` timestamp (for KDS "mark ready")
- Typecheck; do NOT deploy yet (migration first)

**Task 2 — SQL migration**
- Write `apps/logix-dine/api/migrations/v3.sql`
- Run against live DB
- Verify with `\d "restaurantMember"` etc.

**Task 3 — Tenancy middleware update**
- Add `X-Outlet-Id` header support
- Add outlet-scope check for non-OWNER roles using `memberOutletAccess`
- Expose `actorPhone` on context for audit column population
- Update `apiFetch` in web to send `X-Outlet-Id`

**Task 4 — Staff API**
- `POST /staff/invite` — create member + outlet access rows + WhatsApp invite (1 message only)
- `GET /staff` — list members with their outlet assignments
- `PUT /staff/:id` — change role
- `DELETE /staff/:id` — remove member
- `POST /staff/:id/outlets` / `DELETE /staff/:id/outlets/:outletId` — manage outlet access
- Auto-accept in `handleVerifyOtp`: after session created, find PENDING invites for the phone
- Typecheck + deploy API + curl verify

**Task 5 — Table management API**
- Full CRUD: `GET/POST/PUT/PATCH/DELETE /tables`
- Permission: `outlet:write` for CUD, `outlet:read` for GET
- Wire `createdBy`/`updatedBy` from `actorPhone`
- Typecheck + deploy API

**Task 6 — Reports API**
- `GET /reports/:type?from=2026-09-18&to=2026-09-18&outletId=` — single handler, switch on `:type`
- `from`/`to` are YYYY-MM-DD dates; API converts to IST day boundaries (UTC timestamps) for the query
- Types: `summary`, `top-items`, `orders-by-status`, `payment-methods`, `hourly`, `daily-trend`
- All outlet-scoped (OWNER = all or filtered; MANAGER = own outlet only, outletId forced from member access)
- Return shape: `{ type, from, to, outletId, data: any }` — consistent envelope for all types
- Typecheck + deploy API

**Task 7 — KDS API**
- `GET /billing/orders/kitchen` — OPEN orders for caller's outlet(s), asc by createdAt
- `PATCH /billing/orders/:id/mark-ready` — sets `readyAt = now()`
- Typecheck + deploy API + commit

**Task 8 — Web: `X-Outlet-Id` header + audit wiring**
- `api-client.ts` `apiFetch`: add `X-Outlet-Id` from a second param or closure
- Update all `apiFetch` call sites to pass `activeOutlet.id`
- Update CORS `allowHeaders` on API to include `X-Outlet-Id`

**Task 9 — Web: Settings → Staff tab**
- Invite modal (phone + role + outlet multi-select)
- Member list with PENDING/ACCEPTED badge, role label, outlet chips
- Remove + role-change actions
- Typecheck + deploy web

**Task 10 — Web: Table picker on POS**
- `GET /tables` in bootstrap or separate call
- If tables exist: show grid picker (sections as pill tabs, table cards)
- If no tables: fall back to free-text input (existing behaviour)
- Selected table name written to `saleOrder.tableNo` on start order
- Typecheck + deploy web

**Task 11 — Web: Kitchen Display `/kitchen`**
- `KITCHEN` role redirect: after login → `/kitchen` instead of `/pos`
- Full-screen card grid, timer per order (elapsed since `createdAt`)
- Colour urgency: green / amber / red
- "Ready ✓" button per card
- Auto-refresh every 10s via `setInterval`
- No nav header — dedicated KDS layout
- Typecheck + deploy web

**Task 12 — Web: Reports page `/reports`**
- Layout: left sidebar (desktop) / horizontal scrollable tabs (mobile) with all 6 report types
- Shared header: period preset pills (Today / Yesterday / This Week / This Month / This Year / All Time) + "Custom" button → `@mantine/dates` `DatePickerInput` range picker + outlet filter (OWNER only)
- `summary` panel: 3 stat cards (Revenue / Orders / Avg)
- `top-items` panel: `BarChart` from `@mantine/charts`
- `orders-by-status` panel: 3 stat cards (OPEN / PAID / VOID) + `DonutChart`
- `payment-methods` panel: `DonutChart` + table rows (method, count, revenue)
- `hourly` panel: `BarChart` — 24 bars (revenue by hour, IST)
- `daily-trend` panel: `LineChart` — revenue per day in period
- Each panel calls `GET /reports/:type?from=&to=` on mount and on date range / outlet change
- New report type = new sidebar entry + new panel component — zero other changes
- Typecheck + deploy web

**Task 13 — E2E**
- API: invite → accept → outlet scope check → permission check
- API: report summary numbers match manual SQL
- API: KDS list → mark ready → disappears from list
- Web: Owner invites waiter → waiter logs in → lands on POS, sees only assigned outlet
- Web: Manager logs in → sees only their outlet → reports scoped correctly
- Web: KITCHEN logs in → lands on `/kitchen` → cards auto-refresh
- Web: table picker (if tables configured)
- Web: reports page with period toggle
- Screenshots mobile + desktop; commit + push

---

## Files

### New files
| Path | Purpose |
|------|---------|
| `packages/logix-dine/schemas/pos-schema.ts` | + `memberOutletAccess`, `posTable`, audit cols |
| `packages/logix-dine/types/pos-schema.ts` | Updated JSON row types |
| `packages/logix-dine/types/roles.ts` | WAITER gets `order:settle`; `saleOrder.readyAt` |
| `apps/logix-dine/api/migrations/v3.sql` | ALTER TABLE + CREATE TABLE migration |
| `apps/logix-dine/api/src/routes/staff.ts` | Staff invite + management |
| `apps/logix-dine/api/src/routes/tables.ts` | posTable CRUD |
| `apps/logix-dine/api/src/routes/reports.ts` | Summary + top items + status breakdown |
| `apps/logix-dine/web/app/(owner)/reports/page.tsx` | Reports dashboard |
| `apps/logix-dine/web/app/kitchen/page.tsx` | KDS (own layout, no owner guard) |
| `apps/logix-dine/web/app/kitchen/layout.tsx` | Full-screen, no nav header |

### Modified files
| Path | What changes |
|------|-------------|
| `apps/logix-dine/api/src/lib/tenancy.ts` | Outlet-scope check + actorPhone |
| `apps/logix-dine/api/src/index.ts` | Auto-accept pending invites in handleVerifyOtp |
| `apps/logix-dine/api/src/index.ts` | Mount staff/tables/reports routes |
| `apps/logix-dine/web/lib/api-client.ts` | Send `X-Outlet-Id` header |
| `apps/logix-dine/web/app/(owner)/settings/page.tsx` | + Staff tab |
| `apps/logix-dine/web/app/(owner)/pos/page.tsx` | Table picker |
| `apps/logix-dine/web/app/page.tsx` | KITCHEN role → redirect to /kitchen |

---

## Risks & Notes

- **`userId` nullable on `restaurantMember`**: drizzle's unique constraint doesn't support partial indexes natively in v0.x. Enforce uniqueness in application logic: on invite, check for existing member with same `(restaurantId, phone)` instead of relying on DB unique constraint.
- **Phone backfill**: existing member rows don't have `phone`. The migration backfills from `user.phoneNumber`. Any members without a user (impossible in v2) stay null — safe.
- **WAITER now can settle**: updated `ROLE_PERMISSIONS` only. All route guards use `hasPermission` so no route code changes.
- **WhatsApp for invite**: 1 message per invite, user-triggered (owner clicks "Send Invite"). This is a genuine user-facing message, not a test ping — acceptable per the OpenWA rate-limit rule.
- **KDS auto-refresh**: `setInterval` with `load()` every 10s. Clear interval on unmount to avoid memory leaks (`useEffect` return cleanup).
- **Reports SQL**: use raw drizzle `sql` template for the filtered aggregates — drizzle's ORM layer doesn't handle `FILTER (WHERE ...)` natively.
- **`X-Outlet-Id` CORS**: add to `allowHeaders` in `index.ts` alongside `X-Restaurant-Id`.
