# Logix Dine — Simple Billing with Full Management (v1)

> **For Hermes:** Implement task-by-task; commit + push after every task is tested and deployed (repo convention). Deploy web via `pnpm run deploy` in `apps/logix-dine/web` (OpenNext — NEVER `pnpm build` + wrangler). Deploy API via `npx wrangler deploy` in `apps/logix-dine/api`. Verify live with curl + browser before each commit.

---

## Goal

A self-serve Restaurant Billing SaaS:
- **Owners** register themselves, create their restaurant & outlets, manage menu categories + items, and take orders that print a KOT + bill on a 58mm BLE thermal printer.
- **Admin** (platform) can see and manage all restaurants and users.
- **Customer** = registered user with no restaurant access (default after OTP login).

---

## Roles & Permissions

### Platform roles (stored in `user.role`)

| Role | Who |
|---|---|
| `ADMIN` | Platform operator — full access to all restaurants |
| `OWNER` | Restaurant owner — full access to their restaurant |
| `CUSTOMER` | Default after OTP login — no restaurant access |

### Restaurant roles (stored in `restaurantMember.role`) — v1 schema, v2 enforcement

| Role | Planned access |
|---|---|
| `OWNER` | All permissions |
| `MANAGER` | All except member management + billing settings |
| `WAITER` | Orders (create/view), KOT print |
| `KITCHEN` | View KOTs only |
| `CUSTOM_ROLE` | Configurable |

### Permission map — `packages/logix-dine/types/roles.ts`

The **API guards check permissions, not roles.** Adding a new role in v2 only requires updating this map — zero route changes.

```ts
export const PERMISSIONS = [
  'restaurant:read', 'restaurant:write',
  'outlet:read', 'outlet:write',
  'menu:read', 'menu:write',
  'order:create', 'order:read', 'order:settle', 'order:void',
  'member:write',
] as const;
export type Permission = typeof PERMISSIONS[number];

export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  OWNER:   ['restaurant:read','restaurant:write','outlet:read','outlet:write',
             'menu:read','menu:write','order:create','order:read','order:settle','order:void','member:write'],
  MANAGER: ['restaurant:read','outlet:read','outlet:write',
             'menu:read','menu:write','order:create','order:read','order:settle','order:void'],
  WAITER:  ['menu:read','order:create','order:read'],
  KITCHEN: ['order:read'],
};
```

### `restaurantMember` table (added in v1 schema, enforced in v2 for staff)

```
restaurantMember: id, restaurantId, userId, role (text), createdAt
  unique(restaurantId, userId)
```

Owner gets a `restaurantMember` row automatically when they create a restaurant — so **all access checks go through one table** even in v1. `restaurant.ownerUserId` stays as the authority for who created it.

### API guard — `src/lib/tenancy.ts`

```ts
requirePermission('order:create')  // ← used on routes instead of requireOwner()
```

- Reads `X-Restaurant-Id` + session → looks up `restaurantMember` → resolves role → checks `ROLE_PERMISSIONS[role].includes(permission)`.
- Platform `ADMIN` bypasses the member check entirely.
- 403 if permission missing, 404 if restaurant not found.
- **Adding Manager/Waiter in v2 = update `ROLE_PERMISSIONS` + invite staff. Zero route changes.**

---

## Architecture

- **Stack:** Hono + zod-openapi (API), Drizzle ORM + Postgres via Hyperdrive (DB), Mantine v9 (UI), Next.js 16 / OpenNext on Cloudflare Workers (web), OpenWA for WhatsApp OTP.
- **SSOT pattern** (established): drizzle tables in `packages/logix-dine/schemas` → `AssertSame` zod contracts → shared `mappers` → Hono API routes → Mantine web.
- **Tenancy:** shared DB, `restaurantId` on all tenant tables, `restaurant.ownerUserId` as authority. Every tenant-scoped API call requires `X-Restaurant-Id` header + ownership/role check via `requireOwner()` middleware.
- **Money:** integer **paise** (INR) everywhere — no floats.
- **Printing:** Web Bluetooth BLE → ESC/POS bytes direct to 58mm printer (confirmed working). Fallback: `window.print()` of 58mm HTML layout.

---

## Data Model (SSOT)

### `packages/logix-dine/schemas/pos-schema.ts` (drizzle)

| Table | Key Columns |
|---|---|
| `restaurant` | `id`, `name`, `address`, `phone` (nullable), `currency` (default `INR`), `status` (`ACTIVE \| TRIAL`, default `TRIAL`), `ownerUserId` → user, `createdAt`, `updatedAt` |
| `restaurantOutlet` | `id`, `restaurantId` → restaurant, `name`, `address` (nullable), `phone` (nullable), `isDefault` (bool default false), `createdAt`, `updatedAt` |
| `menuCategory` | `id`, `restaurantId`, `name`, `description` (nullable), `sortOrder` (int default 0), `active` (bool default true), `createdAt`, `updatedAt` |
| `menuItem` | `id`, `restaurantId`, `categoryId` → menuCategory, `name`, `description` (nullable), `pricePaise` (int notNull), `available` (bool default true), `sortOrder` (int default 0), `createdAt`, `updatedAt` |
| `saleOrder` | `id`, `restaurantId`, `outletId` → restaurantOutlet, `orderNo` (int — auto-increment per restaurant), `tableNo` (text nullable), `status` (`OPEN \| PAID \| VOID`), `subtotalPaise` (int default 0), `method` (text nullable — Cash/UPI/QR), `note` (text nullable), `createdAt`, `settledAt` (nullable), `settledByUserId` (nullable), `kotPrintedAt` (nullable) |
| `saleOrderItem` | `id`, `orderId` → saleOrder (cascade delete), `itemId` → menuItem, `nameSnapshot`, `pricePaiseSnapshot` (int), `qty` (int > 0), `createdAt` |

**Indexes:** `(restaurantId)` on all tenant tables; `(restaurantId, status)` on `saleOrder`; `(orderId)` on `saleOrderItem`.

**`orderNo` generation:** `SELECT COALESCE(MAX(orderNo), 0) + 1 FROM saleOrder WHERE restaurantId = $1` in a transaction — simple, no sequence required in v1.

### Shared types / contracts / mappers

**`packages/logix-dine/types/roles.ts`**
```ts
export const PLATFORM_ROLES = ['ADMIN', 'OWNER', 'CUSTOMER'] as const;
export type PlatformRole = typeof PLATFORM_ROLES[number];
```

**`packages/logix-dine/types/pos-schema.ts`**
`RestaurantRow`, `RestaurantOutletRow`, `MenuCategoryRow`, `MenuItemRow`, `SaleOrderRow`, `SaleOrderItemRow` + `Json*` variants (dates → ISO strings) — same `InferSelectModel`/`InferInsertModel` pattern as auth.

**`packages/logix-dine/schemas/pos.ts`** (zod, SSOT-asserted via `Expect<AssertSame<...>>`)
- `RestaurantSchema`, `RestaurantOutletSchema`, `MenuCategorySchema`, `MenuItemSchema`, `SaleOrderSchema`, `SaleOrderItemSchema`
- **Requests:** `CreateRestaurantSchema {name, address, phone?}`, `UpdateRestaurantSchema`, `CreateOutletSchema {name, address?, phone?}`, `CreateCategorySchema {name, description?, sortOrder?}`, `UpdateCategorySchema`, `CreateItemSchema {categoryId, name, description?, pricePaise, sortOrder?}`, `UpdateItemSchema`, `StartOrderSchema {outletId, tableNo?}`, `AddItemSchema {itemId, qty?}`, `UpdateQtySchema {qty}`, `SettleSchema {method?}`
- **Responses:** `BootstrapSchema {restaurant, outlets, categories, items}`, `OrderWithItemsSchema {order, items}`, `OrderListSchema`

**`packages/logix-dine/mappers/pos.ts`**
`toRestaurant`, `toOutlet`, `toCategory`, `toItem`, `toOrder`, `toOrderItem`, `toOrderWithItems`.

---

## API Routes

All API files in `apps/logix-dine/api/src/routes/`. Mounted in `src/index.ts` under both `/xxx` and `/api/xxx`.

### `src/lib/tenancy.ts`
- `requireAuth()` — session must exist (401 else); sets `c.set('sessionUser', user)`.
- `requirePermission(p: Permission)` — `requireAuth` + resolves `restaurantMember` by `X-Restaurant-Id` + checks `ROLE_PERMISSIONS[member.role].includes(p)`; ADMIN bypasses; sets `c.set('tenant', { restaurantId, role, member })`. 403 if missing, 404 if unknown restaurant.
- `requireAdmin()` — `requireAuth` + checks `user.role === 'ADMIN'`. 403 else.

### `src/routes/onboarding.ts` — `/onboarding`

| Method | Path | Purpose | Guard |
|---|---|---|---|
| `POST` | `/onboarding/restaurant` | Create restaurant → insert default outlet → insert `restaurantMember` (OWNER) → set `user.role = 'OWNER'` (transaction). | `requireAuth` (409 if already OWNER) |

### `src/routes/restaurants.ts` — `/restaurants`

| Method | Path | Purpose | Guard |
|---|---|---|---|
| `GET` | `/restaurants/me` | Owner's restaurant details | `requirePermission('restaurant:read')` |
| `PUT` | `/restaurants/:id` | Update restaurant settings | `requirePermission('restaurant:write')` |

### `src/routes/outlets.ts` — `/restaurants/:restaurantId/outlets`

| Method | Path | Purpose | Guard |
|---|---|---|---|
| `GET` | `/restaurants/:id/outlets` | List outlets | `requirePermission('outlet:read')` |
| `POST` | `/restaurants/:id/outlets` | Create outlet | `requirePermission('outlet:write')` |
| `PUT` | `/restaurants/:id/outlets/:outletId` | Update outlet | `requirePermission('outlet:write')` |
| `DELETE` | `/restaurants/:id/outlets/:outletId` | Delete outlet (403 if isDefault) | `requirePermission('outlet:write')` |
| `PATCH` | `/restaurants/:id/outlets/:outletId/set-default` | Set as default outlet | `requirePermission('outlet:write')` |

### `src/routes/menu.ts` — `/menu`

| Method | Path | Purpose | Guard |
|---|---|---|---|
| `GET` | `/menu/categories` | List categories | `requirePermission('menu:read')` |
| `POST` | `/menu/categories` | Create category | `requirePermission('menu:write')` |
| `PUT` | `/menu/categories/:id` | Update category | `requirePermission('menu:write')` |
| `DELETE` | `/menu/categories/:id` | Delete category | `requirePermission('menu:write')` |
| `PATCH` | `/menu/categories/reorder` | Bulk sortOrder update | `requirePermission('menu:write')` |
| `GET` | `/menu/items` | List items (`?categoryId=`) | `requirePermission('menu:read')` |
| `POST` | `/menu/items` | Create item | `requirePermission('menu:write')` |
| `PUT` | `/menu/items/:id` | Update item | `requirePermission('menu:write')` |
| `DELETE` | `/menu/items/:id` | Delete item | `requirePermission('menu:write')` |
| `PATCH` | `/menu/items/:id/toggle` | Toggle available | `requirePermission('menu:write')` |
| `PATCH` | `/menu/items/reorder` | Bulk sortOrder update | `requirePermission('menu:write')` |

### `src/routes/billing.ts` — `/billing`

| Method | Path | Purpose | Guard |
|---|---|---|---|
| `GET` | `/billing/bootstrap` | Restaurant + outlets + active categories + available items | `requirePermission('menu:read')` |
| `POST` | `/billing/orders` | Start OPEN order | `requirePermission('order:create')` |
| `GET` | `/billing/orders` | List orders (`?status=&outletId=&date=&limit=50`) | `requirePermission('order:read')` |
| `GET` | `/billing/orders/:id` | Order + items | `requirePermission('order:read')` |
| `POST` | `/billing/orders/:id/items` | Add item (upsert qty) | `requirePermission('order:create')` |
| `PATCH` | `/billing/orders/:id/items/:itemId` | Update qty, recompute | `requirePermission('order:create')` |
| `DELETE` | `/billing/orders/:id/items/:itemId` | Remove item, recompute | `requirePermission('order:create')` |
| `POST` | `/billing/orders/:id/settle` | Mark PAID + method + settledAt/by | `requirePermission('order:settle')` |
| `POST` | `/billing/orders/:id/void` | Mark VOID (OPEN only) | `requirePermission('order:void')` |

Totals always recomputed server-side (`SUM(pricePaiseSnapshot * qty)`).

### `src/routes/admin.ts` — `/admin`

| Method | Path | Purpose | Guard |
|---|---|---|---|
| `GET` | `/admin/restaurants` | List all restaurants (paginated) | `requireAdmin()` |
| `GET` | `/admin/users` | List all users | `requireAdmin()` |
| `PATCH` | `/admin/users/:id/role` | Change user role | `requireAdmin()` |

---

## Web Routes

### App Shell
- Header: logo + restaurant name + outlet switcher (if multiple outlets) + user avatar menu (sign out)
- Bottom nav (mobile): POS / Orders / Menu / Settings
- Sidebar (desktop): same items

### Pages

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing — Sign In CTA |
| `/onboarding` | CUSTOMER (no restaurant) | Create restaurant wizard → becomes OWNER |
| `/pos` | OWNER | Billing screen (menu + cart + print KOT/bill) |
| `/orders` | OWNER | Order history (filter by date/outlet/status) + reprint |
| `/menu` | OWNER | Menu management — Categories + Items tabs |
| `/settings` | OWNER | Restaurant Settings + Outlet Settings tabs |
| `/admin` | ADMIN | Platform dashboard |

**Route guards:**
- Not logged in → redirect to `/` (login)
- Logged in + `CUSTOMER` + no restaurant → redirect to `/onboarding`
- Logged in + `OWNER` → normal access
- `ADMIN` → access to `/admin` + own (if any) restaurant routes

---

## Onboarding Flow

1. User logs in via WhatsApp OTP → `user.role = 'CUSTOMER'` initially.
2. Auth context checks: is CUSTOMER with no restaurant? → redirect to `/onboarding`.
3. Onboarding wizard (single screen): Restaurant Name + Address + Phone + First Outlet Name (default: "Main").
4. POST `/onboarding/restaurant` → transaction: insert `restaurant` → insert default `restaurantOutlet` (isDefault=true) → `UPDATE user SET role='OWNER'` → return restaurant.
5. Redirect to `/pos` with `dine.restaurantId` cookie set.

---

## Billing / POS Screen (`/pos`)

**Layout:**
- Mobile: category pills (scrollable) → item grid → sticky cart bar (qty badge + total) → cart bottom sheet → print actions
- Desktop: menu panel (left) + persistent cart panel (right)

**Flow:**
1. Select outlet (if multiple) — remembered in cookie.
2. Optional table number input.
3. Add items → cart updates live.
4. **New Order** button → `POST /billing/orders` → auto-triggers **Print KOT** (BLE or browser-print fallback).
5. Continue adding/modifying items.
6. **Settle** → choose method (Cash / UPI / QR) → `POST /billing/orders/:id/settle` → auto-triggers **Print Bill**.
7. Cart resets, ready for next order.

**Print ticket content:**
- **KOT:** Restaurant name + address, "KOT — KITCHEN ORDER TICKET", Order #, Time, Table (if any), item list (`Name xQty`).
- **Bill:** Restaurant name + address, "TAX INVOICE / BILL", Order #, Time, Table (if any), item lines (name, qty, price), subtotal, payment method, "Thank you — visit again!".

---

## Web Components

```
web/
  app/
    page.tsx                        ← Landing
    (public)/onboarding/page.tsx    ← Create restaurant wizard
    (owner)/
      layout.tsx                    ← Owner guard + outlet context
      pos/page.tsx                  ← Billing screen
      orders/page.tsx               ← Order history
      menu/page.tsx                 ← Menu management
      settings/page.tsx             ← Restaurant + outlet settings
    (admin)/
      admin/page.tsx                ← Platform admin
  components/
    layout/app-shell.tsx            ← Updated: outlet switcher in header
    pos/
      menu-panel.tsx                ← Category pills + item grid
      cart-panel.tsx                ← Cart: line items, qty steppers, remove
      cart-drawer.tsx               ← Mobile bottom sheet cart
      table-input.tsx               ← Optional table number
      settle-modal.tsx              ← Method picker + confirm
      recent-orders.tsx             ← Today's orders sidebar
    print/
      kot-template.tsx              ← KOT HTML (58mm)
      bill-template.tsx             ← Bill HTML (58mm)
    menu/
      category-list.tsx             ← Drag-to-reorder categories
      item-list.tsx                 ← Items table per category
      category-form.tsx             ← Create/edit category modal
      item-form.tsx                 ← Create/edit item modal
    settings/
      restaurant-form.tsx           ← Name, address, phone
      outlet-list.tsx               ← List outlets + default badge
      outlet-form.tsx               ← Create/edit outlet modal
    onboarding/
      restaurant-wizard.tsx
  lib/
    billing-client.ts               ← Typed fetch helpers for billing routes
    menu-client.ts                  ← Typed fetch helpers for menu routes
    settings-client.ts              ← Typed fetch helpers for settings routes
    ticket.ts                       ← Canonical ticket payload builder
    escpos.ts                       ← ESC/POS encoder (58mm, 32 cols)
    bluetooth-printer.ts            ← Web BLE: pair, GATT, chunked write, remember
    print.ts                        ← Dispatcher: BLE → browser-print fallback
    restaurant-context.tsx          ← Active restaurant + outlet in context/cookie
```

---

## Migration — `apps/logix-dine/api/migrations/004_pos_billing.sql`

```sql
-- restaurant
CREATE TABLE IF NOT EXISTS "restaurant" (...);

-- restaurantOutlet
CREATE TABLE IF NOT EXISTS "restaurantOutlet" (...);

-- menuCategory
CREATE TABLE IF NOT EXISTS "menuCategory" (...);

-- menuItem
CREATE TABLE IF NOT EXISTS "menuItem" (...);

-- saleOrder
CREATE TABLE IF NOT EXISTS "saleOrder" (...);

-- saleOrderItem
CREATE TABLE IF NOT EXISTS "saleOrderItem" (...);

-- indexes
CREATE INDEX IF NOT EXISTS "restaurant_ownerUserId_idx" ON "restaurant"("ownerUserId");
CREATE INDEX IF NOT EXISTS "restaurantOutlet_restaurantId_idx" ON "restaurantOutlet"("restaurantId");
CREATE INDEX IF NOT EXISTS "menuCategory_restaurantId_idx" ON "menuCategory"("restaurantId");
CREATE INDEX IF NOT EXISTS "menuItem_restaurantId_idx" ON "menuItem"("restaurantId");
CREATE INDEX IF NOT EXISTS "menuItem_categoryId_idx" ON "menuItem"("categoryId");
CREATE INDEX IF NOT EXISTS "saleOrder_restaurantId_status_idx" ON "saleOrder"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "saleOrderItem_orderId_idx" ON "saleOrderItem"("orderId");
```

Apply: `sudo -u postgres psql -p 5432 -d payment -f apps/logix-dine/api/migrations/004_pos_billing.sql`; verify with `\d saleOrder`.

---

## Task List (bite-sized)

**Shared package (no deploy needed)**

1. **Role + permission types** — `packages/logix-dine/types/roles.ts` (`PLATFORM_ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`, `Permission`); add `restaurantMember` to `schemas/pos-schema.ts`; update `user.role` default to `CUSTOMER`; typecheck; commit.
2. **POS drizzle schema** — `schemas/pos-schema.ts` (all 6 tables + exports); typecheck package; commit.
3. **Types + contracts + mappers** — `types/pos-schema.ts`, `types/pos.ts`, `schemas/pos.ts` (with AssertSame assertions), `mappers/pos.ts`; typecheck; commit.

**Database**

4. **Migration + apply** — `004_pos_billing.sql`; `psql apply`; verify all tables + indexes; commit.

**API**

5. **Permission-aware tenancy + onboarding** — `src/lib/tenancy.ts` (`requireAuth`, `requirePermission(p)`, `requireAdmin`); `src/routes/onboarding.ts` (transaction: restaurant + outlet + `restaurantMember` OWNER row + `user.role='OWNER'`); typecheck; curl E2E (CUSTOMER creates → becomes OWNER → member row exists → second call 409); commit.
6. **Restaurant + outlet routes** — `src/routes/restaurants.ts` (GET me, PUT update) + `src/routes/outlets.ts` (CRUD + set-default); typecheck; curl E2E; commit.
7. **Menu routes** — `src/routes/menu.ts` (category CRUD + reorder; item CRUD + toggle + reorder); typecheck; curl E2E (create category → add items → reorder → toggle available → delete); commit.
8. **Billing routes** — `src/routes/billing.ts` (bootstrap, start order, add/update/remove items, settle, void, list); server-side total recompute on every item change; typecheck; curl E2E (full order lifecycle + void path + 403 on cross-tenant); commit.
9. **Admin routes** — `src/routes/admin.ts` (list restaurants, list users, change role); mount all routes in `index.ts`; typecheck; commit.
10. **API deploy + full E2E** — `npx wrangler deploy`; curl suite: onboarding → restaurant settings → categories → items → bootstrap → order → settle → list + admin endpoints + OWNER cross-tenant 403; commit any fixes; push.

**Web**

11. **Foundation: context + app shell** — `lib/restaurant-context.tsx` (active restaurant + outlet, cookie `dine.restaurantId`); update `app-shell.tsx` (outlet switcher in header, bottom nav: POS / Orders / Menu / Settings); typecheck; commit.
12. **Onboarding flow** — `(public)/onboarding/page.tsx` + `restaurant-wizard.tsx`; POST /onboarding/restaurant → redirect to /pos; dev-QA (fresh user has no restaurant → lands on onboarding, fills form, lands on /pos); commit.
13. **Settings pages** — `/settings/page.tsx` (Restaurant + Outlet tabs); restaurant-form, outlet-list, outlet-form (create/edit/delete/set-default); dev-QA; commit.
14. **Menu management** — `/menu/page.tsx` (Categories + Items tabs); category-list (drag-to-reorder via Mantine DnD or simple up/down arrows), item-list, category-form modal, item-form modal; toggle available; dev-QA; commit.
15. **POS billing screen** — `/pos/page.tsx`; menu-panel (category pills + item grid), cart-panel (line items + qty + remove), cart-drawer (mobile), table-input, settle-modal; billing-client; `useRestaurantRole()` hook; dev-QA at 375×667 and 1280×800; commit.
16. **Ticket + 58mm print templates** — `lib/ticket.ts` (canonical payload from OrderWithItems), `print/kot-template.tsx`, `print/bill-template.tsx` (58mm layout: header → order # → items → total → method → footer); `lib/print.ts` (browser-print dispatcher); auto-print KOT on order start, auto-print bill on settle; print-window screenshot; commit.
17. **ESC/POS + Web Bluetooth** — `lib/escpos.ts` (init, align, bold, two-col line, feed, cut for 32-col 58mm), `lib/bluetooth-printer.ts` (requestDevice/GATT/chunked write-without-response/remember device/diagnostics); printer pairing UI (Settings page → "Pair Printer" button + status indicator in header); `lib/print.ts` updated to BLE-first → fallback; commit.
18. **Orders history** — `/orders/page.tsx` (filter by date/outlet/status); order card → expand → reprint KOT/bill; dev-QA; commit.
19. **Admin page** — `/admin/page.tsx` (restaurants table + users table + role picker); dev-QA (ADMIN only, OWNER → 403 redirect); commit.
20. **Responsive polish + guards** — pixel-check 375×667 + 1280×800 all pages; CUSTOMER → `/onboarding`; non-OWNER on /pos → redirect; ADMIN guard; commit.
21. **Web deploy + final E2E + push** — `pnpm run deploy`; live walkthrough: register → onboarding → settings → menu → POS → order → KOT print (BLE if device present, else browser) → settle → bill print → orders history → admin; regression (auth, /doc); commit + push.

---

## Tests / Validation

- **Per task:** `npx tsc --noEmit` in `packages/logix-dine`, `apps/logix-dine/api`, `apps/logix-dine/web` — all clean.
- **API E2E (curl):** full lifecycle per route group; cross-tenant 403 verified (OWNER A cannot touch OWNER B's data); CUSTOMER → 403 on owner routes; ADMIN → 200 on admin routes.
- **Web QA:** browser E2E at 375×667 (iPhone SE) + 1280×800; screenshots before/after deploy.
- **Print QA:** print-window screenshot (browser fallback); on-device BLE test when hardware is present.
- **Deploy order:** API → verify → web → verify → commit + push.

---

## Risks / Open Questions

- **`orderNo` per restaurant:** `MAX + 1` in a transaction is fine for v1 throughput; upgrade to a Postgres sequence per restaurant if concurrent settlement becomes an issue.
- **Outlet required on order:** every order must have an outlet; the default outlet is selected automatically if only one exists — owner is not prompted unless they have multiple.
- **BLE confirmed working** on this exact printer (QuickBill Go 58mm) from a previous project — no risk here.
- **Open questions before build:**
  1. Should the bill show the outlet name/address (not just restaurant)? (Default: restaurant address only.)
  2. Is there a serial/invoice number format required (e.g. `KDR/2026-27/001`)? (Default: plain `#orderNo`.)
  3. Should the admin page show order revenue stats, or just the user/restaurant list for v1?