import { z } from 'zod';

export const LogisticsProviderCodeSchema = z.enum([
  'SHADOWFAX',
  'DUNZO',
  'PORTER',
  'BORZO',
  'RAPIDO',
]);
export type LogisticsProviderCode = z.infer<typeof LogisticsProviderCodeSchema>;

export const CoordinatesSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().optional().default(''),
});
export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const LogisticsQuoteRequestSchema = z.object({
  pickupCoords: CoordinatesSchema,
  dropCoords: CoordinatesSchema,
  orderValue: z.number().min(0),
  packageWeight: z.number().default(1.0), // kg
  orderId: z.string().optional(),
});
export type LogisticsQuoteRequest = z.infer<typeof LogisticsQuoteRequestSchema>;

export const CarrierQuoteSchema = z.object({
  providerCode: LogisticsProviderCodeSchema,
  providerName: z.string(),
  feeAmount: z.number(), // in INR
  estimatedDurationMinutes: z.number(),
  pickupEtaMinutes: z.number(),
  isAvailable: z.boolean(),
  quoteId: z.string(),
  expiresAt: z.string(),
});
export type CarrierQuote = z.infer<typeof CarrierQuoteSchema>;

export const MultiCarrierQuoteResponseSchema = z.object({
  quotes: z.array(CarrierQuoteSchema),
  cheapest: CarrierQuoteSchema.nullable(),
  fastest: CarrierQuoteSchema.nullable(),
  recommended: CarrierQuoteSchema.nullable(),
});
export type MultiCarrierQuoteResponse = z.infer<typeof MultiCarrierQuoteResponseSchema>;

export const LogisticsDispatchRequestSchema = z.object({
  orderId: z.string(),
  preferredProvider: LogisticsProviderCodeSchema.optional(),
  quoteId: z.string().optional(),
  pickupContact: z.object({
    name: z.string(),
    phone: z.string(),
  }).optional(),
  dropContact: z.object({
    name: z.string(),
    phone: z.string(),
  }).optional(),
});
export type LogisticsDispatchRequest = z.infer<typeof LogisticsDispatchRequestSchema>;

export const LogisticsDispatchResultSchema = z.object({
  success: z.boolean(),
  dispatchId: z.string(),
  orderId: z.string(),
  providerCode: LogisticsProviderCodeSchema,
  waybillNumber: z.string(),
  feeAmount: z.number(),
  riderName: z.string().optional(),
  riderPhone: z.string().optional(),
  trackingUrl: z.string(),
  status: z.enum([
    'PENDING',
    'RIDER_ASSIGNED',
    'ARRIVED_AT_STORE',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ]),
});
export type LogisticsDispatchResult = z.infer<typeof LogisticsDispatchResultSchema>;

export const RiderTrackingUpdateSchema = z.object({
  orderId: z.string(),
  waybillNumber: z.string(),
  providerCode: LogisticsProviderCodeSchema,
  status: z.enum([
    'RIDER_ASSIGNED',
    'ARRIVED_AT_STORE',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ]),
  riderName: z.string().optional(),
  riderPhone: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  etaMinutes: z.number().optional(),
  trackingUrl: z.string().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
});
export type RiderTrackingUpdate = z.infer<typeof RiderTrackingUpdateSchema>;
