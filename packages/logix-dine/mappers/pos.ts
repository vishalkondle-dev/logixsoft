import type {
  RestaurantRow,
  RestaurantMemberRow,
  RestaurantOutletRow,
  MenuCategoryRow,
  MenuItemRow,
  SaleOrderRow,
  SaleOrderItemRow,
  JsonRestaurantRow,
  JsonRestaurantMemberRow,
  JsonRestaurantOutletRow,
  JsonMenuCategoryRow,
  JsonMenuItemRow,
  JsonSaleOrderRow,
  JsonSaleOrderItemRow,
  OrderWithItems,
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
  };
}

export function toOutlet(o: RestaurantOutletRow): JsonRestaurantOutletRow {
  return {
    ...o,
    createdAt: toIsoRequired(o.createdAt),
    updatedAt: toIsoRequired(o.updatedAt),
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
    createdAt: toIsoRequired(i.createdAt),
    updatedAt: toIsoRequired(i.updatedAt),
  };
}

export function toOrder(o: SaleOrderRow): JsonSaleOrderRow {
  return {
    ...o,
    kotPrintedAt: toIso(o.kotPrintedAt),
    settledAt: toIso(o.settledAt),
    createdAt: toIsoRequired(o.createdAt),
    updatedAt: toIsoRequired(o.updatedAt),
  };
}

export function toOrderItem(i: SaleOrderItemRow): JsonSaleOrderItemRow {
  return {
    ...i,
    createdAt: toIsoRequired(i.createdAt),
  };
}

export function toOrderWithItems(
  order: SaleOrderRow,
  items: SaleOrderItemRow[],
): OrderWithItems {
  return {
    order: toOrder(order),
    items: items.map(toOrderItem),
  };
}
