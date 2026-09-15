import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { merchantWebhook } from '../db/schema';
import type { Database } from '../db';

export async function dispatchMerchantWebhook({
  db,
  merchantId,
  event,
  data,
}: {
  db: Database;
  merchantId: string;
  event: string;
  data: any;
}) {
  try {
    const webhookRows = await db
      .select()
      .from(merchantWebhook)
      .where(eq(merchantWebhook.merchantId, merchantId))
      .limit(1);

    if (webhookRows.length === 0 || !webhookRows[0].isActive || !webhookRows[0].url) {
      return null;
    }

    const { url, secret } = webhookRows[0];
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

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Logixsoft-Webhook-Dispatcher/1.0',
        'x-logixsoft-timestamp': String(timestamp),
        'x-logixsoft-signature': `t=${timestamp},v1=${signature}`,
      },
      body: payload,
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timeout);
        console.log(`[pg-api] Dispatched webhook to ${url} - HTTP status: ${res.status}`);
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.warn(`[pg-api] Failed to dispatch webhook to ${url}:`, err.message);
      });

    return { url, timestamp, signature };
  } catch (err) {
    console.error('[pg-api] webhook dispatch error:', err);
    return null;
  }
}
