/**
 * Hono context variable types for the logix-dine API.
 * Extend ContextVariableMap so c.get/c.set are type-safe throughout.
 */
declare module 'hono' {
  interface ContextVariableMap {
    sessionUser: Record<string, unknown>;
    tenant: {
      restaurantId: string;
      role: string;
      roleName?: string;
      permissions?: string[];
      member: Record<string, unknown> | null;
      outletId: string | null;
      outletIds: string[];
      allOutlets?: boolean;
    };
    /** Phone number of the authenticated actor — used to populate createdBy/updatedBy audit columns. */
    actorPhone: string | null;
  }
}

export {};
