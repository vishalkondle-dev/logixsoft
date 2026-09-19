import React from "react";
import {
  IconClock,
  IconToolsKitchen2,
  IconCheck,
  IconCircleCheck,
  IconBan,
} from "@tabler/icons-react";
import {
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  computeOrderStatus,
  getNextItemStatus,
  type OrderItemStatus,
  type OrderStatus,
} from "@logixsoft/logix-dine";

export { computeOrderStatus, getNextItemStatus, ORDER_ITEM_STATUSES, ORDER_STATUSES };
export type { OrderItemStatus, OrderStatus };

export interface StatusVisual {
  color: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; color?: string; style?: React.CSSProperties }>;
}

export const ORDER_ITEM_STATUS_CONFIG: Record<string, StatusVisual> = {
  ORDERED: { color: "blue", label: "Ordered", icon: IconClock },
  PREPARING: { color: "orange", label: "Preparing", icon: IconToolsKitchen2 },
  PREPARED: { color: "teal", label: "Prepared", icon: IconCheck },
  SERVED: { color: "green", label: "Served", icon: IconCircleCheck },
  CANCELLED: { color: "red", label: "Cancelled", icon: IconBan },
};

export const ORDER_STATUS_CONFIG: Record<string, StatusVisual> = {
  ORDERED: { color: "blue", label: "Ordered", icon: IconClock },
  PREPARING: { color: "orange", label: "Preparing", icon: IconToolsKitchen2 },
  PREPARED: { color: "teal", label: "Prepared", icon: IconCheck },
  SERVED: { color: "green", label: "Served", icon: IconCircleCheck },
  CANCELLED: { color: "red", label: "Cancelled", icon: IconBan },
};

export const PAYMENT_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  OPEN: { color: "blue", label: "Unpaid" },
  PAID: { color: "green", label: "Paid" },
  VOID: { color: "gray", label: "Void" },
};

export function getStatusVisual(status: string | null | undefined): StatusVisual {
  const upper = (status || "ORDERED").toUpperCase();
  return ORDER_ITEM_STATUS_CONFIG[upper] || { color: "gray", label: status || "Unknown", icon: IconClock };
}
