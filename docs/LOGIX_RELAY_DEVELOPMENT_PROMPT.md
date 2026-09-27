# SYSTEM PROMPT: BUILD "LOGIX RELAY" — UNIFIED FOOD DELIVERY AGGREGATOR GATEWAY

You are an expert Principal Distributed Systems Engineer and Restaurant-Tech Architect.
Your task is to build **Logix Relay** (an omnichannel food delivery aggregator gateway, identical in function and capabilities to UrbanPiper Hub, Petpooja Relay, and Deliverect) inside the Logix Soft monorepo at `apps/relay` (or `packages/aggregator-gateway`).

---

## 1. MISSION & HIGH-LEVEL OVERVIEW

Logix Relay acts as a centralized, high-throughput, fault-tolerant middleware connecting:
1. **Consumer Marketplaces**: Swiggy (POS Partner API), Zomato (Partner API v2), Magicpin, and ONDC (Open Network for Digital Commerce via Beckn Protocol v1.2 BPP).
2. **Direct / D2C Channels**: Ownly, Toing, Dotpe, Thrive, and Logix Dine Customer Portal.
3. **3PL On-Demand Delivery Fleets**: Shadowfax, Dunzo for Business, Porter, Borzo, Rapido.
4. **Downstream Restaurant Systems**: Logix Dine (Cloudflare Workers API, Next.js Web, Capacitor Mobile, and Electron Desktop PC POS with silent thermal printing) and third-party POS systems via OpenAPI.

---

## 2. TECH STACK & SYSTEM INFRASTRUCTURE

- **Runtime**: TypeScript (strict mode, ES2022+).
- **Service Architecture**: Hono (Cloudflare Workers / Edge execution for <5ms routing latency) or Fastify on Node 22.
- **Database & ORM**: PostgreSQL / Cloudflare D1 managed via Drizzle ORM.
- **Queuing & Concurrency**: Redis / Cloudflare Queues / Durable Objects for real-time order state machines, concurrency locks, and distributed 86'ing fan-out.
- **Security & Cryptography**:
  - HMAC-SHA256 signature verification for Swiggy, Zomato, and custom webhooks.
  - Ed25519 asymmetric cryptographic signing & verification for ONDC Beckn Protocol.
  - AES-256-GCM encryption for storing merchant channel API credentials and tokens.
- **Validation**: Strict Zod schemas for all inbound webhooks, outbound requests, and database entities.
- **Testing**: Playwright / Vitest integration tests simulating real-time order lifecycles and menu synchronizations.

---

## 3. CORE ARCHITECTURAL MODULES

### MODULE 1: CANONICAL UNIVERSAL DATA ENGINE (THE TRANSLATOR)
Define universal platform-agnostic models in `@logixsoft/relay-schema`:

1. **Universal Menu Model**:
   - `OutletCatalog`: Operating hours, slot timings, packaging charges, tax slabs, channel markup settings.
   - `Category`: `id`, `name`, `description`, `sortOrder`, `isActive`.
   - `Item`: `id`, `title`, `description`, `foodType` (`VEG` | `NON_VEG` | `EGG` | `VEGAN`), `basePrice`, `taxes`, `packagingFee`, `imageUrls`, `is86ed` (out of stock status).
   - `VariantGroup` & `AddonGroup`: Min/Max selections, pricing modifiers, nested customizers.
   - `ChannelPriceMultiplier`: Dynamic pricing rules per channel (e.g., base + 20% on Zomato, base + 0% on ONDC).

2. **Universal Order Lifecycle State Machine**:
   - Normalized Status Enum:
     ```
     ORDER_PLACED -> ORDER_ACKNOWLEDGED -> ORDER_ACCEPTED -> FOOD_PREPARING -> FOOD_READY -> RIDER_ASSIGNED -> DISPATCHED -> DELIVERED / CANCELLED
     ```
   - Two-way mapping between aggregator-specific statuses (e.g., Swiggy `FOOD_READY`, Zomato `FOOD_PREPARED`, Beckn `In-Progress`) and the canonical state machine.
   - Standardized cancellation reason codes across all channels.

---

### MODULE 2: INBOUND WEBHOOK INGESTION & IDEMPOTENCY BUFFER
1. **Fast-Ack SLA (<300ms)**:
   - Food delivery aggregators strictly require webhooks to return `HTTP 200 OK` within 2 seconds, otherwise triggering aggressive retry loops and temporary restaurant delisting.
   - Webhook ingress validates HMAC signature, stores raw payload with idempotency key (`channel + channelOrderId`), pushes event to a distributed queue, and acknowledges `HTTP 200 OK` in <300ms.
2. **Worker Normalizer**:
   - De-duplicates events using the idempotency key.
   - Normalizes raw vendor payload into the Canonical Universal Order schema.
   - Broadcasts the normalized order in real-time to Logix Dine POS, Kitchen Display System (KDS), and Desktop PC app (triggering silent thermal KOT printing).

---

### MODULE 3: CHANNEL ADAPTER SUITE (INBOUND & OUTBOUND)
Implement a clean `ChannelAdapter` interface with the following contracts:
```typescript
interface ChannelAdapter {
  channelCode: 'SWIGGY' | 'ZOMATO' | 'MAGICPIN' | 'ONDC' | 'OWNLY' | 'TOING';
  verifyWebhook(req: Request, rawBody: string, secret: string): Promise<boolean>;
  parseOrder(rawPayload: any): Promise<CanonicalOrder>;
  acceptOrder(channelOrderId: string, prepTimeMinutes: number, credentials: any): Promise<boolean>;
  rejectOrder(channelOrderId: string, reasonCode: string, credentials: any): Promise<boolean>;
  markFoodReady(channelOrderId: string, credentials: any): Promise<boolean>;
  publishMenu(outletId: string, menu: CanonicalMenu, credentials: any): Promise<SyncResult>;
  updateItemStock(outletId: string, itemId: string, inStock: boolean, credentials: any): Promise<boolean>;
  updateStoreStatus(outletId: string, isOnline: boolean, credentials: any): Promise<boolean>;
}
```

1. **Swiggy POS Adapter**:
   - Inbound webhook parser (`order.placed`, `order.cancelled`, `rider.status_update`).
   - Outbound REST endpoints for order accept with preparation time, food ready, and catalog sync.
2. **Zomato Food Partner Adapter (v2 API)**:
   - Inbound webhook parser for new orders, delivery addresses, and rider arrival events.
   - Outbound calls for status progression, delay notifications, and item stockouts.
3. **Magicpin Adapter**:
   - Inbound order relay and merchant loyalty / coupon redemption accounting.
4. **ONDC Beckn Protocol Adapter (v1.2 BPP - Seller App)**:
   - Implements full Beckn open e-commerce protocol:
     - `/search` (Catalog discovery with geo-spatial radius filtering).
     - `/select` (Quote generation with food tax and itemized packaging charges).
     - `/init` (Customer drop address, phone, and billing details).
     - `/confirm` (Order placement and payment authorization).
     - `/status` (Live tracking of food preparation and delivery).
     - `/track` (Live telemetry feed).
     - `/cancel` (Order cancellation with Beckn reason codes).
   - Ed25519 authorization header verification and response signing.
5. **Direct Channels (Ownly / Toing / Customer Portal)**:
   - Standard webhook listeners mapping custom payloads directly to the canonical schema.

---

### MODULE 4: REAL-TIME 86'ing (OUT-OF-STOCK) & STORE PAUSE ENGINE
1. **Sub-Second Inventory Fan-Out**:
   - Single endpoint: `POST /relay/inventory/item-status` with `{ outletId, itemId, isInStock }`.
   - The engine looks up all active channel integrations for the restaurant and fires parallel update requests to Swiggy, Zomato, Magicpin, and ONDC simultaneously.
   - Strict SLA: Must complete fan-out in <1500ms and return per-channel status.
2. **Rush-Hour Store Pause**:
   - `POST /relay/store/status` with `{ outletId, isOnline, reason, durationMinutes }`.
   - Temporarily toggles orders off across all platforms with a single click during kitchen surges.

---

### MODULE 5: 3PL ON-DEMAND LOGISTICS ROUTER (FOR DIRECT ORDERS)
For direct orders (ONDC, Ownly, Toing, Customer Portal) that do not supply marketplace delivery riders:
1. **Multi-Carrier Broker**:
   - Integrates with: Shadowfax, Dunzo for Business, Porter, Borzo.
   - `POST /relay/logistics/quote`: Requests live prices and ETAs across all carriers in parallel; returns the cheapest and fastest options.
   - `POST /relay/logistics/dispatch`: Automatically or manually dispatches the selected 3PL carrier upon kitchen acceptance.
2. **WhatsApp Customer Live Tracking**:
   - Listens for 3PL rider webhooks (`RIDER_ASSIGNED`, `ARRIVED_AT_STORE`, `OUT_FOR_DELIVERY`).
   - Automatically dispatches live map tracking links to the customer via WhatsApp.

---

### MODULE 6: FINANCIAL RECONCILIATION & COMMISSION AUDITING
1. **Itemized Transaction Ledger**:
   - Tracks: Gross Order Value, Customer Amount Paid, Marketplace Commission %, Fixed Order Fee, Gateway Fee, Packaging Fee, GST on Food (5%), GST on Commission (18%), TCS/TDS (1%).
2. **Automated Payout Audit**:
   - Endpoint to upload weekly settlement CSVs from Swiggy and Zomato.
   - Automatically cross-references bank credits against order histories, flagging unauthorized deductions, discrepancies, or disputed cancellations.

---

## 4. DATABASE ENTITIES (DRIZZLE ORM)

Implement the following database schema:
1. `relay_channels`: `id`, `code` (`SWIGGY` | `ZOMATO` | `MAGICPIN` | `ONDC` | `OWNLY` | `TOING`), `name`, `isActive`.
2. `relay_outlet_integrations`: `id`, `outletId`, `channelCode`, `merchantStoreId`, `credentialsEncrypted` (AES-256 JSON), `isOnline`, `autoAcceptOrders`, `defaultPrepMinutes`, `channelPriceMarkupPercent`, `updatedAt`.
3. `relay_menus`: `id`, `outletId`, `version`, `name`, `catalogDataJson`, `lastSyncedAt`.
4. `relay_orders`: `id`, `outletId`, `channelCode`, `channelOrderId`, `status`, `customerDetailsJson`, `itemsJson`, `pricingBreakdownJson`, `riderDetailsJson`, `rawWebhookJson`, `createdAt`, `updatedAt`.
5. `relay_order_audits`: `id`, `orderId`, `fromStatus`, `toStatus`, `triggeredBy`, `metaJson`, `timestamp`.
6. `relay_logistics_dispatches`: `id`, `orderId`, `providerCode` (`SHADOWFAX` | `DUNZO` | `PORTER`), `waybillNumber`, `feeAmount`, `riderName`, `riderPhone`, `trackingUrl`, `status`.
7. `relay_settlements`: `id`, `outletId`, `channelCode`, `payoutReference`, `grossAmount`, `commissionDeductions`, `netPayout`, `settlementDate`.

---

## 5. API SPECIFICATION & ROUTE MAP

### Inbound Channel Webhooks
- `POST /webhooks/swiggy/order` — Inbound Swiggy order hook
- `POST /webhooks/swiggy/status` — Swiggy rider & status updates
- `POST /webhooks/zomato/order` — Inbound Zomato order hook
- `POST /webhooks/zomato/status` — Zomato rider & status updates
- `POST /webhooks/magicpin/order` — Magicpin order hook
- `POST /webhooks/ownly/order` — Ownly D2C order hook
- `POST /webhooks/toing/order` — Toing order hook
- `POST /onboard/beckn/bpp/*` — ONDC Beckn BPP protocol suite (`search`, `select`, `init`, `confirm`, `status`, `track`)

### Outbound Order Controls (Invoked by Cashier / POS)
- `POST /orders/:orderId/accept` — `{ prepTimeMinutes: number }`
- `POST /orders/:orderId/reject` — `{ reasonCode: string, explanation: string }`
- `POST /orders/:orderId/ready` — Marks food prepared; alerts rider
- `POST /orders/:orderId/dispatch` — `{ riderType: 'CHANNEL' | '3PL' | 'IN_HOUSE', riderDetails?: object }`

### Catalog & Outlet Synchronization
- `POST /outlets/:id/menu/publish` — `{ menuId: string, channels?: string[] }`
- `POST /outlets/:id/item-stock` — `{ itemId: string, inStock: boolean, durationMinutes?: number }`
- `POST /outlets/:id/store-status` — `{ isOnline: boolean, durationMinutes?: number }`

### 3PL Logistics Operations
- `POST /logistics/quote` — `{ pickupCoords, dropCoords, orderValue, packageWeight }`
- `POST /logistics/dispatch` — `{ orderId: string, preferredProvider?: string }`
- `GET /logistics/track/:id` — Real-time rider coordinates and ETA

---

## 6. DEFINITION OF DONE & VERIFICATION
1. Complete TypeScript compilation with 0 errors across the monorepo.
2. Inbound webhook tests:
   - Simulate a Swiggy/Zomato webhook, verify HMAC signature check, ensure response arrives in <300ms, and verify normalized order injection into the POS stream.
3. 86'ing test:
   - Simulate marking an item out of stock and verify parallel fan-out calls to all registered channel mock servers.
4. ONDC Beckn test:
   - Execute end-to-end Beckn BPP flow (`search` -> `select` -> `init` -> `confirm` -> `status`).
5. Desktop POS Bridge:
   - Verify incoming delivery orders trigger desktop audio chime and silent thermal KOT printing via `logixDinePC.printReceipt({ silent: true })`.
