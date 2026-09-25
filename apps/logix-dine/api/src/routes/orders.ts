import { Hono } from 'hono';
import { eq, ne, and, or, sql, desc, inArray } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import { cacheGet, cacheSet, invalidateReports, CacheKey, TTL } from '../lib/cache';
import { isAllOutletRole } from '@logixsoft/logix-dine/types/roles';
import type { RestaurantRole } from '@logixsoft/logix-dine/types/roles';
import {
  StartOrderSchema,
  CreateSettledSchema,
  AddOrderRoundSchema,
  SettleOrderSchema,
  FreeTableSchema,
  BillingBootstrapSchema,
  OrderWithItemsSchema,
} from '@logixsoft/logix-dine/schemas/pos';
import { toRestaurant, toOutlet, toCategory, toMenuItem, toOrderWithItems } from '@logixsoft/logix-dine/mappers/pos';
import { sendWhatsAppText } from '@logixsoft/wa';
import type { AuthEnv } from '../lib/auth';
import { broadcastToOutlet } from '../lib/sync';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import {
  getDb,
  generateOrderId,
  getNextDailyTokenNo,
  getTodayISTDateString,
  getPhoneVariants,
  resolveOrderItemDetails,
  recomputeTotal,
  getOrderWithItems,
  formatOrderWhatsAppMessage,
} from '../lib/order-helpers';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();
function kv(c: any) { return c.env?.CACHE; }

// ─── GET /orders/bootstrap ───────────────────────────────────────────────────
app.get(
  '/bootstrap',
  apiDoc({
    tags: ['Orders'],
    summary: 'Bootstrap POS Data',
    description: 'Fetches restaurant, outlets, categories, and menu items in a single optimized payload.',
    query: z.object({ outletId: z.string().optional() }),
    responses: { 200: BillingBootstrapSchema },
  }),
  requirePermission('menu:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || '';

    if (outletId && !assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

    const cacheKey = CacheKey.bootstrap(restaurantId, outletId);
    const cachedBs = await cacheGet<any>(kv(c), cacheKey);
    if (cachedBs) return c.json(cachedBs);

    const { db, close } = getDb(c);
    try {
      const [rest] = await db.select().from(appSchema.restaurant).where(eq(appSchema.restaurant.id, restaurantId));
      const outlets = await db.select().from(appSchema.restaurantOutlet).where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));
      const catWhere = outletId
        ? and(eq(appSchema.menuCategory.restaurantId, restaurantId), or(eq(appSchema.menuCategory.outletId, outletId), sql`${appSchema.menuCategory.outletId} IS NULL`))
        : eq(appSchema.menuCategory.restaurantId, restaurantId);
      const categories = await db.select().from(appSchema.menuCategory).where(catWhere);
      const itemWhere = outletId
        ? and(eq(appSchema.menuItem.restaurantId, restaurantId), or(eq(appSchema.menuItem.outletId, outletId), sql`${appSchema.menuItem.outletId} IS NULL`))
        : eq(appSchema.menuItem.restaurantId, restaurantId);
      const items = await db.select().from(appSchema.menuItem).where(itemWhere);

      const bsResult = {
        restaurant: rest ? toRestaurant(rest) : null,
        outlets: outlets.map(toOutlet),
        categories: categories.map(toCategory),
        items: items.map(toMenuItem),
      };
      await cacheSet(kv(c), CacheKey.bootstrap(restaurantId, outletId), bsResult, TTL.menu);
      return c.json(bsResult);
    } finally {
      await close();
    }
  }
);

// ─── POST /orders/send-to-kitchen ─────────────────────────────────────────────
app.post(
  '/send-to-kitchen',
  apiDoc({
    tags: ['Orders'],
    summary: 'Send Order to Kitchen',
    description: 'Creates a new active order, allocates daily token, snapshots item prices, and dispatches KOT.',
    body: StartOrderSchema,
    responses: {
      201: OrderWithItemsSchema,
      400: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = c.get('actorPhone') || '';
    const body = await c.req.json().catch(() => ({}));
    const parsed = StartOrderSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    if (!assertOutletAccess(tenant, parsed.data.outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${parsed.data.outletId}'` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const customerPhoneInput = parsed.data.customerPhone?.trim();
      if (customerPhoneInput) {
        const { rawDigits, variants } = getPhoneVariants(customerPhoneInput);
        if (rawDigits.length >= 7) {
          const [existingOrder] = await db
            .select({
              id: appSchema.saleOrder.id,
              orderNo: appSchema.saleOrder.orderNo,
              tableNo: appSchema.saleOrder.tableNo,
              status: appSchema.saleOrder.status,
            })
            .from(appSchema.saleOrder)
            .where(
              and(
                eq(appSchema.saleOrder.restaurantId, restaurantId),
                or(
                  eq(appSchema.saleOrder.status, 'OPEN'),
                  and(
                    sql`${appSchema.saleOrder.tableFreedAt} IS NULL`,
                    ne(appSchema.saleOrder.status, 'VOID')
                  )
                ),
                or(
                  inArray(appSchema.saleOrder.customerPhone, variants),
                  sql`${appSchema.saleOrder.customerPhone} LIKE ${'%' + rawDigits}`
                )
              )
            )
            .limit(1);

          if (existingOrder) {
            const loc = existingOrder.tableNo && existingOrder.tableNo !== 'Takeaway'
              ? `Table ${existingOrder.tableNo}`
              : 'Takeaway';
            return c.json(
              {
                error: 'Conflict',
                message: `Customer with mobile number ${customerPhoneInput} already has an active order (#${existingOrder.orderNo} on ${loc}).`,
              },
              409
            );
          }
        }
      }

      const [outlet] = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, parsed.data.outletId))
        .limit(1);

      if (!outlet) return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);

      const diningSettings = (outlet.diningSettings as any) || null;
      const computedOrderType = parsed.data.orderType || (parsed.data.delivery ? 'DELIVERY' : (parsed.data.tableNo && parsed.data.tableNo !== 'Takeaway' ? 'DINE_IN' : 'TAKEAWAY'));

      if (diningSettings) {
        if (computedOrderType === 'DELIVERY' && diningSettings.deliveryEnabled === false) {
          return c.json({ error: 'Channel Disabled', message: 'Delivery ordering is currently disabled for this outlet.' }, 400);
        }
        if (computedOrderType === 'TAKEAWAY' && diningSettings.takeawayEnabled === false) {
          return c.json({ error: 'Channel Disabled', message: 'Takeaway ordering is currently disabled for this outlet.' }, 400);
        }
        if (computedOrderType === 'DINE_IN' && diningSettings.dineInEnabled === false) {
          return c.json({ error: 'Channel Disabled', message: 'Dine-In ordering is currently disabled for this outlet.' }, 400);
        }
      }

      const id = generateOrderId(parsed.data.outletId);
      const now = new Date();
      let subtotalPaise = 0;
      const orderItemsToInsert: any[] = [];

      const istDate = getTodayISTDateString();
      const seqKey = CacheKey.outletSeq(parsed.data.outletId, istDate);
      let tokenNo = 1;

      await db.transaction(async (tx: any) => {
        // Lock outlet row to serialize order sequence generation under concurrency
        await tx.execute(sql`SELECT id FROM "restaurantOutlet" WHERE id = ${parsed.data.outletId} FOR UPDATE`);
        tokenNo = await getNextDailyTokenNo(tx, parsed.data.outletId);

        if (parsed.data.items && parsed.data.items.length > 0) {
          const menuItems = await tx
            .select()
            .from(appSchema.menuItem)
            .where(eq(appSchema.menuItem.restaurantId, restaurantId));
          const menuMap = new Map(menuItems.map((m: any) => [m.id, m]));

          for (const item of parsed.data.items) {
            const menuItem = menuMap.get(item.itemId) as any;
            if (!menuItem) continue;
            const { nameSnapshot, pricePaiseSnapshot, variant, addons } = resolveOrderItemDetails(menuItem, item);
            subtotalPaise += pricePaiseSnapshot * item.qty;
            orderItemsToInsert.push({
              id: generateId('orderItem'),
              orderId: id,
              itemId: item.itemId,
              nameSnapshot,
              pricePaiseSnapshot,
              qty: item.qty,
              variant,
              addons,
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

        const orderType = computedOrderType;
        const packagingChargePaise = parsed.data.packagingChargePaise ?? 0;
        const deliveryChargePaise = parsed.data.deliveryChargePaise ?? 0;
        const isDelivery = orderType === 'DELIVERY';
        const tableNo = isDelivery ? 'Delivery' : (parsed.data.tableNo ?? null);
        const customerPhone = parsed.data.customerPhone || parsed.data.delivery?.customerPhone || null;
        const isTableOrder = Boolean(!isDelivery && tableNo && tableNo.trim() && tableNo !== 'Takeaway');
        const totalOrderPaise = subtotalPaise + packagingChargePaise + deliveryChargePaise;

        if (diningSettings && orderType === 'DELIVERY' && diningSettings.minDeliveryOrderPaise && totalOrderPaise < diningSettings.minDeliveryOrderPaise) {
          throw new Error(`Minimum order for delivery is ₹${Math.round(diningSettings.minDeliveryOrderPaise / 100)}.`);
        }

        await tx.insert(appSchema.saleOrder).values({
          id,
          restaurantId,
          outletId: parsed.data.outletId,
          orderNo: tokenNo,
          tableNo,
          customerPhone,
          status: 'OPEN',
          orderStatus: 'ORDERED',
          subtotalPaise: totalOrderPaise,
          paidPaise: 0,
          note: parsed.data.note ?? null,
          orderType,
          packagingChargePaise,
          deliveryChargePaise,
          tableFreedAt: isTableOrder ? null : now,
          createdAt: now,
          updatedAt: now,
          createdBy: actorPhone,
          updatedBy: actorPhone,
        });

        let delRow: any = null;
        if (isDelivery && parsed.data.delivery) {
          const delInput = parsed.data.delivery;
          const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
          let riderName: string | null = null;
          let riderPhone: string | null = null;
          let riderVehicleNo: string | null = null;
          if (delInput.riderId) {
            const [rider] = await tx
              .select()
              .from(appSchema.deliveryRider)
              .where(eq(appSchema.deliveryRider.id, delInput.riderId));
            if (rider) {
              riderName = rider.name;
              riderPhone = rider.phone;
              riderVehicleNo = rider.vehicleNumber;
            }
          }
          delRow = {
            id: generateId('del'),
            orderId: id,
            restaurantId,
            outletId: parsed.data.outletId,
            customerName: delInput.customerName || 'Customer',
            customerPhone: delInput.customerPhone || customerPhone || '',
            alternatePhone: delInput.alternatePhone || null,
            addressLine1: delInput.addressLine1,
            addressLine2: delInput.addressLine2 || null,
            landmark: delInput.landmark || null,
            city: delInput.city || '',
            pincode: delInput.pincode || '',
            latitude: null,
            longitude: null,
            deliveryNotes: delInput.deliveryNotes || null,
            deliveryMode: delInput.deliveryMode || 'IN_HOUSE',
            deliveryProvider: null,
            riderId: delInput.riderId || null,
            riderName,
            riderPhone,
            riderVehicleNo,
            deliveryOtp,
            status: delInput.riderId ? 'ASSIGNED' : 'PENDING_ASSIGNMENT',
            estimatedMinutes: 35,
            assignedAt: delInput.riderId ? now : null,
            pickedUpAt: null,
            deliveredAt: null,
            failedReason: null,
            createdAt: now,
            updatedAt: now,
          };
          await tx.insert(appSchema.deliveryOrder).values(delRow);

          if (delInput.riderId) {
            await tx
              .update(appSchema.deliveryRider)
              .set({ status: 'ON_DELIVERY', activeOrderId: id, updatedAt: now })
              .where(eq(appSchema.deliveryRider.id, delInput.riderId));
          }
        }

        if (orderItemsToInsert.length > 0) {
          await tx.insert(appSchema.saleOrderItem).values(orderItemsToInsert);
          const audits = orderItemsToInsert.map((item) => ({
            id: generateId('audit'),
            orderId: id,
            orderItemId: item.id,
            fromStatus: null,
            toStatus: 'ORDERED',
            changedBy: actorPhone || 'Staff',
            changedByRole: tenant.role || 'STAFF',
            createdAt: now,
          }));
          await tx.insert(appSchema.orderItemAudit).values(audits);
        }
      });

      c.executionCtx?.waitUntil?.(cacheSet(kv(c), seqKey, tokenNo, TTL.outletSeq));

      const result = await getOrderWithItems(db, id, restaurantId);
      await broadcastToOutlet(
        c.env,
        parsed.data.outletId,
        {
          topic: 'KITCHEN',
          type: 'ORDER_CREATED',
          data: { orderId: id, tokenNo, tableNo: parsed.data.tableNo },
        },
        parsed.data.customerPhone
      );

      const whatsappSettings = (outlet.whatsappSettings as any) || null;
      if (whatsappSettings?.enabled && whatsappSettings?.sendOnOrderCreated && parsed.data.customerPhone) {
        c.executionCtx?.waitUntil?.(
          (async () => {
            try {
              const [rest] = await db.select().from(appSchema.restaurant).where(eq(appSchema.restaurant.id, restaurantId));
              const msg = formatOrderWhatsAppMessage(
                rest?.name || 'Restaurant',
                outlet.name,
                { id, orderNo: tokenNo, tableNo: parsed.data.tableNo, orderType: computedOrderType, subtotalPaise: totalOrderPaise, packagingChargePaise, deliveryChargePaise },
                orderItemsToInsert,
                false,
                delRow,
                whatsappSettings.customFooterNote
              );
              await sendWhatsAppText(parsed.data.customerPhone, msg, undefined, { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY });
            } catch (err) {
              console.error('[WhatsApp] sendOnOrderCreated error:', err);
            }
          })()
        );
      }

      return c.json(result, 201);
    } finally {
      await close();
    }
  }
);

// ─── POST /orders/create-settled ──────────────────────────────────────────────
app.post(
  '/create-settled',
  apiDoc({
    tags: ['Orders'],
    summary: 'Create and Settle Order (Fast Counter Sale)',
    description: 'Instant counter checkout for takeaway or dine-in, created and paid in one step.',
    body: CreateSettledSchema,
    responses: {
      201: OrderWithItemsSchema,
      400: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = c.get('actorPhone') || '';
    const body = await c.req.json().catch(() => ({}));
    const parsed = CreateSettledSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    if (!assertOutletAccess(tenant, parsed.data.outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${parsed.data.outletId}'` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const [outlet] = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, parsed.data.outletId))
        .limit(1);

      if (!outlet) return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);

      const diningSettings = (outlet.diningSettings as any) || null;
      const computedOrderType = parsed.data.orderType || (parsed.data.tableNo && parsed.data.tableNo !== 'Takeaway' ? 'DINE_IN' : 'TAKEAWAY');

      if (diningSettings) {
        if (computedOrderType === 'TAKEAWAY' && diningSettings.takeawayEnabled === false) {
          return c.json({ error: 'Channel Disabled', message: 'Takeaway ordering is currently disabled for this outlet.' }, 400);
        }
        if (computedOrderType === 'DINE_IN' && diningSettings.dineInEnabled === false) {
          return c.json({ error: 'Channel Disabled', message: 'Dine-In ordering is currently disabled for this outlet.' }, 400);
        }
      }

      const id = generateOrderId(parsed.data.outletId);
      const now = new Date();
      let subtotalPaise = 0;
      const orderItemsToInsert: any[] = [];

      const istDate = getTodayISTDateString();
      const seqKey = CacheKey.outletSeq(parsed.data.outletId, istDate);
      let tokenNo = 1;

      await db.transaction(async (tx: any) => {
        // Lock outlet row to serialize order sequence generation under concurrency
        await tx.execute(sql`SELECT id FROM "restaurantOutlet" WHERE id = ${parsed.data.outletId} FOR UPDATE`);
        tokenNo = await getNextDailyTokenNo(tx, parsed.data.outletId);

        if (parsed.data.items && parsed.data.items.length > 0) {
          const menuItems = await tx
            .select()
            .from(appSchema.menuItem)
            .where(eq(appSchema.menuItem.restaurantId, restaurantId));
          const menuMap = new Map(menuItems.map((m: any) => [m.id, m]));

          for (const item of parsed.data.items) {
            const menuItem = menuMap.get(item.itemId) as any;
            if (!menuItem) continue;
            const { nameSnapshot, pricePaiseSnapshot, variant, addons } = resolveOrderItemDetails(menuItem, item);
            subtotalPaise += pricePaiseSnapshot * item.qty;
            orderItemsToInsert.push({
              id: generateId('orderItem'),
              orderId: id,
              itemId: item.itemId,
              nameSnapshot,
              pricePaiseSnapshot,
              qty: item.qty,
              variant,
              addons,
              round: 1,
              status: 'ORDERED',
              paymentStatus: 'PAID',
              settledMethod: parsed.data.method,
              settledAt: now,
              note: item.note ? item.note.trim() : null,
              createdAt: now,
              updatedAt: now,
              createdBy: actorPhone,
              updatedBy: actorPhone,
            });
          }
        }

        const packagingChargePaise = parsed.data.packagingChargePaise ?? 0;
        const deliveryChargePaise = parsed.data.deliveryChargePaise ?? 0;
        const totalOrderPaise = subtotalPaise + packagingChargePaise + deliveryChargePaise;
        const customerPhone = parsed.data.customerPhone || null;
        const orderType = parsed.data.orderType || (parsed.data.tableNo && parsed.data.tableNo !== 'Takeaway' ? 'DINE_IN' : 'TAKEAWAY');

        await tx.insert(appSchema.saleOrder).values({
          id,
          restaurantId,
          outletId: parsed.data.outletId,
          orderNo: tokenNo,
          tableNo: parsed.data.tableNo ?? 'Takeaway',
          customerPhone,
          status: 'PAID',
          orderStatus: 'ORDERED',
          subtotalPaise: totalOrderPaise,
          paidPaise: totalOrderPaise,
          method: parsed.data.method,
          note: parsed.data.note ?? null,
          orderType,
          packagingChargePaise,
          deliveryChargePaise,
          tableFreedAt: now,
          createdAt: now,
          updatedAt: now,
          createdBy: actorPhone,
          updatedBy: actorPhone,
        });

        if (orderItemsToInsert.length > 0) {
          await tx.insert(appSchema.saleOrderItem).values(orderItemsToInsert);
          const audits = orderItemsToInsert.map((item) => ({
            id: generateId('audit'),
            orderId: id,
            orderItemId: item.id,
            fromStatus: null,
            toStatus: 'ORDERED',
            changedBy: actorPhone || 'Staff',
            changedByRole: tenant.role || 'STAFF',
            createdAt: now,
          }));
          await tx.insert(appSchema.orderItemAudit).values(audits);
        }
      });

      c.executionCtx?.waitUntil?.(cacheSet(kv(c), seqKey, tokenNo, TTL.outletSeq));
      invalidateReports(kv(c), restaurantId);

      const result = await getOrderWithItems(db, id, restaurantId);
      await broadcastToOutlet(
        c.env,
        parsed.data.outletId,
        {
          topic: 'KITCHEN',
          type: 'ORDER_CREATED',
          data: { orderId: id, tokenNo, tableNo: parsed.data.tableNo },
        },
        parsed.data.customerPhone
      );

      const whatsappSettings = (outlet.whatsappSettings as any) || null;
      if (whatsappSettings?.enabled && (whatsappSettings?.sendOnBillSettled || whatsappSettings?.sendOnOrderCreated) && parsed.data.customerPhone) {
        c.executionCtx?.waitUntil?.(
          (async () => {
            try {
              const [rest] = await db.select().from(appSchema.restaurant).where(eq(appSchema.restaurant.id, restaurantId));
              const msg = formatOrderWhatsAppMessage(
                rest?.name || 'Restaurant',
                outlet.name,
                { id, orderNo: tokenNo, tableNo: parsed.data.tableNo ?? 'Takeaway', orderType: computedOrderType, status: 'PAID', method: parsed.data.method, subtotalPaise: totalOrderPaise, packagingChargePaise, deliveryChargePaise },
                orderItemsToInsert,
                true,
                undefined,
                whatsappSettings.customFooterNote
              );
              await sendWhatsAppText(parsed.data.customerPhone, msg, undefined, { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY });
            } catch (err) {
              console.error('[WhatsApp] create-settled dispatch failed:', err);
            }
          })()
        );
      }

      return c.json(result, 201);
    } finally {
      await close();
    }
  }
);

// ─── POST /orders/add-round ───────────────────────────────────────────────────
const AddRoundActionSchema = z.object({
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
    tags: ['Orders'],
    summary: 'Add Round to Order',
    description: 'Appends additional dishes and drinks to an active ongoing order under a new round number.',
    body: AddRoundActionSchema,
    responses: {
      200: OrderWithItemsSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = c.get('actorPhone') || '';
    const body = await c.req.json().catch(() => ({}));
    const parsed = AddRoundActionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { orderId, items: newItems, roundNote } = parsed.data;

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

      if (order.status === 'VOID') {
        return c.json({ error: 'Bad Request', message: 'Cannot add items to a voided order' }, 400);
      }

      const isTableOrder = Boolean(order.tableNo && order.tableNo.trim() && order.tableNo !== 'Takeaway' && order.tableNo !== 'Delivery' && order.orderType !== 'DELIVERY');
      if (isTableOrder && order.tableFreedAt) {
        return c.json(
          {
            error: 'Conflict',
            message: `Table ${order.tableNo} has already been freed. A new order must be started.`,
          },
          409
        );
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
        .where(eq(appSchema.menuItem.restaurantId, restaurantId));
      const menuMap = new Map(menuItems.map((m: any) => [m.id, m]));

      const itemsToInsert: any[] = [];
      for (const item of newItems) {
        const menuItem = menuMap.get(item.itemId) as any;
        if (!menuItem) continue;
        const { nameSnapshot, pricePaiseSnapshot, variant, addons } = resolveOrderItemDetails(menuItem, item);
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
          createdAt: now,
          updatedAt: now,
          createdBy: actorPhone,
          updatedBy: actorPhone,
        });
      }

      if (itemsToInsert.length === 0) {
        return c.json({ error: 'Bad Request', message: 'No valid menu items to add' }, 400);
      }

      await db.transaction(async (tx: any) => {
        await tx.insert(appSchema.saleOrderItem).values(itemsToInsert);

        const audits = itemsToInsert.map((item) => ({
          id: generateId('audit'),
          orderId,
          orderItemId: item.id,
          fromStatus: null,
          toStatus: 'ORDERED',
          changedBy: actorPhone || 'Staff',
          changedByRole: tenant.role || 'STAFF',
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
            updatedBy: actorPhone,
          })
          .where(eq(appSchema.saleOrder.id, orderId));
      });

      const result = await getOrderWithItems(db, orderId, restaurantId);
      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'KITCHEN',
          type: 'ORDER_ROUND_ADDED',
          data: { orderId, round: nextRound, itemsCount: itemsToInsert.length, tableNo: order.tableNo },
        },
        order.customerPhone
      );

      return c.json({ ...result, round: nextRound });
    } finally {
      await close();
    }
  }
);

// ─── POST /orders/settle-bill ─────────────────────────────────────────────────
const SettleBillActionSchema = z.object({
  orderId: z.string(),
  method: z.enum(['Cash', 'UPI', 'Card', 'Due', 'Split']),
  cashGivenPaise: z.number().int().nonnegative().optional(),
  customerPhone: z.string().optional(),
  discountPaise: z.number().int().nonnegative().optional(),
  tipPaise: z.number().int().nonnegative().optional(),
});

app.post(
  '/settle-bill',
  apiDoc({
    tags: ['Orders'],
    summary: 'Settle Order Bill',
    description: 'Marks all active items in the order as PAID and sets payment method and receipt status.',
    body: SettleBillActionSchema,
    responses: {
      200: OrderWithItemsSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:settle'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = c.get('actorPhone') || '';
    const body = await c.req.json().catch(() => ({}));
    const parsed = SettleBillActionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { orderId, method, cashGivenPaise, customerPhone } = parsed.data;

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

      if (order.status === 'PAID') {
        return c.json({ error: 'Bad Request', message: 'Order is already settled' }, 400);
      }
      if (order.status === 'VOID') {
        return c.json({ error: 'Bad Request', message: 'Cannot settle a voided order' }, 400);
      }

      const now = new Date();
      const items = await db
        .select()
        .from(appSchema.saleOrderItem)
        .where(eq(appSchema.saleOrderItem.orderId, orderId));

      const activeItems = items.filter((item: any) => item.status !== 'CANCELLED');
      const itemsSubtotal = activeItems.reduce((sum: number, item: any) => sum + item.pricePaiseSnapshot * item.qty, 0);
      const totalAmount = itemsSubtotal + (order.packagingChargePaise || 0) + (order.deliveryChargePaise || 0);

      await db.transaction(async (tx: any) => {
        await tx
          .update(appSchema.saleOrderItem)
          .set({ paymentStatus: 'PAID', settledMethod: method, settledAt: now, updatedAt: now, updatedBy: actorPhone })
          .where(and(eq(appSchema.saleOrderItem.orderId, orderId), sql`${appSchema.saleOrderItem.status} != 'CANCELLED'`));

        await tx
          .update(appSchema.saleOrder)
          .set({
            status: 'PAID',
            method,
            subtotalPaise: totalAmount,
            paidPaise: totalAmount,
            customerPhone: customerPhone?.trim() || order.customerPhone,
            updatedAt: now,
            updatedBy: actorPhone,
          })
          .where(eq(appSchema.saleOrder.id, orderId));
      });

      invalidateReports(kv(c), restaurantId);

      const result = await getOrderWithItems(db, orderId, restaurantId);
      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'ORDERS',
          type: 'ORDER_SETTLED',
          data: { orderId, method, totalPaise: totalAmount, tableNo: order.tableNo },
        },
        order.customerPhone
      );

      if (order.outletId) {
        const [out] = await db.select().from(appSchema.restaurantOutlet).where(eq(appSchema.restaurantOutlet.id, order.outletId));
        const whatsappSettings = (out?.whatsappSettings as any) || null;
        const targetPhone = customerPhone?.trim() || order.customerPhone;
        if (whatsappSettings?.enabled && whatsappSettings?.sendOnBillSettled && targetPhone) {
          c.executionCtx?.waitUntil?.(
            (async () => {
              try {
                const [rest] = await db.select().from(appSchema.restaurant).where(eq(appSchema.restaurant.id, restaurantId));
                const msg = formatOrderWhatsAppMessage(
                  rest?.name || 'Restaurant',
                  out?.name,
                  { ...order, status: 'PAID', method, subtotalPaise: totalAmount },
                  activeItems,
                  true,
                  undefined,
                  whatsappSettings.customFooterNote
                );
                await sendWhatsAppText(targetPhone, msg, undefined, { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY });
              } catch (err) {
                console.error('[WhatsApp] sendOnBillSettled failed:', err);
              }
            })()
          );
        }
      }

      return c.json(result);
    } finally {
      await close();
    }
  }
);

// ─── POST /orders/free-table ──────────────────────────────────────────────────
const FreeTableActionSchema = z.object({
  orderId: z.string(),
  method: z.enum(['Cash', 'UPI', 'Card', 'Due', 'Split']).optional(),
  autoSettle: z.boolean().optional(),
});

app.post(
  '/free-table',
  apiDoc({
    tags: ['Orders'],
    summary: 'Free Dining Table',
    description: 'Marks dining table as freed and archives active ticket when dining concludes.',
    body: FreeTableActionSchema,
    responses: {
      200: OrderWithItemsSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:settle'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = c.get('actorPhone') || '';
    const body = await c.req.json().catch(() => ({}));
    const parsed = FreeTableActionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { orderId, method, autoSettle } = parsed.data;

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

      const items = await db
        .select()
        .from(appSchema.saleOrderItem)
        .where(eq(appSchema.saleOrderItem.orderId, orderId));

      const unservedItems = items.filter((i: any) => i.status !== 'SERVED' && i.status !== 'CANCELLED');
      if (unservedItems.length > 0 && !autoSettle && order.status !== 'PAID') {
        return c.json(
          {
            error: 'Bad Request',
            message: `Cannot free table: ${unservedItems.length} item(s) are not served or cancelled yet.`,
          },
          400
        );
      }

      const now = new Date();
      await db.transaction(async (tx: any) => {
        const activeItems = items.filter((i: any) => i.status !== 'CANCELLED');
        const itemsSubtotal = activeItems.reduce((sum: number, it: any) => sum + it.pricePaiseSnapshot * it.qty, 0);
        const totalAmount = itemsSubtotal + (order.packagingChargePaise || 0) + (order.deliveryChargePaise || 0);

        // Auto-serve any remaining active items when concluding the table
        if (unservedItems.length > 0) {
          await tx
            .update(appSchema.saleOrderItem)
            .set({ status: 'SERVED', servedAt: now, updatedAt: now })
            .where(
              and(
                eq(appSchema.saleOrderItem.orderId, orderId),
                sql`${appSchema.saleOrderItem.status} NOT IN ('SERVED', 'CANCELLED')`
              )
            );
        }

        if (order.status !== 'PAID') {
          const settleMethod = method || order.method || 'Cash';
          await tx
            .update(appSchema.saleOrderItem)
            .set({ paymentStatus: 'PAID', settledMethod: settleMethod, settledAt: now, updatedAt: now })
            .where(and(eq(appSchema.saleOrderItem.orderId, orderId), sql`${appSchema.saleOrderItem.status} != 'CANCELLED'`));

          await tx
            .update(appSchema.saleOrder)
            .set({
              status: 'PAID',
              orderStatus: 'SERVED',
              method: settleMethod,
              subtotalPaise: totalAmount,
              paidPaise: totalAmount,
              tableFreedAt: now,
              updatedAt: now,
              updatedBy: actorPhone,
            })
            .where(eq(appSchema.saleOrder.id, orderId));
        } else {
          await tx
            .update(appSchema.saleOrder)
            .set({ orderStatus: 'SERVED', tableFreedAt: now, updatedAt: now, updatedBy: actorPhone })
            .where(eq(appSchema.saleOrder.id, orderId));
        }
      });

      invalidateReports(kv(c), restaurantId);

      const result = await getOrderWithItems(db, orderId, restaurantId);
      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'ORDERS',
          type: 'TABLE_FREED',
          data: { orderId, tableNo: order.tableNo },
        },
        order.customerPhone
      );

      return c.json(result);
    } finally {
      await close();
    }
  }
);

// ─── POST /orders/void ────────────────────────────────────────────────────────
const VoidActionSchema = z.object({
  orderId: z.string(),
  reason: z.string().max(250).optional(),
});

app.post(
  '/void',
  apiDoc({
    tags: ['Orders'],
    summary: 'Void Order',
    description: 'Cancels the entire order, voids active items, frees dining table, and releases assigned riders.',
    body: VoidActionSchema,
    responses: {
      200: OrderWithItemsSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:void'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = c.get('actorPhone') || '';
    const body = await c.req.json().catch(() => ({}));
    const parsed = VoidActionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { orderId, reason } = parsed.data;

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
      await db.transaction(async (tx: any) => {
        await tx
          .update(appSchema.saleOrderItem)
          .set({ status: 'CANCELLED', updatedAt: now, updatedBy: actorPhone })
          .where(eq(appSchema.saleOrderItem.orderId, orderId));

        await tx
          .update(appSchema.saleOrder)
          .set({
            status: 'VOID',
            orderStatus: 'CANCELLED',
            tableFreedAt: now,
            note: reason ? `[VOID]: ${reason}` : order.note,
            updatedAt: now,
            updatedBy: actorPhone,
          })
          .where(eq(appSchema.saleOrder.id, orderId));

        const [del] = await tx
          .select()
          .from(appSchema.deliveryOrder)
          .where(eq(appSchema.deliveryOrder.orderId, orderId));

        if (del) {
          await tx
            .update(appSchema.deliveryOrder)
            .set({ status: 'CANCELLED', failedReason: reason || 'Order Voided', updatedAt: now })
            .where(eq(appSchema.deliveryOrder.id, del.id));

          if (del.riderId) {
            await tx
              .update(appSchema.deliveryRider)
              .set({ status: 'AVAILABLE', activeOrderId: null, updatedAt: now })
              .where(eq(appSchema.deliveryRider.id, del.riderId));
          }
        }
      });

      invalidateReports(kv(c), restaurantId);

      const result = await getOrderWithItems(db, orderId, restaurantId);
      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'ORDERS',
          type: 'ORDER_VOIDED',
          data: { orderId, tableNo: order.tableNo },
        },
        order.customerPhone
      );

      return c.json(result);
    } finally {
      await close();
    }
  }
);

// ─── POST /orders/send-whatsapp-receipt ───────────────────────────────────────
const SendWhatsAppActionSchema = z.object({
  orderId: z.string(),
  phone: z.string().optional(),
});

app.post(
  '/send-whatsapp-receipt',
  apiDoc({
    tags: ['Orders'],
    summary: 'Send WhatsApp Receipt',
    description: 'Dispatches a formatted WhatsApp receipt with bill summary and payment status.',
    body: SendWhatsAppActionSchema,
    responses: {
      200: z.object({ success: z.boolean(), message: z.string() }),
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parsed = SendWhatsAppActionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { orderId, phone } = parsed.data;

    const { db, close } = getDb(c);
    try {
      const orderData = await getOrderWithItems(db, orderId, restaurantId);
      if (!orderData) return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
      if (!assertOutletAccess(tenant, orderData.order.outletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }

      const recipientPhone = phone?.trim() || orderData.order.customerPhone;
      if (!recipientPhone) {
        return c.json({ error: 'Bad Request', message: 'No phone number provided' }, 400);
      }

      const [rest] = await db.select().from(appSchema.restaurant).where(eq(appSchema.restaurant.id, restaurantId));
      const [out] = orderData.order.outletId ? await db.select().from(appSchema.restaurantOutlet).where(eq(appSchema.restaurantOutlet.id, orderData.order.outletId)) : [null];

      const message = formatOrderWhatsAppMessage(
        rest?.name || 'Restaurant',
        out?.name,
        orderData.order,
        orderData.items || [],
        orderData.order.status === 'PAID',
        orderData.delivery,
        (out?.whatsappSettings as any)?.customFooterNote
      );

      await sendWhatsAppText(
        recipientPhone,
        message,
        undefined,
        { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY }
      );

      return c.json({ success: true, message: `Receipt sent to ${recipientPhone}` });
    } finally {
      await close();
    }
  }
);

// ─── POST /orders/mark-kot-printed ───────────────────────────────────────────
const MarkKotPrintedSchema = z.object({
  orderId: z.string(),
});

app.post(
  '/mark-kot-printed',
  apiDoc({
    tags: ['Orders'],
    summary: 'Mark KOT Printed',
    description: 'Updates kotPrintedAt timestamp for thermal printing tracking.',
    body: MarkKotPrintedSchema,
    responses: {
      200: OrderWithItemsSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parsed = MarkKotPrintedSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

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
      await db
        .update(appSchema.saleOrder)
        .set({ kotPrintedAt: now, updatedAt: now })
        .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));

      const result = await getOrderWithItems(db, orderId, restaurantId);
      if (!result) return c.json({ error: 'Not Found' }, 404);
      return c.json(result);
    } finally {
      await close();
    }
  }
);

// ─── GET /orders/list ─────────────────────────────────────────────────────────
app.get(
  '/list',
  apiDoc({
    tags: ['Orders'],
    summary: 'List Orders',
    description: 'Queries orders with optional status, table occupancy, order status, or outlet filters.',
    query: z.object({
      status: z.string().optional(),
      tableOccupied: z.string().optional(),
      orderStatus: z.string().optional(),
      outletId: z.string().optional(),
      limit: z.string().optional(),
    }),
    responses: {
      200: z.array(OrderWithItemsSchema),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const status = c.req.query('status');
    const tableOccupied = c.req.query('tableOccupied');
    const orderStatus = c.req.query('orderStatus');
    const outletId = c.req.query('outletId');
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

    const { db, close } = getDb(c);
    try {
      const conditions: any[] = [eq(appSchema.saleOrder.restaurantId, restaurantId)];

      if (outletId) {
        if (!assertOutletAccess(tenant, outletId)) {
          return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
        }
        conditions.push(eq(appSchema.saleOrder.outletId, outletId));
      } else if (!isAllOutletRole(tenant.role as RestaurantRole)) {
        return c.json({ error: 'Bad Request', message: 'outletId is required for this role' }, 400);
      } else if (tenant.outletIds && tenant.outletIds.length > 0) {
        conditions.push(inArray(appSchema.saleOrder.outletId, tenant.outletIds));
      }

      if (tableOccupied === 'true') {
        conditions.push(
          sql`${appSchema.saleOrder.tableFreedAt} IS NULL`,
          sql`${appSchema.saleOrder.tableNo} IS NOT NULL`,
          sql`${appSchema.saleOrder.tableNo} != 'Takeaway'`,
          sql`${appSchema.saleOrder.tableNo} != 'Delivery'`,
          sql`COALESCE(${appSchema.saleOrder.orderType}, 'DINE_IN') != 'DELIVERY'`,
          sql`${appSchema.saleOrder.status} != 'VOID'`
        );
      } else if (status) {
        conditions.push(eq(appSchema.saleOrder.status, status));
      }
      if (orderStatus) conditions.push(eq(appSchema.saleOrder.orderStatus, orderStatus));

      const orders = await db
        .select()
        .from(appSchema.saleOrder)
        .where(and(...conditions))
        .orderBy(desc(appSchema.saleOrder.createdAt))
        .limit(limit);

      const orderIds = orders.map((o: any) => o.id);
      const items = orderIds.length
        ? await db.select().from(appSchema.saleOrderItem).where(inArray(appSchema.saleOrderItem.orderId, orderIds))
        : [];
      const allDeliveries = orderIds.length
        ? await db.select().from(appSchema.deliveryOrder).where(inArray(appSchema.deliveryOrder.orderId, orderIds))
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

// ─── GET /orders/active ───────────────────────────────────────────────────────
app.get(
  '/active',
  apiDoc({
    tags: ['Orders'],
    summary: 'List Active Occupied Orders',
    description: 'Lists active orders currently occupying dine-in tables.',
    query: z.object({
      outletId: z.string().optional(),
    }),
    responses: {
      200: z.array(OrderWithItemsSchema),
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || tenant.outletId;

    if (outletId && !assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const conditions: any[] = [
        eq(appSchema.saleOrder.restaurantId, restaurantId),
        sql`${appSchema.saleOrder.tableFreedAt} IS NULL`,
        sql`${appSchema.saleOrder.tableNo} IS NOT NULL`,
        sql`${appSchema.saleOrder.tableNo} != 'Takeaway'`,
        sql`${appSchema.saleOrder.tableNo} != 'Delivery'`,
        sql`COALESCE(${appSchema.saleOrder.orderType}, 'DINE_IN') != 'DELIVERY'`,
        sql`${appSchema.saleOrder.status} != 'VOID'`,
      ];

      if (outletId) {
        conditions.push(eq(appSchema.saleOrder.outletId, outletId));
      } else if (!isAllOutletRole(tenant.role as RestaurantRole)) {
        if (tenant.outletIds && tenant.outletIds.length > 0) {
          conditions.push(inArray(appSchema.saleOrder.outletId, tenant.outletIds));
        } else {
          return c.json({ error: 'Forbidden', message: 'No outlets assigned to your role' }, 403);
        }
      } else if (tenant.outletIds && tenant.outletIds.length > 0) {
        conditions.push(inArray(appSchema.saleOrder.outletId, tenant.outletIds));
      }

      const orders = await db
        .select()
        .from(appSchema.saleOrder)
        .where(and(...conditions))
        .orderBy(desc(appSchema.saleOrder.createdAt));

      const orderIds = orders.map((o: any) => o.id);
      const items = orderIds.length
        ? await db.select().from(appSchema.saleOrderItem).where(inArray(appSchema.saleOrderItem.orderId, orderIds))
        : [];
      const itemsByOrder = new Map<string, any[]>();
      for (const item of items) {
        const list = itemsByOrder.get(item.orderId) ?? [];
        list.push(item);
        itemsByOrder.set(item.orderId, list);
      }

      const result = orders.map((order: any) =>
        toOrderWithItems(order, itemsByOrder.get(order.id) ?? [], null)
      );
      return c.json(result);
    } finally {
      await close();
    }
  }
);

// ─── GET /orders/:id ──────────────────────────────────────────────────────────
app.get(
  '/:id',
  apiDoc({
    tags: ['Orders'],
    summary: 'Get Order by ID',
    description: 'Retrieves full details of a single order including items and delivery state.',
    responses: {
      200: OrderWithItemsSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const id = c.req.param('id');

    const { db, close } = getDb(c);
    try {
      const result = await getOrderWithItems(db, id, restaurantId);
      if (!result) return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
      if (!assertOutletAccess(tenant, result.order.outletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }
      return c.json(result);
    } finally {
      await close();
    }
  }
);

export { app as orderRoutes };
