import { z } from 'zod';

export const BecknContextSchema = z.object({
  domain: z.string().default('nic2004:52110'), // Food & Beverage
  country: z.string().default('IND'),
  city: z.string().default('std:080'),
  action: z.enum([
    'search',
    'on_search',
    'select',
    'on_select',
    'init',
    'on_init',
    'confirm',
    'on_confirm',
    'status',
    'on_status',
    'track',
    'on_track',
    'cancel',
    'on_cancel',
    'update',
    'on_update',
  ]),
  core_version: z.string().default('1.2.0'),
  bap_id: z.string(),
  bap_uri: z.string(),
  bpp_id: z.string().optional(),
  bpp_uri: z.string().optional(),
  transaction_id: z.string(),
  message_id: z.string(),
  timestamp: z.string(),
  ttl: z.string().optional().default('PT30S'),
  key: z.string().optional(),
});
export type BecknContext = z.infer<typeof BecknContextSchema>;

export const BecknDescriptorSchema = z.object({
  name: z.string(),
  code: z.string().optional(),
  symbol: z.string().optional(),
  short_desc: z.string().optional(),
  long_desc: z.string().optional(),
  images: z.array(z.string()).optional(),
});

export const BecknPriceSchema = z.object({
  currency: z.string().default('INR'),
  value: z.string(), // "250.00"
  estimated_value: z.string().optional(),
  computed_value: z.string().optional(),
  listed_value: z.string().optional(),
  offered_value: z.string().optional(),
  minimum_value: z.string().optional(),
  maximum_value: z.string().optional(),
});

export const BecknItemSchema = z.object({
  id: z.string(),
  parent_item_id: z.string().optional(),
  descriptor: BecknDescriptorSchema,
  price: BecknPriceSchema,
  category_id: z.string().optional(),
  fulfillment_id: z.string().optional(),
  location_id: z.string().optional(),
  tags: z.any().optional(),
});

export const BecknBreakupItemSchema = z.object({
  title: z.string(),
  price: BecknPriceSchema,
  item: z.object({
    id: z.string().optional(),
    quantity: z.object({ count: z.number() }).optional(),
    price: BecknPriceSchema.optional(),
  }).optional(),
  '@ondc/org/item_id': z.string().optional(),
  '@ondc/org/title_type': z.enum(['item', 'tax', 'packing', 'delivery', 'discount', 'misc']).optional(),
});

export const BecknQuoteSchema = z.object({
  price: BecknPriceSchema,
  breakup: z.array(BecknBreakupItemSchema),
  ttl: z.string().optional().default('P1D'),
});

export const BecknAddressSchema = z.object({
  door: z.string().optional(),
  name: z.string().optional(),
  building: z.string().optional(),
  street: z.string().optional(),
  locality: z.string().optional(),
  ward: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional().default('IND'),
  area_code: z.string().optional(),
});

export const BecknBillingSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  address: BecknAddressSchema.optional(),
  tax_number: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const BecknFulfillmentSchema = z.object({
  id: z.string(),
  type: z.enum(['Delivery', 'Pickup', 'Delivery-and-Pickup']).default('Delivery'),
  state: z.object({
    descriptor: z.object({
      code: z.string(),
      name: z.string().optional(),
    }),
  }).optional(),
  tracking: z.boolean().default(true),
  customer: z.object({
    person: z.object({ name: z.string().optional() }).optional(),
    contact: z.object({ phone: z.string().optional(), email: z.string().optional() }).optional(),
  }).optional(),
  end: z.object({
    location: z.object({
      gps: z.string().optional(), // "12.9715987,77.5945627"
      address: BecknAddressSchema.optional(),
    }).optional(),
    contact: z.object({ phone: z.string().optional(), email: z.string().optional() }).optional(),
  }).optional(),
  agent: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  vehicle: z.object({
    category: z.string().optional(),
    registration: z.string().optional(),
  }).optional(),
});

export const BecknPaymentSchema = z.object({
  uri: z.string().optional(),
  tl_method: z.string().optional(),
  params: z.record(z.string(), z.any()).optional(),
  type: z.enum(['ON-ORDER', 'PRE-FULFILLMENT', 'ON-FULFILLMENT', 'POST-FULFILLMENT']).default('ON-ORDER'),
  status: z.enum(['PAID', 'NOT-PAID', 'PENDING']).default('PAID'),
  collected_by: z.enum(['BAP', 'BPP']).default('BAP'),
  '@ondc/org/buyer_app_finder_fee_type': z.string().optional(),
  '@ondc/org/buyer_app_finder_fee_amount': z.string().optional(),
  '@ondc/org/settlement_details': z.array(z.any()).optional(),
});

export const BecknOrderSchema = z.object({
  id: z.string().optional(),
  state: z.string().default('Created'),
  items: z.array(
    z.object({
      id: z.string(),
      quantity: z.object({ count: z.number() }),
      fulfillment_id: z.string().optional(),
    })
  ),
  billing: BecknBillingSchema.optional(),
  fulfillments: z.array(BecknFulfillmentSchema).optional(),
  quote: BecknQuoteSchema.optional(),
  payment: BecknPaymentSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const BecknRequestSchema = z.object({
  context: BecknContextSchema,
  message: z.record(z.string(), z.any()),
});
export type BecknRequest = z.infer<typeof BecknRequestSchema>;

export const BecknAckResponseSchema = z.object({
  message: z.object({
    ack: z.object({
      status: z.enum(['ACK', 'NACK']),
    }),
  }),
  error: z.object({
    code: z.string(),
    message: z.string(),
    path: z.string().optional(),
  }).optional(),
});
export type BecknAckResponse = z.infer<typeof BecknAckResponseSchema>;
