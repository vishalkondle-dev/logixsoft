# Multi-Tenant Restaurant POS — Implementation Plan (v2)

> **For Hermes:** Implement task-by-task with the subagent-driven-development skill; commit after every task; deploy web via `pnpm run deploy` in `apps/logix-dine/web` (OpenNext — NEVER plain build+wrangler) and API via `npx wrangler deploy` in `apps/logix-dine/api`; verify each live change with curl + browser before committing (repo convention: test → commit → push).

**Goal:** A simple, fully responsive, **multi-tenant** Restaurant POS that can be sold to many restaurants: each restaurant gets its own tables, menu, and orders, run by its **single owner** (staff invites/memberships are v2); one login can operate multiple restaurants the user owns.

**Architecture:** Follows the established logix-dine pattern — drizzle tables in `packages/logix-dine/schemas` are the single source of truth; zod contracts mirror them with `AssertSame` assertions; shared mappers build validated responses; Hono (OpenAPI) endpoints; Mantine v9 UI. **Tenancy = shared database with `restaurantId` scoping on every tenant table**, ownership via `restaurant.ownerUserId` (row-level isolation; schema-per-tenant rejected for v1). Money as **integer paise** (INR). No staff roles in v1 — the owner is the only operator.

**Tech Stack:** Hono + zod-openapi, Drizzle ORM + Postgres (Hyperdrive), Mantine v9, Next.js 16 (OpenNext on Cloudflare), OpenWA for WhatsApp OTP.

---

## Current Context / Assumptions

- Auth is complete (WhatsApp OTP, HttpOnly cookie, `AuthUser` SSOT from `user` table). `user.role` stays **platform-level** (`CUSTOMER` | `ADMIN`) — restaurant access is managed by ownership (`restaurant.ownerUserId`), not user role.
- `apps/logix-dine/api/src/index.ts` (422 lines) is the single API file — POS handlers live in a new `src/routes/pos.ts` mounted sub-app; ownership/tenancy logic in `src/lib/tenancy.ts`.
- No migration tooling — committed SQL under `apps/logix-dine/api/migrations/`, applied via `sudo -u postgres psql -p 5432 -d payment -f <file>` (DB `payment`, port 5432, this VPS).
- Web routing: `app/(protected)/` is auth-guarded; POS gets `app/(protected)/pos/` and `app/(protected)/orders/`; restaurant switcher lives in the AppShell header (`app-shell.tsx`).
- Testing = `tsc --noEmit` + live curl E2E + browser QA (no test framework in repo — YAGNI; add Vitest for mappers/tenancy if logic grows).
- **Decisions (veto any):**
  1. **One outlet per restaurant in v1** — `restaurantOutlet` table exists (seeded with a default) but tables/menu/orders scope to `restaurantId` directly; outlets activated when a real need appears.
  2. **Single owner per restaurant, no staff in v1** — `restaurant.ownerUserId`; only the owner can operate the POS. `restaurantMember` + invites are explicitly v2.
  3. **No billing/subscriptions v1** — `restaurant.status` enum (`ACTIVE` | `TRIAL`) only, for future gating.
  4. **Tenant selection UI:** header restaurant switcher; active restaurant kept in a cookie (`dine.restaurantId`); the API takes `X-Restaurant-Id` header and validates ownership on every tenant-scoped call.
- **Out of scope (v1):** staff/memberships/invites, multi-outlet, KOT printing, discounts/GST, real UPI gateway, item modifiers, per-table split bills, platform admin panel, subscription payments.

---

## Data Model (SSOT)

### `packages/logix-dine/schemas/pos-schema.ts` (drizzle) — *all tenant rows carry `restaurantId`*

| Table | Columns (key ones) |
|---|---|
| `restaurant` (tenant) | `id`, `name`, `slug` (unique, for future per-restaurant branding), `currency` (default `INR`), `status` (`ACTIVE \| TRIAL`, default `TRIAL`), **`ownerUserId`** → user (the only operator in v1), `createdAt`, `updatedAt` |
| `restaurantOutlet` | `id`, `restaurantId` → restaurant, `name` (default `'Main'`), `address` (nullable), `createdAt` |
| `posTable` | `id`, `restaurantId`, `number` (int, unique per restaurant), `capacity`, `status` (`AVAILABLE \| OCCUPIED \| RESERVED`), `createdAt` |
| `menuCategory` | `id`, `restaurantId`, `name`, `sortOrder`, `createdAt` |
| `menuItem` | `id`, `restaurantId`, `categoryId` → menuCategory, `name`, `pricePaise` (int notNull), `available` (bool default true), `sortOrder`, `createdAt` |
| `posOrder` | `id`, `restaurantId`, `tableId` → posTable, `status` (`OPEN \| SETTLED \| VOID`), `totalPaise` (int default 0), `settleMethod` (`CASH \| UPI`, nullable), `customerName` (nullable), `createdAt`, `settledAt` (nullable), `settledByUserId` |
| `posOrderItem` | `id`, `orderId` → posOrder (cascade), `itemId` → menuItem, `nameSnapshot`, `pricePaiseSnapshot`, `qty` (int > 0), `createdAt` |

- Partial unique index: `posOrder_open_table_idx ON posOrder(tableId) WHERE status = 'OPEN'` — one open order per table.
- Composite indexes on every tenant table: `(restaurantId, ...)` — the tenancy guard + scoping rule is **every query filters by restaurantId**; leaking across tenants returns 404 (not 403) so tenants can't enumerate each other.
- `package.json` exports already cover `./schemas/*`, `./types/*`, `./mappers/*`.

### `packages/logix-dine/types/pos-schema.ts`
`RestaurantRow`, `RestaurantOutletRow`, `PosTableRow`, `MenuCategoryRow`, `MenuItemRow`, `PosOrderRow`, `PosOrderItemRow` + `Json*` variants (dates → ISO) — same pattern as auth.

### `packages/logix-dine/schemas/pos.ts` (zod contracts, SSOT-asserted)
- `MoneySchema = z.number().int().nonnegative()` (paise)
- Row schemas with `Expect<AssertSame<...>>` per row type
- Requests: `OpenOrderRequestSchema {tableId}`, `AddOrderItemRequestSchema {itemId, qty?}`, `UpdateOrderItemQtySchema {qty}`, `SettleOrderRequestSchema {method, customerName?}`, `CreateRestaurantRequestSchema {name, slug?}`
- Responses: `PosBootstrapResponseSchema {restaurant, tables, categories, items}`, `BillResponseSchema {order, items}`, `RestaurantListResponseSchema`, `OrderHistoryResponseSchema`

### `packages/logix-dine/mappers/pos.ts` — `toRestaurant`, `toPosTable`, `toMenuCategory`, `toMenuItem`, `toPosOrder`, `toPosOrderItem` (row → validated JSON)

---

## Tenancy Layer

### `apps/logix-dine/api/src/lib/tenancy.ts` (new)
- `requireRestaurant()` — Hono middleware: reads `X-Restaurant-Id` header → resolves session user (`auth.api.getSession`) → loads the restaurant → checks `restaurant.ownerUserId === session user id`; sets `{ restaurantId, restaurant }` on `c.set('tenant', ...)`; **403** if not the owner, **404** if restaurant doesn't exist.
- `resolveOwnedRestaurants(userId)` — list restaurants owned by the user (switcher payload).
- All pos routes run `requireRestaurant()`; every query passes `restaurantId`.

### Role model
- v1 has no restaurant roles — `user.role` (platform: `CUSTOMER` | `ADMIN`) stays untouched. Ownership = `restaurant.ownerUserId`. Staff/membership roles arrive with v2.

---

## API

### `apps/logix-dine/api/src/routes/pos.ts` (new — mounted under `/pos` and `/api/pos`)
All POS endpoints run `requireRestaurant()`; responses validated via mappers/schemas; OpenAPI-tagged.

| Method/Path | Purpose | Access |
|---|---|---|
| `GET /pos/bootstrap` | Restaurant + tables + categories + items | owner |
| `POST /pos/orders` | Open order for table (409 if OPEN exists; table→OCCUPIED) | owner |
| `POST /pos/orders/:id/items` | Add item, recompute totalPaise | owner |
| `PATCH /pos/orders/:id/items/:orderItemId` | Qty update (clamp ≥1), recompute | owner |
| `DELETE /pos/orders/:id/items/:orderItemId` | Remove item, recompute | owner |
| `POST /pos/orders/:id/settle` | SETTLED + method/at/by, table→AVAILABLE (transaction) | owner |
| `GET /pos/orders?status=&date=` | History, desc, limit 50, with items | owner |

### `apps/logix-dine/api/src/routes/restaurants.ts` (new — mounted under `/restaurants` and `/api/restaurants`)
| Method/Path | Purpose | Access |
|---|---|---|
| `GET /restaurants` | My restaurants (switcher payload: id, name) | any authenticated |
| `POST /restaurants` | Create restaurant → creator becomes owner (transaction: restaurant + outlet + seed tables 1-4 + sample categories/items) | any authenticated |
| `GET /restaurants/:id` | Restaurant details | owner |

- `api/src/db/index.ts`: export combined `appSchema = { ...authSchema, ...posSchema }` for the drizzle adapter.

---

## Web

### App shell
- `app-shell.tsx` header: **restaurant switcher** (Menu with my restaurants from `GET /restaurants`; selection stored in cookie `dine.restaurantId`; hidden vs. no owned restaurants) + existing avatar menu. Nav adds **POS** and **Orders** items (visible when the user owns ≥1 restaurant; otherwise only Home/Dashboard).

### `app/(protected)/pos/page.tsx` (new — client)
- **Responsive layout:** mobile (base): full-screen workspace — table grid → tap table → menu screen (category pills + item grid + search) → sticky cart bar → bottom-sheet cart → settle modal. Desktop (sm+): two columns — tables/menu left, persistent cart panel right.
- Reads active restaurant from context+cookie; calls pos-client helpers with `X-Restaurant-Id`.

### `app/(protected)/restaurants/page.tsx` (new) — onboarding/management
- No restaurants: **create-restaurant wizard** (name → creates tenant, seeds outlet/tables/sample menu → lands in POS).
- Has restaurants: list (switchable into POS); details page shows restaurant info (owner-only by construction).

### Components (`web/components/pos/` + `web/components/restaurants/`)
- `table-grid.tsx`, `category-pills.tsx`, `item-card.tsx`, `menu-search.tsx`, `cart-drawer.tsx` (bottom sheet mobile / panel desktop), `settle-modal.tsx`, `bill-summary.tsx` (reused by orders history + settle receipt), `orders-history.tsx`, `restaurant-switcher.tsx`, `create-restaurant-form.tsx`.

### Data layer
- `web/lib/pos-client.ts` — typed helpers (`getBootstrap`, `openOrder`, `addItem`, `updateQty`, `removeItem`, `settleOrder`, `listOrders`) and `web/lib/restaurants-client.ts` (`listMyRestaurants`, `createRestaurant`); both attach `X-Restaurant-Id` from context. Local state + `useEffect` (YAGNI; TanStack Query already in deps if it grows).

---

## Migration

### `apps/logix-dine/api/migrations/002_multitenant_pos.sql` (new)
```sql
CREATE TABLE IF NOT EXISTS "restaurant" (... ownerUserId ...);
CREATE TABLE IF NOT EXISTS "restaurantOutlet" (...);
CREATE TABLE IF NOT EXISTS "posTable" (...);
CREATE TABLE IF NOT EXISTS "menuCategory" (...);
CREATE TABLE IF NOT EXISTS "menuItem" (...);
CREATE TABLE IF NOT EXISTS "posOrder" (...);
CREATE TABLE IF NOT EXISTS "posOrderItem" (...);
CREATE UNIQUE INDEX IF NOT EXISTS "posOrder_open_table_idx" ON "posOrder"("tableId") WHERE status='OPEN';
CREATE INDEX ... ON each tenant table ("restaurantId", ...);
-- test seed (optional): a demo restaurant "Vishal's Diner" with ownerUserId set to Vishal's user id
```
Apply: `sudo -u postgres psql -p 5432 -d payment -f apps/logix-dine/api/migrations/002_multitenant_pos.sql`; verify `\d posOrder`.

---

## Task List (bite-sized)

1. **Drizzle tenant tables** — Create `schemas/pos-schema.ts` (+ export); typecheck package; commit.
2. **Types + contracts + mappers** — Create `types/pos-schema.ts`, `types/pos.ts`, `schemas/pos.ts`, `mappers/pos.ts`; AssertSame assertions; typecheck; commit.
3. **Migration + seed + apply** — `002_multitenant_pos.sql`; psql apply; verify; commit.
4. **Tenancy layer** — `api/src/lib/tenancy.ts` (requireRestaurant w/ ownerUserId check + resolveOwnedRestaurants); route `restaurants.ts` GET /restaurants (my restaurants); curl E2E with cookie; commit.
5. **Create restaurant + auto-seed** — POST /restaurants (transaction: restaurant + owner + outlet + 4 tables + sample menu); curl: create → bootstrap works; commit.
6. **POS bootstrap + order lifecycle endpoints** — open/409, bill, add/qty/remove with totals recompute (sum query), all tenant-scoped; curl E2E; commit.
7. **Settle + history** — settle transaction (order SETTLED, table AVAILABLE), GET /pos/orders history; curl E2E incl. re-open same table; commit.
8. **Cross-tenant isolation tests** — second user (no ownership) → 403 on POS + 404 on other's restaurant; owner of restaurant A blocked from restaurant B; curl E2E; commit.
9. **API deploy + full suite** — wrangler deploy; curl suite (create→bootstrap→open→items→settle→history→403/404 isolation); commit any fixes.
10. **Web: switcher + onboarding** — restaurant-switcher in app-shell (cookie persistence), `/restaurants` page (wizard when empty); dev-QA at 375px/1280px; commit.
11. **Web: POS table grid + menu screen** — `/pos` page, pos-client, table-grid, category-pills, item-card, search; commit.
12. **Web: cart + settle** — cart-drawer (bottom sheet/panel), settle-modal, success flow, table returns AVAILABLE; commit.
13. **Web: orders history** — `/orders` page + bill view; commit.
14. **Role gates + responsive polish** — non-owner → "No access" card; nav gating; pixel QA iPhone SE 375×667 + 1280×800; commit.
15. **Deploy web + final E2E + push** — `pnpm run deploy` (web), full two-viewport POS walkthrough with real API, sign-out/restricted regression, `/doc` includes new tags; commit + push.

---

## Tests / Validation

- Per task: `npx tsc --noEmit` in package / api / web — all clean (SSOT assertions included).
- API: curl E2E with two users (owner vs user without ownership): 403 on POS for non-owner, 404 on someone else's restaurant, 409 duplicate open, paise totals.
- Web: browser E2E at 375×667 (iPhone SE) and 1280×800 — onboarding → POS flow → settle → history; screenshots per viewport; saved session cookie (`/root/dine-session-cookie.json`).
- Deploy order: API → verify → web → verify → commit+push.

## Risks / Tradeoffs / Open Questions

- **Row-level tenancy**: a missed `restaurantId` filter leaks data — mitigated by (a) strict `requireRestaurant()` middleware, (b) 404-on-cross-tenant, (c) reviewer checklist during implementation; revisit schema-per-tenant if a real tenant asks for hard isolation.
- **`index.ts` growth**: routes/ sub-apps keep it bounded; optional wholesale restructure into `src/routes/` later.
- **Single-owner v1**: staff can't operate POS yet — deliberate; `restaurantMember`/invites land in v2 without schema churn (ownerUserId stays, membership joins on top).
- **Open questions:** brand-able domain per restaurant (`slug`) — build now or when selling? Multi-outlet — when? Billing/limits (free tier cap on tables/orders?) — before or after first paid customer? How soon do we need staff access (drives v2 timing)?