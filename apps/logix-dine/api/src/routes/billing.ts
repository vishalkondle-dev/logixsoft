import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, hasOutletAccess } from '../lib/tenancy';
import { isAllOutletRole } from '@logixsoft/logix-dine/types/roles';
import type { RestaurantRole } from '@logixsoft/logix-dine/types/roles';
import {
  StartOrderSchema,
  AddOrderItemSchema,
  UpdateOrderItemSchema,
  SettleOrderSchema,
} from '@logixsoft/logix-dine/schemas/pos';
import { toRestaurant, toOutlet, toCategory, toMenuItem, toOrderWithItems, toOrder } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';

const app = new Hono<{ Bindings: AuthEnv & { HYPERDRIVE?: { connectionString: string } } }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

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
  const { db, close } = getDb(c);
  try {
    const [rest] = await db.select().from(appSchema.restaurant).where(eq(appSchema.restaurant.id, restaurantId));
    const outlets = await db.select().from(appSchema.restaurantOutlet).where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));
    const categories = await db.select().from(appSchema.menuCategory).where(and(eq(appSchema.menuCategory.restaurantId, restaurantId), eq(appSchema.menuCategory.active, true)));
    const items = await db.select().from(appSchema.menuItem).where(eq(appSchema.menuItem.restaurantId, restaurantId));

    return c.json({
      restaurant: toRestaurant(rest),
      outlets: outlets.map(toOutlet),
      categories: categories.map(toCategory),
      items: items.map(toMenuItem),
    });
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
    // Verify outlet belongs to restaurant
    const [outlet] = await db
      .select({ id: appSchema.restaurantOutlet.id })
      .from(appSchema.restaurantOutlet)
      .where(and(eq(appSchema.restaurantOutlet.id, parsed.data.outletId), eq(appSchema.restaurantOutlet.restaurantId, restaurantId)))
      .limit(1);
    if (!outlet) return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);

    // Non-owner roles may only start orders in an outlet they're assigned to
    if (!(await assertOutletAccess(db, tenant, parsed.data.outletId))) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }

    // Generate orderNo (MAX + 1 per restaurant, in transaction)
    const now = new Date();
    const id = generateId('order');

    await db.transaction(async (tx: any) => {
      const [{ maxNo }] = await tx
        .select({ maxNo: sql<number>`COALESCE(MAX("orderNo"), 0)` })
        .from(appSchema.saleOrder)
        .where(eq(appSchema.saleOrder.restaurantId, restaurantId));

      await tx.insert(appSchema.saleOrder).values({
        id,
        restaurantId,
        outletId: parsed.data.outletId,
        orderNo: (maxNo ?? 0) + 1,
        tableNo: parsed.data.tableNo ?? null,
        status: 'OPEN',
        subtotalPaise: 0,
        note: parsed.data.note ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });
    });

    const result = await getOrderWithItems(db, id, restaurantId);
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
      await db
        .update(appSchema.saleOrderItem)
        .set({ qty: existing.qty + (parsed.data.qty ?? 1) })
        .where(eq(appSchema.saleOrderItem.id, existing.id));
    } else {
      await db.insert(appSchema.saleOrderItem).values({
        id: generateId('oi'),
        orderId,
        itemId: menuItem.id,
        nameSnapshot: menuItem.name,
        pricePaiseSnapshot: menuItem.pricePaise,
        qty: parsed.data.qty ?? 1,
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

// PATCH /billing/orders/:id/items/:orderItemId — update qty
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

    await db
      .update(appSchema.saleOrderItem)
      .set({ qty: Math.max(1, parsed.data.qty) })
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
    await db
      .update(appSchema.saleOrder)
      .set({
        status: 'PAID',
        method: parsed.data.method ?? null,
        settledAt: now,
        settledByUserId: user.id,
        updatedAt: now,
        updatedBy: actorPhone,
      })
      .where(eq(appSchema.saleOrder.id, orderId));

    const result = await getOrderWithItems(db, orderId, restaurantId);
    return c.json(result);
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
