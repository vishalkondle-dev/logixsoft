import { Hono } from 'hono';
import { sql, eq, and, desc, inArray, or, isNull, asc } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requireAuth } from '../lib/tenancy';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { broadcastToCustomer, broadcastToOutlet } from '../lib/sync';
import {
  getDb,
  getPhoneVariants,
  generateOrderId,
  getNextDailyTokenNo,
  resolveOrderItemDetails,
  recomputeTotal,
} from '../lib/order-helpers';
import { toOrderWithItems } from '@logixsoft/logix-dine/mappers/pos';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

function checkIsNonVeg(name?: string | null): boolean {
  if (!name) return false;
  return /chicken|mutton|fish|prawn|egg|lamb|meat|keema|beef|pork|seafood/i.test(name) && !/veg/i.test(name);
}

// ─── GET /portal/session ──────────────────────────────────────────────────────
async function handleGetPortalSession(c: any) {
  const sessionUser = c.get('sessionUser') as any;
  const phone = sessionUser?.phoneNumber;

  if (!phone) {
    return c.json({ error: 'Missing Phone', message: 'No phone number associated with current session' }, 400);
  }

  const { rawDigits, variants } = getPhoneVariants(String(phone));
  const { db, close } = getDb(c);

  try {
    const orders = await db
      .select()
      .from(appSchema.saleOrder)
      .where(
        or(
          inArray(appSchema.saleOrder.customerPhone, variants),
          sql`${appSchema.saleOrder.customerPhone} LIKE ${'%' + rawDigits}`
        )
      )
      .orderBy(desc(appSchema.saleOrder.createdAt));

    const orderIds = orders.map((o: any) => o.id);
    const outletIds = Array.from(new Set(orders.map((o: any) => o.outletId).filter(Boolean)));
    const restaurantIds = Array.from(new Set(orders.map((o: any) => o.restaurantId).filter(Boolean)));

    const outletRows = outletIds.length > 0
      ? await db
          .select({
            id: appSchema.restaurantOutlet.id,
            name: appSchema.restaurantOutlet.name,
            address: appSchema.restaurantOutlet.address,
            phone: appSchema.restaurantOutlet.phone,
            upiId: appSchema.restaurantOutlet.upiId,
            diningSettings: appSchema.restaurantOutlet.diningSettings,
            qrMenuSettings: appSchema.restaurantOutlet.qrMenuSettings,
          })
          .from(appSchema.restaurantOutlet)
          .where(inArray(appSchema.restaurantOutlet.id, outletIds as string[]))
      : [];
    const outletMap = new Map<string, { name: string; address?: string | null; phone?: string | null; upiId?: string | null; qrMenuSettings?: any; diningSettings?: any }>(
      outletRows.map((o: any) => [o.id, o])
    );

    const restRows = restaurantIds.length > 0
      ? await db
          .select({
            id: appSchema.restaurant.id,
            name: appSchema.restaurant.name,
            phone: appSchema.restaurant.phone,
          })
          .from(appSchema.restaurant)
          .where(inArray(appSchema.restaurant.id, restaurantIds as string[]))
      : [];
    const restMap = new Map<string, { name: string; phone?: string | null }>(
      restRows.map((r: any) => [r.id, r])
    );

    const itemRows = orderIds.length > 0
      ? await db
          .select()
          .from(appSchema.saleOrderItem)
          .where(inArray(appSchema.saleOrderItem.orderId, orderIds))
          .orderBy(asc(appSchema.saleOrderItem.createdAt), asc(appSchema.saleOrderItem.id))
      : [];

    const deliveryRows = orderIds.length > 0
      ? await db
          .select()
          .from(appSchema.deliveryOrder)
          .where(inArray(appSchema.deliveryOrder.orderId, orderIds))
      : [];
    const deliveryMap = new Map<string, any>(deliveryRows.map((d: any) => [d.orderId, d]));

    const waiterRequestRows = orderIds.length > 0
      ? await db
          .select()
          .from(appSchema.waiterRequest)
          .where(
            and(
              inArray(appSchema.waiterRequest.orderId, orderIds),
              or(
                eq(appSchema.waiterRequest.status, 'PENDING'),
                eq(appSchema.waiterRequest.status, 'IN_PROGRESS'),
                and(
                  eq(appSchema.waiterRequest.status, 'COMPLETED'),
                  sql`${appSchema.waiterRequest.completedAt} >= NOW() - INTERVAL '15 minutes'`
                )
              )
            )
          )
          .orderBy(desc(appSchema.waiterRequest.createdAt))
      : [];
    const waiterRequestMap = new Map<string, any>();
    for (const wr of waiterRequestRows) {
      if (wr.orderId && !waiterRequestMap.has(wr.orderId)) {
        waiterRequestMap.set(wr.orderId, wr);
      }
    }

    // Batch fetch customer reviews/feedback for these orders
    const feedbackRows = orderIds.length > 0
      ? await db
          .select()
          .from(appSchema.orderFeedback)
          .where(inArray(appSchema.orderFeedback.orderId, orderIds))
      : [];
    const feedbackMap = new Map<string, any>(feedbackRows.map((f: any) => [f.orderId, f]));

    const reviewIds = feedbackRows.map((f: any) => f.id);
    const itemFeedbackRows = reviewIds.length > 0
      ? await db
          .select({
            id: appSchema.orderItemFeedback.id,
            reviewId: appSchema.orderItemFeedback.reviewId,
            menuItemId: appSchema.orderItemFeedback.menuItemId,
            rating: appSchema.orderItemFeedback.rating,
            comment: appSchema.orderItemFeedback.comment,
          })
          .from(appSchema.orderItemFeedback)
          .where(inArray(appSchema.orderItemFeedback.reviewId, reviewIds))
      : [];
    const itemFeedbackMap = new Map<string, any[]>();
    for (const ifb of itemFeedbackRows) {
      const list = itemFeedbackMap.get(ifb.reviewId) || [];
      list.push(ifb);
      itemFeedbackMap.set(ifb.reviewId, list);
    }

    const itemsByOrder = new Map<string, any[]>();
    for (const item of itemRows) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    const activeOrdersList: any[] = [];
    const pastOrdersList: any[] = [];

    for (const ord of orders) {
      const items = itemsByOrder.get(ord.id) ?? [];
      const del = deliveryMap.get(ord.id) ?? null;
      const wr = waiterRequestMap.get(ord.id) ?? null;
      const outletInfo = outletMap.get(ord.outletId) ?? { name: 'Restaurant' };
      const restInfo = restMap.get(ord.restaurantId) ?? { name: 'Restaurant' };

      const isTakeaway = (ord.tableNo || '').toLowerCase() === 'takeaway' || ord.orderType === 'TAKEAWAY';
      const isDelivery = ord.orderType === 'DELIVERY' || (ord.tableNo || '').toLowerCase() === 'delivery' || Boolean(del);
      const isDineIn = !isTakeaway && !isDelivery;

      const isActive =
        ord.status !== 'VOID' &&
        ord.orderStatus !== 'CANCELLED' &&
        (
          (isDineIn && ord.tableFreedAt === null) ||
          (isTakeaway && ord.orderStatus !== 'SERVED') ||
          (isDelivery && del && del.status !== 'DELIVERED' && del.status !== 'CANCELLED')
        );

      const mappedOrder = {
        id: ord.id,
        orderNo: ord.orderNo,
        tokenNo: (ord as any).tokenNo ?? ord.orderNo ?? 1,
        tableNo: ord.tableNo,
        orderType: ord.orderType || (isDelivery ? 'DELIVERY' : isTakeaway ? 'TAKEAWAY' : 'DINE_IN'),
        restaurantId: ord.restaurantId,
        restaurantName: restInfo.name || 'Restaurant',
        restaurantPhone: restInfo.phone || null,
        outletId: ord.outletId,
        outletName: outletInfo.name || 'Outlet',
        outletAddress: outletInfo.address || null,
        outletPhone: outletInfo.phone || null,
        subtotalPaise: ord.subtotalPaise,
        paidPaise: ord.paidPaise,
        status: ord.status,
        orderStatus: ord.orderStatus,
        method: ord.method || (ord.status === 'PAID' ? 'Paid' : 'Unpaid'),
        settledAt: ord.settledAt instanceof Date ? ord.settledAt.toISOString() : (ord.settledAt || null),
        note: ord.note || null,
        packagingChargePaise: ord.packagingChargePaise || 0,
        deliveryChargePaise: ord.deliveryChargePaise || 0,
        createdAt: ord.createdAt instanceof Date ? ord.createdAt.toISOString() : ord.createdAt,
        updatedAt: ord.updatedAt instanceof Date ? ord.updatedAt.toISOString() : ord.updatedAt,
        qrMenuSettings: outletInfo.qrMenuSettings || null,
        diningSettings: outletInfo.diningSettings || null,
        outlet: {
          id: ord.outletId,
          name: outletInfo.name,
          address: outletInfo.address,
          phone: outletInfo.phone,
          restaurantName: restInfo.name,
          upiId: outletInfo.upiId || null,
          qrMenuSettings: outletInfo.qrMenuSettings || null,
          diningSettings: outletInfo.diningSettings || null,
        },
        items: items.map((it: any) => ({
          id: it.id,
          itemId: it.itemId,
          name: it.nameSnapshot || it.name,
          pricePaise: it.pricePaiseSnapshot || it.pricePaise,
          qty: it.qty,
          round: it.round || 1,
          status: it.status || 'ORDERED',
          paymentStatus: it.paymentStatus || 'UNPAID',
          variant: it.variant,
          addons: it.addons || [],
          note: it.note,
          isNonVeg: checkIsNonVeg(it.nameSnapshot || it.name),
        })),
        itemsCount: items.filter((i: any) => i.status !== 'CANCELLED').reduce((sum: number, it: any) => sum + (Number(it.qty) || 1), 0),
        delivery: del ? {
          status: del.status,
          addressLine1: del.addressLine1,
          landmark: del.landmark,
          deliveryOtp: del.deliveryOtp,
          riderName: del.riderName,
          riderPhone: del.riderPhone,
        } : null,
        activeWaiterRequest: wr ? {
          id: wr.id,
          serviceType: wr.serviceType,
          serviceLabel: wr.serviceLabel,
          status: wr.status,
          createdAt: wr.createdAt instanceof Date ? wr.createdAt.toISOString() : wr.createdAt,
        } : null,
        feedback: (() => {
          const fb = feedbackMap.get(ord.id);
          if (!fb) return null;
          return {
            id: fb.id,
            orderId: fb.orderId,
            rating: fb.rating,
            foodRating: fb.foodRating,
            serviceRating: fb.serviceRating,
            deliveryRating: fb.deliveryRating,
            tags: (fb.tags as string[]) || [],
            comment: fb.comment || null,
            isAnonymous: fb.isAnonymous,
            ownerReply: fb.ownerReply || null,
            ownerRepliedAt: fb.ownerRepliedAt instanceof Date ? fb.ownerRepliedAt.toISOString() : fb.ownerRepliedAt,
            createdAt: fb.createdAt instanceof Date ? fb.createdAt.toISOString() : fb.createdAt,
            updatedAt: fb.updatedAt instanceof Date ? fb.updatedAt.toISOString() : fb.updatedAt,
            itemRatings: itemFeedbackMap.get(fb.id) || [],
          };
        })(),
      };

      if (isActive) {
        activeOrdersList.push(mappedOrder);
      } else {
        pastOrdersList.push(mappedOrder);
      }
    }

    const totalOrdersCount = orders.length;
    let lifetimeSpendPaise = 0;
    let vegItemsCount = 0;
    let nonVegItemsCount = 0;
    const dishCountMap = new Map<string, { name: string; qty: number; isNonVeg: boolean }>();

    for (const ord of pastOrdersList) {
      lifetimeSpendPaise += (ord.paidPaise || ord.subtotalPaise || 0);
    }

    for (const item of itemRows) {
      const isNonVeg = checkIsNonVeg(item.nameSnapshot);
      if (isNonVeg) {
        nonVegItemsCount += (item.qty || 1);
      } else {
        vegItemsCount += (item.qty || 1);
      }
      const name = item.nameSnapshot;
      const existing = dishCountMap.get(name);
      if (existing) {
        existing.qty += item.qty;
      } else {
        dishCountMap.set(name, { name, qty: item.qty, isNonVeg });
      }
    }

    const favoriteDishes = Array.from(dishCountMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4);

    return c.json({
      customer: {
        id: sessionUser?.id,
        phone: String(phone),
        name: sessionUser?.name || null,
        email: sessionUser?.email || null,
      },
      stats: {
        lifetimeSpendPaise,
        totalOrdersCount,
        vegItemsCount,
        nonVegItemsCount,
        favoriteDishes,
      },
      activeOrders: activeOrdersList,
      pastOrders: pastOrdersList,
    });
  } finally {
    await close();
  }
}

app.get(
  '/session',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Get Customer Portal Session',
    description: 'Retrieves active orders, order history, and profile for current guest.',
    responses: { 200: z.any(), 401: ErrorResponseSchema },
  }),
  requireAuth(),
  handleGetPortalSession
);

// ─── GET /portal/menu/:outletId ───────────────────────────────────────────────
async function handleGetCustomerMenu(c: any) {
  const outletId = c.req.param('outletId') || c.req.query('outletId');
  if (!outletId) {
    return c.json({ error: 'Bad Request', message: 'outletId parameter is required' }, 400);
  }

  const { db, close } = getDb(c);
  try {
    const [outlet] = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, outletId))
      .limit(1);

    if (!outlet) return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);

    const categories = await db
      .select()
      .from(appSchema.menuCategory)
      .where(
        and(
          eq(appSchema.menuCategory.restaurantId, outlet.restaurantId),
          or(eq(appSchema.menuCategory.outletId, outletId), isNull(appSchema.menuCategory.outletId))
        )
      )
      .orderBy(appSchema.menuCategory.sortOrder);

    const items = await db
      .select()
      .from(appSchema.menuItem)
      .where(
        and(
          eq(appSchema.menuItem.restaurantId, outlet.restaurantId),
          or(eq(appSchema.menuItem.outletId, outletId), isNull(appSchema.menuItem.outletId))
        )
      );

    return c.json({
      outlet: {
        id: outlet.id,
        name: outlet.name,
        address: outlet.address,
        phone: outlet.phone,
      },
      categories,
      items: items.map((it: any) => ({
        ...it,
        ratingAvg: it.ratingAvg != null ? Number(it.ratingAvg) : null,
        ratingCount: it.ratingCount != null ? Number(it.ratingCount) : 0,
        isNonVeg: checkIsNonVeg(it.name),
      })),
    });
  } finally {
    await close();
  }
}

app.get(
  '/menu/:outletId',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Get Customer Menu',
    description: 'Fetches digital menu catalog for customers.',
    responses: { 200: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  handleGetCustomerMenu
);

// ─── POST /portal/send-order ──────────────────────────────────────────────────
const CustomerSendOrderSchema = z.object({
  outletId: z.string(),
  tableNo: z.string().optional(),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).optional(),
  items: z.array(
    z.object({
      itemId: z.string(),
      qty: z.number().int().positive().default(1),
      variantId: z.string().optional(),
      addonIds: z.array(z.string()).optional(),
      note: z.string().max(250).optional(),
    })
  ).min(1),
  note: z.string().max(500).optional(),
  customerName: z.string().max(100).optional(),
});

app.post(
  '/send-order',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Customer Send Order',
    description: 'Places a self-service order directly from table QR code.',
    body: CustomerSendOrderSchema,
    responses: { 201: z.any(), 400: ErrorResponseSchema, 401: ErrorResponseSchema },
  }),
  requireAuth(),
  async (c) => {
    const sessionUser = c.get('sessionUser') as any;
    const customerPhone = sessionUser?.phoneNumber;

    if (!customerPhone) {
      return c.json({ error: 'Missing Phone', message: 'Sign in required to place orders' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = CustomerSendOrderSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { db, close } = getDb(c);
    try {
      const [outlet] = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, parsed.data.outletId))
        .limit(1);

      if (!outlet) return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);

      const restaurantId = outlet.restaurantId;
      const orderId = generateOrderId(parsed.data.outletId);
      const now = new Date();
      let tokenNo = 1;

      const menuItems = await db
        .select()
        .from(appSchema.menuItem)
        .where(eq(appSchema.menuItem.restaurantId, restaurantId));
      const menuMap = new Map(menuItems.map((m: any) => [m.id, m]));

      let subtotalPaise = 0;
      const itemsToInsert: any[] = [];
      let idx = 0;

      for (const item of parsed.data.items) {
        const menuItem = menuMap.get(item.itemId) as any;
        if (!menuItem) continue;
        const { nameSnapshot, pricePaiseSnapshot, variant, addons } = resolveOrderItemDetails(menuItem, item);
        subtotalPaise += pricePaiseSnapshot * item.qty;
        const itemCreatedAt = new Date(now.getTime() + idx++);
        itemsToInsert.push({
          id: generateId('orderItem'),
          orderId,
          itemId: item.itemId,
          nameSnapshot,
          pricePaiseSnapshot,
          qty: item.qty,
          variant,
          addons,
          round: 1,
          status: 'ORDERED',
          paymentStatus: 'UNPAID',
          note: item.note ? item.note.trim() : null,
          createdAt: itemCreatedAt,
          updatedAt: itemCreatedAt,
          createdBy: customerPhone,
          updatedBy: customerPhone,
        });
      }

      const orderType = parsed.data.orderType || (parsed.data.tableNo && parsed.data.tableNo !== 'Takeaway' ? 'DINE_IN' : 'TAKEAWAY');
      const isTableOrder = Boolean(orderType === 'DINE_IN' && parsed.data.tableNo && parsed.data.tableNo !== 'Takeaway');

      await db.transaction(async (tx: any) => {
        // Lock outlet row to serialize order sequence generation under concurrency
        await tx.execute(sql`SELECT id FROM "restaurantOutlet" WHERE id = ${parsed.data.outletId} FOR UPDATE`);
        tokenNo = await getNextDailyTokenNo(tx, parsed.data.outletId);

        await tx.insert(appSchema.saleOrder).values({
          id: orderId,
          restaurantId,
          outletId: parsed.data.outletId,
          orderNo: tokenNo,
          tableNo: parsed.data.tableNo ?? (orderType === 'TAKEAWAY' ? 'Takeaway' : null),
          customerPhone,
          status: 'OPEN',
          orderStatus: 'ORDERED',
          subtotalPaise,
          paidPaise: 0,
          note: parsed.data.note ?? null,
          orderType,
          tableFreedAt: isTableOrder ? null : now,
          createdAt: now,
          updatedAt: now,
          createdBy: customerPhone,
          updatedBy: customerPhone,
        });

        if (itemsToInsert.length > 0) {
          await tx.insert(appSchema.saleOrderItem).values(itemsToInsert);
          const audits = itemsToInsert.map((item) => ({
            id: generateId('audit'),
            orderId,
            orderItemId: item.id,
            fromStatus: null,
            toStatus: 'ORDERED',
            changedBy: customerPhone,
            changedByRole: 'CUSTOMER',
            createdAt: now,
          }));
          await tx.insert(appSchema.orderItemAudit).values(audits);
        }
      });

      await broadcastToOutlet(
        c.env,
        parsed.data.outletId,
        {
          topic: 'KITCHEN',
          type: 'ORDER_CREATED',
          data: { orderId, tokenNo, tableNo: parsed.data.tableNo },
        },
        customerPhone
      );

      return c.json({ success: true, orderId, orderNo: tokenNo }, 201);
    } finally {
      await close();
    }
  }
);

// ─── POST /portal/add-round ───────────────────────────────────────────────────
const CustomerAddRoundSchema = z.object({
  orderId: z.string(),
  items: z.array(
    z.object({
      itemId: z.string(),
      qty: z.number().int().positive().default(1),
      variantId: z.string().optional(),
      addonIds: z.array(z.string()).optional(),
      note: z.string().max(250).optional(),
    })
  ).min(1),
  roundNote: z.string().max(250).optional(),
});

app.post(
  '/add-round',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Customer Add Round to Order',
    description: 'Customer orders additional items for their active table.',
    body: CustomerAddRoundSchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requireAuth(),
  async (c) => {
    const sessionUser = c.get('sessionUser') as any;
    const customerPhone = sessionUser?.phoneNumber;

    if (!customerPhone) {
      return c.json({ error: 'Missing Phone', message: 'Sign in required' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = CustomerAddRoundSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { orderId, items: newItems, roundNote } = parsed.data;
    const { db, close } = getDb(c);

    try {
      const [order] = await db
        .select()
        .from(appSchema.saleOrder)
        .where(eq(appSchema.saleOrder.id, orderId))
        .limit(1);

      if (!order) return c.json({ error: 'Not Found', message: 'Order not found' }, 404);

      let qrSettings: any = null;
      if (order.outletId) {
        const [outlet] = await db
          .select({ qrMenuSettings: appSchema.restaurantOutlet.qrMenuSettings })
          .from(appSchema.restaurantOutlet)
          .where(eq(appSchema.restaurantOutlet.id, order.outletId))
          .limit(1);
        qrSettings = outlet?.qrMenuSettings;
      }

      if (qrSettings && qrSettings.allowCustomerOrdering === false) {
        return c.json({ error: 'Disabled', message: 'Customer ordering is currently disabled for this outlet.' }, 403);
      }

      const existingItems = await db
        .select({ round: appSchema.saleOrderItem.round })
        .from(appSchema.saleOrderItem)
        .where(eq(appSchema.saleOrderItem.orderId, orderId));

      const maxRound = existingItems.reduce((max: number, it: any) => Math.max(max, it.round || 1), 0);
      const nextRound = maxRound + 1;
      const now = new Date();

      const menuItems = await db
        .select()
        .from(appSchema.menuItem)
        .where(eq(appSchema.menuItem.restaurantId, order.restaurantId));
      const menuMap = new Map(menuItems.map((m: any) => [m.id, m]));

      const itemsToInsert: any[] = [];
      let roundIdx = 0;
      for (const item of newItems) {
        const menuItem = menuMap.get(item.itemId) as any;
        if (!menuItem) continue;
        const { nameSnapshot, pricePaiseSnapshot, variant, addons } = resolveOrderItemDetails(menuItem, item);
        const itemCreatedAt = new Date(now.getTime() + roundIdx++);
        itemsToInsert.push({
          id: generateId('orderItem'),
          orderId,
          itemId: item.itemId,
          nameSnapshot,
          pricePaiseSnapshot,
          qty: item.qty,
          variant,
          addons,
          round: nextRound,
          status: 'ORDERED',
          paymentStatus: 'UNPAID',
          note: item.note ? item.note.trim() : null,
          createdAt: itemCreatedAt,
          updatedAt: itemCreatedAt,
          createdBy: customerPhone,
          updatedBy: customerPhone,
        });
      }

      await db.transaction(async (tx: any) => {
        await tx.insert(appSchema.saleOrderItem).values(itemsToInsert);

        const audits = itemsToInsert.map((item) => ({
          id: generateId('audit'),
          orderId,
          orderItemId: item.id,
          fromStatus: null,
          toStatus: 'ORDERED',
          changedBy: customerPhone,
          changedByRole: 'CUSTOMER',
          createdAt: now,
        }));
        await tx.insert(appSchema.orderItemAudit).values(audits);

        const allActiveItems = await tx
          .select({ pricePaiseSnapshot: appSchema.saleOrderItem.pricePaiseSnapshot, qty: appSchema.saleOrderItem.qty })
          .from(appSchema.saleOrderItem)
          .where(and(eq(appSchema.saleOrderItem.orderId, orderId), sql`${appSchema.saleOrderItem.status} != 'CANCELLED'`));

        const itemsTotal = allActiveItems.reduce((sum: number, it: any) => sum + it.pricePaiseSnapshot * it.qty, 0);
        const newSubtotal = itemsTotal + (order.packagingChargePaise || 0) + (order.deliveryChargePaise || 0);

        const trimmedRoundNote = roundNote?.trim();
        const updatedOrderNote = trimmedRoundNote
          ? order.note ? `${order.note} | [R${nextRound}]: ${trimmedRoundNote}` : `[R${nextRound}]: ${trimmedRoundNote}`
          : order.note;

        await tx
          .update(appSchema.saleOrder)
          .set({
            subtotalPaise: newSubtotal,
            status: order.status === 'PAID' ? 'PARTIAL' : order.status,
            orderStatus: 'ORDERED',
            note: updatedOrderNote,
            readyAt: null,
            updatedAt: now,
            updatedBy: customerPhone,
          })
          .where(eq(appSchema.saleOrder.id, orderId));
      });

      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'KITCHEN',
          type: 'ORDER_ROUND_ADDED',
          data: { orderId, round: nextRound, itemsCount: itemsToInsert.length, tableNo: order.tableNo },
        },
        customerPhone
      );

      return c.json({ success: true, round: nextRound });
    } finally {
      await close();
    }
  }
);

// ─── POST /portal/call-waiter ─────────────────────────────────────────────────
const CustomerCallWaiterSchema = z.object({
  outletId: z.string().optional(),
  tableNo: z.string().min(1).max(50).optional(),
  orderId: z.string().optional(),
  serviceType: z.enum(['WATER', 'CUTLERY', 'BILL', 'CLEAN_TABLE', 'OTHER']).default('OTHER'),
  note: z.string().max(250).optional(),
});

app.post(
  '/call-waiter',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Customer Call Waiter',
    description: 'Requests floor assistance from customer device.',
    body: CustomerCallWaiterSchema,
    responses: { 201: z.any(), 400: ErrorResponseSchema, 401: ErrorResponseSchema },
  }),
  requireAuth(),
  async (c) => {
    const sessionUser = c.get('sessionUser') as any;
    const customerPhone = sessionUser?.phoneNumber;

    if (!customerPhone) {
      return c.json({ error: 'Missing Phone', message: 'Sign in required' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = CustomerCallWaiterSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { db, close } = getDb(c);
    try {
      let outletId = parsed.data.outletId;
      let tableNo = parsed.data.tableNo;
      let restaurantId: string | null = null;

      if (parsed.data.orderId) {
        const [order] = await db
          .select()
          .from(appSchema.saleOrder)
          .where(eq(appSchema.saleOrder.id, parsed.data.orderId))
          .limit(1);

        if (order) {
          if (!outletId) outletId = order.outletId;
          if (!tableNo) tableNo = order.tableNo || 'Table';
          restaurantId = order.restaurantId;
        }
      }

      if (!outletId || !tableNo) {
        return c.json({ error: 'Bad Request', message: 'outletId and tableNo are required (or a valid orderId)' }, 400);
      }

      const [outlet] = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .limit(1);

      if (!outlet) return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);

      if (!restaurantId) {
        restaurantId = outlet.restaurantId;
      }

      const qrSettings = (outlet.qrMenuSettings as any) || null;
      if (qrSettings && qrSettings.allowCallWaiter === false) {
        return c.json({ error: 'Disabled', message: 'Floor service calls are currently disabled for this outlet.' }, 403);
      }

      const id = `wr_${generateId()}`;
      const now = new Date();

      const [newRow] = await db
        .insert(appSchema.waiterRequest)
        .values({
          id,
          restaurantId,
          outletId,
          orderId: parsed.data.orderId || null,
          tableNo,
          serviceType: parsed.data.serviceType,
          serviceLabel: parsed.data.serviceType,
          note: parsed.data.note || null,
          customerPhone,
          status: 'PENDING',
          createdBy: customerPhone,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await broadcastToOutlet(
        c.env,
        outletId,
        {
          topic: 'ORDERS',
          type: 'WAITER_CALL',
          data: {
            id,
            tableNo,
            serviceType: parsed.data.serviceType,
            serviceLabel: parsed.data.serviceType,
            note: parsed.data.note || null,
            customerPhone,
            timestamp: now.getTime(),
          },
        },
        customerPhone
      );

      return c.json({
        ...newRow,
        success: true,
        serviceLabel: newRow.serviceLabel || parsed.data.serviceType,
      }, 201);
    } finally {
      await close();
    }
  }
);

// ─── POST /portal/update-profile ──────────────────────────────────────────────
const CustomerProfileSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
});

app.post(
  '/update-profile',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Update Customer Profile',
    description: 'Updates customer profile details.',
    body: CustomerProfileSchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 401: ErrorResponseSchema },
  }),
  requireAuth(),
  async (c) => {
    const sessionUser = c.get('sessionUser') as any;
    const phone = sessionUser?.phoneNumber;

    if (!phone) {
      return c.json({ error: 'Missing Phone', message: 'Sign in required' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = CustomerProfileSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { db, close } = getDb(c);
    try {
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (parsed.data.name) updates.name = parsed.data.name;
      if (parsed.data.email) updates.email = parsed.data.email;

      await db
        .update(appSchema.user)
        .set(updates)
        .where(eq(appSchema.user.id, String(sessionUser.id)));

      broadcastToCustomer(c.env, phone, {
        topic: 'CUSTOMER',
        type: 'PROFILE_UPDATED',
        data: { name: parsed.data.name, email: parsed.data.email },
      });

      return c.json({ success: true, message: 'Profile updated' });
    } finally {
      await close();
    }
  }
);

export { app as portalRoutes };
