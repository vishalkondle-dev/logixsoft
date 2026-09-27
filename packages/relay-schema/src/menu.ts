import { z } from 'zod';
import { ChannelCodeSchema, type ChannelCode } from './channels';

export const FoodTypeSchema = z.enum(['VEG', 'NON_VEG', 'EGG', 'VEGAN']);
export type FoodType = z.infer<typeof FoodTypeSchema>;

export const DayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

export const OperatingHourSchema = z.object({
  day: DayOfWeekSchema,
  openTime: z.string(), // "09:00"
  closeTime: z.string(), // "23:00"
  isOpen: z.boolean().default(true),
});
export type OperatingHour = z.infer<typeof OperatingHourSchema>;

export const SlotTimingSchema = z.object({
  slotName: z.string(), // "Breakfast", "Lunch", "Dinner"
  startTime: z.string(), // "11:00"
  endTime: z.string(), // "15:00"
  isAvailable: z.boolean().default(true),
});
export type SlotTiming = z.infer<typeof SlotTimingSchema>;

export const PackagingSettingsSchema = z.object({
  itemLevelDefault: z.number().default(10), // e.g. Rs 10
  orderLevelDefault: z.number().default(20), // e.g. Rs 20
  maxPackagingCharge: z.number().default(100),
});
export type PackagingSettings = z.infer<typeof PackagingSettingsSchema>;

export const TaxSlabSchema = z.object({
  id: z.string(),
  name: z.string(), // "GST 5%", "GST 18%"
  ratePercent: z.number(), // 5.0
  cgstPercent: z.number().default(2.5),
  sgstPercent: z.number().default(2.5),
  igstPercent: z.number().optional(),
});
export type TaxSlab = z.infer<typeof TaxSlabSchema>;

export const ChannelPriceMultiplierSchema = z.object({
  channelCode: ChannelCodeSchema,
  markupPercent: z.number().default(0), // e.g. 20 for +20% on Zomato, 0 on ONDC
  roundingMode: z.enum(['ROUND', 'CEIL', 'FLOOR', 'NONE']).default('ROUND'),
  minimumPrice: z.number().optional(),
});
export type ChannelPriceMultiplier = z.infer<typeof ChannelPriceMultiplierSchema>;

export const VariantItemSchema = z.object({
  id: z.string(),
  name: z.string(), // "Regular", "Large"
  priceModifier: z.number().default(0), // +50
  isDefault: z.boolean().optional().default(false),
  is86ed: z.boolean().optional().default(false),
});
export type VariantItem = z.infer<typeof VariantItemSchema>;

export const VariantGroupSchema = z.object({
  id: z.string(),
  name: z.string(), // "Size", "Crust"
  minSelections: z.number().default(1),
  maxSelections: z.number().default(1),
  variants: z.array(VariantItemSchema).default([]),
});
export type VariantGroup = z.infer<typeof VariantGroupSchema>;

export const AddonItemSchema = z.object({
  id: z.string(),
  name: z.string(), // "Extra Cheese", "Dip"
  price: z.number().default(0),
  is86ed: z.boolean().optional().default(false),
});
export type AddonItem = z.infer<typeof AddonItemSchema>;

export const AddonGroupSchema = z.object({
  id: z.string(),
  name: z.string(), // "Addons", "Beverages"
  minSelections: z.number().default(0),
  maxSelections: z.number().default(10),
  addons: z.array(AddonItemSchema).default([]),
});
export type AddonGroup = z.infer<typeof AddonGroupSchema>;

export const ItemTaxSchema = z.object({
  taxId: z.string(),
  ratePercent: z.number(),
});
export type ItemTax = z.infer<typeof ItemTaxSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  foodType: FoodTypeSchema.default('VEG'),
  basePrice: z.number().min(0), // Price in base currency units (e.g. 250 = Rs 250)
  taxes: z.array(ItemTaxSchema).default([]),
  packagingFee: z.number().default(0),
  imageUrls: z.array(z.string()).default([]),
  is86ed: z.boolean().default(false), // out-of-stock
  variantGroups: z.array(VariantGroupSchema).optional().default([]),
  addonGroups: z.array(AddonGroupSchema).optional().default([]),
  channelOverrides: z
    .record(
      z.string(),
      z.object({
        price: z.number().optional(),
        isAvailable: z.boolean().optional(),
      })
    )
    .optional()
    .default({}),
});
export type Item = z.infer<typeof ItemSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().default(''),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
  items: z.array(ItemSchema).default([]),
});
export type Category = z.infer<typeof CategorySchema>;

export const OutletCatalogSchema = z.object({
  outletId: z.string(),
  name: z.string(),
  operatingHours: z.array(OperatingHourSchema).default([]),
  slotTimings: z.array(SlotTimingSchema).default([]),
  packagingCharges: PackagingSettingsSchema.default({
    itemLevelDefault: 10,
    orderLevelDefault: 20,
    maxPackagingCharge: 100,
  }),
  taxSlabs: z.array(TaxSlabSchema).default([]),
  channelMarkupSettings: z.array(ChannelPriceMultiplierSchema).default([]),
  categories: z.array(CategorySchema).default([]),
});
export type OutletCatalog = z.infer<typeof OutletCatalogSchema>;

/**
 * Calculates dynamic pricing for an item based on channel markup settings and channel overrides.
 */
export function calculateItemChannelPrice(
  item: Item,
  channelCode: ChannelCode,
  channelMultipliers?: ChannelPriceMultiplier[]
): number {
  if (item.channelOverrides && item.channelOverrides[channelCode]?.price !== undefined) {
    return item.channelOverrides[channelCode].price!;
  }

  const multiplier = channelMultipliers?.find((m) => m.channelCode === channelCode);
  if (!multiplier || multiplier.markupPercent === 0) {
    return item.basePrice;
  }

  const rawPrice = item.basePrice * (1 + multiplier.markupPercent / 100);

  switch (multiplier.roundingMode) {
    case 'ROUND':
      return Math.round(rawPrice);
    case 'CEIL':
      return Math.ceil(rawPrice);
    case 'FLOOR':
      return Math.floor(rawPrice);
    default:
      return Number(rawPrice.toFixed(2));
  }
}
