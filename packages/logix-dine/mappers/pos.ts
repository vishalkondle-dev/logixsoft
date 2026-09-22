import type {
  RestaurantRow,
  RestaurantMemberRow,
  MemberOutletAccessRow,
  RestaurantOutletRow,
  PosTableRow,
  MenuCategoryRow,
  MenuItemRow,
  SaleOrderRow,
  SaleOrderItemRow,
  JsonRestaurantRow,
  JsonRestaurantMemberRow,
  JsonMemberOutletAccessRow,
  JsonRestaurantOutletRow,
  JsonPosTableRow,
  JsonMenuCategoryRow,
  JsonMenuItemRow,
  JsonSaleOrderRow,
  JsonSaleOrderItemRow,
  OrderWithItems,
  DeliveryOrderRow,
  JsonDeliveryOrderRow,
  CustomerAddressRow,
  JsonCustomerAddressRow,
  DeliveryRiderRow,
  JsonDeliveryRiderRow,
} from '../types/pos-schema';

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function toIsoRequired(d: Date): string {
  return d.toISOString();
}

export function toRestaurant(r: RestaurantRow): JsonRestaurantRow {
  return {
    ...r,
    createdAt: toIsoRequired(r.createdAt),
    updatedAt: toIsoRequired(r.updatedAt),
  };
}

export function toRestaurantMember(m: RestaurantMemberRow): JsonRestaurantMemberRow {
  return {
    ...m,
    createdAt: toIsoRequired(m.createdAt),
    updatedAt: toIsoRequired(m.updatedAt),
  };
}

export function toMemberOutletAccess(a: MemberOutletAccessRow): JsonMemberOutletAccessRow {
  return {
    ...a,
    createdAt: toIsoRequired(a.createdAt),
  };
}

export function toOutlet(o: RestaurantOutletRow): JsonRestaurantOutletRow {
  return {
    ...o,
    createdAt: toIsoRequired(o.createdAt),
    updatedAt: toIsoRequired(o.updatedAt),
  };
}

export function toPosTable(t: PosTableRow): JsonPosTableRow {
  return {
    ...t,
    createdAt: toIsoRequired(t.createdAt),
    updatedAt: toIsoRequired(t.updatedAt),
  };
}

export function toCategory(c: MenuCategoryRow): JsonMenuCategoryRow {
  return {
    ...c,
    createdAt: toIsoRequired(c.createdAt),
    updatedAt: toIsoRequired(c.updatedAt),
  };
}

export function toMenuItem(i: MenuItemRow): JsonMenuItemRow {
  return {
    ...i,
    imageUrl: i.imageUrl ?? null,
    variants: (i.variants as any) ?? [],
    addons: (i.addons as any) ?? [],
    createdAt: toIsoRequired(i.createdAt),
    updatedAt: toIsoRequired(i.updatedAt),
  };
}

export function toOrder(o: SaleOrderRow): JsonSaleOrderRow {
  return {
    ...o,
    kotPrintedAt: toIso(o.kotPrintedAt),
    readyAt: toIso(o.readyAt),
    settledAt: toIso(o.settledAt),
    tableFreedAt: toIso(o.tableFreedAt),
    createdAt: toIsoRequired(o.createdAt),
    updatedAt: toIsoRequired(o.updatedAt),
  };
}

export function toOrderItem(i: SaleOrderItemRow): JsonSaleOrderItemRow {
  return {
    ...i,
    variant: (i.variant as any) ?? null,
    addons: (i.addons as any) ?? [],
    status: (i.status as any) || 'ORDERED',
    settledAt: toIso(i.settledAt),
    createdAt: toIsoRequired(i.createdAt),
    updatedAt: toIsoRequired(i.updatedAt),
  };
}

export function toDeliveryOrder(d: DeliveryOrderRow): JsonDeliveryOrderRow {
  return {
    ...d,
    assignedAt: toIso(d.assignedAt),
    pickedUpAt: toIso(d.pickedUpAt),
    deliveredAt: toIso(d.deliveredAt),
    createdAt: toIsoRequired(d.createdAt),
    updatedAt: toIsoRequired(d.updatedAt),
  };
}

export function toCustomerAddress(a: CustomerAddressRow): JsonCustomerAddressRow {
  return {
    ...a,
    createdAt: toIsoRequired(a.createdAt),
    updatedAt: toIsoRequired(a.updatedAt),
  };
}

export function toDeliveryRider(r: DeliveryRiderRow): JsonDeliveryRiderRow {
  return {
    ...r,
    lastLocationAt: toIso(r.lastLocationAt),
    createdAt: toIsoRequired(r.createdAt),
    updatedAt: toIsoRequired(r.updatedAt),
  };
}

export function toOrderWithItems(
  order: SaleOrderRow,
  items: SaleOrderItemRow[],
  delivery?: DeliveryOrderRow | null,
): OrderWithItems {
  return {
    order: toOrder(order),
    items: items.map(toOrderItem),
    delivery: delivery ? toDeliveryOrder(delivery) : null,
  };
}
