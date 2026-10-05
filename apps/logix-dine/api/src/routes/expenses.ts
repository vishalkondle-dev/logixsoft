import { Hono } from 'hono';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requireMembership, assertOutletAccess } from '../lib/tenancy';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import type { AuthEnv } from '../lib/auth';
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  SetCashRegisterSchema,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_MODES,
} from '@logixsoft/logix-dine/schemas/pos';
import {
  generateDailyClosingSummary,
  formatClosingReportWhatsAppMessage,
  sendOutletDailyClosingReport,
  getTodayISTDateString,
  CATEGORY_LABELS,
} from '../lib/closing-report';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// ─── GET /expenses/summary ───────────────────────────────────────────────────
app.get(
  '/summary',
  apiDoc({
    tags: ['Expenses & Finance'],
    summary: 'Get Financial & Expense Summary',
    description: 'Retrieves sales vs expense breakdown, petty cash drawer, and net profit.',
    query: z.object({
      outletId: z.string().optional(),
      date: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || tenant.outletId || tenant.outletIds[0];

    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId is required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `No access to outlet ${outletId}` }, 403);
    }

    const targetDate = c.req.query('date') || getTodayISTDateString();
    const { db, close } = getDb(c);

    try {
      const summary = await generateDailyClosingSummary(db, restaurantId, outletId, targetDate);
      return c.json(summary);
    } catch (err: any) {
      console.error('[expenses/summary] error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message }, 500);
    } finally {
      await close();
    }
  }
);

// ─── GET /expenses ───────────────────────────────────────────────────────────
app.get(
  '/',
  apiDoc({
    tags: ['Expenses & Finance'],
    summary: 'List Expenses & Petty Cash Ledger',
    description: 'Returns list of expenses filtered by date, category, and payment mode.',
    query: z.object({
      outletId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      category: z.string().optional(),
      paymentMode: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
    responses: {
      200: z.object({
        expenses: z.array(z.any()),
        totalPaise: z.number(),
        count: z.number(),
      }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || tenant.outletId || tenant.outletIds[0];

    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId is required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `No access to outlet ${outletId}` }, 403);
    }

    const startDate = c.req.query('startDate') || getTodayISTDateString();
    const endDate = c.req.query('endDate') || startDate;
    const category = c.req.query('category');
    const paymentMode = c.req.query('paymentMode');
    const limit = Math.min(Number(c.req.query('limit') || 100), 500);
    const offset = Number(c.req.query('offset') || 0);

    const { db, close } = getDb(c);
    try {
      const conditions = [
        eq(appSchema.restaurantExpense.restaurantId, restaurantId),
        eq(appSchema.restaurantExpense.outletId, outletId),
        gte(appSchema.restaurantExpense.expenseDate, startDate),
        lte(appSchema.restaurantExpense.expenseDate, endDate),
      ];

      if (category && category !== 'ALL') {
        conditions.push(eq(appSchema.restaurantExpense.category, category));
      }
      if (paymentMode && paymentMode !== 'ALL') {
        conditions.push(eq(appSchema.restaurantExpense.paymentMode, paymentMode));
      }

      const rows = await db
        .select()
        .from(appSchema.restaurantExpense)
        .where(and(...conditions))
        .orderBy(desc(appSchema.restaurantExpense.createdAt))
        .limit(limit)
        .offset(offset);

      const totalPaise = rows.reduce((sum: number, r: any) => sum + (r.amountPaise || 0), 0);

      return c.json({
        expenses: rows,
        totalPaise,
        count: rows.length,
      });
    } catch (err: any) {
      console.error('[expenses/list] error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message }, 500);
    } finally {
      await close();
    }
  }
);

// ─── POST /expenses ──────────────────────────────────────────────────────────
app.post(
  '/',
  apiDoc({
    tags: ['Expenses & Finance'],
    summary: 'Record Expense / Petty Cash Outflow',
    description: 'Logs an expense voucher or counter petty cash drawer payout.',
    body: CreateExpenseSchema,
    responses: {
      201: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
    const tenant = c.get('tenant');
    const sessionUser = c.get('sessionUser');
    const { restaurantId } = tenant;

    const body = await c.req.json().catch(() => ({}));
    const parsed = CreateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const outletId = parsed.data.outletId || tenant.outletId || tenant.outletIds[0];
    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId is required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `No access to outlet ${outletId}` }, 403);
    }

    const expenseId = `exp_${generateId()}`;
    const { db, close } = getDb(c);

    try {
      const [newRow] = await db
        .insert(appSchema.restaurantExpense)
        .values({
          id: expenseId,
          restaurantId,
          outletId,
          title: parsed.data.title.trim(),
          category: parsed.data.category,
          amountPaise: parsed.data.amountPaise,
          paymentMode: parsed.data.paymentMode,
          paidTo: parsed.data.paidTo?.trim() || null,
          expenseDate: parsed.data.expenseDate,
          notes: parsed.data.notes?.trim() || null,
          receiptUrl: parsed.data.receiptUrl || null,
          createdById: sessionUser?.id || null,
          createdBy: sessionUser?.name || sessionUser?.phoneNumber || 'Staff',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning();

      return c.json(newRow, 201);
    } catch (err: any) {
      console.error('[expenses/create] error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message }, 500);
    } finally {
      await close();
    }
  }
);

// ─── PUT /expenses/:id ───────────────────────────────────────────────────────
app.put(
  '/:id',
  apiDoc({
    tags: ['Expenses & Finance'],
    summary: 'Update Expense',
    description: 'Modifies an existing expense voucher.',
    body: UpdateExpenseSchema,
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
    const expenseId = c.req.param('id');
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;

    const body = await c.req.json().catch(() => ({}));
    const parsed = UpdateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.restaurantExpense)
        .where(
          and(
            eq(appSchema.restaurantExpense.id, expenseId),
            eq(appSchema.restaurantExpense.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!existing) {
        return c.json({ error: 'Not Found', message: 'Expense record not found' }, 404);
      }

      if (!assertOutletAccess(tenant, existing.outletId)) {
        return c.json({ error: 'Forbidden', message: 'No access to this outlet' }, 403);
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (parsed.data.title !== undefined) updates.title = parsed.data.title.trim();
      if (parsed.data.category !== undefined) updates.category = parsed.data.category;
      if (parsed.data.amountPaise !== undefined) updates.amountPaise = parsed.data.amountPaise;
      if (parsed.data.paymentMode !== undefined) updates.paymentMode = parsed.data.paymentMode;
      if (parsed.data.paidTo !== undefined) updates.paidTo = parsed.data.paidTo?.trim() || null;
      if (parsed.data.expenseDate !== undefined) updates.expenseDate = parsed.data.expenseDate;
      if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes?.trim() || null;
      if (parsed.data.receiptUrl !== undefined) updates.receiptUrl = parsed.data.receiptUrl;

      const [updated] = await db
        .update(appSchema.restaurantExpense)
        .set(updates)
        .where(eq(appSchema.restaurantExpense.id, expenseId))
        .returning();

      return c.json(updated);
    } catch (err: any) {
      console.error('[expenses/update] error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message }, 500);
    } finally {
      await close();
    }
  }
);

// ─── DELETE /expenses/:id ────────────────────────────────────────────────────
app.delete(
  '/:id',
  apiDoc({
    tags: ['Expenses & Finance'],
    summary: 'Delete Expense Voucher',
    responses: {
      200: z.object({ success: z.boolean(), id: z.string() }),
      404: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
    const expenseId = c.req.param('id');
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.restaurantExpense)
        .where(
          and(
            eq(appSchema.restaurantExpense.id, expenseId),
            eq(appSchema.restaurantExpense.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!existing) {
        return c.json({ error: 'Not Found', message: 'Expense record not found' }, 404);
      }

      if (!assertOutletAccess(tenant, existing.outletId)) {
        return c.json({ error: 'Forbidden', message: 'No access to this outlet' }, 403);
      }

      await db
        .delete(appSchema.restaurantExpense)
        .where(eq(appSchema.restaurantExpense.id, expenseId));

      return c.json({ success: true, id: expenseId });
    } catch (err: any) {
      console.error('[expenses/delete] error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message }, 500);
    } finally {
      await close();
    }
  }
);

// ─── GET /expenses/cash-register ─────────────────────────────────────────────
app.get(
  '/cash-register',
  apiDoc({
    tags: ['Expenses & Finance'],
    summary: 'Get Daily Cash Register Drawer',
    query: z.object({
      outletId: z.string().optional(),
      date: z.string().optional(),
    }),
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || tenant.outletId || tenant.outletIds[0];
    const date = c.req.query('date') || getTodayISTDateString();

    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId is required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `No access to outlet ${outletId}` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const [row] = await db
        .select()
        .from(appSchema.cashRegisterLog)
        .where(
          and(
            eq(appSchema.cashRegisterLog.outletId, outletId),
            eq(appSchema.cashRegisterLog.date, date)
          )
        )
        .limit(1);

      return c.json(row || {
        outletId,
        date,
        openingFloatPaise: 0,
        cashWithdrawnPaise: 0,
        closingCountedPaise: null,
        notes: null,
      });
    } catch (err: any) {
      console.error('[expenses/cash-register] error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message }, 500);
    } finally {
      await close();
    }
  }
);

// ─── POST /expenses/cash-register ────────────────────────────────────────────
app.post(
  '/cash-register',
  apiDoc({
    tags: ['Expenses & Finance'],
    summary: 'Set Daily Cash Register Opening Float / Count',
    body: SetCashRegisterSchema,
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
    const tenant = c.get('tenant');
    const sessionUser = c.get('sessionUser');
    const { restaurantId } = tenant;

    const body = await c.req.json().catch(() => ({}));
    const parsed = SetCashRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const outletId = parsed.data.outletId || tenant.outletId || tenant.outletIds[0];
    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId is required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `No access to outlet ${outletId}` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.cashRegisterLog)
        .where(
          and(
            eq(appSchema.cashRegisterLog.outletId, outletId),
            eq(appSchema.cashRegisterLog.date, parsed.data.date)
          )
        )
        .limit(1);

      if (existing) {
        const updates: Record<string, any> = { updatedAt: new Date() };
        if (parsed.data.openingFloatPaise !== undefined) {
          updates.openingFloatPaise = parsed.data.openingFloatPaise;
        }
        if (parsed.data.cashWithdrawnPaise !== undefined) {
          updates.cashWithdrawnPaise = parsed.data.cashWithdrawnPaise;
        }
        if (parsed.data.closingCountedPaise !== undefined) {
          updates.closingCountedPaise = parsed.data.closingCountedPaise;
          updates.closedAt = new Date();
          updates.closedById = sessionUser?.id || null;
        }
        if (parsed.data.notes !== undefined) {
          updates.notes = parsed.data.notes?.trim() || null;
        }

        const [updated] = await db
          .update(appSchema.cashRegisterLog)
          .set(updates)
          .where(eq(appSchema.cashRegisterLog.id, existing.id))
          .returning();

        return c.json(updated);
      } else {
        const id = `reg_${generateId()}`;
        const [inserted] = await db
          .insert(appSchema.cashRegisterLog)
          .values({
            id,
            restaurantId,
            outletId,
            date: parsed.data.date,
            openingFloatPaise: parsed.data.openingFloatPaise || 0,
            cashWithdrawnPaise: parsed.data.cashWithdrawnPaise || 0,
            closingCountedPaise: parsed.data.closingCountedPaise ?? null,
            notes: parsed.data.notes?.trim() || null,
            closedAt: parsed.data.closingCountedPaise !== undefined ? new Date() : null,
            closedById: parsed.data.closingCountedPaise !== undefined ? sessionUser?.id : null,
            createdBy: sessionUser?.name || sessionUser?.phoneNumber || 'Staff',
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any)
          .returning();

        return c.json(inserted, 201);
      }
    } catch (err: any) {
      console.error('[expenses/set-cash-register] error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message }, 500);
    } finally {
      await close();
    }
  }
);

// ─── POST /expenses/send-closing-report ───────────────────────────────────────
const SendClosingReportSchema = z.object({
  outletId: z.string().optional(),
  phone: z.string().optional(),
  date: z.string().optional(),
});

app.post(
  '/send-closing-report',
  apiDoc({
    tags: ['Expenses & Finance'],
    summary: 'Send Daily WhatsApp Closing Report to Owner',
    description: 'Compiles today’s financial closing digest and delivers it to the owner’s WhatsApp.',
    body: SendClosingReportSchema,
    responses: {
      200: z.object({
        success: z.boolean(),
        recipientPhone: z.string(),
        message: z.string(),
      }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;

    const body = await c.req.json().catch(() => ({}));
    const parsed = SendClosingReportSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const outletId = parsed.data.outletId || tenant.outletId || tenant.outletIds[0];
    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId is required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `No access to outlet ${outletId}` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const res = await sendOutletDailyClosingReport(
        db,
        c.env,
        restaurantId,
        outletId,
        parsed.data.phone,
        parsed.data.date
      );

      return c.json(res);
    } catch (err: any) {
      console.error('[expenses/send-closing-report] error:', err);
      return c.json({ error: 'Dispatch Failed', message: err.message }, 500);
    } finally {
      await close();
    }
  }
);

// ─── GET /expenses/closing-report-preview ────────────────────────────────────
app.get(
  '/closing-report-preview',
  apiDoc({
    tags: ['Expenses & Finance'],
    summary: 'Preview Daily WhatsApp Closing Report',
    query: z.object({
      outletId: z.string().optional(),
      date: z.string().optional(),
    }),
    responses: {
      200: z.object({
        summary: z.any(),
        message: z.string(),
        recipientPhone: z.string().nullable(),
      }),
      400: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || tenant.outletId || tenant.outletIds[0];
    const date = c.req.query('date') || getTodayISTDateString();

    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId is required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `No access to outlet ${outletId}` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const summary = await generateDailyClosingSummary(db, restaurantId, outletId, date);
      const message = formatClosingReportWhatsAppMessage(summary);

      return c.json({
        summary,
        message,
        recipientPhone: summary.ownerPhone,
      });
    } catch (err: any) {
      console.error('[expenses/closing-report-preview] error:', err);
      return c.json({ error: 'Internal Server Error', message: err.message }, 500);
    } finally {
      await close();
    }
  }
);

export const expenseRoutes = app;
