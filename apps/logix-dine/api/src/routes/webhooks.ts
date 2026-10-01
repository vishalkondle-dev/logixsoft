import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbWithClient, appSchema } from '../db';
import type { AuthEnv } from '../lib/auth';
import { invalidateRestaurant } from '../lib/cache';
import { sendWhatsAppText } from '@logixsoft/wa';

const app = new Hono<{ Bindings: AuthEnv }>();

function kv(c: any) { return c.env?.CACHE; }

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// Helper to verify webhook signature using Web Crypto API
async function verifySignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) return false;
  // Format: t=<timestamp>,v1=<signature>
  const parts = signatureHeader.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const sigPart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !sigPart) return false;

  const timestamp = timestampPart.substring(2);
  const signatureHex = sigPart.substring(3);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signed = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
  const expectedHex = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatureHex.toLowerCase() === expectedHex.toLowerCase();
}

// POST /webhooks/pg — Receive notifications from logix-pg
app.post('/pg', async (c) => {
  const rawBody = await c.req.text();
  const signatureHeader = c.req.header('x-logixsoft-signature');
  const secret = (c.env as any)?.PG_WEBHOOK_SECRET || 'logix_default_webhook_secret';

  // In production with custom secret configured, verify signature
  if (c.env && (c.env as any).PG_WEBHOOK_SECRET) {
    const isValid = await verifySignature(rawBody, signatureHeader, secret);
    if (!isValid) {
      console.warn('[webhook:pg] Invalid webhook signature received');
      return c.json({ error: 'Invalid signature' }, 401);
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  const { event, data } = payload;
  if (!event || !data) {
    return c.json({ error: 'Missing event or data in webhook' }, 400);
  }

  console.log(`[webhook:pg] Received event: ${event}`, { mandateId: data.mandateId, umn: data.umn });

  const { db, close } = getDb(c);
  try {
    const outletId = data.metadata?.outletId;
    const mandateId = data.mandateId;

    // Resolve outlet by outletId or by autopayMandateId
    let outlet: any = null;
    if (outletId) {
      const rows = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .limit(1);
      outlet = rows[0];
    }

    if (!outlet && mandateId) {
      const rows = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.autopayMandateId, mandateId))
        .limit(1);
      outlet = rows[0];
    }

    if (!outlet) {
      console.warn(`[webhook:pg] Outlet not found for mandate: ${mandateId}, outletId: ${outletId}`);
      return c.json({ received: true, warning: 'Outlet not found' });
    }

    const restaurantId = outlet.restaurantId;
    const now = new Date();

    // ─── 0. ONE-TIME SUBSCRIPTION PAYMENT SUCCESS ─────────────────────────────
    if (event === 'payment.success' || event === 'order.paid') {
      const planTier = data.metadata?.planTier || outlet.planTier || 'PRO';
      const billingCycle = data.metadata?.billingCycle || outlet.billingCycle || 'MONTHLY';
      const days = billingCycle === 'ANNUAL' ? 365 : 30;

      // Extend from existing expiration date if currently active into future, otherwise from now
      let baseTime = now.getTime();
      if (outlet.subscriptionExpiresAt) {
        const existingExpires = new Date(outlet.subscriptionExpiresAt).getTime();
        if (existingExpires > baseTime) {
          baseTime = existingExpires;
        }
      }
      const newExpiry = new Date(baseTime + days * 24 * 60 * 60 * 1000);

      await db
        .update(appSchema.restaurantOutlet)
        .set({
          planTier,
          billingCycle,
          status: 'ACTIVE',
          subscriptionExpiresAt: newExpiry,
          updatedAt: now,
        })
        .where(eq(appSchema.restaurantOutlet.id, outlet.id));

      await invalidateRestaurant(kv(c), restaurantId);

      // WhatsApp alert
      const targetPhone = outlet.phone || data.customerPhone;
      if (targetPhone) {
        const amountRs = (Number(data.amount) / 100).toFixed(2);
        const msg = `🎉 *Subscription Payment Received!*\n\nPayment of ₹${amountRs} for *${outlet.name}* (${planTier} Plan - ${billingCycle === 'ANNUAL' ? '1 Year' : '1 Month'}) was successful.\n\nValid until: ${newExpiry.toLocaleDateString('en-IN')}\nPayment Ref: ${data.bankReferenceNo || data.orderId}\n\nThank you for choosing Logix Dine!`;
        await sendWhatsAppText(targetPhone, msg, undefined, {
          url: (c.env as any)?.WA_API_URL,
          apiKey: (c.env as any)?.WA_API_KEY,
        }).catch((err) => console.warn('[webhook:pg] WA alert failed:', err.message));
      }

      return c.json({ received: true, action: 'subscription_payment_success', outletId: outlet.id });
    }

    // ─── 1. MANDATE ACTIVATED ───────────────────────────────────────────────
    if (event === 'mandate.activated') {
      const planTier = data.metadata?.planTier || outlet.planTier || 'PRO';
      const billingCycle = data.metadata?.billingCycle || outlet.billingCycle || 'MONTHLY';
      const nextBilling = data.nextBillingDate ? new Date(data.nextBillingDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await db
        .update(appSchema.restaurantOutlet)
        .set({
          autopayStatus: 'ACTIVE',
          autopayMandateId: mandateId,
          autopayUmn: data.umn || null,
          autopayNextBillingAt: nextBilling,
          planTier,
          billingCycle,
          status: 'ACTIVE',
          subscriptionExpiresAt: nextBilling,
          updatedAt: now,
        })
        .where(eq(appSchema.restaurantOutlet.id, outlet.id));

      await invalidateRestaurant(kv(c), restaurantId);

      // WhatsApp alert
      const targetPhone = outlet.phone || data.customerPhone;
      if (targetPhone) {
        const msg = `🎉 *UPI AutoPay Activated!*\n\nSubscription for *${outlet.name}* is now live on the *${planTier}* plan.\n\nMandate UMN: \`${data.umn}\`\nNext Auto-Debit: ${nextBilling.toLocaleDateString('en-IN')}\n\nThank you for choosing Logix Dine!`;
        await sendWhatsAppText(targetPhone, msg, undefined, {
          url: (c.env as any)?.WA_API_URL,
          apiKey: (c.env as any)?.WA_API_KEY,
        }).catch((err) => console.warn('[webhook:pg] WA alert failed:', err.message));
      }

      return c.json({ received: true, action: 'mandate_activated', outletId: outlet.id });
    }

    // ─── 2. MANDATE DEBITED (Renewal) ──────────────────────────────────────
    if (event === 'mandate.debited') {
      const nextBilling = data.nextBillingDate
        ? new Date(data.nextBillingDate)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await db
        .update(appSchema.restaurantOutlet)
        .set({
          status: 'ACTIVE',
          subscriptionExpiresAt: nextBilling,
          autopayNextBillingAt: nextBilling,
          updatedAt: now,
        })
        .where(eq(appSchema.restaurantOutlet.id, outlet.id));

      await invalidateRestaurant(kv(c), restaurantId);

      // WhatsApp alert
      const targetPhone = outlet.phone || data.customerPhone;
      if (targetPhone) {
        const amountRs = (Number(data.amount) / 100).toFixed(2);
        const msg = `✅ *AutoPay Renewal Successful!*\n\nPayment of ₹${amountRs} for *${outlet.name}* was processed successfully.\n\nNext Billing Date: ${nextBilling.toLocaleDateString('en-IN')}\nUMN: \`${data.umn || outlet.autopayUmn}\`\nRef: ${data.bankReferenceNo || data.chargeId}`;
        await sendWhatsAppText(targetPhone, msg, undefined, {
          url: (c.env as any)?.WA_API_URL,
          apiKey: (c.env as any)?.WA_API_KEY,
        }).catch((err) => console.warn('[webhook:pg] WA alert failed:', err.message));
      }

      return c.json({ received: true, action: 'mandate_debited', outletId: outlet.id });
    }

    // ─── 3. PRE-DEBIT NOTIFICATION (24h Notice) ─────────────────────────────
    if (event === 'mandate.upcoming_debit') {
      const targetPhone = outlet.phone || data.customerPhone;
      if (targetPhone) {
        const amountRs = (Number(data.amount) / 100).toFixed(2);
        const dueDate = data.dueDate ? new Date(data.dueDate).toLocaleDateString('en-IN') : 'tomorrow';
        const msg = `🔔 *Upcoming AutoPay Renewal*\n\nYour subscription for *${outlet.name}* is scheduled for automatic renewal on *${dueDate}* for ₹${amountRs}.\n\nMandate UMN: \`${data.umn || outlet.autopayUmn}\`\nNo action required to continue seamless service.`;
        await sendWhatsAppText(targetPhone, msg, undefined, {
          url: (c.env as any)?.WA_API_URL,
          apiKey: (c.env as any)?.WA_API_KEY,
        }).catch((err) => console.warn('[webhook:pg] WA alert failed:', err.message));
      }

      return c.json({ received: true, action: 'upcoming_debit_notified', outletId: outlet.id });
    }

    // ─── 4. MANDATE REVOKED / CANCELLED ─────────────────────────────────────
    if (event === 'mandate.revoked') {
      await db
        .update(appSchema.restaurantOutlet)
        .set({
          autopayStatus: 'REVOKED',
          autopayMandateId: null,
          autopayUmn: null,
          autopayNextBillingAt: null,
          updatedAt: now,
        })
        .where(eq(appSchema.restaurantOutlet.id, outlet.id));

      await invalidateRestaurant(kv(c), restaurantId);

      // WhatsApp alert
      const targetPhone = outlet.phone || data.customerPhone;
      if (targetPhone) {
        const expiryStr = outlet.subscriptionExpiresAt
          ? new Date(outlet.subscriptionExpiresAt).toLocaleDateString('en-IN')
          : 'the end of your current cycle';
        const msg = `⚠️ *UPI AutoPay Revoked*\n\nAutoPay mandate for *${outlet.name}* has been cancelled. Your active subscription remains valid until ${expiryStr}.\n\nYou can re-enable AutoPay anytime from Outlet Settings.`;
        await sendWhatsAppText(targetPhone, msg, undefined, {
          url: (c.env as any)?.WA_API_URL,
          apiKey: (c.env as any)?.WA_API_KEY,
        }).catch((err) => console.warn('[webhook:pg] WA alert failed:', err.message));
      }

      return c.json({ received: true, action: 'mandate_revoked', outletId: outlet.id });
    }

    return c.json({ received: true, unhandledEvent: event });
  } finally {
    await close();
  }
});

export { app as webhookRoutes };
