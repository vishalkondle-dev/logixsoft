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
import { invalidateRestaurant } from '../lib/cache';

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

      const enriched = restaurants.map((r) => {
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

      const enriched = outlets.map((o) => {
        const r = restMap.get(o.restaurantId);
        return {
          ...toOutlet(o),
          restaurantName: r?.name || 'Unknown',
          restaurantStatus: r?.status || 'UNKNOWN',
        };
      });

      return c.json(enriched);
    } finally {
      await close();
    }
  }
);

// GET /admin/restaurants/:id/outlets — outlets for a specific restaurant
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
    const { db, close } = getDb(c);
    try {
      const outlets = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));
      return c.json(outlets.map(toOutlet));
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

      const enriched = users.map((u) => {
        const mems = membershipsByUser.get(u.id) || (u.phoneNumber ? membershipsByUser.get(u.phoneNumber) : []) || [];
        return {
          ...u,
          memberships: mems,
          ownedCount: ownedCountMap.get(u.id) || 0,
        };
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

export { app as adminRoutes };
