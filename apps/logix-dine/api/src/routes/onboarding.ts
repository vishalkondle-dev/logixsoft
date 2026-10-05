import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient } from '../db';
import { appSchema } from '../db';
import { requireAuth, invalidateStaffSessions } from '../lib/tenancy';
import { extractSessionToken, deleteSessionPayload } from '../lib/cache';
import { CreateRestaurantSchema, RestaurantSchema, RestaurantOutletSchema } from '@logixsoft/logix-dine/schemas/pos';
import { toRestaurant, toOutlet } from '@logixsoft/logix-dine/mappers/pos';
import { DEFAULT_FREE_TRIAL_DAYS } from '@logixsoft/logix-dine/types/plans';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { ensureDefaultRoles } from './roles';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

app.post(
  '/restaurant',
  apiDoc({
    tags: ['Onboarding'],
    summary: 'Onboard New Restaurant',
    description: 'Initializes a new restaurant, creates default outlet, and assigns current user as OWNER.',
    body: CreateRestaurantSchema,
    responses: {
      201: z.object({
        restaurant: RestaurantSchema,
        outlet: RestaurantOutletSchema,
      }),
      400: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
  }),
  requireAuth(),
  async (c) => {
  const user = c.get('sessionUser') as any;

  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
  }
  const { name, address, phone, outletName } = parsed.data;

  const { db, close } = getDb(c);
  try {
    if (user?.role === 'ADMIN') {
      return c.json({
        error: 'Forbidden',
        message: 'Platform superadmin cannot own a restaurant. Admin must have only the ADMIN role. Create stores via the Admin Portal.',
      }, 403);
    }

    // Check not already an owner
    const [existing] = await db
      .select({ id: appSchema.restaurant.id })
      .from(appSchema.restaurant)
      .where(eq(appSchema.restaurant.ownerUserId, user.id))
      .limit(1);

    if (existing) {
      return c.json({ error: 'Conflict', message: 'You already have a restaurant' }, 409);
    }

    const restaurantId = generateId('rest');
    const outletId = generateId('outlet');
    const memberId = generateId('member');
    const now = new Date();
    const actorPhone: string | null = user.phoneNumber ?? null;

    // Transaction: create restaurant + outlet + member + update user role
    await db.transaction(async (tx) => {
      await tx.insert(appSchema.restaurant).values({
        id: restaurantId,
        name,
        address,
        phone: phone ?? null,
        currency: 'INR',
        status: 'ACTIVE',
        ownerUserId: user.id,
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });

      const trialEndsAt = new Date(now.getTime() + DEFAULT_FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);

      await tx.insert(appSchema.restaurantOutlet).values({
        id: outletId,
        restaurantId,
        name: outletName ?? 'Main',
        isDefault: true,
        status: 'ACTIVE',
        planTier: 'BASIC',
        billingCycle: 'MONTHLY',
        trialEndsAt,
        subscriptionExpiresAt: trialEndsAt,
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });

      await tx.insert(appSchema.outletStaff).values({
        id: memberId,
        restaurantId,
        outletId: null, // brand-wide
        userId: user.id,
        phone: actorPhone ?? '',
        name: user.name,
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });

      if (user.role !== 'ADMIN') {
        await tx
          .update(appSchema.user)
          .set({ role: 'OWNER', updatedAt: now })
          .where(eq(appSchema.user.id, user.id));
      }
    });

    // Seed default system roles for the new restaurant
    await ensureDefaultRoles(db, restaurantId, actorPhone || 'system');

    // Invalidate user sessions in KV so newly assigned OWNER role & restaurant memberships are live instantly
    const kvNamespace = (c.env as any)?.CACHE;
    if (kvNamespace) {
      await invalidateStaffSessions(db, kvNamespace, [{ userId: user.id, phone: actorPhone }]);
      const token = extractSessionToken(c.req.header('Cookie') || '', c.req.header('Authorization') || '');
      if (token) {
        await deleteSessionPayload(kvNamespace, token).catch(() => {});
        if (token.includes('.')) {
          await deleteSessionPayload(kvNamespace, token.split('.')[0]).catch(() => {});
        }
      }
    }

    const [newRestaurant] = await db
      .select()
      .from(appSchema.restaurant)
      .where(eq(appSchema.restaurant.id, restaurantId));

    const [newOutlet] = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, outletId));

    return c.json({
      restaurant: toRestaurant(newRestaurant),
      outlet: toOutlet(newOutlet),
    }, 201);
  } finally {
    await close();
  }
});

export { app as onboardingRoutes };
