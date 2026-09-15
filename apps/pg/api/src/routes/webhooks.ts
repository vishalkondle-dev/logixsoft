import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { paymentOrder, pgCredential, webhookLog } from '../db/schema';
import type { Database } from '../db';
import { verifyPaytmChecksum } from '../gateways/paytm';
import { dispatchMerchantWebhook } from '../lib/webhook-dispatcher';

export function createWebhooksRouter(getDb: (c?: any) => { db: Database; close: () => Promise<void> }) {
  const router = new Hono();

  // 2. Paytm Server-to-Server Webhook
  router.post('/paytm', async (c) => {
    const rawBody = await c.req.text();
    const { db, close } = getDb(c);

    try {
      let body: any = {};
      try {
        body = JSON.parse(rawBody);
      } catch {
        try {
          body = Object.fromEntries(new URLSearchParams(rawBody));
        } catch { }
      }

      // Check nested body if present
      const data = body.body || body;
      const orderId =
        data.ORDERID ||
        data.orderId ||
        data.order_id ||
        data.merchantTransactionId ||
        data.tr ||
        data.merchtxnid;

      const isSuccess =
        data.STATUS === 'TXN_SUCCESS' ||
        data.status === 'TXN_SUCCESS' ||
        data.resultInfo?.resultStatus === 'TXN_SUCCESS' ||
        data.resultInfo?.resultStatus === 'S' ||
        data.RESPCODE === '01' ||
        data.respcode === '01' ||
        data.status === 'SUCCESS';

      const isFailure =
        data.STATUS === 'TXN_FAILURE' ||
        data.status === 'TXN_FAILURE' ||
        data.resultInfo?.resultStatus === 'TXN_FAILURE' ||
        data.resultInfo?.resultStatus === 'F' ||
        data.status === 'FAILED';

      const status = isSuccess ? 'SUCCESS' : isFailure ? 'FAILED' : 'PENDING';
      const bankTxnId =
        data.BANKTXNID ||
        data.bankTxnId ||
        data.bankTransactionId ||
        data.utr ||
        data.UTR ||
        data.rrn ||
        data.RRN;
      const txnId = data.TXNID || data.txnId || data.transactionId;

      await db.insert(webhookLog).values({
        id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        provider: 'PAYTM',
        orderId: orderId || null,
        payload: rawBody,
        headers: JSON.stringify(c.req.header()),
        status: 'PROCESSED',
      });

      if (orderId) {
        const existing = await db
          .select()
          .from(paymentOrder)
          .where(eq(paymentOrder.orderId, orderId))
          .limit(1);

        if (existing.length > 0 && existing[0].status !== 'SUCCESS') {
          await db
            .update(paymentOrder)
            .set({
              status,
              bankReferenceNo: bankTxnId || null,
              providerReferenceId: txnId || existing[0].providerReferenceId,
              paidAt: status === 'SUCCESS' ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(paymentOrder.id, existing[0].id));

          if (status === 'SUCCESS') {
            await dispatchMerchantWebhook({
              db,
              merchantId: existing[0].merchantId,
              event: 'payment.success',
              data: {
                orderId,
                amount: existing[0].amount,
                currency: existing[0].currency,
                status: 'SUCCESS',
                bankReferenceNo: bankTxnId || null,
                provider: 'PAYTM',
                customerName: existing[0].customerName,
                customerEmail: existing[0].customerEmail,
                customerPhone: existing[0].customerPhone,
                paidAt: new Date().toISOString(),
                metadata: existing[0].metadata ? JSON.parse(existing[0].metadata) : null,
              },
            });
          }
        }
      }

      return c.json({ success: true, message: 'Paytm webhook processed', status, orderId });
    } catch (err: any) {
      console.error('[pg-api] Paytm webhook error:', err);
      return c.json({ error: 'Webhook processing failed' }, 500);
    } finally {
      await close();
    }
  });

  return router;
}

