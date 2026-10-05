/**
 * Platform-level roles — stored in user.role.
 * Controls what a user can do across all restaurants.
 */
export const PLATFORM_ROLES = ['ADMIN', 'OWNER', 'CUSTOMER'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/**
 * Built-in System Roles for Restaurants.
 */
export const SYSTEM_RESTAURANT_ROLES = [
  'OWNER',
  'MANAGER',
  'CASHIER',
  'CAPTAIN',
  'WAITER',
  'KITCHEN',
  'RIDER',
] as const;
export type SystemRestaurantRole = (typeof SYSTEM_RESTAURANT_ROLES)[number];

export const RESTAURANT_ROLES = [
  ...SYSTEM_RESTAURANT_ROLES,
  'CUSTOM_ROLE',
] as const;
export type RestaurantRole = (typeof RESTAURANT_ROLES)[number];

/**
 * Granular Sub-Feature Permissions Catalog.
 */
export const GRANULAR_PERMISSIONS = [
  // 1. POS Counter & Billing
  'pos:view',
  'pos:order_create',
  'pos:discount_apply',
  'pos:bill_settle',
  'pos:bill_void',
  'pos:table_transfer',
  'pos:reprint_bill',
  'pos:kiosk_lock',

  // 2. Table Floor Management
  'tables:view',
  'tables:status_change',
  'tables:layout_edit',

  // 3. Kitchen Display System (KDS)
  'kitchen:view',
  'kitchen:item_bump',
  'kitchen:recall',
  'kitchen:station_filter',

  // 4. Waiter Mobility
  'waiter:view',
  'waiter:punch_order',
  'waiter:attend_call',
  'waiter:request_bill',
  'waiter:settle_bill',

  // 5. Menu Catalog
  'menu:view',
  'menu:toggle_stock',
  'menu:create_edit',
  'menu:delete',

  // 6. Inventory & Recipes
  'inventory:view',
  'inventory:adjust_stock',
  'inventory:manage_recipes',

  // 7. Delivery & Riders
  'delivery:view',
  'delivery:assign_rider',
  'delivery:status_update',
  'delivery:manage_riders',

  // 8. Online Aggregators
  'aggregators:view',
  'aggregators:toggle_store',
  'aggregators:manage_config',

  // 9. Customer Feedback & Reviews
  'feedback:view',
  'feedback:reply',

  // 10. Reports & Analytics
  'reports:view_summary',
  'reports:view_analytics',
  'reports:export',

  // 11. Hardware & Printing
  'printing:view',
  'printing:test',
  'printing:manage',

  // 12. Store & Outlet Settings
  'settings:view',
  'settings:edit_store',
  'settings:manage_outlets',

  // 13. Staff, Roles & Permissions
  'staff:view',
  'staff:invite',
  'staff:manage',
  'roles:manage',

  // 14. Table Reservations & Bookings
  'reservations:view',
  'reservations:manage',

  // 15. Customer Directory & CRM
  'customers:view',
  'customers:manage',

  // 16. Invoice, Tax & Service Charges
  'tax:view',
  'tax:manage',

  // 17. QR Menu Table Ordering
  'qr_menu:view',
  'qr_menu:manage',

  // 18. WhatsApp Alerts & Automation
  'whatsapp:view',
  'whatsapp:manage',

  // 19. Finance & Petty Cash Tracking
  'finance:view',
  'finance:record',
  'finance:manage',
] as const;

/**
 * Legacy Permission Strings (kept for complete backward compatibility)
 */
export const LEGACY_PERMISSIONS = [
  'restaurant:read',
  'restaurant:write',
  'outlet:read',
  'outlet:write',
  'table:read',
  'table:write',
  'menu:read',
  'menu:write',
  'order:create',
  'order:read',
  'order:settle',
  'order:void',
  'kitchen:read',
  'kitchen:write',
  'waiter:read',
  'waiter:write',
  'delivery:read',
  'delivery:write',
  'member:read',
  'member:write',
  'report:read',
  'inventory:read',
  'inventory:write',
  'feedback:read',
  'feedback:reply',
  'finance:read',
  'finance:write',
] as const;

export const PERMISSIONS = [
  ...GRANULAR_PERMISSIONS,
  ...LEGACY_PERMISSIONS,
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Mapping between legacy permission keys and their modern granular counterparts.
 */
export const LEGACY_TO_GRANULAR_MAP: Record<string, readonly Permission[]> = {
  'restaurant:read': ['settings:view', 'tax:view', 'qr_menu:view', 'whatsapp:view'],
  'restaurant:write': ['settings:edit_store', 'tax:manage', 'qr_menu:manage', 'whatsapp:manage'],
  'outlet:read': ['settings:view'],
  'outlet:write': ['settings:manage_outlets'],
  'table:read': ['tables:view', 'reservations:view'],
  'table:write': ['tables:layout_edit', 'tables:status_change', 'reservations:manage'],
  'menu:read': ['menu:view', 'qr_menu:view'],
  'menu:write': ['menu:create_edit', 'menu:toggle_stock', 'menu:delete', 'qr_menu:manage'],
  'order:create': ['pos:order_create', 'waiter:punch_order', 'customers:manage'],
  'order:read': ['pos:view', 'waiter:view', 'kitchen:view', 'delivery:view', 'customers:view'],
  'order:settle': ['pos:bill_settle', 'waiter:settle_bill'],
  'order:void': ['pos:bill_void'],
  'kitchen:read': ['kitchen:view', 'kitchen:station_filter'],
  'kitchen:write': ['kitchen:item_bump', 'kitchen:recall'],
  'waiter:read': ['waiter:view'],
  'waiter:write': ['waiter:punch_order', 'waiter:attend_call', 'waiter:request_bill', 'waiter:settle_bill'],
  'delivery:read': ['delivery:view'],
  'delivery:write': ['delivery:assign_rider', 'delivery:status_update', 'delivery:manage_riders'],
  'member:read': ['staff:view'],
  'member:write': ['staff:invite', 'staff:manage'],
  'report:read': ['reports:view_summary', 'reports:view_analytics', 'reports:export'],
  'inventory:read': ['inventory:view'],
  'inventory:write': ['inventory:adjust_stock', 'inventory:manage_recipes'],
  'feedback:read': ['feedback:view'],
  'feedback:reply': ['feedback:reply'],
  'finance:read': ['finance:view'],
  'finance:write': ['finance:record', 'finance:manage'],
};

/**
 * Default Granular Permissions for System Roles
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRestaurantRole, readonly Permission[]> = {
  OWNER: [
    ...GRANULAR_PERMISSIONS,
  ],
  MANAGER: [
    'pos:view', 'pos:order_create', 'pos:discount_apply', 'pos:bill_settle', 'pos:bill_void',
    'pos:table_transfer', 'pos:reprint_bill', 'pos:kiosk_lock',
    'tables:view', 'tables:status_change', 'tables:layout_edit',
    'kitchen:view', 'kitchen:item_bump', 'kitchen:recall', 'kitchen:station_filter',
    'waiter:view', 'waiter:punch_order', 'waiter:attend_call', 'waiter:request_bill', 'waiter:settle_bill',
    'menu:view', 'menu:toggle_stock', 'menu:create_edit', 'menu:delete',
    'inventory:view', 'inventory:adjust_stock', 'inventory:manage_recipes',
    'delivery:view', 'delivery:assign_rider', 'delivery:status_update', 'delivery:manage_riders',
    'aggregators:view', 'aggregators:toggle_store', 'aggregators:manage_config',
    'feedback:view', 'feedback:reply',
    'reports:view_summary', 'reports:view_analytics', 'reports:export',
    'printing:view', 'printing:test', 'printing:manage',
    'settings:view', 'settings:edit_store', 'settings:manage_outlets',
    'staff:view', 'staff:invite', 'staff:manage',
    'reservations:view', 'reservations:manage',
    'customers:view', 'customers:manage',
    'tax:view', 'tax:manage',
    'qr_menu:view', 'qr_menu:manage',
    'whatsapp:view', 'whatsapp:manage',
    'finance:view', 'finance:record', 'finance:manage',
  ],
  CASHIER: [
    'pos:view', 'pos:order_create', 'pos:bill_settle', 'pos:table_transfer', 'pos:reprint_bill', 'pos:kiosk_lock',
    'tables:view', 'tables:status_change',
    'reports:view_summary',
    'printing:view', 'printing:test',
    'menu:view',
    'customers:view', 'customers:manage',
    'reservations:view',
    'finance:view', 'finance:record',
  ],
  CAPTAIN: [
    'waiter:view', 'waiter:punch_order', 'waiter:attend_call', 'waiter:request_bill', 'waiter:settle_bill',
    'tables:view', 'tables:status_change',
    'menu:view', 'menu:toggle_stock',
    'pos:view', 'pos:order_create',
    'printing:view', 'printing:test',
    'reservations:view', 'reservations:manage',
    'customers:view',
  ],
  WAITER: [
    'waiter:view', 'waiter:punch_order', 'waiter:attend_call', 'waiter:request_bill',
    'tables:view',
    'menu:view',
    'customers:view',
  ],
  KITCHEN: [
    'kitchen:view', 'kitchen:item_bump', 'kitchen:recall', 'kitchen:station_filter',
    'menu:view', 'menu:toggle_stock',
  ],
  RIDER: [
    'delivery:view', 'delivery:status_update',
  ],
};

export const ROLE_PERMISSIONS: Record<RestaurantRole, readonly Permission[]> = {
  ...DEFAULT_ROLE_PERMISSIONS,
  CUSTOM_ROLE: [],
};

/**
 * Metadata definition for a single granular permission.
 */
export interface PermissionMeta {
  key: Permission;
  label: string;
  description: string;
  badge?: 'High Risk' | 'Financial' | 'Operational' | 'Read Only';
}

/**
 * Permission Modules for the Matrix UI.
 */
export interface PermissionModule {
  id: string;
  label: string;
  icon: string;
  description: string;
  permissions: PermissionMeta[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: 'pos',
    label: 'POS Counter & Billing',
    icon: 'IconShoppingCart',
    description: 'Order punching, cash register, discounts, voids, and counter payments',
    permissions: [
      { key: 'pos:view', label: 'Access POS Register', description: 'Open and use the main counter billing screen', badge: 'Operational' },
      { key: 'pos:order_create', label: 'Create & Punch Orders', description: 'Select items, configure variants, add notes, and fire orders', badge: 'Operational' },
      { key: 'pos:discount_apply', label: 'Apply Custom Discounts', description: 'Apply manual flat or percentage discounts to tickets', badge: 'Financial' },
      { key: 'pos:bill_settle', label: 'Settle Bills & Payments', description: 'Accept Cash, Card, UPI, and split payments', badge: 'Financial' },
      { key: 'pos:bill_void', label: 'Void / Cancel Bills', description: 'Cancel active orders or reverse settled bills', badge: 'High Risk' },
      { key: 'pos:table_transfer', label: 'Move & Split Tables', description: 'Transfer items between tables or merge guest checks', badge: 'Operational' },
      { key: 'pos:reprint_bill', label: 'Reprint Customer Bills', description: 'Trigger thermal printer duplicate receipts', badge: 'Operational' },
      { key: 'pos:kiosk_lock', label: 'Cashier Kiosk Mode (F11)', description: 'Toggle full-screen locked kiosk mode', badge: 'Operational' },
    ],
  },
  {
    id: 'tables',
    label: 'Table Floor Management',
    icon: 'IconTableAlias',
    description: 'Visual dining layout, table assignments, and section mapping',
    permissions: [
      { key: 'tables:view', label: 'View Floor Plan', description: 'View floor map, live occupancy, and elapsed table times', badge: 'Read Only' },
      { key: 'tables:status_change', label: 'Change Table Occupancy', description: 'Mark tables as Available, Occupied, or Billed', badge: 'Operational' },
      { key: 'tables:layout_edit', label: 'Design & Edit Tables', description: 'Add, move, resize, or delete tables and dining sections', badge: 'High Risk' },
    ],
  },
  {
    id: 'kitchen',
    label: 'Kitchen Display System (KDS)',
    icon: 'IconToolsKitchen2',
    description: 'Kitchen bump screens, station routing, and ticket prep timers',
    permissions: [
      { key: 'kitchen:view', label: 'View KDS Bump Screen', description: 'Monitor incoming kitchen tickets, items, and preparation timers', badge: 'Read Only' },
      { key: 'kitchen:item_bump', label: 'Bump & Advance Orders', description: 'Mark dishes as Preparing, Ready, or Served', badge: 'Operational' },
      { key: 'kitchen:recall', label: 'Recall Bumped Orders', description: 'Re-open previously completed tickets back to the kitchen queue', badge: 'Operational' },
      { key: 'kitchen:station_filter', label: 'Switch Kitchen Stations', description: 'Filter tickets by kitchen line (Bar, Tandoor, Main Line)', badge: 'Operational' },
    ],
  },
  {
    id: 'waiter',
    label: 'Waiter Staff Mobility',
    icon: 'IconBellRinging',
    description: 'Tableside mobile order taking, guest water/cutlery alerts',
    permissions: [
      { key: 'waiter:view', label: 'View Waiter Floor', description: 'View assigned dining tables, active courses, and guest calls', badge: 'Read Only' },
      { key: 'waiter:punch_order', label: 'Tableside Order Taking', description: 'Punch new courses and send instant KOTs to kitchen', badge: 'Operational' },
      { key: 'waiter:attend_call', label: 'Attend Waiter Calls', description: 'Acknowledge and resolve guest assistance bells', badge: 'Operational' },
      { key: 'waiter:request_bill', label: 'Request Pre-Bill', description: 'Print dining check and deliver to guest tables', badge: 'Operational' },
      { key: 'waiter:settle_bill', label: 'Settle Payment at Table', description: 'Collect tableside cash or UPI settlements', badge: 'Financial' },
    ],
  },
  {
    id: 'menu',
    label: 'Menu Catalog & Pricing',
    icon: 'IconBook',
    description: 'Dishes, variants, addons, categories, and 86 stock status',
    permissions: [
      { key: 'menu:view', label: 'View Menu Catalog', description: 'Browse categories, recipes, prices, and addons', badge: 'Read Only' },
      { key: 'menu:toggle_stock', label: 'Toggle 86 / Out of Stock', description: 'Mark dishes in-stock or sold-out during service rush', badge: 'Operational' },
      { key: 'menu:create_edit', label: 'Create & Edit Dishes', description: 'Add new items, adjust prices, edit descriptions and photos', badge: 'High Risk' },
      { key: 'menu:delete', label: 'Delete Menu Items', description: 'Permanently remove dishes or entire menu categories', badge: 'High Risk' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Recipe BOM',
    icon: 'IconPackages',
    description: 'Raw ingredients, stock write-offs, and recipe deductions',
    permissions: [
      { key: 'inventory:view', label: 'View Stock Balances', description: 'Check ingredient levels, units of measure, and thresholds', badge: 'Read Only' },
      { key: 'inventory:adjust_stock', label: 'Adjust Stock / Waste', description: 'Log incoming stock, wastage write-offs, and transfers', badge: 'Financial' },
      { key: 'inventory:manage_recipes', label: 'Edit Recipe BOMs', description: 'Link raw ingredient formulas to menu items for auto-deduction', badge: 'High Risk' },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery & In-House Riders',
    icon: 'IconMotorbike',
    description: 'Takeaway dispatch, rider queue, and delivery tracking',
    permissions: [
      { key: 'delivery:view', label: 'View Delivery Orders', description: 'View active dispatch queue, customer addresses, and statuses', badge: 'Read Only' },
      { key: 'delivery:assign_rider', label: 'Assign Delivery Riders', description: 'Dispatch orders to specific in-house delivery staff', badge: 'Operational' },
      { key: 'delivery:status_update', label: 'Update Delivery State', description: 'Mark orders as Dispatched, Delivered, or Returned', badge: 'Operational' },
      { key: 'delivery:manage_riders', label: 'Manage Rider Accounts', description: 'Add or modify in-house courier personnel accounts', badge: 'Operational' },
    ],
  },
  {
    id: 'aggregators',
    label: 'Online Aggregators (Relay)',
    icon: 'IconTruckDelivery',
    description: 'Swiggy, Zomato, Magicpin, and ONDC omnichannel gateway',
    permissions: [
      { key: 'aggregators:view', label: 'View Online Orders', description: 'View Swiggy, Zomato, and ONDC order logs and status', badge: 'Read Only' },
      { key: 'aggregators:toggle_store', label: 'Pause / Resume Store', description: 'Temporarily pause Swiggy/Zomato receiving during rushes', badge: 'Operational' },
      { key: 'aggregators:manage_config', label: 'Aggregator Credentials', description: 'Configure API keys, webhooks, and channel price markups', badge: 'High Risk' },
    ],
  },
  {
    id: 'feedback',
    label: 'Reviews & Customer Feedback',
    icon: 'IconStar',
    description: 'In-app guest reviews, dish ratings, and management responses',
    permissions: [
      { key: 'feedback:view', label: 'View Reviews & Ratings', description: 'Browse customer star ratings, comments, and dining feedback', badge: 'Read Only' },
      { key: 'feedback:reply', label: 'Reply to Reviews', description: 'Publish official management replies to customer reviews', badge: 'Operational' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    icon: 'IconChartBar',
    description: 'Daily cashier close, sales trends, and tax audit data',
    permissions: [
      { key: 'reports:view_summary', label: 'View Cashier Register', description: 'View daily cash drawer total, shift close, and tender split', badge: 'Financial' },
      { key: 'reports:view_analytics', label: 'View Analytics Trends', description: 'View revenue graphs, rush heatmaps, and item popularity', badge: 'Read Only' },
      { key: 'reports:export', label: 'Export Tax Audits & CSV', description: 'Download GST invoices, sales summaries, and Excel audit logs', badge: 'Financial' },
    ],
  },
  {
    id: 'printing',
    label: 'Thermal Printers & Hardware',
    icon: 'IconPrinter',
    description: 'USB, LAN, Serial receipt printers, baud rates, and cash drawers',
    permissions: [
      { key: 'printing:view', label: 'View Thermal Printers', description: 'Inspect printer station bindings and connection status', badge: 'Read Only' },
      { key: 'printing:test', label: 'Run Printer Diagnostics', description: 'Trigger sample test prints, cutter tests, and drawer kicks', badge: 'Operational' },
      { key: 'printing:manage', label: 'Configure Printers', description: 'Add, update, or remove receipt printer hardware connections', badge: 'Operational' },
    ],
  },
  {
    id: 'settings',
    label: 'Store & Outlet Settings',
    icon: 'IconBuildingStore',
    description: 'Restaurant profile, business hours, and multi-outlet management',
    permissions: [
      { key: 'settings:view', label: 'View Store Settings', description: 'Inspect store profile, GSTIN, and business operating hours', badge: 'Read Only' },
      { key: 'settings:edit_store', label: 'Edit Store Details', description: 'Modify restaurant branding, address, phone, and currencies', badge: 'High Risk' },
      { key: 'settings:manage_outlets', label: 'Manage Outlets', description: 'Add new restaurant outlets or edit existing locations', badge: 'High Risk' },
    ],
  },
  {
    id: 'roles',
    label: 'Staff, Roles & Permissions',
    icon: 'IconUsers',
    description: 'Staff invites, role assignments, and granular security matrix',
    permissions: [
      { key: 'staff:view', label: 'View Team Roster', description: 'View staff members list and assigned roles', badge: 'Read Only' },
      { key: 'staff:invite', label: 'Invite Staff Members', description: 'Send WhatsApp OTP invites to new cashiers, cooks, waiters', badge: 'Operational' },
      { key: 'staff:manage', label: 'Manage Staff Accounts', description: 'Reassign member roles, change outlet scopes, or remove staff', badge: 'High Risk' },
      { key: 'roles:manage', label: 'Manage Roles & Matrix', description: 'Create custom roles, edit permissions matrix (Owner Only)', badge: 'High Risk' },
    ],
  },
  {
    id: 'reservations',
    label: 'Table Reservations & Bookings',
    icon: 'IconCalendarEvent',
    description: 'Guest table bookings, party sizes, time slots, and guest arrivals',
    permissions: [
      { key: 'reservations:view', label: 'View Reservations & Bookings', description: 'Monitor upcoming guest table reservations, party sizes, and notes', badge: 'Read Only' },
      { key: 'reservations:manage', label: 'Manage & Seat Bookings', description: 'Create, confirm, cancel reservations, and seat arriving parties', badge: 'Operational' },
    ],
  },
  {
    id: 'customers',
    label: 'Customer Directory & CRM',
    icon: 'IconUserCheck',
    description: 'Guest database, visit history, customer profiles, and loyalty metrics',
    permissions: [
      { key: 'customers:view', label: 'View Customer Directory', description: 'Browse guest database, dining history, visits, and loyalty stats', badge: 'Read Only' },
      { key: 'customers:manage', label: 'Manage Customer Profiles', description: 'Edit contact details, guest tags, allergies, and delivery addresses', badge: 'Operational' },
    ],
  },
  {
    id: 'tax',
    label: 'Invoice, Tax & Service Charges',
    icon: 'IconReceiptTax',
    description: 'GST slabs, VAT, invoice numbering, and dine-in/takeaway service charges',
    permissions: [
      { key: 'tax:view', label: 'View Tax Rates & Invoices', description: 'Inspect GST slabs, VAT, service charges, and packaging fee rules', badge: 'Read Only' },
      { key: 'tax:manage', label: 'Configure Taxes & Charges', description: 'Modify GST rates, tax-inclusive pricing, and service charge percentages', badge: 'Financial' },
    ],
  },
  {
    id: 'qr_menu',
    label: 'QR Menu Table Ordering',
    icon: 'IconQrcode',
    description: 'Table QR code generator, live digital menu, and guest self-ordering',
    permissions: [
      { key: 'qr_menu:view', label: 'View QR Menu Settings', description: 'Inspect QR table codes, live digital menu links, and ordering rules', badge: 'Read Only' },
      { key: 'qr_menu:manage', label: 'Configure QR Ordering', description: 'Enable/disable direct table self-ordering, payment-first, and guest bill requests', badge: 'Operational' },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Alerts & Automation',
    icon: 'IconBrandWhatsapp',
    description: 'Automated digital receipt dispatch, OTP notifications, and order updates',
    permissions: [
      { key: 'whatsapp:view', label: 'View WhatsApp Automation', description: 'View WhatsApp bill sharing logs, OTP notifications, and templates', badge: 'Read Only' },
      { key: 'whatsapp:manage', label: 'Configure WhatsApp Alerts', description: 'Connect WhatsApp Business API, toggle bill dispatch, and order status pings', badge: 'Operational' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Petty Cash',
    icon: 'IconReceipt2',
    description: 'Expense tracking, petty cash drawer, cash reconciliation, and net profit analytics',
    permissions: [
      { key: 'finance:view', label: 'View Finance & Expenses', description: 'View expense lists, petty cash drawer, category breakdown, and profit metrics', badge: 'Read Only' },
      { key: 'finance:record', label: 'Record Petty Cash / Expense', description: 'Record daily petty cash outflows and vendor expense vouchers', badge: 'Financial' },
      { key: 'finance:manage', label: 'Manage Finance & Cash Drawer', description: 'Edit/delete expenses, configure opening float, and cash reconciliation', badge: 'High Risk' },
    ],
  },
];

/**
 * Checks if a given list of user permissions satisfies the required permission.
 * Automatically checks legacy-to-granular equivalents so existing checks work.
 */
export function hasPermission(
  userPermissions: readonly string[] | undefined | null,
  requiredPermission: Permission
): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  // Direct match
  if (userPermissions.includes(requiredPermission)) return true;
  // Wildcard match for OWNER or superadmin
  if (userPermissions.includes('*')) return true;

  // Check if user has legacy equivalent
  for (const [legacy, granulars] of Object.entries(LEGACY_TO_GRANULAR_MAP)) {
    if (userPermissions.includes(legacy)) {
      if ((granulars as readonly string[]).includes(requiredPermission)) return true;
    }
  }

  // Check if requiredPermission is legacy and user has any granular equivalent
  const granularEquivalents = LEGACY_TO_GRANULAR_MAP[requiredPermission];
  if (granularEquivalents) {
    for (const g of granularEquivalents) {
      if (userPermissions.includes(g)) return true;
    }
  }

  return false;
}

/** Roles that always have access to every outlet (no memberOutletAccess rows needed). */
export const ALL_OUTLET_ROLES: readonly string[] = ['OWNER'];

export function isAllOutletRole(role: string): boolean {
  return ALL_OUTLET_ROLES.includes(role ? role.toUpperCase() : '');
}
