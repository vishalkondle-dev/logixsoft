import { z } from 'zod';
import type { ChannelCode } from './channels';

export const NormalizedOrderStatusSchema = z.enum([
  'ORDER_PLACED',
  'ORDER_ACKNOWLEDGED',
  'ORDER_ACCEPTED',
  'FOOD_PREPARING',
  'FOOD_READY',
  'RIDER_ASSIGNED',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
]);
export type NormalizedOrderStatus = z.infer<typeof NormalizedOrderStatusSchema>;

export const CancellationReasonCodeSchema = z.enum([
  'ITEM_OUT_OF_STOCK',
  'KITCHEN_OVERLOADED',
  'STORE_CLOSING_SOON',
  'STORE_OFFLINE',
  'CUSTOMER_REQUESTED',
  'RIDER_NOT_FOUND',
  'INVALID_ADDRESS',
  'PAYMENT_FAILED',
  'FORCE_MAJEURE',
  'PRICE_MISMATCH',
  'OTHER',
]);
export type CancellationReasonCode = z.infer<typeof CancellationReasonCodeSchema>;

/**
 * Valid order state transitions graph.
 */
export const VALID_ORDER_TRANSITIONS: Record<NormalizedOrderStatus, NormalizedOrderStatus[]> = {
  ORDER_PLACED: ['ORDER_ACKNOWLEDGED', 'ORDER_ACCEPTED', 'CANCELLED'],
  ORDER_ACKNOWLEDGED: ['ORDER_ACCEPTED', 'CANCELLED'],
  ORDER_ACCEPTED: ['FOOD_PREPARING', 'FOOD_READY', 'CANCELLED'],
  FOOD_PREPARING: ['FOOD_READY', 'CANCELLED'],
  FOOD_READY: ['RIDER_ASSIGNED', 'DISPATCHED', 'CANCELLED'],
  RIDER_ASSIGNED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Checks whether transitioning from current status to next status is permitted.
 */
export function isValidStatusTransition(
  current: NormalizedOrderStatus,
  next: NormalizedOrderStatus
): boolean {
  if (current === next) return true;
  const allowed = VALID_ORDER_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

// ─── Swiggy Status Mappings ───────────────────────────────────────────────────

export function mapSwiggyStatusToCanonical(swiggyStatus: string): NormalizedOrderStatus {
  const norm = swiggyStatus.toUpperCase().replace(/\s+/g, '_');
  switch (norm) {
    case 'ORDER_CREATED':
    case 'ORDER_PLACED':
    case 'PLACED':
      return 'ORDER_PLACED';
    case 'ACKNOWLEDGED':
      return 'ORDER_ACKNOWLEDGED';
    case 'CONFIRMED':
    case 'ORDER_CONFIRMED':
    case 'ACCEPTED':
      return 'ORDER_ACCEPTED';
    case 'PREPARING':
    case 'FOOD_PREPARING':
      return 'FOOD_PREPARING';
    case 'FOOD_READY':
    case 'READY':
      return 'FOOD_READY';
    case 'DELIVERY_BOY_ASSIGNED':
    case 'RIDER_ASSIGNED':
    case 'ASSIGNED':
      return 'RIDER_ASSIGNED';
    case 'PICKED_UP':
    case 'DISPATCHED':
    case 'OUT_FOR_DELIVERY':
      return 'DISPATCHED';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'DELIVERED';
    case 'CANCELLED':
    case 'REJECTED':
      return 'CANCELLED';
    default:
      return 'ORDER_PLACED';
  }
}

export function mapCanonicalToSwiggyStatus(status: NormalizedOrderStatus): string {
  switch (status) {
    case 'ORDER_PLACED':
      return 'ORDER_CREATED';
    case 'ORDER_ACKNOWLEDGED':
      return 'ACKNOWLEDGED';
    case 'ORDER_ACCEPTED':
      return 'CONFIRMED';
    case 'FOOD_PREPARING':
      return 'PREPARING';
    case 'FOOD_READY':
      return 'FOOD_READY';
    case 'RIDER_ASSIGNED':
      return 'DELIVERY_BOY_ASSIGNED';
    case 'DISPATCHED':
      return 'PICKED_UP';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'ORDER_CREATED';
  }
}

// ─── Zomato Status Mappings ───────────────────────────────────────────────────

export function mapZomatoStatusToCanonical(zomatoStatus: string): NormalizedOrderStatus {
  const norm = zomatoStatus.toLowerCase().trim();
  switch (norm) {
    case 'placed':
    case 'order_placed':
    case 'new':
      return 'ORDER_PLACED';
    case 'acknowledged':
      return 'ORDER_ACKNOWLEDGED';
    case 'accepted':
    case 'confirmed':
      return 'ORDER_ACCEPTED';
    case 'food_preparing':
    case 'cooking':
      return 'FOOD_PREPARING';
    case 'food_prepared':
    case 'ready':
    case 'food_ready':
      return 'FOOD_READY';
    case 'rider_assigned':
    case 'rider_at_store':
      return 'RIDER_ASSIGNED';
    case 'dispatched':
    case 'picked_up':
    case 'out_for_delivery':
      return 'DISPATCHED';
    case 'delivered':
      return 'DELIVERED';
    case 'cancelled':
    case 'rejected':
      return 'CANCELLED';
    default:
      return 'ORDER_PLACED';
  }
}

export function mapCanonicalToZomatoStatus(status: NormalizedOrderStatus): string {
  switch (status) {
    case 'ORDER_PLACED':
      return 'placed';
    case 'ORDER_ACKNOWLEDGED':
      return 'acknowledged';
    case 'ORDER_ACCEPTED':
      return 'accepted';
    case 'FOOD_PREPARING':
      return 'food_preparing';
    case 'FOOD_READY':
      return 'food_prepared';
    case 'RIDER_ASSIGNED':
      return 'rider_assigned';
    case 'DISPATCHED':
      return 'dispatched';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'placed';
  }
}

// ─── ONDC Beckn Status Mappings ───────────────────────────────────────────────

export function mapBecknStatusToCanonical(becknStatus: string): NormalizedOrderStatus {
  const norm = becknStatus.trim();
  switch (norm) {
    case 'Created':
      return 'ORDER_PLACED';
    case 'Accepted':
      return 'ORDER_ACCEPTED';
    case 'In-Progress':
      return 'FOOD_PREPARING';
    case 'Prepared':
      return 'FOOD_READY';
    case 'Rider-Assigned':
      return 'RIDER_ASSIGNED';
    case 'Order-picked-up':
      return 'DISPATCHED';
    case 'Completed':
      return 'DELIVERED';
    case 'Cancelled':
      return 'CANCELLED';
    default:
      return 'ORDER_PLACED';
  }
}

export function mapCanonicalToBecknStatus(status: NormalizedOrderStatus): string {
  switch (status) {
    case 'ORDER_PLACED':
    case 'ORDER_ACKNOWLEDGED':
      return 'Created';
    case 'ORDER_ACCEPTED':
      return 'Accepted';
    case 'FOOD_PREPARING':
      return 'In-Progress';
    case 'FOOD_READY':
      return 'Prepared';
    case 'RIDER_ASSIGNED':
      return 'In-Progress';
    case 'DISPATCHED':
      return 'Order-picked-up';
    case 'DELIVERED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Created';
  }
}

// ─── Magicpin Status Mappings ─────────────────────────────────────────────────

export function mapMagicpinStatusToCanonical(magicpinStatus: string): NormalizedOrderStatus {
  const norm = magicpinStatus.toUpperCase().replace(/\s+/g, '_');
  switch (norm) {
    case 'PENDING':
    case 'NEW':
      return 'ORDER_PLACED';
    case 'ACK':
      return 'ORDER_ACKNOWLEDGED';
    case 'CONFIRMED':
    case 'ACCEPTED':
      return 'ORDER_ACCEPTED';
    case 'PREPARING':
      return 'FOOD_PREPARING';
    case 'READY':
      return 'FOOD_READY';
    case 'RIDER_ASSIGNED':
      return 'RIDER_ASSIGNED';
    case 'DISPATCHED':
      return 'DISPATCHED';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'ORDER_PLACED';
  }
}

export function mapCanonicalToMagicpinStatus(status: NormalizedOrderStatus): string {
  switch (status) {
    case 'ORDER_PLACED':
      return 'PENDING';
    case 'ORDER_ACKNOWLEDGED':
      return 'ACK';
    case 'ORDER_ACCEPTED':
      return 'CONFIRMED';
    case 'FOOD_PREPARING':
      return 'PREPARING';
    case 'FOOD_READY':
      return 'READY';
    case 'RIDER_ASSIGNED':
      return 'RIDER_ASSIGNED';
    case 'DISPATCHED':
      return 'DISPATCHED';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

// ─── Direct Channels (Ownly / Toing) Mappings ────────────────────────────────

export function mapDirectStatusToCanonical(status: string): NormalizedOrderStatus {
  const upper = status.toUpperCase().replace(/-/g, '_');
  if (upper in VALID_ORDER_TRANSITIONS) {
    return upper as NormalizedOrderStatus;
  }
  switch (upper) {
    case 'PLACED':
    case 'NEW':
      return 'ORDER_PLACED';
    case 'CONFIRMED':
      return 'ORDER_ACCEPTED';
    case 'COOKING':
      return 'FOOD_PREPARING';
    case 'READY':
      return 'FOOD_READY';
    case 'PICKED':
      return 'DISPATCHED';
    case 'COMPLETE':
    case 'DONE':
      return 'DELIVERED';
    case 'CANCELED':
      return 'CANCELLED';
    default:
      return 'ORDER_PLACED';
  }
}
