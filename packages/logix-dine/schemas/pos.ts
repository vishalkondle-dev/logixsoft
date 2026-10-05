import * as z from 'zod';
import { Expect } from '../types/utils';
import { AssertSame } from '../types/utils';
import type {
  JsonRestaurantRow,
  JsonOutletStaffRow,
  JsonRestaurantMemberRow,
  JsonMemberOutletAccessRow,
  JsonRestaurantOutletRow,
  JsonPosTableRow,
  JsonMenuCategoryRow,
  JsonMenuItemRow,
  JsonSaleOrderRow,
  JsonSaleOrderItemRow,
  JsonOrderItemAuditRow,
  JsonDeliveryOrderRow,
  JsonCustomerAddressRow,
  JsonDeliveryRiderRow,
  JsonTableReservationRow,
  JsonInventorySupplierRow,
  JsonInventoryItemRow,
  JsonMenuItemRecipeRow,
  JsonInventoryTransactionRow,
  JsonPurchaseOrderRow,
  JsonPurchaseOrderItemRow,
} from '../types/pos-schema';

// ─── Primitives ───────────────────────────────────────────────────────────────

export const MoneySchema = z.number().int().nonnegative();

// ─── Row schemas (SSOT-asserted) ──────────────────────────────────────────────

export const RestaurantSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  phone: z.string().nullable(),
  currency: z.string(),
  status: z.string(),
  ownerUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _RestaurantAssert = Expect<AssertSame<z.infer<typeof RestaurantSchema>, JsonRestaurantRow>>;

export const OutletStaffSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string().nullable(),
  userId: z.string().nullable(),
  phone: z.string(),
  name: z.string().nullable(),
  role: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _OutletStaffAssert = Expect<AssertSame<z.infer<typeof OutletStaffSchema>, JsonOutletStaffRow>>;

// Aliases for backward compatibility during refactor
export const RestaurantMemberSchema = OutletStaffSchema;
export const MemberOutletAccessSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  outletId: z.string(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
});

export const RestaurantOutletSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  upiId: z.string().nullable(),
  openingHours: z.unknown().nullable(),
  invoiceSettings: z.unknown().nullable(),
  taxSettings: z.unknown().nullable(),
  diningSettings: z.unknown().nullable(),
  qrMenuSettings: z.unknown().nullable(),
  whatsappSettings: z.unknown().nullable(),
  inventorySettings: z.unknown().nullable(),
  status: z.string(),
  planTier: z.string(),
  billingCycle: z.string(),
  trialEndsAt: z.string().nullable().optional(),
  subscriptionExpiresAt: z.string().nullable().optional(),
  autopayStatus: z.string().nullable(),
  autopayMandateId: z.string().nullable(),
  autopayUmn: z.string().nullable(),
  autopayNextBillingAt: z.string().nullable().optional(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _OutletAssert = Expect<AssertSame<z.infer<typeof RestaurantOutletSchema>, JsonRestaurantOutletRow>>;

export const PosTableSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string(),
  name: z.string(),
  section: z.string().nullable(),
  capacity: z.number().int().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _PosTableAssert = Expect<AssertSame<z.infer<typeof PosTableSchema>, JsonPosTableRow>>;

export const MenuCategorySchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _CategoryAssert = Expect<AssertSame<z.infer<typeof MenuCategorySchema>, JsonMenuCategoryRow>>;

export const MenuItemVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  pricePaise: z.number().int(),
});

export const MenuItemAddonSchema = z.object({
  id: z.string(),
  name: z.string(),
  pricePaise: z.number().int(),
});

export const MenuItemSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string().nullable(),
  categoryId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  pricePaise: z.number().int(),
  available: z.boolean(),
  sortOrder: z.number().int(),
  variants: z.array(MenuItemVariantSchema),
  addons: z.array(MenuItemAddonSchema),
  ratingAvg: z.number().nullable(),
  ratingCount: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _ItemAssert = Expect<AssertSame<z.infer<typeof MenuItemSchema>, JsonMenuItemRow>>;

export const OrderAdjustmentSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  amountPaise: z.number().int(),
});

export const SaleOrderSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string(),
  orderNo: z.number().int(),
  tableNo: z.string().nullable(),
  customerPhone: z.string().nullable(),
  status: z.string(),
  orderStatus: z.string(),
  subtotalPaise: z.number().int(),
  paidPaise: z.number().int(),
  method: z.string().nullable(),
  note: z.string().nullable(),
  kotPrintedAt: z.string().nullable(),
  readyAt: z.string().nullable(),
  settledAt: z.string().nullable(),
  settledByUserId: z.string().nullable(),
  tableFreedAt: z.string().nullable(),
  orderType: z.string(),
  packagingChargePaise: z.number().int(),
  deliveryChargePaise: z.number().int(),
  adjustments: z.array(OrderAdjustmentSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _OrderAssert = Expect<AssertSame<z.infer<typeof SaleOrderSchema>, JsonSaleOrderRow>>;

export const SaleOrderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  itemId: z.string(),
  nameSnapshot: z.string(),
  pricePaiseSnapshot: z.number().int(),
  qty: z.number().int(),
  variant: MenuItemVariantSchema.nullable(),
  addons: z.array(MenuItemAddonSchema),
  status: z.string(),
  round: z.number().int(),
  paymentStatus: z.string(),
  settledMethod: z.string().nullable(),
  settledAt: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _OrderItemAssert = Expect<AssertSame<z.infer<typeof SaleOrderItemSchema>, JsonSaleOrderItemRow>>;

export const OrderItemAuditSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  orderItemId: z.string(),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  changedBy: z.string().nullable(),
  changedByRole: z.string().nullable(),
  createdAt: z.string(),
});
type _OrderItemAuditAssert = Expect<AssertSame<z.infer<typeof OrderItemAuditSchema>, JsonOrderItemAuditRow>>;

export const DeliveryOrderSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  restaurantId: z.string(),
  outletId: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  alternatePhone: z.string().nullable(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  landmark: z.string().nullable(),
  city: z.string(),
  pincode: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  deliveryNotes: z.string().nullable(),
  deliveryMode: z.string(),
  deliveryProvider: z.string().nullable(),
  riderId: z.string().nullable(),
  riderName: z.string().nullable(),
  riderPhone: z.string().nullable(),
  riderVehicleNo: z.string().nullable(),
  deliveryOtp: z.string(),
  status: z.string(),
  estimatedMinutes: z.number().nullable(),
  assignedAt: z.string().nullable(),
  pickedUpAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  failedReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
type _DeliveryOrderAssert = Expect<AssertSame<z.infer<typeof DeliveryOrderSchema>, JsonDeliveryOrderRow>>;

export const CustomerAddressSchema = z.object({
  id: z.string(),
  customerPhone: z.string(),
  label: z.string(),
  receiverName: z.string().nullable(),
  receiverPhone: z.string().nullable(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  landmark: z.string().nullable(),
  city: z.string(),
  pincode: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  isDefault: z.boolean().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
type _CustomerAddressAssert = Expect<AssertSame<z.infer<typeof CustomerAddressSchema>, JsonCustomerAddressRow>>;

export const DeliveryRiderSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string(),
  name: z.string(),
  phone: z.string(),
  vehicleType: z.string(),
  vehicleNumber: z.string().nullable(),
  status: z.string(),
  currentLatitude: z.number().nullable(),
  currentLongitude: z.number().nullable(),
  lastLocationAt: z.string().nullable(),
  activeOrderId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
type _DeliveryRiderAssert = Expect<AssertSame<z.infer<typeof DeliveryRiderSchema>, JsonDeliveryRiderRow>>;

export const TableReservationSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string(),
  tableId: z.string().nullable(),
  tableName: z.string().nullable(),
  guestName: z.string(),
  guestPhone: z.string(),
  guestEmail: z.string().nullable(),
  partySize: z.number().int(),
  reservationDate: z.string(),
  startTime: z.string(),
  endTime: z.string().nullable(),
  status: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _ReservationAssert = Expect<AssertSame<z.infer<typeof TableReservationSchema>, JsonTableReservationRow>>;

export const InventorySupplierSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  name: z.string(),
  contactPerson: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  gstin: z.string().nullable(),
  address: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
});
type _SupplierAssert = Expect<AssertSame<z.infer<typeof InventorySupplierSchema>, JsonInventorySupplierRow>>;

export const InventoryItemSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  category: z.string(),
  baseUom: z.string(),
  purchaseUom: z.string().nullable(),
  purchaseConversionFactor: z.number().nullable(),
  costPerBaseUnitPaise: z.number().int(),
  currentStock: z.number(),
  lowStockThreshold: z.number().nullable(),
  idealStock: z.number().nullable(),
  supplierId: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _InventoryItemAssert = Expect<AssertSame<z.infer<typeof InventoryItemSchema>, JsonInventoryItemRow>>;

export const MenuItemRecipeSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string().nullable(),
  menuItemId: z.string(),
  variantId: z.string().nullable(),
  addonId: z.string().nullable(),
  ingredientId: z.string(),
  quantity: z.number(),
  wastePercent: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
type _RecipeAssert = Expect<AssertSame<z.infer<typeof MenuItemRecipeSchema>, JsonMenuItemRecipeRow>>;

export const InventoryTransactionSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string(),
  ingredientId: z.string(),
  type: z.string(),
  quantity: z.number(),
  balanceAfter: z.number(),
  unitCostPaise: z.number().int().nullable(),
  referenceId: z.string().nullable(),
  referenceNote: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
});
type _InventoryTxAssert = Expect<AssertSame<z.infer<typeof InventoryTransactionSchema>, JsonInventoryTransactionRow>>;

export const PurchaseOrderSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  outletId: z.string(),
  supplierId: z.string().nullable(),
  poNumber: z.string(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  status: z.string(),
  totalAmountPaise: z.number().int(),
  notes: z.string().nullable(),
  receivedAt: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
});
type _PurchaseOrderAssert = Expect<AssertSame<z.infer<typeof PurchaseOrderSchema>, JsonPurchaseOrderRow>>;

export const PurchaseOrderItemSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  ingredientId: z.string(),
  quantity: z.number(),
  unitCostPaise: z.number().int(),
  totalPaise: z.number().int(),
  createdAt: z.string(),
});
type _PurchaseOrderItemAssert = Expect<AssertSame<z.infer<typeof PurchaseOrderItemSchema>, JsonPurchaseOrderItemRow>>;

export const UpdateOrderItemStatusSchema = z.object({
  status: z.enum(['ORDERED', 'PREPARING', 'PREPARED', 'SERVED', 'CANCELLED']).optional(),
  action: z.enum(['next', 'close', 'cancel']).optional(),
});

// ─── Request schemas ──────────────────────────────────────────────────────────

export const CreateRestaurantSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(255),
  phone: z.string().max(20).optional(),
  outletName: z.string().min(1).max(100).optional().default('Main'),
});

export const UpdateRestaurantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(255).optional(),
  phone: z.string().max(20).nullable().optional(),
});

export const CreateOutletSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
  upiId: z.string().max(100).optional(),
  planTier: z.enum(['BASIC', 'PRO']).optional(),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
  status: z.string().optional(),
});

export const UpdateOutletSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(255).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  upiId: z.string().max(100).nullable().optional(),
  planTier: z.enum(['BASIC', 'PRO']).optional(),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
  status: z.string().optional(),
  openingHours: z.any().nullable().optional(),
  invoiceSettings: z.any().nullable().optional(),
  taxSettings: z.any().nullable().optional(),
  diningSettings: z.any().nullable().optional(),
  qrMenuSettings: z.any().nullable().optional(),
  whatsappSettings: z.any().nullable().optional(),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  outletId: z.string().optional(),
  description: z.string().max(255).optional(),
  sortOrder: z.number().int().nonnegative().optional().default(0),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(255).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});

export const ReorderSchema = z.array(
  z.object({ id: z.string(), sortOrder: z.number().int().nonnegative() }),
);

export const CreateItemSchema = z.object({
  categoryId: z.string(),
  outletId: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  imageUrl: z.string().nullable().optional(),
  pricePaise: MoneySchema,
  sortOrder: z.number().int().nonnegative().optional().default(0),
  variants: z.array(MenuItemVariantSchema).optional().default([]),
  addons: z.array(MenuItemAddonSchema).optional().default([]),
});

export const UpdateItemSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(255).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  pricePaise: MoneySchema.optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  available: z.boolean().optional(),
  variants: z.array(MenuItemVariantSchema).optional(),
  addons: z.array(MenuItemAddonSchema).optional(),
});

export const OrderItemInputSchema = z.object({
  itemId: z.string(),
  qty: z.number().int().positive(),
  note: z.string().max(255).optional(),
  variantId: z.string().optional(),
  addonIds: z.array(z.string()).optional(),
});

export const DeliveryInputSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().max(25).optional(),
  alternatePhone: z.string().max(25).optional(),
  addressLine1: z.string().min(1).max(255),
  addressLine2: z.string().max(255).optional(),
  landmark: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  deliveryNotes: z.string().max(255).optional(),
  deliveryMode: z.string().optional().default('IN_HOUSE'),
  riderId: z.string().optional(),
});

export const StartOrderSchema = z.object({
  outletId: z.string(),
  tableNo: z.string().max(50).optional(),
  customerPhone: z.string().max(25).optional(),
  note: z.string().max(255).optional(),
  orderType: z.string().optional().default('DINE_IN'),
  packagingChargePaise: z.number().int().nonnegative().optional().default(0),
  deliveryChargePaise: z.number().int().nonnegative().optional().default(0),
  adjustments: z.array(OrderAdjustmentSchema).optional().default([]),
  delivery: DeliveryInputSchema.optional(),
  items: z.array(OrderItemInputSchema).optional(),
});

export const AddOrderItemSchema = z.object({
  itemId: z.string(),
  qty: z.number().int().positive().default(1),
  note: z.string().max(255).optional(),
  variantId: z.string().optional(),
  addonIds: z.array(z.string()).optional(),
});

export const AddOrderRoundSchema = z.object({
  items: z.array(OrderItemInputSchema).min(1),
  adjustments: z.array(OrderAdjustmentSchema).optional(),
  settle: z.object({
    method: z.string().min(1),
  }).optional(),
});

export const UpdateOrderItemSchema = z.object({
  qty: z.number().int().positive().optional(),
  note: z.string().max(255).optional(),
});

export const SettleOrderSchema = z.object({
  method: z.string().optional(),
  customerPhone: z.string().max(25).optional(),
  freeTable: z.boolean().optional(),
});

export const FreeTableSchema = z.object({
  method: z.string().optional(),
  customerPhone: z.string().max(25).optional(),
});

/** Create an order and settle it immediately — single round-trip for Settle & Send. */
export const CreateSettledSchema = z.object({
  outletId: z.string(),
  tableNo: z.string().max(50).optional(),
  customerPhone: z.string().max(25).optional(),
  note: z.string().max(255).optional(),
  orderType: z.string().optional().default('DINE_IN'),
  packagingChargePaise: z.number().int().nonnegative().optional().default(0),
  deliveryChargePaise: z.number().int().nonnegative().optional().default(0),
  adjustments: z.array(OrderAdjustmentSchema).optional().default([]),
  delivery: DeliveryInputSchema.optional(),
  method: z.enum(['Cash', 'UPI', 'QR']).optional(),
  items: z.array(OrderItemInputSchema).optional(),
});

// ─── Response schemas ─────────────────────────────────────────────────────────

export const BillingBootstrapSchema = z.object({
  restaurant: RestaurantSchema,
  outlets: z.array(RestaurantOutletSchema),
  categories: z.array(MenuCategorySchema),
  items: z.array(MenuItemSchema),
});

export const OrderWithItemsSchema = z.object({
  order: SaleOrderSchema,
  items: z.array(SaleOrderItemSchema),
  delivery: DeliveryOrderSchema.nullable().optional(),
});

export const CreateReservationSchema = z.object({
  outletId: z.string(),
  tableId: z.string().nullable().optional(),
  tableName: z.string().nullable().optional(),
  guestName: z.string().min(1).max(100),
  guestPhone: z.string().min(5).max(20),
  guestEmail: z.string().email().nullable().optional().or(z.literal('')),
  partySize: z.number().int().min(1).default(2),
  reservationDate: z.string(),
  startTime: z.string().min(1),
  endTime: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const UpdateReservationSchema = z.object({
  tableId: z.string().nullable().optional(),
  tableName: z.string().nullable().optional(),
  guestName: z.string().min(1).max(100).optional(),
  guestPhone: z.string().min(5).max(20).optional(),
  guestEmail: z.string().email().nullable().optional().or(z.literal('')),
  partySize: z.number().int().min(1).optional(),
  reservationDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().nullable().optional(),
  status: z.enum(['CONFIRMED', 'SEATED', 'CANCELLED', 'COMPLETED']).optional(),
  notes: z.string().max(500).nullable().optional(),
});

// ─── Inventory Request Schemas ────────────────────────────────────────────────

export const CreateInventorySupplierSchema = z.object({
  name: z.string().min(1).max(100),
  contactPerson: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  gstin: z.string().max(20).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  paymentTerms: z.string().max(100).nullable().optional(),
});

export const UpdateInventorySupplierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  contactPerson: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  gstin: z.string().max(20).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  paymentTerms: z.string().max(100).nullable().optional(),
  active: z.boolean().optional(),
});

export const CreateInventoryItemSchema = z.object({
  name: z.string().min(1).max(100),
  sku: z.string().max(50).nullable().optional(),
  category: z.string().min(1).max(50).default('GENERAL'),
  baseUom: z.string().min(1).max(20), // 'g' | 'kg' | 'ml' | 'l' | 'pcs' etc.
  purchaseUom: z.string().max(30).nullable().optional(),
  purchaseConversionFactor: z.number().positive().default(1),
  costPerBaseUnitPaise: z.number().int().nonnegative().default(0),
  currentStock: z.number().default(0),
  lowStockThreshold: z.number().nonnegative().default(0),
  idealStock: z.number().nonnegative().nullable().optional(),
  supplierId: z.string().nullable().optional(),
});

export const UpdateInventoryItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sku: z.string().max(50).nullable().optional(),
  category: z.string().min(1).max(50).optional(),
  baseUom: z.string().min(1).max(20).optional(),
  purchaseUom: z.string().max(30).nullable().optional(),
  purchaseConversionFactor: z.number().positive().optional(),
  costPerBaseUnitPaise: z.number().int().nonnegative().optional(),
  currentStock: z.number().optional(),
  lowStockThreshold: z.number().nonnegative().nullable().optional(),
  idealStock: z.number().nonnegative().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const RecipeIngredientInputSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  wastePercent: z.number().nonnegative().max(100).default(0),
  variantId: z.string().nullable().optional(),
  addonId: z.string().nullable().optional(),
});

export const SaveMenuItemRecipeSchema = z.object({
  ingredients: z.array(RecipeIngredientInputSchema),
});

export const InventoryAdjustSchema = z.object({
  ingredientId: z.string().min(1),
  newStock: z.number(), // The audited actual stock
  reason: z.string().min(1).max(255), // "Stock take count discrepancy", "Audit"
});

export const InventoryWastageSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(), // Amount wasted/spoiled
  reason: z.string().min(1).max(255), // "Burnt in prep", "Expired milk", "Dropped/Damaged"
});

export const PurchaseOrderItemInputSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  unitCostPaise: z.number().int().nonnegative(),
});

export const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().nullable().optional(),
  poNumber: z.string().min(1).max(50),
  invoiceNumber: z.string().max(50).nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  items: z.array(PurchaseOrderItemInputSchema).min(1),
});

export const UpdateInventorySettingsSchema = z.object({
  enabled: z.boolean(),
  autoDeductOn: z.enum(['ON_ORDER', 'ON_SETTLE', 'MANUAL']).default('ON_ORDER'),
  allowNegativeStock: z.boolean().default(true),
  lowStockAlerts: z.boolean().default(true),
  auto86OnDepletion: z.boolean().default(false),
});

// ─── Expenses & Petty Cash ───────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  'RAW_MATERIAL',
  'STAFF',
  'UTILITIES',
  'MAINTENANCE',
  'PACKAGING',
  'MARKETING',
  'RENT',
  'OTHER',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_PAYMENT_MODES = [
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CARD',
  'OTHER',
] as const;

export type ExpensePaymentMode = (typeof EXPENSE_PAYMENT_MODES)[number];

export const CreateExpenseSchema = z.object({
  title: z.string().min(1).max(100),
  category: z.enum(EXPENSE_CATEGORIES).default('OTHER'),
  amountPaise: z.number().int().positive(),
  paymentMode: z.enum(EXPENSE_PAYMENT_MODES).default('CASH'),
  paidTo: z.string().max(100).nullable().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  notes: z.string().max(500).nullable().optional(),
  receiptUrl: z.string().nullable().optional(),
  outletId: z.string().optional(),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export const SetCashRegisterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  openingFloatPaise: z.number().int().nonnegative().optional(),
  cashWithdrawnPaise: z.number().int().nonnegative().optional(),
  closingCountedPaise: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  outletId: z.string().optional(),
});

// ─── Customer CRM & Directory Schemas ─────────────────────────────────────────

export const CUSTOMER_SEGMENTS = [
  'ALL',
  'VIP',
  'REGULAR',
  'NEW',
  'AT_RISK',
  'INACTIVE',
  'HIGH_SPEND',
  'VEG',
  'NON_VEG',
  'DELIVERY',
] as const;

export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const CreateCustomerSchema = z.object({
  phone: z.string().min(8).max(20),
  name: z.string().max(100).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  dob: z.string().max(20).nullable().optional(),
  anniversary: z.string().max(20).nullable().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(1000).nullable().optional(),
  dietaryPreference: z.enum(['VEG', 'NON_VEG', 'MIXED', 'UNKNOWN']).optional(),
  preferredChannel: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).nullable().optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export const BroadcastWhatsAppSchema = z.object({
  message: z.string().min(1).max(2000),
  segment: z.enum(CUSTOMER_SEGMENTS).optional(),
  phoneNumbers: z.array(z.string()).optional(),
  testOnly: z.boolean().optional(),
});


