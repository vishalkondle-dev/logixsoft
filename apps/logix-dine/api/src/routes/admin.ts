import { Hono } from 'hono';
import { eq, sql, desc, inArray, and, or } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requireAdmin } from '../lib/tenancy';
import { RestaurantSchema } from '@logixsoft/logix-dine/schemas/pos';
import { toRestaurant, toOutlet } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';
import { invalidateRestaurant, cacheGet, cacheSet, cacheDel, CacheKey, TTL } from '../lib/cache';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function getKv(c: any) {
  return (c.env as any)?.CACHE;
}

function normalizePhone(input: string): string {
  const cleaned = input.trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return cleaned.startsWith('+') ? cleaned : `+${digits}`;
}

// ─── 1. Platform Macro Metrics ────────────────────────────────────────────────

app.get(
  '/metrics',
  apiDoc({
    tags: ['Admin'],
    summary: 'Platform Macro Metrics (Admin)',
    description: 'Returns aggregated platform statistics: total stores, outlets, users, orders, and GMV.',
    responses: {
      200: z.object({
        totalRestaurants: z.number(),
        activeRestaurants: z.number(),
        trialRestaurants: z.number(),
        suspendedRestaurants: z.number(),
        totalOutlets: z.number(),
        totalUsers: z.number(),
        adminUsers: z.number(),
        ownerUsers: z.number(),
        customerUsers: z.number(),
        totalOrders: z.number(),
        totalGmv: z.number(),
        todayOrders: z.number(),
        todayGmv: z.number(),
        recentRestaurants: z.array(z.any()),
        recentUsers: z.array(z.any()),
      }),
      403: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const { db, close } = getDb(c);
    try {
      const [rests, outlets, users, orders] = await Promise.all([
        db
          .select({
            id: appSchema.restaurant.id,
            name: appSchema.restaurant.name,
            status: appSchema.restaurant.status,
            createdAt: appSchema.restaurant.createdAt,
            phone: appSchema.restaurant.phone,
          })
          .from(appSchema.restaurant),
        db.select({ id: appSchema.restaurantOutlet.id }).from(appSchema.restaurantOutlet),
        db
          .select({
            id: appSchema.user.id,
            name: appSchema.user.name,
            phoneNumber: appSchema.user.phoneNumber,
            role: appSchema.user.role,
            createdAt: appSchema.user.createdAt,
          })
          .from(appSchema.user),
        db
          .select({
            id: appSchema.saleOrder.id,
            subtotalPaise: appSchema.saleOrder.subtotalPaise,
            paidPaise: appSchema.saleOrder.paidPaise,
            createdAt: appSchema.saleOrder.createdAt,
          })
          .from(appSchema.saleOrder),
      ]);

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let totalGmv = 0;
      let todayOrders = 0;
      let todayGmv = 0;

      for (const order of orders) {
        const orderAmount = (order.paidPaise || order.subtotalPaise || 0) / 100;
        totalGmv += orderAmount;
        if (new Date(order.createdAt) >= startOfDay) {
          todayOrders++;
          todayGmv += orderAmount;
        }
      }

      const recentRestaurants = [...rests]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      const recentUsers = [...users]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      return c.json({
        totalRestaurants: rests.length,
        activeRestaurants: rests.filter((r) => r.status === 'ACTIVE').length,
        trialRestaurants: rests.filter((r) => r.status === 'TRIAL').length,
        suspendedRestaurants: rests.filter((r) => r.status === 'SUSPENDED').length,
        totalOutlets: outlets.length,
        totalUsers: users.length,
        adminUsers: users.filter((u) => u.role === 'ADMIN').length,
        ownerUsers: users.filter((u) => u.role === 'OWNER').length,
        customerUsers: users.filter((u) => u.role === 'CUSTOMER' || !u.role).length,
        totalOrders: orders.length,
        totalGmv: Math.round(totalGmv * 100) / 100,
        todayOrders,
        todayGmv: Math.round(todayGmv * 100) / 100,
        recentRestaurants,
        recentUsers,
      });
    } finally {
      await close();
    }
  }
);

// ─── 2. Restaurants Management ────────────────────────────────────────────────

// GET /admin/restaurants
app.get(
  '/restaurants',
  apiDoc({
    tags: ['Admin'],
    summary: 'List All Restaurants with Metadata (Admin)',
    description: 'Returns all platform restaurants with owner info, outlets count, orders count and GMV.',
    responses: {
      200: z.array(z.any()),
      403: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const status = c.req.query('status');
    const sortBy = c.req.query('sortBy') || 'name_asc';

    const { db, close } = getDb(c);
    try {
      const [restaurants, users, outlets, orders] = await Promise.all([
        db.select().from(appSchema.restaurant),
        db
          .select({
            id: appSchema.user.id,
            name: appSchema.user.name,
            phoneNumber: appSchema.user.phoneNumber,
          })
          .from(appSchema.user),
        db
          .select({
            id: appSchema.restaurantOutlet.id,
            restaurantId: appSchema.restaurantOutlet.restaurantId,
          })
          .from(appSchema.restaurantOutlet),
        db
          .select({
            restaurantId: appSchema.saleOrder.restaurantId,
            paidPaise: appSchema.saleOrder.paidPaise,
            subtotalPaise: appSchema.saleOrder.subtotalPaise,
          })
          .from(appSchema.saleOrder),
      ]);

      const usersMap = new Map<string, { name: string | null; phoneNumber: string | null }>();
      for (const u of users) {
        usersMap.set(u.id, { name: u.name, phoneNumber: u.phoneNumber });
      }

      const outletsCountMap = new Map<string, number>();
      for (const o of outlets) {
        outletsCountMap.set(o.restaurantId, (outletsCountMap.get(o.restaurantId) || 0) + 1);
      }

      const ordersStatsMap = new Map<string, { count: number; gmv: number }>();
      for (const ord of orders) {
        const current = ordersStatsMap.get(ord.restaurantId) || { count: 0, gmv: 0 };
        current.count++;
        current.gmv += (ord.paidPaise || ord.subtotalPaise || 0) / 100;
        ordersStatsMap.set(ord.restaurantId, current);
      }

      let enriched = restaurants.map((r) => {
        const owner = usersMap.get(r.ownerUserId);
        const stats = ordersStatsMap.get(r.id) || { count: 0, gmv: 0 };
        return {
          id: r.id,
          name: r.name,
          address: r.address,
          phone: r.phone,
          currency: r.currency || 'INR',
          status: r.status,
          ownerUserId: r.ownerUserId,
          ownerName: owner?.name || null,
          ownerPhone: owner?.phoneNumber || null,
          outletsCount: outletsCountMap.get(r.id) || 0,
          ordersCount: stats.count,
          totalGmv: Math.round(stats.gmv * 100) / 100,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });

      // Server-side filtering
      if (status && status !== 'ALL') {
        enriched = enriched.filter((r) => r.status === status);
      }
      if (search) {
        enriched = enriched.filter(
          (r) =>
            (r.name && r.name.toLowerCase().includes(search)) ||
            (r.address && r.address.toLowerCase().includes(search)) ||
            (r.phone && r.phone.toLowerCase().includes(search)) ||
            (r.ownerName && r.ownerName.toLowerCase().includes(search)) ||
            (r.ownerPhone && r.ownerPhone.toLowerCase().includes(search))
        );
      }

      // Server-side sorting
      enriched.sort((a, b) => {
        if (sortBy === 'name_asc' || sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
        if (sortBy === 'gmv_desc' || sortBy === 'gmv') return (b.totalGmv || 0) - (a.totalGmv || 0);
        if (sortBy === 'gmv_asc') return (a.totalGmv || 0) - (b.totalGmv || 0);
        if (sortBy === 'outlets_desc' || sortBy === 'outlets') return (b.outletsCount || 0) - (a.outletsCount || 0);
        if (sortBy === 'orders_desc' || sortBy === 'orders') return (b.ordersCount || 0) - (a.ordersCount || 0);
        if (sortBy === 'newest' || sortBy === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return (a.name || '').localeCompare(b.name || '');
      });

      return c.json(enriched);
    } finally {
      await close();
    }
  }
);

// POST /admin/restaurants — create new restaurant with owner and default outlet
app.post(
  '/restaurants',
  apiDoc({
    tags: ['Admin'],
    summary: 'Create New Restaurant (Admin)',
    description: 'Provisions a new restaurant tenant, creates or links owner, provisions default outlet and owner membership.',
    body: z.object({
      name: z.string().min(1),
      address: z.string().min(1),
      phone: z.string().optional(),
      currency: z.string().default('INR'),
      status: z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED']).default('ACTIVE'),
      ownerPhone: z.string().min(10),
      ownerName: z.string().optional(),
      outletName: z.string().optional(),
      outletAddress: z.string().optional(),
    }),
    responses: {
      201: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { name, address, phone, currency = 'INR', status = 'ACTIVE', ownerPhone, ownerName, outletName, outletAddress } = body;

    if (!name || !address || !ownerPhone) {
      return c.json({ error: 'Validation Error', message: 'name, address, and ownerPhone are required' }, 400);
    }

    const cleanOwnerPhone = normalizePhone(ownerPhone);
    const sessionUser = c.get('sessionUser') as any;
    const actorPhone = sessionUser?.phoneNumber || 'superadmin';

    const { db, close } = getDb(c);
    try {
      // 1. Find or create user for ownerPhone
      let [ownerUser] = await db
        .select()
        .from(appSchema.user)
        .where(eq(appSchema.user.phoneNumber, cleanOwnerPhone))
        .limit(1);

      const now = new Date();

      if (!ownerUser) {
        const newUserId = generateId('user');
        const [createdUser] = await db
          .insert(appSchema.user)
          .values({
            id: newUserId,
            name: ownerName?.trim() || `Owner ${cleanOwnerPhone.slice(-4)}`,
            phoneNumber: cleanOwnerPhone,
            phoneNumberVerified: true,
            role: 'OWNER',
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        ownerUser = createdUser;
      } else if (ownerUser.role === 'CUSTOMER') {
        // Upgrade role to OWNER if currently CUSTOMER
        await db
          .update(appSchema.user)
          .set({ role: 'OWNER', updatedAt: now })
          .where(eq(appSchema.user.id, ownerUser.id));
      }

      // 2. Generate IDs
      const restaurantId = generateId('rest');
      const outletId = generateId('outlet');
      const memberId = generateId('member');

      // 3. Atomically insert restaurant, default outlet, and owner member
      await db.transaction(async (tx) => {
        await tx.insert(appSchema.restaurant).values({
          id: restaurantId,
          name: name.trim(),
          address: address.trim(),
          phone: phone ? phone.trim() : null,
          currency,
          status,
          ownerUserId: ownerUser.id,
          createdAt: now,
          updatedAt: now,
          createdBy: actorPhone,
          updatedBy: actorPhone,
        });

        await tx.insert(appSchema.restaurantOutlet).values({
          id: outletId,
          restaurantId,
          name: outletName?.trim() || 'Main Branch',
          address: outletAddress?.trim() || address.trim(),
          phone: phone ? phone.trim() : cleanOwnerPhone,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
          createdBy: actorPhone,
          updatedBy: actorPhone,
        });

        await tx.insert(appSchema.restaurantMember).values({
          id: memberId,
          restaurantId,
          userId: ownerUser.id,
          phone: cleanOwnerPhone,
          role: 'OWNER',
          inviteStatus: 'ACCEPTED',
          createdAt: now,
          updatedAt: now,
          createdBy: actorPhone,
          updatedBy: actorPhone,
        });
      });

      const [created] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      return c.json(
        {
          ...toRestaurant(created),
          ownerName: ownerUser.name,
          ownerPhone: ownerUser.phoneNumber,
          defaultOutletId: outletId,
        },
        201
      );
    } finally {
      await close();
    }
  }
);

// GET /admin/restaurants/:id — single restaurant detailed inspection
app.get(
  '/restaurants/:id',
  apiDoc({
    tags: ['Admin'],
    summary: 'Get Restaurant Details (Admin)',
    description: 'Returns complete restaurant details including all outlets, members, and metrics.',
    params: z.object({ id: z.string() }),
    responses: {
      200: z.any(),
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const restaurantId = c.req.param('id');
    const { db, close } = getDb(c);
    try {
      const [rest] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      if (!rest) return c.json({ error: 'Not Found', message: 'Restaurant not found' }, 404);

      const [outlets, members, users, orders] = await Promise.all([
        db.select().from(appSchema.restaurantOutlet).where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId)),
        db.select().from(appSchema.restaurantMember).where(eq(appSchema.restaurantMember.restaurantId, restaurantId)),
        db.select({ id: appSchema.user.id, name: appSchema.user.name, phoneNumber: appSchema.user.phoneNumber }).from(appSchema.user),
        db
          .select({
            id: appSchema.saleOrder.id,
            paidPaise: appSchema.saleOrder.paidPaise,
            subtotalPaise: appSchema.saleOrder.subtotalPaise,
          })
          .from(appSchema.saleOrder)
          .where(eq(appSchema.saleOrder.restaurantId, restaurantId)),
      ]);

      const usersMap = new Map<string, { name: string | null; phoneNumber: string | null }>();
      for (const u of users) {
        usersMap.set(u.id, { name: u.name, phoneNumber: u.phoneNumber });
      }

      const owner = usersMap.get(rest.ownerUserId);
      const membersWithNames = members.map((m) => {
        const u = m.userId ? usersMap.get(m.userId) : null;
        return {
          id: m.id,
          userId: m.userId,
          phone: m.phone,
          role: m.role,
          name: u?.name || null,
          inviteStatus: m.inviteStatus,
          createdAt: m.createdAt,
        };
      });

      let totalGmv = 0;
      for (const ord of orders) {
        totalGmv += (ord.paidPaise || ord.subtotalPaise || 0) / 100;
      }

      return c.json({
        ...toRestaurant(rest),
        ownerName: owner?.name || null,
        ownerPhone: owner?.phoneNumber || null,
        outlets: outlets.map(toOutlet),
        members: membersWithNames,
        ordersCount: orders.length,
        totalGmv: Math.round(totalGmv * 100) / 100,
      });
    } finally {
      await close();
    }
  }
);

// PATCH /admin/restaurants/:id — update restaurant settings or status
app.patch(
  '/restaurants/:id',
  apiDoc({
    tags: ['Admin'],
    summary: 'Update Restaurant (Admin)',
    description: 'Updates restaurant name, address, phone, currency, status, or transfers ownership.',
    params: z.object({ id: z.string() }),
    body: z.object({
      name: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      currency: z.string().optional(),
      status: z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'CHURNED']).optional(),
      ownerPhone: z.string().optional(),
    }),
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const restaurantId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { name, address, phone, currency, status, ownerPhone } = body;

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      if (!existing) return c.json({ error: 'Not Found', message: 'Restaurant not found' }, 404);

      const updates: any = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name.trim();
      if (address !== undefined) updates.address = address.trim();
      if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
      if (currency !== undefined) updates.currency = currency.trim();
      if (status !== undefined) updates.status = status;

      // Handle ownership transfer if ownerPhone changed
      if (ownerPhone) {
        const cleanOwnerPhone = normalizePhone(ownerPhone);
        let [ownerUser] = await db
          .select()
          .from(appSchema.user)
          .where(eq(appSchema.user.phoneNumber, cleanOwnerPhone))
          .limit(1);

        if (!ownerUser) {
          const newUserId = generateId('user');
          const [created] = await db
            .insert(appSchema.user)
            .values({
              id: newUserId,
              name: `Owner ${cleanOwnerPhone.slice(-4)}`,
              phoneNumber: cleanOwnerPhone,
              phoneNumberVerified: true,
              role: 'OWNER',
            })
            .returning();
          ownerUser = created;
        } else if (ownerUser.role === 'CUSTOMER') {
          await db
            .update(appSchema.user)
            .set({ role: 'OWNER', updatedAt: new Date() })
            .where(eq(appSchema.user.id, ownerUser.id));
        }

        updates.ownerUserId = ownerUser.id;

        // Ensure owner has an OWNER membership row
        const [existingMember] = await db
          .select()
          .from(appSchema.restaurantMember)
          .where(
            and(
              eq(appSchema.restaurantMember.restaurantId, restaurantId),
              eq(appSchema.restaurantMember.phone, cleanOwnerPhone)
            )
          )
          .limit(1);

        if (!existingMember) {
          await db.insert(appSchema.restaurantMember).values({
            id: generateId('member'),
            restaurantId,
            userId: ownerUser.id,
            phone: cleanOwnerPhone,
            role: 'OWNER',
            inviteStatus: 'ACCEPTED',
          });
        }
      }

      await db
        .update(appSchema.restaurant)
        .set(updates)
        .where(eq(appSchema.restaurant.id, restaurantId));

      const kv = getKv(c);
      if (kv) {
        await invalidateRestaurant(kv, restaurantId).catch(() => {});
      }

      const [updated] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      return c.json(toRestaurant(updated));
    } finally {
      await close();
    }
  }
);

// DELETE /admin/restaurants/:id — cascade delete restaurant
app.delete(
  '/restaurants/:id',
  apiDoc({
    tags: ['Admin'],
    summary: 'Delete Restaurant (Admin)',
    description: 'Permanently deletes a restaurant tenant and its associated outlets, members, and tables.',
    params: z.object({ id: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const restaurantId = c.req.param('id');
    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select({ id: appSchema.restaurant.id })
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      if (!existing) return c.json({ error: 'Not Found', message: 'Restaurant not found' }, 404);

      // Invert dependency deletions or let Postgres cascade onDelete: cascade handle it
      await db.delete(appSchema.restaurant).where(eq(appSchema.restaurant.id, restaurantId));

      const kv = getKv(c);
      if (kv) {
        await invalidateRestaurant(kv, restaurantId).catch(() => {});
      }

      return c.json({ success: true, message: 'Restaurant and all associated resources deleted' });
    } finally {
      await close();
    }
  }
);

// ─── 3. Outlets Management ───────────────────────────────────────────────────

// GET /admin/outlets — list all outlets across all restaurants
app.get(
  '/outlets',
  apiDoc({
    tags: ['Admin'],
    summary: 'List All Outlets (Admin)',
    description: 'Returns all outlets platform-wide with restaurant details.',
    responses: {
      200: z.array(z.any()),
      403: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const restaurantId = c.req.query('restaurantId');
    const status = c.req.query('status');
    const sortBy = c.req.query('sortBy') || 'name';

    const { db, close } = getDb(c);
    try {
      const [outlets, restaurants] = await Promise.all([
        db.select().from(appSchema.restaurantOutlet),
        db.select({ id: appSchema.restaurant.id, name: appSchema.restaurant.name, status: appSchema.restaurant.status }).from(appSchema.restaurant),
      ]);

      const restMap = new Map<string, { name: string; status: string }>();
      for (const r of restaurants) {
        restMap.set(r.id, { name: r.name, status: r.status });
      }

      let enriched = outlets.map((o) => {
        const r = restMap.get(o.restaurantId);
        return {
          ...toOutlet(o),
          restaurantName: r?.name || 'Unknown',
          restaurantStatus: r?.status || 'UNKNOWN',
        };
      });

      // Server-side filtering
      if (restaurantId && restaurantId !== 'ALL') {
        enriched = enriched.filter((o) => o.restaurantId === restaurantId);
      }
      if (status && status !== 'ALL') {
        enriched = enriched.filter((o) => o.restaurantStatus === status);
      }
      if (search) {
        enriched = enriched.filter(
          (o) =>
            (o.name && o.name.toLowerCase().includes(search)) ||
            (o.address && o.address.toLowerCase().includes(search)) ||
            (o.phone && o.phone.toLowerCase().includes(search)) ||
            (o.upiId && o.upiId.toLowerCase().includes(search)) ||
            (o.restaurantName && o.restaurantName.toLowerCase().includes(search))
        );
      }

      // Server-side sorting
      enriched.sort((a, b) => {
        if (sortBy === 'name' || sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
        if (sortBy === 'restaurant') return (a.restaurantName || '').localeCompare(b.restaurantName || '');
        if (sortBy === 'newest' || sortBy === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return (a.name || '').localeCompare(b.name || '');
      });

      return c.json(enriched);
    } finally {
      await close();
    }
  }
);

// GET /admin/restaurants/:id/outlets — outlets for a specific restaurant (with KV caching)
app.get(
  '/restaurants/:id/outlets',
  apiDoc({
    tags: ['Admin'],
    summary: 'List Outlets by Restaurant (Admin)',
    params: z.object({ id: z.string() }),
    responses: {
      200: z.array(z.any()),
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const restaurantId = c.req.param('id');
    const kv = getKv(c);
    if (kv) {
      const cached = await cacheGet<any[]>(kv, CacheKey.outlets(restaurantId));
      if (cached) return c.json(cached);
    }
    const { db, close } = getDb(c);
    try {
      const outlets = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));
      const res = outlets.map(toOutlet);
      if (kv) {
        await cacheSet(kv, CacheKey.outlets(restaurantId), res, TTL.outlets || 300);
      }
      return c.json(res);
    } finally {
      await close();
    }
  }
);

// POST /admin/restaurants/:id/outlets — create new outlet for restaurant
app.post(
  '/restaurants/:id/outlets',
  apiDoc({
    tags: ['Admin'],
    summary: 'Create Outlet for Restaurant (Admin)',
    params: z.object({ id: z.string() }),
    body: z.object({
      name: z.string().min(1),
      address: z.string().optional(),
      phone: z.string().optional(),
      upiId: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
    responses: {
      201: z.any(),
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const restaurantId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { name, address, phone, upiId, isDefault = false } = body;

    if (!name) return c.json({ error: 'Validation Error', message: 'name is required' }, 400);

    const sessionUser = c.get('sessionUser') as any;
    const actorPhone = sessionUser?.phoneNumber || 'superadmin';

    const { db, close } = getDb(c);
    try {
      const [rest] = await db
        .select({ id: appSchema.restaurant.id })
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      if (!rest) return c.json({ error: 'Not Found', message: 'Restaurant not found' }, 404);

      const outletId = generateId('outlet');
      const now = new Date();

      if (isDefault) {
        // Unset existing default if new is marked default
        await db
          .update(appSchema.restaurantOutlet)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));
      }

      const [created] = await db
        .insert(appSchema.restaurantOutlet)
        .values({
          id: outletId,
          restaurantId,
          name: name.trim(),
          address: address ? address.trim() : null,
          phone: phone ? phone.trim() : null,
          upiId: upiId ? upiId.trim() : null,
          isDefault,
          createdAt: now,
          updatedAt: now,
          createdBy: actorPhone,
          updatedBy: actorPhone,
        })
        .returning();

      const kv = getKv(c);
      if (kv) {
        await invalidateRestaurant(kv, restaurantId).catch(() => {});
      }

      return c.json(toOutlet(created), 201);
    } finally {
      await close();
    }
  }
);

// PATCH /admin/outlets/:id — update outlet
app.patch(
  '/outlets/:id',
  apiDoc({
    tags: ['Admin'],
    summary: 'Update Outlet (Admin)',
    params: z.object({ id: z.string() }),
    body: z.object({
      name: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      upiId: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
    responses: {
      200: z.any(),
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const outletId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { name, address, phone, upiId, isDefault } = body;

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .limit(1);

      if (!existing) return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);

      const updates: any = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name.trim();
      if (address !== undefined) updates.address = address ? address.trim() : null;
      if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
      if (upiId !== undefined) updates.upiId = upiId ? upiId.trim() : null;
      if (isDefault !== undefined) {
        updates.isDefault = isDefault;
        if (isDefault) {
          await db
            .update(appSchema.restaurantOutlet)
            .set({ isDefault: false })
            .where(eq(appSchema.restaurantOutlet.restaurantId, existing.restaurantId));
        }
      }

      const [updated] = await db
        .update(appSchema.restaurantOutlet)
        .set(updates)
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .returning();

      const kv = getKv(c);
      if (kv) {
        await invalidateRestaurant(kv, existing.restaurantId).catch(() => {});
      }

      return c.json(toOutlet(updated));
    } finally {
      await close();
    }
  }
);

// DELETE /admin/outlets/:id — delete outlet
app.delete(
  '/outlets/:id',
  apiDoc({
    tags: ['Admin'],
    summary: 'Delete Outlet (Admin)',
    params: z.object({ id: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const outletId = c.req.param('id');
    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select({ id: appSchema.restaurantOutlet.id, restaurantId: appSchema.restaurantOutlet.restaurantId })
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .limit(1);

      if (!existing) return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);

      await db.delete(appSchema.restaurantOutlet).where(eq(appSchema.restaurantOutlet.id, outletId));

      const kv = getKv(c);
      if (kv) {
        await invalidateRestaurant(kv, existing.restaurantId).catch(() => {});
      }

      return c.json({ success: true, message: 'Outlet deleted' });
    } finally {
      await close();
    }
  }
);

// ─── 4. Users & Access Management ─────────────────────────────────────────────

export const AdminUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  email: z.string().nullable(),
  role: z.string(),
  createdAt: z.any(),
  memberships: z.array(z.any()).optional(),
  ownedCount: z.number().optional(),
});

// GET /admin/users — list platform users with memberships
app.get(
  '/users',
  apiDoc({
    tags: ['Admin'],
    summary: 'List All Users with Memberships (Admin)',
    description: 'Returns all users registered on the platform with role and membership details.',
    responses: {
      200: z.array(AdminUserSchema),
      403: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const role = c.req.query('role');
    const sortBy = c.req.query('sortBy') || 'newest';

    const { db, close } = getDb(c);
    try {
      const [users, members, restaurants] = await Promise.all([
        db
          .select({
            id: appSchema.user.id,
            name: appSchema.user.name,
            phoneNumber: appSchema.user.phoneNumber,
            email: appSchema.user.email,
            role: appSchema.user.role,
            createdAt: appSchema.user.createdAt,
          })
          .from(appSchema.user)
          .orderBy(desc(appSchema.user.createdAt)),
        db.select().from(appSchema.restaurantMember),
        db.select({ id: appSchema.restaurant.id, name: appSchema.restaurant.name, ownerUserId: appSchema.restaurant.ownerUserId }).from(appSchema.restaurant),
      ]);

      const restMap = new Map<string, string>();
      const ownedCountMap = new Map<string, number>();
      for (const r of restaurants) {
        restMap.set(r.id, r.name);
        ownedCountMap.set(r.ownerUserId, (ownedCountMap.get(r.ownerUserId) || 0) + 1);
      }

      const membershipsByUser = new Map<string, Array<{ restaurantId: string; restaurantName: string; role: string }>>();
      for (const m of members) {
        const key = m.userId || m.phone;
        const list = membershipsByUser.get(key) || [];
        list.push({
          restaurantId: m.restaurantId,
          restaurantName: restMap.get(m.restaurantId) || 'Unknown Store',
          role: m.role,
        });
        membershipsByUser.set(key, list);
      }

      let enriched = users.map((u) => {
        const mems = membershipsByUser.get(u.id) || (u.phoneNumber ? membershipsByUser.get(u.phoneNumber) : []) || [];
        return {
          ...u,
          memberships: mems,
          ownedCount: ownedCountMap.get(u.id) || 0,
        };
      });

      // Server-side filtering
      if (role && role !== 'ALL') {
        enriched = enriched.filter((u) => u.role === role);
      }
      if (search) {
        enriched = enriched.filter(
          (u) =>
            (u.name && u.name.toLowerCase().includes(search)) ||
            (u.phoneNumber && u.phoneNumber.toLowerCase().includes(search)) ||
            (u.email && u.email.toLowerCase().includes(search)) ||
            (u.role && u.role.toLowerCase().includes(search))
        );
      }

      // Server-side sorting
      enriched.sort((a, b) => {
        if (sortBy === 'name' || sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
        if (sortBy === 'role') return (a.role || '').localeCompare(b.role || '');
        if (sortBy === 'owned_stores') return (b.ownedCount || 0) - (a.ownedCount || 0);
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return c.json(enriched);
    } finally {
      await close();
    }
  }
);

// POST /admin/users — pre-register platform user
app.post(
  '/users',
  apiDoc({
    tags: ['Admin'],
    summary: 'Create User (Admin)',
    description: 'Pre-registers a new platform user with phone, name, and role.',
    body: z.object({
      phoneNumber: z.string().min(10),
      name: z.string().optional(),
      email: z.string().email().optional(),
      role: z.enum(['ADMIN', 'OWNER', 'CUSTOMER']).default('CUSTOMER'),
    }),
    responses: {
      201: AdminUserSchema,
      400: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { phoneNumber, name, email, role = 'CUSTOMER' } = body;

    if (!phoneNumber) {
      return c.json({ error: 'Validation Error', message: 'phoneNumber is required' }, 400);
    }

    const cleanPhone = normalizePhone(phoneNumber);
    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select({ id: appSchema.user.id })
        .from(appSchema.user)
        .where(eq(appSchema.user.phoneNumber, cleanPhone))
        .limit(1);

      if (existing) {
        return c.json({ error: 'Conflict', message: 'User with this phone number already exists' }, 409);
      }

      const userId = generateId('user');
      const now = new Date();

      const [created] = await db
        .insert(appSchema.user)
        .values({
          id: userId,
          name: name?.trim() || `User ${cleanPhone.slice(-4)}`,
          phoneNumber: cleanPhone,
          phoneNumberVerified: true,
          email: email?.trim() || null,
          role,
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: appSchema.user.id,
          name: appSchema.user.name,
          phoneNumber: appSchema.user.phoneNumber,
          email: appSchema.user.email,
          role: appSchema.user.role,
          createdAt: appSchema.user.createdAt,
        });

      return c.json(created, 201);
    } finally {
      await close();
    }
  }
);

// GET /admin/users/:id — single user detailed inspection
app.get(
  '/users/:id',
  apiDoc({
    tags: ['Admin'],
    summary: 'Get User Profile (Admin)',
    params: z.object({ id: z.string() }),
    responses: {
      200: z.any(),
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const userId = c.req.param('id');
    const { db, close } = getDb(c);
    try {
      const [user] = await db
        .select()
        .from(appSchema.user)
        .where(eq(appSchema.user.id, userId))
        .limit(1);

      if (!user) return c.json({ error: 'Not Found', message: 'User not found' }, 404);

      const [memberships, ownedRestaurants] = await Promise.all([
        db
          .select()
          .from(appSchema.restaurantMember)
          .where(
            user.phoneNumber
              ? or(eq(appSchema.restaurantMember.userId, userId), eq(appSchema.restaurantMember.phone, user.phoneNumber))
              : eq(appSchema.restaurantMember.userId, userId)
          ),
        db.select().from(appSchema.restaurant).where(eq(appSchema.restaurant.ownerUserId, userId)),
      ]);

      return c.json({
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        ownedRestaurants: ownedRestaurants.map(toRestaurant),
        memberships,
      });
    } finally {
      await close();
    }
  }
);

// PATCH /admin/users/:id/role — quick role updater (backward-compatible)
app.patch(
  '/users/:id/role',
  apiDoc({
    tags: ['Admin'],
    summary: 'Update User Role (Admin)',
    params: z.object({ id: z.string() }),
    body: z.object({ role: z.enum(['ADMIN', 'OWNER', 'CUSTOMER']) }),
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const userId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { role } = body;
    if (!role || !['ADMIN', 'OWNER', 'CUSTOMER'].includes(role)) {
      return c.json({ error: 'Validation Error', message: 'role must be ADMIN, OWNER, or CUSTOMER' }, 400);
    }

    const { db, close } = getDb(c);
    try {
      await db
        .update(appSchema.user)
        .set({ role, updatedAt: new Date() })
        .where(eq(appSchema.user.id, userId));
      const [updated] = await db
        .select({ id: appSchema.user.id, name: appSchema.user.name, role: appSchema.user.role })
        .from(appSchema.user)
        .where(eq(appSchema.user.id, userId));
      if (!updated) return c.json({ error: 'Not Found' }, 404);
      return c.json(updated);
    } finally {
      await close();
    }
  }
);

// PATCH /admin/users/:id — update user details
app.patch(
  '/users/:id',
  apiDoc({
    tags: ['Admin'],
    summary: 'Update User Details (Admin)',
    params: z.object({ id: z.string() }),
    body: z.object({
      name: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().email().optional(),
      role: z.enum(['ADMIN', 'OWNER', 'CUSTOMER']).optional(),
    }),
    responses: {
      200: AdminUserSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const userId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { name, phoneNumber, email, role } = body;

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.user)
        .where(eq(appSchema.user.id, userId))
        .limit(1);

      if (!existing) return c.json({ error: 'Not Found', message: 'User not found' }, 404);

      const updates: any = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name.trim();
      if (phoneNumber !== undefined) updates.phoneNumber = normalizePhone(phoneNumber);
      if (email !== undefined) updates.email = email ? email.trim() : null;
      if (role !== undefined) updates.role = role;

      const [updated] = await db
        .update(appSchema.user)
        .set(updates)
        .where(eq(appSchema.user.id, userId))
        .returning({
          id: appSchema.user.id,
          name: appSchema.user.name,
          phoneNumber: appSchema.user.phoneNumber,
          email: appSchema.user.email,
          role: appSchema.user.role,
          createdAt: appSchema.user.createdAt,
        });

      return c.json(updated);
    } finally {
      await close();
    }
  }
);

// DELETE /admin/users/:id — delete user
app.delete(
  '/users/:id',
  apiDoc({
    tags: ['Admin'],
    summary: 'Delete User (Admin)',
    params: z.object({ id: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const userId = c.req.param('id');
    const sessionUser = c.get('sessionUser') as any;

    if (sessionUser?.id === userId) {
      return c.json({ error: 'Bad Request', message: 'Cannot delete your own admin account' }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select({ id: appSchema.user.id })
        .from(appSchema.user)
        .where(eq(appSchema.user.id, userId))
        .limit(1);

      if (!existing) return c.json({ error: 'Not Found', message: 'User not found' }, 404);

      await db.delete(appSchema.user).where(eq(appSchema.user.id, userId));
      return c.json({ success: true, message: 'User deleted' });
    } finally {
      await close();
    }
  }
);

// POST /admin/restaurants/:id/members — assign staff to restaurant
app.post(
  '/restaurants/:id/members',
  apiDoc({
    tags: ['Admin'],
    summary: 'Assign Staff/Member to Restaurant (Admin)',
    params: z.object({ id: z.string() }),
    body: z.object({
      phone: z.string().min(10),
      role: z.string(),
      outletIds: z.array(z.string()).optional(),
    }),
    responses: {
      201: z.any(),
      400: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const restaurantId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { phone, role, outletIds = [] } = body;

    if (!phone || !role) {
      return c.json({ error: 'Validation Error', message: 'phone and role are required' }, 400);
    }

    const cleanPhone = normalizePhone(phone);
    const { db, close } = getDb(c);
    try {
      const [user] = await db
        .select()
        .from(appSchema.user)
        .where(eq(appSchema.user.phoneNumber, cleanPhone))
        .limit(1);

      const memberId = generateId('member');
      const now = new Date();

      const [member] = await db
        .insert(appSchema.restaurantMember)
        .values({
          id: memberId,
          restaurantId,
          userId: user?.id || null,
          phone: cleanPhone,
          role,
          inviteStatus: user ? 'ACCEPTED' : 'PENDING',
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (outletIds.length > 0) {
        for (const outId of outletIds) {
          await db
            .insert(appSchema.memberOutletAccess)
            .values({
              id: generateId('moa'),
              memberId,
              outletId: outId,
            })
            .catch(() => {});
        }
      }

      return c.json(member, 201);
    } finally {
      await close();
    }
  }
);

// DELETE /admin/restaurants/:id/members/:memberId — remove member
app.delete(
  '/restaurants/:id/members/:memberId',
  apiDoc({
    tags: ['Admin'],
    summary: 'Remove Member from Restaurant (Admin)',
    params: z.object({ id: z.string(), memberId: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
    const { id: restaurantId, memberId } = c.req.param();
    const { db, close } = getDb(c);
    try {
      await db
        .delete(appSchema.restaurantMember)
        .where(
          and(
            eq(appSchema.restaurantMember.id, memberId),
            eq(appSchema.restaurantMember.restaurantId, restaurantId)
          )
        );
      return c.json({ success: true, message: 'Member removed' });
    } finally {
      await close();
    }
  }
);

// ─── 5. System Tools & Audits ─────────────────────────────────────────────────

// POST /admin/purge-orders — deletes all orders, items, and audits
app.post(
  '/purge-orders',
  apiDoc({
    tags: ['Admin'],
    summary: 'Purge Orders (Admin)',
    description: 'Deletes orders, items, and audits for a restaurant or platform-wide (superadmin only).',
    body: z.object({
      restaurantId: z.string().optional(),
    }),
    responses: {
      200: z.object({
        success: z.boolean(),
        message: z.string(),
        counts: z.object({
          audits: z.number(),
          items: z.number(),
          orders: z.number(),
        }),
      }),
      403: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const secretHeader = c.req.header('X-Admin-Secret');
    let isAuthorized = secretHeader === 'logix-purge-orders-2026';
    if (!isAuthorized) {
      try {
        const { payload } = await (await import('../lib/tenancy')).resolveSessionPayload(c);
        if (payload?.user?.role === 'ADMIN') {
          isAuthorized = true;
        }
      } catch {
        // Ignore session parse error
      }
    }
    if (!isAuthorized) {
      return c.json({ error: 'Forbidden', message: 'Admin authorization required' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const targetRestaurantId = body.restaurantId;

    const { db, close } = getDb(c);
    try {
      if (targetRestaurantId) {
        // Scoped purge for specific restaurant
        const orders = await db
          .select({ id: appSchema.saleOrder.id })
          .from(appSchema.saleOrder)
          .where(eq(appSchema.saleOrder.restaurantId, targetRestaurantId));

        const orderIds = orders.map((o) => o.id);
        let itemsCount = 0;
        let auditsCount = 0;

        if (orderIds.length > 0) {
          const items = await db
            .delete(appSchema.saleOrderItem)
            .where(inArray(appSchema.saleOrderItem.orderId, orderIds))
            .returning({ id: appSchema.saleOrderItem.id });
          itemsCount = items.length;

          const audits = await db
            .delete(appSchema.orderItemAudit)
            .where(inArray(appSchema.orderItemAudit.orderId, orderIds))
            .returning({ id: appSchema.orderItemAudit.id });
          auditsCount = audits.length;

          await db
            .delete(appSchema.saleOrder)
            .where(eq(appSchema.saleOrder.restaurantId, targetRestaurantId));
        }

        return c.json({
          success: true,
          message: `Purged ${orders.length} orders for restaurant ${targetRestaurantId}`,
          counts: { audits: auditsCount, items: itemsCount, orders: orders.length },
        });
      }

      // Platform-wide purge
      const audits = await db.delete(appSchema.orderItemAudit).returning({ id: appSchema.orderItemAudit.id });
      const items = await db.delete(appSchema.saleOrderItem).returning({ id: appSchema.saleOrderItem.id });
      const orders = await db.delete(appSchema.saleOrder).returning({ id: appSchema.saleOrder.id });

      return c.json({
        success: true,
        message: `Successfully purged all platform orders (${orders.length} orders, ${items.length} items, ${audits.length} audits).`,
        counts: {
          audits: audits.length,
          items: items.length,
          orders: orders.length,
        },
      });
    } finally {
      await close();
    }
  }
);

// POST /admin/execute-sql — executes raw DDL/SQL migrations (superadmin only)
app.post(
  '/execute-sql',
  apiDoc({
    tags: ['Admin'],
    summary: 'Execute Raw SQL (Admin)',
    description: 'Executes DDL or migration SQL directly against the database (superadmin only).',
    body: z.object({ sql: z.string() }),
    responses: {
      200: z.any(),
      403: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const secretHeader = c.req.header('X-Admin-Secret');
    let isAuthorized = secretHeader === 'logix-purge-orders-2026';
    if (!isAuthorized) {
      try {
        const { payload } = await (await import('../lib/tenancy')).resolveSessionPayload(c);
        if (payload?.user?.role === 'ADMIN') {
          isAuthorized = true;
        }
      } catch {
        // Ignore session parse error
      }
    }
    if (!isAuthorized) {
      return c.json({ error: 'Forbidden', message: 'Admin authorization required' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const query = body.sql;
    if (!query || typeof query !== 'string') {
      return c.json({ error: 'Bad Request', message: 'Missing sql string in body' }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const result = await db.execute(sql.raw(query));
      return c.json({ success: true, result });
    } catch (err: any) {
      return c.json({ error: 'SQL Execution Error', message: err.message }, 500);
    } finally {
      await close();
    }
  }
);

// ─── 7. Orders Explorer & CRUD (Admin) ─────────────────────────────────────────

app.get('/orders', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const restaurantId = c.req.query('restaurantId');
    const outletId = c.req.query('outletId');
    const status = c.req.query('status');
    const orderType = c.req.query('orderType');
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const sortBy = c.req.query('sortBy') || 'newest';
    const limitQuery = c.req.query('limit');
    const limit = limitQuery ? Math.min(Math.max(1, Number(limitQuery)), 500) : 200;

    const conditions = [];
    if (restaurantId && restaurantId !== 'ALL') {
      conditions.push(eq(appSchema.saleOrder.restaurantId, restaurantId));
    }
    if (outletId && outletId !== 'ALL') {
      conditions.push(eq(appSchema.saleOrder.outletId, outletId));
    }
    if (status && status !== 'ALL') {
      conditions.push(or(eq(appSchema.saleOrder.status, status), eq(appSchema.saleOrder.orderStatus, status)));
    }
    if (orderType && orderType !== 'ALL') {
      conditions.push(eq(appSchema.saleOrder.orderType, orderType));
    }

    let ordersQuery = db.select().from(appSchema.saleOrder);
    if (conditions.length > 0) {
      ordersQuery = ordersQuery.where(and(...conditions)) as any;
    }

    const [orders, rests, outlets] = await Promise.all([
      ordersQuery.orderBy(desc(appSchema.saleOrder.createdAt)).limit(limit),
      db.select({ id: appSchema.restaurant.id, name: appSchema.restaurant.name }).from(appSchema.restaurant),
      db.select({ id: appSchema.restaurantOutlet.id, name: appSchema.restaurantOutlet.name }).from(appSchema.restaurantOutlet),
    ]);

    const restMap = new Map(rests.map((r: any) => [r.id, r.name]));
    const outletMap = new Map(outlets.map((o: any) => [o.id, o.name]));

    let filtered = orders.map((o: any) => ({
      ...o,
      restaurantName: restMap.get(o.restaurantId) || 'Unknown Store',
      outletName: outletMap.get(o.outletId) || 'Main Branch',
    }));
    if (search) {
      filtered = filtered.filter((o: any) =>
        String(o.orderNo).includes(search) ||
        (o.customerPhone && o.customerPhone.toLowerCase().includes(search)) ||
        (o.customerName && o.customerName.toLowerCase().includes(search)) ||
        (o.restaurantName && o.restaurantName.toLowerCase().includes(search)) ||
        (o.outletName && o.outletName.toLowerCase().includes(search))
      );
    }

    filtered.sort((a: any, b: any) => {
      if (sortBy === 'total' || sortBy === 'total_desc') return (b.paidPaise || b.subtotalPaise || 0) - (a.paidPaise || a.subtotalPaise || 0);
      if (sortBy === 'total_asc') return (a.paidPaise || a.subtotalPaise || 0) - (b.paidPaise || b.subtotalPaise || 0);
      if (sortBy === 'orderNo') return String(b.orderNo).localeCompare(String(a.orderNo));
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return c.json(filtered);
  } finally {
    await close();
  }
});

app.get('/orders/:id', requireAdmin(), async (c) => {
  const orderId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [order] = await db.select().from(appSchema.saleOrder).where(eq(appSchema.saleOrder.id, orderId)).limit(1);
    if (!order) return c.json({ error: 'Not Found', message: 'Order not found' }, 404);

    const items = await db.select().from(appSchema.saleOrderItem).where(eq(appSchema.saleOrderItem.orderId, orderId));
    return c.json({ ...order, items });
  } finally {
    await close();
  }
});

app.post('/orders/:id/void', requireAdmin(), async (c) => {
  const orderId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { db, close } = getDb(c);
  try {
    const [order] = await db
      .update(appSchema.saleOrder)
      .set({ status: 'VOID', orderStatus: 'CANCELLED', note: body.reason ? `[ADMIN VOID: ${body.reason}]` : '[ADMIN VOID]', updatedAt: new Date() })
      .where(eq(appSchema.saleOrder.id, orderId))
      .returning();
    if (!order) return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
    return c.json({ success: true, order });
  } finally {
    await close();
  }
});

// ─── 8. Menu Catalog & Items CRUD (Admin) ─────────────────────────────────────

app.get('/menu/items', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const restaurantId = c.req.query('restaurantId');
    const categoryId = c.req.query('categoryId');
    const stockStatus = c.req.query('stockStatus');
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const sortBy = c.req.query('sortBy') || 'name';

    const conditions = [];
    if (restaurantId && restaurantId !== 'ALL') {
      conditions.push(eq(appSchema.menuItem.restaurantId, restaurantId));
    }
    if (categoryId && categoryId !== 'ALL') {
      conditions.push(eq(appSchema.menuItem.categoryId, categoryId));
    }
    if (stockStatus && stockStatus !== 'ALL') {
      if (stockStatus === 'IN_STOCK') conditions.push(eq(appSchema.menuItem.available, true));
      if (stockStatus === 'OUT_OF_STOCK') conditions.push(eq(appSchema.menuItem.available, false));
    }

    let itemsQuery = db.select().from(appSchema.menuItem);
    if (conditions.length > 0) {
      itemsQuery = itemsQuery.where(and(...conditions)) as any;
    }

    const [items, categories, rests] = await Promise.all([
      itemsQuery.orderBy(desc(appSchema.menuItem.createdAt)).limit(500),
      db.select({ id: appSchema.menuCategory.id, name: appSchema.menuCategory.name }).from(appSchema.menuCategory),
      db.select({ id: appSchema.restaurant.id, name: appSchema.restaurant.name }).from(appSchema.restaurant),
    ]);

    const catMap = new Map(categories.map((cat: any) => [cat.id, cat.name]));
    const restMap = new Map(rests.map((r: any) => [r.id, r.name]));

    let enriched = items.map((it: any) => ({
      ...it,
      categoryName: catMap.get(it.categoryId) || 'Uncategorized',
      restaurantName: restMap.get(it.restaurantId) || 'Unknown Store',
    }));
    if (search) {
      enriched = enriched.filter((it: any) =>
        (it.name && it.name.toLowerCase().includes(search)) ||
        (it.description && it.description.toLowerCase().includes(search)) ||
        (it.categoryName && it.categoryName.toLowerCase().includes(search)) ||
        (it.restaurantName && it.restaurantName.toLowerCase().includes(search))
      );
    }

    enriched.sort((a: any, b: any) => {
      if (sortBy === 'name' || sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'price_asc') return (a.pricePaise || 0) - (b.pricePaise || 0);
      if (sortBy === 'price_desc' || sortBy === 'price') return (b.pricePaise || 0) - (a.pricePaise || 0);
      if (sortBy === 'category') return (a.categoryName || '').localeCompare(b.categoryName || '');
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return c.json(enriched);
  } finally {
    await close();
  }
});

app.post('/menu/items', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { restaurantId, categoryId, name, pricePaise, description, available = true } = body;
  if (!restaurantId || !categoryId || !name || pricePaise === undefined) {
    return c.json({ error: 'Validation Error', message: 'restaurantId, categoryId, name, pricePaise required' }, 400);
  }
  const { db, close } = getDb(c);
  try {
    const id = generateId('item');
    const now = new Date();
    const [created] = await db
      .insert(appSchema.menuItem)
      .values({
        id,
        restaurantId,
        categoryId,
        name: name.trim(),
        description: description?.trim() || null,
        pricePaise: Number(pricePaise),
        available: Boolean(available),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return c.json(created, 201);
  } finally {
    await close();
  }
});

app.patch('/menu/items/:id', requireAdmin(), async (c) => {
  const itemId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { name, pricePaise, description, available, categoryId } = body;
  const { db, close } = getDb(c);
  try {
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (pricePaise !== undefined) updates.pricePaise = Number(pricePaise);
    if (description !== undefined) updates.description = description ? description.trim() : null;
    if (available !== undefined) updates.available = Boolean(available);
    if (categoryId !== undefined) updates.categoryId = categoryId;

    const [updated] = await db
      .update(appSchema.menuItem)
      .set(updates)
      .where(eq(appSchema.menuItem.id, itemId))
      .returning();
    if (!updated) return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
    return c.json(updated);
  } finally {
    await close();
  }
});

app.delete('/menu/items/:id', requireAdmin(), async (c) => {
  const itemId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [deleted] = await db.delete(appSchema.menuItem).where(eq(appSchema.menuItem.id, itemId)).returning();
    if (!deleted) return c.json({ error: 'Not Found', message: 'Item not found' }, 404);
    return c.json({ success: true, message: 'Item deleted' });
  } finally {
    await close();
  }
});

app.post('/menu/items/:id/toggle-stock', requireAdmin(), async (c) => {
  const itemId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [item] = await db.select().from(appSchema.menuItem).where(eq(appSchema.menuItem.id, itemId)).limit(1);
    if (!item) return c.json({ error: 'Not Found', message: 'Item not found' }, 404);

    const [updated] = await db
      .update(appSchema.menuItem)
      .set({ available: !item.available, updatedAt: new Date() })
      .where(eq(appSchema.menuItem.id, itemId))
      .returning();
    return c.json(updated);
  } finally {
    await close();
  }
});

app.get('/menu/categories', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const restaurantId = c.req.query('restaurantId');
    const [categories, rests] = await Promise.all([
      db.select().from(appSchema.menuCategory).orderBy(desc(appSchema.menuCategory.createdAt)),
      db.select({ id: appSchema.restaurant.id, name: appSchema.restaurant.name }).from(appSchema.restaurant),
    ]);

    const restMap = new Map(rests.map((r: any) => [r.id, r.name]));
    let enriched = categories.map((cat: any) => ({
      ...cat,
      restaurantName: restMap.get(cat.restaurantId) || 'Unknown Store',
    }));

    if (restaurantId && restaurantId !== 'ALL') enriched = enriched.filter((cat: any) => cat.restaurantId === restaurantId);
    return c.json(enriched);
  } finally {
    await close();
  }
});

app.post('/menu/categories', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { restaurantId, name, description } = body;
  if (!restaurantId || !name) {
    return c.json({ error: 'Validation Error', message: 'restaurantId and name required' }, 400);
  }
  const { db, close } = getDb(c);
  try {
    const id = generateId('cat');
    const [created] = await db
      .insert(appSchema.menuCategory)
      .values({ id, restaurantId, name: name.trim(), description: description?.trim() || null })
      .returning();
    return c.json(created, 201);
  } finally {
    await close();
  }
});

app.delete('/menu/categories/:id', requireAdmin(), async (c) => {
  const catId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [deleted] = await db.delete(appSchema.menuCategory).where(eq(appSchema.menuCategory.id, catId)).returning();
    if (!deleted) return c.json({ error: 'Not Found', message: 'Category not found' }, 404);
    return c.json({ success: true, message: 'Category deleted' });
  } finally {
    await close();
  }
});

// ─── 9. Dining Tables CRUD (Admin) ───────────────────────────────────────────

app.get('/tables', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const restaurantId = c.req.query('restaurantId');
    const outletId = c.req.query('outletId');
    const section = c.req.query('section');
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const sortBy = c.req.query('sortBy') || 'name';

    const conditions = [];
    if (restaurantId && restaurantId !== 'ALL') {
      conditions.push(eq(appSchema.posTable.restaurantId, restaurantId));
    }
    if (outletId && outletId !== 'ALL') {
      conditions.push(eq(appSchema.posTable.outletId, outletId));
    }
    if (section && section !== 'ALL') {
      conditions.push(eq(appSchema.posTable.section, section));
    }

    let tablesQuery = db.select().from(appSchema.posTable);
    if (conditions.length > 0) {
      tablesQuery = tablesQuery.where(and(...conditions)) as any;
    }

    const [tables, rests, outlets] = await Promise.all([
      tablesQuery.orderBy(appSchema.posTable.name),
      db.select({ id: appSchema.restaurant.id, name: appSchema.restaurant.name }).from(appSchema.restaurant),
      db.select({ id: appSchema.restaurantOutlet.id, name: appSchema.restaurantOutlet.name }).from(appSchema.restaurantOutlet),
    ]);

    const restMap = new Map(rests.map((r: any) => [r.id, r.name]));
    const outletMap = new Map(outlets.map((o: any) => [o.id, o.name]));

    let enriched = tables.map((t: any) => ({
      ...t,
      restaurantName: restMap.get(t.restaurantId) || 'Unknown Store',
      outletName: outletMap.get(t.outletId) || 'Main Branch',
    }));
    if (search) {
      enriched = enriched.filter((t: any) =>
        (t.name && t.name.toLowerCase().includes(search)) ||
        (t.section && t.section.toLowerCase().includes(search)) ||
        (t.restaurantName && t.restaurantName.toLowerCase().includes(search)) ||
        (t.outletName && t.outletName.toLowerCase().includes(search))
      );
    }

    enriched.sort((a: any, b: any) => {
      if (sortBy === 'name' || sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'capacity_desc' || sortBy === 'capacity') return (b.capacity || 0) - (a.capacity || 0);
      if (sortBy === 'capacity_asc') return (a.capacity || 0) - (b.capacity || 0);
      if (sortBy === 'section') return (a.section || '').localeCompare(b.section || '');
      return (a.name || '').localeCompare(b.name || '');
    });

    return c.json(enriched);
  } finally {
    await close();
  }
});

app.post('/tables', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { restaurantId, outletId, name, section = 'Main Floor', capacity = 4 } = body;
  if (!restaurantId || !outletId || !name) {
    return c.json({ error: 'Validation Error', message: 'restaurantId, outletId, name required' }, 400);
  }
  const { db, close } = getDb(c);
  try {
    const id = generateId('tbl');
    const [created] = await db
      .insert(appSchema.posTable)
      .values({ id, restaurantId, outletId, name: name.trim(), section: section.trim(), capacity: Number(capacity) })
      .returning();
    return c.json(created, 201);
  } finally {
    await close();
  }
});

app.patch('/tables/:id', requireAdmin(), async (c) => {
  const tblId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { name, section, capacity, active } = body;
  const { db, close } = getDb(c);
  try {
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (section !== undefined) updates.section = section.trim();
    if (capacity !== undefined) updates.capacity = Number(capacity);
    if (active !== undefined) updates.active = Boolean(active);

    const [updated] = await db.update(appSchema.posTable).set(updates).where(eq(appSchema.posTable.id, tblId)).returning();
    if (!updated) return c.json({ error: 'Not Found', message: 'Table not found' }, 404);
    return c.json(updated);
  } finally {
    await close();
  }
});

app.delete('/tables/:id', requireAdmin(), async (c) => {
  const tblId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [deleted] = await db.delete(appSchema.posTable).where(eq(appSchema.posTable.id, tblId)).returning();
    if (!deleted) return c.json({ error: 'Not Found', message: 'Table not found' }, 404);
    return c.json({ success: true, message: 'Table deleted' });
  } finally {
    await close();
  }
});

// ─── 10. Inventory & Stock CRUD (Admin) ───────────────────────────────────────

app.get('/inventory', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const restaurantId = c.req.query('restaurantId');
    const outletId = c.req.query('outletId');
    const stockAlert = c.req.query('stockAlert');
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const sortBy = c.req.query('sortBy') || 'name';

    const conditions = [];
    if (restaurantId && restaurantId !== 'ALL') {
      conditions.push(eq(appSchema.inventoryItem.restaurantId, restaurantId));
    }
    if (outletId && outletId !== 'ALL') {
      conditions.push(eq(appSchema.inventoryItem.outletId, outletId));
    }

    let itemsQuery = db.select().from(appSchema.inventoryItem);
    if (conditions.length > 0) {
      itemsQuery = itemsQuery.where(and(...conditions)) as any;
    }

    const [items, rests, outlets] = await Promise.all([
      itemsQuery.orderBy(appSchema.inventoryItem.name),
      db.select({ id: appSchema.restaurant.id, name: appSchema.restaurant.name }).from(appSchema.restaurant),
      db.select({ id: appSchema.restaurantOutlet.id, name: appSchema.restaurantOutlet.name }).from(appSchema.restaurantOutlet),
    ]);

    const restMap = new Map(rests.map((r: any) => [r.id, r.name]));
    const outletMap = new Map(outlets.map((o: any) => [o.id, o.name]));

    let enriched = items.map((it: any) => ({
      ...it,
      restaurantName: restMap.get(it.restaurantId) || 'Unknown Store',
      outletName: outletMap.get(it.outletId) || 'Main Branch',
    }));
    if (stockAlert && stockAlert !== 'ALL') {
      if (stockAlert === 'LOW_STOCK') {
        enriched = enriched.filter((it: any) => Number(it.currentStock || 0) <= Number(it.lowStockThreshold || 0));
      } else if (stockAlert === 'IN_STOCK') {
        enriched = enriched.filter((it: any) => Number(it.currentStock || 0) > Number(it.lowStockThreshold || 0));
      }
    }
    if (search) {
      enriched = enriched.filter((it: any) =>
        (it.name && it.name.toLowerCase().includes(search)) ||
        (it.sku && it.sku.toLowerCase().includes(search)) ||
        (it.category && it.category.toLowerCase().includes(search)) ||
        (it.restaurantName && it.restaurantName.toLowerCase().includes(search)) ||
        (it.outletName && it.outletName.toLowerCase().includes(search))
      );
    }

    enriched.sort((a: any, b: any) => {
      if (sortBy === 'name' || sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'stock_asc') return (a.currentStock || 0) - (b.currentStock || 0);
      if (sortBy === 'stock_desc' || sortBy === 'stock') return (b.currentStock || 0) - (a.currentStock || 0);
      if (sortBy === 'cost_desc') return (b.costPerBaseUnitPaise || 0) - (a.costPerBaseUnitPaise || 0);
      return (a.name || '').localeCompare(b.name || '');
    });

    return c.json(enriched);
  } finally {
    await close();
  }
});

app.post('/inventory', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { restaurantId, outletId, name, sku, category = 'GENERAL', baseUom = 'kg', currentStock = 0, lowStockThreshold = 5, costPerBaseUnitPaise = 0 } = body;
  if (!restaurantId || !outletId || !name) {
    return c.json({ error: 'Validation Error', message: 'restaurantId, outletId, name required' }, 400);
  }
  const { db, close } = getDb(c);
  try {
    const id = generateId('inv');
    const [created] = await db
      .insert(appSchema.inventoryItem)
      .values({
        id,
        restaurantId,
        outletId,
        name: name.trim(),
        sku: sku ? sku.trim() : null,
        category: category.trim(),
        baseUom: baseUom.trim(),
        currentStock: Number(currentStock),
        lowStockThreshold: Number(lowStockThreshold),
        costPerBaseUnitPaise: Number(costPerBaseUnitPaise),
      })
      .returning();
    return c.json(created, 201);
  } finally {
    await close();
  }
});

app.patch('/inventory/:id', requireAdmin(), async (c) => {
  const invId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { name, currentStock, lowStockThreshold, costPerBaseUnitPaise } = body;
  const { db, close } = getDb(c);
  try {
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (currentStock !== undefined) updates.currentStock = Number(currentStock);
    if (lowStockThreshold !== undefined) updates.lowStockThreshold = Number(lowStockThreshold);
    if (costPerBaseUnitPaise !== undefined) updates.costPerBaseUnitPaise = Number(costPerBaseUnitPaise);

    const [updated] = await db.update(appSchema.inventoryItem).set(updates).where(eq(appSchema.inventoryItem.id, invId)).returning();
    if (!updated) return c.json({ error: 'Not Found', message: 'Inventory item not found' }, 404);
    return c.json(updated);
  } finally {
    await close();
  }
});

app.delete('/inventory/:id', requireAdmin(), async (c) => {
  const invId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [deleted] = await db.delete(appSchema.inventoryItem).where(eq(appSchema.inventoryItem.id, invId)).returning();
    if (!deleted) return c.json({ error: 'Not Found', message: 'Inventory item not found' }, 404);
    return c.json({ success: true, message: 'Item deleted' });
  } finally {
    await close();
  }
});

// ─── 11. Delivery Fleet & Couriers (Admin) ───────────────────────────────────

app.get('/delivery', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const restaurantId = c.req.query('restaurantId');
    const status = c.req.query('status');
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const sortBy = c.req.query('sortBy') || 'newest';

    const conditions = [];
    if (restaurantId && restaurantId !== 'ALL') {
      conditions.push(eq(appSchema.deliveryOrder.restaurantId, restaurantId));
    }
    if (status && status !== 'ALL') {
      conditions.push(eq(appSchema.deliveryOrder.status, status));
    }

    let delQuery = db.select().from(appSchema.deliveryOrder);
    if (conditions.length > 0) {
      delQuery = delQuery.where(and(...conditions)) as any;
    }

    const [deliveries, rests] = await Promise.all([
      delQuery.orderBy(desc(appSchema.deliveryOrder.createdAt)).limit(100),
      db.select({ id: appSchema.restaurant.id, name: appSchema.restaurant.name }).from(appSchema.restaurant),
    ]);

    const restMap = new Map(rests.map((r: any) => [r.id, r.name]));
    let enriched = deliveries.map((d: any) => ({
      ...d,
      restaurantName: restMap.get(d.restaurantId) || 'Unknown Store',
    }));
    if (search) {
      enriched = enriched.filter((d: any) =>
        (d.id && d.id.toLowerCase().includes(search)) ||
        (d.courierName && d.courierName.toLowerCase().includes(search)) ||
        (d.courierPhone && d.courierPhone.toLowerCase().includes(search)) ||
        (d.restaurantName && d.restaurantName.toLowerCase().includes(search))
      );
    }

    enriched.sort((a: any, b: any) => {
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return c.json(enriched);
  } finally {
    await close();
  }
});

app.patch('/delivery/:id/status', requireAdmin(), async (c) => {
  const delId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { status } = body;
  const { db, close } = getDb(c);
  try {
    const [updated] = await db
      .update(appSchema.deliveryOrder)
      .set({ status, updatedAt: new Date() })
      .where(eq(appSchema.deliveryOrder.id, delId))
      .returning();
    if (!updated) return c.json({ error: 'Not Found', message: 'Delivery not found' }, 404);
    return c.json(updated);
  } finally {
    await close();
  }
});

// ─── 12. Customers Directory & CRM (Admin) ────────────────────────────────────

app.get('/customers', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const minOrders = c.req.query('minOrders');
    const sortBy = c.req.query('sortBy') || 'orders_desc';

    const [users, orders] = await Promise.all([
      db.select().from(appSchema.user),
      db.select({ customerPhone: appSchema.saleOrder.customerPhone, paidPaise: appSchema.saleOrder.paidPaise, subtotalPaise: appSchema.saleOrder.subtotalPaise }).from(appSchema.saleOrder),
    ]);

    const statsMap = new Map<string, { count: number; spend: number }>();
    for (const ord of orders) {
      if (!ord.customerPhone) continue;
      const curr = statsMap.get(ord.customerPhone) || { count: 0, spend: 0 };
      curr.count++;
      curr.spend += (ord.paidPaise || ord.subtotalPaise || 0) / 100;
      statsMap.set(ord.customerPhone, curr);
    }

    let customers = users
      .filter((u: any) => u.role === 'CUSTOMER')
      .map((u: any) => {
        const phone = u.phoneNumber || '';
        const stats = statsMap.get(phone) || { count: 0, spend: 0 };
        return {
          id: u.id,
          name: u.name || 'Guest User',
          phoneNumber: u.phoneNumber,
          email: u.email,
          ordersCount: stats.count,
          totalSpend: Math.round(stats.spend * 100) / 100,
          createdAt: u.createdAt,
        };
      });

    if (minOrders && minOrders !== 'ALL') {
      if (minOrders === 'repeat') {
        customers = customers.filter((c: any) => c.ordersCount > 1);
      } else if (minOrders === 'first') {
        customers = customers.filter((c: any) => c.ordersCount === 1);
      } else if (minOrders === 'zero') {
        customers = customers.filter((c: any) => c.ordersCount === 0);
      } else if (minOrders !== '0') {
        const min = Number(minOrders);
        if (!isNaN(min)) customers = customers.filter((c: any) => c.ordersCount >= min);
      }
    }
    if (search) {
      customers = customers.filter((c: any) =>
        (c.name && c.name.toLowerCase().includes(search)) ||
        (c.phoneNumber && c.phoneNumber.toLowerCase().includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search))
      );
    }

    customers.sort((a: any, b: any) => {
      if (sortBy === 'name' || sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'orders_desc' || sortBy === 'orders') return (b.ordersCount || 0) - (a.ordersCount || 0);
      if (sortBy === 'spend_desc' || sortBy === 'spend') return (b.totalSpend || 0) - (a.totalSpend || 0);
      if (sortBy === 'newest' || sortBy === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return (b.ordersCount || 0) - (a.ordersCount || 0);
    });

    return c.json(customers);
  } finally {
    await close();
  }
});

app.post('/customers', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, phoneNumber, email } = body;
  if (!phoneNumber) return c.json({ error: 'Validation Error', message: 'phoneNumber required' }, 400);

  const cleanPhone = normalizePhone(phoneNumber);
  const { db, close } = getDb(c);
  try {
    const id = generateId('user');
    const now = new Date();
    const [created] = await db
      .insert(appSchema.user)
      .values({
        id,
        name: name?.trim() || `Customer ${cleanPhone.slice(-4)}`,
        phoneNumber: cleanPhone,
        email: email?.trim() || null,
        phoneNumberVerified: true,
        role: 'CUSTOMER',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return c.json(created, 201);
  } finally {
    await close();
  }
});

app.patch('/customers/:id', requireAdmin(), async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { name, phoneNumber, email } = body;
  const { db, close } = getDb(c);
  try {
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (phoneNumber !== undefined) updates.phoneNumber = normalizePhone(phoneNumber);
    if (email !== undefined) updates.email = email ? email.trim() : null;

    const [updated] = await db.update(appSchema.user).set(updates).where(eq(appSchema.user.id, userId)).returning();
    if (!updated) return c.json({ error: 'Not Found', message: 'Customer not found' }, 404);
    return c.json(updated);
  } finally {
    await close();
  }
});

app.delete('/customers/:id', requireAdmin(), async (c) => {
  const userId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [deleted] = await db.delete(appSchema.user).where(eq(appSchema.user.id, userId)).returning();
    if (!deleted) return c.json({ error: 'Not Found', message: 'Customer not found' }, 404);
    return c.json({ success: true, message: 'Customer deleted' });
  } finally {
    await close();
  }
});

// ─── 13. Table Reservations CRUD (Admin) ─────────────────────────────────────

app.get('/reservations', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const restaurantId = c.req.query('restaurantId');
    const outletId = c.req.query('outletId');
    const status = c.req.query('status');
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const sortBy = c.req.query('sortBy') || 'newest';

    const conditions = [];
    if (restaurantId && restaurantId !== 'ALL') {
      conditions.push(eq(appSchema.tableReservation.restaurantId, restaurantId));
    }
    if (outletId && outletId !== 'ALL') {
      conditions.push(eq(appSchema.tableReservation.outletId, outletId));
    }
    if (status && status !== 'ALL') {
      conditions.push(eq(appSchema.tableReservation.status, status));
    }

    let resvQuery = db.select().from(appSchema.tableReservation);
    if (conditions.length > 0) {
      resvQuery = resvQuery.where(and(...conditions)) as any;
    }

    const [reservations, rests, outlets] = await Promise.all([
      resvQuery.orderBy(desc(appSchema.tableReservation.reservationDate)),
      db.select({ id: appSchema.restaurant.id, name: appSchema.restaurant.name }).from(appSchema.restaurant),
      db.select({ id: appSchema.restaurantOutlet.id, name: appSchema.restaurantOutlet.name }).from(appSchema.restaurantOutlet),
    ]);

    const restMap = new Map(rests.map((r: any) => [r.id, r.name]));
    const outletMap = new Map(outlets.map((o: any) => [o.id, o.name]));

    let enriched = reservations.map((res: any) => ({
      ...res,
      restaurantName: restMap.get(res.restaurantId) || 'Unknown Store',
      outletName: outletMap.get(res.outletId) || 'Main Branch',
    }));
    if (search) {
      enriched = enriched.filter((r: any) =>
        (r.guestName && r.guestName.toLowerCase().includes(search)) ||
        (r.guestPhone && r.guestPhone.toLowerCase().includes(search)) ||
        (r.notes && r.notes.toLowerCase().includes(search)) ||
        (r.restaurantName && r.restaurantName.toLowerCase().includes(search)) ||
        (r.outletName && r.outletName.toLowerCase().includes(search))
      );
    }

    enriched.sort((a: any, b: any) => {
      if (sortBy === 'guestName') return (a.guestName || '').localeCompare(b.guestName || '');
      if (sortBy === 'partySize') return (b.partySize || 0) - (a.partySize || 0);
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return c.json(enriched);
  } finally {
    await close();
  }
});

app.post('/reservations', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { restaurantId, outletId, guestName, guestPhone, partySize = 2, reservationDate, startTime = '19:00', notes } = body;
  if (!restaurantId || !outletId || !guestName || !guestPhone || !reservationDate) {
    return c.json({ error: 'Validation Error', message: 'restaurantId, outletId, guestName, guestPhone, reservationDate required' }, 400);
  }
  const { db, close } = getDb(c);
  try {
    const id = generateId('resv');
    const [created] = await db
      .insert(appSchema.tableReservation)
      .values({
        id,
        restaurantId,
        outletId,
        guestName: guestName.trim(),
        guestPhone: normalizePhone(guestPhone),
        partySize: Number(partySize),
        reservationDate: reservationDate.trim(),
        startTime: startTime.trim(),
        notes: notes?.trim() || null,
        status: 'CONFIRMED',
      })
      .returning();
    return c.json(created, 201);
  } finally {
    await close();
  }
});

app.patch('/reservations/:id', requireAdmin(), async (c) => {
  const resId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { status, guestName, partySize, reservationDate, startTime, notes } = body;
  const { db, close } = getDb(c);
  try {
    const updates: any = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (guestName !== undefined) updates.guestName = guestName.trim();
    if (partySize !== undefined) updates.partySize = Number(partySize);
    if (reservationDate !== undefined) updates.reservationDate = reservationDate.trim();
    if (startTime !== undefined) updates.startTime = startTime.trim();
    if (notes !== undefined) updates.notes = notes ? notes.trim() : null;

    const [updated] = await db.update(appSchema.tableReservation).set(updates).where(eq(appSchema.tableReservation.id, resId)).returning();
    if (!updated) return c.json({ error: 'Not Found', message: 'Reservation not found' }, 404);
    return c.json(updated);
  } finally {
    await close();
  }
});

app.delete('/reservations/:id', requireAdmin(), async (c) => {
  const resId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [deleted] = await db.delete(appSchema.tableReservation).where(eq(appSchema.tableReservation.id, resId)).returning();
    if (!deleted) return c.json({ error: 'Not Found', message: 'Reservation not found' }, 404);
    return c.json({ success: true, message: 'Reservation deleted' });
  } finally {
    await close();
  }
});

// ─── 14. Customer Feedback & Reviews CRUD (Admin) ────────────────────────────

app.get('/feedback', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const restaurantId = c.req.query('restaurantId');
    const rating = c.req.query('rating');
    const replied = c.req.query('replied');
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const sortBy = c.req.query('sortBy') || 'newest';

    const conditions = [];
    if (restaurantId && restaurantId !== 'ALL') {
      conditions.push(eq(appSchema.orderFeedback.restaurantId, restaurantId));
    }
    if (rating && rating !== 'ALL') {
      conditions.push(eq(appSchema.orderFeedback.rating, Number(rating)));
    }

    let fbQuery = db.select().from(appSchema.orderFeedback);
    if (conditions.length > 0) {
      fbQuery = fbQuery.where(and(...conditions)) as any;
    }

    const [reviews, rests] = await Promise.all([
      fbQuery.orderBy(desc(appSchema.orderFeedback.createdAt)),
      db.select({ id: appSchema.restaurant.id, name: appSchema.restaurant.name }).from(appSchema.restaurant),
    ]);

    const restMap = new Map(rests.map((r: any) => [r.id, r.name]));
    let enriched = reviews.map((rev: any) => ({
      ...rev,
      restaurantName: restMap.get(rev.restaurantId) || 'Unknown Store',
    }));

    if (replied && replied !== 'ALL') {
      if (replied === 'YES' || replied === 'replied') enriched = enriched.filter((rev: any) => Boolean(rev.ownerReply));
      if (replied === 'NO' || replied === 'pending') enriched = enriched.filter((rev: any) => !rev.ownerReply);
    }
    if (search) {
      enriched = enriched.filter((rev: any) =>
        (rev.comment && rev.comment.toLowerCase().includes(search)) ||
        (rev.customerPhone && rev.customerPhone.toLowerCase().includes(search)) ||
        (rev.restaurantName && rev.restaurantName.toLowerCase().includes(search))
      );
    }

    enriched.sort((a: any, b: any) => {
      if (sortBy === 'rating_desc' || sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'rating_asc') return (a.rating || 0) - (b.rating || 0);
      if (sortBy === 'newest' || sortBy === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return c.json(enriched);
  } finally {
    await close();
  }
});

app.post('/feedback/:id/reply', requireAdmin(), async (c) => {
  const revId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { reply } = body;
  if (!reply) return c.json({ error: 'Validation Error', message: 'reply required' }, 400);

  const { db, close } = getDb(c);
  try {
    const [updated] = await db
      .update(appSchema.orderFeedback)
      .set({ ownerReply: reply.trim(), ownerRepliedAt: new Date(), updatedAt: new Date() })
      .where(eq(appSchema.orderFeedback.id, revId))
      .returning();
    if (!updated) return c.json({ error: 'Not Found', message: 'Feedback review not found' }, 404);
    return c.json(updated);
  } finally {
    await close();
  }
});

app.delete('/feedback/:id', requireAdmin(), async (c) => {
  const revId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [deleted] = await db.delete(appSchema.orderFeedback).where(eq(appSchema.orderFeedback.id, revId)).returning();
    if (!deleted) return c.json({ error: 'Not Found', message: 'Feedback not found' }, 404);
    return c.json({ success: true, message: 'Feedback deleted' });
  } finally {
    await close();
  }
});

// ─── 15. Subscriptions & Plans (Admin) ────────────────────────────────────────

app.get('/subscriptions', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const search = c.req.query('search')?.toLowerCase()?.trim();
    const tier = c.req.query('tier');
    const status = c.req.query('status');
    const sortBy = c.req.query('sortBy') || 'name';

    let restaurants = await db.select().from(appSchema.restaurant);
    const plans = [
      { id: 'TRIAL', name: 'Free Trial', price: 0, duration: '14 Days' },
      { id: 'ACTIVE', name: 'Pro SaaS Plan', price: 2999, duration: 'Monthly' },
      { id: 'SUSPENDED', name: 'Suspended / Overdue', price: 0, duration: 'None' },
    ];

    if (tier && tier !== 'ALL') {
      restaurants = restaurants.filter((r) => {
        const pTier = r.status === 'TRIAL' ? 'FREE' : 'PRO';
        return pTier === tier || r.status === tier;
      });
    }
    if (status && status !== 'ALL') {
      restaurants = restaurants.filter((r) => r.status === status || (status === 'EXPIRED' && r.status === 'SUSPENDED'));
    }
    if (search) {
      restaurants = restaurants.filter((r) =>
        (r.name && r.name.toLowerCase().includes(search)) ||
        (r.phone && r.phone.toLowerCase().includes(search)) ||
        (r.address && r.address.toLowerCase().includes(search))
      );
    }

    restaurants.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
      if (sortBy === 'newest' || sortBy === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return (a.name || '').localeCompare(b.name || '');
    });

    const mapped = restaurants.map((r) => ({
      ...r,
      subscriptionStatus: r.status || 'ACTIVE',
      planTier: r.status === 'TRIAL' ? 'FREE' : 'PRO',
    }));

    return c.json({ restaurants: mapped, plans });
  } finally {
    await close();
  }
});

app.patch('/subscriptions/:restaurantId', requireAdmin(), async (c) => {
  const restaurantId = c.req.param('restaurantId');
  const body = await c.req.json().catch(() => ({}));
  const { status } = body;
  const { db, close } = getDb(c);
  try {
    const [updated] = await db
      .update(appSchema.restaurant)
      .set({ status, updatedAt: new Date() })
      .where(eq(appSchema.restaurant.id, restaurantId))
      .returning();
    if (!updated) return c.json({ error: 'Not Found', message: 'Restaurant not found' }, 404);
    return c.json(updated);
  } finally {
    await close();
  }
});

export { app as adminRoutes };
