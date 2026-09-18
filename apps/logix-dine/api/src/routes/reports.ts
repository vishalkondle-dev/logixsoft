import { Hono } from 'hono';
import { sql, eq } from 'drizzle-orm';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, hasOutletAccess } from '../lib/tenancy';
import { isAllOutletRole } from '@logixsoft/logix-dine/types/roles';
import type { RestaurantRole } from '@logixsoft/logix-dine/types/roles';
import type { AuthEnv } from '../lib/auth';

const app = new Hono<{ Bindings: AuthEnv & { HYPERDRIVE?: { connectionString: string } } }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

const REPORT_TYPES = [
  'summary',
  'top-items',
  'orders-by-status',
  'payment-methods',
  'hourly',
  'daily-trend',
] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const IST_OFFSET = '+05:30';

/** Parse a YYYY-MM-DD date string as an IST day boundary, return UTC Date. */
function istDayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00${IST_OFFSET}`);
}
function istDayEnd(dateStr: string): Date {
  // exclusive upper bound: start of the NEXT day in IST
  const d = istDayStart(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function isValidDateStr(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Build the outlet WHERE fragment ONCE per query. Referencing the same JS
 * value twice in a drizzle sql`` template (e.g. `${outletId}::text IS NULL
 * OR "outletId" = ${outletId}`) generates two placeholders but only one bound
 * value with the postgres-js driver, causing a param-count mismatch at
 * execution time. Building a single fragment (bound zero or one times)
 * avoids that entirely.
 */
function outletFilter(column: ReturnType<typeof sql>, outletId: string | null) {
  return outletId ? sql`AND ${column} = ${outletId}` : sql``;
}

// GET /reports/:type?from=YYYY-MM-DD&to=YYYY-MM-DD&outletId=
app.get('/:type', requirePermission('report:read'), async (c) => {
  const type = c.req.param('type') as ReportType;
  if (!REPORT_TYPES.includes(type)) {
    return c.json({ error: 'Not Found', message: `Unknown report type: ${type}` }, 404);
  }

  const { restaurantId, role, member } = c.get('tenant');
  const fromStr = c.req.query('from');
  const toStr = c.req.query('to');
  if (!isValidDateStr(fromStr) || !isValidDateStr(toStr)) {
    return c.json({ error: 'Bad Request', message: 'from and to (YYYY-MM-DD) are required' }, 400);
  }

  const fromDate = istDayStart(fromStr);
  const toDate = istDayEnd(toStr); // exclusive

  // Outlet scoping: OWNER may pass any outletId or none (all outlets).
  // Non-OWNER roles are ALWAYS forced to their own accessible outlet(s) —
  // outletId comes from the query string here (not X-Outlet-Id header, since
  // reports naturally use query params for date range too), so we verify
  // access explicitly rather than relying on requirePermission's header check.
  let outletId: string | null = c.req.query('outletId') ?? null;
  const roleIsAllOutlet = isAllOutletRole(role as RestaurantRole);
  if (!roleIsAllOutlet && !outletId) {
    return c.json({ error: 'Bad Request', message: 'outletId is required for this role' }, 400);
  }

  const { db, close } = getDb(c);
  try {
    if (!roleIsAllOutlet && outletId && member) {
      const allowed = await hasOutletAccess(db, (member as any).id, role, outletId);
      if (!allowed) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }
    }

    const data = await runReport(db, type, restaurantId, fromDate, toDate, outletId);
    return c.json({ type, from: fromStr, to: toStr, outletId, data });
  } catch (err: any) {
    console.error('[reports] query failed:', err?.message, err?.cause?.message);
    return c.json({ error: 'Internal Server Error', message: 'Report query failed' }, 500);
  } finally {
    await close();
  }
});

async function runReport(
  db: any,
  type: ReportType,
  restaurantId: string,
  from: Date,
  to: Date,
  outletId: string | null,
) {
  switch (type) {
    case 'summary':
      return runSummary(db, restaurantId, from, to, outletId);
    case 'top-items':
      return runTopItems(db, restaurantId, from, to, outletId);
    case 'orders-by-status':
      return runOrdersByStatus(db, restaurantId, from, to, outletId);
    case 'payment-methods':
      return runPaymentMethods(db, restaurantId, from, to, outletId);
    case 'hourly':
      return runHourly(db, restaurantId, from, to, outletId);
    case 'daily-trend':
      return runDailyTrend(db, restaurantId, from, to, outletId);
  }
}

async function runSummary(db: any, restaurantId: string, from: Date, to: Date, outletId: string | null) {
  const filter = outletFilter(sql`"outletId"`, outletId);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const rows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'PAID') AS "paidCount",
      COALESCE(SUM("subtotalPaise") FILTER (WHERE status = 'PAID'), 0) AS "revenuePaise",
      COUNT(*) FILTER (WHERE status = 'OPEN') AS "openCount",
      COUNT(*) FILTER (WHERE status = 'VOID') AS "voidCount",
      COUNT(*) AS "totalCount"
    FROM "saleOrder"
    WHERE "restaurantId" = ${restaurantId}
      AND "createdAt" >= ${fromIso}::timestamptz AND "createdAt" < ${toIso}::timestamptz
      ${filter}
  `);
  const row: any = rows[0] ?? {};
  const paidCount = Number(row.paidCount ?? 0);
  const revenuePaise = Number(row.revenuePaise ?? 0);
  return {
    paidCount,
    revenuePaise,
    avgOrderPaise: paidCount > 0 ? Math.round(revenuePaise / paidCount) : 0,
    openCount: Number(row.openCount ?? 0),
    voidCount: Number(row.voidCount ?? 0),
    totalCount: Number(row.totalCount ?? 0),
  };
}

async function runTopItems(db: any, restaurantId: string, from: Date, to: Date, outletId: string | null) {
  const filter = outletFilter(sql`so."outletId"`, outletId);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const rows = await db.execute(sql`
    SELECT
      soi."itemId" AS "itemId",
      soi."nameSnapshot" AS name,
      SUM(soi.qty) AS qty,
      SUM(soi.qty * soi."pricePaiseSnapshot") AS "revenuePaise"
    FROM "saleOrderItem" soi
    JOIN "saleOrder" so ON so.id = soi."orderId"
    WHERE so."restaurantId" = ${restaurantId}
      AND so.status = 'PAID'
      AND so."createdAt" >= ${fromIso}::timestamptz AND so."createdAt" < ${toIso}::timestamptz
      ${filter}
    GROUP BY soi."itemId", soi."nameSnapshot"
    ORDER BY qty DESC
    LIMIT 10
  `);
  return rows.map((r: any) => ({
    itemId: r.itemId,
    name: r.name,
    qty: Number(r.qty),
    revenuePaise: Number(r.revenuePaise),
  }));
}

async function runOrdersByStatus(db: any, restaurantId: string, from: Date, to: Date, outletId: string | null) {
  const filter = outletFilter(sql`"outletId"`, outletId);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const rows = await db.execute(sql`
    SELECT status, COUNT(*) AS count
    FROM "saleOrder"
    WHERE "restaurantId" = ${restaurantId}
      AND "createdAt" >= ${fromIso}::timestamptz AND "createdAt" < ${toIso}::timestamptz
      ${filter}
    GROUP BY status
  `);
  const byStatus: Record<string, number> = { OPEN: 0, PAID: 0, VOID: 0 };
  let total = 0;
  for (const r of rows as any[]) {
    const count = Number(r.count);
    byStatus[r.status] = count;
    total += count;
  }
  return {
    counts: byStatus,
    total,
    percentages: Object.fromEntries(
      Object.entries(byStatus).map(([k, v]) => [k, total > 0 ? Math.round((v / total) * 1000) / 10 : 0]),
    ),
  };
}

async function runPaymentMethods(db: any, restaurantId: string, from: Date, to: Date, outletId: string | null) {
  const filter = outletFilter(sql`"outletId"`, outletId);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const rows = await db.execute(sql`
    SELECT
      COALESCE(method, 'Unknown') AS method,
      COUNT(*) AS count,
      COALESCE(SUM("subtotalPaise"), 0) AS "revenuePaise"
    FROM "saleOrder"
    WHERE "restaurantId" = ${restaurantId}
      AND status = 'PAID'
      AND "createdAt" >= ${fromIso}::timestamptz AND "createdAt" < ${toIso}::timestamptz
      ${filter}
    GROUP BY method
  `);
  return rows.map((r: any) => ({
    method: r.method,
    count: Number(r.count),
    revenuePaise: Number(r.revenuePaise),
  }));
}

async function runHourly(db: any, restaurantId: string, from: Date, to: Date, outletId: string | null) {
  const filter = outletFilter(sql`"outletId"`, outletId);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const rows = await db.execute(sql`
    SELECT
      EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'Asia/Kolkata')::int AS hour,
      COUNT(*) FILTER (WHERE status = 'PAID') AS "paidCount",
      COALESCE(SUM("subtotalPaise") FILTER (WHERE status = 'PAID'), 0) AS "revenuePaise"
    FROM "saleOrder"
    WHERE "restaurantId" = ${restaurantId}
      AND "createdAt" >= ${fromIso}::timestamptz AND "createdAt" < ${toIso}::timestamptz
      ${filter}
    GROUP BY hour
    ORDER BY hour
  `);
  const byHour = new Map<number, { paidCount: number; revenuePaise: number }>();
  for (const r of rows as any[]) {
    byHour.set(Number(r.hour), { paidCount: Number(r.paidCount), revenuePaise: Number(r.revenuePaise) });
  }
  // Fill all 24 hours so the chart always has a full x-axis
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    paidCount: byHour.get(hour)?.paidCount ?? 0,
    revenuePaise: byHour.get(hour)?.revenuePaise ?? 0,
  }));
}

async function runDailyTrend(db: any, restaurantId: string, from: Date, to: Date, outletId: string | null) {
  const filter = outletFilter(sql`"outletId"`, outletId);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const rows = await db.execute(sql`
    SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
      COUNT(*) FILTER (WHERE status = 'PAID') AS "paidCount",
      COALESCE(SUM("subtotalPaise") FILTER (WHERE status = 'PAID'), 0) AS "revenuePaise"
    FROM "saleOrder"
    WHERE "restaurantId" = ${restaurantId}
      AND "createdAt" >= ${fromIso}::timestamptz AND "createdAt" < ${toIso}::timestamptz
      ${filter}
    GROUP BY day
    ORDER BY day
  `);
  return rows.map((r: any) => ({
    day: r.day,
    paidCount: Number(r.paidCount),
    revenuePaise: Number(r.revenuePaise),
  }));
}

export { app as reportRoutes };
