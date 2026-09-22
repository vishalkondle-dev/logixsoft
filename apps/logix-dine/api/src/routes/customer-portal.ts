import { Hono } from 'hono';
import { sql, eq, and, desc, inArray, or, isNull } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requireAuth } from '../lib/tenancy';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { broadcastToCustomer, broadcastToOutlet } from '../lib/sync';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

export function getPhoneVariants(input: string): { rawDigits: string; variants: string[] } {
  const cleaned = input.trim();
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

function checkIsNonVeg(name?: string | null): boolean {
  if (!name) return false;
  return /chicken|mutton|fish|prawn|egg|lamb|meat|keema|beef|pork|seafood/i.test(name) && !/veg/i.test(name);
}

// ─── GET /customer/portal ───────────────────────────────────────────────────
app.get(
  '/portal',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Get Customer Portal Data',
    description: 'Retrieves active orders, order history, loyalty tier, and favorites for the logged-in customer.',
    responses: {
      200: z.any(),
      401: ErrorResponseSchema,
    },
  }),
  requireAuth(),
  async (c) => {
    const sessionUser = c.get('sessionUser') as any;
    const phone = sessionUser?.phoneNumber;

    if (!phone) {
      return c.json({ error: 'Missing Phone', message: 'No phone number associated with current session' }, 400);
    }

    const { rawDigits, variants } = getPhoneVariants(String(phone));
    const { db, close } = getDb(c);

    try {
      // 1. Fetch all orders matching customer phone
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

      // 2. Fetch outlet & restaurant details
      const outletRows = outletIds.length > 0
        ? await db
            .select({
              id: appSchema.restaurantOutlet.id,
              name: appSchema.restaurantOutlet.name,
              address: appSchema.restaurantOutlet.address,
              phone: appSchema.restaurantOutlet.phone,
            })
            .from(appSchema.restaurantOutlet)
            .where(inArray(appSchema.restaurantOutlet.id, outletIds as string[]))
        : [];
      const outletMap = new Map<string, { name: string; address?: string | null; phone?: string | null }>(
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

      // 3. Fetch order items
      const items = orderIds.length > 0
        ? await db
            .select()
            .from(appSchema.saleOrderItem)
            .where(inArray(appSchema.saleOrderItem.orderId, orderIds))
        : [];

      const itemsByOrderId = new Map<string, any[]>();
      items.forEach((it: any) => {
        const arr = itemsByOrderId.get(it.orderId) || [];
        arr.push(it);
        itemsByOrderId.set(it.orderId, arr);
      });

      // 3b. Fetch latest waiter requests for these orders
      const waiterRequests = orderIds.length > 0
        ? await db
            .select()
            .from(appSchema.waiterRequest)
            .where(inArray(appSchema.waiterRequest.orderId, orderIds))
            .orderBy(desc(appSchema.waiterRequest.createdAt))
        : [];

      const latestWaiterRequestByOrderId = new Map<string, any>();
      waiterRequests.forEach((wr: any) => {
        if (!wr.orderId) return;
        if (!latestWaiterRequestByOrderId.has(wr.orderId)) {
          latestWaiterRequestByOrderId.set(wr.orderId, wr);
        }
      });

      // 4. Categorize active and past orders
      const activeOrdersList: any[] = [];
      const pastOrdersList: any[] = [];
      let lifetimeSpendPaise = 0;
      let vegItemsCount = 0;
      let nonVegItemsCount = 0;
      const itemAggregate: Record<string, { itemId: string; name: string; isNonVeg: boolean; qty: number; totalSpendPaise: number; orderCount: number }> = {};

      orders.forEach((o: any) => {
        const ordItems = itemsByOrderId.get(o.id) || [];
        const outlet = outletMap.get(o.outletId);
        const rest = restMap.get(o.restaurantId);

        const wr = latestWaiterRequestByOrderId.get(o.id);
        let activeWaiterRequest: any = null;
        if (wr && wr.status !== 'CANCELLED') {
          const isCompleted = wr.status === 'COMPLETED';
          const completedTime = wr.completedAt ? new Date(wr.completedAt).getTime() : 0;
          const isRecentCompletion = isCompleted && (Date.now() - completedTime < 15 * 60 * 1000);
          if (!isCompleted || isRecentCompletion) {
            activeWaiterRequest = {
              id: wr.id,
              serviceType: wr.serviceType,
              serviceLabel: wr.serviceLabel,
              note: wr.note,
              status: wr.status,
              createdAt: wr.createdAt ? new Date(wr.createdAt).toISOString() : null,
              updatedAt: wr.updatedAt ? new Date(wr.updatedAt).toISOString() : null,
              completedAt: wr.completedAt ? new Date(wr.completedAt).toISOString() : null,
            };
          }
        }

        const activeDishItems = ordItems.filter((it: any) => it.status !== 'CANCELLED');
        const servedItemsCount = activeDishItems.filter((it: any) => it.status === 'SERVED').reduce((sum: number, it: any) => sum + it.qty, 0);
        const preparedItemsCount = activeDishItems.filter((it: any) => it.status === 'PREPARED').reduce((sum: number, it: any) => sum + it.qty, 0);
        const preparingItemsCount = activeDishItems.filter((it: any) => it.status === 'PREPARING').reduce((sum: number, it: any) => sum + it.qty, 0);
        const orderedItemsCount = activeDishItems.filter((it: any) => it.status === 'ORDERED' || !it.status).reduce((sum: number, it: any) => sum + it.qty, 0);
        const totalDishQty = activeDishItems.reduce((sum: number, it: any) => sum + it.qty, 0);
        const maxRound = ordItems.reduce((max: number, it: any) => Math.max(max, it.round || 1), 1);

        const mappedOrder = {
          id: o.id,
          orderNo: o.orderNo,
          tokenNo: o.orderNo,
          restaurantId: o.restaurantId,
          restaurantName: rest?.name || 'Restaurant',
          restaurantPhone: rest?.phone || outlet?.phone || null,
          outletId: o.outletId,
          outletName: outlet?.name || 'Restaurant Outlet',
          outletAddress: outlet?.address || null,
          outletPhone: outlet?.phone || rest?.phone || null,
          tableNo: o.tableNo || 'Takeaway',
          customerPhone: o.customerPhone,
          status: o.status,
          orderStatus: o.orderStatus || 'ORDERED',
          subtotalPaise: o.subtotalPaise || 0,
          paidPaise: o.paidPaise || 0,
          method: o.method || 'Cash',
          note: o.note,
          activeWaiterRequest,
          createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
          settledAt: o.settledAt ? new Date(o.settledAt).toISOString() : null,
          itemsCount: totalDishQty,
          maxRound,
          progress: {
            totalQty: totalDishQty,
            servedQty: servedItemsCount,
            preparedQty: preparedItemsCount,
            preparingQty: preparingItemsCount,
            orderedQty: orderedItemsCount,
            percentComplete: totalDishQty > 0 ? Math.round((servedItemsCount / totalDishQty) * 100) : 0,
          },
          items: ordItems.map((it: any) => ({
            id: it.id,
            itemId: it.itemId,
            name: it.nameSnapshot,
            pricePaise: it.pricePaiseSnapshot,
            qty: it.qty,
            variant: it.variant,
            addons: it.addons,
            status: it.status || 'ORDERED',
            round: it.round || 1,
            note: it.note,
            isNonVeg: checkIsNonVeg(it.nameSnapshot),
            createdAt: it.createdAt ? new Date(it.createdAt).toISOString() : null,
          })),
        };

        if (o.status === 'OPEN') {
          activeOrdersList.push(mappedOrder);
        } else {
          pastOrdersList.push(mappedOrder);
          lifetimeSpendPaise += (o.paidPaise || o.subtotalPaise || 0);
        }

        // Aggregate food stats
        ordItems.forEach((it: any) => {
          if (it.status === 'CANCELLED') return;
          const isNonVeg = checkIsNonVeg(it.nameSnapshot);
          if (isNonVeg) nonVegItemsCount += it.qty;
          else vegItemsCount += it.qty;

          const key = it.nameSnapshot.trim();
          const existing = itemAggregate[key] || {
            itemId: it.itemId,
            name: key,
            isNonVeg,
            qty: 0,
            totalSpendPaise: 0,
            orderCount: 0,
          };
          existing.qty += it.qty;
          existing.totalSpendPaise += (it.pricePaiseSnapshot * it.qty);
          existing.orderCount += 1;
          itemAggregate[key] = existing;
        });
      });

      // 5. Compute favorites and dietary preference
      const favoriteDishes = Object.values(itemAggregate)
        .sort((a, b) => b.qty - a.qty || b.totalSpendPaise - a.totalSpendPaise)
        .slice(0, 6);

      const totalDishes = vegItemsCount + nonVegItemsCount;
      let primaryDietary = 'Mixed Dining';
      if (totalDishes > 0) {
        if (vegItemsCount / totalDishes >= 0.8) primaryDietary = 'Pure Vegetarian';
        else if (nonVegItemsCount / totalDishes >= 0.6) primaryDietary = 'Non-Veg Lover';
      }

      // 6. Loyalty Tier
      let loyaltyTier = 'New Guest';
      if (lifetimeSpendPaise >= 500000 || orders.length >= 8) {
        loyaltyTier = 'VIP Customer';
      } else if (orders.length >= 3) {
        loyaltyTier = 'Regular Guest';
      }

      let displayPhone = String(phone);
      if (rawDigits.length === 10) {
        displayPhone = `+91 ${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}`;
      }

      return c.json({
        customer: {
          id: sessionUser.id,
          name: sessionUser.name,
          phone: displayPhone,
          rawPhone: rawDigits,
          email: sessionUser.email,
          loyaltyTier,
          dietaryPreference: primaryDietary,
        },
        activeOrders: activeOrdersList,
        pastOrders: pastOrdersList,
        stats: {
          lifetimeSpendPaise,
          totalOrdersCount: orders.length,
          activeOrdersCount: activeOrdersList.length,
          completedOrdersCount: pastOrdersList.length,
          favoriteDishes,
          vegItemsCount,
          nonVegItemsCount,
        },
      });
    } catch (err: any) {
      console.error('[customer-portal] Error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message || String(err) }, 500);
    } finally {
      await close();
    }
  }
);

// ─── PATCH /customer/profile ────────────────────────────────────────────────
app.patch(
  '/profile',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Update Customer Profile',
    description: 'Update customer name or email for the authenticated session.',
    responses: {
      200: z.any(),
      401: ErrorResponseSchema,
    },
  }),
  requireAuth(),
  async (c) => {
    const sessionUser = c.get('sessionUser') as any;
    const body = await c.req.json().catch(() => ({}));
    const name = body.name?.trim();
    const email = body.email?.trim();

    const { db, close } = getDb(c);
    try {
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (name) updates.name = name;
      if (email) updates.email = email;

      await db
        .update(appSchema.user)
        .set(updates)
        .where(eq(appSchema.user.id, String(sessionUser.id)));

      if (sessionUser?.phoneNumber) {
        broadcastToCustomer(c.env, sessionUser.phoneNumber, {
          topic: 'CUSTOMER',
          type: 'PROFILE_UPDATED',
          data: { name, email },
        });
      }

      return c.json({ success: true, message: 'Profile updated successfully' });
    } catch (err: any) {
      return c.json({ error: 'Failed to update profile', message: err.message || String(err) }, 500);
    } finally {
      await close();
    }
  }
);

// ─── GET /customer/menu ─────────────────────────────────────────────────────
app.get(
  '/menu',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Get Outlet Menu for Customer Self-Ordering',
    description: 'Fetches active menu categories and available items for an outlet to allow in-table self ordering.',
    query: z.object({ outletId: z.string() }),
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAuth(),
  async (c) => {
    const outletId = c.req.query('outletId');
    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId query parameter required' }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const [outlet] = await db
        .select({
          id: appSchema.restaurantOutlet.id,
          restaurantId: appSchema.restaurantOutlet.restaurantId,
          name: appSchema.restaurantOutlet.name,
        })
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .limit(1);

      if (!outlet) {
        return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);
      }

      // 1. Fetch categories active for this restaurant/outlet
      const categories = await db
        .select()
        .from(appSchema.menuCategory)
        .where(
          and(
            eq(appSchema.menuCategory.restaurantId, outlet.restaurantId),
            or(eq(appSchema.menuCategory.outletId, outletId), isNull(appSchema.menuCategory.outletId)),
            eq(appSchema.menuCategory.active, true)
          )
        )
        .orderBy(appSchema.menuCategory.sortOrder, appSchema.menuCategory.name);

      // 2. Fetch available items
      const items = await db
        .select()
        .from(appSchema.menuItem)
        .where(
          and(
            eq(appSchema.menuItem.restaurantId, outlet.restaurantId),
            or(eq(appSchema.menuItem.outletId, outletId), isNull(appSchema.menuItem.outletId)),
            eq(appSchema.menuItem.available, true)
          )
        )
        .orderBy(appSchema.menuItem.sortOrder, appSchema.menuItem.name);

      const mappedCategories = categories.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
      }));

      const mappedItems = items.map((it: any) => ({
        id: it.id,
        categoryId: it.categoryId,
        name: it.name,
        description: it.description,
        imageUrl: it.imageUrl,
        pricePaise: it.pricePaise,
        isNonVeg: checkIsNonVeg(it.name),
        variants: it.variants || [],
        addons: it.addons || [],
      }));

      return c.json({
        outlet: { id: outlet.id, name: outlet.name },
        categories: mappedCategories,
        items: mappedItems,
      });
    } catch (err: any) {
      console.error('[customer/menu] Error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message || String(err) }, 500);
    } finally {
      await close();
    }
  }
);

// ─── POST /customer/orders/:id/items ────────────────────────────────────────
const AddCustomerItemsSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string(),
        qty: z.number().int().min(1).default(1),
        variantId: z.string().optional(),
        addonIds: z.array(z.string()).optional(),
        note: z.string().max(150).optional(),
      })
    )
    .min(1),
  roundNote: z.string().max(200).optional(),
});

app.post(
  '/orders/:id/items',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Order More Items for Active Order',
    description: 'Appends a new round of items to an existing OPEN order directly from the table.',
    params: z.object({ id: z.string() }),
    body: AddCustomerItemsSchema,
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
  }),
  requireAuth(),
  async (c) => {
    const sessionUser = c.get('sessionUser') as any;
    const phone = sessionUser?.phoneNumber;
    if (!phone) {
      return c.json({ error: 'Unauthorized', message: 'Phone number required' }, 401);
    }

    const orderId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = AddCustomerItemsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const { rawDigits } = getPhoneVariants(String(phone));
    const { db, close } = getDb(c);

    try {
      // 1. Fetch order
      const [order] = await db
        .select()
        .from(appSchema.saleOrder)
        .where(eq(appSchema.saleOrder.id, orderId))
        .limit(1);

      if (!order) {
        return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
      }

      // 2. Validate customer ownership
      const orderPhoneDigits = (order.customerPhone || '').replace(/\D/g, '').slice(-10);
      if (orderPhoneDigits !== rawDigits) {
        return c.json({ error: 'Forbidden', message: 'This order does not belong to your account' }, 403);
      }

      if (order.status !== 'OPEN') {
        return c.json({ error: 'Conflict', message: 'This order is already settled or closed' }, 409);
      }

      // 3. Determine next round number
      const existingItems = await db
        .select({ round: appSchema.saleOrderItem.round })
        .from(appSchema.saleOrderItem)
        .where(eq(appSchema.saleOrderItem.orderId, orderId));

      const maxRound = existingItems.reduce((max: number, it: any) => Math.max(max, it.round || 1), 1);
      const nextRound = existingItems.length > 0 ? maxRound + 1 : 1;

      // 4. Fetch menu items
      const requestedItemIds = Array.from(new Set(parsed.data.items.map((it) => it.itemId)));
      const menuItems = await db
        .select()
        .from(appSchema.menuItem)
        .where(
          and(
            inArray(appSchema.menuItem.id, requestedItemIds),
            eq(appSchema.menuItem.restaurantId, order.restaurantId)
          )
        );

      const menuItemMap = new Map<string, any>(menuItems.map((m: any) => [m.id, m]));
      const now = new Date();
      const newItemsToInsert: any[] = [];
      const auditsToInsert: any[] = [];
      let roundTotalPaise = 0;

      for (const itemInput of parsed.data.items) {
        const menuItem = menuItemMap.get(itemInput.itemId);
        if (!menuItem) continue;

        // Resolve variant
        const allVariants = (menuItem.variants as any[]) || [];
        const selectedVariant = itemInput.variantId
          ? allVariants.find((v: any) => v.id === itemInput.variantId) || null
          : null;

        // Resolve addons
        const allAddons = (menuItem.addons as any[]) || [];
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

        let nameSnapshot = menuItem.name;
        if (selectedVariant) {
          nameSnapshot = `${menuItem.name} (${selectedVariant.name})`;
        }

        const newOrderItemId = generateId('oi');
        const qty = itemInput.qty || 1;
        roundTotalPaise += unitPrice * qty;

        newItemsToInsert.push({
          id: newOrderItemId,
          orderId,
          itemId: menuItem.id,
          nameSnapshot,
          pricePaiseSnapshot: unitPrice,
          qty,
          variant: selectedVariant ? { id: selectedVariant.id, name: selectedVariant.name, pricePaise: selectedVariant.pricePaise } : null,
          addons: selectedAddons,
          status: 'ORDERED',
          round: nextRound,
          note: itemInput.note ? itemInput.note.trim() : null,
          createdAt: now,
          updatedAt: now,
          createdBy: phone,
          updatedBy: phone,
        });

        auditsToInsert.push({
          id: generateId('audit'),
          orderId,
          orderItemId: newOrderItemId,
          fromStatus: null,
          toStatus: 'ORDERED',
          changedBy: phone,
          changedByRole: 'CUSTOMER',
          createdAt: now,
        });
      }

      if (newItemsToInsert.length === 0) {
        return c.json({ error: 'Bad Request', message: 'No valid items found to order' }, 400);
      }

      // Insert items and audits
      await db.insert(appSchema.saleOrderItem).values(newItemsToInsert);
      if (auditsToInsert.length > 0) {
        await db.insert(appSchema.orderItemAudit).values(auditsToInsert);
      }

      // Recompute total on order
      const allActiveItems = await db
        .select()
        .from(appSchema.saleOrderItem)
        .where(
          and(
            eq(appSchema.saleOrderItem.orderId, orderId),
            sql`${appSchema.saleOrderItem.status} != 'CANCELLED'`
          )
        );

      const newSubtotal = allActiveItems.reduce((sum: number, it: any) => sum + it.pricePaiseSnapshot * it.qty, 0);

      const trimmedRoundNote = parsed.data.roundNote?.trim();
      const updatedOrderNote = trimmedRoundNote
        ? (order.note ? `${order.note}\n[Round ${nextRound}]: ${trimmedRoundNote}` : `[Round ${nextRound}]: ${trimmedRoundNote}`)
        : order.note;

      await db
        .update(appSchema.saleOrder)
        .set({
          subtotalPaise: newSubtotal,
          orderStatus: 'ORDERED',
          note: updatedOrderNote,
          updatedAt: now,
          updatedBy: phone,
        })
        .where(eq(appSchema.saleOrder.id, orderId));

      // Broadcast to Outlet DO (POS / Waiter / KDS chime)
      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'ORDERS',
          type: 'NEW_ROUND',
          data: {
            orderId,
            orderNo: order.orderNo,
            tableNo: order.tableNo,
            round: nextRound,
            itemsCount: newItemsToInsert.length,
            roundTotalPaise,
            timestamp: now.getTime(),
          },
        },
        phone
      );

      // Broadcast to Customer DO
      await broadcastToCustomer(c.env, phone, {
        topic: 'CUSTOMER',
        type: 'ORDER_UPDATED',
        data: { orderId, round: nextRound },
      });

      return c.json({
        success: true,
        message: `Round ${nextRound} placed successfully!`,
        round: nextRound,
        addedCount: newItemsToInsert.length,
        subtotalPaise: newSubtotal,
      });
    } catch (err: any) {
      console.error('[customer/orders/items] Error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message || String(err) }, 500);
    } finally {
      await close();
    }
  }
);

// ─── POST /customer/orders/:id/call-waiter ──────────────────────────────────
const CallWaiterSchema = z.object({
  serviceType: z.enum(['WATER', 'CUTLERY', 'BILL', 'CLEAN_TABLE', 'OTHER']),
  note: z.string().max(200).optional(),
});

app.post(
  '/orders/:id/call-waiter',
  apiDoc({
    tags: ['Customer Portal'],
    summary: 'Call Waiter for Assistance',
    description: 'Sends real-time service request (water, cutlery, bill, table clean, other) to the outlet staff.',
    params: z.object({ id: z.string() }),
    body: CallWaiterSchema,
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAuth(),
  async (c) => {
    const sessionUser = c.get('sessionUser') as any;
    const phone = sessionUser?.phoneNumber;
    if (!phone) {
      return c.json({ error: 'Unauthorized', message: 'Phone number required' }, 401);
    }

    const orderId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = CallWaiterSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const { rawDigits } = getPhoneVariants(String(phone));
    const { db, close } = getDb(c);

    try {
      const [order] = await db
        .select()
        .from(appSchema.saleOrder)
        .where(eq(appSchema.saleOrder.id, orderId))
        .limit(1);

      if (!order) {
        return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
      }

      const orderPhoneDigits = (order.customerPhone || '').replace(/\D/g, '').slice(-10);
      if (orderPhoneDigits !== rawDigits) {
        return c.json({ error: 'Forbidden', message: 'This order does not belong to your account' }, 403);
      }

      const serviceLabels: Record<string, string> = {
        WATER: 'Water / Refill',
        CUTLERY: 'Extra Cutlery & Napkins',
        BILL: 'Bill Requested',
        CLEAN_TABLE: 'Clean Table',
        OTHER: 'Staff Assistance',
      };

      const label = serviceLabels[parsed.data.serviceType] || 'Staff Assistance';
      const now = Date.now();
      const reqId = `wr_${generateId()}`;
      const nowDate = new Date();

      // Persist to waiterRequest table so it appears on the Waiter page
      await db.insert(appSchema.waiterRequest).values({
        id: reqId,
        restaurantId: order.restaurantId,
        outletId: order.outletId,
        orderId,
        tableNo: order.tableNo || 'Takeaway',
        serviceType: parsed.data.serviceType,
        serviceLabel: label,
        note: parsed.data.note || null,
        customerPhone: phone,
        status: 'PENDING',
        createdBy: phone,
        createdAt: nowDate,
        updatedAt: nowDate,
      });

      // Broadcast to Outlet DO (POS / Floor Waiter tablet)
      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'ORDERS',
          type: 'WAITER_CALL',
          data: {
            id: reqId,
            orderId,
            orderNo: order.orderNo,
            tableNo: order.tableNo || 'Takeaway',
            serviceType: parsed.data.serviceType,
            serviceLabel: label,
            note: parsed.data.note || null,
            customerPhone: phone,
            timestamp: now,
          },
        },
        phone
      );

      return c.json({
        success: true,
        requestId: reqId,
        message: `Waiter notified: ${label}`,
        serviceType: parsed.data.serviceType,
        serviceLabel: label,
        timestamp: now,
      });
    } catch (err: any) {
      console.error('[customer/call-waiter] Error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message || String(err) }, 500);
    } finally {
      await close();
    }
  }
);

export const customerPortalRoutes = app;
