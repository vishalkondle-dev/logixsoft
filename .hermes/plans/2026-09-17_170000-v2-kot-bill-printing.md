# v2 — KOT + Bill Printing Implementation Plan

> **For Hermes:** Implement task-by-task; commit + push after every verified task (repo convention). Deploy API via `npx wrangler deploy` in `apps/logix-dine/api`; deploy web via `pnpm run deploy` in `apps/logix-dine/web` (OpenNext — NEVER plain build+wrangler). Verify live with curl + browser before each commit.

---

## Goal

Auto-print a **KOT (Kitchen Order Ticket)** when an order starts, and a **Bill** when it's settled. Both tickets print to the existing **58mm BLE thermal printer (Hellet QuickBill Go)** directly from the browser via **Web Bluetooth** — confirmed working on this exact printer from a prior project. Fallback to `window.print()` when Bluetooth is unavailable.

---

## Current State (v1 baseline)

- `saleOrder.kotPrintedAt` column exists in the schema (nullable) — never set yet
- `POST /billing/orders` starts an order, returns `OrderWithItems`
- `POST /billing/orders/:id/settle` marks PAID, returns `OrderWithItems`
- `GET /billing/orders/:id` fetches any order with items
- `restaurant` (name + address) available via `useRestaurant()` context
- `apps/logix-dine/web/components/print/` directory already created (empty)
- POS page (`/pos`) handles start + settle in `handleStartOrder` / `handleSettle`
- Orders page (`/orders`) lists all orders, has a detail modal

---

## Ticket Content

### KOT (Kitchen Order Ticket)
```
================================
     [RESTAURANT NAME]
    [address, trimmed to fit]
================================
    KOT — KITCHEN ORDER TICKET
================================
Order #: 6          Table: 4
Time: 05:33 PM      Date: 17/09
--------------------------------
Qty  Item
--------------------------------
  2  Paneer Tikka
  1  Masala Chai
================================
```

### Bill
```
================================
     [RESTAURANT NAME]
    [address, trimmed to fit]
================================
         TAX INVOICE
================================
Order #: 6          Table: 4
Time: 05:33 PM      Date: 17/09
--------------------------------
Item             Qty      Amt
--------------------------------
Paneer Tikka      2     ₹440
Masala Chai       1      ₹40
--------------------------------
            TOTAL:      ₹480
================================
Payment: Cash
================================
  Thank you! Please visit again
================================
```

Width: **32 chars** per line (58mm standard). No GST in v1.

---

## Architecture

### Print dispatch chain

```
User action (start order / settle)
        │
        ▼
lib/ticket.ts           ← build canonical TicketPayload
        │
        ├─── Bluetooth paired? ──→ YES → lib/escpos.ts → ESC/POS bytes
        │                                 → lib/bluetooth-printer.ts → BLE write
        │
        └─── No Bluetooth / not paired → lib/print.ts → window.print()
                                          of print/kot-template.tsx or bill-template.tsx
```

### Canonical ticket payload (`lib/ticket.ts`)

```ts
interface TicketPayload {
  restaurantName: string;
  restaurantAddress: string;
  orderNo: number;
  tableNo: string | null;
  date: string;        // "17/09/2026"
  time: string;        // "05:33 PM"
  items: { name: string; qty: number; pricePaise: number }[];
  subtotalPaise: number;
  method: string | null;
  type: 'KOT' | 'BILL';
}
```

Both the ESC/POS encoder and the HTML fallback consume this same payload — single source of truth for ticket content.

---

## New Files

| Path | Purpose |
|---|---|
| `web/lib/ticket.ts` | `buildKotPayload(order, restaurant)` + `buildBillPayload(order, restaurant)` |
| `web/lib/escpos.ts` | ESC/POS byte encoder: init, align, bold, 32-col line, cut |
| `web/lib/bluetooth-printer.ts` | Web BLE: pair (requestDevice), GATT connect, chunked write-without-response, remember device ID, diagnostics log of GATT UUIDs on first connect |
| `web/lib/print.ts` | `printTicket(payload, type)` dispatcher — BLE first, HTML fallback |
| `web/components/print/ticket-html.tsx` | 58mm CSS receipt layout used for both KOT + bill HTML fallback |
| `web/components/print/printer-button.tsx` | Reusable "Pair Printer" / "Printer Connected ●" indicator |

---

## Modified Files

| Path | What changes |
|---|---|
| `web/app/(owner)/pos/page.tsx` | `handleStartOrder`: call `printTicket(kotPayload, 'KOT')` after API returns; `handleSettle`: call `printTicket(billPayload, 'BILL')` after settle succeeds |
| `web/app/(owner)/orders/page.tsx` | Order detail modal: add "Reprint KOT" + "Reprint Bill" buttons (fetch order → build payload → printTicket) |
| `web/app/(owner)/settings/page.tsx` | New "Printing" tab: `PrinterButton` (pair/forget printer), test print button |
| `apps/logix-dine/api/src/routes/billing.ts` | New endpoint `PATCH /billing/orders/:id/mark-kot-printed` (sets `kotPrintedAt = now()`); also `POST /billing/orders` — set `kotPrintedAt` server-side when client signals KOT was printed (alt: client calls the patch after successful BLE write) |

---

## API Change

### `PATCH /billing/orders/:id/mark-kot-printed`

Permission: `order:create`  
Sets `kotPrintedAt = now()` if currently null. Returns the updated order.

Why a separate endpoint: the order starts before the print completes (async BLE write), and a failed print shouldn't fail the order creation. The client marks KOT printed only after a confirmed BLE write or browser print dialog opens.

---

## Web Bluetooth — Implementation Notes

### GATT Profile (standard for 58mm BLE printers)
Most 58mm thermal printers (incl. QuickBill style) expose:
- **Service UUID:** `0x0000ff00-0000-1000-8000-00805f9b34fb` (FF00)
- **Write Characteristic:** `0x0000ff02-0000-1000-8000-00805f9b34fb` (FF02)
- Some use Nordic UART: service `6E400001-...`, write char `6E400002-...`

**Diagnostics first**: on initial pair, log every discovered service + characteristic UUID to `localStorage['bt-printer-uuids']` so the real profile is captured if the printer doesn't match FF00.

### Pairing + persistence
```ts
// Pair (once, user gesture required)
const device = await navigator.bluetooth.requestDevice({
  acceptAllDevices: true,
  optionalServices: [FF00_SERVICE, NORDIC_UART_SERVICE],
});
localStorage['bt-printer-id'] = device.id;   // remember across sessions

// Re-connect
const devices = await navigator.bluetooth.getDevices();
const saved = devices.find(d => d.id === localStorage['bt-printer-id']);
```

### Write chunking (MTU)
Default MTU is 20 bytes. Negotiate up to 512 if possible; default to 20-byte chunks with `writeValueWithoutResponse` for speed.

---

## ESC/POS — Key Commands (58mm / 32 cols)

```ts
ESC_INIT      = [0x1B, 0x40]           // Initialize printer
ALIGN_CENTER  = [0x1B, 0x61, 0x01]    // Center align
ALIGN_LEFT    = [0x1B, 0x61, 0x00]    // Left align
BOLD_ON       = [0x1B, 0x45, 0x01]    // Bold on
BOLD_OFF      = [0x1B, 0x45, 0x00]    // Bold off
FEED_2        = [0x0A, 0x0A]           // Feed 2 lines
CUT           = [0x1D, 0x56, 0x41, 0x03]  // Partial cut + feed
```

Line formatting for item rows (32 cols total):
```
"Paneer Tikka        2    ₹440"
// name: 18 chars, qty: 3, price: 7 (right-aligned, padStart)
```

---

## Task List (bite-sized)

**1. Canonical ticket payload builder**
File: Create `web/lib/ticket.ts`
- `buildKotPayload(order: OrderWithItems, restaurant: JsonRestaurantRow): TicketPayload`
- `buildBillPayload(order: OrderWithItems, restaurant: JsonRestaurantRow): TicketPayload`
- Format date/time from `order.createdAt` (IST-aware)
- Typecheck; commit.

**2. ESC/POS encoder**
File: Create `web/lib/escpos.ts`
- `encodeTicket(payload: TicketPayload): Uint8Array`
- Implements: init → align-center header (name, address, divider, type label) → align-left order meta (no./table/date/time) → divider → item lines (name + qty for KOT; name + qty + price for bill) → divider → total (bill only) → method (bill only) → footer → feed → cut
- All lines padded / truncated to 32 chars
- Typecheck; commit.

**3. Web Bluetooth printer layer**
File: Create `web/lib/bluetooth-printer.ts`
- `isPaired(): boolean` — checks localStorage for saved device ID
- `pair(): Promise<string>` — requestDevice, GATT connect, log discovered UUIDs, save device ID, return device name
- `forget(): void` — remove from localStorage
- `print(bytes: Uint8Array): Promise<void>` — connect → discover service+char → write chunks (20 bytes default) → disconnect
- `getStatus(): 'paired' | 'unpaired' | 'unsupported'`
- Typecheck (mock `navigator.bluetooth` type if needed); commit.

**4. Print dispatcher**
File: Create `web/lib/print.ts`
- `printTicket(payload: TicketPayload): Promise<'ble' | 'browser' | 'error'>`
  - If BLE paired + `navigator.bluetooth` supported → encode → BLE write
  - Else → `printHtml(payload)` (opens 216px popup, writes 58mm HTML, triggers `window.print()`, closes)
- `printHtml(payload: TicketPayload): void` — constructs ticket HTML inline (no React needed for popup)
- Typecheck; commit.

**5. 58mm HTML fallback template**
File: Create `web/components/print/ticket-html.tsx`
- Component rendering the full ticket layout at 58mm (max-width 216px, font-family monospace, font-size 12px, all dividers as `─────`)
- `<PrintTicketHtml payload={payload} />` — rendered to string via `renderToStaticMarkup` for popup
- Covers both KOT and BILL (type in payload switches label + shows/hides total/method)
- Commit.

**6. API — mark-kot-printed endpoint**
File: Modify `apps/logix-dine/api/src/routes/billing.ts`
- `PATCH /billing/orders/:id/mark-kot-printed` — permission `order:create`, sets `kotPrintedAt = now()`, returns updated order
- Add `markKotPrinted` to `lib/api-client.ts`
- Typecheck; deploy API; curl verify; commit.

**7. POS page — Send + Settle & Send buttons**
File: Modify `web/app/(owner)/pos/page.tsx`
- Replace the "Settle" button with a **split button**:
  - Primary: **"Send"** (full width, left portion) — prints KOT, marks `kotPrintedAt`, keeps order OPEN (no payment). A "sent" order stays in the cart so more items can be added.
  - Right portion: **chevron `›`** (`IconChevronRight`) — opens a `Menu` with one item: **"Settle & Send"** — settles the order (PAID) and prints the bill.
- After "Send": toast "KOT sent — collect payment later from Orders"; order stays active in cart.
- After "Settle & Send": build bill payload → `printTicket(billPayload)` → order clears from cart.
- In `handleStartOrder` / auto-start on first add: after API returns, call `buildKotPayload` → `printTicket` → `markKotPrinted`; show toast.
- Reprint from Orders page handles both KOT and bill independently.

**8. Orders page — reprint buttons**
File: Modify `web/app/(owner)/orders/page.tsx`
- In the order detail modal: add "🖨 Reprint KOT" + "🖨 Reprint Bill" buttons
- Reprint: fetch order (already loaded in `selected`), build payload, `printTicket(payload)` — no API call needed unless marking re-print (skip in v2)
- Show `kotPrintedAt` timestamp if it was printed ("KOT printed at 05:33 PM")
- Commit.

**9. Settings — Printer pairing UI**
File: Modify `web/app/(owner)/settings/page.tsx`
- New "Printing" tab alongside "Restaurant" and "Outlets"
- Content: `<PrinterButton />` component (shows "Pair Printer via Bluetooth" or "Printer: QuickBill Go ● Connected" + "Forget" link + "Test Print" button)
- Test print: sends a short ESC/POS test page ("Logix Dine — Printer OK\n\n\n\n[cut]")
- Typecheck; deploy web; commit.

**10. Deploy + E2E**
- `npx wrangler deploy` (api) → verify `PATCH /billing/orders/:id/mark-kot-printed` with curl
- `pnpm run deploy` (web)
- E2E: open settings → pair printer → test print (physical paper comes out) → POS → add item → start order → KOT prints → settle → bill prints → go to orders → reprint KOT → reprint bill
- Fallback path (no BT): browser print dialog opens with 58mm HTML
- Screenshots at 375×667 + 1280×800; commit + push

---

## Tests / Validation

- `npx tsc --noEmit` in `web` after each file change
- API: `curl -X PATCH /billing/orders/:id/mark-kot-printed -H "X-Restaurant-Id: ..." -H "Cookie: ..."` → 200 with `kotPrintedAt` populated
- ESC/POS bytes: decode first 10 bytes manually — should start with `[27, 64]` (ESC INIT)
- BLE: on first pair, `localStorage['bt-printer-uuids']` logs the real GATT UUIDs (capture for `bluetooth-printer.ts` constants)
- Physical print: KOT and bill on 58mm paper — check alignment, line truncation, totals
- Browser fallback: disable BT → print dialog opens with correct 58mm layout

---

## Risks / Notes

- **Web Bluetooth requires HTTPS + user gesture** — both satisfied (dine.logixsoft.in is HTTPS; pair button is user-initiated). Works on Android Chrome, iOS Safari 26+, desktop Chrome.
- **BLE confirmed working** on this exact QuickBill Go printer from a prior project. GATT UUIDs logged on first connect in case the profile is non-standard.
- **MTU**: default 20 bytes. For a typical 10-item KOT (~300 bytes), that's ~15 writes — fast enough. No negotiation needed in v1.
- **`renderToStaticMarkup` in browser**: works in Next.js App Router client components. If it causes issues, build the HTML string manually (no JSX) in `printHtml()`.
- **`kotPrintedAt` is informational only** — a failed print doesn't block the order. The operator can always reprint from Orders.
