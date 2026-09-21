import { Hono } from 'hono';
import { sql, eq, and, desc, inArray, or } from 'drizzle-orm';
import * as z from 'zod';
import { createDbWithClient, appSchema } from '../db';
import { requireAuth } from '../lib/tenancy';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { broadcastToCustomer } from '../lib/sync';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

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

      // 2. Fetch outlet details
      const outletRows = outletIds.length > 0
        ? await db
            .select({ id: appSchema.restaurantOutlet.id, name: appSchema.restaurantOutlet.name, address: appSchema.restaurantOutlet.address })
            .from(appSchema.restaurantOutlet)
            .where(inArray(appSchema.restaurantOutlet.id, outletIds as string[]))
        : [];
      const outletMap = new Map<string, { name: string; address?: string | null }>(
        outletRows.map((o: any) => [o.id, o])
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
        const mappedOrder = {
          id: o.id,
          orderNo: o.orderNo,
          outletId: o.outletId,
          outletName: outlet?.name || 'Restaurant Outlet',
          outletAddress: outlet?.address || null,
          tableNo: o.tableNo || 'Takeaway',
          status: o.status,
          subtotalPaise: o.subtotalPaise || 0,
          paidPaise: o.paidPaise || 0,
          method: o.method || 'Cash',
          note: o.note,
          createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
          settledAt: o.settledAt ? new Date(o.settledAt).toISOString() : null,
          itemsCount: ordItems.reduce((sum: number, it: any) => sum + it.qty, 0),
          items: ordItems.map((it: any) => ({
            id: it.id,
            name: it.nameSnapshot,
            pricePaise: it.pricePaiseSnapshot,
            qty: it.qty,
            variant: it.variant,
            addons: it.addons,
            status: it.status,
            note: it.note,
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

export const customerPortalRoutes = app;
