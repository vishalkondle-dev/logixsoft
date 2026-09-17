# Bill & KOT Printing (v1) — Implementation Plan (v3)

> **For Hermes:** Implement task-by-task with the subagent-driven-development skill; commit after every task; deploy web via `pnpm run deploy` in `apps/logix-dine/web` (OpenNext — NEVER plain build+wrangler) and API via `npx wrangler deploy` in `apps/logix-dine/api`; verify each live change with curl + browser before committing (repo convention: test → commit → push).

**Goal:** A minimal order-taking flow that prints a **KOT** (kitchen order ticket) when an order starts and a **bill** when it's settled — fully responsive, printing on the restaurant's **58mm thermal receipt printer (BLE)** from Android/iOS/desktop — with a **role-based access system** designed to accommodate the full role hierarchy in future versions.

**Scope cut from earlier plans:** no table grid/statuses, no multi-restaurant onboarding, no menu management UI, no UPI gateway, no GST. Multi-tenant-ready columns (`restaurantId`) stay in the schema. **Role-based access is designed for the full hierarchy (Admin → Owner → Manager → Waiter → Kitchen → Customer → Custom) but v1 only enforces Owner + Waiter** — the other roles ship as permissions without UI gaps.

**Architecture:** Same logix-dine SSOT pattern (drizzle `schemas` → `AssertSame` zod contracts → shared `mappers` → Hono OpenAPI routes → Mantine v9 web). Money as **integer paise**. **Printing = Web Bluetooth (BLE)** in the browser itself — the web app pairs with the 58mm thermal printer directly and writes ESC/POS bytes, no companion app, works on Android Chrome/Edge and iOS Safari (26+), plus desktop Chrome. Browser-print (58mm HTML layout) remains the fallback when Bluetooth isn't available.

**Tech Stack:** Hono + zod-openapi, Drizzle + Postgres (Hyperdrive), Mantine v9, Next.js 16 (OpenNext), OpenWA (existing auth OTP only).

---

## Current Context / Assumptions

- Auth complete (WhatsApp OTP, HttpOnly cookie, `AuthUser` SSOT). `user.role` platform-level only.
- `apps/logix-dine/api/src/index.ts` (422 lines); new POS/billing handlers go in `src/routes/billing.ts`; tenancy/ownership guard in `src/lib/tenancy.ts`.
- Migrations: committed SQL in `apps/logix-dine/api/migrations/`, applied via `sudo -u postgres psql -p 5432 -d payment -f <file>` (DB `payment`, this VPS).
- Web: `app/(protected)/` guard; new screen at `app/(protected)/pos/` (single page: menu + cart + print actions); printable views rendered client-side in a new browser window (`window.open`, `document.write` template, then `window.print()`).
- Testing = `tsc --noEmit` + curl E2E + browser QA at 375×667 and 1280×800.
- **Decisions (veto any):**
  1. **Printing = Web Bluetooth (BLE) ESC/POS, in the browser** — connect to the printer with `navigator.bluetooth`, write ESC/POS for 58mm (32 cols), auto-print KOT/bill; printer choice remembered; works on Android Chrome/Edge + iOS Safari 26+ + desktop Chrome. Fallback: `window.print()` of the same ticket as 58mm HTML when Bluetooth is unavailable/unsupported. No Capacitor, no companion app, no Play Store.
  2. **Single restaurant in v1** — seed one restaurant owned by Vishal; `X-Restaurant-Id` header + owner check still enforced (cheap now, correct later).
  3. **Table = optional free-text field** on the order (printed on KOT as "Table: 4") — no table registry/statuses.
  4. **Menu is seeded read-only** (2-3 categories, ~8 items) — item CRUD UI is v2; edits go through SQL in dev.
  5. **Settle = mark PAID + print bill**; method recorded as free text (Cash/UPI/QR) — no payment integration.
  6. **KOT prints immediately at order creation; bill at settle; both reprintable** from the recent-orders list.
- **Out of scope (v1):** table management, staff, multi-restaurant onboarding, item CRUD UI, GST/tax lines, discounts, split bills, UPI gateway, kitchen display, Bluetooth-Classic-SPP support (BLE-only; if the printer turns out SPP-only we revisit), network-printer proxy.

## Role-Based Access Architecture

### Full role hierarchy (build now, enforce progressively)

| Role | Level | v1 access |
|---|---|---|
| `ADMIN` | Platform | Full access across all restaurants (platform admin) |
| `OWNER` | Restaurant | Full access to their restaurant — **enforced in v1** |
| `MANAGER` | Restaurant | Same as Owner minus billing settings — v2 |
| `WAITER` | Restaurant | Take orders, print KOT, view orders — **enforced in v1** |
| `KITCHEN` | Restaurant | View/acknowledge KOTs only — v2 |
| `CUSTOMER` | Platform | Self-service (future) — v2 |
| `CUSTOM_ROLE` | Restaurant | Configurable permissions — v2 |

### Schema — `restaurantMember` (added in v1, used in v2 for staff invites)

```
restaurantMember: id, restaurantId, userId, role (text), createdAt
  unique(restaurantId, userId)
```

`restaurant.ownerUserId` stays as the authoritative OWNER pointer. A `restaurantMember` row is also created for the owner on restaurant creation so all access checks go through one table.

### Permission constants — `packages/logix-dine/types/roles.ts`

```ts
export const RESTAURANT_ROLES = ['OWNER','MANAGER','WAITER','KITCHEN','CUSTOMER','CUSTOM_ROLE'] as const;
export const PLATFORM_ROLES = ['ADMIN'] as const;
export type RestaurantRole = typeof RESTAURANT_ROLES[number];
export type PlatformRole = typeof PLATFORM_ROLES[number];

// Permission map — what each role can do; extend per-feature as v2 ships
export const ROLE_PERMISSIONS = {
  OWNER:    ['orders:write','orders:settle','orders:read','bootstrap:read','members:write'],
  MANAGER:  ['orders:write','orders:settle','orders:read','bootstrap:read'],
  WAITER:   ['orders:write','orders:read','bootstrap:read'],
  KITCHEN:  ['orders:read'],
  CUSTOMER: [],
  CUSTOM_ROLE: [], // resolved from restaurantMember.customPermissions (v2)
} as const satisfies Record<RestaurantRole, readonly string[]>;

export type Permission = (typeof ROLE_PERMISSIONS)[RestaurantRole][number];
```

### API guard — `api/src/lib/tenancy.ts`

- `requireRestaurant(permission?)` — reads `X-Restaurant-Id` + session → looks up `restaurantMember` → resolves effective role → checks `ROLE_PERMISSIONS[role].includes(permission)` if given; sets `c.set('tenant', { restaurantId, role, member })`. 403 if no membership or missing permission. 404 if unknown restaurant.
- Platform `ADMIN` bypasses membership check (checked against `user.role`).
- v1 uses `requireRestaurant('orders:write')`, `requireRestaurant('orders:settle')`, `requireRestaurant('bootstrap:read')`.

### Web role awareness

- `useAuth()` already provides the user; a new `useRestaurantRole()` hook resolves the member's role from the bootstrap payload.
- Components conditionally render based on role: "Settle" button hidden for `WAITER`; "Settings" hidden for all except `OWNER` in v1.
- Non-member → "No access — contact your owner" card (same pattern as auth guard).

---

## Data Model (SSOT)

### `packages/logix-dine/schemas/pos-schema.ts` (drizzle)

| Table | Columns |
|---|---|
| `restaurant` | `id`, `name`, **`address`**, `currency` (default `INR`), `status` (`ACTIVE \| TRIAL`), `ownerUserId` → user, `createdAt`, `updatedAt` |
| `restaurantMember` | `id`, `restaurantId`, `userId` → user, `role` (text — one of `RESTAURANT_ROLES`), `createdAt`; unique (`restaurantId`, `userId`) |
| `menuCategory` | `id`, `restaurantId`, `name`, `sortOrder`, `createdAt` |
| `menuItem` | `id`, `restaurantId`, `categoryId` → menuCategory, `name`, `pricePaise` (int notNull), `available` (bool default true), `sortOrder`, `createdAt` |
| `saleOrder` | `id`, `restaurantId`, `tableNo` (text, nullable), `status` (`OPEN \| PAID`), `subtotalPaise` (int default 0), `method` (text, nullable — 'Cash'/'UPI'/'QR'), `createdAt`, `settledAt` (nullable), `settledByUserId`, `kotPrintedAt` (nullable) |
| `saleOrderItem` | `id`, `orderId` → saleOrder (cascade), `itemId` → menuItem, `nameSnapshot`, `pricePaiseSnapshot` (int), `qty` (int > 0), `createdAt` |

- Composite index `(restaurantId)` on all tenant tables.
- `restaurant` seeded once: id `'main'`, owner = Vishal's user id, status ACTIVE, 1 category + 4 starter items.

### Types / contracts / mappers (same pattern as auth)
- `types/pos-schema.ts`: `RestaurantRow`, `MenuCategoryRow`, `MenuItemRow`, `SaleOrderRow`, `SaleOrderItemRow` + `Json*` variants.
- `schemas/pos.ts`: row schemas with `Expect<AssertSame<...>>`; requests `StartOrderRequestSchema {tableNo?}`, `AddItemRequestSchema {itemId, qty?}`, `UpdateQtySchema {qty}`, `SettleOrderRequestSchema {method?}`; responses `BillingBootstrapSchema {restaurant, categories, items}`, `OrderWithItemsSchema {order, items}`, `RecentOrdersSchema`.
- `mappers/pos.ts`: `toRestaurant`, `toMenuCategory`, `toMenuItem`, `toSaleOrder`, `toSaleOrderItem`, `toOrderWithItems`.

---

## API — `apps/logix-dine/api/src/routes/billing.ts` (mounted under `/billing` and `/api/billing`)

- All routes behind `requireRestaurant(permission)` (tenancy.ts: `X-Restaurant-Id` + session → `restaurantMember` lookup → `ROLE_PERMISSIONS` check; 403 missing permission, 404 unknown restaurant).
- `bootstrap:read` required for all; `orders:write` for start/add/update/remove; `orders:settle` for settle.

| Method/Path | Purpose |
|---|---|
| `GET /billing/bootstrap` | Restaurant + categories + items |
| `POST /billing/orders` | Start OPEN order (optional `tableNo`); returns order — client prints KOT right after |
| `GET /billing/orders/:id` | Order + items (reprint KOT/bill data) |
| `POST /billing/orders/:id/items` | Add item (upsert qty if same itemId), recompute subtotal |
| `PATCH /billing/orders/:id/items/:orderItemId` | Update qty (clamp ≥1), recompute |
| `DELETE /billing/orders/:id/items/:orderItemId` | Remove, recompute |
| `POST /billing/orders/:id/settle` | PAID + method + settledAt/by, returns final order (client prints bill) |
| `GET /billing/orders/recent?limit=` | Today's orders (id, table, status, total, time) for reprint/browse |

- All response shapes validated through shared mappers/schemas; OpenAPI-tagged; totals recomputed server-side from `saleOrderItem` rows (never trust client).

---

## Web — `app/(protected)/pos/page.tsx` (single screen)

**Responsive:** mobile (base): category pills → item grid; sticky cart bar (items + total) → bottom-sheet cart. Desktop (sm+): two columns — menu left, cart right (persistent panel).

Flow:
1. Optional **table number** input (top of cart / order start prompt).
2. **Start order** (POST, then auto-**Print KOT**): KOT shows restaurant name, order #, time, table, date, items `Name xQty` + prices, "KOT — Kitchen Order Ticket".
3. Add/qty/remove items → cart totals live.
4. **Settle & Print Bill** (POST settle → print bill): bill shows order #, time, table, line items, subtotal, method, "Thank you — visit again".
5. **Recent orders** list (collapsible, today's) → tap → reprint KOT or bill.

**Components (`web/components/pos/`):**
- `menu-panel.tsx` (pills + item cards), `cart-panel.tsx` (line items, qty steppers, remove), `table-input.tsx`, `recent-orders.tsx`
- `print/kot-template.tsx`, `print/bill-template.tsx` — shared ticket UI: **header block (restaurant name + address, centered)**, 58mm layout (max-width 216px, ~12px mono font, dashed separators, big order no.), KOT labeled "KOT — KITCHEN ORDER TICKET", bill with method + "Thank you"
- `lib/print.ts` — print dispatcher: works in BLE-first mode (`window.bluetoothPrint`) with `window.print()` fallback
- `lib/bluetooth-printer.ts` — Web Bluetooth layer: `connect()` (requestDevice with BLE filter, discover GATT service/characteristic — standard 58mm printers use service `0xFF00`/`0xFFE0` + write char; **first-connect diagnostics logs the discovered UUIDs so unknown profiles are captured**), `print(bytes)` (write-without-response chunks), `disconnect()`, remembered device id in localStorage for fast reconnect, connection status state
- `lib/escpos.ts` — ESC/POS encoder for 58mm/32-col: init, alignment, bold, text lines (name/price two-column layout), feed n lines, cut; the **canonical ticket payload** comes from `lib/ticket.ts` (restaurant header, order no., table, items, qty, prices, total, method, footer) consumed by BOTH escpos and the HTML fallback
- `lib/billing-client.ts` — typed fetch helpers

**Printer pairing UX (in-app):** Settings/print menu → "Pair Bluetooth printer" (requestDevice) → success toast + remembered; a small "Printer" indicator in the header shows connected/off state; print action routes through BLE when paired, else browser print fallback with a hint.

---

## Migration — `apps/logix-dine/api/migrations/003_billing.sql`

```sql
CREATE TABLE IF NOT EXISTS "restaurant" (...);
CREATE TABLE IF NOT EXISTS "menuCategory" (...);
CREATE TABLE IF NOT EXISTS "menuItem" (...);
CREATE TABLE IF NOT EXISTS "saleOrder" (...);
CREATE TABLE IF NOT EXISTS "saleOrderItem" (...);
CREATE INDEX IF NOT EXISTS ... ON each tenant table ("restaurantId");
-- seed: restaurant 'main' (name 'Vishal's Diner', address 'Near Bus Stand, Main Road, Karad', owner = Vishal's user id, status ACTIVE); 'Starters' + 'Mains' + 'Drinks'; 8 items (e.g. Paneer Tikka ₹220, Butter Chicken ₹380, Dal Makhani ₹250, Garlic Naan ₹60, Veg Biryani ₹240, Chicken Biryani ₹290, Masala Chai ₹40, Sweet Lassi ₹90)
```
Apply: `sudo -u postgres psql -p 5432 -d payment -f apps/logix-dine/api/migrations/003_billing.sql`; verify.

---

## Task List (bite-sized)

1. **Role constants + `restaurantMember` drizzle table** — `packages/logix-dine/types/roles.ts` (`RESTAURANT_ROLES`, `PLATFORM_ROLES`, `ROLE_PERMISSIONS`, `Permission`); add `restaurantMember` to `schemas/pos-schema.ts`; typecheck; commit.
2. **Drizzle POS tables** — `restaurant`, `menuCategory`, `menuItem`, `saleOrder`, `saleOrderItem` in `schemas/pos-schema.ts` (+ export); typecheck; commit.
3. **Types, contracts, mappers** — `types/pos-schema.ts`, `types/pos.ts`, `schemas/pos.ts`, `mappers/pos.ts`; AssertSame; typecheck; commit.
4. **Migration + seed + apply** — `003_billing.sql` (all tables incl. `restaurantMember`; seed owner row in `restaurantMember` + seed a WAITER member for testing); psql apply; verify; commit.
5. **Permission-aware tenancy guard** — `api/src/lib/tenancy.ts` (`requireRestaurant(permission)` via `ROLE_PERMISSIONS`; ADMIN bypass); `GET /billing/bootstrap`; curl E2E: OWNER 200 / WAITER 200 / no-member 403 / settle attempt as WAITER 403; commit.
6. **Order lifecycle endpoints** — start, add/upsert item, qty, remove, get with items; subtotal recomputed server-side; curl E2E with paise math; commit.
7. **Settle + recent** — settle (`orders:settle`), `GET /billing/orders/recent`; curl E2E; commit.
8. **API deploy + suite** — wrangler deploy; full curl flow (OWNER full pass + WAITER permission boundary + non-member 403); commit any fixes.
9. **Web: billing screen (menu + cart + table input)** — `pos/page.tsx`, menu-panel, cart-panel, `useRestaurantRole()` hook, billing-client; role-conditional "Settle" button; dev-QA at 375px/1280px; commit.
10. **Web: ticket payload + 58mm templates** — `lib/ticket.ts`, kot-template + bill-template (header: name + address; 58mm/32-col); auto-print KOT on start; print bill on settle; print-window capture; commit.
11. **Web: ESC/POS + Web Bluetooth** — `lib/escpos.ts`, `lib/bluetooth-printer.ts` (pair, GATT, chunked write, remember, diagnostics); printer status in header; commit.
12. **Web: recent orders + reprint** — recent-orders.tsx, reprint KOT/bill; QA; commit.
13. **Responsive polish + access gates** — non-member → "No access" card; WAITER sees no Settle; pixel-check 375×667 + 1280×800; commit.
14. **Deploy web + live E2E + push** — `pnpm run deploy`; full flow at both viewports (OWNER + WAITER roles); BLE print if device available; regression; commit + push.

---

## Tests / Validation

- Per task: `npx tsc --noEmit` in package / api / web (SSOT assertions included).
- API: curl E2E — bootstrap → start → add x2 → qty → remove → subtotal in paise → settle → recent shows PAID; 403/404 isolation with a second (non-owner) user.
- Web: browser E2E at 375×667 + 1280×800 with saved session cookie (`/root/dine-session-cookie.json`); print templates verified by opening the print window and capturing it; ESC/POS bytes verified by decoding the first connect diagnostics payload + a mock BLE device.
- BLE printing: on-device test (Android phone + the actual printer) — best effort; GATT UUID discovery logged on first pair so any vendor profile gets captured into `lib/bluetooth-printer.ts` constants.
- Deploy order: API → verify → web → verify → commit+push.

## Risks / Tradeoffs / Open Questions

- **Web Bluetooth / BLE: CONFIRMED WORKING by the owner** — the QuickBill Go 58mm printer was already driven via Web Bluetooth from another project; standard 58mm GATT profile (service `FF00`/`FFE0` + write char) expected, diagnostics still logged on first connect to capture exact UUIDs.
- **Battery/angle quirks:** BLE writes need chunking (MTU ~20 bytes default, negotiate up); write-without-response preferred.
- **Menu read-only in v1** — seeded items only; item edits require SQL. If you want menu editing from day one, that's a small CRUD sprint on top (MenuMgr page + 4 endpoints) — say the word.
- **No void/refund** — settled orders are final in v1; void flow is v2.
- **Open questions:** Does the bill need the restaurant's phone number/logo line under the address? (Default: name + address only.)