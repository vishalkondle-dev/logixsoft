import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { paymentOrder, pgCredential, pgProviderCredential, apiKey, merchantWebhook } from '../db/schema';
import type { Database } from '../db';
import type { betterAuth } from 'better-auth';
import crypto from 'node:crypto';

export function createMerchantRouter(
  getDb: (c?: any) => { db: Database; close: () => Promise<void> },
  getAuth: (c?: any) => any
) {
  const router = new Hono();

  // Helper to extract session or fallback
  async function getMerchantUser(c: any) {
    try {
      const { auth } = getAuth(c);
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (session?.user) {
        return session.user;
      }
    } catch {
      // session lookup fallback
    }

    // Default merchant for local testing / unauthenticated admin
    return {
      id: 'default-merchant',
      name: 'Demo Merchant',
      email: 'merchant@logixsoft.in',
    };
  }

  // 1. Dashboard Stats (metrics & totals)
  router.get('/stats', async (c) => {
    const user = await getMerchantUser(c);
    const { db, close } = getDb(c);

    try {
      const orders = await db
        .select()
        .from(paymentOrder)
        .where(eq(paymentOrder.merchantId, user.id));

      let totalRevenuePaise = 0;
      let todayRevenuePaise = 0;
      let successOrdersCount = 0;
      let failedOrdersCount = 0;
      let pendingOrdersCount = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const order of orders) {
        if (order.status === 'SUCCESS') {
          totalRevenuePaise += order.amount;
          successOrdersCount++;
          if (order.paidAt && new Date(order.paidAt) >= today) {
            todayRevenuePaise += order.amount;
          }
        } else if (order.status === 'FAILED') {
          failedOrdersCount++;
        } else if (order.status === 'PENDING') {
          pendingOrdersCount++;
        }
      }

      const totalOrdersCount = orders.length;
      const successRatePercentage =
        totalOrdersCount > 0 ? Math.round((successOrdersCount / totalOrdersCount) * 100) : 100;

      // Active gateway provider
      const creds = await db
        .select()
        .from(pgProviderCredential)
        .where(and(eq(pgProviderCredential.userId, user.id), eq(pgProviderCredential.isActive, true)))
        .limit(1);

      const activeProvider = creds[0]?.provider || 'MOCK';

      return c.json({
        totalRevenuePaise,
        todayRevenuePaise,
        totalOrdersCount,
        successOrdersCount,
        failedOrdersCount,
        pendingOrdersCount,
        successRatePercentage,
        activeProvider,
      });
    } catch (err: any) {
      console.error('[pg-api] get stats error:', err);
      return c.json({ error: 'Failed to retrieve stats' }, 500);
    } finally {
      await close();
    }
  });

  // 2. Paginated Transactions List
  router.get('/transactions', async (c) => {
    const user = await getMerchantUser(c);
    const { db, close } = getDb(c);

    try {
      const statusFilter = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);

      let query = db
        .select()
        .from(paymentOrder)
        .where(eq(paymentOrder.merchantId, user.id))
        .orderBy(desc(paymentOrder.createdAt))
        .limit(limit);

      const records = await query;

      const filtered = statusFilter && statusFilter !== 'ALL'
        ? records.filter((r) => r.status === statusFilter)
        : records;

      return c.json({
        transactions: filtered.map((t) => ({
          ...t,
          amountRupees: (t.amount / 100).toFixed(2),
        })),
      });
    } catch (err: any) {
      console.error('[pg-api] get transactions error:', err);
      return c.json({ error: 'Failed to retrieve transactions' }, 500);
    } finally {
      await close();
    }
  });

  // 3. Get Gateway Credentials (normalized per provider: Paytm, Mock)
  router.get('/credentials', async (c) => {
    const user = await getMerchantUser(c);
    const { db, close } = getDb(c);

    try {
      const providerRows = await db
        .select()
        .from(pgProviderCredential)
        .where(eq(pgProviderCredential.userId, user.id));

      const paytmRow = providerRows.find((r) => r.provider === 'PAYTM');
      const mockRow = providerRows.find((r) => r.provider === 'MOCK');
      const activeRow = providerRows.find((r) => r.isActive) || mockRow || providerRows[0];

      const activeProvider = activeRow?.provider || 'MOCK';
      const apiUrl = process.env.API_URL || 'https://pg-api.logixsoft.in';
      const paytmCreds = (paytmRow?.credentials as any) || {};

      return c.json({
        activeProvider,
        paytm: {
          isActive: activeProvider === 'PAYTM',
          merchantName: paytmRow?.merchantName || 'Logix Software Solutions',
          vpa: paytmRow?.vpa || '',
          merchantId: paytmRow?.merchantId || '',
          merchantKey: paytmCreds.merchantKey || '',
          website: paytmCreds.website || 'DEFAULT',
          env: paytmCreds.env || 'PROD',
          webhookUrl: `${apiUrl}/api/v1/webhooks/paytm`,
        },
        mock: {
          isActive: activeProvider === 'MOCK',
          merchantName: mockRow?.merchantName || 'Demo Merchant Store',
          vpa: mockRow?.vpa || 'merchant@upi',
        },
        // Flat compatibility fields for legacy consumers
        paytmMerchantId: paytmRow?.merchantId || '',
        paytmMerchantKey: paytmCreds.merchantKey || '',
        paytmWebsite: paytmCreds.website || 'DEFAULT',
        paytmEnv: paytmCreds.env || 'PROD',
        paytmVpa: paytmRow?.vpa || '',
        paytmMerchantName: paytmRow?.merchantName || 'Logix Software Solutions',
        mockVpa: mockRow?.vpa || 'merchant@upi',
        mockMerchantName: mockRow?.merchantName || 'Demo Merchant Store',
        vpa: activeRow?.vpa || 'merchant@upi',
        merchantName: activeRow?.merchantName || 'Logixsoft Merchant',
        paytmWebhookUrl: `${apiUrl}/api/v1/webhooks/paytm`,
      });
    } catch (err: any) {
      console.error('[pg-api] get credentials error:', err);
      return c.json({ error: 'Failed to retrieve credentials' }, 500);
    } finally {
      await close();
    }
  });

  // 4. Update Gateway Credentials (upserts per-provider accounts)
  router.put('/credentials', async (c) => {
    const user = await getMerchantUser(c);
    const body = await c.req.json().catch(() => ({}));
    const { db, close } = getDb(c);

    try {
      const activeProvider = body.activeProvider || 'MOCK';

      // 1. Resolve Paytm fields (from nested paytm object or flat fallback)
      const paytmData = body.paytm || {};
      const paytmMerchantId = paytmData.merchantId ?? body.paytmMerchantId ?? null;
      const paytmMerchantKey = paytmData.merchantKey ?? body.paytmMerchantKey ?? null;
      const paytmWebsite = paytmData.website ?? body.paytmWebsite ?? 'DEFAULT';
      const paytmEnv = paytmData.env ?? body.paytmEnv ?? 'PROD';
      const paytmVpa = paytmData.vpa ?? body.paytmVpa ?? (activeProvider === 'PAYTM' ? body.vpa : null);
      const paytmMerchantName = paytmData.merchantName ?? body.paytmMerchantName ?? (activeProvider === 'PAYTM' ? body.merchantName : 'Logix Software Solutions');

      // 2. Resolve Mock fields (from nested mock object or flat fallback)
      const mockData = body.mock || {};
      const mockVpa = mockData.vpa ?? body.mockVpa ?? (activeProvider === 'MOCK' ? body.vpa : 'merchant@upi');
      const mockMerchantName = mockData.merchantName ?? body.mockMerchantName ?? (activeProvider === 'MOCK' ? body.merchantName : 'Demo Merchant Store');

      // Fetch existing provider accounts for user
      const existingProviders = await db
        .select()
        .from(pgProviderCredential)
        .where(eq(pgProviderCredential.userId, user.id));

      const existingPaytm = existingProviders.find((p) => p.provider === 'PAYTM');
      const existingMock = existingProviders.find((p) => p.provider === 'MOCK');

      // Upsert Paytm provider account
      const paytmCredsRecord = {
        userId: user.id,
        provider: 'PAYTM',
        isActive: activeProvider === 'PAYTM',
        merchantName: paytmMerchantName || 'Logix Software Solutions',
        vpa: paytmVpa,
        merchantId: paytmMerchantId,
        credentials: {
          merchantKey: paytmMerchantKey,
          website: paytmWebsite,
          env: paytmEnv,
        },
        updatedAt: new Date(),
      };

      if (existingPaytm) {
        await db
          .update(pgProviderCredential)
          .set(paytmCredsRecord)
          .where(eq(pgProviderCredential.id, existingPaytm.id));
      } else {
        await db.insert(pgProviderCredential).values({
          id: `ppc_paytm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...paytmCredsRecord,
          createdAt: new Date(),
        });
      }

      // Upsert Mock provider account
      const mockCredsRecord = {
        userId: user.id,
        provider: 'MOCK',
        isActive: activeProvider === 'MOCK',
        merchantName: mockMerchantName || 'Demo Merchant Store',
        vpa: mockVpa || 'merchant@upi',
        merchantId: 'MOCK_MERCHANT',
        credentials: {},
        updatedAt: new Date(),
      };

      if (existingMock) {
        await db
          .update(pgProviderCredential)
          .set(mockCredsRecord)
          .where(eq(pgProviderCredential.id, existingMock.id));
      } else {
        await db.insert(pgProviderCredential).values({
          id: `ppc_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...mockCredsRecord,
          createdAt: new Date(),
        });
      }

      // Also maintain legacy pg_credential row for backwards compatibility
      const existingLegacy = await db
        .select()
        .from(pgCredential)
        .where(eq(pgCredential.userId, user.id))
        .limit(1);

      const legacyUpdate = {
        activeProvider,
        paytmMerchantId,
        paytmMerchantKey,
        paytmWebsite,
        paytmEnv,
        vpa: activeProvider === 'PAYTM' ? paytmVpa : mockVpa,
        merchantName: activeProvider === 'PAYTM' ? paytmMerchantName : mockMerchantName,
        updatedAt: new Date(),
      };

      if (existingLegacy.length > 0) {
        await db
          .update(pgCredential)
          .set(legacyUpdate)
          .where(eq(pgCredential.id, existingLegacy[0].id));
      } else {
        await db.insert(pgCredential).values({
          id: `cred_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: user.id,
          ...legacyUpdate,
          createdAt: new Date(),
        });
      }

      return c.json({ success: true, message: 'Gateway settings updated successfully' });
    } catch (err: any) {
      console.error('[pg-api] update credentials error:', err);
      return c.json({ error: 'Failed to update credentials' }, 500);
    } finally {
      await close();
    }
  });

  // 5. Get Developer API Keys
  router.get('/api-keys', async (c) => {
    const user = await getMerchantUser(c);
    const { db, close } = getDb(c);

    try {
      const keys = await db
        .select()
        .from(apiKey)
        .where(eq(apiKey.merchantId, user.id))
        .orderBy(desc(apiKey.createdAt));

      return c.json({
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          maskedKey: `${k.key.substring(0, 7)}...${k.key.substring(k.key.length - 4)}`,
          key: k.key,
          lastUsedAt: k.lastUsedAt,
          createdAt: k.createdAt,
        })),
      });
    } catch (err: any) {
      console.error('[pg-api] get api-keys error:', err);
      return c.json({ error: 'Failed to retrieve API keys' }, 500);
    } finally {
      await close();
    }
  });

  // 6. Generate New API Key
  router.post('/api-keys', async (c) => {
    const user = await getMerchantUser(c);
    const body = await c.req.json().catch(() => ({}));
    const { db, close } = getDb(c);

    try {
      const newKey = `pg_live_${Array.from(crypto.randomBytes(24))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`;
      const record = {
        id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        merchantId: user.id,
        name: body.name || 'Default API Key',
        key: newKey,
        createdAt: new Date(),
      };

      await db.insert(apiKey).values(record);

      return c.json({
        success: true,
        key: record,
      });
    } catch (err: any) {
      console.error('[pg-api] create api-key error:', err);
      return c.json({ error: 'Failed to create API key' }, 500);
    } finally {
      await close();
    }
  });

  // 7. Revoke API Key
  router.delete('/api-keys/:id', async (c) => {
    const id = c.req.param('id');
    const user = await getMerchantUser(c);
    const { db, close } = getDb(c);

    try {
      await db
        .delete(apiKey)
        .where(eq(apiKey.id, id));

      return c.json({ success: true, message: 'API key revoked' });
    } catch (err: any) {
      console.error('[pg-api] delete api-key error:', err);
      return c.json({ error: 'Failed to revoke API key' }, 500);
    } finally {
      await close();
    }
  });

  // 8. Get Webhook Settings
  router.get('/webhook', async (c) => {
    const user = await getMerchantUser(c);
    const { db, close } = getDb(c);

    try {
      const rows = await db
        .select()
        .from(merchantWebhook)
        .where(eq(merchantWebhook.merchantId, user.id))
        .limit(1);

      if (rows.length === 0) {
        return c.json({ success: true, webhook: null });
      }

      return c.json({
        success: true,
        webhook: {
          id: rows[0].id,
          url: rows[0].url,
          secret: rows[0].secret,
          isActive: rows[0].isActive,
          createdAt: rows[0].createdAt,
          updatedAt: rows[0].updatedAt,
        },
      });
    } catch (err: any) {
      console.error('[pg-api] get webhook error:', err);
      return c.json({ error: 'Failed to retrieve webhook configuration' }, 500);
    } finally {
      await close();
    }
  });

  // 9. Save / Update Webhook Settings
  router.post('/webhook', async (c) => {
    const user = await getMerchantUser(c);
    const body = await c.req.json().catch(() => ({}));
    const { db, close } = getDb(c);

    try {
      const url = (body.url || '').trim();
      if (!url) {
        return c.json({ error: 'Webhook URL is required' }, 400);
      }

      const existing = await db
        .select()
        .from(merchantWebhook)
        .where(eq(merchantWebhook.merchantId, user.id))
        .limit(1);

      const newSecret = `whsec_${Array.from(crypto.randomBytes(24))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`;

      if (existing.length === 0) {
        const record = {
          id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          merchantId: user.id,
          url,
          secret: newSecret,
          isActive: body.isActive !== false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await db.insert(merchantWebhook).values(record);
        return c.json({ success: true, webhook: record });
      } else {
        const secret = body.regenerateSecret ? newSecret : existing[0].secret;
        await db
          .update(merchantWebhook)
          .set({
            url,
            secret,
            isActive: body.isActive !== false,
            updatedAt: new Date(),
          })
          .where(eq(merchantWebhook.id, existing[0].id));

        return c.json({
          success: true,
          webhook: {
            ...existing[0],
            url,
            secret,
            isActive: body.isActive !== false,
            updatedAt: new Date(),
          },
        });
      }
    } catch (err: any) {
      console.error('[pg-api] save webhook error:', err);
      return c.json({ error: 'Failed to save webhook' }, 500);
    } finally {
      await close();
    }
  });

  // 10. Test Webhook Ping
  router.post('/webhook/test', async (c) => {
    const user = await getMerchantUser(c);
    const body = await c.req.json().catch(() => ({}));
    const { db, close } = getDb(c);

    try {
      let targetUrl = (body.url || '').trim();
      let secret = body.secret;

      if (!targetUrl) {
        const existing = await db
          .select()
          .from(merchantWebhook)
          .where(eq(merchantWebhook.merchantId, user.id))
          .limit(1);
        if (existing.length > 0) {
          targetUrl = existing[0].url;
          secret = existing[0].secret;
        }
      }

      if (!targetUrl) {
        return c.json({ error: 'No webhook URL provided or configured' }, 400);
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const testPayload = JSON.stringify({
        event: 'webhook.test_ping',
        timestamp,
        data: {
          message: 'Logixsoft Webhook ping verification',
          merchantId: user.id,
          gatewayStatus: 'HEALTHY',
          testOrderId: `ORD_TEST_${Date.now()}`,
          amount: 50000,
          currency: 'INR',
        },
      });

      const signature = crypto
        .createHmac('sha256', secret || 'test_secret')
        .update(`${timestamp}.${testPayload}`)
        .digest('hex');

      const startTime = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      try {
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Logixsoft-Webhook-Dispatcher/1.0',
            'x-logixsoft-timestamp': String(timestamp),
            'x-logixsoft-signature': `t=${timestamp},v1=${signature}`,
          },
          body: testPayload,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const durationMs = Date.now() - startTime;
        const text = await res.text().catch(() => '');

        return c.json({
          success: res.ok,
          httpStatus: res.status,
          durationMs,
          responseSnippet: text.slice(0, 200),
          message: res.ok
            ? `Webhook delivered successfully in ${durationMs}ms (HTTP ${res.status})`
            : `Webhook returned HTTP ${res.status}`,
        });
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        return c.json({
          success: false,
          error: fetchErr.name === 'AbortError' ? 'Connection timed out after 7s' : fetchErr.message,
        }, 502);
      }
    } catch (err: any) {
      console.error('[pg-api] test webhook error:', err);
      return c.json({ error: 'Failed to test webhook' }, 500);
    } finally {
      await close();
    }
  });

  return router;
}
