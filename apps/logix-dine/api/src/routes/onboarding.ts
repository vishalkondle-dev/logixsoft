import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient } from '../db';
import { appSchema } from '../db';
import { requireAuth } from '../lib/tenancy';
import { CreateRestaurantSchema } from '@logixsoft/logix-dine/schemas/pos';
import { toRestaurant, toOutlet } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

app.post('/restaurant', requireAuth(), async (c) => {
  const user = c.get('sessionUser') as any;

  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
  }
  const { name, address, phone, outletName } = parsed.data;

  const { db, close } = getDb(c);
  try {
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
        status: 'TRIAL',
        ownerUserId: user.id,
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });

      await tx.insert(appSchema.restaurantOutlet).values({
        id: outletId,
        restaurantId,
        name: outletName ?? 'Main',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });

      await tx.insert(appSchema.restaurantMember).values({
        id: memberId,
        restaurantId,
        userId: user.id,
        phone: actorPhone ?? '',
        role: 'OWNER',
        inviteStatus: 'ACCEPTED',
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });

      await tx
        .update(appSchema.user)
        .set({ role: 'OWNER', updatedAt: now })
        .where(eq(appSchema.user.id, user.id));
    });

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
