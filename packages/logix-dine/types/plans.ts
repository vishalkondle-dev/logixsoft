/**
 * Plan tiers, module licensing, and feature gating matrix for Logix Dine SaaS.
 * Strictly 2 plans: BASIC (Starter Plan) and PRO (Pro Plan).
 */

export const PLAN_TIERS = ['BASIC', 'PRO'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const OUTLET_STATUSES = ['ACTIVE', 'SUSPENDED', 'EXPIRED'] as const;
export type OutletStatus = (typeof OUTLET_STATUSES)[number];

/**
 * Standard free trial duration (in days) granted to newly onboarded outlets.
 */
export const DEFAULT_FREE_TRIAL_DAYS = 7;

export const PLAN_MODULE_IDS = [
  // ─── Starter / Basic Modules (₹999/mo) ───
  'pos',           // POS Counter Terminal & Billing
  'tables',        // Floor plan & dining tables
  'menu',          // Menu catalog, categories, items & pricing
  'printing',      // Thermal receipts & hardware configuration
  'tax',           // Invoice, GST slabs & service charges
  'dining',        // Dining options (dine-in, takeaway, delivery toggle)
  'hours',         // Store operating hours
  'customers',     // Customer directory & basic CRM
  'feedback',      // Customer reviews & ratings
  'staff',         // Staff & team roster
  'reports',       // Sales reports & daily register close
  'qr_menu',       // QR menu view & table ordering
  'settings',      // Store profile & outlet settings
  'billing',       // Subscription & SaaS billing (always accessible)

  // ─── Pro Modules (₹1,499/mo) ───
  'kitchen',       // Kitchen Display System (KDS) bump screens & stations
  'waiter',        // Waiter mobility tableside ordering app
  'inventory',     // Inventory balances, stock waste & recipe BOM costing
  'delivery',      // In-house delivery fleet & rider dispatch
  'aggregators',   // Online aggregators relay (Swiggy, Zomato, Magicpin, ONDC)
  'whatsapp',      // WhatsApp automated bills & order notifications
  'reservations',  // Table reservations & bookings
  'roles',         // Custom team roles & granular permissions matrix
] as const;

export type PlanModuleId = (typeof PLAN_MODULE_IDS)[number];

/**
 * Numeric plan rank used for tier comparisons.
 */
export const PLAN_RANKS: Record<PlanTier, number> = {
  BASIC: 1,
  PRO: 2,
};

/**
 * Minimum plan tier required for each module.
 */
export const MODULE_MIN_PLAN: Record<PlanModuleId, PlanTier> = {
  // Starter
  pos: 'BASIC',
  tables: 'BASIC',
  menu: 'BASIC',
  printing: 'BASIC',
  tax: 'BASIC',
  dining: 'BASIC',
  hours: 'BASIC',
  customers: 'BASIC',
  feedback: 'BASIC',
  staff: 'BASIC',
  reports: 'BASIC',
  qr_menu: 'BASIC',
  settings: 'BASIC',
  billing: 'BASIC',

  // Pro
  kitchen: 'PRO',
  waiter: 'PRO',
  inventory: 'PRO',
  delivery: 'PRO',
  aggregators: 'PRO',
  whatsapp: 'PRO',
  reservations: 'PRO',
  roles: 'PRO',
};

export interface PlanModuleInfo {
  id: PlanModuleId;
  name: string;
  minPlan: PlanTier;
  minPlanLabel: string;
  minPlanPrice: number;
  description: string;
  highlights: string[];
}

export const MODULE_INFO_CATALOG: Record<PlanModuleId, PlanModuleInfo> = {
  pos: {
    id: 'pos',
    name: 'POS Billing Terminal',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'High-speed billing counter, cash register, discount controls, and payment settlement.',
    highlights: ['Table check splitting', 'Cash, Card & UPI tenders', 'Thermal receipt generation', 'Daily shift register'],
  },
  tables: {
    id: 'tables',
    name: 'Table Floor Management',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Floor layout visualizer, dining sections, real-time table occupancy, and elapsed service times.',
    highlights: ['Interactive floor plan', 'Dining sections', 'Occupancy indicators', 'Table merge & transfer'],
  },
  menu: {
    id: 'menu',
    name: 'Menu Catalog & Pricing',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Categories, dishes, portion variants, addons, tax slabs, and instant 86/out-of-stock toggles.',
    highlights: ['Portion sizes & variants', 'Addon modifiers', '86 sold-out switch', 'High-res food photography'],
  },
  printing: {
    id: 'printing',
    name: 'Thermal Receipt & KOT Printers',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Network, USB, and Bluetooth ESC/POS thermal printing for customer checks and kitchen KOT tickets.',
    highlights: ['LAN & Bluetooth support', 'Station KOT routing', 'Automatic paper cut', 'Cash drawer kick'],
  },
  tax: {
    id: 'tax',
    name: 'GST Invoicing & Taxes',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'GSTIN tax slabs, tax-inclusive or exclusive pricing, packaging fees, and restaurant service charges.',
    highlights: ['CGST & SGST splits', 'Compliant tax invoices', 'Flexible service charges', 'Takeaway packaging fees'],
  },
  dining: {
    id: 'dining',
    name: 'Dining & Service Options',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Configure and toggle service modes including Dine-In, Direct Takeaway, and Pickups.',
    highlights: ['Dine-In seating modes', 'Takeaway workflow', 'Custom cover counts', 'Counter pickup'],
  },
  hours: {
    id: 'hours',
    name: 'Store Operating Hours',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Weekly operating schedules, afternoon prep breaks, and holiday closures.',
    highlights: ['7-day weekly schedule', 'Dual shift times', 'Service rush timing', 'Automatic online pause'],
  },
  customers: {
    id: 'customers',
    name: 'Customer Directory & CRM',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Guest phone database, lifetime spend metrics, visit frequencies, and saved delivery addresses.',
    highlights: ['Guest purchase history', 'VIP guest notes', 'Food allergies & tags', 'Saved delivery addresses'],
  },
  feedback: {
    id: 'feedback',
    name: 'Customer Reviews & Ratings',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'In-app guest reviews, dish star ratings, positive compliment tags, and official management responses.',
    highlights: ['5-star dish rating', 'Guest compliment tags', 'Direct management replies', 'Staff performance insight'],
  },
  staff: {
    id: 'staff',
    name: 'Staff & Team Roster',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Staff account invites, WhatsApp OTP logins, outlet scopes, and role assignments.',
    highlights: ['Instant WhatsApp invites', 'Branch access scoping', 'Pin & OTP authentication', 'Active staff roster'],
  },
  reports: {
    id: 'reports',
    name: 'Analytics & Sales Reports',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Daily cashier summary, gross revenue trends, hourly rush heatmaps, and tax audit data exports.',
    highlights: ['End-of-day register summary', 'Hourly rush heatmaps', 'Top selling items', 'GST tax report export'],
  },
  qr_menu: {
    id: 'qr_menu',
    name: 'Digital QR Table Menu',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Contactless QR codes for dining tables with live mobile ordering and instant kitchen dispatch.',
    highlights: ['Table-specific QR stickers', 'Live digital mobile catalog', 'Direct guest self-ordering', 'Digital UPI bill pay'],
  },
  settings: {
    id: 'settings',
    name: 'Store & Branch Settings',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Restaurant branding, outlet address, phone contacts, UPI VPA IDs, and currency options.',
    highlights: ['Branch profiles', 'UPI payment QR configs', 'Contact details', 'Currency & localization'],
  },
  billing: {
    id: 'billing',
    name: 'Subscription & Billing',
    minPlan: 'BASIC',
    minPlanLabel: 'Starter Plan',
    minPlanPrice: 999,
    description: 'Per-branch subscription plans, license renewals, payment invoices, and plan upgrades.',
    highlights: ['Independent branch plans', 'Monthly & annual billing', 'Downloadable tax receipts', 'Instant module unlocking'],
  },

  // ─── PRO MODULES ───
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen Display System (KDS)',
    minPlan: 'PRO',
    minPlanLabel: 'Pro Plan',
    minPlanPrice: 1499,
    description: 'Real-time kitchen bump display screen, order preparation timers, station routing, and ticket recall.',
    highlights: [
      'Interactive bump screens for cooks',
      'Preparation countdown & delay alerts',
      'Split KOTs across Bar, Tandoor & Main Kitchen',
      'Ticket recall and audio rush alerts',
    ],
  },
  waiter: {
    id: 'waiter',
    name: 'Waiter Mobility Mobile App',
    minPlan: 'PRO',
    minPlanLabel: 'Pro Plan',
    minPlanPrice: 1499,
    description: 'Handheld mobile order punching, tableside check requests, and guest assistance bell notifications.',
    highlights: [
      'Punch orders directly at guest tables',
      'Instant KOT firing to kitchen displays',
      'Receive guest call bells (water, cutlery, bill)',
      'Tableside bill settlement',
    ],
  },
  inventory: {
    id: 'inventory',
    name: 'Inventory & Recipe BOM Costing',
    minPlan: 'PRO',
    minPlanLabel: 'Pro Plan',
    minPlanPrice: 1499,
    description: 'Raw ingredient stock management, low-stock threshold alerts, supplier POs, and recipe-level auto deductions.',
    highlights: [
      'Automatic raw ingredient deduction per order',
      'Recipe Bill of Materials (BOM) & food costing',
      'Stock wastage logging & supplier purchase orders',
      'Low-stock alerts & inventory valuation',
    ],
  },
  delivery: {
    id: 'delivery',
    name: 'In-House Delivery Fleet & Riders',
    minPlan: 'PRO',
    minPlanLabel: 'Pro Plan',
    minPlanPrice: 1499,
    description: 'Delivery dispatch queue, assigned in-house couriers, live delivery state tracking, and customer address registry.',
    highlights: [
      'Dispatch queue with rider assignment',
      'Dedicated mobile screen for delivery riders',
      'Customer address book with landmark pinning',
      'Order dispatch status tracking',
    ],
  },
  aggregators: {
    id: 'aggregators',
    name: 'Online Delivery Aggregators (Relay)',
    minPlan: 'PRO',
    minPlanLabel: 'Pro Plan',
    minPlanPrice: 1499,
    description: 'Omnichannel gateway for Swiggy, Zomato, Magicpin, and ONDC with auto-accept and live menu sync.',
    highlights: [
      'Swiggy & Zomato order consolidation in one screen',
      'Unified thermal KOT printing for all channels',
      'Single-click store pause during peak rush',
      'Aggregator-specific price markups',
    ],
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp Instant e-Bills & Alerts',
    minPlan: 'PRO',
    minPlanLabel: 'Pro Plan',
    minPlanPrice: 1499,
    description: 'Automated digital PDF bills sent directly to customers over WhatsApp, plus staff OTP and order status alerts.',
    highlights: [
      'Instant paperless e-receipts to guest WhatsApp',
      'Save thermal roll costs & delight customers',
      'Order dispatch & delivery arrival pings',
      'Secure WhatsApp OTP for staff logins',
    ],
  },
  reservations: {
    id: 'reservations',
    name: 'Table Reservations & Bookings',
    minPlan: 'PRO',
    minPlanLabel: 'Pro Plan',
    minPlanPrice: 1499,
    description: 'Guest table reservation book, party sizes, date/time slots, special dietary notes, and guest seating.',
    highlights: [
      'Digital reservation calendar & time slots',
      'Track party sizes, VIP guests & special requests',
      'Quick seating of arriving reservation parties',
      'Automated table status transitions',
    ],
  },
  roles: {
    id: 'roles',
    name: 'Custom Roles & Security Matrix',
    minPlan: 'PRO',
    minPlanLabel: 'Pro Plan',
    minPlanPrice: 1499,
    description: 'Granular sub-feature permission matrix, custom staff roles, and fine-tuned operational privileges.',
    highlights: [
      'Create custom roles (Supervisor, Shift Lead, Barista)',
      '18-module granular permission security matrix',
      'Lock sensitive voids, discounts, and tax settings',
      'Zero-delay permission enforcement',
    ],
  },
};

/**
 * Mapping between granular permission keys and their parent PlanModuleId.
 */
export const PERMISSION_TO_MODULE_MAP: Record<string, PlanModuleId> = {
  // POS & Orders
  'pos:view': 'pos',
  'pos:order_create': 'pos',
  'pos:discount_apply': 'pos',
  'pos:bill_settle': 'pos',
  'pos:bill_void': 'pos',
  'pos:table_transfer': 'pos',
  'pos:reprint_bill': 'pos',
  'pos:kiosk_lock': 'pos',
  'order:create': 'pos',
  'order:read': 'pos',
  'order:settle': 'pos',
  'order:void': 'pos',

  // Tables
  'tables:view': 'tables',
  'tables:status_change': 'tables',
  'tables:layout_edit': 'tables',
  'table:read': 'tables',
  'table:write': 'tables',

  // Menu
  'menu:view': 'menu',
  'menu:toggle_stock': 'menu',
  'menu:create_edit': 'menu',
  'menu:delete': 'menu',
  'menu:read': 'menu',
  'menu:write': 'menu',

  // Printing
  'printing:view': 'printing',
  'printing:test': 'printing',
  'printing:manage': 'printing',

  // Tax
  'tax:view': 'tax',
  'tax:manage': 'tax',

  // Customer Feedback
  'feedback:view': 'feedback',
  'feedback:reply': 'feedback',
  'feedback:read': 'feedback',

  // Reports
  'reports:view_summary': 'reports',
  'reports:view_analytics': 'reports',
  'reports:export': 'reports',
  'report:read': 'reports',

  // Store & Settings
  'settings:view': 'settings',
  'settings:edit_store': 'settings',
  'settings:manage_outlets': 'settings',
  'restaurant:read': 'settings',
  'restaurant:write': 'settings',
  'outlet:read': 'settings',
  'outlet:write': 'settings',

  // Staff
  'staff:view': 'staff',
  'staff:invite': 'staff',
  'staff:manage': 'staff',
  'member:read': 'staff',
  'member:write': 'staff',

  // Customer CRM
  'customers:view': 'customers',
  'customers:manage': 'customers',

  // QR Menu
  'qr_menu:view': 'qr_menu',
  'qr_menu:manage': 'qr_menu',

  // ─── PRO PERMISSIONS ───
  'kitchen:view': 'kitchen',
  'kitchen:item_bump': 'kitchen',
  'kitchen:recall': 'kitchen',
  'kitchen:station_filter': 'kitchen',
  'kitchen:read': 'kitchen',
  'kitchen:write': 'kitchen',

  'waiter:view': 'waiter',
  'waiter:punch_order': 'waiter',
  'waiter:attend_call': 'waiter',
  'waiter:request_bill': 'waiter',
  'waiter:settle_bill': 'waiter',
  'waiter:read': 'waiter',
  'waiter:write': 'waiter',

  'inventory:view': 'inventory',
  'inventory:adjust_stock': 'inventory',
  'inventory:manage_recipes': 'inventory',
  'inventory:read': 'inventory',
  'inventory:write': 'inventory',

  'delivery:view': 'delivery',
  'delivery:assign_rider': 'delivery',
  'delivery:status_update': 'delivery',
  'delivery:manage_riders': 'delivery',
  'delivery:read': 'delivery',
  'delivery:write': 'delivery',

  'aggregators:view': 'aggregators',
  'aggregators:toggle_store': 'aggregators',
  'aggregators:manage_config': 'aggregators',

  'whatsapp:view': 'whatsapp',
  'whatsapp:manage': 'whatsapp',

  'reservations:view': 'reservations',
  'reservations:manage': 'reservations',

  'roles:manage': 'roles',
};

/**
 * Route prefixes to Module mapping.
 */
export const ROUTE_TO_MODULE_MAP: Array<{ prefix: string; moduleId: PlanModuleId }> = [
  { prefix: '/kitchen', moduleId: 'kitchen' },
  { prefix: '/waiter', moduleId: 'waiter' },
  { prefix: '/inventory', moduleId: 'inventory' },
  { prefix: '/rider', moduleId: 'delivery' },
  { prefix: '/settings/inventory', moduleId: 'inventory' },
  { prefix: '/settings/aggregators', moduleId: 'aggregators' },
  { prefix: '/settings/riders', moduleId: 'delivery' },
  { prefix: '/settings/whatsapp', moduleId: 'whatsapp' },
  { prefix: '/settings/reservations', moduleId: 'reservations' },
  { prefix: '/settings/roles', moduleId: 'roles' },
  { prefix: '/settings/billing', moduleId: 'billing' },
  { prefix: '/settings/restaurant', moduleId: 'settings' },
  { prefix: '/settings/menu', moduleId: 'menu' },
  { prefix: '/settings/tables', moduleId: 'tables' },
  { prefix: '/settings/hours', moduleId: 'hours' },
  { prefix: '/settings/staff', moduleId: 'staff' },
  { prefix: '/settings/reports', moduleId: 'reports' },
  { prefix: '/settings/feedback', moduleId: 'feedback' },
  { prefix: '/settings/tax', moduleId: 'tax' },
  { prefix: '/settings/dining', moduleId: 'dining' },
  { prefix: '/settings/printing', moduleId: 'printing' },
  { prefix: '/settings/qr-menu', moduleId: 'qr_menu' },
  { prefix: '/settings', moduleId: 'settings' },
  { prefix: '/pos', moduleId: 'pos' },
  { prefix: '/orders', moduleId: 'pos' },
  { prefix: '/tables', moduleId: 'tables' },
];

export interface OutletSubscriptionState {
  status: string; // 'ACTIVE' | 'SUSPENDED' | 'EXPIRED'
  planTier: string; // 'BASIC' | 'PRO'
  subscriptionExpiresAt?: string | null;
  trialEndsAt?: string | null;
}

/**
 * Checks if the current plan tier is greater than or equal to the required plan tier.
 */
export function isPlanSufficient(currentPlan: string | undefined | null, requiredPlan: PlanTier): boolean {
  const current = (currentPlan ? currentPlan.toUpperCase() : 'BASIC') as PlanTier;
  const currentRank = PLAN_RANKS[current] ?? 1;
  const requiredRank = PLAN_RANKS[requiredPlan] ?? 1;
  return currentRank >= requiredRank;
}

/**
 * Checks if an outlet subscription is active and not expired/suspended.
 * Verifies both paid subscription expiration and free trial expiration.
 */
export function isSubscriptionActive(outlet: OutletSubscriptionState | null | undefined): boolean {
  if (!outlet) return true;
  if (outlet.status === 'SUSPENDED' || outlet.status === 'EXPIRED') return false;

  const now = Date.now();
  if (outlet.subscriptionExpiresAt) {
    if (new Date(outlet.subscriptionExpiresAt).getTime() < now) {
      return false; // Paid subscription or trial expired
    }
  } else if (outlet.trialEndsAt) {
    if (new Date(outlet.trialEndsAt).getTime() < now) {
      return false; // Free trial expired
    }
  }

  return true;
}

/**
 * Checks if an outlet is currently operating within its active free trial period.
 */
export function isOutletInFreeTrial(outlet: OutletSubscriptionState | null | undefined): boolean {
  if (!outlet || !outlet.trialEndsAt) return false;
  return new Date(outlet.trialEndsAt).getTime() > Date.now();
}

/**
 * Returns the number of days remaining in the free trial period (minimum 0).
 */
export function getTrialDaysRemaining(outlet: OutletSubscriptionState | null | undefined): number {
  if (!outlet || !outlet.trialEndsAt) return 0;
  const diffMs = new Date(outlet.trialEndsAt).getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if a specific module is allowed for the given outlet.
 */
export function isModuleAllowedForOutlet(
  outlet: OutletSubscriptionState | null | undefined,
  moduleId: PlanModuleId
): boolean {
  if (!outlet) return true;
  // Billing is always allowed so the owner can renew or change plans
  if (moduleId === 'billing') return true;

  // Suspended or expired outlets cannot operate any module
  if (!isSubscriptionActive(outlet)) return false;

  const required = MODULE_MIN_PLAN[moduleId] || 'BASIC';
  return isPlanSufficient(outlet.planTier, required);
}

/**
 * Checks if a granular permission is allowed for the given outlet under its subscription plan.
 */
export function isPermissionAllowedForOutlet(
  outlet: OutletSubscriptionState | null | undefined,
  permission: string
): boolean {
  if (!outlet) return true;
  const moduleId = PERMISSION_TO_MODULE_MAP[permission];
  if (!moduleId) return true; // Permission not mapped to a restricted module -> allow
  return isModuleAllowedForOutlet(outlet, moduleId);
}

/**
 * Checks if a route path is allowed for the given outlet under its subscription plan.
 */
export function isRouteAllowedForOutlet(
  outlet: OutletSubscriptionState | null | undefined,
  pathname: string
): boolean {
  if (!outlet) return true;
  for (const r of ROUTE_TO_MODULE_MAP) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + '/') || pathname.startsWith(r.prefix + '?')) {
      return isModuleAllowedForOutlet(outlet, r.moduleId);
    }
  }
  return true;
}

/**
 * Returns the module required for a pathname, if any.
 */
export function getRequiredModuleForRoute(pathname: string): PlanModuleInfo | null {
  for (const r of ROUTE_TO_MODULE_MAP) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + '/') || pathname.startsWith(r.prefix + '?')) {
      return MODULE_INFO_CATALOG[r.moduleId] || null;
    }
  }
  return null;
}
