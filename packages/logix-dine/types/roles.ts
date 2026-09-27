/**
 * Platform-level roles — stored in user.role.
 * Controls what a user can do across all restaurants.
 */
export const PLATFORM_ROLES = ['ADMIN', 'OWNER', 'CUSTOMER'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/**
 * Restaurant-level roles — stored in restaurantMember.role.
 * Controls what a member can do within a specific restaurant.
 *
 * Outlet scope (see memberOutletAccess table):
 *   OWNER   → all outlets (no access rows needed)
 *   MANAGER → assigned outlets only, full operational access
 *   WAITER  → assigned outlets only, order:create + order:settle
 *   KITCHEN → assigned outlets only, order:read only (KDS)
 */
export const RESTAURANT_ROLES = [
  'OWNER',
  'MANAGER',
  'WAITER',
  'KITCHEN',
  'CUSTOM_ROLE',
] as const;
export type RestaurantRole = (typeof RESTAURANT_ROLES)[number];

/**
 * All permission strings used across API guards.
 * Routes check permissions — NOT roles — so adding a new role
 * only requires updating ROLE_PERMISSIONS, not the routes.
 */
export const PERMISSIONS = [
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
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Maps each restaurant role to the permissions it grants.
 * This is the single place to update when adding/changing roles.
 */
export const ROLE_PERMISSIONS: Record<RestaurantRole, readonly Permission[]> = {
  OWNER: [
    'restaurant:read', 'restaurant:write',
    'outlet:read', 'outlet:write',
    'table:read', 'table:write',
    'menu:read', 'menu:write',
    'order:create', 'order:read', 'order:settle', 'order:void',
    'kitchen:read', 'kitchen:write',
    'waiter:read', 'waiter:write',
    'delivery:read', 'delivery:write',
    'member:read', 'member:write',
    'report:read',
    'inventory:read', 'inventory:write',
    'feedback:read', 'feedback:reply',
  ],
  MANAGER: [
    'restaurant:read',
    'outlet:read', 'outlet:write',
    'table:read', 'table:write',
    'menu:read', 'menu:write',
    'order:create', 'order:read', 'order:settle', 'order:void',
    'kitchen:read', 'kitchen:write',
    'waiter:read', 'waiter:write',
    'delivery:read', 'delivery:write',
    'member:read',
    'report:read',
    'inventory:read', 'inventory:write',
    'feedback:read', 'feedback:reply',
  ],
  WAITER: [
    'restaurant:read',
    'outlet:read',
    'table:read',
    'menu:read',
    'order:create', 'order:read', 'order:settle',
    'kitchen:read',
    'waiter:read', 'waiter:write',
    'delivery:read', 'delivery:write',
  ],
  KITCHEN: [
    'restaurant:read',
    'outlet:read',
    'menu:read',
    'order:read',
    'kitchen:read', 'kitchen:write',
  ],
  CUSTOM_ROLE: [],
} as const;

/** Check if a role has a given permission. */
export function hasPermission(role: RestaurantRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
}

/** Roles that always have access to every outlet (no memberOutletAccess rows needed). */
export const ALL_OUTLET_ROLES: readonly RestaurantRole[] = ['OWNER'];

export function isAllOutletRole(role: RestaurantRole): boolean {
  return (ALL_OUTLET_ROLES as readonly string[]).includes(role);
}
