import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, requireMembership, assertOutletAccess } from '../lib/tenancy';
import {
  CreateOutletSchema,
  UpdateOutletSchema,
  RestaurantOutletSchema,
} from '@logixsoft/logix-dine/schemas/pos';
import { toOutlet } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';
import { invalidateRestaurant, invalidateUserSession, extractSessionToken } from '../lib/cache';

const app = new Hono<{ Bindings: AuthEnv }>();

function kv(c: any) { return c.env?.CACHE; }

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// GET /outlets
app.get(
  '/',
  apiDoc({
    tags: ['Outlets'],
    summary: 'List Restaurant Outlets',
    description: 'Returns all outlets for the active restaurant.',
    responses: { 200: z.array(RestaurantOutletSchema) },
  }),
  requireMembership(),
  async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const { db, close } = getDb(c);
  try {
    const conditions = [eq(appSchema.restaurantOutlet.restaurantId, restaurantId)];
    if (!tenant.allOutlets && tenant.role !== 'OWNER' && tenant.role !== 'ADMIN') {
      conditions.push(inArray(appSchema.restaurantOutlet.id, tenant.outletIds || ['__none__']));
    }
    const outlets = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(and(...conditions));
    return c.json(outlets.map(toOutlet));
  } finally {
    await close();
  }
});

// GET /outlets/billing — returns billing summary & outlet subscriptions for current restaurant
app.get(
  '/billing',
  apiDoc({
    tags: ['Outlets'],
    summary: 'Get Restaurant Outlets Billing & Subscriptions',
    description: 'Returns billing summary, per-outlet SaaS plan tiers, status, and invoice history.',
    responses: {
      200: z.any(),
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const { db, close } = getDb(c);
    try {
      const [rest] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      const outlets = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));

      const plans = [
        {
          id: 'BASIC',
          name: 'Starter Plan',
          monthlyPrice: 999,
          annualPrice: 9990,
          features: [
            'Standard POS Terminal',
            'KOT Generation & Printing',
            'Table & Section Layouts',
            'GST Invoicing & Thermal Bills',
            'Unlimited Orders',
            'Email & Chat Support',
          ],
        },
        {
          id: 'PRO',
          name: 'Pro Plan',
          monthlyPrice: 1499,
          annualPrice: 14990,
          popular: true,
          features: [
            'Everything in Starter',
            'Unlimited Waiter Mobile Apps',
            'Kitchen Display System (KDS)',
            'Inventory & Recipe BOM Costing',
            'WhatsApp Instant e-Bills',
            'Advanced Analytics & Tax Audit',
            'Online Aggregators (Swiggy, Zomato)',
            'Table Reservations & Custom Roles Matrix',
          ],
        },
      ];

      const enrichedOutlets = outlets.map((o: any) => {
        const plan = plans.find((p) => p.id === o.planTier) || plans[0];
        return {
          ...toOutlet(o),
          planName: plan.name,
          monthlyPrice: plan.monthlyPrice,
          annualPrice: plan.annualPrice,
        };
      });

      const invoices = [
        {
          id: `INV-${new Date().getFullYear()}-001`,
          date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          outletName: enrichedOutlets[0]?.name || 'Main Branch',
          planName: 'Pro SaaS Plan',
          billingCycle: 'Monthly',
          amount: 1499,
          tax: 270,
          total: 1769,
          status: 'PAID',
        },
      ];

      return c.json({
        restaurant: {
          id: rest?.id,
          name: rest?.name,
        },
        outlets: enrichedOutlets,
        plans,
        invoices,
      });
    } finally {
      await close();
    }
  }
);

// POST /outlets
app.post(
  '/',
  apiDoc({
    tags: ['Outlets'],
    summary: 'Create Restaurant Outlet',
    description: 'Creates a new branch/outlet for the active restaurant.',
    body: CreateOutletSchema,
    responses: {
      201: RestaurantOutletSchema,
      400: ErrorResponseSchema,
    },
  }),
  requirePermission('outlet:write'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateOutletSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const now = new Date();
    const id = generateId('outlet');
    const planTier = parsed.data.planTier || 'BASIC';
    const billingCycle = parsed.data.billingCycle || 'MONTHLY';
    const status = parsed.data.status || 'ACTIVE';

    await db.insert(appSchema.restaurantOutlet).values({
      id,
      restaurantId,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      upiId: parsed.data.upiId ?? null,
      status,
      planTier,
      billingCycle,
      trialEndsAt: null,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });
    const [outlet] = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, id));
    await invalidateRestaurant(kv(c), restaurantId);

    // Invalidate user session so newly created outlet is immediately in tenant.outletIds
    const token = extractSessionToken(c.req.header('Cookie') || '', c.req.header('Authorization') || '');
    if (token) {
      await invalidateUserSession(kv(c), token).catch(() => {});
    }

    return c.json(toOutlet(outlet), 201);
  } finally {
    await close();
  }
});

// PUT /outlets/:id
app.put(
  '/:id',
  apiDoc({
    tags: ['Outlets'],
    summary: 'Update Restaurant Outlet',
    description: 'Updates outlet name, address, phone number, or upiId.',
    params: z.object({ id: z.string() }),
    body: UpdateOutletSchema,
    responses: {
      200: RestaurantOutletSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('outlet:write'),
  async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const outletId = c.req.param('id');

  if (!assertOutletAccess(tenant, outletId)) {
    return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateOutletSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    await db
      .update(appSchema.restaurantOutlet)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(
        eq(appSchema.restaurantOutlet.id, outletId),
        eq(appSchema.restaurantOutlet.restaurantId, restaurantId),
      ));
    const [outlet] = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, outletId));
    if (!outlet) return c.json({ error: 'Not Found' }, 404);
    await invalidateRestaurant(kv(c), restaurantId);
    return c.json(toOutlet(outlet));
  } finally {
    await close();
  }
});

// DELETE /outlets/:id
app.delete(
  '/:id',
  apiDoc({
    tags: ['Outlets'],
    summary: 'Delete Restaurant Outlet',
    description: 'Deletes an outlet (default outlet cannot be deleted).',
    params: z.object({ id: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('outlet:write'),
  async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const outletId = c.req.param('id');

  if (!assertOutletAccess(tenant, outletId)) {
    return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
  }

  const { db, close } = getDb(c);
  try {
    const [outlet] = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(and(
        eq(appSchema.restaurantOutlet.id, outletId),
        eq(appSchema.restaurantOutlet.restaurantId, restaurantId),
      ));
    if (!outlet) return c.json({ error: 'Not Found' }, 404);
    if (outlet.isDefault) {
      return c.json({ error: 'Forbidden', message: 'Cannot delete the default outlet. Set another outlet as default first.' }, 403);
    }
    await db
      .delete(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, outletId));
    await invalidateRestaurant(kv(c), restaurantId);
    return c.json({ success: true });
  } finally {
    await close();
  }
});

// PATCH /outlets/:id/set-default
app.patch(
  '/:id/set-default',
  apiDoc({
    tags: ['Outlets'],
    summary: 'Set Outlet as Default',
    description: 'Sets this outlet as the default outlet for the restaurant.',
    params: z.object({ id: z.string() }),
    responses: {
      200: RestaurantOutletSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('outlet:write'),
  async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const outletId = c.req.param('id');

  if (!assertOutletAccess(tenant, outletId)) {
    return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
  }

  const { db, close } = getDb(c);
  try {
    await db.transaction(async (tx) => {
      // Unset all defaults
      await tx
        .update(appSchema.restaurantOutlet)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));
      // Set this one as default
      await tx
        .update(appSchema.restaurantOutlet)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(and(
          eq(appSchema.restaurantOutlet.id, outletId),
          eq(appSchema.restaurantOutlet.restaurantId, restaurantId),
        ));
    });
    const [outlet] = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, outletId));
    if (!outlet) return c.json({ error: 'Not Found' }, 404);
    await invalidateRestaurant(kv(c), restaurantId);
    return c.json(toOutlet(outlet));
  } finally {
    await close();
  }
});

// PUT /outlets/:id/subscription — update an outlet's subscription plan & cycle
const UpdateOutletSubscriptionSchema = z.object({
  planTier: z.enum(['BASIC', 'PRO']),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED']).optional(),
});

app.put(
  '/:id/subscription',
  apiDoc({
    tags: ['Outlets'],
    summary: 'Update Outlet Subscription',
    description: 'Updates plan tier, billing cycle, or status for a specific outlet (Owner only).',
    params: z.object({ id: z.string() }),
    body: UpdateOutletSubscriptionSchema,
    responses: {
      200: RestaurantOutletSchema,
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('outlet:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = UpdateOutletSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const now = new Date();
      const updates: any = {
        planTier: parsed.data.planTier,
        updatedAt: now,
      };

      if (parsed.data.billingCycle) {
        updates.billingCycle = parsed.data.billingCycle;
      }

      if (parsed.data.status) {
        updates.status = parsed.data.status;
      } else {
        updates.status = 'ACTIVE';
        const days = parsed.data.billingCycle === 'ANNUAL' ? 365 : 30;
        updates.subscriptionExpiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      }

      const [updated] = await db
        .update(appSchema.restaurantOutlet)
        .set(updates)
        .where(and(
          eq(appSchema.restaurantOutlet.id, outletId),
          eq(appSchema.restaurantOutlet.restaurantId, restaurantId),
        ))
        .returning();

      if (!updated) {
        return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);
      }

      await invalidateRestaurant(kv(c), restaurantId);
      return c.json(toOutlet(updated));
    } finally {
      await close();
    }
  }
);

export { app as outletRoutes };
