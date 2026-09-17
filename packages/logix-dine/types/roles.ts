/**
 * Platform-level roles — stored in user.role.
 * Controls what a user can do across all restaurants.
 */
export const PLATFORM_ROLES = ['ADMIN', 'OWNER', 'CUSTOMER'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/**
 * Restaurant-level roles — stored in restaurantMember.role.
 * Controls what a member can do within a specific restaurant.
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
 * in v2 only requires updating ROLE_PERMISSIONS, not the routes.
 */
export const PERMISSIONS = [
  'restaurant:read',
  'restaurant:write',
  'outlet:read',
  'outlet:write',
  'menu:read',
  'menu:write',
  'order:create',
  'order:read',
  'order:settle',
  'order:void',
  'member:write',
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
    'menu:read', 'menu:write',
    'order:create', 'order:read', 'order:settle', 'order:void',
    'member:write',
  ],
  MANAGER: [
    'restaurant:read',
    'outlet:read', 'outlet:write',
    'menu:read', 'menu:write',
    'order:create', 'order:read', 'order:settle', 'order:void',
  ],
  WAITER: [
    'menu:read',
    'order:create', 'order:read',
  ],
  KITCHEN: [
    'order:read',
  ],
  CUSTOM_ROLE: [],
} as const;

/** Check if a role has a given permission. */
export function hasPermission(role: RestaurantRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
}
