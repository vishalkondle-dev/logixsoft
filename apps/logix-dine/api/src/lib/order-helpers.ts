import { eq, and, sql, or, asc, inArray } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { computeOrderStatus } from '@logixsoft/logix-dine/types/pos-schema';
import { toOrderWithItems } from '@logixsoft/logix-dine/mappers/pos';

export function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

let lastOrderTime = 0;
export function generateOrderId(outletId: string): string {
  let now = Date.now();
  if (now <= lastOrderTime) {
    now = lastOrderTime + 1;
  }
  lastOrderTime = now;
  return `${outletId}-${now}`;
}

/**
 * Computes the next daily token number for a given outlet.
 * Resets to 1 each day (IST / Asia/Kolkata date boundary).
 * Must be executed within a transaction where the outlet row is locked FOR UPDATE.
 */
export async function getNextDailyTokenNo(tx: any, outletId: string): Promise<number> {
  const [maxRow] = await tx
    .select({ maxNo: sql<number>`COALESCE(MAX("orderNo"), 0)` })
    .from(appSchema.saleOrder)
    .where(
      and(
        eq(appSchema.saleOrder.outletId, outletId),
        sql`("createdAt" AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date`
      )
    );
  return Number(maxRow?.maxNo ?? 0) + 1;
}

export function getTodayISTDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function getPhoneVariants(input: string): { rawDigits: string; variants: string[] } {
  const cleaned = (input || '').trim();
  const digits = cleaned.replace(/\D/g, '');
  const last10 = digits.slice(-10);

  const variants = new Set<string>();
  if (digits) variants.add(digits);
  if (cleaned) variants.add(cleaned);
  if (last10.length === 10) {
    variants.add(last10);
    variants.add(`91${last10}`);
    variants.add(`+91${last10}`);
    variants.add(`0${last10}`);
  }
  return { rawDigits: last10 || digits, variants: Array.from(variants) };
}

export function resolveOrderItemDetails(
  menuItem: any,
  itemInput: { variantId?: string; addonIds?: string[] }
) {
  const variants: any[] = menuItem.variants || [];
  const allAddons: any[] = menuItem.addons || [];

  let selectedVariant: any = null;
  if (itemInput.variantId) {
    selectedVariant = variants.find((v: any) => v.id === itemInput.variantId) || null;
  }
  if (!selectedVariant && variants.length > 0) {
    selectedVariant = variants[0];
  }

  const selectedAddons = (itemInput.addonIds || [])
    .map((aid) => allAddons.find((a: any) => a.id === aid))
    .filter(Boolean)
    .map((a: any) => ({
      id: a.id,
      name: a.name,
      pricePaise: a.pricePaise,
    }));

  const basePrice = selectedVariant ? selectedVariant.pricePaise : menuItem.pricePaise;
  const addonsTotal = selectedAddons.reduce((sum: number, a: any) => sum + (a.pricePaise || 0), 0);
  const unitPrice = basePrice + addonsTotal;

  const variantSnapshot = selectedVariant
    ? { id: selectedVariant.id, name: selectedVariant.name, pricePaise: selectedVariant.pricePaise }
    : null;

  let nameSnapshot = menuItem.name;
  if (selectedVariant) {
    nameSnapshot = `${menuItem.name} (${selectedVariant.name})`;
  }

  return {
    nameSnapshot,
    pricePaiseSnapshot: unitPrice,
    variant: variantSnapshot,
    addons: selectedAddons,
  };
}

export async function recomputeTotal(db: any, orderId: string) {
  const items = await db
    .select()
    .from(appSchema.saleOrderItem)
    .where(eq(appSchema.saleOrderItem.orderId, orderId));
  const activeItems = items.filter((item: any) => item.status !== 'CANCELLED');
  const itemsTotal = activeItems.reduce((sum: number, item: any) => sum + item.pricePaiseSnapshot * item.qty, 0);
  const paidItemsTotal = activeItems
    .filter((item: any) => item.paymentStatus === 'PAID')
    .reduce((sum: number, item: any) => sum + item.pricePaiseSnapshot * item.qty, 0);
  const orderStatus = computeOrderStatus(items.map((i: any) => i.status));

  const [existingOrder] = await db
    .select({
      status: appSchema.saleOrder.status,
      packagingChargePaise: appSchema.saleOrder.packagingChargePaise,
      deliveryChargePaise: appSchema.saleOrder.deliveryChargePaise,
    })
    .from(appSchema.saleOrder)
    .where(eq(appSchema.saleOrder.id, orderId));

  const pkgPaise = existingOrder?.packagingChargePaise || 0;
  const delPaise = existingOrder?.deliveryChargePaise || 0;
  const total = itemsTotal + pkgPaise + delPaise;

  const allActiveItemsPaid = activeItems.length > 0 && activeItems.every((item: any) => item.paymentStatus === 'PAID');
  const paidTotal = allActiveItemsPaid ? total : paidItemsTotal;

  let status = existingOrder?.status;
  if (status !== 'VOID') {
    if (allActiveItemsPaid && total > 0) status = 'PAID';
    else if (paidTotal > 0) status = 'PARTIAL';
    else status = 'OPEN';
  }

  await db
    .update(appSchema.saleOrder)
    .set({ subtotalPaise: total, paidPaise: paidTotal, status, orderStatus, updatedAt: new Date() })
    .where(eq(appSchema.saleOrder.id, orderId));
  return { items, total, paidTotal, orderStatus };
}

export async function getOrderWithItems(db: any, orderId: string, restaurantId: string) {
  const [order] = await db
    .select()
    .from(appSchema.saleOrder)
    .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
  if (!order) return null;
  const [items, audits, [del]] = await Promise.all([
    db
      .select()
      .from(appSchema.saleOrderItem)
      .where(eq(appSchema.saleOrderItem.orderId, orderId))
      .orderBy(asc(appSchema.saleOrderItem.createdAt), asc(appSchema.saleOrderItem.id)),
    db
      .select()
      .from(appSchema.orderItemAudit)
      .where(eq(appSchema.orderItemAudit.orderId, orderId))
      .orderBy(appSchema.orderItemAudit.createdAt),
    db
      .select()
      .from(appSchema.deliveryOrder)
      .where(eq(appSchema.deliveryOrder.orderId, orderId)),
  ]);

  const auditsByItem = new Map<string, any[]>();
  for (const a of audits) {
    const list = auditsByItem.get(a.orderItemId) ?? [];
    list.push({
      id: a.id,
      orderId: a.orderId,
      orderItemId: a.orderItemId,
      fromStatus: a.fromStatus,
      toStatus: a.toStatus,
      changedBy: a.changedBy,
      changedByRole: a.changedByRole,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    });
    auditsByItem.set(a.orderItemId, list);
  }

  const result = toOrderWithItems(order, items, del ?? null);
  result.items = result.items.map((item: any) => ({
    ...item,
    audits: auditsByItem.get(item.id) ?? [],
  }));
  return result;
}

export function formatOrderWhatsAppMessage(
  restaurantName: string,
  outletName: string | null | undefined,
  order: any,
  items: any[],
  isSettled = false,
  delivery?: any,
  customFooter?: string | null
): string {
  const tableStr = order.orderType === 'DELIVERY'
    ? 'Delivery'
    : order.tableNo
      ? order.tableNo.toLowerCase() === 'takeaway'
        ? 'Takeaway'
        : `Table: ${order.tableNo}`
      : 'Takeaway';
  const pkgPaise = order.packagingChargePaise || 0;
  const delPaise = order.deliveryChargePaise || 0;
  const totalRupees = (((order.subtotalPaise ?? 0)) / 100).toFixed(0);

  const itemsList = items
    .filter((item) => item.status !== 'CANCELLED')
    .map((item) => {
      const name = item.nameSnapshot || item.name || 'Item';
      const addonsStr = item.addons && item.addons.length > 0
        ? ` (+${item.addons.map((a: any) => a.name).join(', ')})`
        : '';
      const noteStr = item.note ? ` [${item.note}]` : '';
      const itemTotal = (((item.pricePaiseSnapshot ?? item.pricePaise ?? 0) * item.qty) / 100).toFixed(0);
      return `• ${item.qty}x ${name}${addonsStr}${noteStr} — ₹${itemTotal}`;
    })
    .join('\n');

  const title = isSettled ? '*Payment Receipt*' : '*Order Confirmed!*';
  const header = `*${restaurantName}*${outletName ? ` (${outletName})` : ''}`;
  const paymentLine = isSettled && order.method ? `\nPayment: *${order.method}*` : '';
  const deliveryAddrLine = delivery?.addressLine1 ? `\nAddress: *${delivery.addressLine1}${delivery.landmark ? ` (${delivery.landmark})` : ''}*` : '';
  const otpLine = delivery?.deliveryOtp ? `\nDelivery PIN: *${delivery.deliveryOtp}*` : '';
  const chargesLine = (pkgPaise > 0 || delPaise > 0)
    ? `\nPackaging: ₹${(pkgPaise / 100).toFixed(0)} | Delivery: ₹${(delPaise / 100).toFixed(0)}`
    : '';

  const footer = customFooter?.trim() ? `\n\n${customFooter.trim()}` : '\n\nThank you!';
  return `${title}\n${header}\nToken: *#${order.orderNo}*\nOrder ID: \`${order.id}\`\nType: *${tableStr}*${paymentLine}${deliveryAddrLine}${otpLine}\n\n*Items:*\n${itemsList}${chargesLine}\n\n*Total:* ₹${totalRupees}${footer}`;
}

export async function seatActiveReservation(
  dbOrTx: any,
  params: {
    restaurantId: string;
    outletId: string;
    tableNo?: string | null;
    customerPhone?: string | null;
    actorPhone?: string;
  }
) {
  const { restaurantId, outletId, tableNo, customerPhone, actorPhone } = params;
  if (!restaurantId || !outletId) return;

  const matchConditions = [];
  if (tableNo && tableNo !== 'Takeaway' && tableNo !== 'Delivery') {
    matchConditions.push(
      sql`LOWER(TRIM(${appSchema.tableReservation.tableName})) = LOWER(TRIM(${tableNo}))`,
      eq(appSchema.tableReservation.tableId, tableNo),
      sql`EXISTS (
        SELECT 1 FROM ${appSchema.posTable} pt 
        WHERE pt.id = ${appSchema.tableReservation.tableId} 
          AND LOWER(TRIM(pt.name)) = LOWER(TRIM(${tableNo}))
      )`
    );
  }
  if (customerPhone) {
    const { variants } = getPhoneVariants(customerPhone);
    if (variants.length > 0) {
      matchConditions.push(inArray(appSchema.tableReservation.guestPhone, variants));
    }
  }

  if (matchConditions.length === 0) return;

  const todayStr = getTodayISTDateString();
  const activeReservations = await dbOrTx
    .select({ id: appSchema.tableReservation.id })
    .from(appSchema.tableReservation)
    .where(
      and(
        eq(appSchema.tableReservation.restaurantId, restaurantId),
        eq(appSchema.tableReservation.outletId, outletId),
        eq(appSchema.tableReservation.status, 'CONFIRMED'),
        sql`${appSchema.tableReservation.reservationDate} <= ${todayStr}`,
        or(...matchConditions)
      )
    );

  if (activeReservations.length > 0) {
    const ids = activeReservations.map((r: any) => r.id);
    const now = new Date();
    await dbOrTx
      .update(appSchema.tableReservation)
      .set({
        status: 'SEATED',
        updatedAt: now,
        updatedBy: actorPhone || 'system',
      })
      .where(inArray(appSchema.tableReservation.id, ids));
  }
}

export async function completeActiveReservation(
  dbOrTx: any,
  params: {
    restaurantId: string;
    outletId: string;
    tableNo?: string | null;
    customerPhone?: string | null;
    actorPhone?: string;
  }
) {
  const { restaurantId, outletId, tableNo, customerPhone, actorPhone } = params;
  if (!restaurantId || !outletId) return;

  const matchConditions = [];
  if (tableNo && tableNo !== 'Takeaway' && tableNo !== 'Delivery') {
    matchConditions.push(
      sql`LOWER(TRIM(${appSchema.tableReservation.tableName})) = LOWER(TRIM(${tableNo}))`,
      eq(appSchema.tableReservation.tableId, tableNo),
      sql`EXISTS (
        SELECT 1 FROM ${appSchema.posTable} pt 
        WHERE pt.id = ${appSchema.tableReservation.tableId} 
          AND LOWER(TRIM(pt.name)) = LOWER(TRIM(${tableNo}))
      )`
    );
  }
  if (customerPhone) {
    const { variants } = getPhoneVariants(customerPhone);
    if (variants.length > 0) {
      matchConditions.push(inArray(appSchema.tableReservation.guestPhone, variants));
    }
  }

  if (matchConditions.length === 0) return;

  const todayStr = getTodayISTDateString();
  const activeReservations = await dbOrTx
    .select({ id: appSchema.tableReservation.id })
    .from(appSchema.tableReservation)
    .where(
      and(
        eq(appSchema.tableReservation.restaurantId, restaurantId),
        eq(appSchema.tableReservation.outletId, outletId),
        or(
          eq(appSchema.tableReservation.status, 'SEATED'),
          and(
            eq(appSchema.tableReservation.status, 'CONFIRMED'),
            sql`${appSchema.tableReservation.reservationDate} <= ${todayStr}`
          )
        ),
        or(...matchConditions)
      )
    );

  if (activeReservations.length > 0) {
    const ids = activeReservations.map((r: any) => r.id);
    const now = new Date();
    await dbOrTx
      .update(appSchema.tableReservation)
      .set({
        status: 'COMPLETED',
        updatedAt: now,
        updatedBy: actorPhone || 'system',
      })
      .where(inArray(appSchema.tableReservation.id, ids));
  }
}
