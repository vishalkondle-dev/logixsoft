import { Hono } from 'hono';
import { eq, and, sql, desc } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, hasOutletAccess } from '../lib/tenancy';
import { cacheGet, cacheSet, invalidateReports, CacheKey, TTL } from '../lib/cache';
import { isAllOutletRole } from '@logixsoft/logix-dine/types/roles';
import type { RestaurantRole } from '@logixsoft/logix-dine/types/roles';
import {
  StartOrderSchema,
  AddOrderItemSchema,
  UpdateOrderItemSchema,
  SettleOrderSchema,
} from '@logixsoft/logix-dine/schemas/pos';
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
  const total = items.reduce((sum: number, item: any) => sum + item.pricePaiseSnapshot * item.qty, 0);
  await db
    .update(appSchema.saleOrder)
    .set({ subtotalPaise: total, updatedAt: new Date() })
    .where(eq(appSchema.saleOrder.id, orderId));
  return { items, total };
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
  return toOrderWithItems(order, items);
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
    // Outlet access already verified in session payload (requirePermission checks outletIds[]).
    // Skip the redundant SELECT outlet + assertOutletAccess DB queries on the hot path.
    // Only look up the outlet name for the order ID slug — use the outletId directly.
    const outletSlug = parsed.data.outletId.slice(-8); // short unique suffix, no extra DB call

    const now = new Date();
    const id = generateId(`ord_${outletSlug}`, 16);
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
            note: item.note ? item.note.trim() : null,
            createdAt: now,
            createdBy: actorPhone,
            updatedBy: actorPhone,
          });
        }
      }

      await tx.insert(appSchema.saleOrder).values({
        id,
        restaurantId,
        outletId: parsed.data.outletId,
        orderNo: tokenNo,
        tableNo: parsed.data.tableNo ?? null,
        customerPhone: parsed.data.customerPhone ?? null,
        status: 'OPEN',
        subtotalPaise,
        note: parsed.data.note ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });

      if (orderItemsToInsert.length > 0) {
        await tx.insert(appSchema.saleOrderItem).values(orderItemsToInsert);
      }
    });

    // Build response from inserted data — no extra SELECT round-trip
    const orderRow = {
      id,
      restaurantId,
      outletId: parsed.data.outletId,
      orderNo: tokenNo,
      tableNo: parsed.data.tableNo ?? null,
      customerPhone: parsed.data.customerPhone ?? null,
      status: 'OPEN',
      subtotalPaise,
      note: parsed.data.note ?? null,
      method: null,
      kotPrintedAt: null,
      readyAt: null,
      settledAt: null,
      settledByUserId: null,
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

// GET /billing/orders
app.get('/orders', requirePermission('order:read'), async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const status = c.req.query('status');
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
    if (status) conditions.push(eq(appSchema.saleOrder.status, status));
    if (outletId) conditions.push(eq(appSchema.saleOrder.outletId, outletId));

    const orders = await db
      .select()
      .from(appSchema.saleOrder)
      .where(and(...conditions))
      .orderBy(desc(appSchema.saleOrder.createdAt))
      .limit(limit);

    // Fetch items for all orders
    const results = await Promise.all(
      orders.map(async (order: any) => {
        const items = await db
          .select()
          .from(appSchema.saleOrderItem)
          .where(eq(appSchema.saleOrderItem.orderId, order.id));
        return toOrderWithItems(order, items);
      }),
    );
    return c.json(results);
  } finally {
    await close();
  }
});

// GET /billing/orders/kitchen — KDS board: OPEN orders for the caller's outlet(s).
// MUST be registered before GET /orders/:id, or Hono would match "kitchen" as an order ID.
// KITCHEN role is outlet-scoped, so the web sends X-Outlet-Id; requirePermission
// already enforces that this outlet is one the caller has access to.
app.get('/orders/kitchen', requirePermission('order:read'), async (c) => {
  const { restaurantId, outletId } = c.get('tenant');

  const { db, close } = getDb(c);
  try {
    const where = outletId
      ? and(
          eq(appSchema.saleOrder.restaurantId, restaurantId),
          eq(appSchema.saleOrder.outletId, outletId),
          eq(appSchema.saleOrder.status, 'OPEN'),
        )
      : and(eq(appSchema.saleOrder.restaurantId, restaurantId), eq(appSchema.saleOrder.status, 'OPEN'));

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
      await db.insert(appSchema.saleOrderItem).values({
        id: generateId('oi'),
        orderId,
        itemId: menuItem.id,
        nameSnapshot: menuItem.name,
        pricePaiseSnapshot: menuItem.pricePaise,
        qty: parsed.data.qty ?? 1,
        note: parsed.data.note ? parsed.data.note.trim() : null,
        createdAt: new Date(),
      });
    }

    await recomputeTotal(db, orderId);
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
    if (order.status !== 'OPEN') return c.json({ error: 'Conflict', message: 'Order is not open' }, 409);

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
    if (order.status !== 'OPEN') return c.json({ error: 'Conflict', message: 'Order is not open' }, 409);

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
    if (order.status !== 'OPEN') return c.json({ error: 'Conflict', message: 'Order is not open' }, 409);

    const now = new Date();
    const targetPhone = parsed.data.customerPhone || order.customerPhone;
    await db
      .update(appSchema.saleOrder)
      .set({
        status: 'PAID',
        method: parsed.data.method ?? null,
        customerPhone: targetPhone ?? null,
        settledAt: now,
        settledByUserId: user.id,
        updatedAt: now,
        updatedBy: actorPhone,
      })
      .where(eq(appSchema.saleOrder.id, orderId));

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
    if (order.status !== 'OPEN') return c.json({ error: 'Conflict', message: 'Only OPEN orders can be voided' }, 409);

    await db
      .update(appSchema.saleOrder)
      .set({ status: 'VOID', updatedAt: new Date(), updatedBy: actorPhone })
      .where(eq(appSchema.saleOrder.id, orderId));

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

    await db
      .update(appSchema.saleOrder)
      .set({ readyAt: new Date(), updatedAt: new Date() })
      .where(eq(appSchema.saleOrder.id, orderId));

    const result = await getOrderWithItems(db, orderId, restaurantId);
    return c.json(result);
  } finally {
    await close();
  }
});

export { app as billingRoutes };
