import { Hono } from 'hono';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import { OrderWithItemsSchema } from '@logixsoft/logix-dine/schemas/pos';
import {
  computeOrderStatus,
  getNextItemStatus,
  type OrderItemStatus,
} from '@logixsoft/logix-dine/types/pos-schema';
import { toOrderWithItems } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { broadcastToOutlet } from '../lib/sync';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { getDb, recomputeTotal, getOrderWithItems } from '../lib/order-helpers';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

// ─── GET /kitchen/active-tickets ──────────────────────────────────────────────
app.get(
  '/active-tickets',
  apiDoc({
    tags: ['Kitchen'],
    summary: 'Active Kitchen Tickets',
    description: 'Fetches active tickets for the kitchen display system (unserved, not voided).',
    query: z.object({
      outletId: z.string().optional(),
    }),
    responses: {
      200: z.array(OrderWithItemsSchema),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || tenant.outletId;

    if (outletId && !assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

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
        : and(
            eq(appSchema.saleOrder.restaurantId, restaurantId),
            inArray(appSchema.saleOrder.outletId, tenant.outletIds || []),
            activeCondition,
          );

      const orders = await db
        .select()
        .from(appSchema.saleOrder)
        .where(where)
        .orderBy(appSchema.saleOrder.createdAt);

      const orderIds = orders.map((o: any) => o.id);
      const items = orderIds.length
        ? await db.select().from(appSchema.saleOrderItem).where(sql`${appSchema.saleOrderItem.orderId} IN ${orderIds}`)
        : [];
      const allDeliveries = orderIds.length
        ? await db.select().from(appSchema.deliveryOrder).where(sql`${appSchema.deliveryOrder.orderId} IN ${orderIds}`)
        : [];
      const deliveriesByOrder = new Map<string, any>(allDeliveries.map((d: any) => [d.orderId, d]));

      const itemsByOrder = new Map<string, any[]>();
      for (const item of items) {
        const list = itemsByOrder.get(item.orderId) ?? [];
        list.push(item);
        itemsByOrder.set(item.orderId, list);
      }

      const result = orders.map((order: any) =>
        toOrderWithItems(order, itemsByOrder.get(order.id) ?? [], deliveriesByOrder.get(order.id) ?? null)
      );
      return c.json(result);
    } finally {
      await close();
    }
  }
);

// ─── POST /kitchen/advance-item-status ─────────────────────────────────────────
const AdvanceItemStatusSchema = z.object({
  orderId: z.string(),
  orderItemId: z.string(),
  status: z.enum(['ORDERED', 'PREPARING', 'PREPARED', 'SERVED', 'CANCELLED']).optional(),
  action: z.enum(['next', 'close']).optional(),
});

app.post(
  '/advance-item-status',
  apiDoc({
    tags: ['Kitchen'],
    summary: 'Advance Item Status',
    description: 'Advances an item to the next preparation status or to a specific target status.',
    body: AdvanceItemStatusSchema,
    responses: {
      200: OrderWithItemsSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = c.get('actorPhone') || '';
    const body = await c.req.json().catch(() => ({}));
    const parsed = AdvanceItemStatusSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400);
    }

    const { orderId, orderItemId, status: targetStatus, action } = parsed.data;

    const { db, close } = getDb(c);
    try {
      const [order] = await db
        .select()
        .from(appSchema.saleOrder)
        .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
      if (!order) return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
      if (!assertOutletAccess(tenant, order.outletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }

      const [item] = await db
        .select()
        .from(appSchema.saleOrderItem)
        .where(and(eq(appSchema.saleOrderItem.id, orderItemId), eq(appSchema.saleOrderItem.orderId, orderId)));
      if (!item) return c.json({ error: 'Not Found', message: 'Order item not found' }, 404);

      let nextStatus: OrderItemStatus;
      if (action === 'close') {
        nextStatus = 'CANCELLED';
      } else if (action === 'next') {
        const computed = getNextItemStatus(item.status);
        if (!computed) {
          return c.json({ error: 'Bad Request', message: `Cannot advance item from '${item.status}'` }, 400);
        }
        nextStatus = computed;
      } else if (targetStatus) {
        nextStatus = targetStatus as OrderItemStatus;
      } else {
        const computed = getNextItemStatus(item.status);
        if (!computed) return c.json({ error: 'Bad Request', message: `No next status for '${item.status}'` }, 400);
        nextStatus = computed;
      }

      const now = new Date();
      const actorIdentity = actorPhone || 'Kitchen';
      const actorRole = tenant.role || 'KITCHEN';

      await db.transaction(async (tx: any) => {
        await tx
          .update(appSchema.saleOrderItem)
          .set({ status: nextStatus, updatedAt: now, updatedBy: actorIdentity })
          .where(eq(appSchema.saleOrderItem.id, orderItemId));

        await tx.insert(appSchema.orderItemAudit).values({
          id: generateId('audit'),
          orderId,
          orderItemId,
          fromStatus: item.status,
          toStatus: nextStatus,
          changedBy: actorIdentity,
          changedByRole: actorRole,
          createdAt: now,
        });

        const allItems = await tx
          .select({ status: appSchema.saleOrderItem.status })
          .from(appSchema.saleOrderItem)
          .where(eq(appSchema.saleOrderItem.orderId, orderId));
        const newOrderStatus = computeOrderStatus(allItems.map((i: any) => i.status));
        const updateOrderFields: Record<string, any> = { orderStatus: newOrderStatus, updatedAt: now, updatedBy: actorIdentity };
        if (newOrderStatus === 'PREPARED' && !order.readyAt) {
          updateOrderFields.readyAt = now;
        }

        const activeItems = allItems.filter((i: any) => i.status !== 'CANCELLED');
        const [existingOrder] = await tx
          .select({ packagingChargePaise: appSchema.saleOrder.packagingChargePaise, deliveryChargePaise: appSchema.saleOrder.deliveryChargePaise })
          .from(appSchema.saleOrder)
          .where(eq(appSchema.saleOrder.id, orderId));
        const activeItemsWithPrice = await tx
          .select({ pricePaiseSnapshot: appSchema.saleOrderItem.pricePaiseSnapshot, qty: appSchema.saleOrderItem.qty })
          .from(appSchema.saleOrderItem)
          .where(and(eq(appSchema.saleOrderItem.orderId, orderId), sql`${appSchema.saleOrderItem.status} != 'CANCELLED'`));
        const itemsTotal = activeItemsWithPrice.reduce((sum: number, it: any) => sum + (it.pricePaiseSnapshot || 0) * (it.qty || 1), 0);
        const subtotalPaise = itemsTotal + (existingOrder?.packagingChargePaise || 0) + (existingOrder?.deliveryChargePaise || 0);
        updateOrderFields.subtotalPaise = subtotalPaise;

        await tx
          .update(appSchema.saleOrder)
          .set(updateOrderFields)
          .where(eq(appSchema.saleOrder.id, orderId));
      });

      const result = await getOrderWithItems(db, orderId, restaurantId);
      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'KITCHEN',
          type: 'ITEM_STATUS_CHANGED',
          data: { orderId, orderItemId, status: nextStatus, tableNo: order.tableNo, customerPhone: order.customerPhone },
        },
        order.customerPhone
      );

      return c.json(result);
    } finally {
      await close();
    }
  }
);

// ─── POST /kitchen/cancel-item ────────────────────────────────────────────────
const CancelItemSchema = z.object({
  orderId: z.string(),
  orderItemId: z.string(),
  reason: z.string().optional(),
});

app.post(
  '/cancel-item',
  apiDoc({
    tags: ['Kitchen'],
    summary: 'Cancel Order Item',
    description: 'Cancels an item from a kitchen order ticket.',
    body: CancelItemSchema,
    responses: {
      200: OrderWithItemsSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = c.get('actorPhone') || '';
    const body = await c.req.json().catch(() => ({}));
    const parsed = CancelItemSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400);
    }

    const { orderId, orderItemId, reason } = parsed.data;

    const { db, close } = getDb(c);
    try {
      const [order] = await db
        .select()
        .from(appSchema.saleOrder)
        .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
      if (!order) return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
      if (!assertOutletAccess(tenant, order.outletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }

      const [item] = await db
        .select()
        .from(appSchema.saleOrderItem)
        .where(and(eq(appSchema.saleOrderItem.id, orderItemId), eq(appSchema.saleOrderItem.orderId, orderId)));
      if (!item) return c.json({ error: 'Not Found', message: 'Item not found' }, 404);

      const now = new Date();
      const actorIdentity = actorPhone || 'Kitchen';
      const actorRole = tenant.role || 'KITCHEN';

      await db.transaction(async (tx: any) => {
        await tx
          .update(appSchema.saleOrderItem)
          .set({ status: 'CANCELLED', updatedAt: now, updatedBy: actorIdentity })
          .where(eq(appSchema.saleOrderItem.id, orderItemId));

        await tx.insert(appSchema.orderItemAudit).values({
          id: generateId('audit'),
          orderId,
          orderItemId,
          fromStatus: item.status,
          toStatus: 'CANCELLED',
          changedBy: actorIdentity,
          changedByRole: actorRole,
          createdAt: now,
        });

        await recomputeTotal(tx, orderId);
      });

      const result = await getOrderWithItems(db, orderId, restaurantId);
      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'KITCHEN',
          type: 'ITEM_CANCELLED',
          data: { orderId, orderItemId, reason, tableNo: order.tableNo },
        },
        order.customerPhone
      );

      return c.json(result);
    } finally {
      await close();
    }
  }
);

// ─── POST /kitchen/mark-order-ready ───────────────────────────────────────────
const MarkOrderReadySchema = z.object({
  orderId: z.string(),
});

app.post(
  '/mark-order-ready',
  apiDoc({
    tags: ['Kitchen'],
    summary: 'Mark Order Ready',
    description: 'Marks all active items in an order as PREPARED and sets readyAt timestamp.',
    body: MarkOrderReadySchema,
    responses: {
      200: OrderWithItemsSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = c.get('actorPhone') || '';
    const body = await c.req.json().catch(() => ({}));
    const parsed = MarkOrderReadySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400);
    }

    const { orderId } = parsed.data;

    const { db, close } = getDb(c);
    try {
      const [order] = await db
        .select()
        .from(appSchema.saleOrder)
        .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));
      if (!order) return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
      if (!assertOutletAccess(tenant, order.outletId)) {
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
      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'KITCHEN',
          type: 'ORDER_PREPARED',
          data: { orderId, tableNo: order.tableNo, customerPhone: order.customerPhone },
        },
        order.customerPhone
      );
      return c.json(result);
    } finally {
      await close();
    }
  }
);

export { app as kitchenRoutes };
