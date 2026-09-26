import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import * as z from 'zod';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import { isAllOutletRole } from '@logixsoft/logix-dine/types/roles';
import type { RestaurantRole } from '@logixsoft/logix-dine/types/roles';
import type { AuthEnv } from '../lib/auth';
import { cacheGet, cacheSet, CacheKey, TTL } from '../lib/cache';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function kv(c: any) {
  return c.env?.CACHE;
}

export const REPORT_TYPES = [
  'summary',
  'invoice-detail',
  'item-wise-invoice',
  'sales-report',
  'average-order-value',
  'gross-report',
  'top-items',
  'net-sales-report',
  'sales-by-hour',
  'hourly',
  'sales-by-day',
  'daily-trend',
  'sales-by-month',
  'sales-by-order-type',
  'orders-by-status',
  'sales-by-table',
  'payment-methods',
  'discount-report',
  'void-invoices',
  'cancelled-invoices',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

const IST_OFFSET = '+05:30';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Parse a YYYY-MM-DD date string as an IST day boundary, return UTC Date. */
function istDayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00${IST_OFFSET}`);
}
function istDayEnd(dateStr: string): Date {
  const d = istDayStart(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function toIstDateStr(utcDate: Date | string): string {
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

function toIstHour(utcDate: Date | string): number {
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours();
}

function isValidDateStr(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function outletFilter(column: ReturnType<typeof sql>, outletId: string | null) {
  return outletId ? sql`AND ${column} = ${outletId}` : sql``;
}

// GET /reports/:type?from=YYYY-MM-DD&to=YYYY-MM-DD&outletId=
app.get(
  '/:type',
  apiDoc({
    tags: ['Reports'],
    summary: 'Generate Comprehensive Analytics Report',
    description:
      'Generates comprehensive restaurant analytics including summary, invoices, item-wise matrix, gross/net sales, hourly/daily/monthly trends, order types, table performance, discounts, voids, and cancellations.',
    params: z.object({
      type: z.enum(REPORT_TYPES),
    }),
    query: z.object({
      from: z.string().meta({ description: 'Start date YYYY-MM-DD (IST)', example: '2026-09-01' }),
      to: z.string().meta({ description: 'End date YYYY-MM-DD (IST)', example: '2026-09-25' }),
      outletId: z.string().optional().meta({ description: 'Outlet ID filter (required for non-owner roles)' }),
    }),
    responses: {
      200: z.object({
        type: z.string(),
        from: z.string(),
        to: z.string(),
        outletId: z.string().nullable(),
        data: z.any(),
      }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  }),
  requirePermission('report:read'),
  async (c) => {
    const type = c.req.param('type') as ReportType;
    if (!REPORT_TYPES.includes(type)) {
      return c.json({ error: 'Not Found', message: `Unknown report type: ${type}` }, 404);
    }

    const tenant = c.get('tenant');
    const { restaurantId, role } = tenant;
    const fromStr = c.req.query('from');
    const toStr = c.req.query('to');
    if (!isValidDateStr(fromStr) || !isValidDateStr(toStr)) {
      return c.json({ error: 'Bad Request', message: 'from and to (YYYY-MM-DD) are required' }, 400);
    }

    const fromDate = istDayStart(fromStr);
    const toDate = istDayEnd(toStr); // exclusive

    let outletId: string | null = c.req.query('outletId') ?? null;
    const roleIsAllOutlet = isAllOutletRole(role as RestaurantRole);

    if (outletId) {
      if (!assertOutletAccess(tenant, outletId)) {
        return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
      }
    } else if (!roleIsAllOutlet) {
      return c.json({ error: 'Bad Request', message: 'outletId is required for this role' }, 400);
    }

    const masterCacheKey = CacheKey.report(restaurantId, 'comprehensive-v3', fromStr, toStr, outletId);
    const cachedMaster = await cacheGet<any>(kv(c), masterCacheKey);
    if (cachedMaster) {
      return c.json({ type, from: fromStr, to: toStr, outletId, data: cachedMaster });
    }

    const { db, close } = getDb(c);
    try {
      const data = await buildComprehensiveAnalytics(db, restaurantId, fromDate, toDate, outletId);
      await cacheSet(kv(c), masterCacheKey, data, TTL.report);
      return c.json({ type, from: fromStr, to: toStr, outletId, data });
    } catch (err: any) {
      console.error('[reports] query failed:', err?.message, err?.cause?.message);
      return c.json({ error: 'Internal Server Error', message: 'Report query failed' }, 500);
    } finally {
      await close();
    }
  },
);

const HOUR_LABELS = [
  '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM',
  '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
  '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM',
  '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function buildComprehensiveAnalytics(
  db: any,
  restaurantId: string,
  from: Date,
  to: Date,
  outletId: string | null,
) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const orderOutletCond = outletFilter(sql`so."outletId"`, outletId);
  const tableOutletCond = outletFilter(sql`"outletId"`, outletId);
  const outletIdCond = outletFilter(sql`"id"`, outletId);

  const [outletsRows, tablesRows, ordersRows, itemsRows] = await Promise.all([
    db.execute(sql`
      SELECT id, name, "taxSettings"
      FROM "restaurantOutlet"
      WHERE "restaurantId" = ${restaurantId}
      ${outletIdCond}
    `),
    db.execute(sql`
      SELECT name, section, capacity
      FROM "posTable"
      WHERE "restaurantId" = ${restaurantId}
      ${tableOutletCond}
    `),
    db.execute(sql`
      SELECT
        so.id,
        so."outletId",
        so."orderNo",
        so."tableNo",
        so."customerPhone",
        so.status,
        so."orderStatus",
        so."orderType",
        so."subtotalPaise",
        so."paidPaise",
        so."packagingChargePaise",
        so."deliveryChargePaise",
        so.method,
        so.note,
        so."createdAt",
        so."settledAt",
        so."createdBy",
        so."updatedBy"
      FROM "saleOrder" so
      WHERE so."restaurantId" = ${restaurantId}
        AND so."createdAt" >= ${fromIso}::timestamptz
        AND so."createdAt" < ${toIso}::timestamptz
        ${orderOutletCond}
      ORDER BY so."createdAt" DESC
    `),
    db.execute(sql`
      SELECT
        soi.id,
        soi."orderId",
        soi."itemId",
        soi."nameSnapshot" AS name,
        soi."pricePaiseSnapshot" AS "pricePaise",
        soi.qty,
        soi.variant,
        soi.addons,
        soi.status,
        soi."paymentStatus",
        soi."settledMethod",
        soi.note,
        COALESCE(mc.name, 'General') AS "categoryName"
      FROM "saleOrderItem" soi
      JOIN "saleOrder" so ON so.id = soi."orderId"
      LEFT JOIN "menuItem" mi ON mi.id = soi."itemId"
      LEFT JOIN "menuCategory" mc ON mc.id = mi."categoryId"
      WHERE so."restaurantId" = ${restaurantId}
        AND so."createdAt" >= ${fromIso}::timestamptz
        AND so."createdAt" < ${toIso}::timestamptz
        ${orderOutletCond}
      ORDER BY soi."createdAt" ASC
    `),
  ]);

  // Map outlet tax settings
  const outletTaxMap = new Map<string, any>();
  for (const o of outletsRows as any[]) {
    outletTaxMap.set(o.id, o.taxSettings || {});
  }

  // Map table metadata (section, capacity)
  const tableMetaMap = new Map<string, { section: string; capacity: number }>();
  for (const t of tablesRows as any[]) {
    tableMetaMap.set(String(t.name).trim().toLowerCase(), {
      section: t.section || 'Main Area',
      capacity: Number(t.capacity || 4),
    });
  }

  // Group items by orderId
  const itemsByOrder = new Map<string, any[]>();
  for (const rawItem of itemsRows as any[]) {
    const list = itemsByOrder.get(rawItem.orderId) || [];
    const variantObj = rawItem.variant && typeof rawItem.variant === 'object' ? rawItem.variant : null;
    const addonsArr = Array.isArray(rawItem.addons) ? rawItem.addons : [];
    const addonsPrice = addonsArr.reduce((acc: number, a: any) => acc + Number(a?.pricePaise || 0), 0);
    const unitPricePaise = Number(rawItem.pricePaise || 0);
    const qty = Number(rawItem.qty || 1);
    const lineTotalPaise = (unitPricePaise + addonsPrice) * qty;

    list.push({
      id: rawItem.id,
      orderId: rawItem.orderId,
      itemId: rawItem.itemId,
      name: rawItem.name,
      categoryName: rawItem.categoryName || 'General',
      variantName: variantObj?.name || null,
      addonsText: addonsArr.map((a: any) => a?.name).filter(Boolean).join(', ') || null,
      qty,
      unitPricePaise,
      addonsPricePaise: addonsPrice,
      lineTotalPaise,
      status: rawItem.status || 'ORDERED',
      paymentStatus: rawItem.paymentStatus || 'UNPAID',
      settledMethod: rawItem.settledMethod || null,
      note: rawItem.note || null,
    });
    itemsByOrder.set(rawItem.orderId, list);
  }

  // Summary accumulators
  let paidCount = 0;
  let openCount = 0;
  let voidCount = 0;
  let cancelledOrdersCount = 0;
  let totalCount = 0;

  let grossSalesPaise = 0;
  let netSalesPaise = 0;
  let revenuePaise = 0; // Total collected/paid amount
  let openRevenuePaise = 0;
  let voidRevenuePaise = 0;
  let cancelledRevenuePaise = 0;

  let totalCgstPaise = 0;
  let totalSgstPaise = 0;
  let totalServiceChargePaise = 0;
  let totalTaxPaise = 0;
  let totalPackagingPaise = 0;
  let totalDeliveryPaise = 0;
  let totalDiscountPaise = 0;
  let discountedOrdersCount = 0;
  let totalItemsSoldQty = 0;
  let cancelledItemsCount = 0;

  const uniqueCustomers = new Set<string>();

  // Breakdown maps
  const itemStatsMap = new Map<
    string,
    {
      key: string;
      itemId: string;
      name: string;
      categoryName: string;
      variantName: string | null;
      unitPricePaise: number;
      qtySold: number;
      ordersCount: number;
      grossPaise: number;
      discountAllocatedPaise: number;
      netPaise: number;
      taxAllocatedPaise: number;
      cancelledQty: number;
      cancelledPaise: number;
    }
  >();

  const categoryStatsMap = new Map<
    string,
    {
      categoryName: string;
      qtySold: number;
      ordersCount: number;
      grossPaise: number;
      discountPaise: number;
      netPaise: number;
    }
  >();

  const hourStats = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: HOUR_LABELS[hour],
    paidCount: 0,
    totalOrdersCount: 0,
    itemsQty: 0,
    grossPaise: 0,
    discountPaise: 0,
    netPaise: 0,
    taxPaise: 0,
    revenuePaise: 0,
    avgOrderPaise: 0,
  }));

  const dayStatsMap = new Map<
    string,
    {
      day: string;
      dayOfWeek: string;
      paidCount: 0 | number;
      openCount: number;
      voidCount: number;
      cancelledCount: number;
      itemsQty: number;
      grossPaise: number;
      discountPaise: number;
      netPaise: number;
      taxPaise: number;
      revenuePaise: number;
      avgOrderPaise: number;
      dineInPaise: number;
      takeawayPaise: number;
      deliveryPaise: number;
    }
  >();

  const monthStatsMap = new Map<
    string,
    {
      month: string;
      label: string;
      paidCount: number;
      openCount: number;
      voidCount: number;
      cancelledCount: number;
      itemsQty: number;
      grossPaise: number;
      discountPaise: number;
      netPaise: number;
      taxPaise: number;
      revenuePaise: number;
      avgOrderPaise: number;
    }
  >();

  const orderTypeStatsMap = new Map<
    string,
    {
      orderType: string;
      label: string;
      paidCount: number;
      openCount: number;
      voidCount: number;
      cancelledCount: number;
      itemsQty: number;
      grossPaise: number;
      discountPaise: number;
      netPaise: number;
      packagingPaise: number;
      deliveryPaise: number;
      taxPaise: number;
      revenuePaise: number;
      avgOrderPaise: number;
      sharePercent: number;
    }
  >();

  for (const [code, label] of [
    ['DINE_IN', 'Dine-In'],
    ['TAKEAWAY', 'Takeaway'],
    ['DELIVERY', 'Delivery'],
  ]) {
    orderTypeStatsMap.set(code, {
      orderType: code,
      label,
      paidCount: 0,
      openCount: 0,
      voidCount: 0,
      cancelledCount: 0,
      itemsQty: 0,
      grossPaise: 0,
      discountPaise: 0,
      netPaise: 0,
      packagingPaise: 0,
      deliveryPaise: 0,
      taxPaise: 0,
      revenuePaise: 0,
      avgOrderPaise: 0,
      sharePercent: 0,
    });
  }

  const paymentMethodStatsMap = new Map<
    string,
    {
      method: string;
      count: number;
      revenuePaise: number;
      avgOrderPaise: number;
      sharePercent: number;
    }
  >();

  const tableStatsMap = new Map<
    string,
    {
      tableNo: string;
      section: string;
      capacity: number;
      paidCount: number;
      openCount: number;
      voidCount: number;
      itemsQty: number;
      grossPaise: number;
      discountPaise: number;
      netPaise: number;
      revenuePaise: number;
      avgOrderPaise: number;
      sharePercent: number;
    }
  >();

  const invoices: any[] = [];
  const itemInvoiceMatrix: any[] = [];

  for (const rawOrder of ordersRows as any[]) {
    totalCount += 1;
    const orderItems = itemsByOrder.get(rawOrder.id) || [];
    const taxCfg = outletTaxMap.get(rawOrder.outletId) || {};
    const gstEnabled = Boolean(taxCfg.gstEnabled);
    const cgstPercent = gstEnabled ? Number(taxCfg.cgstPercent ?? 2.5) : 0;
    const sgstPercent = gstEnabled ? Number(taxCfg.sgstPercent ?? 2.5) : 0;
    const serviceChargeEnabled = Boolean(taxCfg.serviceChargeEnabled);
    const serviceChargePercent = serviceChargeEnabled ? Number(taxCfg.serviceChargePercent ?? 5) : 0;
    const taxInclusive = Boolean(taxCfg.taxInclusive);

    const activeItems = orderItems.filter((i) => i.status !== 'CANCELLED');
    const cancelledItems = orderItems.filter((i) => i.status === 'CANCELLED');

    const activeItemsGross = activeItems.reduce((s, i) => s + i.lineTotalPaise, 0);
    const cancelledItemsGross = cancelledItems.reduce((s, i) => s + i.lineTotalPaise, 0);
    const activeItemsQty = activeItems.reduce((s, i) => s + i.qty, 0);
    const cancelledItemsQty = cancelledItems.reduce((s, i) => s + i.qty, 0);

    const rawSubtotal = Number(rawOrder.subtotalPaise || activeItemsGross);
    const packagingPaise = Number(rawOrder.packagingChargePaise || 0);
    const deliveryPaise = Number(rawOrder.deliveryChargePaise || 0);

    let baseFoodPaise = rawSubtotal;
    let cgstPaise = 0;
    let sgstPaise = 0;
    if (gstEnabled && (cgstPercent + sgstPercent) > 0) {
      if (taxInclusive) {
        baseFoodPaise = Math.round(rawSubtotal / (1 + (cgstPercent + sgstPercent) / 100));
        cgstPaise = Math.round((baseFoodPaise * cgstPercent) / 100);
        sgstPaise = Math.max(0, rawSubtotal - baseFoodPaise - cgstPaise);
      } else {
        cgstPaise = Math.round((baseFoodPaise * cgstPercent) / 100);
        sgstPaise = Math.round((baseFoodPaise * sgstPercent) / 100);
      }
    }
    const serviceChargePaise = serviceChargeEnabled
      ? Math.round((baseFoodPaise * serviceChargePercent) / 100)
      : 0;
    const orderTaxPaise = cgstPaise + sgstPaise + serviceChargePaise;

    const expectedBillPaise =
      (taxInclusive ? rawSubtotal : rawSubtotal + cgstPaise + sgstPaise) +
      serviceChargePaise +
      packagingPaise +
      deliveryPaise;

    const status = String(rawOrder.status || 'OPEN').toUpperCase();
    const orderStatus = String(rawOrder.orderStatus || 'ORDERED').toUpperCase();
    const isCancelledOrder = orderStatus === 'CANCELLED';
    const isVoidOrder = status === 'VOID';
    const isPaidOrder = status === 'PAID' && !isCancelledOrder;

    const actualPaidPaise = isPaidOrder
      ? Number(rawOrder.paidPaise > 0 ? rawOrder.paidPaise : expectedBillPaise)
      : 0;

    // Discount detection: difference between expected total (or item gross) and actual paid/subtotal
    let orderDiscountPaise = 0;
    if (activeItemsGross > rawSubtotal) {
      orderDiscountPaise += activeItemsGross - rawSubtotal;
    }
    if (isPaidOrder && expectedBillPaise > actualPaidPaise) {
      orderDiscountPaise += expectedBillPaise - actualPaidPaise;
    }

    const orderGrossPaise = Math.max(activeItemsGross, rawSubtotal) + packagingPaise + deliveryPaise;
    const orderNetPaise = Math.max(0, baseFoodPaise - orderDiscountPaise);

    const customerPhone = rawOrder.customerPhone ? String(rawOrder.customerPhone).trim() : null;
    if (customerPhone) uniqueCustomers.add(customerPhone);

    const orderType = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'].includes(String(rawOrder.orderType))
      ? String(rawOrder.orderType)
      : 'DINE_IN';
    const tableNo = rawOrder.tableNo ? String(rawOrder.tableNo).trim() : orderType === 'TAKEAWAY' ? 'Takeaway' : orderType === 'DELIVERY' ? 'Delivery' : 'Counter';
    const tMeta = tableMetaMap.get(tableNo.toLowerCase()) || {
      section: orderType === 'DINE_IN' ? 'Main Floor' : orderType === 'TAKEAWAY' ? 'Takeaway Counter' : 'Delivery Dispatch',
      capacity: 4,
    };

    const dayStr = toIstDateStr(rawOrder.createdAt);
    const monthStr = dayStr.slice(0, 7);
    const hourNum = toIstHour(rawOrder.createdAt);
    const dowName = DAY_NAMES[new Date(`${dayStr}T00:00:00Z`).getUTCDay()];
    const [yrStr, moStr] = monthStr.split('-');
    const monthLabel = `${MONTH_NAMES[Math.max(0, Number(moStr) - 1)]} ${yrStr}`;

    // Update hour bucket
    const hStat = hourStats[hourNum];
    if (hStat) {
      hStat.totalOrdersCount += 1;
      if (isPaidOrder) {
        hStat.paidCount += 1;
        hStat.itemsQty += activeItemsQty;
        hStat.grossPaise += orderGrossPaise;
        hStat.discountPaise += orderDiscountPaise;
        hStat.netPaise += orderNetPaise;
        hStat.taxPaise += orderTaxPaise;
        hStat.revenuePaise += actualPaidPaise;
      }
    }

    // Update day bucket
    let dStat = dayStatsMap.get(dayStr);
    if (!dStat) {
      dStat = {
        day: dayStr,
        dayOfWeek: dowName,
        paidCount: 0,
        openCount: 0,
        voidCount: 0,
        cancelledCount: 0,
        itemsQty: 0,
        grossPaise: 0,
        discountPaise: 0,
        netPaise: 0,
        taxPaise: 0,
        revenuePaise: 0,
        avgOrderPaise: 0,
        dineInPaise: 0,
        takeawayPaise: 0,
        deliveryPaise: 0,
      };
      dayStatsMap.set(dayStr, dStat);
    }

    // Update month bucket
    let mStat = monthStatsMap.get(monthStr);
    if (!mStat) {
      mStat = {
        month: monthStr,
        label: monthLabel,
        paidCount: 0,
        openCount: 0,
        voidCount: 0,
        cancelledCount: 0,
        itemsQty: 0,
        grossPaise: 0,
        discountPaise: 0,
        netPaise: 0,
        taxPaise: 0,
        revenuePaise: 0,
        avgOrderPaise: 0,
      };
      monthStatsMap.set(monthStr, mStat);
    }

    // Order type bucket
    const otStat = orderTypeStatsMap.get(orderType)!;

    // Table bucket
    let tbStat = tableStatsMap.get(tableNo);
    if (!tbStat) {
      tbStat = {
        tableNo,
        section: tMeta.section,
        capacity: tMeta.capacity,
        paidCount: 0,
        openCount: 0,
        voidCount: 0,
        itemsQty: 0,
        grossPaise: 0,
        discountPaise: 0,
        netPaise: 0,
        revenuePaise: 0,
        avgOrderPaise: 0,
        sharePercent: 0,
      };
      tableStatsMap.set(tableNo, tbStat);
    }

    if (cancelledItemsQty > 0) {
      cancelledItemsCount += cancelledItemsQty;
      cancelledRevenuePaise += cancelledItemsGross;
    }

    if (isCancelledOrder) {
      cancelledOrdersCount += 1;
      cancelledRevenuePaise += rawSubtotal;
      dStat.cancelledCount += 1;
      mStat.cancelledCount += 1;
      otStat.cancelledCount += 1;
    } else if (isVoidOrder) {
      voidCount += 1;
      voidRevenuePaise += rawSubtotal;
      dStat.voidCount += 1;
      mStat.voidCount += 1;
      otStat.voidCount += 1;
      tbStat.voidCount += 1;
    } else if (isPaidOrder) {
      paidCount += 1;
      grossSalesPaise += orderGrossPaise;
      netSalesPaise += orderNetPaise;
      revenuePaise += actualPaidPaise;
      totalCgstPaise += cgstPaise;
      totalSgstPaise += sgstPaise;
      totalServiceChargePaise += serviceChargePaise;
      totalTaxPaise += orderTaxPaise;
      totalPackagingPaise += packagingPaise;
      totalDeliveryPaise += deliveryPaise;
      totalDiscountPaise += orderDiscountPaise;
      if (orderDiscountPaise > 0) discountedOrdersCount += 1;
      totalItemsSoldQty += activeItemsQty;

      dStat.paidCount += 1;
      dStat.itemsQty += activeItemsQty;
      dStat.grossPaise += orderGrossPaise;
      dStat.discountPaise += orderDiscountPaise;
      dStat.netPaise += orderNetPaise;
      dStat.taxPaise += orderTaxPaise;
      dStat.revenuePaise += actualPaidPaise;
      if (orderType === 'DINE_IN') dStat.dineInPaise += actualPaidPaise;
      if (orderType === 'TAKEAWAY') dStat.takeawayPaise += actualPaidPaise;
      if (orderType === 'DELIVERY') dStat.deliveryPaise += actualPaidPaise;

      mStat.paidCount += 1;
      mStat.itemsQty += activeItemsQty;
      mStat.grossPaise += orderGrossPaise;
      mStat.discountPaise += orderDiscountPaise;
      mStat.netPaise += orderNetPaise;
      mStat.taxPaise += orderTaxPaise;
      mStat.revenuePaise += actualPaidPaise;

      otStat.paidCount += 1;
      otStat.itemsQty += activeItemsQty;
      otStat.grossPaise += orderGrossPaise;
      otStat.discountPaise += orderDiscountPaise;
      otStat.netPaise += orderNetPaise;
      otStat.packagingPaise += packagingPaise;
      otStat.deliveryPaise += deliveryPaise;
      otStat.taxPaise += orderTaxPaise;
      otStat.revenuePaise += actualPaidPaise;

      tbStat.paidCount += 1;
      tbStat.itemsQty += activeItemsQty;
      tbStat.grossPaise += orderGrossPaise;
      tbStat.discountPaise += orderDiscountPaise;
      tbStat.netPaise += orderNetPaise;
      tbStat.revenuePaise += actualPaidPaise;

      const payMethod = String(rawOrder.method || 'Cash').trim();
      let pmStat = paymentMethodStatsMap.get(payMethod);
      if (!pmStat) {
        pmStat = { method: payMethod, count: 0, revenuePaise: 0, avgOrderPaise: 0, sharePercent: 0 };
        paymentMethodStatsMap.set(payMethod, pmStat);
      }
      pmStat.count += 1;
      pmStat.revenuePaise += actualPaidPaise;
    } else {
      // OPEN order
      openCount += 1;
      openRevenuePaise += rawSubtotal;
      dStat.openCount += 1;
      mStat.openCount += 1;
      otStat.openCount += 1;
      tbStat.openCount += 1;
    }

    // Process items for item-wise reports & matrix
    const seenItemKeysInOrder = new Set<string>();
    const seenCategoriesInOrder = new Set<string>();

    for (const item of orderItems) {
      const itemKey = `${item.itemId}::${item.variantName || ''}`;
      let iStat = itemStatsMap.get(itemKey);
      if (!iStat) {
        iStat = {
          key: itemKey,
          itemId: item.itemId,
          name: item.variantName ? `${item.name} (${item.variantName})` : item.name,
          categoryName: item.categoryName,
          variantName: item.variantName,
          unitPricePaise: item.unitPricePaise,
          qtySold: 0,
          ordersCount: 0,
          grossPaise: 0,
          discountAllocatedPaise: 0,
          netPaise: 0,
          taxAllocatedPaise: 0,
          cancelledQty: 0,
          cancelledPaise: 0,
        };
        itemStatsMap.set(itemKey, iStat);
      }

      const isItemCancelled = item.status === 'CANCELLED' || isCancelledOrder || isVoidOrder;
      const proportionalShare = activeItemsGross > 0 ? item.lineTotalPaise / activeItemsGross : 0;
      const itemDiscountPaise = isPaidOrder && !isItemCancelled ? Math.round(orderDiscountPaise * proportionalShare) : 0;
      const itemTaxPaise = isPaidOrder && !isItemCancelled ? Math.round(orderTaxPaise * proportionalShare) : 0;
      const itemNetPaise = Math.max(0, item.lineTotalPaise - itemDiscountPaise);

      if (isItemCancelled) {
        iStat.cancelledQty += item.qty;
        iStat.cancelledPaise += item.lineTotalPaise;
      } else if (isPaidOrder) {
        iStat.qtySold += item.qty;
        iStat.grossPaise += item.lineTotalPaise;
        iStat.discountAllocatedPaise += itemDiscountPaise;
        iStat.netPaise += itemNetPaise;
        iStat.taxAllocatedPaise += itemTaxPaise;
        if (!seenItemKeysInOrder.has(itemKey)) {
          iStat.ordersCount += 1;
          seenItemKeysInOrder.add(itemKey);
        }

        // Category stats
        let cStat = categoryStatsMap.get(item.categoryName);
        if (!cStat) {
          cStat = {
            categoryName: item.categoryName,
            qtySold: 0,
            ordersCount: 0,
            grossPaise: 0,
            discountPaise: 0,
            netPaise: 0,
          };
          categoryStatsMap.set(item.categoryName, cStat);
        }
        cStat.qtySold += item.qty;
        cStat.grossPaise += item.lineTotalPaise;
        cStat.discountPaise += itemDiscountPaise;
        cStat.netPaise += itemNetPaise;
        if (!seenCategoriesInOrder.has(item.categoryName)) {
          cStat.ordersCount += 1;
          seenCategoriesInOrder.add(item.categoryName);
        }
      }

      itemInvoiceMatrix.push({
        id: `${rawOrder.id}_${item.id}`,
        orderId: rawOrder.id,
        orderNo: Number(rawOrder.orderNo),
        createdAt: rawOrder.createdAt,
        tableNo,
        orderType,
        customerPhone,
        method: rawOrder.method || (status === 'PAID' ? 'Cash' : 'Unpaid'),
        orderStatus: isCancelledOrder ? 'CANCELLED' : status,
        itemId: item.itemId,
        itemName: item.name,
        categoryName: item.categoryName,
        variantName: item.variantName,
        addonsText: item.addonsText,
        qty: item.qty,
        unitPricePaise: item.unitPricePaise,
        grossPaise: item.lineTotalPaise,
        discountPaise: itemDiscountPaise,
        taxPaise: itemTaxPaise,
        netPaise: itemNetPaise,
        itemStatus: item.status,
      });
    }

    invoices.push({
      id: rawOrder.id,
      orderNo: Number(rawOrder.orderNo),
      createdAt: rawOrder.createdAt,
      settledAt: rawOrder.settledAt,
      tableNo,
      tableSection: tMeta.section,
      orderType,
      customerPhone,
      status,
      orderStatus,
      method: rawOrder.method || (status === 'PAID' ? 'Cash' : null),
      subtotalPaise: rawSubtotal,
      grossPaise: orderGrossPaise,
      discountPaise: orderDiscountPaise,
      netSalesPaise: orderNetPaise,
      cgstPaise,
      sgstPaise,
      serviceChargePaise,
      totalTaxPaise: orderTaxPaise,
      packagingChargePaise: packagingPaise,
      deliveryChargePaise: deliveryPaise,
      expectedTotalPaise: expectedBillPaise,
      paidPaise: actualPaidPaise,
      itemsCount: activeItems.length,
      totalQty: activeItemsQty,
      cancelledItemsCount: cancelledItemsQty,
      cancelledAmountPaise: cancelledItemsGross,
      note: rawOrder.note || null,
      createdBy: rawOrder.createdBy || null,
      items: orderItems,
    });
  }

  // Finalize averages and shares
  for (const h of hourStats) {
    h.avgOrderPaise = h.paidCount > 0 ? Math.round(h.revenuePaise / h.paidCount) : 0;
  }

  const byDay = Array.from(dayStatsMap.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({
      ...d,
      avgOrderPaise: d.paidCount > 0 ? Math.round(d.revenuePaise / d.paidCount) : 0,
    }));

  const byMonth = Array.from(monthStatsMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      ...m,
      avgOrderPaise: m.paidCount > 0 ? Math.round(m.revenuePaise / m.paidCount) : 0,
    }));

  const byOrderType = Array.from(orderTypeStatsMap.values()).map((ot) => ({
    ...ot,
    avgOrderPaise: ot.paidCount > 0 ? Math.round(ot.revenuePaise / ot.paidCount) : 0,
    sharePercent: revenuePaise > 0 ? Math.round((ot.revenuePaise / revenuePaise) * 1000) / 10 : 0,
  }));

  const byPaymentMethod = Array.from(paymentMethodStatsMap.values())
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .map((pm) => ({
      ...pm,
      avgOrderPaise: pm.count > 0 ? Math.round(pm.revenuePaise / pm.count) : 0,
      sharePercent: revenuePaise > 0 ? Math.round((pm.revenuePaise / revenuePaise) * 1000) / 10 : 0,
    }));

  const byTable = Array.from(tableStatsMap.values())
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .map((tb) => ({
      ...tb,
      avgOrderPaise: tb.paidCount > 0 ? Math.round(tb.revenuePaise / tb.paidCount) : 0,
      sharePercent: revenuePaise > 0 ? Math.round((tb.revenuePaise / revenuePaise) * 1000) / 10 : 0,
    }));

  const totalItemGross = Array.from(itemStatsMap.values()).reduce((s, i) => s + i.grossPaise, 0);
  const itemsReport = Array.from(itemStatsMap.values())
    .sort((a, b) => b.grossPaise - a.grossPaise)
    .map((it) => ({
      ...it,
      qty: it.qtySold,
      revenuePaise: it.grossPaise,
      sharePercent: totalItemGross > 0 ? Math.round((it.grossPaise / totalItemGross) * 1000) / 10 : 0,
    }));

  const byCategory = Array.from(categoryStatsMap.values())
    .sort((a, b) => b.grossPaise - a.grossPaise)
    .map((cat) => ({
      ...cat,
      sharePercent: totalItemGross > 0 ? Math.round((cat.grossPaise / totalItemGross) * 1000) / 10 : 0,
    }));

  const avgOrderPaise = paidCount > 0 ? Math.round(revenuePaise / paidCount) : 0;
  const avgItemsPerOrder = paidCount > 0 ? Math.round((totalItemsSoldQty / paidCount) * 10) / 10 : 0;

  const summary = {
    paidCount,
    revenuePaise,
    avgOrderPaise,
    openCount,
    openRevenuePaise,
    voidCount,
    voidRevenuePaise,
    cancelledOrdersCount,
    cancelledItemsCount,
    cancelledRevenuePaise,
    totalCount,
    grossSalesPaise,
    netSalesPaise,
    totalCgstPaise,
    totalSgstPaise,
    totalServiceChargePaise,
    totalTaxPaise,
    packagingChargePaise: totalPackagingPaise,
    deliveryChargePaise: totalDeliveryPaise,
    discountPaise: totalDiscountPaise,
    discountedOrdersCount,
    totalItemsSoldQty,
    avgItemsPerOrder,
    uniqueCustomersCount: uniqueCustomers.size,
  };

  return {
    // Top-level summary fields for backward compatibility
    ...summary,
    // Structured datasets for all 16 reports
    summary,
    invoices,
    itemInvoiceMatrix,
    itemsReport,
    byCategory,
    byHour: hourStats,
    byDay,
    byMonth,
    byOrderType,
    byPaymentMethod,
    byTable,
    counts: {
      PAID: paidCount,
      OPEN: openCount,
      VOID: voidCount,
      CANCELLED: cancelledOrdersCount,
    },
  };
}

export { app as reportRoutes };
