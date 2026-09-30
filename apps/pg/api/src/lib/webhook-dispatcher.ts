import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { merchantWebhook } from '../db/schema';
import type { Database } from '../db';

export async function dispatchMerchantWebhook({
  db,
  merchantId,
  event,
  data,
  targetUrl,
  env,
}: {
  db: Database;
  merchantId: string;
  event: string;
  data: any;
  targetUrl?: string;
  env?: any;
}) {
  try {
    // 1. Direct sync to restaurantOutlet in shared DB if metadata has outletId
    const outletId = data?.metadata?.outletId;
    if (outletId && db) {
      try {
        const now = new Date();
        if (event === 'mandate.activated') {
          const nextBilling = data.nextBillingDate
            ? new Date(data.nextBillingDate)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const planTier = data.metadata?.planTier || 'PRO';
          const billingCycle = data.metadata?.billingCycle || 'MONTHLY';

          await db.execute(sql`
            UPDATE "restaurantOutlet"
            SET "autopayStatus" = 'ACTIVE',
                "autopayMandateId" = ${data.mandateId},
                "autopayUmn" = ${data.umn},
                "autopayNextBillingAt" = ${nextBilling},
                "subscriptionExpiresAt" = ${nextBilling},
                "planTier" = ${planTier},
                "billingCycle" = ${billingCycle},
                "status" = 'ACTIVE',
                "updatedAt" = ${now}
            WHERE "id" = ${outletId}
          `);
          console.log(`[pg-api] Directly synced outlet ${outletId} in shared DB to ACTIVE`);
        } else if (event === 'mandate.debited') {
          const nextBilling = data.nextBillingDate
            ? new Date(data.nextBillingDate)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          await db.execute(sql`
            UPDATE "restaurantOutlet"
            SET "subscriptionExpiresAt" = ${nextBilling},
                "autopayNextBillingAt" = ${nextBilling},
                "status" = 'ACTIVE',
                "updatedAt" = ${now}
            WHERE "id" = ${outletId}
          `);
          console.log(`[pg-api] Directly extended outlet ${outletId} in shared DB`);
        } else if (event === 'mandate.revoked') {
          await db.execute(sql`
            UPDATE "restaurantOutlet"
            SET "autopayStatus" = 'REVOKED',
                "autopayMandateId" = NULL,
                "autopayUmn" = NULL,
                "autopayNextBillingAt" = NULL,
                "updatedAt" = ${now}
            WHERE "id" = ${outletId}
          `);
          console.log(`[pg-api] Directly revoked outlet ${outletId} in shared DB`);
        }
      } catch (dbSyncErr: any) {
        console.warn('[pg-api] Direct outlet DB sync notice:', dbSyncErr.message);
      }
    }

    // 2. Dispatch HTTP Webhook
    let url = targetUrl || data?.metadata?.webhookUrl;
    let secret = 'logix_default_webhook_secret';

    const webhookRows = await db
      .select()
      .from(merchantWebhook)
      .where(eq(merchantWebhook.merchantId, merchantId))
      .limit(1);

    if (webhookRows.length > 0 && webhookRows[0].isActive && webhookRows[0].url) {
      url = webhookRows[0].url;
      secret = webhookRows[0].secret;
    }

    if (!url) {
      return { directDbSync: true };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      event,
      timestamp,
      data,
    });

    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    let webhookStatus: number | null = null;
    let webhookError: string | null = null;
    let responseText: string | null = null;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Logixsoft-Webhook-Dispatcher/1.0',
        'x-logixsoft-timestamp': String(timestamp),
        'x-logixsoft-signature': `t=${timestamp},v1=${signature}`,
      };

      let res: Response;
      if (env?.DINE_API && url.includes('dine-api.logixsoft.in')) {
        // Direct Service Binding call
        res = await env.DINE_API.fetch(new Request(url, {
          method: 'POST',
          headers,
          body: payload,
          signal: controller.signal,
        }));
      } else {
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: payload,
          signal: controller.signal,
        });
      }

      clearTimeout(timeout);
      webhookStatus = res.status;
      responseText = await res.text().catch(() => null);
      console.log(`[pg-api] Dispatched webhook to ${url} - HTTP status: ${res.status}`);
    } catch (err: any) {
      clearTimeout(timeout);
      webhookError = err.message;
      console.warn(`[pg-api] Failed to dispatch webhook to ${url}:`, err.message);
    }

    return {
      directDbSync: true,
      url,
      timestamp,
      signature,
      status: webhookStatus,
      error: webhookError,
      response: responseText,
    };
  } catch (err: any) {
    console.error('[pg-api] webhook dispatch error:', err);
    return { error: err?.message || 'Unknown dispatch error' };
  }
}
