import {
  pgTable, text, timestamp, boolean, integer, bigint, index, unique, jsonb,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

// ─── Restaurant (tenant root) ─────────────────────────────────────────────────

export const restaurant = pgTable(
  'restaurant',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    phone: text('phone'),
    currency: text('currency').notNull().default('INR'),
    status: text('status').notNull().default('TRIAL'), // ACTIVE | TRIAL
    ownerUserId: text('ownerUserId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'), // phone number of acting user
    updatedBy: text('updatedBy'), // phone number of acting user
  },
  (t) => [index('restaurant_ownerUserId_idx').on(t.ownerUserId)],
);

// ─── Restaurant Member (permission-based access) ──────────────────────────────
// userId is nullable: a member can exist as a PENDING invite (by phone only)
// before the invitee has ever logged in. On first OTP login with a matching
// phone, userId is filled in and inviteStatus flips to ACCEPTED.

export const restaurantMember = pgTable(
  'restaurantMember',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    userId: text('userId').references(() => user.id, { onDelete: 'set null' }), // nullable until invite accepted
    phone: text('phone').notNull(), // E.164 — used to match invite to user on login
    role: text('role').notNull(), // RestaurantRole
    inviteStatus: text('inviteStatus').notNull().default('ACCEPTED'), // PENDING | ACCEPTED
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
    updatedBy: text('updatedBy'),
  },
  (t) => [
    index('restaurantMember_restaurantId_idx').on(t.restaurantId),
    index('restaurantMember_userId_idx').on(t.userId),
    index('restaurantMember_phone_idx').on(t.phone),
    // NOTE: uniqueness of (restaurantId, phone) enforced in application logic —
    // drizzle v0.x doesn't cleanly support partial/conditional unique indexes,
    // and userId is nullable so a DB-level unique(restaurantId, userId) would
    // still allow duplicate PENDING rows. Guarded in the invite handler instead.
  ],
);

// ─── Member ↔ Outlet access (junction table) ─────────────────────────────────
// OWNER has zero rows here — meaning "all outlets", checked in tenancy.ts.
// MANAGER / WAITER / KITCHEN need at least one row per outlet they can access.

export const memberOutletAccess = pgTable(
  'memberOutletAccess',
  {
    id: text('id').primaryKey(),
    memberId: text('memberId')
      .notNull()
      .references(() => restaurantMember.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
  },
  (t) => [
    unique('memberOutletAccess_memberId_outletId_uniq').on(t.memberId, t.outletId),
    index('memberOutletAccess_memberId_idx').on(t.memberId),
    index('memberOutletAccess_outletId_idx').on(t.outletId),
  ],
);

// ─── Restaurant Outlet ────────────────────────────────────────────────────────

export const restaurantOutlet = pgTable(
  'restaurantOutlet',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address'),
    phone: text('phone'),
    upiId: text('upiId'),
    isDefault: boolean('isDefault').notNull().default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
    updatedBy: text('updatedBy'),
  },
  (t) => [index('restaurantOutlet_restaurantId_idx').on(t.restaurantId)],
);

// ─── POS Table (dine-in table registry) ───────────────────────────────────────
// `saleOrder.tableNo` remains a point-in-time NAME SNAPSHOT (tables can be
// renamed/removed later without corrupting historical orders).

export const posTable = pgTable(
  'posTable',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // "T1", "Window 3", "Bar 2"
    section: text('section'), // "Ground Floor", "Terrace"
    capacity: integer('capacity'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sortOrder').notNull().default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
    updatedBy: text('updatedBy'),
  },
  (t) => [
    index('posTable_outletId_idx').on(t.outletId),
    unique('posTable_outletId_name_uniq').on(t.outletId, t.name),
  ],
);

// ─── Menu Category ────────────────────────────────────────────────────────────

export const menuCategory = pgTable(
  'menuCategory',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    sortOrder: integer('sortOrder').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
    updatedBy: text('updatedBy'),
  },
  (t) => [
    index('menuCategory_restaurantId_idx').on(t.restaurantId),
    index('menuCategory_outletId_idx').on(t.outletId),
  ],
);

export interface MenuItemVariant {
  id: string;
  name: string;
  pricePaise: number;
}

export interface MenuItemAddon {
  id: string;
  name: string;
  pricePaise: number;
}

// ─── Menu Item ────────────────────────────────────────────────────────────────

export const menuItem = pgTable(
  'menuItem',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    categoryId: text('categoryId')
      .notNull()
      .references(() => menuCategory.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description'),
    imageUrl: text('imageUrl'),
    pricePaise: integer('pricePaise').notNull(),
    available: boolean('available').notNull().default(true),
    sortOrder: integer('sortOrder').notNull().default(0),
    variants: jsonb('variants').$type<MenuItemVariant[]>().notNull().default([]),
    addons: jsonb('addons').$type<MenuItemAddon[]>().notNull().default([]),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
    updatedBy: text('updatedBy'),
  },
  (t) => [
    index('menuItem_restaurantId_idx').on(t.restaurantId),
    index('menuItem_outletId_idx').on(t.outletId),
    index('menuItem_categoryId_idx').on(t.categoryId),
  ],
);

// ─── Sale Order ───────────────────────────────────────────────────────────────

export const saleOrder = pgTable(
  'saleOrder',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'restrict' }),
    orderNo: integer('orderNo').notNull(),
    tableNo: text('tableNo'),
    customerPhone: text('customerPhone'),
    status: text('status').notNull().default('OPEN'), // OPEN | PAID | VOID
    orderStatus: text('orderStatus').notNull().default('ORDERED'), // ORDERED | PREPARING | PREPARED | SERVED | CANCELLED
    subtotalPaise: integer('subtotalPaise').notNull().default(0),
    paidPaise: integer('paidPaise').notNull().default(0),
    method: text('method'), // Cash | UPI | QR
    note: text('note'),
    kotPrintedAt: timestamp('kotPrintedAt'),
    readyAt: timestamp('readyAt'), // KDS: set when kitchen marks the order ready
    settledAt: timestamp('settledAt'),
    settledByUserId: text('settledByUserId').references(() => user.id),
    tableFreedAt: timestamp('tableFreedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
    updatedBy: text('updatedBy'),
  },
  (t) => [
    index('saleOrder_restaurantId_status_idx').on(t.restaurantId, t.status),
    index('saleOrder_restaurantId_orderStatus_idx').on(t.restaurantId, t.orderStatus),
    index('saleOrder_outletId_idx').on(t.outletId),
    index('saleOrder_outletId_orderStatus_idx').on(t.outletId, t.orderStatus),
    index('saleOrder_tableFreedAt_idx').on(t.tableFreedAt),
  ],
);

// ─── Sale Order Item ──────────────────────────────────────────────────────────

export const saleOrderItem = pgTable(
  'saleOrderItem',
  {
    id: text('id').primaryKey(),
    orderId: text('orderId')
      .notNull()
      .references(() => saleOrder.id, { onDelete: 'cascade' }),
    itemId: text('itemId')
      .notNull()
      .references(() => menuItem.id, { onDelete: 'restrict' }),
    nameSnapshot: text('nameSnapshot').notNull(),
    pricePaiseSnapshot: integer('pricePaiseSnapshot').notNull(),
    qty: integer('qty').notNull(),
    variant: jsonb('variant').$type<MenuItemVariant | null>(),
    addons: jsonb('addons').$type<MenuItemAddon[]>().notNull().default([]),
    status: text('status').notNull().default('ORDERED'), // ORDERED | PREPARING | PREPARED | SERVED | CANCELLED
    round: integer('round').notNull().default(1),
    paymentStatus: text('paymentStatus').notNull().default('UNPAID'), // UNPAID | PAID
    settledMethod: text('settledMethod'),
    settledAt: timestamp('settledAt'),
    note: text('note'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
    updatedBy: text('updatedBy'),
  },
  (t) => [
    index('saleOrderItem_orderId_idx').on(t.orderId),
    index('saleOrderItem_orderId_status_idx').on(t.orderId, t.status),
    index('saleOrderItem_orderId_round_idx').on(t.orderId, t.round),
    index('saleOrderItem_paymentStatus_idx').on(t.paymentStatus),
  ],
);

// ─── Order Item Audit ─────────────────────────────────────────────────────────

export const orderItemAudit = pgTable(
  'orderItemAudit',
  {
    id: text('id').primaryKey(),
    orderId: text('orderId')
      .notNull()
      .references(() => saleOrder.id, { onDelete: 'cascade' }),
    orderItemId: text('orderItemId')
      .notNull()
      .references(() => saleOrderItem.id, { onDelete: 'cascade' }),
    fromStatus: text('fromStatus'),
    toStatus: text('toStatus').notNull(),
    changedBy: text('changedBy'),
    changedByRole: text('changedByRole'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [
    index('orderItemAudit_orderItemId_idx').on(t.orderItemId),
    index('orderItemAudit_orderId_idx').on(t.orderId),
  ],
);

// ─── Combined schema export ───────────────────────────────────────────────────

export const posSchema = {
  restaurant,
  restaurantMember,
  memberOutletAccess,
  restaurantOutlet,
  posTable,
  menuCategory,
  menuItem,
  saleOrder,
  saleOrderItem,
  orderItemAudit,
};
