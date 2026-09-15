import { pgTable, text, timestamp, integer, index, boolean, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export const pgProviderCredential = pgTable(
  'pg_provider_credential',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // PAYTM, MOCK, etc.
    isActive: boolean('isActive').notNull().default(false),
    merchantName: text('merchantName').default('Logixsoft Merchant'),
    vpa: text('vpa'),
    merchantId: text('merchantId'),
    credentials: jsonb('credentials').notNull().default({}),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('pg_provider_credential_userId_idx').on(t.userId),
    index('pg_provider_credential_provider_idx').on(t.provider),
    uniqueIndex('pg_provider_credential_user_provider_idx').on(t.userId, t.provider),
  ]
);

export const pgCredential = pgTable(
  'pg_credential',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    activeProvider: text('activeProvider').notNull().default('MOCK'),
    paytmMerchantId: text('paytmMerchantId'),
    paytmMerchantKey: text('paytmMerchantKey'),
    paytmWebsite: text('paytmWebsite').default('DEFAULT'),
    paytmEnv: text('paytmEnv').notNull().default('STAGING'),
    vpa: text('vpa'),
    merchantName: text('merchantName').default('Logixsoft Merchant'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [index('pg_credential_userId_idx').on(t.userId)]
);

export const paymentOrder = pgTable(
  'payment_order',
  {
    id: text('id').primaryKey(),
    orderId: text('orderId').notNull().unique(),
    merchantId: text('merchantId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // Amount in paise (100 paise = 1 INR)
    currency: text('currency').notNull().default('INR'),
    status: text('status').notNull().default('PENDING'), // PENDING, SUCCESS, FAILED, EXPIRED
    provider: text('provider').notNull().default('MOCK'), // PAYTM, MOCK
    customerName: text('customerName'),
    customerEmail: text('customerEmail'),
    customerPhone: text('customerPhone'),
    description: text('description'),
    upiString: text('upiString'),
    providerReferenceId: text('providerReferenceId'),
    bankReferenceNo: text('bankReferenceNo'),
    paymentMode: text('paymentMode'),
    failureReason: text('failureReason'),
    metadata: text('metadata'),
    expiresAt: timestamp('expiresAt'),
    paidAt: timestamp('paidAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('payment_order_orderId_idx').on(t.orderId),
    index('payment_order_merchantId_idx').on(t.merchantId),
    index('payment_order_status_idx').on(t.status),
    index('payment_order_createdAt_idx').on(t.createdAt),
  ]
);

export const webhookLog = pgTable(
  'webhook_log',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    orderId: text('orderId'),
    payload: text('payload').notNull(),
    headers: text('headers'),
    status: text('status').notNull().default('PROCESSED'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [
    index('webhook_log_orderId_idx').on(t.orderId),
    index('webhook_log_createdAt_idx').on(t.createdAt),
  ]
);

export const apiKey = pgTable(
  'api_key',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchantId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull().unique(),
    name: text('name').notNull(),
    lastUsedAt: timestamp('lastUsedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [
    index('api_key_merchantId_idx').on(t.merchantId),
    index('api_key_key_idx').on(t.key),
  ]
);

export const merchantWebhook = pgTable(
  'merchant_webhook',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchantId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
      .unique(),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('merchant_webhook_merchantId_idx').on(t.merchantId),
  ]
);

export const pgSchema = {
  pgProviderCredential,
  pgCredential,
  paymentOrder,
  webhookLog,
  apiKey,
  merchantWebhook,
};

export type pgSchema = typeof pgSchema;
