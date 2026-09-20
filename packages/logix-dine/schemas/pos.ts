import * as z from 'zod';
import { Expect } from '../types/utils';
import { AssertSame } from '../types/utils';
import type {
  JsonRestaurantRow,
  JsonRestaurantMemberRow,
  JsonMemberOutletAccessRow,
  JsonRestaurantOutletRow,
  JsonPosTableRow,
  JsonMenuCategoryRow,
  JsonMenuItemRow,
  JsonSaleOrderRow,
  JsonSaleOrderItemRow,
  JsonOrderItemAuditRow,
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
  ownerUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _RestaurantAssert = Expect<AssertSame<z.infer<typeof RestaurantSchema>, JsonRestaurantRow>>;

export const RestaurantMemberSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  userId: z.string().nullable(),
  phone: z.string(),
  role: z.string(),
  inviteStatus: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _MemberAssert = Expect<AssertSame<z.infer<typeof RestaurantMemberSchema>, JsonRestaurantMemberRow>>;

export const MemberOutletAccessSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  outletId: z.string(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
});
type _MemberOutletAccessAssert = Expect<AssertSame<z.infer<typeof MemberOutletAccessSchema>, JsonMemberOutletAccessRow>>;

export const RestaurantOutletSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  upiId: z.string().nullable(),
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
  pricePaise: z.number().int(),
  available: z.boolean(),
  sortOrder: z.number().int(),
  variants: z.array(MenuItemVariantSchema),
  addons: z.array(MenuItemAddonSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
type _ItemAssert = Expect<AssertSame<z.infer<typeof MenuItemSchema>, JsonMenuItemRow>>;

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
});

export const UpdateOutletSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(255).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  upiId: z.string().max(100).nullable().optional(),
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
  pricePaise: MoneySchema,
  sortOrder: z.number().int().nonnegative().optional().default(0),
  variants: z.array(MenuItemVariantSchema).optional().default([]),
  addons: z.array(MenuItemAddonSchema).optional().default([]),
});

export const UpdateItemSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(255).nullable().optional(),
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

export const StartOrderSchema = z.object({
  outletId: z.string(),
  tableNo: z.string().max(50).optional(),
  customerPhone: z.string().max(25).optional(),
  note: z.string().max(255).optional(),
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
});
