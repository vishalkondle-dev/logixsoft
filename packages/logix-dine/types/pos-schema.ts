import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  restaurant,
  outletStaff,
  restaurantMember,
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
  restaurantExpense,
  cashRegisterLog,
} from '../schemas/pos-schema';

export const ORDER_ITEM_STATUSES = [
  'ORDERED',
  'PREPARING',
  'PREPARED',
  'SERVED',
  'CANCELLED',
] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const ORDER_STATUSES = [
  'ORDERED',
  'PREPARING',
  'PREPARED',
  'SERVED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function computeOrderStatus(itemStatuses: (string | null | undefined)[]): OrderStatus {
  if (!itemStatuses || itemStatuses.length === 0) return 'ORDERED';

  const statuses = itemStatuses.map((s) => (s ? s.toUpperCase() : 'ORDERED'));

  const allCancelled = statuses.every((s) => s === 'CANCELLED');
  if (allCancelled) return 'CANCELLED';

  const active = statuses.filter((s) => s !== 'CANCELLED');
  if (active.length === 0) return 'CANCELLED';

  const allServed = active.every((s) => s === 'SERVED');
  if (allServed) return 'SERVED';

  const allPreparedOrServed = active.every((s) => s === 'PREPARED' || s === 'SERVED');
  if (allPreparedOrServed) return 'PREPARED';

  const anyPreparing = active.some((s) => s === 'PREPARING');
  if (anyPreparing) return 'PREPARING';

  const anyPreparedOrServed = active.some((s) => s === 'PREPARED' || s === 'SERVED');
  if (anyPreparedOrServed) return 'PREPARED';

  return 'ORDERED';
}

export function getNextItemStatus(currentStatus: string | null | undefined): OrderItemStatus | null {
  const upper = currentStatus ? currentStatus.toUpperCase() : 'ORDERED';
  switch (upper) {
    case 'ORDERED':
      return 'PREPARING';
    case 'PREPARING':
      return 'PREPARED';
    case 'PREPARED':
      return 'SERVED';
    default:
      return null;
  }
}

export type RestaurantRow = InferSelectModel<typeof restaurant>;
export type NewRestaurantRow = InferInsertModel<typeof restaurant>;
export type JsonRestaurantRow = Omit<RestaurantRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type OutletStaffRow = InferSelectModel<typeof outletStaff>;
export type NewOutletStaffRow = InferInsertModel<typeof outletStaff>;
export type JsonOutletStaffRow = Omit<OutletStaffRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

// Aliases for backward compatibility during refactor
export type RestaurantMemberRow = OutletStaffRow;
export type NewRestaurantMemberRow = NewOutletStaffRow;
export type JsonRestaurantMemberRow = JsonOutletStaffRow;
export type MemberOutletAccessRow = any;
export type NewMemberOutletAccessRow = any;
export type JsonMemberOutletAccessRow = any;

export type RestaurantOutletRow = InferSelectModel<typeof restaurantOutlet>;
export type NewRestaurantOutletRow = InferInsertModel<typeof restaurantOutlet>;
export type JsonRestaurantOutletRow = Omit<RestaurantOutletRow, 'createdAt' | 'updatedAt' | 'trialEndsAt' | 'subscriptionExpiresAt' | 'autopayNextBillingAt'> & {
  trialEndsAt?: string | null;
  subscriptionExpiresAt?: string | null;
  autopayNextBillingAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PosTableRow = InferSelectModel<typeof posTable>;
export type NewPosTableRow = InferInsertModel<typeof posTable>;
export type JsonPosTableRow = Omit<PosTableRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type MenuCategoryRow = InferSelectModel<typeof menuCategory>;
export type NewMenuCategoryRow = InferInsertModel<typeof menuCategory>;
export type JsonMenuCategoryRow = Omit<MenuCategoryRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type { MenuItemVariant, MenuItemAddon, OrderAdjustment } from '../schemas/pos-schema';

export type MenuItemRow = InferSelectModel<typeof menuItem>;
export type NewMenuItemRow = InferInsertModel<typeof menuItem>;
export type JsonMenuItemRow = Omit<MenuItemRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type SaleOrderRow = InferSelectModel<typeof saleOrder>;
export type NewSaleOrderRow = InferInsertModel<typeof saleOrder>;
export type JsonSaleOrderRow = Omit<
  SaleOrderRow,
  'createdAt' | 'updatedAt' | 'kotPrintedAt' | 'readyAt' | 'settledAt' | 'tableFreedAt'
> & {
  createdAt: string;
  updatedAt: string;
  kotPrintedAt: string | null;
  readyAt: string | null;
  settledAt: string | null;
  tableFreedAt: string | null;
};

export type SaleOrderItemRow = InferSelectModel<typeof saleOrderItem>;
export type NewSaleOrderItemRow = InferInsertModel<typeof saleOrderItem>;
export type OrderItemAuditRow = InferSelectModel<typeof orderItemAudit>;
export type NewOrderItemAuditRow = InferInsertModel<typeof orderItemAudit>;
export type JsonOrderItemAuditRow = Omit<OrderItemAuditRow, 'createdAt'> & {
  createdAt: string;
};

export type JsonSaleOrderItemRow = Omit<SaleOrderItemRow, 'createdAt' | 'updatedAt' | 'settledAt'> & {
  createdAt: string;
  updatedAt: string;
  settledAt: string | null;
};

/** A sale order with its items — the primary response shape for billing routes. */
export type OrderWithItems = {
  order: JsonSaleOrderRow;
  items: JsonSaleOrderItemRow[];
  delivery?: JsonDeliveryOrderRow | null;
};

export type WaiterRequestRow = InferSelectModel<typeof waiterRequest>;
export type NewWaiterRequestRow = InferInsertModel<typeof waiterRequest>;
export type JsonWaiterRequestRow = Omit<WaiterRequestRow, 'createdAt' | 'updatedAt' | 'completedAt'> & {
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type DeliveryOrderRow = InferSelectModel<typeof deliveryOrder>;
export type NewDeliveryOrderRow = InferInsertModel<typeof deliveryOrder>;
export type JsonDeliveryOrderRow = Omit<
  DeliveryOrderRow,
  'createdAt' | 'updatedAt' | 'assignedAt' | 'pickedUpAt' | 'deliveredAt'
> & {
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
};

export type CustomerAddressRow = InferSelectModel<typeof customerAddress>;
export type NewCustomerAddressRow = InferInsertModel<typeof customerAddress>;
export type JsonCustomerAddressRow = Omit<CustomerAddressRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type DeliveryRiderRow = InferSelectModel<typeof deliveryRider>;
export type NewDeliveryRiderRow = InferInsertModel<typeof deliveryRider>;
export type JsonDeliveryRiderRow = Omit<DeliveryRiderRow, 'createdAt' | 'updatedAt' | 'lastLocationAt'> & {
  createdAt: string;
  updatedAt: string;
  lastLocationAt: string | null;
};

export type TableReservationRow = InferSelectModel<typeof tableReservation>;
export type NewTableReservationRow = InferInsertModel<typeof tableReservation>;
export type JsonTableReservationRow = Omit<TableReservationRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type InventorySupplierRow = InferSelectModel<typeof inventorySupplier>;
export type NewInventorySupplierRow = InferInsertModel<typeof inventorySupplier>;
export type JsonInventorySupplierRow = Omit<InventorySupplierRow, 'createdAt'> & {
  createdAt: string;
};

export type InventoryItemRow = InferSelectModel<typeof inventoryItem>;
export type NewInventoryItemRow = InferInsertModel<typeof inventoryItem>;
export type JsonInventoryItemRow = Omit<InventoryItemRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type MenuItemRecipeRow = InferSelectModel<typeof menuItemRecipe>;
export type NewMenuItemRecipeRow = InferInsertModel<typeof menuItemRecipe>;
export type JsonMenuItemRecipeRow = Omit<MenuItemRecipeRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type InventoryTransactionRow = InferSelectModel<typeof inventoryTransaction>;
export type NewInventoryTransactionRow = InferInsertModel<typeof inventoryTransaction>;
export type JsonInventoryTransactionRow = Omit<InventoryTransactionRow, 'createdAt'> & {
  createdAt: string;
};

export type PurchaseOrderRow = InferSelectModel<typeof purchaseOrder>;
export type NewPurchaseOrderRow = InferInsertModel<typeof purchaseOrder>;
export type JsonPurchaseOrderRow = Omit<PurchaseOrderRow, 'createdAt' | 'receivedAt'> & {
  createdAt: string;
  receivedAt: string | null;
};

export type PurchaseOrderItemRow = InferSelectModel<typeof purchaseOrderItem>;
export type NewPurchaseOrderItemRow = InferInsertModel<typeof purchaseOrderItem>;
export type JsonPurchaseOrderItemRow = Omit<PurchaseOrderItemRow, 'createdAt'> & {
  createdAt: string;
};

export type OrderFeedbackRow = InferSelectModel<typeof orderFeedback>;
export type NewOrderFeedbackRow = InferInsertModel<typeof orderFeedback>;
export type JsonOrderFeedbackRow = Omit<OrderFeedbackRow, 'createdAt' | 'updatedAt' | 'ownerRepliedAt'> & {
  createdAt: string;
  updatedAt: string;
  ownerRepliedAt: string | null;
};

export type OrderItemFeedbackRow = InferSelectModel<typeof orderItemFeedback>;
export type NewOrderItemFeedbackRow = InferInsertModel<typeof orderItemFeedback>;
export type JsonOrderItemFeedbackRow = Omit<OrderItemFeedbackRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type RestaurantExpenseRow = InferSelectModel<typeof restaurantExpense>;
export type NewRestaurantExpenseRow = InferInsertModel<typeof restaurantExpense>;
export type JsonRestaurantExpenseRow = Omit<RestaurantExpenseRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type CashRegisterLogRow = InferSelectModel<typeof cashRegisterLog>;
export type NewCashRegisterLogRow = InferInsertModel<typeof cashRegisterLog>;
export type JsonCashRegisterLogRow = Omit<CashRegisterLogRow, 'createdAt' | 'updatedAt' | 'closedAt'> & {
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};


