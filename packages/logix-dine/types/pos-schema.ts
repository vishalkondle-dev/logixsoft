import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  restaurant,
  restaurantMember,
  memberOutletAccess,
  restaurantOutlet,
  posTable,
  menuCategory,
  menuItem,
  saleOrder,
  saleOrderItem,
} from '../schemas/pos-schema';

export type RestaurantRow = InferSelectModel<typeof restaurant>;
export type NewRestaurantRow = InferInsertModel<typeof restaurant>;
export type JsonRestaurantRow = Omit<RestaurantRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type RestaurantMemberRow = InferSelectModel<typeof restaurantMember>;
export type NewRestaurantMemberRow = InferInsertModel<typeof restaurantMember>;
export type JsonRestaurantMemberRow = Omit<RestaurantMemberRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type MemberOutletAccessRow = InferSelectModel<typeof memberOutletAccess>;
export type NewMemberOutletAccessRow = InferInsertModel<typeof memberOutletAccess>;
export type JsonMemberOutletAccessRow = Omit<MemberOutletAccessRow, 'createdAt'> & {
  createdAt: string;
};

export type RestaurantOutletRow = InferSelectModel<typeof restaurantOutlet>;
export type NewRestaurantOutletRow = InferInsertModel<typeof restaurantOutlet>;
export type JsonRestaurantOutletRow = Omit<RestaurantOutletRow, 'createdAt' | 'updatedAt'> & {
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
  'createdAt' | 'updatedAt' | 'kotPrintedAt' | 'readyAt' | 'settledAt'
> & {
  createdAt: string;
  updatedAt: string;
  kotPrintedAt: string | null;
  readyAt: string | null;
  settledAt: string | null;
};

export type SaleOrderItemRow = InferSelectModel<typeof saleOrderItem>;
export type NewSaleOrderItemRow = InferInsertModel<typeof saleOrderItem>;
export type JsonSaleOrderItemRow = Omit<SaleOrderItemRow, 'createdAt'> & {
  createdAt: string;
};

/** A sale order with its items — the primary response shape for billing routes. */
export type OrderWithItems = {
  order: JsonSaleOrderRow;
  items: JsonSaleOrderItemRow[];
};
