/**
 * Offline POS Billing & Resilience Engine for Logix Dine
 * Provides zero-internet offline order creation, offline sequence generation,
 * local catalog caching, and automated cloud synchronization when reconnected.
 */

import { createSettledOrder } from "./api-client";

export interface OfflineOrderItem {
  itemId: string;
  name: string;
  pricePaise: number;
  qty: number;
  note?: string;
  variant?: { id: string; name: string; pricePaise: number };
  addons?: Array<{ id: string; name: string; pricePaise: number }>;
  lineTotalPaise: number;
}

export interface QueuedOfflineOrder {
  id: string;
  offlineOrderNo: string;
  createdAt: string;
  restaurantId: string;
  outletId: string;
  tableNo: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  customerPhone?: string;
  delivery?: {
    customerName?: string;
    customerPhone: string;
    addressLine1: string;
    landmark?: string;
    pincode?: string;
    deliveryNotes?: string;
    riderId?: string;
  };
  method: string;
  items: OfflineOrderItem[];
  packagingChargePaise: number;
  deliveryChargePaise: number;
  adjustments: Array<{ id: string; label: string; value: string; amountPaise: number }>;
  subtotalPaise: number;
  totalPaise: number;
  synced: boolean;
  syncedAt?: string;
  serverOrderId?: string;
  syncError?: string;
}

export interface CachedPosCatalog {
  cachedAt: string;
  categories: any[];
  items: any[];
  tables: any[];
  taxSettings?: any;
  diningSettings?: any;
}

const OFFLINE_QUEUE_KEY = "logix_dine_pos_offline_orders_v1";
const OFFLINE_CATALOG_KEY_PREFIX = "logix_dine_pos_cached_catalog_";
const OFFLINE_SEQ_KEY_PREFIX = "logix_dine_pos_offline_seq_";

/**
 * Safely access localStorage (works in SSR without throwing).
 */
function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Caches POS catalog (categories, items, tables, taxes) locally for offline fallback.
 */
export function cachePosCatalog(
  restaurantId: string,
  outletId: string,
  data: {
    categories: any[];
    items: any[];
    tables: any[];
    taxSettings?: any;
    diningSettings?: any;
  }
): void {
  const storage = getStorage();
  if (!storage || !outletId) return;

  try {
    const payload: CachedPosCatalog = {
      cachedAt: new Date().toISOString(),
      categories: data.categories || [],
      items: data.items || [],
      tables: data.tables || [],
      taxSettings: data.taxSettings || null,
      diningSettings: data.diningSettings || null,
    };
    storage.setItem(`${OFFLINE_CATALOG_KEY_PREFIX}${restaurantId}_${outletId}`, JSON.stringify(payload));
  } catch (err) {
    console.warn("[offline-pos] Failed to cache catalog to localStorage:", err);
  }
}

/**
 * Retrieves the cached POS catalog if offline.
 */
export function getCachedPosCatalog(
  restaurantId: string,
  outletId: string
): CachedPosCatalog | null {
  const storage = getStorage();
  if (!storage || !outletId) return null;

  try {
    const raw = storage.getItem(`${OFFLINE_CATALOG_KEY_PREFIX}${restaurantId}_${outletId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[offline-pos] Failed to read cached catalog:", err);
    return null;
  }
}

/**
 * Generates the next sequential offline ticket identifier (e.g. OFF-101, OFF-102).
 */
export function getNextOfflineOrderNo(outletId: string): string {
  const storage = getStorage();
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seqKey = `${OFFLINE_SEQ_KEY_PREFIX}${outletId}_${dateKey}`;

  let current = 101;
  if (storage) {
    const stored = storage.getItem(seqKey);
    if (stored) {
      current = parseInt(stored, 10) + 1;
    }
    storage.setItem(seqKey, String(current));
  }

  return `OFF-${current}`;
}

/**
 * Loads all offline orders from localStorage.
 */
export function getQueuedOfflineOrders(outletId?: string): QueuedOfflineOrder[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const list: QueuedOfflineOrder[] = JSON.parse(raw);
    if (outletId) {
      return list.filter((o) => o.outletId === outletId);
    }
    return list;
  } catch (err) {
    console.warn("[offline-pos] Failed to read offline orders queue:", err);
    return [];
  }
}

/**
 * Loads pending (unsynced) offline orders.
 */
export function getPendingOfflineOrders(outletId?: string): QueuedOfflineOrder[] {
  return getQueuedOfflineOrders(outletId).filter((o) => !o.synced);
}

/**
 * Saves a new offline order into the queue.
 */
export function enqueueOfflineOrder(order: QueuedOfflineOrder): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const existing = getQueuedOfflineOrders();
    existing.push(order);
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error("[offline-pos] Failed to enqueue offline order:", err);
  }
}

/**
 * Removes an offline order from the queue by ID.
 */
export function removeOfflineOrder(orderId: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const existing = getQueuedOfflineOrders().filter((o) => o.id !== orderId);
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error("[offline-pos] Failed to remove offline order:", err);
  }
}

/**
 * Marks an offline order as synced and stores its server order ID.
 */
export function markOfflineOrderSynced(orderId: string, serverOrderId: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const existing = getQueuedOfflineOrders();
    const updated = existing.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          synced: true,
          syncedAt: new Date().toISOString(),
          serverOrderId,
          syncError: undefined,
        };
      }
      return o;
    });
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("[offline-pos] Failed to update offline order sync status:", err);
  }
}

/**
 * Marks an offline order as having failed sync with error message.
 */
export function markOfflineOrderSyncFailed(orderId: string, errorMsg: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const existing = getQueuedOfflineOrders();
    const updated = existing.map((o) => {
      if (o.id === orderId) {
        return { ...o, syncError: errorMsg };
      }
      return o;
    });
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("[offline-pos] Failed to mark offline order sync failed:", err);
  }
}

/**
 * Clears all successfully synced orders to free local storage.
 */
export function clearSyncedOfflineOrders(outletId?: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const existing = getQueuedOfflineOrders();
    const kept = existing.filter((o) => {
      if (outletId && o.outletId !== outletId) return true;
      return !o.synced;
    });
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(kept));
  } catch (err) {
    console.error("[offline-pos] Failed to clear synced offline orders:", err);
  }
}

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}

/**
 * Synchronizes pending offline orders to the cloud backend.
 */
export async function syncOfflineOrders(
  restaurantId: string,
  outletId: string,
  onProgress?: (synced: number, total: number) => void
): Promise<SyncResult> {
  const pending = getPendingOfflineOrders(outletId);
  const result: SyncResult = {
    total: pending.length,
    synced: 0,
    failed: 0,
    errors: [],
  };

  if (pending.length === 0) {
    return result;
  }

  for (let i = 0; i < pending.length; i++) {
    const order = pending[i];
    try {
      const serverResult = await createSettledOrder(restaurantId, {
        outletId: order.outletId,
        tableNo: order.tableNo,
        customerPhone: order.customerPhone,
        orderType: order.orderType,
        note: `[Offline Order #${order.offlineOrderNo} created ${new Date(order.createdAt).toLocaleTimeString("en-IN")}]`,
        packagingChargePaise: order.packagingChargePaise,
        deliveryChargePaise: order.deliveryChargePaise,
        adjustments: order.adjustments,
        delivery: order.delivery,
        method: order.method,
        items: order.items.map((i) => ({
          itemId: i.itemId,
          qty: i.qty,
          note: i.note,
          variantId: i.variant?.id,
          addonIds: i.addons?.map((a) => a.id),
        })),
      });

      const serverOrderId = serverResult?.order?.id || serverResult?.id || `synced_${Date.now()}`;
      markOfflineOrderSynced(order.id, serverOrderId);
      result.synced += 1;

      if (onProgress) {
        onProgress(result.synced, result.total);
      }
    } catch (err: any) {
      console.error(`[offline-pos] Sync failed for order #${order.offlineOrderNo}:`, err);
      const errMsg = err?.message || "Sync failed";
      markOfflineOrderSyncFailed(order.id, errMsg);
      result.failed += 1;
      result.errors.push(`Order #${order.offlineOrderNo}: ${errMsg}`);
    }
  }

  // After syncing successfully, prune synced records older than 1 hour
  clearSyncedOfflineOrders(outletId);

  return result;
}
