import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  index,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';
export { eq, and, desc, sql } from 'drizzle-orm';

// ─── relay_channels ───────────────────────────────────────────────────────────
export const relayChannels = pgTable(
  'relay_channels',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(), // SWIGGY | ZOMATO | MAGICPIN | ONDC | OWNLY | TOING
    name: text('name').notNull(),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('relay_channels_code_idx').on(t.code)]
);

// ─── relay_outlet_integrations ────────────────────────────────────────────────
export const relayOutletIntegrations = pgTable(
  'relay_outlet_integrations',
  {
    id: text('id').primaryKey(),
    outletId: text('outletId').notNull(),
    channelCode: text('channelCode').notNull(), // references relayChannels.code
    merchantStoreId: text('merchantStoreId').notNull(), // Aggregator store ID
    credentialsEncrypted: text('credentialsEncrypted').notNull(), // AES-256-GCM JSON
    isOnline: boolean('isOnline').notNull().default(true),
    autoAcceptOrders: boolean('autoAcceptOrders').notNull().default(false),
    defaultPrepMinutes: integer('defaultPrepMinutes').notNull().default(20),
    channelPriceMarkupPercent: doublePrecision('channelPriceMarkupPercent').notNull().default(0.0),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('relay_outlet_integrations_outletId_idx').on(t.outletId),
    uniqueIndex('relay_outlet_integrations_outlet_channel_idx').on(t.outletId, t.channelCode),
  ]
);

// ─── relay_menus ──────────────────────────────────────────────────────────────
export const relayMenus = pgTable(
  'relay_menus',
  {
    id: text('id').primaryKey(),
    outletId: text('outletId').notNull(),
    version: integer('version').notNull().default(1),
    name: text('name').notNull().default('Main Menu'),
    catalogDataJson: jsonb('catalogDataJson').notNull(), // OutletCatalog JSON
    lastSyncedAt: timestamp('lastSyncedAt').notNull().defaultNow(),
  },
  (t) => [index('relay_menus_outletId_idx').on(t.outletId)]
);

// ─── relay_orders ─────────────────────────────────────────────────────────────
export const relayOrders = pgTable(
  'relay_orders',
  {
    id: text('id').primaryKey(), // Canonical order ID (e.g. ord_...)
    outletId: text('outletId').notNull(),
    channelCode: text('channelCode').notNull(), // SWIGGY, ZOMATO, etc.
    channelOrderId: text('channelOrderId').notNull(), // Channel unique ID
    displayOrderId: text('displayOrderId').notNull(), // SW-1234
    status: text('status').notNull(), // NormalizedOrderStatus
    customerDetailsJson: jsonb('customerDetailsJson').notNull(), // CanonicalCustomer
    itemsJson: jsonb('itemsJson').notNull(), // CanonicalOrderItem[]
    pricingBreakdownJson: jsonb('pricingBreakdownJson').notNull(), // CanonicalPricingBreakdown
    riderDetailsJson: jsonb('riderDetailsJson'), // CanonicalRiderDetails
    rawWebhookJson: jsonb('rawWebhookJson'), // Inbound payload
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('relay_orders_outletId_idx').on(t.outletId),
    index('relay_orders_status_idx').on(t.status),
    uniqueIndex('relay_orders_channel_order_idx').on(t.channelCode, t.channelOrderId),
  ]
);

// ─── relay_order_audits ───────────────────────────────────────────────────────
export const relayOrderAudits = pgTable(
  'relay_order_audits',
  {
    id: text('id').primaryKey(),
    orderId: text('orderId').notNull(),
    fromStatus: text('fromStatus').notNull(),
    toStatus: text('toStatus').notNull(),
    triggeredBy: text('triggeredBy').notNull(), // 'WEBHOOK' | 'KITCHEN_APP' | 'SYSTEM' | '3PL_DISPATCH'
    metaJson: jsonb('metaJson'),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
  },
  (t) => [index('relay_order_audits_orderId_idx').on(t.orderId)]
);

// ─── relay_logistics_dispatches ───────────────────────────────────────────────
export const relayLogisticsDispatches = pgTable(
  'relay_logistics_dispatches',
  {
    id: text('id').primaryKey(),
    orderId: text('orderId').notNull(),
    providerCode: text('providerCode').notNull(), // SHADOWFAX | DUNZO | PORTER | BORZO | RAPIDO
    waybillNumber: text('waybillNumber').notNull(),
    feeAmount: doublePrecision('feeAmount').notNull().default(0),
    riderName: text('riderName'),
    riderPhone: text('riderPhone'),
    trackingUrl: text('trackingUrl'),
    status: text('status').notNull().default('PENDING'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('relay_logistics_dispatches_orderId_idx').on(t.orderId),
    index('relay_logistics_dispatches_waybill_idx').on(t.waybillNumber),
  ]
);

// ─── relay_settlements ────────────────────────────────────────────────────────
export const relaySettlements = pgTable(
  'relay_settlements',
  {
    id: text('id').primaryKey(),
    outletId: text('outletId').notNull(),
    channelCode: text('channelCode').notNull(),
    payoutReference: text('payoutReference').notNull(),
    grossAmount: doublePrecision('grossAmount').notNull().default(0),
    commissionDeductions: doublePrecision('commissionDeductions').notNull().default(0),
    netPayout: doublePrecision('netPayout').notNull().default(0),
    settlementDate: timestamp('settlementDate').notNull(),
    reconciliationStatus: text('reconciliationStatus').notNull().default('PENDING'), // RECONCILED | DISCREPANCY
    discrepancyAmount: doublePrecision('discrepancyAmount').notNull().default(0),
    discrepancyDetailsJson: jsonb('discrepancyDetailsJson'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [
    index('relay_settlements_outletId_idx').on(t.outletId),
    index('relay_settlements_payout_ref_idx').on(t.payoutReference),
  ]
);
