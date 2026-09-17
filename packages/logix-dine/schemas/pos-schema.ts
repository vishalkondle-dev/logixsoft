import {
  pgTable, text, timestamp, boolean, integer, bigint, index, unique,
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
  },
  (t) => [index('restaurant_ownerUserId_idx').on(t.ownerUserId)],
);

// ─── Restaurant Member (permission-based access) ──────────────────────────────

export const restaurantMember = pgTable(
  'restaurantMember',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // RestaurantRole
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [
    index('restaurantMember_restaurantId_idx').on(t.restaurantId),
    index('restaurantMember_userId_idx').on(t.userId),
    unique('restaurantMember_restaurantId_userId_uniq').on(t.restaurantId, t.userId),
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
    isDefault: boolean('isDefault').notNull().default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [index('restaurantOutlet_restaurantId_idx').on(t.restaurantId)],
);

// ─── Menu Category ────────────────────────────────────────────────────────────

export const menuCategory = pgTable(
  'menuCategory',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    sortOrder: integer('sortOrder').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [index('menuCategory_restaurantId_idx').on(t.restaurantId)],
);

// ─── Menu Item ────────────────────────────────────────────────────────────────

export const menuItem = pgTable(
  'menuItem',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    categoryId: text('categoryId')
      .notNull()
      .references(() => menuCategory.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description'),
    pricePaise: integer('pricePaise').notNull(),
    available: boolean('available').notNull().default(true),
    sortOrder: integer('sortOrder').notNull().default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('menuItem_restaurantId_idx').on(t.restaurantId),
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
    status: text('status').notNull().default('OPEN'), // OPEN | PAID | VOID
    subtotalPaise: integer('subtotalPaise').notNull().default(0),
    method: text('method'), // Cash | UPI | QR
    note: text('note'),
    kotPrintedAt: timestamp('kotPrintedAt'),
    settledAt: timestamp('settledAt'),
    settledByUserId: text('settledByUserId').references(() => user.id),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('saleOrder_restaurantId_status_idx').on(t.restaurantId, t.status),
    index('saleOrder_outletId_idx').on(t.outletId),
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
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [index('saleOrderItem_orderId_idx').on(t.orderId)],
);

// ─── Combined schema export ───────────────────────────────────────────────────

export const posSchema = {
  restaurant,
  restaurantMember,
  restaurantOutlet,
  menuCategory,
  menuItem,
  saleOrder,
  saleOrderItem,
};
