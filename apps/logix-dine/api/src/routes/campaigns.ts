import { Hono } from 'hono';
import { sql, eq, and, desc, inArray } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { sendWhatsAppText, sendWhatsAppImage } from '@logixsoft/wa';
import {
  CreateCampaignSchema,
  TestCampaignSchema,
} from '@logixsoft/logix-dine/schemas/pos';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// Helper to normalize phone
function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  return last10.length === 10 ? `91${last10}` : digits;
}

// ─── GET /campaigns (List All Marketing Campaigns) ───────────────────────────
app.get(
  '/',
  apiDoc({
    tags: ['Campaigns'],
    summary: 'List WhatsApp Marketing Campaigns',
    description: 'Returns historical and scheduled WhatsApp promotional broadcast campaigns.',
    query: z.object({
      outletId: z.string().optional(),
      status: z.string().optional(),
    }),
    responses: {
      200: z.any(),
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const filterOutletId = c.req.query('outletId');
    const filterStatus = c.req.query('status');

    if (filterOutletId && !assertOutletAccess(tenant, filterOutletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${filterOutletId}'` }, 403);
    }

    const { db, close } = getDb(c);

    try {
      const conditions = [eq(appSchema.marketingCampaign.restaurantId, restaurantId)];
      if (filterOutletId) {
        conditions.push(eq(appSchema.marketingCampaign.outletId, filterOutletId));
      }
      if (filterStatus) {
        conditions.push(eq(appSchema.marketingCampaign.status, filterStatus.toUpperCase()));
      }

      const campaigns = await db
        .select()
        .from(appSchema.marketingCampaign)
        .where(and(...conditions))
        .orderBy(desc(appSchema.marketingCampaign.createdAt));

      // Calculate summary stats
      let totalMessagesSent = 0;
      let totalFailed = 0;
      let scheduledCount = 0;

      for (const camp of campaigns) {
        totalMessagesSent += camp.sentCount || 0;
        totalFailed += camp.failedCount || 0;
        if (camp.status === 'SCHEDULED') scheduledCount++;
      }

      const totalDelivered = totalMessagesSent;
      const totalAttempted = totalMessagesSent + totalFailed;
      const successRate = totalAttempted > 0 ? Number(((totalDelivered / totalAttempted) * 100).toFixed(1)) : 100;

      return c.json({
        campaigns,
        summary: {
          totalCampaigns: campaigns.length,
          totalMessagesSent,
          totalFailed,
          scheduledCount,
          successRate,
        },
      });
    } finally {
      await close();
    }
  }
);

// ─── GET /campaigns/:id (Get Single Campaign with Recipient Logs) ─────────────
app.get(
  '/:id',
  apiDoc({
    tags: ['Campaigns'],
    summary: 'Get Campaign Details & Delivery Logs',
    params: z.object({ id: z.string() }),
    responses: {
      200: z.any(),
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const id = c.req.param('id');
    const { db, close } = getDb(c);

    try {
      const [campaign] = await db
        .select()
        .from(appSchema.marketingCampaign)
        .where(
          and(
            eq(appSchema.marketingCampaign.id, id),
            eq(appSchema.marketingCampaign.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!campaign) {
        return c.json({ error: 'Not Found', message: 'Campaign not found' }, 404);
      }

      const recipients = await db
        .select()
        .from(appSchema.campaignRecipient)
        .where(eq(appSchema.campaignRecipient.campaignId, id))
        .limit(100);

      return c.json({ campaign, recipients });
    } finally {
      await close();
    }
  }
);

// ─── POST /campaigns/test (Send 1-Click Test to Owner WhatsApp) ───────────────
app.post(
  '/test',
  apiDoc({
    tags: ['Campaigns'],
    summary: 'Send Test Promotional WhatsApp to Owner Phone',
    description: 'Dispatches an instant live sample of the promotional broadcast message & flyer to the specified phone.',
    body: TestCampaignSchema,
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parse = TestCampaignSchema.safeParse(body);
    if (!parse.success) {
      return c.json({ error: 'Validation Error', message: parse.error.issues[0]?.message || 'Invalid payload' }, 400);
    }

    const { db, close } = getDb(c);

    try {
      // Find restaurant name and target test phone
      const [restRow] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      const restaurantName = restRow?.name || 'Our Restaurant';

      // Recipient test phone: supplied phone, or restRow phone
      const rawTarget = parse.data.testPhone || restRow?.phone || '';
      const targetPhone = cleanPhone(rawTarget);

      if (!targetPhone || targetPhone.length < 10) {
        return c.json({ error: 'Bad Request', message: 'No valid phone number found for test dispatch' }, 400);
      }

      // Format text
      let text = parse.data.message
        .replace(/\{name\}/gi, 'Valued Guest')
        .replace(/\{restaurant_name\}/gi, restaurantName);

      if (parse.data.offerCode) {
        text = text.replace(/\{offer_code\}/gi, parse.data.offerCode);
      }

      const waConfig = { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY };

      if (parse.data.mediaUrl && parse.data.mediaUrl.trim()) {
        await sendWhatsAppImage(targetPhone, parse.data.mediaUrl.trim(), { caption: text }, waConfig);
      } else {
        await sendWhatsAppText(targetPhone, text, undefined, waConfig);
      }

      return c.json({
        success: true,
        sentTo: targetPhone,
        sampleText: text,
      });
    } catch (err: any) {
      return c.json({ error: 'WhatsApp Test Failed', message: err.message || String(err) }, 500);
    } finally {
      await close();
    }
  }
);

// ─── POST /campaigns (Create and optionally Dispatch Campaign) ───────────────
app.post(
  '/',
  apiDoc({
    tags: ['Campaigns'],
    summary: 'Create and Launch or Schedule WhatsApp Campaign',
    body: CreateCampaignSchema,
    responses: {
      201: z.any(),
      400: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const sessionUser = c.get('sessionUser');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parse = CreateCampaignSchema.safeParse(body);
    if (!parse.success) {
      return c.json({ error: 'Validation Error', message: parse.error.issues[0]?.message || 'Invalid campaign payload' }, 400);
    }

    const {
      title,
      message,
      mediaUrl,
      offerCode,
      targetAudience,
      outletId,
      scheduledAt,
      sendImmediately,
    } = parse.data;

    const { db, close } = getDb(c);

    try {
      const [restRow] = await db
        .select({ name: appSchema.restaurant.name })
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      const restaurantName = restRow?.name || 'Our Restaurant';

      // 1. Gather all customers (No segments!)
      const customers = await db
        .select()
        .from(appSchema.restaurantCustomer)
        .where(
          and(
            eq(appSchema.restaurantCustomer.restaurantId, restaurantId),
            eq(appSchema.restaurantCustomer.isBlacklisted, false)
          )
        );

      const campaignId = generateId();
      const isScheduled = !sendImmediately && Boolean(scheduledAt);
      const initialStatus = isScheduled ? 'SCHEDULED' : 'SENDING';

      const [campaign] = await db
        .insert(appSchema.marketingCampaign)
        .values({
          id: campaignId,
          restaurantId,
          outletId: outletId || null,
          title,
          message,
          mediaUrl: mediaUrl || null,
          offerCode: offerCode || null,
          targetAudience,
          status: initialStatus,
          scheduledAt: isScheduled ? new Date(scheduledAt!) : null,
          totalRecipients: customers.length,
          createdByName: (sessionUser as any)?.name || tenant.roleName || tenant.role || 'Staff',
        })
        .returning();

      // If scheduled, stop here and wait for cron
      if (isScheduled) {
        return c.json(campaign, 201);
      }

      // If send immediately: dispatch batch (up to 250 for safety)
      const dispatchBatch = customers.slice(0, 250);
      let sentCount = 0;
      let failedCount = 0;
      const waConfig = { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY };

      const recipientRows: any[] = [];

      for (const cust of dispatchBatch) {
        const targetPhone = cleanPhone(cust.phone);
        let personalized = message
          .replace(/\{name\}/gi, cust.name || 'Valued Guest')
          .replace(/\{restaurant_name\}/gi, restaurantName);

        if (offerCode) {
          personalized = personalized.replace(/\{offer_code\}/gi, offerCode);
        }

        try {
          if (mediaUrl && mediaUrl.trim()) {
            await sendWhatsAppImage(targetPhone, mediaUrl.trim(), { caption: personalized }, waConfig);
          } else {
            await sendWhatsAppText(targetPhone, personalized, undefined, waConfig);
          }
          sentCount++;
          recipientRows.push({
            id: generateId(),
            campaignId,
            customerPhone: cust.phone,
            customerName: cust.name || null,
            status: 'SENT',
            sentAt: new Date(),
          });
        } catch (err: any) {
          failedCount++;
          recipientRows.push({
            id: generateId(),
            campaignId,
            customerPhone: cust.phone,
            customerName: cust.name || null,
            status: 'FAILED',
            sentAt: new Date(),
            error: err.message || String(err),
          });
        }
      }

      // Save recipient logs
      if (recipientRows.length > 0) {
        try {
          await db.insert(appSchema.campaignRecipient).values(recipientRows);
        } catch (logErr) {
          console.warn('Failed to insert campaign recipient logs:', logErr);
        }
      }

      // Mark campaign completed
      const [completedCampaign] = await db
        .update(appSchema.marketingCampaign)
        .set({
          status: 'COMPLETED',
          sentCount,
          failedCount,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(appSchema.marketingCampaign.id, campaignId))
        .returning();

      return c.json(completedCampaign, 201);
    } finally {
      await close();
    }
  }
);

// ─── POST /campaigns/:id/send (Trigger Immediate Dispatch of Scheduled Campaign)
app.post(
  '/:id/send',
  apiDoc({
    tags: ['Campaigns'],
    summary: 'Dispatch Scheduled Campaign Immediately',
    params: z.object({ id: z.string() }),
    responses: {
      200: z.any(),
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const id = c.req.param('id');
    const { db, close } = getDb(c);

    try {
      const [campaign] = await db
        .select()
        .from(appSchema.marketingCampaign)
        .where(
          and(
            eq(appSchema.marketingCampaign.id, id),
            eq(appSchema.marketingCampaign.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!campaign) {
        return c.json({ error: 'Not Found', message: 'Campaign not found' }, 404);
      }

      const [restRow] = await db
        .select({ name: appSchema.restaurant.name })
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      const restaurantName = restRow?.name || 'Our Restaurant';

      const customers = await db
        .select()
        .from(appSchema.restaurantCustomer)
        .where(
          and(
            eq(appSchema.restaurantCustomer.restaurantId, restaurantId),
            eq(appSchema.restaurantCustomer.isBlacklisted, false)
          )
        );

      await db
        .update(appSchema.marketingCampaign)
        .set({ status: 'SENDING', updatedAt: new Date() })
        .where(eq(appSchema.marketingCampaign.id, id));

      const dispatchBatch = customers.slice(0, 250);
      let sentCount = 0;
      let failedCount = 0;
      const waConfig = { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY };
      const recipientRows: any[] = [];

      for (const cust of dispatchBatch) {
        const targetPhone = cleanPhone(cust.phone);
        let personalized = campaign.message
          .replace(/\{name\}/gi, cust.name || 'Valued Guest')
          .replace(/\{restaurant_name\}/gi, restaurantName);

        if (campaign.offerCode) {
          personalized = personalized.replace(/\{offer_code\}/gi, campaign.offerCode);
        }

        try {
          if (campaign.mediaUrl && campaign.mediaUrl.trim()) {
            await sendWhatsAppImage(targetPhone, campaign.mediaUrl.trim(), { caption: personalized }, waConfig);
          } else {
            await sendWhatsAppText(targetPhone, personalized, undefined, waConfig);
          }
          sentCount++;
          recipientRows.push({
            id: generateId(),
            campaignId: id,
            customerPhone: cust.phone,
            customerName: cust.name || null,
            status: 'SENT',
            sentAt: new Date(),
          });
        } catch (err: any) {
          failedCount++;
          recipientRows.push({
            id: generateId(),
            campaignId: id,
            customerPhone: cust.phone,
            customerName: cust.name || null,
            status: 'FAILED',
            sentAt: new Date(),
            error: err.message || String(err),
          });
        }
      }

      if (recipientRows.length > 0) {
        try {
          await db.insert(appSchema.campaignRecipient).values(recipientRows);
        } catch (e) {
          console.warn('Recipient log warning:', e);
        }
      }

      const [updated] = await db
        .update(appSchema.marketingCampaign)
        .set({
          status: 'COMPLETED',
          sentCount,
          failedCount,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(appSchema.marketingCampaign.id, id))
        .returning();

      return c.json(updated);
    } finally {
      await close();
    }
  }
);

// ─── POST /campaigns/:id/cancel (Cancel Scheduled Campaign) ───────────────────
app.post(
  '/:id/cancel',
  apiDoc({
    tags: ['Campaigns'],
    summary: 'Cancel Scheduled Campaign',
    params: z.object({ id: z.string() }),
    responses: {
      200: z.any(),
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const id = c.req.param('id');
    const { db, close } = getDb(c);

    try {
      const [updated] = await db
        .update(appSchema.marketingCampaign)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where(
          and(
            eq(appSchema.marketingCampaign.id, id),
            eq(appSchema.marketingCampaign.restaurantId, restaurantId)
          )
        )
        .returning();

      if (!updated) {
        return c.json({ error: 'Not Found', message: 'Campaign not found' }, 404);
      }

      return c.json(updated);
    } finally {
      await close();
    }
  }
);

// ─── DELETE /campaigns/:id (Delete Campaign Record) ───────────────────────────
app.delete(
  '/:id',
  apiDoc({
    tags: ['Campaigns'],
    summary: 'Delete Marketing Campaign',
    params: z.object({ id: z.string() }),
    responses: {
      200: z.object({ success: z.boolean() }),
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const id = c.req.param('id');
    const { db, close } = getDb(c);

    try {
      const [deleted] = await db
        .delete(appSchema.marketingCampaign)
        .where(
          and(
            eq(appSchema.marketingCampaign.id, id),
            eq(appSchema.marketingCampaign.restaurantId, restaurantId)
          )
        )
        .returning();

      if (!deleted) {
        return c.json({ error: 'Not Found', message: 'Campaign not found' }, 404);
      }

      return c.json({ success: true });
    } finally {
      await close();
    }
  }
);

export const campaignRoutes = app;
