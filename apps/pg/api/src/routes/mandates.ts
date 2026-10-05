import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { subscriptionMandate, subscriptionCharge, pgProviderCredential, apiKey, type pgSchema } from '../db/schema';
import type { Database } from '../db';
import { createMockMandate } from '../gateways/mock';
import { dispatchMerchantWebhook } from '../lib/webhook-dispatcher';

export function createMandatesRouter(
  getDb: (c?: any) => { db: Database; close: () => Promise<void> },
  getAuth?: (c?: any) => any
) {
  const router = new Hono();

  // Helper to resolve merchantId from API key or session
  async function resolveMerchant(c: any, db: Database): Promise<string | null> {
    const keyHeader = c.req.header('x-api-key');
    if (keyHeader) {
      const keyRecord = await db
        .select()
        .from(apiKey)
        .where(eq(apiKey.key, keyHeader))
        .limit(1);
      if (keyRecord.length > 0) {
        await db
          .update(apiKey)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKey.id, keyRecord[0].id));
        return keyRecord[0].merchantId;
      }
    }

    if (getAuth) {
      try {
        const { auth } = getAuth(c);
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        if (session?.user?.id) {
          return session.user.id;
        }
      } catch {}
    }

    return null;
  }

  // 1. Create a recurring UPI AutoPay mandate
  router.post('/create', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const customerPhone = body.customerPhone || body.phone;
    if (!customerPhone) {
      return c.json({ error: 'customerPhone is required for UPI AutoPay mandate' }, 400);
    }

    let recurringAmount = 0;
    if (typeof body.recurringAmount === 'number') {
      recurringAmount = Math.round(body.recurringAmount);
    } else if (typeof body.amountInPaise === 'number') {
      recurringAmount = Math.round(body.amountInPaise);
    } else if (typeof body.amount === 'number') {
      recurringAmount = Math.round(body.amount * 100);
    }

    if (!recurringAmount || recurringAmount < 100) {
      return c.json({ error: 'Invalid recurring amount. Minimum amount is ₹1.00 (100 paise).' }, 400);
    }

    const maxAmount = typeof body.maxAmount === 'number' ? Math.round(body.maxAmount) : 1500000; // default ₹15,000 cap
    const frequency = body.frequency || 'MONTHLY';
    const mandateName = body.mandateName || body.name || 'Logixsoft Subscription';

    const { db, close } = getDb(c);
    try {
      let merchantId = await resolveMerchant(c, db);
      if (!merchantId) {
        // Fallback to default or demo merchant
        merchantId = 'default-merchant';
      }

      // Check merchant credentials
      const providerRows = await db
        .select()
        .from(pgProviderCredential)
        .where(eq(pgProviderCredential.userId, merchantId));

      let activeAccount = providerRows.find((r) => r.isActive);
      if (!activeAccount && providerRows.length > 0) {
        activeAccount = providerRows[0];
      }

      const activeProvider = (activeAccount?.provider as any) || 'MOCK';
      const merchantName = activeAccount?.merchantName || 'Logixsoft Merchant';
      const vpa = activeAccount?.vpa || 'autopay@logixsoft';

      const mandateId = `MANDATE_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const internalId = `man_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Generate UPI AutoPay URI
      const mockResult = createMockMandate({
        mandateId,
        recurringAmountInPaise: recurringAmount,
        maxAmountInPaise: maxAmount,
        frequency,
        merchantName,
        vpa,
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://payment.logixsoft.in';
      const checkoutUrl = `${frontendUrl.replace(/\/+$/, '')}/mandate/${mandateId}`;

      const now = new Date();
      const metadataStr = body.metadata ? JSON.stringify(body.metadata) : null;

      await db.insert(subscriptionMandate).values({
        id: internalId,
        mandateId,
        merchantId,
        customerPhone,
        customerName: body.customerName || null,
        customerVpa: body.customerVpa || null,
        mandateName,
        maxAmount,
        recurringAmount,
        frequency,
        status: 'PENDING',
        provider: activeProvider,
        providerSubscriptionId: mockResult.providerSubscriptionId,
        upiString: mockResult.upiString,
        metadata: metadataStr,
        createdAt: now,
        updatedAt: now,
      });

      return c.json({
        success: true,
        mandateId,
        status: 'PENDING',
        upiString: mockResult.upiString,
        checkoutUrl,
        recurringAmount,
        maxAmount,
        frequency,
        mandateName,
      }, 201);
    } finally {
      await close();
    }
  });

  // 2. Get Mandate status
  router.get('/:id', async (c) => {
    const targetId = c.req.param('id');
    const { db, close } = getDb(c);
    try {
      const rows = await db
        .select()
        .from(subscriptionMandate)
        .where(eq(subscriptionMandate.mandateId, targetId))
        .limit(1);

      if (rows.length === 0) {
        return c.json({ error: 'Mandate not found' }, 404);
      }

      const m = rows[0];
      let metadata: any = null;
      if (m.metadata) {
        try {
          metadata = JSON.parse(m.metadata);
        } catch {}
      }

      return c.json({
        mandateId: m.mandateId,
        mandateName: m.mandateName,
        customerPhone: m.customerPhone,
        customerName: m.customerName,
        customerVpa: m.customerVpa,
        status: m.status,
        recurringAmount: m.recurringAmount,
        maxAmount: m.maxAmount,
        frequency: m.frequency,
        umn: m.umn,
        upiString: m.upiString,
        metadata,
        nextBillingDate: m.nextBillingDate,
        lastDebitedAt: m.lastDebitedAt,
        createdAt: m.createdAt,
      });
    } finally {
      await close();
    }
  });

  // 3. Simulate Mandate Authorization (Sandbox / Testing)
  router.post('/:id/simulate-authorize', async (c) => {
    const targetId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const customerVpa = body.customerVpa || 'customer@okhdfcbank';

    const { db, close } = getDb(c);
    try {
      const rows = await db
        .select()
        .from(subscriptionMandate)
        .where(eq(subscriptionMandate.mandateId, targetId))
        .limit(1);

      if (rows.length === 0) {
        return c.json({ error: 'Mandate not found' }, 404);
      }

      const m = rows[0];
      const now = new Date();
      const umn = `UMN_${m.mandateId.replace('MANDATE_', '')}_${Date.now()}@npci`;
      const nextBillingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await db
        .update(subscriptionMandate)
        .set({
          status: 'ACTIVE',
          umn,
          customerVpa,
          nextBillingDate,
          updatedAt: now,
        })
        .where(eq(subscriptionMandate.mandateId, targetId));

      let metadata: any = null;
      if (m.metadata) {
        try {
          metadata = JSON.parse(m.metadata);
        } catch {}
      }

      // Dispatch webhook event: mandate.activated
      const whResult = await dispatchMerchantWebhook({
        db,
        merchantId: m.merchantId,
        event: 'mandate.activated',
        data: {
          mandateId: m.mandateId,
          umn,
          status: 'ACTIVE',
          customerPhone: m.customerPhone,
          customerVpa,
          mandateName: m.mandateName,
          recurringAmount: m.recurringAmount,
          frequency: m.frequency,
          nextBillingDate: nextBillingDate.toISOString(),
          metadata,
          activatedAt: now.toISOString(),
        },
        env: c.env,
      });

      return c.json({
        success: true,
        mandateId: m.mandateId,
        status: 'ACTIVE',
        umn,
        nextBillingDate: nextBillingDate.toISOString(),
        webhook: whResult,
      });
    } finally {
      await close();
    }
  });

  // 4. Trigger recurring auto-debit on an active mandate
  router.post('/:id/debit', async (c) => {
    const targetId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));

    const { db, close } = getDb(c);
    try {
      const rows = await db
        .select()
        .from(subscriptionMandate)
        .where(eq(subscriptionMandate.mandateId, targetId))
        .limit(1);

      if (rows.length === 0) {
        return c.json({ error: 'Mandate not found' }, 404);
      }

      const m = rows[0];
      if (m.status !== 'ACTIVE') {
        return c.json({ error: `Cannot debit mandate with status '${m.status}'` }, 400);
      }

      const amount = typeof body.amount === 'number' ? Math.round(body.amount) : m.recurringAmount;
      const chargeId = `CHG_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const internalId = `chg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const nextBillingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const bankRef = `BANK_${Date.now()}`;
      const providerRef = `PROV_${Date.now()}`;

      await db.insert(subscriptionCharge).values({
        id: internalId,
        chargeId,
        mandateId: m.mandateId,
        merchantId: m.merchantId,
        amount,
        status: 'SUCCESS',
        debitedAt: now,
        bankReferenceNo: bankRef,
        providerReferenceId: providerRef,
        createdAt: now,
        updatedAt: now,
      });

      await db
        .update(subscriptionMandate)
        .set({
          lastDebitedAt: now,
          nextBillingDate,
          updatedAt: now,
        })
        .where(eq(subscriptionMandate.mandateId, targetId));

      let metadata: any = null;
      if (m.metadata) {
        try {
          metadata = JSON.parse(m.metadata);
        } catch {}
      }

      // Dispatch webhook event: mandate.debited
      await dispatchMerchantWebhook({
        db,
        merchantId: m.merchantId,
        event: 'mandate.debited',
        data: {
          chargeId,
          mandateId: m.mandateId,
          umn: m.umn,
          amount,
          status: 'SUCCESS',
          debitedAt: now.toISOString(),
          bankReferenceNo: bankRef,
          providerReferenceId: providerRef,
          nextBillingDate: nextBillingDate.toISOString(),
          metadata,
        },
        env: c.env,
      });

      return c.json({
        success: true,
        chargeId,
        mandateId: m.mandateId,
        status: 'SUCCESS',
        amount,
        bankReferenceNo: bankRef,
        debitedAt: now.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(),
      });
    } finally {
      await close();
    }
  });

  // 5. Pre-debit notification (24h before debit)
  router.post('/:id/pre-debit-notify', async (c) => {
    const targetId = c.req.param('id');
    const { db, close } = getDb(c);
    try {
      const rows = await db
        .select()
        .from(subscriptionMandate)
        .where(eq(subscriptionMandate.mandateId, targetId))
        .limit(1);

      if (rows.length === 0) {
        return c.json({ error: 'Mandate not found' }, 404);
      }

      const m = rows[0];
      const now = new Date();
      let metadata: any = null;
      if (m.metadata) {
        try {
          metadata = JSON.parse(m.metadata);
        } catch {}
      }

      // Dispatch webhook event: mandate.upcoming_debit
      await dispatchMerchantWebhook({
        db,
        merchantId: m.merchantId,
        event: 'mandate.upcoming_debit',
        data: {
          mandateId: m.mandateId,
          umn: m.umn,
          amount: m.recurringAmount,
          customerPhone: m.customerPhone,
          mandateName: m.mandateName,
          dueDate: (m.nextBillingDate || now).toISOString(),
          metadata,
        },
        env: c.env,
      });

      return c.json({
        success: true,
        mandateId: m.mandateId,
        preDebitSentAt: now.toISOString(),
      });
    } finally {
      await close();
    }
  });

  // 6. Cancel / Revoke mandate
  router.post('/:id/cancel', async (c) => {
    const targetId = c.req.param('id');
    const { db, close } = getDb(c);
    try {
      const rows = await db
        .select()
        .from(subscriptionMandate)
        .where(eq(subscriptionMandate.mandateId, targetId))
        .limit(1);

      if (rows.length === 0) {
        return c.json({ error: 'Mandate not found' }, 404);
      }

      const m = rows[0];
      const now = new Date();

      await db
        .update(subscriptionMandate)
        .set({
          status: 'REVOKED',
          updatedAt: now,
        })
        .where(eq(subscriptionMandate.mandateId, targetId));

      let metadata: any = null;
      if (m.metadata) {
        try {
          metadata = JSON.parse(m.metadata);
        } catch {}
      }

      // Dispatch webhook event: mandate.revoked
      await dispatchMerchantWebhook({
        db,
        merchantId: m.merchantId,
        event: 'mandate.revoked',
        data: {
          mandateId: m.mandateId,
          umn: m.umn,
          status: 'REVOKED',
          revokedAt: now.toISOString(),
          metadata,
        },
        env: c.env,
      });

      return c.json({
        success: true,
        mandateId: m.mandateId,
        status: 'REVOKED',
      });
    } finally {
      await close();
    }
  });

  return router;
}
