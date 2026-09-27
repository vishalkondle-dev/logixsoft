import { z } from 'zod';
import { ChannelCodeSchema, type ChannelCode } from './channels';

export const TransactionLedgerItemSchema = z.object({
  orderId: z.string(),
  channelCode: ChannelCodeSchema,
  channelOrderId: z.string(),
  orderDate: z.string(),
  grossOrderValue: z.number(), // Customer bill before discounts
  customerAmountPaid: z.number(),
  packagingFee: z.number().default(0),
  deliveryCharge: z.number().default(0),
  gstFoodAmount: z.number().default(0), // 5% GST
  marketplaceCommissionPercent: z.number().default(0),
  marketplaceCommissionAmount: z.number().default(0),
  gstCommissionAmount: z.number().default(0), // 18% GST on Commission
  fixedOrderFee: z.number().default(0),
  paymentGatewayFee: z.number().default(0),
  tcsTdsAmount: z.number().default(0), // 1% TCS/TDS
  customerDiscountBearingMerchant: z.number().default(0),
  expectedNetPayout: z.number(),
});
export type TransactionLedgerItem = z.infer<typeof TransactionLedgerItemSchema>;

export const SettlementCsvRowSchema = z.object({
  channelOrderId: z.string(),
  orderDate: z.string().optional(),
  grossAmount: z.number(),
  commissionDeducted: z.number(),
  taxesDeducted: z.number(),
  otherDeductions: z.number().default(0),
  netPayout: z.number(),
  payoutReference: z.string().optional(),
  disputeReason: z.string().optional(),
});
export type SettlementCsvRow = z.infer<typeof SettlementCsvRowSchema>;

export const DiscrepancyTypeSchema = z.enum([
  'ORDER_NOT_FOUND',
  'COMMISSION_OVERCHARGE',
  'UNAUTHORIZED_DEDUCTION',
  'NET_PAYOUT_MISMATCH',
  'WRONGFUL_CANCELLATION_PENALTY',
  'TAX_MISMATCH',
]);
export type DiscrepancyType = z.infer<typeof DiscrepancyTypeSchema>;

export const AuditDiscrepancySchema = z.object({
  channelOrderId: z.string(),
  orderId: z.string().optional(),
  channelCode: ChannelCodeSchema,
  type: DiscrepancyTypeSchema,
  expectedAmount: z.number(),
  settledAmount: z.number(),
  difference: z.number(),
  explanation: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});
export type AuditDiscrepancy = z.infer<typeof AuditDiscrepancySchema>;

export const PayoutAuditSummarySchema = z.object({
  settlementId: z.string(),
  channelCode: ChannelCodeSchema,
  outletId: z.string(),
  payoutReference: z.string(),
  totalOrdersInFile: z.number(),
  matchedOrders: z.number(),
  flaggedOrders: z.number(),
  totalGrossReported: z.number(),
  totalCommissionReported: z.number(),
  totalNetPayoutReported: z.number(),
  totalExpectedNetPayout: z.number(),
  netDiscrepancyAmount: z.number(),
  discrepancies: z.array(AuditDiscrepancySchema),
  auditStatus: z.enum(['RECONCILED', 'DISCREPANCIES_DETECTED', 'REJECTED']),
});
export type PayoutAuditSummary = z.infer<typeof PayoutAuditSummarySchema>;
