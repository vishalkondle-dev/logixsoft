import { Hono } from 'hono';
import { sql, eq, and, desc, inArray, or, isNull, asc } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { appSchema } from '../db';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';
import { getDb } from '../lib/order-helpers';
import { broadcastToOutlet } from '../lib/sync';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

function checkIsNonVeg(name?: string | null): boolean {
  if (!name) return false;
  return /chicken|mutton|fish|prawn|egg|lamb|meat|keema|beef|pork|seafood/i.test(name) && !/veg/i.test(name);
}

// ─── GET /marketplace/explore ─────────────────────────────────────────────────
app.get(
  '/explore',
  apiDoc({
    tags: ['Marketplace'],
    summary: 'Explore Restaurants & Direct Kitchen Deals',
    description: 'Returns active outlets with live table capacity, queue waiting times, cuisines, and featured dishes.',
    query: z.object({
      q: z.string().optional(),
      cuisine: z.string().optional(),
      mode: z.enum(['ALL', 'DINE_IN', 'TAKEAWAY', 'DELIVERY']).optional(),
      vegOnly: z.enum(['true', 'false']).optional(),
      openOnly: z.enum(['true', 'false']).optional(),
    }),
    responses: { 200: z.any() },
  }),
  async (c) => {
    const q = (c.req.query('q') || '').trim().toLowerCase();
    const cuisine = (c.req.query('cuisine') || '').trim();
    const mode = c.req.query('mode') || 'ALL';
    const vegOnly = c.req.query('vegOnly') === 'true';
    const openOnly = c.req.query('openOnly') === 'true';

    const { db, close } = getDb(c);
    try {
      // 1. Fetch all ACTIVE outlets & restaurants
      const outletRows = await db
        .select({
          outletId: appSchema.restaurantOutlet.id,
          outletName: appSchema.restaurantOutlet.name,
          outletAddress: appSchema.restaurantOutlet.address,
          outletPhone: appSchema.restaurantOutlet.phone,
          openingHours: appSchema.restaurantOutlet.openingHours,
          diningSettings: appSchema.restaurantOutlet.diningSettings,
          qrMenuSettings: appSchema.restaurantOutlet.qrMenuSettings,
          restaurantId: appSchema.restaurant.id,
          restaurantName: appSchema.restaurant.name,
          restaurantAddress: appSchema.restaurant.address,
          restaurantPhone: appSchema.restaurant.phone,
        })
        .from(appSchema.restaurantOutlet)
        .innerJoin(
          appSchema.restaurant,
          eq(appSchema.restaurantOutlet.restaurantId, appSchema.restaurant.id)
        )
        .where(
          and(
            eq(appSchema.restaurantOutlet.status, 'ACTIVE'),
            sql`${appSchema.restaurant.status} != 'SUSPENDED'`
          )
        );

      if (outletRows.length === 0) {
        return c.json({
          heroBanners: [],
          cuisines: [],
          outlets: [],
          totalCount: 0,
        });
      }

      const outletIds = outletRows.map((o) => o.outletId);

      // 2. Fetch all tables across these outlets
      const tables = await db
        .select({
          id: appSchema.posTable.id,
          outletId: appSchema.posTable.outletId,
          name: appSchema.posTable.name,
          section: appSchema.posTable.section,
          capacity: appSchema.posTable.capacity,
          active: appSchema.posTable.active,
        })
        .from(appSchema.posTable)
        .where(and(inArray(appSchema.posTable.outletId, outletIds), eq(appSchema.posTable.active, true)));

      // 3. Fetch active OPEN dine-in orders to compute occupied vs free tables
      const openOrders = await db
        .select({
          outletId: appSchema.saleOrder.outletId,
          tableNo: appSchema.saleOrder.tableNo,
        })
        .from(appSchema.saleOrder)
        .where(
          and(
            inArray(appSchema.saleOrder.outletId, outletIds),
            eq(appSchema.saleOrder.status, 'OPEN'),
            isNull(appSchema.saleOrder.tableFreedAt)
          )
        );

      // 4. Fetch waiting waitlist entries
      const waitlistWaiting = await db
        .select({
          outletId: appSchema.outletWaitlist.outletId,
          id: appSchema.outletWaitlist.id,
        })
        .from(appSchema.outletWaitlist)
        .where(
          and(
            inArray(appSchema.outletWaitlist.outletId, outletIds),
            eq(appSchema.outletWaitlist.status, 'WAITING')
          )
        );

      // 5. Fetch feedback / ratings summary per outlet
      const feedbackStats = await db
        .select({
          outletId: appSchema.orderFeedback.outletId,
          avgRating: sql<number>`ROUND(AVG(${appSchema.orderFeedback.rating})::numeric, 1)`,
          reviewCount: sql<number>`COUNT(${appSchema.orderFeedback.id})`,
        })
        .from(appSchema.orderFeedback)
        .where(inArray(appSchema.orderFeedback.outletId, outletIds))
        .groupBy(appSchema.orderFeedback.outletId);

      const ratingMap = new Map<string, { avg: number; count: number }>();
      for (const f of feedbackStats) {
        ratingMap.set(f.outletId, {
          avg: Number(f.avgRating) || 4.5,
          count: Number(f.reviewCount) || 0,
        });
      }

      // 6. Fetch categories per outlet
      const categoryRows = await db
        .select({
          id: appSchema.menuCategory.id,
          outletId: appSchema.menuCategory.outletId,
          name: appSchema.menuCategory.name,
        })
        .from(appSchema.menuCategory)
        .where(and(inArray(appSchema.menuCategory.outletId, outletIds), eq(appSchema.menuCategory.active, true)))
        .orderBy(asc(appSchema.menuCategory.sortOrder));

      // 7. Fetch active menu items per outlet (for featured preview & search)
      const itemRows = await db
        .select({
          id: appSchema.menuItem.id,
          outletId: appSchema.menuItem.outletId,
          categoryId: appSchema.menuItem.categoryId,
          name: appSchema.menuItem.name,
          description: appSchema.menuItem.description,
          pricePaise: appSchema.menuItem.pricePaise,
          imageUrl: appSchema.menuItem.imageUrl,
          ratingAvg: appSchema.menuItem.ratingAvg,
        })
        .from(appSchema.menuItem)
        .where(and(inArray(appSchema.menuItem.outletId, outletIds), eq(appSchema.menuItem.available, true)))
        .orderBy(desc(appSchema.menuItem.ratingAvg), asc(appSchema.menuItem.sortOrder));

      // Group data by outlet
      const tablesByOutlet = new Map<string, typeof tables>();
      for (const t of tables) {
        if (!t.outletId) continue;
        const list = tablesByOutlet.get(t.outletId) || [];
        list.push(t);
        tablesByOutlet.set(t.outletId, list);
      }

      const occupiedTablesByOutlet = new Map<string, Set<string>>();
      for (const o of openOrders) {
        if (!o.outletId || !o.tableNo) continue;
        const set = occupiedTablesByOutlet.get(o.outletId) || new Set<string>();
        set.add(o.tableNo.trim().toLowerCase());
        occupiedTablesByOutlet.set(o.outletId, set);
      }

      const waitingCountByOutlet = new Map<string, number>();
      for (const w of waitlistWaiting) {
        if (!w.outletId) continue;
        waitingCountByOutlet.set(w.outletId, (waitingCountByOutlet.get(w.outletId) || 0) + 1);
      }

      const categoriesByOutlet = new Map<string, typeof categoryRows>();
      for (const c of categoryRows) {
        if (!c.outletId) continue;
        const list = categoriesByOutlet.get(c.outletId) || [];
        list.push(c);
        categoriesByOutlet.set(c.outletId, list);
      }

      const itemsByOutlet = new Map<string, typeof itemRows>();
      for (const it of itemRows) {
        if (!it.outletId) continue;
        const list = itemsByOutlet.get(it.outletId) || [];
        list.push(it);
        itemsByOutlet.set(it.outletId, list);
      }

      // Collect all available cuisine tags
      const allCuisinesSet = new Set<string>();
      for (const c of categoryRows) {
        // Clean category name (e.g. "🍲 Biryani Specials" -> "Biryani")
        const clean = c.name.replace(/[^\w\s&]/gi, '').trim();
        if (clean.length > 2) allCuisinesSet.add(clean);
      }

      // Build enriched outlets list
      const outlets = outletRows.map((outlet) => {
        const outletTables = tablesByOutlet.get(outlet.outletId) || [];
        const occupiedSet = occupiedTablesByOutlet.get(outlet.outletId) || new Set<string>();

        let freeTables = 0;
        for (const t of outletTables) {
          const isOcc = occupiedSet.has(t.name.trim().toLowerCase());
          if (!isOcc) freeTables++;
        }

        const totalTables = outletTables.length;
        const occupiedTables = Math.min(totalTables, occupiedSet.size);
        const waitingCount = waitingCountByOutlet.get(outlet.outletId) || 0;
        const avgWaitMinutes = waitingCount === 0 ? 0 : Math.max(10, waitingCount * 6);

        const ratingInfo = ratingMap.get(outlet.outletId) || { avg: 4.8, count: 24 };
        const categories = categoriesByOutlet.get(outlet.outletId) || [];
        const items = itemsByOutlet.get(outlet.outletId) || [];

        const outletCuisines = categories.map((c) => c.name.replace(/[^\w\s&]/gi, '').trim()).filter((s) => s.length > 2);

        // Featured top dishes
        const featuredDishes = items.slice(0, 4).map((i) => {
          const isNonVeg = checkIsNonVeg(i.name);
          return {
            id: i.id,
            name: i.name,
            description: i.description || null,
            pricePaise: i.pricePaise,
            imageUrl: i.imageUrl || null,
            dietaryPreference: isNonVeg ? 'NON_VEG' : 'VEG',
            estimatedPrepMinutes: 15,
          };
        });

        // Calculate average savings compared to typical 28% delivery aggregator markup
        const avgDishPrice = featuredDishes.length > 0
          ? Math.round(featuredDishes.reduce((acc, d) => acc + d.pricePaise, 0) / featuredDishes.length)
          : 25000;
        const estimatedSavingsPaise = Math.round(avgDishPrice * 0.28);

        const qrSettings = (outlet.qrMenuSettings as any) || {};
        const diningSettings = (outlet.diningSettings as any) || {};

        const allowsDineIn = totalTables > 0;
        const allowsTakeaway = qrSettings.allowTakeaway !== false;
        const allowsDelivery = qrSettings.allowDelivery !== false;
        const allowsReservations = diningSettings.allowReservations !== false;

        return {
          id: outlet.outletId,
          restaurantId: outlet.restaurantId,
          name: outlet.outletName,
          restaurantName: outlet.restaurantName,
          address: outlet.outletAddress || outlet.restaurantAddress || 'Hyderabad, India',
          phone: outlet.outletPhone || outlet.restaurantPhone || '9876543210',
          rating: ratingInfo.avg,
          reviewsCount: ratingInfo.count,
          isOpen: true,
          modes: {
            dineIn: allowsDineIn,
            takeaway: allowsTakeaway,
            delivery: allowsDelivery,
            reservation: allowsReservations,
          },
          tables: {
            total: totalTables,
            free: freeTables,
            occupied: occupiedTables,
            availableNow: freeTables > 0,
          },
          waitlist: {
            waitingCount,
            avgWaitMinutes,
            isQueueOpen: true,
          },
          cuisines: outletCuisines.slice(0, 4),
          featuredDishes,
          estimatedSavingsPaise,
        };
      });

      // Filter by query / cuisine / mode
      let filtered = outlets;

      if (q) {
        filtered = filtered.filter((o) => {
          const matchOutlet = o.name.toLowerCase().includes(q) || o.restaurantName.toLowerCase().includes(q) || o.address.toLowerCase().includes(q);
          const matchCuisine = o.cuisines.some((c) => c.toLowerCase().includes(q));
          const matchDish = o.featuredDishes.some((d) => d.name.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q)));
          return matchOutlet || matchCuisine || matchDish;
        });
      }

      if (cuisine && cuisine.toLowerCase() !== 'all') {
        filtered = filtered.filter((o) =>
          o.cuisines.some((c) => c.toLowerCase().includes(cuisine.toLowerCase()))
        );
      }

      if (mode === 'DINE_IN') {
        filtered = filtered.filter((o) => o.modes.dineIn);
      } else if (mode === 'TAKEAWAY') {
        filtered = filtered.filter((o) => o.modes.takeaway);
      } else if (mode === 'DELIVERY') {
        filtered = filtered.filter((o) => o.modes.delivery);
      }

      if (vegOnly) {
        filtered = filtered.filter((o) =>
          o.featuredDishes.some((d) => d.dietaryPreference === 'VEG')
        );
      }

      if (openOnly) {
        filtered = filtered.filter((o) => o.tables.availableNow || o.waitlist.waitingCount <= 3);
      }

      // Hero Promotion Banners
      const heroBanners = [
        {
          id: 'banner_direct_pricing',
          title: 'Direct Kitchen Pricing',
          subtitle: 'Save up to 30% vs aggregator apps with zero platform markups',
          tag: 'Transparent Dining',
          color: 'teal',
          badge: '0% Commission',
        },
        {
          id: 'banner_live_queue',
          title: 'Live Table & Queue Radar',
          subtitle: 'View live table availability and join waitlists before you arrive',
          tag: 'Skip the Line',
          color: 'violet',
          badge: 'Live Sync',
        },
        {
          id: 'banner_curbside',
          title: 'Curbside Car Pickup',
          subtitle: 'Order ahead, enter your car details, and food is brought to your window',
          tag: 'Hot & Fresh',
          color: 'orange',
          badge: 'Zero Wait',
        },
      ];

      return c.json({
        heroBanners,
        cuisines: Array.from(allCuisinesSet).slice(0, 10),
        outlets: filtered,
        totalCount: filtered.length,
      });
    } finally {
      await close();
    }
  }
);

// ─── GET /marketplace/outlet/:outletId ────────────────────────────────────────
app.get(
  '/outlet/:outletId',
  apiDoc({
    tags: ['Marketplace'],
    summary: 'Get Outlet Storefront & Full Menu',
    description: 'Returns restaurant details, live capacity, and categorized menu for digital ordering.',
    params: z.object({ outletId: z.string() }),
    responses: { 200: z.any(), 404: ErrorResponseSchema },
  }),
  async (c) => {
    const outletId = c.req.param('outletId');
    const { db, close } = getDb(c);

    try {
      const [outlet] = await db
        .select({
          outletId: appSchema.restaurantOutlet.id,
          outletName: appSchema.restaurantOutlet.name,
          outletAddress: appSchema.restaurantOutlet.address,
          outletPhone: appSchema.restaurantOutlet.phone,
          openingHours: appSchema.restaurantOutlet.openingHours,
          diningSettings: appSchema.restaurantOutlet.diningSettings,
          qrMenuSettings: appSchema.restaurantOutlet.qrMenuSettings,
          upiId: appSchema.restaurantOutlet.upiId,
          restaurantId: appSchema.restaurant.id,
          restaurantName: appSchema.restaurant.name,
          restaurantAddress: appSchema.restaurant.address,
          restaurantPhone: appSchema.restaurant.phone,
        })
        .from(appSchema.restaurantOutlet)
        .innerJoin(
          appSchema.restaurant,
          eq(appSchema.restaurantOutlet.restaurantId, appSchema.restaurant.id)
        )
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .limit(1);

      if (!outlet) {
        return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);
      }

      // Tables & Capacity
      const tables = await db
        .select({ id: appSchema.posTable.id, name: appSchema.posTable.name })
        .from(appSchema.posTable)
        .where(and(eq(appSchema.posTable.outletId, outletId), eq(appSchema.posTable.active, true)));

      const openOrders = await db
        .select({ tableNo: appSchema.saleOrder.tableNo })
        .from(appSchema.saleOrder)
        .where(
          and(
            eq(appSchema.saleOrder.outletId, outletId),
            eq(appSchema.saleOrder.status, 'OPEN'),
            isNull(appSchema.saleOrder.tableFreedAt)
          )
        );

      const occupiedSet = new Set(openOrders.map((o) => (o.tableNo || '').trim().toLowerCase()));
      const freeTables = tables.filter((t) => !occupiedSet.has(t.name.trim().toLowerCase())).length;

      // Waitlist
      const waitlistWaiting = await db
        .select({ id: appSchema.outletWaitlist.id })
        .from(appSchema.outletWaitlist)
        .where(
          and(
            eq(appSchema.outletWaitlist.outletId, outletId),
            eq(appSchema.outletWaitlist.status, 'WAITING')
          )
        );
      const waitingCount = waitlistWaiting.length;

      // Categories
      const categories = await db
        .select()
        .from(appSchema.menuCategory)
        .where(and(eq(appSchema.menuCategory.outletId, outletId), eq(appSchema.menuCategory.active, true)))
        .orderBy(asc(appSchema.menuCategory.sortOrder));

      // Items
      const items = await db
        .select()
        .from(appSchema.menuItem)
        .where(and(eq(appSchema.menuItem.outletId, outletId), eq(appSchema.menuItem.available, true)))
        .orderBy(asc(appSchema.menuItem.sortOrder));

      const itemsByCategory = new Map<string, any[]>();
      for (const item of items) {
        const isNonVeg = checkIsNonVeg(item.name);
        const mapped = {
          id: item.id,
          name: item.name,
          description: item.description || '',
          pricePaise: item.pricePaise,
          imageUrl: item.imageUrl || null,
          dietaryPreference: isNonVeg ? 'NON_VEG' : 'VEG',
          variants: item.variants || [],
          addons: item.addons || [],
          ratingAvg: item.ratingAvg || 4.8,
          ratingCount: item.ratingCount || 10,
        };
        const list = itemsByCategory.get(item.categoryId) || [];
        list.push(mapped);
        itemsByCategory.set(item.categoryId, list);
      }

      const menuSections = categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description || null,
        items: itemsByCategory.get(cat.id) || [],
      })).filter((sec) => sec.items.length > 0);

      return c.json({
        outlet: {
          id: outlet.outletId,
          name: outlet.outletName,
          restaurantId: outlet.restaurantId,
          restaurantName: outlet.restaurantName,
          address: outlet.outletAddress || outlet.restaurantAddress || 'Hyderabad',
          phone: outlet.outletPhone || outlet.restaurantPhone || '9876543210',
          upiId: outlet.upiId || null,
          tables: {
            total: tables.length,
            free: freeTables,
            availableNow: freeTables > 0,
          },
          waitlist: {
            waitingCount,
            avgWaitMinutes: waitingCount === 0 ? 0 : Math.max(10, waitingCount * 6),
          },
        },
        sections: menuSections,
      });
    } finally {
      await close();
    }
  }
);

// ─── POST /marketplace/reservation ────────────────────────────────────────────
const MarketplaceReservationSchema = z.object({
  outletId: z.string().min(1),
  guestName: z.string().min(1).max(100),
  guestPhone: z.string().min(10).max(15),
  partySize: z.number().int().min(1).max(30).default(2),
  reservationDate: z.string().min(10).max(10), // YYYY-MM-DD
  startTime: z.string().min(1).max(20), // "07:30 PM"
  notes: z.string().max(250).optional(),
});

app.post(
  '/reservation',
  apiDoc({
    tags: ['Marketplace'],
    summary: 'Book Table Reservation from Marketplace',
    description: 'Reserves an upcoming table at the chosen outlet.',
    body: MarketplaceReservationSchema,
    responses: { 201: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = MarketplaceReservationSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { outletId, guestName, guestPhone, partySize, reservationDate, startTime, notes } = parsed.data;
    const cleanPhone = guestPhone.replace(/\D/g, '').slice(-10);

    const { db, close } = getDb(c);
    try {
      const [outlet] = await db
        .select({
          id: appSchema.restaurantOutlet.id,
          name: appSchema.restaurantOutlet.name,
          restaurantId: appSchema.restaurantOutlet.restaurantId,
        })
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .limit(1);

      if (!outlet) {
        return c.json({ error: 'Not Found', message: 'Restaurant outlet not found' }, 404);
      }

      const id = `resv_${generateId()}`;
      const now = new Date();

      const [reservation] = await db
        .insert(appSchema.tableReservation)
        .values({
          id,
          restaurantId: outlet.restaurantId,
          outletId,
          guestName: guestName.trim(),
          guestPhone: cleanPhone,
          partySize,
          reservationDate,
          startTime,
          status: 'CONFIRMED',
          notes: notes?.trim() || null,
          createdBy: cleanPhone,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await broadcastToOutlet(c.env, outletId, {
        topic: 'TABLES',
        type: 'RESERVATION_CREATED',
        data: {
          reservationId: id,
          guestName: reservation.guestName,
          partySize: reservation.partySize,
          reservationDate,
          startTime,
        },
      }).catch(() => {});

      return c.json({
        success: true,
        message: `Reservation confirmed for ${guestName} on ${reservationDate} at ${startTime}.`,
        reservation,
      }, 201);
    } finally {
      await close();
    }
  }
);

export { app as marketplaceRoutes };
