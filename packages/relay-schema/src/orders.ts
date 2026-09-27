import { z } from 'zod';
import { ChannelCodeSchema, type ChannelCode } from './channels';
import { FoodTypeSchema, type FoodType } from './menu';
import {
  NormalizedOrderStatusSchema,
  CancellationReasonCodeSchema,
  type NormalizedOrderStatus,
  type CancellationReasonCode,
} from './lifecycle';

export const CustomerAddressSchema = z.object({
  line1: z.string().default(''),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type CustomerAddress = z.infer<typeof CustomerAddressSchema>;

export const CanonicalCustomerSchema = z.object({
  name: z.string().default('Guest Customer'),
  phone: z.string().default(''),
  email: z.string().optional(),
  address: CustomerAddressSchema.optional(),
});
export type CanonicalCustomer = z.infer<typeof CanonicalCustomerSchema>;

export const SelectedModifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().default(0),
});
export type SelectedModifier = z.infer<typeof SelectedModifierSchema>;

export const CanonicalOrderItemSchema = z.object({
  id: z.string(),
  channelItemId: z.string(),
  name: z.string(),
  quantity: z.number().min(1),
  basePrice: z.number().min(0), // Unit price
  totalPrice: z.number().min(0), // basePrice * qty + modifiers
  foodType: FoodTypeSchema.default('VEG'),
  selectedVariants: z.array(SelectedModifierSchema).default([]),
  selectedAddons: z.array(SelectedModifierSchema).default([]),
  itemInstructions: z.string().optional().default(''),
});
export type CanonicalOrderItem = z.infer<typeof CanonicalOrderItemSchema>;

export const CanonicalTaxItemSchema = z.object({
  label: z.string(), // "CGST 2.5%", "SGST 2.5%"
  rate: z.number(), // 2.5
  amount: z.number(), // in currency units
});
export type CanonicalTaxItem = z.infer<typeof CanonicalTaxItemSchema>;

export const CanonicalPricingBreakdownSchema = z.object({
  subtotal: z.number().default(0),
  packagingCharge: z.number().default(0),
  deliveryCharge: z.number().default(0),
  taxes: z.array(CanonicalTaxItemSchema).default([]),
  totalTax: z.number().default(0),
  discount: z.number().default(0),
  totalAmount: z.number().default(0), // Gross Order Value (GOV)
  customerPaid: z.number().default(0),

  // Marketplace & Reconciliation Ledger
  channelCommissionPercent: z.number().default(0), // e.g. 18%
  channelCommission: z.number().default(0),
  channelCommissionGst: z.number().default(0), // 18% GST on commission
  fixedOrderFee: z.number().default(0),
  paymentGatewayFee: z.number().default(0),
  tcsTds: z.number().default(0), // 1% TCS/TDS
  netSettlementAmount: z.number().default(0), // Amount merchant actually receives
});
export type CanonicalPricingBreakdown = z.infer<typeof CanonicalPricingBreakdownSchema>;

export const RiderTypeSchema = z.enum(['CHANNEL', '3PL', 'IN_HOUSE']);
export type RiderType = z.infer<typeof RiderTypeSchema>;

export const CanonicalRiderDetailsSchema = z.object({
  riderType: RiderTypeSchema.default('CHANNEL'),
  name: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  trackingUrl: z.string().optional().default(''),
  provider: z.string().optional(), // 'SHADOWFAX' | 'DUNZO' | 'PORTER' etc.
  waybillNumber: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  etaMinutes: z.number().optional(),
  status: z.string().optional().default('PENDING'),
});
export type CanonicalRiderDetails = z.infer<typeof CanonicalRiderDetailsSchema>;

export const CanonicalOrderSchema = z.object({
  id: z.string(),
  outletId: z.string(),
  channelCode: ChannelCodeSchema,
  channelOrderId: z.string(),
  displayOrderId: z.string(), // Short ID (e.g. SW-9182, ZOM-4123)
  status: NormalizedOrderStatusSchema,
  orderType: z.enum(['DELIVERY', 'TAKEAWAY', 'DINE_IN']).default('DELIVERY'),
  prepTimeMinutes: z.number().default(20),
  customer: CanonicalCustomerSchema,
  items: z.array(CanonicalOrderItemSchema),
  pricing: CanonicalPricingBreakdownSchema,
  rider: CanonicalRiderDetailsSchema.optional(),
  specialInstructions: z.string().optional().default(''),
  placedAt: z.string(),
  acceptedAt: z.string().optional(),
  readyAt: z.string().optional(),
  dispatchedAt: z.string().optional(),
  deliveredAt: z.string().optional(),
  cancelledAt: z.string().optional(),
  cancellationReason: z.string().optional(),
  cancellationReasonCode: CancellationReasonCodeSchema.optional(),
  rawWebhookPayload: z.any().optional(),
});
export type CanonicalOrder = z.infer<typeof CanonicalOrderSchema>;
