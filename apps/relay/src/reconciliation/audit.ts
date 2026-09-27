import type {
  CanonicalOrder,
  ChannelCode,
  TransactionLedgerItem,
  SettlementCsvRow,
  AuditDiscrepancy,
  PayoutAuditSummary,
} from '@logixsoft/relay-schema';
import { relayStore } from '../db';
import { generateId } from '@logixsoft/helpers/crypto';

/**
 * Builds an itemized financial transaction ledger entry from a canonical order.
 */
export function buildTransactionLedger(order: CanonicalOrder): TransactionLedgerItem {
  const p = order.pricing;
  return {
    orderId: order.id,
    channelCode: order.channelCode,
    channelOrderId: order.channelOrderId,
    orderDate: order.placedAt,
    grossOrderValue: p.totalAmount,
    customerAmountPaid: p.customerPaid || p.totalAmount,
    packagingFee: p.packagingCharge,
    deliveryCharge: p.deliveryCharge,
    gstFoodAmount: p.totalTax,
    marketplaceCommissionPercent: p.channelCommissionPercent,
    marketplaceCommissionAmount: p.channelCommission,
    gstCommissionAmount: p.channelCommissionGst,
    fixedOrderFee: p.fixedOrderFee,
    paymentGatewayFee: p.paymentGatewayFee,
    tcsTdsAmount: p.tcsTds,
    customerDiscountBearingMerchant: p.discount,
    expectedNetPayout: p.netSettlementAmount,
  };
}

/**
 * Parses raw CSV string from Swiggy/Zomato weekly payout settlement report.
 */
export function parseSettlementCsv(csvContent: string): SettlementCsvRow[] {
  const lines = csvContent
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  const rows: SettlementCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 3) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = cols[idx] || '';
    });

    const channelOrderId =
      rowObj['order_id'] ||
      rowObj['channel_order_id'] ||
      rowObj['order id'] ||
      rowObj['swiggy_order_id'] ||
      rowObj['zomato_order_id'] ||
      cols[0];

    const grossAmount = Number(
      rowObj['gross_amount'] || rowObj['order_value'] || rowObj['total_amount'] || cols[1] || 0
    );
    const commissionDeducted = Number(
      rowObj['commission'] || rowObj['commission_amount'] || rowObj['commission_deducted'] || cols[2] || 0
    );
    const taxesDeducted = Number(
      rowObj['taxes'] || rowObj['tax_deducted'] || rowObj['gst_on_commission'] || cols[3] || 0
    );
    const otherDeductions = Number(
      rowObj['other_deductions'] || rowObj['penalties'] || rowObj['deductions'] || cols[4] || 0
    );
    const netPayout = Number(
      rowObj['net_payout'] || rowObj['payout_amount'] || rowObj['net_amount'] || cols[5] || (grossAmount - commissionDeducted - taxesDeducted - otherDeductions)
    );
    const payoutReference = rowObj['payout_reference'] || rowObj['utr'] || rowObj['ref_no'] || '';

    rows.push({
      channelOrderId,
      orderDate: rowObj['date'] || rowObj['order_date'],
      grossAmount,
      commissionDeducted,
      taxesDeducted,
      otherDeductions,
      netPayout,
      payoutReference,
      disputeReason: rowObj['dispute_reason'] || rowObj['remarks'],
    });
  }

  return rows;
}

/**
 * Automatically cross-references weekly settlement CSV records against internal order histories.
 * Flags unauthorized deductions, commission overcharges, or net payout discrepancies.
 */
export async function auditSettlement(params: {
  outletId: string;
  channelCode: ChannelCode;
  csvContent: string;
  payoutReference?: string;
}): Promise<PayoutAuditSummary> {
  const { outletId, channelCode, csvContent } = params;
  const settlementRows = parseSettlementCsv(csvContent);

  const settlementId = generateId('stl');
  const payoutRef =
    params.payoutReference || settlementRows[0]?.payoutReference || `PAYOUT-REF-${Date.now().toString().slice(-6)}`;

  let matchedOrders = 0;
  let flaggedOrders = 0;
  let totalGrossReported = 0;
  let totalCommissionReported = 0;
  let totalNetPayoutReported = 0;
  let totalExpectedNetPayout = 0;
  const discrepancies: AuditDiscrepancy[] = [];

  for (const row of settlementRows) {
    totalGrossReported += row.grossAmount;
    totalCommissionReported += row.commissionDeducted;
    totalNetPayoutReported += row.netPayout;

    // Look up canonical order in database
    const order = await relayStore.getOrderByChannelOrderId(channelCode, row.channelOrderId);

    if (!order) {
      flaggedOrders++;
      discrepancies.push({
        channelOrderId: row.channelOrderId,
        channelCode,
        type: 'ORDER_NOT_FOUND',
        expectedAmount: 0,
        settledAmount: row.netPayout,
        difference: row.netPayout,
        explanation: `Order ${row.channelOrderId} was billed in ${channelCode} settlement but not found in Logix Dine database`,
        severity: 'HIGH',
      });
      continue;
    }

    matchedOrders++;
    const ledger = buildTransactionLedger(order);
    totalExpectedNetPayout += ledger.expectedNetPayout;

    // 1. Check Unauthorized Deductions / Penalties
    if (row.otherDeductions > 0) {
      flaggedOrders++;
      discrepancies.push({
        channelOrderId: row.channelOrderId,
        orderId: order.id,
        channelCode,
        type: 'UNAUTHORIZED_DEDUCTION',
        expectedAmount: 0,
        settledAmount: row.otherDeductions,
        difference: row.otherDeductions,
        explanation: `Unauthorized penalty/deduction of ₹${row.otherDeductions} applied by ${channelCode}`,
        severity: 'CRITICAL',
      });
    }

    // 2. Check Commission Overcharge (> 5% discrepancy or higher commission)
    const expectedCommission = ledger.marketplaceCommissionAmount;
    if (row.commissionDeducted > expectedCommission + 2) {
      // 2 rupees tolerance
      flaggedOrders++;
      const diff = Number((row.commissionDeducted - expectedCommission).toFixed(2));
      discrepancies.push({
        channelOrderId: row.channelOrderId,
        orderId: order.id,
        channelCode,
        type: 'COMMISSION_OVERCHARGE',
        expectedAmount: expectedCommission,
        settledAmount: row.commissionDeducted,
        difference: diff,
        explanation: `Contracted commission ₹${expectedCommission} vs deducted ₹${row.commissionDeducted} (+₹${diff} overcharge)`,
        severity: 'MEDIUM',
      });
    }

    // 3. Check Net Payout Mismatch
    const netDiff = Math.abs(row.netPayout - ledger.expectedNetPayout);
    if (netDiff > 5) {
      // > ₹5 variance
      flaggedOrders++;
      discrepancies.push({
        channelOrderId: row.channelOrderId,
        orderId: order.id,
        channelCode,
        type: 'NET_PAYOUT_MISMATCH',
        expectedAmount: ledger.expectedNetPayout,
        settledAmount: row.netPayout,
        difference: Number((ledger.expectedNetPayout - row.netPayout).toFixed(2)),
        explanation: `Expected payout ₹${ledger.expectedNetPayout} vs actual settled ₹${row.netPayout}`,
        severity: 'HIGH',
      });
    }
  }

  const netDiscrepancyAmount = Number(
    discrepancies.reduce((acc, d) => acc + Math.abs(d.difference), 0).toFixed(2)
  );
  const auditStatus = discrepancies.length > 0 ? 'DISCREPANCIES_DETECTED' : 'RECONCILED';

  const summary: PayoutAuditSummary = {
    settlementId,
    channelCode,
    outletId,
    payoutReference: payoutRef,
    totalOrdersInFile: settlementRows.length,
    matchedOrders,
    flaggedOrders,
    totalGrossReported: Number(totalGrossReported.toFixed(2)),
    totalCommissionReported: Number(totalCommissionReported.toFixed(2)),
    totalNetPayoutReported: Number(totalNetPayoutReported.toFixed(2)),
    totalExpectedNetPayout: Number(totalExpectedNetPayout.toFixed(2)),
    netDiscrepancyAmount,
    discrepancies,
    auditStatus,
  };

  // Persist settlement audit in database
  await relayStore.saveSettlement({
    id: settlementId,
    outletId,
    channelCode,
    payoutReference: payoutRef,
    grossAmount: summary.totalGrossReported,
    commissionDeductions: summary.totalCommissionReported,
    netPayout: summary.totalNetPayoutReported,
    settlementDate: new Date(),
    reconciliationStatus: auditStatus,
    discrepancyAmount: netDiscrepancyAmount,
    discrepancyDetailsJson: discrepancies,
  });

  return summary;
}
