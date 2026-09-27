import {
  pgTable, text, timestamp, boolean, integer, bigint, index, unique, jsonb, doublePrecision,
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
    openingHours: jsonb('openingHours'),
    invoiceSettings: jsonb('invoiceSettings'),
    taxSettings: jsonb('taxSettings'),
    diningSettings: jsonb('diningSettings'),
    qrMenuSettings: jsonb('qrMenuSettings'),
    whatsappSettings: jsonb('whatsappSettings'),
    inventorySettings: jsonb('inventorySettings'),
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

export interface OrderAdjustment {
  id: string;
  label: string;
  value: string;
  amountPaise: number;
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
    ratingAvg: doublePrecision('ratingAvg').default(0),
    ratingCount: integer('ratingCount').default(0),
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
    orderType: text('orderType').notNull().default('DINE_IN'), // DINE_IN | TAKEAWAY | DELIVERY
    packagingChargePaise: integer('packagingChargePaise').notNull().default(0),
    deliveryChargePaise: integer('deliveryChargePaise').notNull().default(0),
    adjustments: jsonb('adjustments').$type<OrderAdjustment[]>().notNull().default([]),
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

// ─── Waiter Request ──────────────────────────────────────────────────────────

export const waiterRequest = pgTable(
  'waiterRequest',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    orderId: text('orderId')
      .references(() => saleOrder.id, { onDelete: 'set null' }),
    tableNo: text('tableNo').notNull(),
    serviceType: text('serviceType').notNull(), // WATER | CUTLERY | BILL | CLEAN_TABLE | OTHER
    serviceLabel: text('serviceLabel').notNull(),
    note: text('note'),
    customerPhone: text('customerPhone'),
    status: text('status').notNull().default('PENDING'), // PENDING | IN_PROGRESS | COMPLETED | CANCELLED
    completedAt: timestamp('completedAt'),
    completedBy: text('completedBy'),
    completedByRole: text('completedByRole'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
    updatedBy: text('updatedBy'),
  },
  (t) => [
    index('waiterRequest_restaurantId_status_idx').on(t.restaurantId, t.status),
    index('waiterRequest_outletId_status_idx').on(t.outletId, t.status),
    index('waiterRequest_outletId_idx').on(t.outletId),
    index('waiterRequest_createdAt_idx').on(t.createdAt),
  ],
);

// ─── Delivery Order ──────────────────────────────────────────────────────────

export const deliveryOrder = pgTable(
  'deliveryOrder',
  {
    id: text('id').primaryKey(),
    orderId: text('orderId')
      .notNull()
      .references(() => saleOrder.id, { onDelete: 'cascade' }),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    customerName: text('customerName').notNull(),
    customerPhone: text('customerPhone').notNull(),
    alternatePhone: text('alternatePhone'),
    addressLine1: text('addressLine1').notNull(),
    addressLine2: text('addressLine2'),
    landmark: text('landmark'),
    city: text('city').notNull().default(''),
    pincode: text('pincode').notNull().default(''),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    deliveryNotes: text('deliveryNotes'),
    deliveryMode: text('deliveryMode').notNull().default('IN_HOUSE'), // IN_HOUSE | THIRD_PARTY
    deliveryProvider: text('deliveryProvider'),
    riderId: text('riderId'),
    riderName: text('riderName'),
    riderPhone: text('riderPhone'),
    riderVehicleNo: text('riderVehicleNo'),
    deliveryOtp: text('deliveryOtp').notNull(),
    status: text('status').notNull().default('PENDING_ASSIGNMENT'), // PENDING_ASSIGNMENT | ASSIGNED | OUT_FOR_DELIVERY | DELIVERED | CANCELLED
    estimatedMinutes: integer('estimatedMinutes').default(35),
    assignedAt: timestamp('assignedAt'),
    pickedUpAt: timestamp('pickedUpAt'),
    deliveredAt: timestamp('deliveredAt'),
    failedReason: text('failedReason'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('deliveryOrder_orderId_idx').on(t.orderId),
    index('deliveryOrder_outletId_status_idx').on(t.outletId, t.status),
    index('deliveryOrder_customerPhone_idx').on(t.customerPhone),
  ]
);

// ─── Customer Address ────────────────────────────────────────────────────────

export const customerAddress = pgTable(
  'customerAddress',
  {
    id: text('id').primaryKey(),
    customerPhone: text('customerPhone').notNull(),
    label: text('label').notNull().default('Home'),
    receiverName: text('receiverName'),
    receiverPhone: text('receiverPhone'),
    addressLine1: text('addressLine1').notNull(),
    addressLine2: text('addressLine2'),
    landmark: text('landmark'),
    city: text('city').notNull().default(''),
    pincode: text('pincode').notNull().default(''),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    isDefault: boolean('isDefault').default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('customerAddress_customerPhone_idx').on(t.customerPhone),
  ]
);

// ─── Delivery Rider (Fleet) ──────────────────────────────────────────────────

export const deliveryRider = pgTable(
  'deliveryRider',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    vehicleType: text('vehicleType').notNull().default('BIKE'),
    vehicleNumber: text('vehicleNumber'),
    status: text('status').notNull().default('AVAILABLE'), // AVAILABLE | ON_DELIVERY | OFFLINE | INACTIVE
    currentLatitude: doublePrecision('currentLatitude'),
    currentLongitude: doublePrecision('currentLongitude'),
    lastLocationAt: timestamp('lastLocationAt'),
    activeOrderId: text('activeOrderId'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('deliveryRider_outletId_status_idx').on(t.outletId, t.status),
  ]
);

// ─── Table Reservation ───────────────────────────────────────────────────────

export const tableReservation = pgTable(
  'tableReservation',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    tableId: text('tableId').references(() => posTable.id, { onDelete: 'set null' }),
    tableName: text('tableName'),
    guestName: text('guestName').notNull(),
    guestPhone: text('guestPhone').notNull(),
    guestEmail: text('guestEmail'),
    partySize: integer('partySize').notNull().default(2),
    reservationDate: text('reservationDate').notNull(), // YYYY-MM-DD
    startTime: text('startTime').notNull(), // HH:mm
    endTime: text('endTime'), // HH:mm
    status: text('status').notNull().default('CONFIRMED'), // CONFIRMED | SEATED | CANCELLED | COMPLETED
    notes: text('notes'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
    updatedBy: text('updatedBy'),
  },
  (t) => [
    index('tableReservation_restaurantId_idx').on(t.restaurantId),
    index('tableReservation_outletId_idx').on(t.outletId),
    index('tableReservation_date_idx').on(t.reservationDate),
    index('tableReservation_status_idx').on(t.status),
  ],
);

// ─── Inventory Suppliers ─────────────────────────────────────────────────────

export const inventorySupplier = pgTable(
  'inventorySupplier',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    contactPerson: text('contactPerson'),
    phone: text('phone'),
    email: text('email'),
    gstin: text('gstin'),
    address: text('address'),
    paymentTerms: text('paymentTerms'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [index('inventorySupplier_restaurantId_idx').on(t.restaurantId)],
);

// ─── Inventory Items (Ingredients & Raw Materials) ───────────────────────────

export const inventoryItem = pgTable(
  'inventoryItem',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sku: text('sku'),
    category: text('category').notNull().default('GENERAL'),
    baseUom: text('baseUom').notNull(), // 'g' | 'kg' | 'ml' | 'l' | 'pcs' | 'pkt' | 'can'
    purchaseUom: text('purchaseUom'),
    purchaseConversionFactor: doublePrecision('purchaseConversionFactor').default(1),
    costPerBaseUnitPaise: integer('costPerBaseUnitPaise').notNull().default(0),
    currentStock: doublePrecision('currentStock').notNull().default(0),
    lowStockThreshold: doublePrecision('lowStockThreshold').default(0),
    idealStock: doublePrecision('idealStock'),
    supplierId: text('supplierId').references(() => inventorySupplier.id, { onDelete: 'set null' }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
    updatedBy: text('updatedBy'),
  },
  (t) => [
    index('inventoryItem_outletId_idx').on(t.outletId),
    index('inventoryItem_restaurantId_idx').on(t.restaurantId),
    index('inventoryItem_category_idx').on(t.category),
  ],
);

// ─── Menu Item Recipes (Bill of Materials) ───────────────────────────────────

export const menuItemRecipe = pgTable(
  'menuItemRecipe',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId').references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    menuItemId: text('menuItemId')
      .notNull()
      .references(() => menuItem.id, { onDelete: 'cascade' }),
    variantId: text('variantId'),
    addonId: text('addonId'),
    ingredientId: text('ingredientId')
      .notNull()
      .references(() => inventoryItem.id, { onDelete: 'restrict' }),
    quantity: doublePrecision('quantity').notNull(),
    wastePercent: doublePrecision('wastePercent').default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('menuItemRecipe_menuItemId_idx').on(t.menuItemId),
    index('menuItemRecipe_ingredientId_idx').on(t.ingredientId),
    index('menuItemRecipe_restaurantId_idx').on(t.restaurantId),
  ],
);

// ─── Inventory Transaction Ledger ────────────────────────────────────────────

export const inventoryTransaction = pgTable(
  'inventoryTransaction',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredientId')
      .notNull()
      .references(() => inventoryItem.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'PURCHASE' | 'ORDER_CONSUMPTION' | 'ORDER_RESTORE' | 'WASTAGE' | 'ADJUSTMENT' | 'RETURN'
    quantity: doublePrecision('quantity').notNull(),
    balanceAfter: doublePrecision('balanceAfter').notNull(),
    unitCostPaise: integer('unitCostPaise').default(0),
    referenceId: text('referenceId'),
    referenceNote: text('referenceNote'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
  },
  (t) => [
    index('inventoryTx_ingredientId_idx').on(t.ingredientId),
    index('inventoryTx_outletId_createdAt_idx').on(t.outletId, t.createdAt),
    index('inventoryTx_referenceId_idx').on(t.referenceId),
  ],
);

// ─── Purchase Orders (Stock In / GRN) ────────────────────────────────────────

export const purchaseOrder = pgTable(
  'purchaseOrder',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    supplierId: text('supplierId').references(() => inventorySupplier.id, { onDelete: 'set null' }),
    poNumber: text('poNumber').notNull(),
    invoiceNumber: text('invoiceNumber'),
    invoiceDate: text('invoiceDate'),
    status: text('status').notNull().default('RECEIVED'),
    totalAmountPaise: integer('totalAmountPaise').notNull().default(0),
    notes: text('notes'),
    receivedAt: timestamp('receivedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    createdBy: text('createdBy'),
  },
  (t) => [
    index('purchaseOrder_outletId_idx').on(t.outletId),
    index('purchaseOrder_restaurantId_idx').on(t.restaurantId),
  ],
);

// ─── Purchase Order Items ────────────────────────────────────────────────────

export const purchaseOrderItem = pgTable(
  'purchaseOrderItem',
  {
    id: text('id').primaryKey(),
    purchaseOrderId: text('purchaseOrderId')
      .notNull()
      .references(() => purchaseOrder.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredientId')
      .notNull()
      .references(() => inventoryItem.id, { onDelete: 'restrict' }),
    quantity: doublePrecision('quantity').notNull(),
    unitCostPaise: integer('unitCostPaise').notNull(),
    totalPaise: integer('totalPaise').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [index('purchaseOrderItem_purchaseOrderId_idx').on(t.purchaseOrderId)],
);

// ─── Order & Item Feedback ───────────────────────────────────────────────────

export const orderFeedback = pgTable(
  'orderFeedback',
  {
    id: text('id').primaryKey(),
    restaurantId: text('restaurantId')
      .notNull()
      .references(() => restaurant.id, { onDelete: 'cascade' }),
    outletId: text('outletId')
      .notNull()
      .references(() => restaurantOutlet.id, { onDelete: 'cascade' }),
    orderId: text('orderId')
      .notNull()
      .references(() => saleOrder.id, { onDelete: 'cascade' }),
    customerPhone: text('customerPhone').notNull(),
    customerName: text('customerName'),
    isAnonymous: boolean('isAnonymous').notNull().default(false),
    rating: integer('rating').notNull(), // 1 to 5
    foodRating: integer('foodRating'), // 1 to 5
    serviceRating: integer('serviceRating'), // 1 to 5
    deliveryRating: integer('deliveryRating'), // 1 to 5
    tags: jsonb('tags').$type<string[]>().default([]),
    comment: text('comment'),
    ownerReply: text('ownerReply'),
    ownerRepliedAt: timestamp('ownerRepliedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    unique('orderFeedback_orderId_unique').on(t.orderId),
    index('orderFeedback_restaurantId_idx').on(t.restaurantId),
    index('orderFeedback_outletId_idx').on(t.outletId),
    index('orderFeedback_customerPhone_idx').on(t.customerPhone),
    index('orderFeedback_rating_idx').on(t.rating),
    index('orderFeedback_createdAt_idx').on(t.createdAt),
  ],
);

export const orderItemFeedback = pgTable(
  'orderItemFeedback',
  {
    id: text('id').primaryKey(),
    reviewId: text('reviewId')
      .notNull()
      .references(() => orderFeedback.id, { onDelete: 'cascade' }),
    orderId: text('orderId')
      .notNull(),
    menuItemId: text('menuItemId')
      .notNull()
      .references(() => menuItem.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(), // 1 to 5
    comment: text('comment'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('orderItemFeedback_reviewId_idx').on(t.reviewId),
    index('orderItemFeedback_orderId_idx').on(t.orderId),
    index('orderItemFeedback_menuItemId_idx').on(t.menuItemId),
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
  waiterRequest,
  deliveryOrder,
  customerAddress,
  deliveryRider,
  tableReservation,
  inventorySupplier,
  inventoryItem,
  menuItemRecipe,
  inventoryTransaction,
  purchaseOrder,
  purchaseOrderItem,
  orderFeedback,
  orderItemFeedback,
};


