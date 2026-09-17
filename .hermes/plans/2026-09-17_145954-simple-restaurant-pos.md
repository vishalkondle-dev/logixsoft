# Simple Restaurant POS (Responsive) — Implementation Plan

> **For Hermes:** Implement task-by-task with the subagent-driven-development skill; commit after every task; deploy web via `pnpm run deploy` in `apps/logix-dine/web` (OpenNext — NEVER plain build+wrangler) and API via `npx wrangler deploy` in `apps/logix-dine/api`; verify each live change with curl + browser before committing (repo convention: test → commit → push).

**Goal:** A simple, fully responsive Point-of-Sale for a single restaurant: table statuses, category/menu grid, cart, settle (cash/UPI), order history — usable on a phone (375px) and desktop (1280px+).

**Architecture:** Follows the established logix-dine pattern — drizzle tables in `packages/logix-dine/schemas` are the single source of truth; zod contracts mirror them with `AssertSame` compile-time assertions; shared mappers build validated responses; Hono (OpenAPI) endpoints in the API app; Mantine v9 UI in the web app. Money is stored as **integer paise** (INR) to avoid float drift. POS routes are gated to `STAFF`/`OWNER` roles — the existing `user.role` text column needs no migration.

**Tech Stack:** Hono + zod-openapi, Drizzle ORM + Postgres (Hyperdrive), Mantine v9, Next.js 16 (OpenNext on Cloudflare), OpenWA for optional WhatsApp bill delivery.

---

## Current Context / Assumptions

- Auth is complete (WhatsApp OTP, HttpOnly cookie, `AuthUser` SSOT from `user` table). Roles: `user.role` text, default `CUSTOMER`.
- `apps/logix-dine/api/src/index.ts` is the single API file (422 lines) — POS handlers will live in a new `src/routes/pos.ts` mounted sub-app to avoid growing it further.
- No migration tooling — DB tables are created manually via psql (e.g. `rateLimit`). Migration SQL will be committed under `apps/logix-dine/api/migrations/` and applied with `sudo -u postgres psql -p 5432 -d payment -f <file>` (DB: `payment`, port 5432, runs on this VPS).
- Web routing: `app/(protected)/` has the auth guard layout; `app/layout.tsx` renders AppShell + floating bottom nav. POS gets `app/(protected)/pos/` and `app/(protected)/orders/`.
- Testing today = `tsc --noEmit` + live curl E2E + browser QA (no test framework in the repo — YAGNI for now).
- **Out of scope (v1):** multi-outlet, kitchen display/KOT printing, discounts/GST, real UPI gateway, item modifiers, staff per-table split bills.

---

## Data Model (single source of truth)

### `packages/logix-dine/schemas/pos-schema.ts` (drizzle)

| Table | Columns (key ones) |
|---|---|
| `restaurantProfile` | `id` (single row, default `'main'`), `name`, `currency` ('INR'), `createdAt` |
| `posTable` | `id`, `number` (int unique), `capacity`, `status` (`'AVAILABLE' \| 'OCCUPIED' \| 'RESERVED'`), `createdAt` |
| `menuCategory` | `id`, `name`, `sortOrder`, `createdAt` |
| `menuItem` | `id`, `categoryId` → menuCategory, `name`, `pricePaise` (int, notNull), `available` (bool default true), `sortOrder`, `createdAt` |
| `posOrder` | `id`, `tableId` → posTable, `status` (`'OPEN' \| 'SETTLED' \| 'VOID'`), `totalPaise` (int default 0), `settleMethod` (`'CASH' \| 'UPI'`, nullable), `createdAt`, `settledAt` (nullable), `settledByUserId`, `customerName` (nullable — for future walk-ins) |
| `posOrderItem` | `id`, `orderId` → posOrder (cascade), `itemId` → menuItem, `nameSnapshot`, `pricePaiseSnapshot` (int), `qty` (int, `>0`), `createdAt` |

- Unique constraint on `posOrder.tableId` WHERE status = 'OPEN' — one open order per table. (Postgres partial unique index: `CREATE UNIQUE INDEX ... ON "posOrder"("tableId") WHERE status = 'OPEN'`.)
- `package.json` exports already cover `./schemas/*`, `./types/*`, `./mappers/*` — new files just extend them.

### `packages/logix-dine/types/pos-schema.ts`
`PosTableRow`, `MenuCategoryRow`, `MenuItemRow`, `PosOrderRow`, `PosOrderItemRow`, `RestaurantProfileRow` + `Json*` variants (dates → ISO strings) — same pattern as auth.

### `packages/logix-dine/schemas/pos.ts` (zod contracts, SSOT-asserted)
- `MoneySchema = z.number().int().nonnegative()` (paise)
- `PosTableSchema`, `MenuCategorySchema`, `MenuItemSchema`, `PosOrderSchema`, `PosOrderItemSchema` — each with `type _T = Expect<AssertSame<z.infer<...>, Json...Row>>`
- Request schemas: `OpenOrderRequestSchema {tableId}`, `AddOrderItemRequestSchema {itemId, qty?}`, `UpdateOrderItemQtySchema {qty}`, `SettleOrderRequestSchema {method: 'CASH'|'UPI', customerName?}`
- Response schemas: `PosBootstrapResponseSchema {restaurant, tables, categories, items}`, `BillResponseSchema {order, items}`

### `packages/logix-dine/types/pos.ts` — inferred types (exported via `types/index.ts`)
### `packages/logix-dine/mappers/pos.ts` — `toPosTable`, `toMenuCategory`, `toMenuItem`, `toPosOrder`, `toPosOrderItem` (row → validated JSON), mirroring `mappers/auth.ts`

### Shared role constant
`packages/logix-dine/types/auth.ts` or new `types/roles.ts`: `export const ROLES = ['CUSTOMER', 'STAFF', 'OWNER'] as const; export type Role = (typeof ROLES)[number];` — used by auth schema default + web badge + API guard.

---

## API

### `apps/logix-dine/api/src/routes/pos.ts` (new)
Hono sub-app mounted in `index.ts` under both prefixes (`/pos` and `/api/pos`), like the auth routes. Every endpoint:
1. Runs the staff guard (`requireRole('STAFF')`) — new helper in `src/lib/role-guard.ts` (reads session via `auth.api.getSession({headers: c.req.raw.headers})`, checks `user.role`).
2. Uses `getAuthInstance(c)` + the pos drizzle schema (`createDbWithClient` with `{...authSchema, ...posSchema}` — extend `authSchema` export name to a combined `appSchema` in `api/src/db/index.ts`, or pass both maps).
3. Validates request with zod schema, builds response with mappers.

### Endpoints
| Method/Path | Purpose |
|---|---|
| `GET /pos/bootstrap` | Restaurant profile + tables + categories + items (one payload for the POS screen) |
| `POST /pos/orders` | Open an order for a table (409 if table has an OPEN order; sets table status OCCUPIED) |
| `GET /pos/orders/:id` | Bill: order + items (404 if not found) |
| `POST /pos/orders/:id/items` | Add item (qty ≥ 1); recompute `totalPaise` |
| `PATCH /pos/orders/:id/items/:orderItemId` | Update qty (recompute total) |
| `DELETE /pos/orders/:id/items/:orderItemId` | Remove item (recompute total) |
| `POST /pos/orders/:id/settle` | Mark SETTLED, set settleMethod/settledAt/settledBy, free table (AVAILABLE); returns BillResponse. Optional: fire-and-forget WhatsApp bill via `sendWhatsAppText` (packages/wa) to a configured staff number — guarded by `pos.waNotifyNumber` env, never blocks the response |
| `GET /pos/orders?status=&date=` | Order history (desc, limit 50) with items |

All response shapes validated through zod schemas at build time; every endpoint documented in OpenAPI (`/doc`).

### `apps/logix-dine/api/src/index.ts` (modify)
Mount: `app.route('/pos', posRoutes)` + `app.route('/api/pos', posRoutes)`; register OpenAPI tags.

---

## Web

### `apps/logix-dine/web/app/(protected)/pos/page.tsx` (new)
Client page. **Layout (responsive):**
- Mobile (base): full-screen workspace — table grid first (`Table Status`), tap a table → menu/cart screen (stacked: category pills, item grid, sticky cart bar with total → opens **bottom-sheet cart**).
- Desktop (sm+): two columns — left: table grid / menu selection; right: persistent cart panel (Mantine `Grid` + `Paper`).

### `apps/logix-dine/web/components/pos/` (new)
- `table-grid.tsx` — responsive cards; AVAILABLE (green outline) / OCCUPIED (filled, shows open-order total) / RESERVED.
- `table-screen.tsx` — the working screen: `category-pills.tsx` (horizontal scroll on mobile), `item-card.tsx` (name, price ₹, + button; disabled when unavailable), `menu-search.tsx` (name filter).
- `cart-drawer.tsx` — Mantine `Drawer` (bottom / `position="bottom"` on mobile, right panel slot on desktop): line items, qty +/- , remove, total.
- `settle-modal.tsx` — method choice (Cash / UPI), shows bill total, settle → success state (`CheckCircle` + "Table X settled"), clears state, marks table available.
- `orders-history.tsx` (under `app/(protected)/orders/page.tsx`) — list of settled/void orders (date filter), tap → bill view modal. Reuse `bill-summary.tsx`.

### Data layer
- `web/lib/pos-client.ts` — typed fetch helpers (`getBootstrap`, `openOrder`, `addItem`, `updateQty`, `removeItem`, `settleOrder`, `listOrders`) using `AuthUser`-style package types; no new state library — local component state + `useEffect` (YAGNI; TanStack Query already in deps if it grows).

### Role gate
- `app/(protected)/pos/` + `/orders/` wrapped so non-staff see an "Access Restricted" card (mirror `(protected)/layout.tsx` pattern) — check `user.role` from `useAuth()`.
- For testing: set Vishal's role to STAFF once (`UPDATE "user" SET role='STAFF' WHERE ...` in migration notes, not in the schema).

---

## Migration

### `apps/logix-dine/api/migrations/001_pos_tables.sql` (new)
```sql
CREATE TABLE IF NOT EXISTS "restaurantProfile" (...);
CREATE TABLE IF NOT EXISTS "posTable" (...);
CREATE TABLE IF NOT EXISTS "menuCategory" (...);
CREATE TABLE IF NOT EXISTS "menuItem" (...);
CREATE TABLE IF NOT EXISTS "posOrder" (...);
CREATE TABLE IF NOT EXISTS "posOrderItem" (...);
CREATE UNIQUE INDEX IF NOT EXISTS "posOrder_open_table_idx" ON "posOrder"("tableId") WHERE status = 'OPEN';
-- seed: restaurant profile, 1 category + 2 items, 4 tables (numbers 1-4, capacity 2-8)
-- note: set staff role: UPDATE "user" SET role='STAFF' WHERE phoneNumber='+917276718848';
```
Apply: `sudo -u postgres psql -p 5432 -d payment -f apps/logix-dine/api/migrations/001_pos_tables.sql` — verify with `\d posOrder`.

---

## Task List (bite-sized)

### Task 1 — Drizzle tables (SSOT)
Files: Create `packages/logix-dine/schemas/pos-schema.ts`; Modify `packages/logix-dine/schemas/index.ts`.
Step 1: write tables per Data Model. Step 2: `cd packages/logix-dine && npx tsc --noEmit` → clean. Step 3: commit `feat(shared): add POS schema tables`.

### Task 2 — Row & JSON types + contracts + mappers
Files: Create `packages/logix-dine/types/pos-schema.ts`, `types/pos.ts`, `schemas/pos.ts`, `mappers/pos.ts`; modify `types/index.ts`, `schemas/index.ts`, `mappers/index.ts`.
Step 1: types + `AssertSame` contracts. Step 2: mappers. Step 3: typecheck package → clean (assertions prove SSOT). Commit.

### Task 3 — SQL migration + seed + apply
Files: Create `apps/logix-dine/api/migrations/001_pos_tables.sql`.
Step 1: write SQL. Step 2: apply via psql; verify `\d posOrder` and seed rows. Step 3: set Vishal role=STAFF. Commit.

### Task 4 — Role guard + staff-role constant
Files: Create `apps/logix-dine/api/src/lib/role-guard.ts`; Modify `packages/logix-dine/types/roles.ts` (or auth.ts) + API auth `additionalFields.role` default typing.
Step 1: `ROLES` const + `requireRole(...)` Hono middleware (401/403 JSON). Step 2: typecheck API. Step 3: curl-verify staff vs customer on a test-protected route (temp). Commit.

### Task 5 — POS bootstrap endpoint
Files: Create `apps/logix-dine/api/src/routes/pos.ts` (bootstrap only, mounted); modify `api/src/index.ts` (mount), `api/src/db/index.ts` (combined schema).
Step 1: handler + OpenAPI + mount. Step 2: typecheck. Step 3: `curl /pos/bootstrap` with staff cookie → 200 full payload; with customer cookie → 403. Commit.

### Task 6 — Order lifecycle endpoints (open / bill / add / qty / remove)
Files: Modify `apps/logix-dine/api/src/routes/pos.ts`.
Step 1: open (409 on duplicate OPEN), add item (recompute total via sum query), qty update (clamp ≥1), remove, bill. Step 2: typecheck. Step 3: curl E2E: open → add 2 items → qty 3 → remove → bill totals correct; 409 on second open. Commit.

### Task 7 — Settle + history endpoints
Files: Modify `apps/logix-dine/api/src/routes/pos.ts`.
Step 1: settle (transaction: SETTLED, method/at/by, table→AVAILABLE); optional envoy'd WhatsApp notify. Step 2: `GET /pos/orders?status=&date=`. Step 3: curl E2E settle + `100 INR` amount sanity; history lists it; second open on same table now OK. Commit.

### Task 8 — API deploy + full API E2E
Run: `npx wrangler deploy` in `apps/logix-dine/api`; curl suite (bootstrap → open → items → settle → history; rate-limit/health regression). Commit (no code change → skip commit; if fixes, commit).

### Task 9 — Web: POS page scaffold + table grid
Files: Create `app/(protected)/pos/page.tsx`, `components/pos/table-grid.tsx`, `web/lib/pos-client.ts`.
Step 1: bootstrap fetch + grid render (AVAILABLE/OCCUPIED states). Step 2: typecheck web. Step 3: local `next dev` screenshot at 375px + 1280px (browser tool + saved cookie). Commit.

### Task 10 — Web: menu screen (pills, items, search)
Files: Create `components/pos/table-screen.tsx`, `category-pills.tsx`, `item-card.tsx`, `menu-search.tsx`.
Step 1: select table → menu; add-to-cart state. Step 2: typecheck + dev QA mobile/desktop. Commit.

### Task 11 — Web: cart (mobile bottom sheet / desktop side panel)
Files: Create `components/pos/cart-drawer.tsx`.
Step 1: cart UI + qty +/-/remove calling pos-client; totals update. Step 2: QA at both viewports. Commit.

### Task 12 — Web: settle modal + success flow
Files: Create `components/pos/settle-modal.tsx`.
Step 1: method pick (Cash/UPI) → settle API → success screen → table returns AVAILABLE. Step 2: full POS UX walkthrough at 375px + desktop (browser E2E with real API). Commit.

### Task 13 — Web: orders history page
Files: Create `app/(protected)/orders/page.tsx`, `components/pos/bill-summary.tsx`.
Step 1: list + date filter + bill modal. Step 2: typecheck + QA. Commit.

### Task 14 — Role gate + responsive polish
Files: Modify web POS/orders layout + app shell nav (add POS entry to `app-shell.tsx` NAV_ITEMS).
Step 1: non-staff blocked card; nav item. Step 2: pixel-check iPhone SE (375×667 full-page screenshot) + 1280×800 — no clipped/overlapping UI; verify bottom nav + cart sheet. Commit.

### Task 15 — Deploy web + final E2E + push
Run: `pnpm run deploy` in `apps/logix-dine/web` (OpenNext, never plain build). Verify live: full POS order at both viewports with the saved session (staff role), sign-out/restricted regression, `/doc` includes POS tags. Commit + `git push origin main`.

---

## Tests / Validation (repo convention)

- **Per task:** `npx tsc --noEmit` in `packages/logix-dine`, `apps/logix-dine/api`, `apps/logix-dine/web` — all must stay clean (SSOT assertions included).
- **API:** curl E2E against the deployed worker with the staff cookie (see Task 8 suite); wrong-role → 403; duplicate open order → 409; totals in paise.
- **Web:** browser E2E at 375×667 (iPhone SE) and 1280×800 — login via saved session cookie (`/root/dine-session-cookie.json`), full POS flow, screenshots per viewport.
- **Deploy order:** API first, verify, then web; each deployment verified with `/health` + real request before commit.

## Risks / Tradeoffs / Open Questions

- **One open order per table via partial unique index** — solid, but `ON CONFLICT` handling must be deliberate; 409 is fine for v1.
- **No test framework** — typecheck + live E2E is the guardrail; if POS logic (totals, transitions) grows, add Vitest for `mappers/pos.ts` + order service next iteration.
- **`index.ts` growth** — routes/ module keeps it bounded; revisit restructuring into `src/routes/` wholesale if it keeps growing.
- **Table status drift**: status lives on `posTable`; order status on `posOrder` — settle/open transitions update both in one transaction (Task 7) to avoid drift.
- **Open questions:** UPI = recorded method only (no gateway) — OK? Currency symbol ₹ hardcoded vs from `restaurantProfile.currency`? Receive WhatsApp bill on settle — enabled via env or off by default? (Defaults chosen: INR-only, symbol from profile, WhatsApp notify OFF unless env set.)