import { sql, eq, and, desc, inArray } from 'drizzle-orm';
import { appSchema } from '../db';
import { sendWhatsAppText } from '@logixsoft/wa';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getTodayISTDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatINR(paise: number): string {
  const rs = Math.round(paise / 100);
  return rs.toLocaleString('en-IN');
}

export interface DailyClosingSummary {
  date: string;
  formattedDate: string;
  restaurantName: string;
  outletName: string;
  ownerPhone: string | null;

  // Sales
  grossSalesPaise: number;
  netSalesPaise: number;
  totalOrdersSettled: number;
  averageOrderValuePaise: number;

  // Payment Breakdown
  cashSalesPaise: number;
  cashOrdersCount: number;
  upiSalesPaise: number;
  upiOrdersCount: number;
  cardSalesPaise: number;
  cardOrdersCount: number;

  // Order Channels
  dineInOrdersCount: number;
  dineInSalesPaise: number;
  takeawayOrdersCount: number;
  takeawaySalesPaise: number;
  deliveryOrdersCount: number;
  deliverySalesPaise: number;

  // Cancellations
  voidOrdersCount: number;
  voidSalesPaise: number;

  // Expenses & Petty Cash
  totalExpensesPaise: number;
  cashExpensesPaise: number;
  onlineExpensesPaise: number;
  categoryExpenses: Array<{ category: string; label: string; amountPaise: number; count: number }>;

  // Cash Drawer & Profit
  openingFloatPaise: number;
  cashInHandPaise: number;
  netProfitPaise: number;

  // Top Items
  topItems: Array<{ name: string; qty: number; totalPaise: number }>;
}

export const CATEGORY_LABELS: Record<string, string> = {
  RAW_MATERIAL: 'Raw Materials & Groceries',
  STAFF: 'Staff Wages & Advances',
  UTILITIES: 'Gas, Electricity & Water',
  MAINTENANCE: 'Equipment & Repairs',
  PACKAGING: 'Packaging & Containers',
  MARKETING: 'Marketing & Ads',
  RENT: 'Store Rent',
  OTHER: 'Miscellaneous Petty Cash',
};

/**
 * Computes end-of-day closing summary metrics for a given outlet and date.
 */
export async function generateDailyClosingSummary(
  db: any,
  restaurantId: string,
  outletId: string,
  targetDateStr?: string
): Promise<DailyClosingSummary> {
  const dateStr = targetDateStr || getTodayISTDateString();
  const fromIso = `${dateStr}T00:00:00+05:30`;
  const toIso = `${dateStr}T23:59:59.999+05:30`;

  // 1. Fetch Restaurant & Outlet
  const [rest] = await db
    .select()
    .from(appSchema.restaurant)
    .where(eq(appSchema.restaurant.id, restaurantId))
    .limit(1);

  const [out] = await db
    .select()
    .from(appSchema.restaurantOutlet)
    .where(eq(appSchema.restaurantOutlet.id, outletId))
    .limit(1);

  const restaurantName = rest?.name || 'Restaurant';
  const outletName = out?.name || 'Main Branch';

  const ws = (out?.whatsappSettings as any) || {};
  const ownerPhone = ws?.ownerClosingReportPhone || out?.phone || rest?.phone || null;

  // Format date readable (e.g. "Monday, 05 Oct 2026")
  const dateObj = new Date(`${dateStr}T12:00:00+05:30`);
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dateObj);

  // 2. Query Orders for today
  const orders = await db
    .select({
      id: appSchema.saleOrder.id,
      orderNo: appSchema.saleOrder.orderNo,
      status: appSchema.saleOrder.status,
      orderStatus: appSchema.saleOrder.orderStatus,
      orderType: appSchema.saleOrder.orderType,
      subtotalPaise: appSchema.saleOrder.subtotalPaise,
      paidPaise: appSchema.saleOrder.paidPaise,
      method: appSchema.saleOrder.method,
      packagingChargePaise: appSchema.saleOrder.packagingChargePaise,
      deliveryChargePaise: appSchema.saleOrder.deliveryChargePaise,
    })
    .from(appSchema.saleOrder)
    .where(
      and(
        eq(appSchema.saleOrder.restaurantId, restaurantId),
        eq(appSchema.saleOrder.outletId, outletId),
        sql`${appSchema.saleOrder.createdAt} >= ${fromIso}::timestamptz`,
        sql`${appSchema.saleOrder.createdAt} <= ${toIso}::timestamptz`
      )
    );

  let grossSalesPaise = 0;
  let totalOrdersSettled = 0;

  let cashSalesPaise = 0;
  let cashOrdersCount = 0;
  let upiSalesPaise = 0;
  let upiOrdersCount = 0;
  let cardSalesPaise = 0;
  let cardOrdersCount = 0;

  let dineInOrdersCount = 0;
  let dineInSalesPaise = 0;
  let takeawayOrdersCount = 0;
  let takeawaySalesPaise = 0;
  let deliveryOrdersCount = 0;
  let deliverySalesPaise = 0;

  let voidOrdersCount = 0;
  let voidSalesPaise = 0;

  const settledOrderIds: string[] = [];

  for (const o of orders) {
    if (o.status === 'VOID' || o.orderStatus === 'CANCELLED') {
      voidOrdersCount++;
      voidSalesPaise += o.subtotalPaise || 0;
      continue;
    }

    if (o.status === 'PAID') {
      settledOrderIds.push(o.id);
      totalOrdersSettled++;
      const orderAmount = o.paidPaise || (o.subtotalPaise + (o.packagingChargePaise || 0) + (o.deliveryChargePaise || 0));
      grossSalesPaise += orderAmount;

      const m = (o.method || '').toLowerCase();
      if (m.includes('cash')) {
        cashSalesPaise += orderAmount;
        cashOrdersCount++;
      } else if (m.includes('upi') || m.includes('qr')) {
        upiSalesPaise += orderAmount;
        upiOrdersCount++;
      } else {
        cardSalesPaise += orderAmount;
        cardOrdersCount++;
      }

      const oType = (o.orderType || 'DINE_IN').toUpperCase();
      if (oType === 'DINE_IN') {
        dineInOrdersCount++;
        dineInSalesPaise += orderAmount;
      } else if (oType === 'TAKEAWAY') {
        takeawayOrdersCount++;
        takeawaySalesPaise += orderAmount;
      } else if (oType === 'DELIVERY') {
        deliveryOrdersCount++;
        deliverySalesPaise += orderAmount;
      }
    }
  }

  const averageOrderValuePaise =
    totalOrdersSettled > 0 ? Math.round(grossSalesPaise / totalOrdersSettled) : 0;

  // 3. Query Top 5 Selling Items
  let topItems: Array<{ name: string; qty: number; totalPaise: number }> = [];
  if (settledOrderIds.length > 0) {
    const itemRows = await db
      .select({
        name: appSchema.saleOrderItem.nameSnapshot,
        qty: sql<number>`SUM(${appSchema.saleOrderItem.qty})`,
        totalPaise: sql<number>`SUM(${appSchema.saleOrderItem.qty} * ${appSchema.saleOrderItem.pricePaiseSnapshot})`,
      })
      .from(appSchema.saleOrderItem)
      .where(
        and(
          inArray(appSchema.saleOrderItem.orderId, settledOrderIds),
          sql`${appSchema.saleOrderItem.status} != 'CANCELLED'`
        )
      )
      .groupBy(appSchema.saleOrderItem.nameSnapshot)
      .orderBy(sql`SUM(${appSchema.saleOrderItem.qty}) DESC`)
      .limit(5);

    topItems = itemRows.map((r: any) => ({
      name: r.name,
      qty: Number(r.qty || 0),
      totalPaise: Number(r.totalPaise || 0),
    }));
  }

  // 4. Query Expenses for today
  const expenses = await db
    .select({
      id: appSchema.restaurantExpense.id,
      title: appSchema.restaurantExpense.title,
      category: appSchema.restaurantExpense.category,
      amountPaise: appSchema.restaurantExpense.amountPaise,
      paymentMode: appSchema.restaurantExpense.paymentMode,
    })
    .from(appSchema.restaurantExpense)
    .where(
      and(
        eq(appSchema.restaurantExpense.restaurantId, restaurantId),
        eq(appSchema.restaurantExpense.outletId, outletId),
        eq(appSchema.restaurantExpense.expenseDate, dateStr)
      )
    );

  let totalExpensesPaise = 0;
  let cashExpensesPaise = 0;
  let onlineExpensesPaise = 0;
  const categoryMap = new Map<string, { amountPaise: number; count: number }>();

  for (const exp of expenses) {
    totalExpensesPaise += exp.amountPaise;
    const mode = (exp.paymentMode || 'CASH').toUpperCase();
    if (mode === 'CASH') {
      cashExpensesPaise += exp.amountPaise;
    } else {
      onlineExpensesPaise += exp.amountPaise;
    }

    const cat = exp.category || 'OTHER';
    const curr = categoryMap.get(cat) || { amountPaise: 0, count: 0 };
    curr.amountPaise += exp.amountPaise;
    curr.count += 1;
    categoryMap.set(cat, curr);
  }

  const categoryExpenses = Array.from(categoryMap.entries()).map(([cat, val]) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    amountPaise: val.amountPaise,
    count: val.count,
  }));
  categoryExpenses.sort((a, b) => b.amountPaise - a.amountPaise);

  // 5. Query Cash Drawer Register
  const [cashRegister] = await db
    .select()
    .from(appSchema.cashRegisterLog)
    .where(
      and(
        eq(appSchema.cashRegisterLog.outletId, outletId),
        eq(appSchema.cashRegisterLog.date, dateStr)
      )
    )
    .limit(1);

  const openingFloatPaise = cashRegister?.openingFloatPaise || 0;
  const cashInHandPaise = openingFloatPaise + cashSalesPaise - cashExpensesPaise;
  const netProfitPaise = grossSalesPaise - totalExpensesPaise;

  return {
    date: dateStr,
    formattedDate,
    restaurantName,
    outletName,
    ownerPhone,

    grossSalesPaise,
    netSalesPaise: grossSalesPaise,
    totalOrdersSettled,
    averageOrderValuePaise,

    cashSalesPaise,
    cashOrdersCount,
    upiSalesPaise,
    upiOrdersCount,
    cardSalesPaise,
    cardOrdersCount,

    dineInOrdersCount,
    dineInSalesPaise,
    takeawayOrdersCount,
    takeawaySalesPaise,
    deliveryOrdersCount,
    deliverySalesPaise,

    voidOrdersCount,
    voidSalesPaise,

    totalExpensesPaise,
    cashExpensesPaise,
    onlineExpensesPaise,
    categoryExpenses,

    openingFloatPaise,
    cashInHandPaise,
    netProfitPaise,

    topItems,
  };
}

/**
 * Formats a clean, readable, emoji-rich WhatsApp closing report message.
 */
export function formatClosingReportWhatsAppMessage(s: DailyClosingSummary): string {
  const parts: string[] = [];

  parts.push(`🌙 *LogixDine • Daily Business Closing Report*`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  parts.push(`🏪 *${s.restaurantName}* (${s.outletName})`);
  parts.push(`📅 *Date:* ${s.formattedDate}`);
  parts.push(`⏱️ *Closing Time:* 11:59 PM IST`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  parts.push(``);

  // 1. Revenue
  parts.push(`💰 *REVENUE & SALES*`);
  parts.push(`• *Total Gross Sales:* *₹${formatINR(s.grossSalesPaise)}*`);
  parts.push(`• Settled Orders: *${s.totalOrdersSettled}*`);
  if (s.totalOrdersSettled > 0) {
    parts.push(`• Avg Ticket Size (AOV): ₹${formatINR(s.averageOrderValuePaise)}`);
  }
  parts.push(``);

  // 2. Payments
  parts.push(`💳 *PAYMENT BREAKDOWN*`);
  parts.push(`• 💵 Cash: ₹${formatINR(s.cashSalesPaise)} (${s.cashOrdersCount} bills)`);
  parts.push(`• 📱 UPI / QR: ₹${formatINR(s.upiSalesPaise)} (${s.upiOrdersCount} bills)`);
  if (s.cardSalesPaise > 0) {
    parts.push(`• 💳 Cards: ₹${formatINR(s.cardSalesPaise)} (${s.cardOrdersCount} bills)`);
  }
  parts.push(``);

  // 3. Channels
  parts.push(`📦 *SERVICE CHANNELS*`);
  if (s.dineInOrdersCount > 0 || (s.takeawayOrdersCount === 0 && s.deliveryOrdersCount === 0)) {
    parts.push(`• 🍽️ Dine-In: ${s.dineInOrdersCount} orders (₹${formatINR(s.dineInSalesPaise)})`);
  }
  if (s.takeawayOrdersCount > 0) {
    parts.push(`• 🛍️ Takeaway: ${s.takeawayOrdersCount} orders (₹${formatINR(s.takeawaySalesPaise)})`);
  }
  if (s.deliveryOrdersCount > 0) {
    parts.push(`• 🛵 Delivery: ${s.deliveryOrdersCount} orders (₹${formatINR(s.deliverySalesPaise)})`);
  }
  if (s.voidOrdersCount > 0) {
    parts.push(`• ❌ Cancelled / Void: ${s.voidOrdersCount} orders (₹${formatINR(s.voidSalesPaise)})`);
  }
  parts.push(``);

  // 4. Expenses & Petty Cash
  parts.push(`💸 *EXPENSES & PETTY CASH*`);
  parts.push(`• *Total Day Expenses:* *₹${formatINR(s.totalExpensesPaise)}*`);
  parts.push(`• 💵 Petty Cash (Drawer Out): ₹${formatINR(s.cashExpensesPaise)}`);
  parts.push(`• 📱 Online / Bank Paid: ₹${formatINR(s.onlineExpensesPaise)}`);
  if (s.categoryExpenses.length > 0) {
    parts.push(`• Key Outflows:`);
    s.categoryExpenses.slice(0, 4).forEach((c) => {
      parts.push(`   - ${c.label}: ₹${formatINR(c.amountPaise)}`);
    });
  }
  parts.push(``);

  // 5. Drawer & Net Day Profit
  parts.push(`💼 *CASH DRAWER & NET PROFIT*`);
  if (s.openingFloatPaise > 0) {
    parts.push(`• 📥 Opening Cash Float: ₹${formatINR(s.openingFloatPaise)}`);
  }
  parts.push(`• 💵 *Net Cash in Hand:* *₹${formatINR(s.cashInHandPaise)}*`);
  parts.push(`   _(Cash Sales ₹${formatINR(s.cashSalesPaise)} - Petty Cash ₹${formatINR(s.cashExpensesPaise)})_`);
  const profitSign = s.netProfitPaise >= 0 ? '🚀' : '⚠️';
  parts.push(`• ${profitSign} *NET DAY PROFIT:* *₹${formatINR(s.netProfitPaise)}*`);
  parts.push(`   _(Sales ₹${formatINR(s.grossSalesPaise)} - Expenses ₹${formatINR(s.totalExpensesPaise)})_`);
  parts.push(``);

  // 6. Top Items
  if (s.topItems.length > 0) {
    parts.push(`🏆 *TOP 5 SELLING ITEMS TODAY*`);
    s.topItems.forEach((item, idx) => {
      parts.push(`${idx + 1}. *${item.name}*: ${item.qty} pcs (₹${formatINR(item.totalPaise)})`);
    });
    parts.push(``);
  }

  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  parts.push(`✨ _Daily Closing Summary generated automatically by LogixDine POS. Rest well!_`);

  return parts.join('\n');
}

/**
 * Dispatches the daily closing report for an outlet to the owner's WhatsApp.
 */
export async function sendOutletDailyClosingReport(
  db: any,
  env: any,
  restaurantId: string,
  outletId: string,
  customPhone?: string,
  targetDateStr?: string
): Promise<{ success: boolean; recipientPhone: string; summary: DailyClosingSummary; message: string }> {
  const summary = await generateDailyClosingSummary(db, restaurantId, outletId, targetDateStr);
  const targetPhone = (customPhone || summary.ownerPhone || '').trim();

  if (!targetPhone) {
    throw new Error('No owner WhatsApp phone number found. Please set the owner phone in WhatsApp Settings.');
  }

  const message = formatClosingReportWhatsAppMessage(summary);

  await sendWhatsAppText(
    targetPhone,
    message,
    undefined,
    { url: env?.WA_API_URL, apiKey: env?.WA_API_KEY }
  );

  return {
    success: true,
    recipientPhone: targetPhone,
    summary,
    message,
  };
}
