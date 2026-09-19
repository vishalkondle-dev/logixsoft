import { Hono } from 'hono';
import { eq, ne, and, or, sql, desc } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, hasOutletAccess } from '../lib/tenancy';
import { cacheGet, cacheSet, invalidateReports, CacheKey, TTL } from '../lib/cache';
import { isAllOutletRole } from '@logixsoft/logix-dine/types/roles';
import type { RestaurantRole } from '@logixsoft/logix-dine/types/roles';
import {
  StartOrderSchema,
  CreateSettledSchema,
  AddOrderItemSchema,
  AddOrderRoundSchema,
  UpdateOrderItemSchema,
  UpdateOrderItemStatusSchema,
  SettleOrderSchema,
  FreeTableSchema,
} from '@logixsoft/logix-dine/schemas/pos';
import {
  computeOrderStatus,
  getNextItemStatus,
  type OrderItemStatus,
} from '@logixsoft/logix-dine/types/pos-schema';
import { toRestaurant, toOutlet, toCategory, toMenuItem, toOrderWithItems, toOrder } from '@logixsoft/logix-dine/mappers/pos';
import { sendWhatsAppText } from '@logixsoft/wa';
import type { AuthEnv } from '../lib/auth';

function formatOrderWhatsAppMessage(
  restaurantName: string,
  outletName: string | null | undefined,
  order: any,
  items: any[],
  isSettled = false
): string {
  const tableStr = order.tableNo
    ? order.tableNo.toLowerCase() === 'takeaway'
      ? 'Takeaway'
      : `Table: ${order.tableNo}`
    : 'Takeaway';
  const totalRupees = ((order.subtotalPaise ?? 0) / 100).toFixed(0);

  const itemsList = items
    .filter((item) => item.status !== 'CANCELLED')
    .map((item) => {
      const name = item.nameSnapshot || item.name || 'Item';
      const noteStr = item.note ? ` (${item.note})` : '';
      const itemTotal = (((item.pricePaiseSnapshot ?? item.pricePaise ?? 0) * item.qty) / 100).toFixed(0);
      return `• ${item.qty}x ${name}${noteStr} — ₹${itemTotal}`;
    })
    .join('\n');

  const title = isSettled ? '🧾 *Payment Receipt*' : '🍽️ *Order Confirmed!*';
  const header = `*${restaurantName}*${outletName ? ` (${outletName})` : ''}`;
  const paymentLine = isSettled && order.method ? `\n💳 Payment: *${order.method}*` : '';

  return `${title}\n${header}\nToken: *#${order.orderNo}*\nOrder ID: \`${order.id}\`\nType: *${tableStr}*${paymentLine}\n\n*Items:*\n${itemsList}\n\n*Total:* ₹${totalRupees}\n\nThank you for dining with us!`;
}

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function kv(c: any) { return c.env?.CACHE; }

/**
 * Enforce outlet access on a specific outletId regardless of whether the
 * client bothered to send X-Outlet-Id. OWNER (or any all-outlet role)
 * always passes. Non-owner roles (MANAGER/WAITER/KITCHEN) must have a
 * memberOutletAccess row for this exact outlet.
 */
async function assertOutletAccess(db: any, tenant: any, outletId: string): Promise<boolean> {
  if (isAllOutletRole(tenant.role as RestaurantRole)) return true;
  if (!tenant.member) return false;
  return hasOutletAccess(db, tenant.member.id, tenant.role, outletId);
}

async function recomputeTotal(db: any, orderId: string) {
  const items = await db
    .select()
    .from(appSchema.saleOrderItem)
    .where(eq(appSchema.saleOrderItem.orderId, orderId));
  const activeItems = items.filter((item: any) => item.status !== 'CANCELLED');
  const total = activeItems.reduce((sum: number, item: any) => sum + item.pricePaiseSnapshot * item.qty, 0);
  const paidTotal = activeItems
    .filter((item: any) => item.paymentStatus === 'PAID')
    .reduce((sum: number, item: any) => sum + item.pricePaiseSnapshot * item.qty, 0);
  const orderStatus = computeOrderStatus(items.map((i: any) => i.status));

  const [existingOrder] = await db
    .select({ status: appSchema.saleOrder.status })
    .from(appSchema.saleOrder)
    .where(eq(appSchema.saleOrder.id, orderId));

  let status = existingOrder?.status;
  if (status !== 'VOID') {
    if (paidTotal >= total && total > 0) status = 'PAID';
    else if (paidTotal > 0) status = 'PARTIAL';
    else status = 'OPEN';
  }

  await db
    .update(appSchema.saleOrder)
    .set({ subtotalPaise: total, paidPaise: paidTotal, status, orderStatus, updatedAt: new Date() })
    .where(eq(appSchema.saleOrder.id, orderId));
  return { items, total, paidTotal, orderStatus };
}

async function getOrderWithItems(db: any, orderId: string, restaurantId: string) {
  const [order] = await db
    .select()
    .from(appSchema.saleOrder)
    .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
  if (!order) return null;
  const items = await db
    .select()
    .from(appSchema.saleOrderItem)
    .where(eq(appSchema.saleOrderItem.orderId, orderId));
  const audits = await db
    .select()
    .from(appSchema.orderItemAudit)
    .where(eq(appSchema.orderItemAudit.orderId, orderId))
    .orderBy(appSchema.orderItemAudit.createdAt);

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

  const result = toOrderWithItems(order, items);
  result.items = result.items.map((item: any) => ({
    ...item,
    audits: auditsByItem.get(item.id) ?? [],
  }));
  return result;
}

// GET /billing/bootstrap
app.get('/bootstrap', requirePermission('menu:read'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || '';

  const cacheKey = CacheKey.bootstrap(restaurantId, outletId);
  const cachedBs = await cacheGet<any>(kv(c), cacheKey);
  if (cachedBs) return c.json(cachedBs);

  const { db, close } = getDb(c);
  try {
    const [rest] = await db.select().from(appSchema.restaurant).where(eq(appSchema.restaurant.id, restaurantId));
    const outlets = await db.select().from(appSchema.restaurantOutlet).where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));

    const catWhere = outletId
      ? and(eq(appSchema.menuCategory.restaurantId, restaurantId), eq(appSchema.menuCategory.active, true), eq(appSchema.menuCategory.outletId, outletId))
      : and(eq(appSchema.menuCategory.restaurantId, restaurantId), eq(appSchema.menuCategory.active, true));
    const categories = await db.select().from(appSchema.menuCategory).where(catWhere);

    const itemWhere = outletId
      ? and(eq(appSchema.menuItem.restaurantId, restaurantId), eq(appSchema.menuItem.outletId, outletId))
      : eq(appSchema.menuItem.restaurantId, restaurantId);
    const items = await db.select().from(appSchema.menuItem).where(itemWhere);

    const bsResult = {
      restaurant: toRestaurant(rest),
      outlets: outlets.map(toOutlet),
      categories: categories.map(toCategory),
      items: items.map(toMenuItem),
    };
    await cacheSet(kv(c), CacheKey.bootstrap(restaurantId, outletId), bsResult, TTL.menu);
    return c.json(bsResult);
  } finally {
    await close();
  }
});

let lastOrderTime = 0;
function generateOrderId(outletId: string): string {
  let now = Date.now();
  if (now <= lastOrderTime) {
    now = lastOrderTime + 1;
  }
  lastOrderTime = now;
  return `ord_${outletId}_${now}`;
}

// POST /billing/orders — start a new OPEN order
app.post('/orders', requirePermission('order:create'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const actorPhone = c.get('actorPhone');
  const body = await c.req.json().catch(() => ({}));
  const parsed = StartOrderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const id = generateOrderId(parsed.data.outletId);
    const now = new Date();
    let subtotalPaise = 0;
    const orderItemsToInsert: any[] = [];

    // ── Order number from KV sequence ─────────────────────────────────────────
    // KV key seq:<outletId> stores the last used orderNo. Always up-to-date
    // because we write it back via waitUntil after every order. No DB query needed.
    // On the very first order (KV miss), start at 1.
    const seqKey = CacheKey.outletSeq(parsed.data.outletId);
    const kvSeq = await cacheGet<number>(kv(c), seqKey);
    const tokenNo = (kvSeq ?? 0) + 1;

    await db.transaction(async (tx: any) => {

      if (parsed.data.items && parsed.data.items.length > 0) {
        const menuItems = await tx
          .select()
          .from(appSchema.menuItem)
          .where(eq(appSchema.menuItem.restaurantId, restaurantId));
        const menuMap = new Map(menuItems.map((m: any) => [m.id, m]));

        for (const item of parsed.data.items) {
          const menuItem = menuMap.get(item.itemId) as any;
          if (!menuItem) continue;
          const pricePaiseSnapshot = menuItem.pricePaise;
          subtotalPaise += pricePaiseSnapshot * item.qty;
          orderItemsToInsert.push({
            id: generateId('orderItem'),
            orderId: id,
            itemId: item.itemId,
            nameSnapshot: menuItem.name,
            pricePaiseSnapshot,
            qty: item.qty,
            round: 1,
            status: 'ORDERED',
            paymentStatus: 'UNPAID',
            settledMethod: null,
            settledAt: null,
            note: item.note ? item.note.trim() : null,
            createdAt: now,
            updatedAt: now,
            createdBy: actorPhone,
            updatedBy: actorPhone,
          });
        }
      }

      const isTableOrder = Boolean(parsed.data.tableNo && parsed.data.tableNo.trim() && parsed.data.tableNo !== 'Takeaway');
      await tx.insert(appSchema.saleOrder).values({
        id,
        restaurantId,
        outletId: parsed.data.outletId,
        orderNo: tokenNo,
        tableNo: parsed.data.tableNo ?? null,
        customerPhone: parsed.data.customerPhone ?? null,
        status: 'OPEN',
        orderStatus: 'ORDERED',
        subtotalPaise,
        paidPaise: 0,
        note: parsed.data.note ?? null,
        tableFreedAt: isTableOrder ? null : now,
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });

      if (orderItemsToInsert.length > 0) {
        await tx.insert(appSchema.saleOrderItem).values(orderItemsToInsert);
        const audits = orderItemsToInsert.map((oi) => ({
          id: generateId('audit'),
          orderId: id,
          orderItemId: oi.id,
          fromStatus: null,
          toStatus: 'ORDERED',
          changedBy: actorPhone || 'Staff',
          changedByRole: tenant.role || 'STAFF',
          createdAt: now,
        }));
        await tx.insert(appSchema.orderItemAudit).values(audits);
      }
    });

    // Build response from inserted data — no extra SELECT round-trip
    const isTableOrder = Boolean(parsed.data.tableNo && parsed.data.tableNo.trim() && parsed.data.tableNo !== 'Takeaway');
    const orderRow = {
      id,
      restaurantId,
      outletId: parsed.data.outletId,
      orderNo: tokenNo,
      tableNo: parsed.data.tableNo ?? null,
      customerPhone: parsed.data.customerPhone ?? null,
      status: 'OPEN',
      orderStatus: 'ORDERED',
      subtotalPaise,
      paidPaise: 0,
      note: parsed.data.note ?? null,
      method: null,
      kotPrintedAt: null,
      readyAt: null,
      settledAt: null,
      settledByUserId: null,
      tableFreedAt: isTableOrder ? null : now,
      createdAt: now,
      updatedAt: now,
      createdBy: actorPhone,
      updatedBy: actorPhone,
    };
    const result = toOrderWithItems(orderRow, orderItemsToInsert.map((oi) => ({
      ...oi,
      id: oi.id,
      orderId: id,
      updatedAt: now,
    })));

    // ── Update KV sequence (non-blocking) ────────────────────────────────────
    // Use waitUntil so the write finishes even after the response is sent.
    try {
      c.executionCtx.waitUntil(
        cacheSet(kv(c), seqKey, tokenNo, TTL.outletSeq)
      );
    } catch {
      // executionCtx not available in local dev
      cacheSet(kv(c), seqKey, tokenNo, TTL.outletSeq).catch(() => {});
    }

    // ── WhatsApp notification (non-blocking) ──────────────────────────────────
    if (parsed.data.customerPhone && result) {
      const waWork = (async () => {
        try {
          const [rest] = await db
            .select({ name: appSchema.restaurant.name })
            .from(appSchema.restaurant)
            .where(eq(appSchema.restaurant.id, restaurantId));
          const message = formatOrderWhatsAppMessage(
            rest?.name ?? 'Restaurant',
            parsed.data.outletId,
            result.order,
            result.items,
            false
          );
          await sendWhatsAppText(
            parsed.data.customerPhone!,
            message,
            undefined,
            { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY }
          );
        } catch (waErr) {
          console.warn('[billing/order] WhatsApp send error:', waErr);
        }
      })();
      try {
        c.executionCtx.waitUntil(waWork);
      } catch {
        // local dev — let it run and forget
      }
    }

    return c.json(result, 201);
  } finally {
    await close();
  }
});

// POST /billing/orders/create-settled — create + settle in ONE transaction (Settle & Send fast path)
// Saves one full HTTP round-trip vs POST /orders then POST /orders/:id/settle.
app.post('/orders/create-settled', requirePermission('order:settle'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const user = c.get('sessionUser') as any;
  const actorPhone = c.get('actorPhone');
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateSettledSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const id = generateOrderId(parsed.data.outletId);
    const now = new Date();
    let subtotalPaise = 0;
    const orderItemsToInsert: any[] = [];

    const seqKey = CacheKey.outletSeq(parsed.data.outletId);
    const kvSeq = await cacheGet<number>(kv(c), seqKey);
    const tokenNo = (kvSeq ?? 0) + 1;

    await db.transaction(async (tx: any) => {
      if (parsed.data.items && parsed.data.items.length > 0) {
        const menuItems = await tx.select().from(appSchema.menuItem)
          .where(eq(appSchema.menuItem.restaurantId, restaurantId));
        const menuMap = new Map(menuItems.map((m: any) => [m.id, m]));
        for (const item of parsed.data.items) {
          const menuItem = menuMap.get(item.itemId) as any;
          if (!menuItem) continue;
          subtotalPaise += menuItem.pricePaise * item.qty;
          orderItemsToInsert.push({
            id: generateId('orderItem'), orderId: id, itemId: item.itemId,
            nameSnapshot: menuItem.name, pricePaiseSnapshot: menuItem.pricePaise,
            qty: item.qty, round: 1, status: 'ORDERED',
            paymentStatus: 'PAID', settledMethod: parsed.data.method ?? 'Cash', settledAt: now,
            note: item.note ? item.note.trim() : null,
            createdAt: now, updatedAt: now, createdBy: actorPhone, updatedBy: actorPhone,
          });
        }
      }
      const isTableOrder = Boolean(parsed.data.tableNo && parsed.data.tableNo.trim() && parsed.data.tableNo !== 'Takeaway');
      // Insert as PAID directly — no intermediate OPEN state
      await tx.insert(appSchema.saleOrder).values({
        id, restaurantId, outletId: parsed.data.outletId, orderNo: tokenNo,
        tableNo: parsed.data.tableNo ?? null, customerPhone: parsed.data.customerPhone ?? null,
        status: 'PAID', orderStatus: 'ORDERED', method: parsed.data.method ?? 'Cash',
        subtotalPaise, paidPaise: subtotalPaise,
        note: parsed.data.note ?? null, settledAt: now, settledByUserId: user.id,
        tableFreedAt: isTableOrder ? null : now,
        kotPrintedAt: now, createdAt: now, updatedAt: now,
        createdBy: actorPhone, updatedBy: actorPhone,
      });
      if (orderItemsToInsert.length > 0) {
        await tx.insert(appSchema.saleOrderItem).values(orderItemsToInsert);
        const audits = orderItemsToInsert.map((oi) => ({
          id: generateId('audit'),
          orderId: id,
          orderItemId: oi.id,
          fromStatus: null,
          toStatus: 'ORDERED',
          changedBy: actorPhone || 'Staff',
          changedByRole: tenant.role || 'STAFF',
          createdAt: now,
        }));
        await tx.insert(appSchema.orderItemAudit).values(audits);
      }
    });

    // Non-blocking KV sequence update
    try { c.executionCtx.waitUntil(cacheSet(kv(c), seqKey, tokenNo, TTL.outletSeq)); }
    catch { cacheSet(kv(c), seqKey, tokenNo, TTL.outletSeq).catch(() => {}); }

    // Build response from inserted data — no SELECT round-trip
    const isTableOrder = Boolean(parsed.data.tableNo && parsed.data.tableNo.trim() && parsed.data.tableNo !== 'Takeaway');
    const orderRow = {
      id, restaurantId, outletId: parsed.data.outletId, orderNo: tokenNo,
      tableNo: parsed.data.tableNo ?? null, customerPhone: parsed.data.customerPhone ?? null,
      status: 'PAID', orderStatus: 'ORDERED', method: parsed.data.method ?? 'Cash',
      subtotalPaise, paidPaise: subtotalPaise,
      note: parsed.data.note ?? null, kotPrintedAt: now, readyAt: null,
      settledAt: now, settledByUserId: user.id,
      tableFreedAt: isTableOrder ? null : now,
      createdAt: now, updatedAt: now,
      createdBy: actorPhone, updatedBy: actorPhone,
    };
    const result = toOrderWithItems(orderRow, orderItemsToInsert.map((oi) => ({ ...oi, updatedAt: now })));

    // WA notification (non-blocking)
    const targetPhone = parsed.data.customerPhone;
    if (targetPhone && result) {
      const waWork = (async () => {
        try {
          const [rest] = await db.select({ name: appSchema.restaurant.name })
            .from(appSchema.restaurant).where(eq(appSchema.restaurant.id, restaurantId));
          const message = formatOrderWhatsAppMessage(
            rest?.name ?? 'Restaurant', parsed.data.outletId, result.order, result.items, true
          );
          await sendWhatsAppText(targetPhone, message, undefined,
            { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY });
        } catch (err) { console.warn('[create-settled] WA error:', err); }
      })();
      try { c.executionCtx.waitUntil(waWork); } catch { /* local dev */ }
    }

    await invalidateReports(kv(c), restaurantId);
    return c.json(result, 201);
  } finally {
    await close();
  }
});

// GET /billing/orders
app.get('/orders', requirePermission('order:read'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const status = c.req.query('status');
  const tableOccupied = c.req.query('tableOccupied');
  const orderStatus = c.req.query('orderStatus');
  const outletId = c.req.query('outletId');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

  const { db, close } = getDb(c);
  try {
    // Non-owner roles must specify an outlet they're assigned to — never
    // an implicit "all outlets" view.
    if (!isAllOutletRole(tenant.role as RestaurantRole)) {
      if (!outletId) {
        return c.json({ error: 'Bad Request', message: 'outletId is required for this role' }, 400);
      }
      if (!(await assertOutletAccess(db, tenant, outletId))) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }
    }

    const conditions: any[] = [eq(appSchema.saleOrder.restaurantId, restaurantId)];
    if (tableOccupied === 'true') {
      conditions.push(
        sql`${appSchema.saleOrder.tableFreedAt} IS NULL`,
        sql`${appSchema.saleOrder.tableNo} IS NOT NULL`,
        sql`${appSchema.saleOrder.tableNo} != 'Takeaway'`,
        sql`${appSchema.saleOrder.status} != 'VOID'`
      );
    } else if (status) {
      conditions.push(eq(appSchema.saleOrder.status, status));
    }
    if (orderStatus) conditions.push(eq(appSchema.saleOrder.orderStatus, orderStatus));
    if (outletId) conditions.push(eq(appSchema.saleOrder.outletId, outletId));

    const orders = await db
      .select()
      .from(appSchema.saleOrder)
      .where(and(...conditions))
      .orderBy(desc(appSchema.saleOrder.createdAt))
      .limit(limit);

    const orderIds = orders.map((o: any) => o.id);
    const allItems = orderIds.length
      ? await db.select().from(appSchema.saleOrderItem).where(sql`${appSchema.saleOrderItem.orderId} IN ${orderIds}`)
      : [];
    const allAudits = orderIds.length
      ? await db.select().from(appSchema.orderItemAudit).where(sql`${appSchema.orderItemAudit.orderId} IN ${orderIds}`)
      : [];

    const itemsByOrder = new Map<string, any[]>();
    for (const item of allItems) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    const auditsByItem = new Map<string, any[]>();
    for (const a of allAudits) {
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

    const results = orders.map((order: any) => {
      const res = toOrderWithItems(order, itemsByOrder.get(order.id) ?? []);
      res.items = res.items.map((it: any) => ({
        ...it,
        audits: auditsByItem.get(it.id) ?? [],
      }));
      return res;
    });
    return c.json(results);
  } finally {
    await close();
  }
});

// GET /billing/orders/kitchen — KDS board: OPEN or active PAID orders for the caller's outlet(s).
// MUST be registered before GET /orders/:id, or Hono would match "kitchen" as an order ID.
// KITCHEN role is outlet-scoped, so the web sends X-Outlet-Id; requirePermission
// already enforces that this outlet is one the caller has access to.
app.get('/orders/kitchen', requirePermission('order:read'), async (c) => {
  const { restaurantId, outletId } = c.get('tenant');

  const { db, close } = getDb(c);
  try {
    const activeCondition = and(
      sql`${appSchema.saleOrder.status} != 'VOID'`,
      sql`${appSchema.saleOrder.orderStatus} NOT IN ('SERVED', 'CANCELLED')`,
    );

    const where = outletId
      ? and(
          eq(appSchema.saleOrder.restaurantId, restaurantId),
          eq(appSchema.saleOrder.outletId, outletId),
          activeCondition,
        )
      : and(eq(appSchema.saleOrder.restaurantId, restaurantId), activeCondition);

    const orders = await db
      .select()
      .from(appSchema.saleOrder)
      .where(where)
      .orderBy(appSchema.saleOrder.createdAt);

    const orderIds = orders.map((o: any) => o.id);
    const items = orderIds.length
      ? await db.select().from(appSchema.saleOrderItem).where(sql`${appSchema.saleOrderItem.orderId} IN ${orderIds}`)
      : [];

    const itemsByOrder = new Map<string, any[]>();
    for (const item of items) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    const result = orders.map((order: any) => toOrderWithItems(order, itemsByOrder.get(order.id) ?? []));
    return c.json(result);
  } finally {
    await close();
  }
});

// GET /billing/orders/:id
app.get('/orders/:id', requirePermission('order:read'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const id = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [orderRow] = await db
      .select({ outletId: appSchema.saleOrder.outletId })
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, id), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!orderRow) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, orderRow.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }

    const result = await getOrderWithItems(db, id, restaurantId);
    if (!result) return c.json({ error: 'Not Found' }, 404);
    return c.json(result);
  } finally {
    await close();
  }
});

// POST /billing/orders/:id/items — add or upsert item
app.post('/orders/:id/items', requirePermission('order:create'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');
  const actorPhone = c.get('actorPhone');
  const body = await c.req.json().catch(() => ({}));
  const parsed = AddOrderItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select()
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }
    if (order.status !== 'OPEN') return c.json({ error: 'Conflict', message: 'Order is not open' }, 409);

    const [menuItem] = await db
      .select()
      .from(appSchema.menuItem)
      .where(and(eq(appSchema.menuItem.id, parsed.data.itemId), eq(appSchema.menuItem.restaurantId, restaurantId)));
    if (!menuItem) return c.json({ error: 'Not Found', message: 'Menu item not found' }, 404);

    // Upsert: if same item exists in order, increment qty
    const [existing] = await db
      .select()
      .from(appSchema.saleOrderItem)
      .where(and(eq(appSchema.saleOrderItem.orderId, orderId), eq(appSchema.saleOrderItem.itemId, parsed.data.itemId)));

    if (existing) {
      const updateData: any = { qty: existing.qty + (parsed.data.qty ?? 1) };
      if (parsed.data.note !== undefined) updateData.note = parsed.data.note ? parsed.data.note.trim() : null;
      await db
        .update(appSchema.saleOrderItem)
        .set(updateData)
        .where(eq(appSchema.saleOrderItem.id, existing.id));
    } else {
      const now = new Date();
      const newOrderItemId = generateId('oi');
      await db.insert(appSchema.saleOrderItem).values({
        id: newOrderItemId,
        orderId,
        itemId: menuItem.id,
        nameSnapshot: menuItem.name,
        pricePaiseSnapshot: menuItem.pricePaise,
        qty: parsed.data.qty ?? 1,
        status: 'ORDERED',
        note: parsed.data.note ? parsed.data.note.trim() : null,
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });
      await db.insert(appSchema.orderItemAudit).values({
        id: generateId('audit'),
        orderId,
        orderItemId: newOrderItemId,
        fromStatus: null,
        toStatus: 'ORDERED',
        changedBy: actorPhone || 'Staff',
        changedByRole: tenant.role || 'STAFF',
        createdAt: now,
      });
    }

    await recomputeTotal(db, orderId);
    const result = await getOrderWithItems(db, orderId, restaurantId);
    return c.json(result);
  } finally {
    await close();
  }
});

// POST /billing/orders/:id/round — append a new round of items to an existing OPEN order
app.post('/orders/:id/round', requirePermission('order:create'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');
  const actorPhone = c.get('actorPhone');
  const body = await c.req.json().catch(() => ({}));
  const parsed = AddOrderRoundSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select()
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }
    if (order.status === 'VOID') return c.json({ error: 'Conflict', message: 'Order is voided' }, 409);
    const isTableOrder = Boolean(order.tableNo && order.tableNo.trim() && order.tableNo !== 'Takeaway');
    if (isTableOrder) {
      if (order.tableFreedAt !== null) {
        return c.json({ error: 'Conflict', message: 'Table has already been freed' }, 409);
      }
    } else {
      if (order.status !== 'OPEN') {
        return c.json({ error: 'Conflict', message: 'Takeaway order is not open' }, 409);
      }
    }

    // Determine next round number based on existing items
    const existingItems = await db
      .select({ round: appSchema.saleOrderItem.round })
      .from(appSchema.saleOrderItem)
      .where(eq(appSchema.saleOrderItem.orderId, orderId));
    const maxRound = existingItems.reduce((max: number, it: any) => Math.max(max, Number(it.round) || 1), 0);
    const nextRound = (maxRound || 1) + 1;

    const menuItems = await db
      .select()
      .from(appSchema.menuItem)
      .where(eq(appSchema.menuItem.restaurantId, restaurantId));
    const menuMap = new Map(menuItems.map((m: any) => [m.id, m]));

    const now = new Date();
    const isRoundSettled = Boolean(parsed.data.settle);
    const roundSettleMethod = parsed.data.settle?.method || 'Cash';
    const orderItemsToInsert: any[] = [];
    const auditsToInsert: any[] = [];

    for (const item of parsed.data.items) {
      const menuItem = menuMap.get(item.itemId) as any;
      if (!menuItem) continue;
      const pricePaiseSnapshot = menuItem.pricePaise;
      const newOrderItemId = generateId('oi');
      orderItemsToInsert.push({
        id: newOrderItemId,
        orderId,
        itemId: menuItem.id,
        nameSnapshot: menuItem.name,
        pricePaiseSnapshot,
        qty: item.qty,
        round: nextRound,
        status: 'ORDERED',
        paymentStatus: isRoundSettled ? 'PAID' : 'UNPAID',
        settledMethod: isRoundSettled ? roundSettleMethod : null,
        settledAt: isRoundSettled ? now : null,
        note: item.note ? item.note.trim() : null,
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });
      auditsToInsert.push({
        id: generateId('audit'),
        orderId,
        orderItemId: newOrderItemId,
        fromStatus: null,
        toStatus: 'ORDERED',
        changedBy: actorPhone || 'Staff',
        changedByRole: tenant.role || 'STAFF',
        createdAt: now,
      });
    }

    if (orderItemsToInsert.length === 0) {
      return c.json({ error: 'Bad Request', message: 'No valid items found' }, 400);
    }

    await db.transaction(async (tx: any) => {
      await tx.insert(appSchema.saleOrderItem).values(orderItemsToInsert);
      if (auditsToInsert.length > 0) {
        await tx.insert(appSchema.orderItemAudit).values(auditsToInsert);
      }
      // Recompute total paise and derive orderStatus & financial status
      const allItems = await tx
        .select()
        .from(appSchema.saleOrderItem)
        .where(eq(appSchema.saleOrderItem.orderId, orderId));
      const total = allItems
        .filter((i: any) => i.status !== 'CANCELLED')
        .reduce((sum: number, i: any) => sum + i.pricePaiseSnapshot * i.qty, 0);
      const paidTotal = allItems
        .filter((i: any) => i.status !== 'CANCELLED' && i.paymentStatus === 'PAID')
        .reduce((sum: number, i: any) => sum + i.pricePaiseSnapshot * i.qty, 0);

      const newOrderStatus = computeOrderStatus(allItems.map((i: any) => i.status));
      const financialStatus = paidTotal >= total && total > 0
        ? 'PAID'
        : paidTotal > 0
        ? 'PARTIAL'
        : 'OPEN';

      await tx
        .update(appSchema.saleOrder)
        .set({
          subtotalPaise: total,
          paidPaise: paidTotal,
          status: financialStatus,
          orderStatus: newOrderStatus,
          readyAt: null, // Clear readyAt so kitchen knows new round is pending
          updatedAt: now,
          updatedBy: actorPhone,
        })
        .where(eq(appSchema.saleOrder.id, orderId));
    });

    const result = await getOrderWithItems(db, orderId, restaurantId);
    return c.json({
      ...result,
      round: nextRound,
      addedItems: orderItemsToInsert,
    });
  } finally {
    await close();
  }
});

// PATCH /billing/orders/:id/items/:orderItemId/status — update status (Next, Close, or direct)
// "Anyone can do that just audit it. Except customer"
app.patch('/orders/:id/items/:orderItemId/status', requirePermission('order:read'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');
  const orderItemId = c.req.param('orderItemId');
  const actorPhone = c.get('actorPhone');
  const sessionUser = c.get('sessionUser') as any;

  if (tenant.role === 'CUSTOMER' || !tenant.member) {
    return c.json({ error: 'Forbidden', message: 'Customers cannot modify order item status' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateOrderItemStatusSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select()
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }
    if (order.status === 'VOID') {
      return c.json({ error: 'Conflict', message: 'Cannot modify items in a voided order' }, 409);
    }

    const [item] = await db
      .select()
      .from(appSchema.saleOrderItem)
      .where(and(eq(appSchema.saleOrderItem.id, orderItemId), eq(appSchema.saleOrderItem.orderId, orderId)));
    if (!item) return c.json({ error: 'Not Found', message: 'Order item not found' }, 404);

    let targetStatus: OrderItemStatus | null = null;
    if (parsed.data.action === 'next') {
      targetStatus = getNextItemStatus(item.status);
      if (!targetStatus) {
        return c.json({ error: 'Bad Request', message: `Item has already reached status ${item.status}` }, 400);
      }
    } else if (parsed.data.action === 'close' || parsed.data.action === 'cancel') {
      targetStatus = 'CANCELLED';
    } else if (parsed.data.status) {
      targetStatus = parsed.data.status as OrderItemStatus;
    } else {
      return c.json({ error: 'Bad Request', message: 'Either status or action is required' }, 400);
    }

    if (targetStatus === item.status) {
      const result = await getOrderWithItems(db, orderId, restaurantId);
      return c.json(result);
    }

    const now = new Date();
    const actorIdentity = actorPhone || sessionUser?.name || sessionUser?.phoneNumber || sessionUser?.id || 'Staff';
    const actorRole = tenant.role || 'STAFF';

    await db.transaction(async (tx: any) => {
      await tx
        .update(appSchema.saleOrderItem)
        .set({
          status: targetStatus,
          updatedAt: now,
          updatedBy: actorIdentity,
        })
        .where(eq(appSchema.saleOrderItem.id, orderItemId));

      await tx.insert(appSchema.orderItemAudit).values({
        id: generateId('audit'),
        orderId,
        orderItemId,
        fromStatus: item.status,
        toStatus: targetStatus,
        changedBy: actorIdentity,
        changedByRole: actorRole,
        createdAt: now,
      });

      const allItems = await tx
        .select()
        .from(appSchema.saleOrderItem)
        .where(eq(appSchema.saleOrderItem.orderId, orderId));

      const updatedStatuses = allItems.map((i: any) => i.id === orderItemId ? targetStatus : i.status);
      const newOrderStatus = computeOrderStatus(updatedStatuses);

      const activeItems = allItems.filter((i: any) => i.id === orderItemId ? targetStatus !== 'CANCELLED' : i.status !== 'CANCELLED');
      const subtotalPaise = activeItems.reduce((sum: number, i: any) => sum + i.pricePaiseSnapshot * i.qty, 0);

      const orderUpdates: any = {
        orderStatus: newOrderStatus,
        subtotalPaise,
        updatedAt: now,
        updatedBy: actorIdentity,
      };

      if ((newOrderStatus === 'PREPARED' || newOrderStatus === 'SERVED') && !order.readyAt) {
        orderUpdates.readyAt = now;
      }

      await tx
        .update(appSchema.saleOrder)
        .set(orderUpdates)
        .where(eq(appSchema.saleOrder.id, orderId));
    });

    const result = await getOrderWithItems(db, orderId, restaurantId);
    return c.json(result);
  } finally {
    await close();
  }
});

// PATCH /billing/orders/:id/items/:orderItemId — update qty or note
app.patch('/orders/:id/items/:orderItemId', requirePermission('order:create'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');
  const orderItemId = c.req.param('orderItemId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateOrderItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select({ status: appSchema.saleOrder.status, outletId: appSchema.saleOrder.outletId })
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }
    if (order.status !== 'OPEN' && order.status !== 'PARTIAL') return c.json({ error: 'Conflict', message: 'Order is not open' }, 409);

    const updateData: any = {};
    if (parsed.data.qty !== undefined) updateData.qty = Math.max(1, parsed.data.qty);
    if (parsed.data.note !== undefined) updateData.note = parsed.data.note ? parsed.data.note.trim() : null;

    await db
      .update(appSchema.saleOrderItem)
      .set(updateData)
      .where(and(eq(appSchema.saleOrderItem.id, orderItemId), eq(appSchema.saleOrderItem.orderId, orderId)));

    await recomputeTotal(db, orderId);
    const result = await getOrderWithItems(db, orderId, restaurantId);
    return c.json(result);
  } finally {
    await close();
  }
});

// DELETE /billing/orders/:id/items/:orderItemId
app.delete('/orders/:id/items/:orderItemId', requirePermission('order:create'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');
  const orderItemId = c.req.param('orderItemId');

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select({ status: appSchema.saleOrder.status, outletId: appSchema.saleOrder.outletId })
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }
    if (order.status !== 'OPEN' && order.status !== 'PARTIAL') return c.json({ error: 'Conflict', message: 'Order is not open' }, 409);

    await db
      .delete(appSchema.saleOrderItem)
      .where(and(eq(appSchema.saleOrderItem.id, orderItemId), eq(appSchema.saleOrderItem.orderId, orderId)));

    await recomputeTotal(db, orderId);
    const result = await getOrderWithItems(db, orderId, restaurantId);
    return c.json(result);
  } finally {
    await close();
  }
});

// POST /billing/orders/:id/settle
app.post('/orders/:id/settle', requirePermission('order:settle'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');
  const user = c.get('sessionUser') as any;
  const actorPhone = c.get('actorPhone');
  const body = await c.req.json().catch(() => ({}));
  const parsed = SettleOrderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select()
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }
    if (order.status === 'VOID') return c.json({ error: 'Conflict', message: 'Order is voided' }, 409);

    const now = new Date();
    const targetPhone = parsed.data.customerPhone || order.customerPhone;
    const settleMethod = parsed.data.method || order.method || 'Cash';

    await db.transaction(async (tx: any) => {
      // Mark all unpaid items as PAID
      await tx
        .update(appSchema.saleOrderItem)
        .set({
          paymentStatus: 'PAID',
          settledMethod: settleMethod,
          settledAt: now,
          updatedAt: now,
          updatedBy: actorPhone,
        })
        .where(
          and(
            eq(appSchema.saleOrderItem.orderId, orderId),
            ne(appSchema.saleOrderItem.paymentStatus, 'PAID')
          )
        );

      const allItems = await tx
        .select()
        .from(appSchema.saleOrderItem)
        .where(eq(appSchema.saleOrderItem.orderId, orderId));
      const total = allItems
        .filter((i: any) => i.status !== 'CANCELLED')
        .reduce((sum: number, i: any) => sum + i.pricePaiseSnapshot * i.qty, 0);

      await tx
        .update(appSchema.saleOrder)
        .set({
          status: 'PAID',
          subtotalPaise: total,
          paidPaise: total,
          method: settleMethod,
          customerPhone: targetPhone ?? null,
          settledAt: order.settledAt || now,
          settledByUserId: order.settledByUserId || user?.id || null,
          updatedAt: now,
          updatedBy: actorPhone,
        })
        .where(eq(appSchema.saleOrder.id, orderId));
    });

    const result = await getOrderWithItems(db, orderId, restaurantId);

    if (targetPhone && result) {
      const waSettle = (async () => {
        try {
          const [rest] = await db
            .select({ name: appSchema.restaurant.name })
            .from(appSchema.restaurant)
            .where(eq(appSchema.restaurant.id, restaurantId));
          const [outlet] = await db
            .select({ name: appSchema.restaurantOutlet.name })
            .from(appSchema.restaurantOutlet)
            .where(eq(appSchema.restaurantOutlet.id, order.outletId));
          const message = formatOrderWhatsAppMessage(
            rest?.name ?? 'Restaurant',
            outlet?.name,
            result.order,
            result.items,
            true
          );
          await sendWhatsAppText(
            targetPhone,
            message,
            undefined,
            { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY }
          );
        } catch (waErr) {
          console.warn('[billing/settle] WhatsApp send error:', waErr);
        }
      })();
      try { c.executionCtx.waitUntil(waSettle); } catch { /* local dev */ }
    }

    await invalidateReports(kv(c), restaurantId);
    return c.json(result);
  } finally {
    await close();
  }
});

// POST /billing/orders/:id/free-table — settle remaining unpaid items (if any) and free/vacate table
app.post('/orders/:id/free-table', requirePermission('order:settle'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');
  const user = c.get('sessionUser') as any;
  const actorPhone = c.get('actorPhone');
  const body = await c.req.json().catch(() => ({}));
  const parsed = FreeTableSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select()
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }
    if (order.status === 'VOID') return c.json({ error: 'Conflict', message: 'Cannot free a voided order' }, 409);

    const now = new Date();
    const settleMethod = parsed.data.method || order.method || 'Cash';

    await db.transaction(async (tx: any) => {
      // Mark any unpaid items as PAID
      await tx
        .update(appSchema.saleOrderItem)
        .set({
          paymentStatus: 'PAID',
          settledMethod: settleMethod,
          settledAt: now,
          updatedAt: now,
          updatedBy: actorPhone,
        })
        .where(
          and(
            eq(appSchema.saleOrderItem.orderId, orderId),
            ne(appSchema.saleOrderItem.paymentStatus, 'PAID')
          )
        );

      const allItems = await tx
        .select()
        .from(appSchema.saleOrderItem)
        .where(eq(appSchema.saleOrderItem.orderId, orderId));
      const total = allItems
        .filter((i: any) => i.status !== 'CANCELLED')
        .reduce((sum: number, i: any) => sum + i.pricePaiseSnapshot * i.qty, 0);

      await tx
        .update(appSchema.saleOrder)
        .set({
          subtotalPaise: total,
          paidPaise: total,
          status: 'PAID',
          method: settleMethod,
          settledAt: order.settledAt || now,
          settledByUserId: order.settledByUserId || user?.id || null,
          tableFreedAt: now,
          updatedAt: now,
          updatedBy: actorPhone,
        })
        .where(eq(appSchema.saleOrder.id, orderId));
    });

    const result = await getOrderWithItems(db, orderId, restaurantId);
    await invalidateReports(kv(c), restaurantId);
    return c.json(result);
  } finally {
    await close();
  }
});

// POST /billing/orders/:id/whatsapp — dispatch/resend WhatsApp order details
app.post('/orders/:id/whatsapp', requirePermission('order:read'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const phone = body.phone;

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select()
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }

    const targetPhone = phone || order.customerPhone;
    if (!targetPhone) {
      return c.json({ error: 'Bad Request', message: 'Phone number is required' }, 400);
    }

    if (phone && phone !== order.customerPhone) {
      await db
        .update(appSchema.saleOrder)
        .set({ customerPhone: phone, updatedAt: new Date() })
        .where(eq(appSchema.saleOrder.id, orderId));
    }

    const result = await getOrderWithItems(db, orderId, restaurantId);
    if (!result) return c.json({ error: 'Not Found' }, 404);

    const [rest] = await db
      .select({ name: appSchema.restaurant.name })
      .from(appSchema.restaurant)
      .where(eq(appSchema.restaurant.id, restaurantId));
    const [outlet] = await db
      .select({ name: appSchema.restaurantOutlet.name })
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, order.outletId));

    const isSettled = result.order.status === 'PAID';
    const message = formatOrderWhatsAppMessage(
      rest?.name ?? 'Restaurant',
      outlet?.name,
      result.order,
      result.items,
      isSettled
    );

    const waRes = await sendWhatsAppText(
      targetPhone,
      message,
      undefined,
      { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY }
    );

    return c.json({ success: true, waResponse: waRes });
  } finally {
    await close();
  }
});

// POST /billing/orders/:id/void
app.post('/orders/:id/void', requirePermission('order:void'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');
  const actorPhone = c.get('actorPhone');

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select({ status: appSchema.saleOrder.status, outletId: appSchema.saleOrder.outletId })
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }
    if (order.status !== 'OPEN' && order.status !== 'PARTIAL') return c.json({ error: 'Conflict', message: 'Only OPEN or PARTIAL orders can be voided' }, 409);

    const now = new Date();
    const actorIdentity = actorPhone || 'Staff';
    const actorRole = tenant.role || 'STAFF';

    const items = await db
      .select()
      .from(appSchema.saleOrderItem)
      .where(eq(appSchema.saleOrderItem.orderId, orderId));

    const audits = items
      .filter((i: any) => i.status !== 'CANCELLED')
      .map((i: any) => ({
        id: generateId('audit'),
        orderId,
        orderItemId: i.id,
        fromStatus: i.status,
        toStatus: 'CANCELLED',
        changedBy: actorIdentity,
        changedByRole: actorRole,
        createdAt: now,
      }));

    await db.transaction(async (tx: any) => {
      await tx
        .update(appSchema.saleOrderItem)
        .set({ status: 'CANCELLED', updatedAt: now, updatedBy: actorIdentity })
        .where(eq(appSchema.saleOrderItem.orderId, orderId));

      if (audits.length > 0) {
        await tx.insert(appSchema.orderItemAudit).values(audits);
      }

      await tx
        .update(appSchema.saleOrder)
        .set({ status: 'VOID', orderStatus: 'CANCELLED', tableFreedAt: now, updatedAt: now, updatedBy: actorIdentity })
        .where(eq(appSchema.saleOrder.id, orderId));
    });

    const result = await getOrderWithItems(db, orderId, restaurantId);
    await invalidateReports(kv(c), restaurantId);
    return c.json(result);
  } finally {
    await close();
  }
});

// PATCH /billing/orders/:id/mark-kot-printed
app.patch('/orders/:id/mark-kot-printed', requirePermission('order:create'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select({ id: appSchema.saleOrder.id, kotPrintedAt: appSchema.saleOrder.kotPrintedAt, outletId: appSchema.saleOrder.outletId })
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }

    // Only set if not already marked
    if (!order.kotPrintedAt) {
      await db
        .update(appSchema.saleOrder)
        .set({ kotPrintedAt: new Date(), updatedAt: new Date() })
        .where(eq(appSchema.saleOrder.id, orderId));
    }

    const result = await getOrderWithItems(db, orderId, restaurantId);
    return c.json(result);
  } finally {
    await close();
  }
});

// PATCH /billing/orders/:id/mark-ready — kitchen marks an order ready for pickup
app.patch('/orders/:id/mark-ready', requirePermission('order:read'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const orderId = c.req.param('id');
  const actorPhone = c.get('actorPhone');

  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .select({ id: appSchema.saleOrder.id, outletId: appSchema.saleOrder.outletId })
      .from(appSchema.saleOrder)
      .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
    if (!order) return c.json({ error: 'Not Found' }, 404);
    if (!(await assertOutletAccess(db, tenant, order.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }

    const now = new Date();
    const actorIdentity = actorPhone || 'Kitchen';
    const actorRole = tenant.role || 'KITCHEN';

    const items = await db
      .select()
      .from(appSchema.saleOrderItem)
      .where(eq(appSchema.saleOrderItem.orderId, orderId));

    const audits = items
      .filter((i: any) => i.status === 'ORDERED' || i.status === 'PREPARING')
      .map((i: any) => ({
        id: generateId('audit'),
        orderId,
        orderItemId: i.id,
        fromStatus: i.status,
        toStatus: 'PREPARED',
        changedBy: actorIdentity,
        changedByRole: actorRole,
        createdAt: now,
      }));

    await db.transaction(async (tx: any) => {
      await tx
        .update(appSchema.saleOrderItem)
        .set({ status: 'PREPARED', updatedAt: now, updatedBy: actorIdentity })
        .where(
          and(
            eq(appSchema.saleOrderItem.orderId, orderId),
            or(
              eq(appSchema.saleOrderItem.status, 'ORDERED'),
              eq(appSchema.saleOrderItem.status, 'PREPARING'),
            ),
          ),
        );

      if (audits.length > 0) {
        await tx.insert(appSchema.orderItemAudit).values(audits);
      }

      await tx
        .update(appSchema.saleOrder)
        .set({ readyAt: now, orderStatus: 'PREPARED', updatedAt: now, updatedBy: actorIdentity })
        .where(eq(appSchema.saleOrder.id, orderId));
    });

    const result = await getOrderWithItems(db, orderId, restaurantId);
    return c.json(result);
  } finally {
    await close();
  }
});

export { app as billingRoutes };
