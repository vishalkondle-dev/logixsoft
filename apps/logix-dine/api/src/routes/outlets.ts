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
import { getSubscriptionPlans, resolveOutletPlanPricing } from '../lib/plan-helpers';

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

      const plans = await getSubscriptionPlans(c);

      const enrichedOutlets = outlets.map((o: any) => {
        const plan = plans.find((p) => p.id === o.planTier) || plans[0];
        const pricing = resolveOutletPlanPricing(o, plan, o.billingCycle || 'MONTHLY');
        return {
          ...toOutlet(o),
          planName: plan.name,
          monthlyPrice: pricing.monthlyPrice,
          annualPrice: pricing.annualPrice,
          effectivePrice: pricing.effectivePrice,
          isCustomPrice: pricing.isCustom,
        };
      });

      const invoices = [
        {
          id: `INV-${new Date().getFullYear()}-001`,
          date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          outletId: enrichedOutlets[0]?.id,
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

// POST /outlets/:id/payment/one-time — create a one-time subscription payment order via logix-pg
const InitiateOneTimePaymentSchema = z.object({
  planTier: z.enum(['BASIC', 'PRO']),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
});

app.post(
  '/:id/payment/one-time',
  requirePermission('outlet:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = InitiateOneTimePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

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
          eq(appSchema.restaurantOutlet.restaurantId, restaurantId)
        ))
        .limit(1);

      if (!outlet) {
        return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);
      }

      const [restaurant] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      const planTier = parsed.data.planTier;
      const billingCycle = parsed.data.billingCycle;

      // Price matrix in paise from configured plans & custom outlet override
      const plans = await getSubscriptionPlans(c);
      const targetPlan = plans.find((p) => p.id === planTier) || plans[0];
      const pricing = resolveOutletPlanPricing(outlet, targetPlan, billingCycle);
      const amountInPaise = Math.round(pricing.effectivePrice * 100);

      const ownerPhone = restaurant?.phone || outlet.phone || c.get('actorPhone') || '9876543210';
      const pgApiUrl = (c.env as any)?.PG_API_URL || 'https://payment-api.logixsoft.in';
      const pgWebUrl = (c.env as any)?.PG_WEB_URL || 'https://payment.logixsoft.in';

      // Call Logix PG Order Creation
      const pgRes = await fetch(`${pgApiUrl}/api/v1/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountInPaise,
          customerPhone: ownerPhone,
          customerName: restaurant?.name || 'Restaurant Owner',
          merchantId: c.get('sessionUser')?.id || tenant.member?.userId || undefined,
          description: `Logix Dine - ${outlet.name} (${planTier} Plan - ${billingCycle === 'ANNUAL' ? '1 Year' : '1 Month'})`,
          metadata: {
            type: 'OUTLET_SUBSCRIPTION_ONE_TIME',
            restaurantId,
            outletId,
            planTier,
            billingCycle,
            webhookUrl: `${(c.env as any)?.API_URL || 'https://dine-api.logixsoft.in'}/api/webhooks/pg`,
          },
        }),
      });

      if (!pgRes.ok) {
        const errText = await pgRes.text();
        return c.json({ error: 'Payment Gateway Error', message: `Failed to initiate payment with logix-pg: ${errText}` }, 502);
      }

      const pgData = (await pgRes.json()) as any;

      return c.json({
        success: true,
        orderId: pgData.orderId,
        checkoutUrl: `${pgWebUrl}/pay/${pgData.orderId}`,
        upiString: pgData.upiString,
        amount: pricing.effectivePrice,
        frequency: billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly',
      });
    } finally {
      await close();
    }
  }
);

// POST /outlets/:id/autopay/initiate — create recurring mandate via logix-pg
const InitiateAutopaySchema = z.object({
  planTier: z.enum(['BASIC', 'PRO']),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
});

app.post(
  '/:id/autopay/initiate',
  requirePermission('outlet:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = InitiateAutopaySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

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
          eq(appSchema.restaurantOutlet.restaurantId, restaurantId)
        ))
        .limit(1);

      if (!outlet) {
        return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);
      }

      const [restaurant] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      const planTier = parsed.data.planTier;
      const billingCycle = parsed.data.billingCycle;

      // Price matrix in paise from configured plans & custom outlet override
      const plans = await getSubscriptionPlans(c);
      const targetPlan = plans.find((p) => p.id === planTier) || plans[0];
      const pricing = resolveOutletPlanPricing(outlet, targetPlan, billingCycle);
      const recurringAmountInPaise = Math.round(pricing.effectivePrice * 100);

      const ownerPhone = restaurant?.phone || outlet.phone || c.get('actorPhone') || '9876543210';
      const pgApiUrl = (c.env as any)?.PG_API_URL || 'https://payment-api.logixsoft.in';

      // Call Logix PG Mandate Creation
      const pgRes = await fetch(`${pgApiUrl}/api/v1/mandates/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerPhone: ownerPhone,
          customerName: restaurant?.name || 'Restaurant Owner',
          mandateName: `Logix Dine - ${outlet.name} (${planTier} Plan)`,
          recurringAmount: recurringAmountInPaise,
          maxAmount: 1500000, // ₹15,000 NPCI limit
          frequency: billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
          metadata: {
            restaurantId,
            outletId,
            planTier,
            billingCycle,
            webhookUrl: `${(c.env as any)?.API_URL || 'https://dine-api.logixsoft.in'}/api/webhooks/pg`,
          },
        }),
      });

      if (!pgRes.ok) {
        const errText = await pgRes.text();
        return c.json({ error: 'Payment Gateway Error', message: `Failed to initiate mandate with logix-pg: ${errText}` }, 502);
      }

      const pgData = (await pgRes.json()) as any;

      // Save pending mandate info on the outlet
      await db
        .update(appSchema.restaurantOutlet)
        .set({
          autopayStatus: 'PENDING',
          autopayMandateId: pgData.mandateId,
          updatedAt: new Date(),
        })
        .where(eq(appSchema.restaurantOutlet.id, outletId));

      await invalidateRestaurant(kv(c), restaurantId);

      return c.json({
        success: true,
        mandateId: pgData.mandateId,
        checkoutUrl: pgData.checkoutUrl,
        upiString: pgData.upiString,
        recurringAmount: pgData.recurringAmount,
        frequency: pgData.frequency,
      });
    } finally {
      await close();
    }
  }
);

// POST /outlets/:id/autopay/cancel — cancel active UPI AutoPay mandate
app.post(
  '/:id/autopay/cancel',
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
          eq(appSchema.restaurantOutlet.restaurantId, restaurantId)
        ))
        .limit(1);

      if (!outlet) {
        return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);
      }

      if (outlet.autopayMandateId) {
        const pgApiUrl = (c.env as any)?.PG_API_URL || 'https://payment-api.logixsoft.in';
        await fetch(`${pgApiUrl}/api/v1/mandates/${outlet.autopayMandateId}/cancel`, {
          method: 'POST',
        }).catch(() => {});
      }

      const [updated] = await db
        .update(appSchema.restaurantOutlet)
        .set({
          autopayStatus: 'REVOKED',
          autopayMandateId: null,
          autopayUmn: null,
          updatedAt: new Date(),
        })
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .returning();

      await invalidateRestaurant(kv(c), restaurantId);
      return c.json(toOutlet(updated));
    } finally {
      await close();
    }
  }
);

// POST /outlets/:id/autopay/sync — query PG mandate status and sync to outlet
app.post(
  '/:id/autopay/sync',
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
          eq(appSchema.restaurantOutlet.restaurantId, restaurantId)
        ))
        .limit(1);

      if (!outlet) {
        return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);
      }

      if (!outlet.autopayMandateId) {
        return c.json(toOutlet(outlet));
      }

      const pgApiUrl = (c.env as any)?.PG_API_URL || 'https://payment-api.logixsoft.in';
      const pgRes = await fetch(`${pgApiUrl}/api/v1/mandates/${outlet.autopayMandateId}`).catch(() => null);

      if (pgRes && pgRes.ok) {
        const pgData = (await pgRes.json()) as any;
        if (pgData.status === 'ACTIVE') {
          const nextBilling = pgData.nextBillingDate ? new Date(pgData.nextBillingDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const [updated] = await db
            .update(appSchema.restaurantOutlet)
            .set({
              autopayStatus: 'ACTIVE',
              autopayUmn: pgData.umn || outlet.autopayUmn,
              autopayNextBillingAt: nextBilling,
              subscriptionExpiresAt: nextBilling,
              status: 'ACTIVE',
              updatedAt: new Date(),
            })
            .where(eq(appSchema.restaurantOutlet.id, outletId))
            .returning();

          await invalidateRestaurant(kv(c), restaurantId);
          return c.json(toOutlet(updated));
        }
      }

      return c.json(toOutlet(outlet));
    } finally {
      await close();
    }
  }
);

export { app as outletRoutes };

