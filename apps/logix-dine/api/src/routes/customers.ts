import { Hono } from 'hono';
import { sql, eq, and, desc, inArray, or } from 'drizzle-orm';
import * as z from 'zod';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission } from '../lib/tenancy';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { sendWhatsAppText } from '@logixsoft/wa';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function kv(c: any) {
  return c.env?.CACHE;
}

// Normalize phone number to match various database stored formats
function getPhoneVariants(input: string): { rawDigits: string; variants: string[] } {
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

// ─── GET /customers/:phone ───────────────────────────────────────────────────
app.get(
  '/:phone',
  apiDoc({
    tags: ['Customers'],
    summary: 'Get Detailed Customer Profile',
    description: 'Retrieves comprehensive customer profile, order history, spend metrics, and preferences for a restaurant or specific outlet.',
    params: z.object({
      phone: z.string().meta({ description: 'Customer mobile number (10 digits or E.164)' }),
    }),
    query: z.object({
      outletId: z.string().optional().meta({ description: 'Filter metrics and orders by specific outlet' }),
    }),
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const rawParamPhone = c.req.param('phone');
    const filterOutletId = c.req.query('outletId');

    if (!rawParamPhone || rawParamPhone.trim().length < 5) {
      return c.json({ error: 'Bad Request', message: 'Valid mobile number is required' }, 400);
    }

    const { rawDigits, variants } = getPhoneVariants(rawParamPhone);
    const { db, close } = getDb(c);

    try {
      // 1. Fetch restaurant details
      const [restaurantRow] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      // 2. Fetch outlets for name mapping
      const outlets = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));

      const outletMap = new Map<string, any>();
      outlets.forEach((o: any) => outletMap.set(o.id, o));

      // 3. Find registered user if any
      const [matchedUser] = await db
        .select()
        .from(appSchema.user)
        .where(
          or(
            inArray(appSchema.user.phoneNumber, variants),
            sql`${appSchema.user.phoneNumber} LIKE ${'%' + rawDigits}`
          )
        )
        .limit(1);

      // 4. Query all sale orders for this restaurant matching customer phone
      const orderConditions = [
        eq(appSchema.saleOrder.restaurantId, restaurantId),
        or(
          inArray(appSchema.saleOrder.customerPhone, variants),
          sql`${appSchema.saleOrder.customerPhone} LIKE ${'%' + rawDigits}`
        ),
      ];

      const allOrders = await db
        .select()
        .from(appSchema.saleOrder)
        .where(and(...orderConditions))
        .orderBy(desc(appSchema.saleOrder.createdAt));

      // 5. Fetch all items for these orders
      const orderIds = allOrders.map((o: any) => o.id);
      const allItems = orderIds.length
        ? await db
            .select()
            .from(appSchema.saleOrderItem)
            .where(inArray(appSchema.saleOrderItem.orderId, orderIds))
            .orderBy(desc(appSchema.saleOrderItem.createdAt))
        : [];

      // Group items by orderId
      const itemsByOrderId = new Map<string, any[]>();
      allItems.forEach((item: any) => {
        const list = itemsByOrderId.get(item.orderId) || [];
        list.push(item);
        itemsByOrderId.set(item.orderId, list);
      });

      // 6. Fetch custom customer notes & tags from KV
      let savedNotes = '';
      let savedTags: string[] = [];
      if (kv(c)) {
        try {
          const cachedProfile = await kv(c).get(`cust:meta:${restaurantId}:${rawDigits}`, 'json');
          if (cachedProfile && typeof cachedProfile === 'object') {
            savedNotes = (cachedProfile as any).notes || '';
            savedTags = (cachedProfile as any).tags || [];
          }
        } catch {
          // ignore kv read errors
        }
      }

      // Filter orders if outletId is specified
      const scopedOrders = filterOutletId
        ? allOrders.filter((o: any) => o.outletId === filterOutletId)
        : allOrders;

      const scopedOrderIds = new Set(scopedOrders.map((o: any) => o.id));
      const scopedItems = allItems.filter((item: any) => scopedOrderIds.has(item.orderId));

      // Compute metrics
      const totalOrdersCount = scopedOrders.length;
      const completedOrders = scopedOrders.filter((o: any) => o.status === 'PAID');
      const cancelledOrders = scopedOrders.filter((o: any) => o.status === 'VOID' || o.orderStatus === 'CANCELLED');
      const openOrders = scopedOrders.filter((o: any) => o.status === 'OPEN' && o.orderStatus !== 'CANCELLED');

      const lifetimeSpendPaise = completedOrders.reduce((sum: number, o: any) => sum + (o.paidPaise || o.subtotalPaise || 0), 0);
      const averageOrderValuePaise = completedOrders.length ? Math.round(lifetimeSpendPaise / completedOrders.length) : 0;
      const highestOrderPaise = scopedOrders.reduce((max: number, o: any) => Math.max(max, o.subtotalPaise || 0), 0);

      // Visit dates
      const validDates = scopedOrders
        .map((o: any) => o.createdAt ? new Date(o.createdAt).getTime() : 0)
        .filter((t: number) => t > 0);

      const firstVisitAt = validDates.length ? new Date(Math.min(...validDates)).toISOString() : null;
      const lastVisitAt = validDates.length ? new Date(Math.max(...validDates)).toISOString() : null;

      const daysSinceLastVisit = lastVisitAt
        ? Math.max(0, Math.floor((Date.now() - new Date(lastVisitAt).getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      let visitFrequencyDays: number | null = null;
      if (validDates.length > 1 && firstVisitAt && lastVisitAt) {
        const totalSpanDays = (new Date(lastVisitAt).getTime() - new Date(firstVisitAt).getTime()) / (1000 * 60 * 60 * 24);
        visitFrequencyDays = Math.round((totalSpanDays / (validDates.length - 1)) * 10) / 10;
      }

      // Dining preference (Dine-In vs Takeaway)
      const takeawayOrders = scopedOrders.filter((o: any) => (o.tableNo || '').toLowerCase() === 'takeaway');
      const dineInOrders = scopedOrders.filter((o: any) => o.tableNo && o.tableNo.toLowerCase() !== 'takeaway');
      const preferredDineMode = takeawayOrders.length > dineInOrders.length ? 'Takeaway' : 'Dine-In';

      // Preferred table
      const tableCounts: Record<string, number> = {};
      dineInOrders.forEach((o: any) => {
        if (o.tableNo) tableCounts[o.tableNo] = (tableCounts[o.tableNo] || 0) + 1;
      });
      let preferredTable: string | null = null;
      let maxTableOrders = 0;
      Object.entries(tableCounts).forEach(([tbl, cnt]) => {
        if (cnt > maxTableOrders) {
          maxTableOrders = cnt;
          preferredTable = tbl;
        }
      });

      // Payment method breakdown
      const methodCounts: Record<string, { count: number; totalPaise: number }> = {};
      completedOrders.forEach((o: any) => {
        const m = o.method || 'Cash';
        const current = methodCounts[m] || { count: 0, totalPaise: 0 };
        current.count += 1;
        current.totalPaise += (o.paidPaise || o.subtotalPaise || 0);
        methodCounts[m] = current;
      });

      let preferredPaymentMethod: string | null = null;
      let maxPaymentCount = 0;
      Object.entries(methodCounts).forEach(([m, stat]) => {
        if (stat.count > maxPaymentCount) {
          maxPaymentCount = stat.count;
          preferredPaymentMethod = m;
        }
      });

      // Dietary preference (Veg vs Non-Veg items ordered)
      let vegItemsCount = 0;
      let nonVegItemsCount = 0;
      const itemAggregate: Record<string, { itemId: string; name: string; isNonVeg: boolean; qty: number; totalSpendPaise: number; orderCount: number; lastOrderedAt: string }> = {};

      scopedItems.forEach((item: any) => {
        if (item.status === 'CANCELLED') return;
        const isNonVeg = checkIsNonVeg(item.nameSnapshot);
        if (isNonVeg) {
          nonVegItemsCount += item.qty;
        } else {
          vegItemsCount += item.qty;
        }

        const key = item.nameSnapshot.trim();
        const existing = itemAggregate[key] || {
          itemId: item.itemId,
          name: key,
          isNonVeg,
          qty: 0,
          totalSpendPaise: 0,
          orderCount: 0,
          lastOrderedAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        };

        existing.qty += item.qty;
        existing.totalSpendPaise += (item.pricePaiseSnapshot * item.qty);
        existing.orderCount += 1;
        if (item.createdAt && new Date(item.createdAt).getTime() > new Date(existing.lastOrderedAt).getTime()) {
          existing.lastOrderedAt = new Date(item.createdAt).toISOString();
        }
        itemAggregate[key] = existing;
      });

      const totalDishesCount = vegItemsCount + nonVegItemsCount;
      let primaryDietaryPreference: 'Veg' | 'Non-Veg' | 'Mixed' = 'Mixed';
      if (totalDishesCount > 0) {
        const vegRatio = vegItemsCount / totalDishesCount;
        if (vegRatio >= 0.85) primaryDietaryPreference = 'Veg';
        else if (vegRatio <= 0.2) primaryDietaryPreference = 'Non-Veg';
      }

      // Favorite items sorted by quantity
      const favoriteItems = Object.values(itemAggregate)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

      // Outlet Breakdown (across all orders of this customer in the restaurant)
      const outletBreakdownMap: Record<string, { outletId: string; outletName: string; ordersCount: number; totalSpendPaise: number; lastVisit: string | null }> = {};
      allOrders.forEach((o: any) => {
        const oId = o.outletId;
        const oName = outletMap.get(oId)?.name || 'Main Outlet';
        const current = outletBreakdownMap[oId] || {
          outletId: oId,
          outletName: oName,
          ordersCount: 0,
          totalSpendPaise: 0,
          lastVisit: null,
        };
        current.ordersCount += 1;
        if (o.status === 'PAID') {
          current.totalSpendPaise += (o.paidPaise || o.subtotalPaise || 0);
        }
        const ordTime = o.createdAt ? new Date(o.createdAt).toISOString() : null;
        if (ordTime && (!current.lastVisit || new Date(ordTime).getTime() > new Date(current.lastVisit).getTime())) {
          current.lastVisit = ordTime;
        }
        outletBreakdownMap[oId] = current;
      });

      // Compute dynamic tags
      const computedTags = new Set<string>(savedTags);
      if (lifetimeSpendPaise >= 500000 || totalOrdersCount >= 8) {
        computedTags.add('VIP Customer');
      } else if (totalOrdersCount >= 3) {
        computedTags.add('Regular Customer');
      } else if (totalOrdersCount === 1) {
        computedTags.add('New Customer');
      }

      if (primaryDietaryPreference === 'Veg') {
        computedTags.add('Pure Vegetarian');
      } else if (primaryDietaryPreference === 'Non-Veg') {
        computedTags.add('Non-Veg Lover');
      }

      if (takeawayOrders.length > 0 && takeawayOrders.length >= scopedOrders.length * 0.7) {
        computedTags.add('Takeaway Preferer');
      } else if (dineInOrders.length > 0 && dineInOrders.length >= scopedOrders.length * 0.7) {
        computedTags.add('Dine-In Lover');
      }

      // Format customer phone for clean display
      let displayPhone = rawParamPhone;
      if (rawDigits.length === 10) {
        displayPhone = `+91 ${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}`;
      }

      // Formatted list of orders with items
      const formattedOrders = scopedOrders.map((o: any) => {
        const ordItems = itemsByOrderId.get(o.id) || [];
        return {
          id: o.id,
          orderNo: o.orderNo,
          outletId: o.outletId,
          outletName: outletMap.get(o.outletId)?.name || 'Main Outlet',
          tableNo: o.tableNo || 'Takeaway',
          customerPhone: o.customerPhone,
          status: o.status,
          orderStatus: o.orderStatus,
          subtotalPaise: o.subtotalPaise,
          paidPaise: o.paidPaise,
          method: o.method,
          note: o.note,
          createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
          settledAt: o.settledAt ? new Date(o.settledAt).toISOString() : null,
          itemsCount: ordItems.reduce((sum: number, it: any) => sum + it.qty, 0),
          items: ordItems.map((it: any) => ({
            id: it.id,
            itemId: it.itemId,
            name: it.nameSnapshot,
            pricePaise: it.pricePaiseSnapshot,
            qty: it.qty,
            variant: it.variant,
            addons: it.addons,
            status: it.status,
            paymentStatus: it.paymentStatus,
            round: it.round,
            note: it.note,
          })),
        };
      });

      return c.json({
        customer: {
          phone: displayPhone,
          rawPhone: rawDigits,
          name: matchedUser?.name || null,
          email: matchedUser?.email || null,
          image: matchedUser?.image || null,
          tags: Array.from(computedTags),
          notes: savedNotes,
        },
        scope: {
          filterOutletId: filterOutletId || null,
          activeOutletName: filterOutletId ? outletMap.get(filterOutletId)?.name || null : 'All Outlets',
          restaurantName: restaurantRow?.name || 'Restaurant',
        },
        metrics: {
          totalOrdersCount,
          completedOrdersCount: completedOrders.length,
          cancelledOrdersCount: cancelledOrders.length,
          openOrdersCount: openOrders.length,
          lifetimeSpendPaise,
          averageOrderValuePaise,
          highestOrderPaise,
          firstVisitAt,
          lastVisitAt,
          daysSinceLastVisit,
          visitFrequencyDays,
          dineInCount: dineInOrders.length,
          takeawayCount: takeawayOrders.length,
          preferredDineMode,
          preferredTable,
          preferredPaymentMethod,
          paymentMethodsBreakdown: Object.entries(methodCounts).map(([method, data]) => ({
            method,
            count: data.count,
            totalPaise: data.totalPaise,
          })),
          dietaryPreference: {
            vegCount: vegItemsCount,
            nonVegCount: nonVegItemsCount,
            totalDishes: totalDishesCount,
            primary: primaryDietaryPreference,
          },
        },
        overallChainMetrics: {
          totalChainOrders: allOrders.length,
          totalChainSpendPaise: allOrders
            .filter((o: any) => o.status === 'PAID')
            .reduce((sum: number, o: any) => sum + (o.paidPaise || o.subtotalPaise || 0), 0),
          outletBreakdown: Object.values(outletBreakdownMap),
        },
        favoriteItems,
        orders: formattedOrders,
      });
    } finally {
      await close();
    }
  }
);

// ─── PUT /customers/:phone/notes ─────────────────────────────────────────────
app.put(
  '/:phone/notes',
  apiDoc({
    tags: ['Customers'],
    summary: 'Update Customer Notes & Tags',
    description: 'Saves staff notes and custom tags for this customer.',
    params: z.object({
      phone: z.string(),
    }),
    body: z.object({
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const phone = c.req.param('phone');
    const { rawDigits } = getPhoneVariants(phone);

    const body = await c.req.json().catch(() => ({}));
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const tags = Array.isArray(body.tags) ? body.tags.filter((t: any) => typeof t === 'string' && t.trim()) : [];

    if (kv(c)) {
      await kv(c).put(
        `cust:meta:${restaurantId}:${rawDigits}`,
        JSON.stringify({ notes, tags, updatedAt: new Date().toISOString() })
      );
    }

    return c.json({ success: true, notes, tags });
  }
);

// ─── POST /customers/:phone/whatsapp ─────────────────────────────────────────
app.post(
  '/:phone/whatsapp',
  apiDoc({
    tags: ['Customers'],
    summary: 'Send WhatsApp to Customer',
    description: 'Sends a direct WhatsApp message to the customer via OpenWA.',
    params: z.object({
      phone: z.string(),
    }),
    body: z.object({
      message: z.string().min(1),
    }),
    responses: {
      200: z.object({ success: z.boolean(), waResponse: z.any() }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const phone = c.req.param('phone');
    const { rawDigits } = getPhoneVariants(phone);
    const body = await c.req.json().catch(() => ({}));
    const message = body.message;

    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Validation Error', message: 'message is required' }, 400);
    }

    const targetPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;

    try {
      const waRes = await sendWhatsAppText(
        targetPhone,
        message,
        undefined,
        { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY }
      );
      return c.json({ success: true, waResponse: waRes });
    } catch (err: any) {
      return c.json({ error: 'WhatsApp Delivery Failed', message: err.message || String(err) }, 500);
    }
  }
);

export const customerRoutes = app;
