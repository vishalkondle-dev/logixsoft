import { Context } from 'hono';
import { cacheGet, cacheSet, CacheKey } from './cache';

export interface SubscriptionPlan {
  id: 'BASIC' | 'PRO';
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  features: string[];
}

export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'BASIC',
    name: 'Starter Plan',
    monthlyPrice: 999,
    annualPrice: 9990,
    features: [
      'Standard POS Terminal',
      'KOT Generation & Printing',
      'Table & Section Layouts',
      'GST Invoicing & Thermal Bills',
      'Unlimited Orders',
      'Email & Chat Support',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro Plan',
    monthlyPrice: 1499,
    annualPrice: 14990,
    popular: true,
    features: [
      'Everything in Starter',
      'Unlimited Waiter Mobile Apps',
      'Kitchen Display System (KDS)',
      'Inventory & Recipe BOM Costing',
      'WhatsApp Instant e-Bills',
      'Advanced Analytics & Tax Audit',
      'Online Aggregators (Swiggy, Zomato)',
      'Table Reservations & Custom Roles Matrix',
    ],
  },
];

/**
 * Retrieve active subscription plans, applying any admin-customized pricing from KV cache.
 */
export async function getSubscriptionPlans(c: Context): Promise<SubscriptionPlan[]> {
  const kv = (c.env as any)?.CACHE;
  if (!kv) return DEFAULT_PLANS;

  try {
    const cached = await cacheGet<SubscriptionPlan[]>(kv, CacheKey.plans());
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return DEFAULT_PLANS.map((defaultPlan) => {
        const found = cached.find((p) => p.id === defaultPlan.id);
        if (!found) return defaultPlan;
        return {
          ...defaultPlan,
          name: found.name || defaultPlan.name,
          monthlyPrice:
            typeof found.monthlyPrice === 'number' && found.monthlyPrice >= 0
              ? found.monthlyPrice
              : defaultPlan.monthlyPrice,
          annualPrice:
            typeof found.annualPrice === 'number' && found.annualPrice >= 0
              ? found.annualPrice
              : defaultPlan.annualPrice,
          features: found.features || defaultPlan.features,
        };
      });
    }
  } catch (err) {
    console.error('Error fetching subscription plans from cache:', err);
  }

  return DEFAULT_PLANS;
}

/**
 * Save updated plan prices (Admin only).
 */
export async function saveSubscriptionPlans(
  c: Context,
  updates: Array<{ id: string; monthlyPrice?: number; annualPrice?: number; name?: string }>
): Promise<SubscriptionPlan[]> {
  const current = await getSubscriptionPlans(c);
  const updated = current.map((p) => {
    const u = updates.find((item) => item.id === p.id);
    if (!u) return p;
    return {
      ...p,
      monthlyPrice:
        typeof u.monthlyPrice === 'number' && u.monthlyPrice >= 0
          ? u.monthlyPrice
          : p.monthlyPrice,
      annualPrice:
        typeof u.annualPrice === 'number' && u.annualPrice >= 0
          ? u.annualPrice
          : p.annualPrice,
      name: u.name || p.name,
    };
  });

  const kv = (c.env as any)?.CACHE;
  if (kv) {
    await cacheSet(kv, CacheKey.plans(), updated, 0); // 0 = permanent / no expiration
  }

  return updated;
}

/**
 * Resolves final price in rupees for a specific outlet, taking into account any negotiated custom price override.
 */
export function resolveOutletPlanPricing(
  outlet: any,
  plan: SubscriptionPlan,
  billingCycle: 'MONTHLY' | 'ANNUAL' | string = 'MONTHLY'
): {
  monthlyPrice: number;
  annualPrice: number;
  effectivePrice: number;
  isCustom: boolean;
} {
  const customPricing = outlet?.invoiceSettings?.customPlanPricing;
  const isMonthlyCustom = typeof customPricing?.monthlyPrice === 'number' && customPricing.monthlyPrice >= 0;
  const isAnnualCustom = typeof customPricing?.annualPrice === 'number' && customPricing.annualPrice >= 0;

  const monthlyPrice = isMonthlyCustom ? customPricing.monthlyPrice : plan.monthlyPrice;
  const annualPrice = isAnnualCustom ? customPricing.annualPrice : plan.annualPrice;
  const effectivePrice = billingCycle === 'ANNUAL' ? annualPrice : monthlyPrice;

  return {
    monthlyPrice,
    annualPrice,
    effectivePrice,
    isCustom: isMonthlyCustom || isAnnualCustom,
  };
}
