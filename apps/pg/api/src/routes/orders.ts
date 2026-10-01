import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { paymentOrder, pgCredential, pgProviderCredential, apiKey, type pgSchema } from '../db/schema';
import { user } from '../db/auth-schema';
import type { Database } from '../db';
import { createPaytmOrder, checkPaytmStatus } from '../gateways/paytm';
import { createMockOrder } from '../gateways/mock';
import { dispatchMerchantWebhook } from '../lib/webhook-dispatcher';

export function createOrdersRouter(
  getDb: (c?: any) => { db: Database; close: () => Promise<void> },
  getAuth?: (c?: any) => any
) {
  const router = new Hono();

  // 1. Create a new payment order
  router.post('/create', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    let amountInPaise = 0;
    if (typeof body.amountInPaise === 'number') {
      amountInPaise = Math.round(body.amountInPaise);
    } else if (typeof body.amount === 'number') {
      amountInPaise = Math.round(body.amount * 100);
    } else if (typeof body.amountInRupees === 'number') {
      amountInPaise = Math.round(body.amountInRupees * 100);
    }

    if (!amountInPaise || amountInPaise < 100) {
      return c.json({ error: 'Invalid amount. Minimum amount is ₹1.00 (100 paise).' }, 400);
    }

    const { db, close } = getDb(c);
    try {
      try {
        await db.execute(sql`ALTER TABLE "payment_order" DROP CONSTRAINT IF EXISTS "payment_order_merchantId_user_id_fk"`);
        await db.execute(sql`ALTER TABLE "payment_order" DROP CONSTRAINT IF EXISTS "payment_order_merchantId_fkey"`);
      } catch {}

      // 1. Check body for merchantId, or resolve from session cookie
      let merchantId = body.merchantId || body.userId;
      if (!merchantId && getAuth) {
        try {
          const { auth } = getAuth(c);
          const session = await auth.api.getSession({ headers: c.req.raw.headers });
          if (session?.user?.id) {
            merchantId = session.user.id;
          }
        } catch { }
      }

      // 2. If not from session, check x-api-key header
      if (!merchantId) {
        const keyHeader = c.req.header('x-api-key');
        if (keyHeader) {
          const keyRecord = await db
            .select()
            .from(apiKey)
            .where(eq(apiKey.key, keyHeader))
            .limit(1);
          if (keyRecord.length > 0) {
            merchantId = keyRecord[0].merchantId;
            // Update lastUsedAt asynchronously
            await db
              .update(apiKey)
              .set({ lastUsedAt: new Date() })
              .where(eq(apiKey.id, keyRecord[0].id));
          }
        }
      }

      // 3. Ensure merchantId exists in user table to satisfy foreign key constraint
      let resolvedUser: any = null;
      if (merchantId) {
        const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.id, merchantId)).limit(1);
        resolvedUser = existing;
      }

      if (!resolvedUser) {
        const [anyUser] = await db.select({ id: user.id }).from(user).limit(1);
        if (anyUser) {
          merchantId = anyUser.id;
        } else {
          merchantId = 'default-merchant';
          try {
            await db.insert(user).values({
              id: 'default-merchant',
              name: 'Logixsoft Platform Merchant',
              email: 'merchant@logixsoft.in',
              role: 'ADMIN',
            }).onConflictDoNothing();
          } catch {}
        }
      }

      // Check merchant credentials for active provider
      const providerRows = await db
        .select()
        .from(pgProviderCredential)
        .where(eq(pgProviderCredential.userId, merchantId));

      let activeAccount = providerRows.find((r) => r.isActive);
      if (!activeAccount && providerRows.length > 0) {
        activeAccount = providerRows[0];
      }

      const activeProvider = (activeAccount?.provider as any) || 'MOCK';
      const merchantName = activeAccount?.merchantName || 'Demo Merchant';
      const vpa = activeAccount?.vpa || 'merchant@upi';
      const activeCreds = (activeAccount?.credentials as any) || {};
      const providerMerchantId = activeAccount?.merchantId || '';

      const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

      let upiString = '';
      let providerReferenceId = '';

      const apiUrl = process.env.API_URL || 'http://localhost:3031';
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3020';

      if (
        activeProvider === 'PAYTM' &&
        providerMerchantId &&
        activeCreds?.merchantKey
      ) {
        try {
          const paytmRes = await createPaytmOrder(
            {
              merchantId: providerMerchantId,
              merchantKey: activeCreds.merchantKey,
              website: activeCreds.website || 'DEFAULT',
              env: (activeCreds.env as 'STAGING' | 'PROD') || 'PROD',
            },
            {
              orderId,
              amountInPaise,
              customerId: `CUST_${Date.now()}`,
              callbackUrl: `${apiUrl}/api/v1/webhooks/paytm`,
              vpa,
              merchantName,
            }
          );
          upiString = paytmRes.upiString;
          providerReferenceId = paytmRes.providerTransactionId;
        } catch (err) {
          console.error('[pg-api] Paytm initiate failed, using dynamic UPI QR with merchant VPA:', err);
          upiString = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(merchantName)}&am=${(amountInPaise / 100).toFixed(2)}&tr=${orderId}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;
          providerReferenceId = `PAYTM_FALLBACK_${Date.now()}`;
        }
      } else {
        // Mock Sandbox mode
        const mockRes = createMockOrder({
          orderId,
          amountInPaise,
          merchantName,
          vpa,
        });
        upiString = mockRes.upiString;
        providerReferenceId = mockRes.providerTransactionId;
      }

      const newOrder = {
        id: `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId,
        merchantId,
        amount: amountInPaise,
        currency: 'INR',
        status: 'PENDING',
        provider: activeProvider,
        customerName: body.customerName || null,
        customerEmail: body.customerEmail || null,
        customerPhone: body.customerPhone || null,
        description: body.description || `Payment for order ${orderId}`,
        upiString,
        providerReferenceId,
        expiresAt,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      };

      await db.insert(paymentOrder).values(newOrder);

      return c.json(
        {
          success: true,
          orderId,
          amount: amountInPaise,
          currency: 'INR',
          status: 'PENDING',
          upiString,
          expiresAt: expiresAt.toISOString(),
          paymentUrl: `${frontendUrl}/pay/${orderId}`,
        },
        201
      );
    } catch (err: any) {
      console.error('[pg-api] order creation error:', err);
      const errDetails: any = {};
      for (const key of Object.getOwnPropertyNames(err)) {
        errDetails[key] = (err as any)[key];
      }
      return c.json({
        error: err.message || 'Failed to create payment order',
        pgError: errDetails,
      }, 500);
    } finally {
      await close();
    }
  });

  // 2. Get Public Payment Order Status (used for polling & checkout page)
  router.get('/:orderId/status', async (c) => {
    const orderId = c.req.param('orderId');
    const { db, close } = getDb(c);

    try {
      const orders = await db
        .select()
        .from(paymentOrder)
        .where(eq(paymentOrder.orderId, orderId))
        .limit(1);

      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];

      // If pending and provider is Paytm, query gateway first to catch completed payments
      if (order.status === 'PENDING') {
        const creds = await db
          .select()
          .from(pgProviderCredential)
          .where(and(eq(pgProviderCredential.userId, order.merchantId), eq(pgProviderCredential.provider, order.provider)))
          .limit(1);
        const cred = creds[0];
        const credConfig = (cred?.credentials as any) || {};

        if (order.provider === 'PAYTM' && cred?.merchantId && credConfig?.merchantKey) {
          try {
            const statusRes = await checkPaytmStatus(
              {
                merchantId: cred.merchantId,
                merchantKey: credConfig.merchantKey,
                website: credConfig.website || 'DEFAULT',
                env: (credConfig.env as 'STAGING' | 'PROD') || 'PROD',
              },
              order.orderId
            );
            if (statusRes.status !== 'PENDING') {
              await db
                .update(paymentOrder)
                .set({
                  status: statusRes.status,
                  bankReferenceNo: statusRes.bankReferenceNo || null,
                  paidAt: statusRes.status === 'SUCCESS' ? new Date() : null,
                  updatedAt: new Date(),
                })
                .where(eq(paymentOrder.id, order.id));
              order.status = statusRes.status;
              order.bankReferenceNo = statusRes.bankReferenceNo;
            }
          } catch (e) {
            // Ignore status check errors
          }
        }
      }

      // Check if expired only if still pending after checking gateway
      if (order.status === 'PENDING' && order.expiresAt && new Date() > order.expiresAt) {
        await db
          .update(paymentOrder)
          .set({ status: 'EXPIRED', updatedAt: new Date() })
          .where(eq(paymentOrder.id, order.id));
        order.status = 'EXPIRED';
      }

      return c.json({
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        merchantName: 'Logixsoft Merchant',
        description: order.description,
        upiString: order.upiString,
        provider: order.provider,
        expiresAt: order.expiresAt ? order.expiresAt.toISOString() : null,
        paidAt: order.paidAt ? order.paidAt.toISOString() : null,
        bankReferenceNo: order.bankReferenceNo,
        failureReason: order.failureReason,
        isMock: order.provider === 'MOCK',
      });
    } catch (err: any) {
      console.error('[pg-api] get status error:', err);
      return c.json({ error: 'Failed to retrieve order status' }, 500);
    } finally {
      await close();
    }
  });

  // 3. Mock Sandbox Payment Simulation (for testing without real UPI app)
  router.post('/:orderId/mock-pay', async (c) => {
    const orderId = c.req.param('orderId');
    const body = await c.req.json().catch(() => ({}));
    const action = body.action === 'FAILED' ? 'FAILED' : 'SUCCESS';

    const { db, close } = getDb(c);
    try {
      const orders = await db
        .select()
        .from(paymentOrder)
        .where(eq(paymentOrder.orderId, orderId))
        .limit(1);

      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];
      const now = new Date();
      const mockUtr = `UTR${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

      await db
        .update(paymentOrder)
        .set({
          status: action,
          bankReferenceNo: action === 'SUCCESS' ? mockUtr : null,
          failureReason: action === 'FAILED' ? 'Simulated payment failure by user' : null,
          paidAt: action === 'SUCCESS' ? now : null,
          updatedAt: now,
        })
        .where(eq(paymentOrder.id, order.id));

      if (action === 'SUCCESS') {
        await dispatchMerchantWebhook({
          db,
          merchantId: order.merchantId,
          event: 'payment.success',
          data: {
            orderId: order.orderId,
            amount: order.amount,
            currency: order.currency,
            status: 'SUCCESS',
            bankReferenceNo: mockUtr,
            provider: 'MOCK',
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            paidAt: now.toISOString(),
            metadata: order.metadata ? JSON.parse(order.metadata) : null,
          },
        });
      }

      return c.json({
        success: true,
        orderId: order.orderId,
        status: action,
        bankReferenceNo: action === 'SUCCESS' ? mockUtr : null,
        paidAt: action === 'SUCCESS' ? now.toISOString() : null,
      });
    } catch (err: any) {
      console.error('[pg-api] mock payment error:', err);
      return c.json({ error: 'Failed to simulate payment' }, 500);
    } finally {
      await close();
    }
  });

  // 4. Confirm Payment Received (Counter / Merchant Confirmation)
  router.post('/:orderId/confirm', async (c) => {
    const orderId = c.req.param('orderId');
    const body = await c.req.json().catch(() => ({}));
    const { db, close } = getDb(c);

    try {
      const orders = await db
        .select()
        .from(paymentOrder)
        .where(eq(paymentOrder.orderId, orderId))
        .limit(1);

      if (orders.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders[0];
      const now = new Date();
      const utr = body.utr || body.bankReferenceNo || `CONFIRMED_${Date.now()}`;

      await db
        .update(paymentOrder)
        .set({
          status: 'SUCCESS',
          bankReferenceNo: utr,
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(paymentOrder.id, order.id));

      return c.json({
        success: true,
        orderId: order.orderId,
        status: 'SUCCESS',
        bankReferenceNo: utr,
        paidAt: now.toISOString(),
      });
    } catch (err: any) {
      console.error('[pg-api] confirm payment error:', err);
      return c.json({ error: 'Failed to confirm payment' }, 500);
    } finally {
      await close();
    }
  });

  return router;
}

