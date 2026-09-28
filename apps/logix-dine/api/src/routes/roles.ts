import { Hono } from 'hono';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requireAuth, requirePermission, resolveSessionPayload } from '../lib/tenancy';
import {
  PERMISSION_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_RESTAURANT_ROLES,
  LEGACY_PERMISSIONS,
  type SystemRestaurantRole,
} from '@logixsoft/logix-dine/types/roles';
import type { AuthEnv } from '../lib/auth';
import * as z from 'zod';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// ─── Default Role Seed Helper ──────────────────────────────────────────────────

async function ensureDefaultRoles(db: any, restaurantId: string, actorPhone?: string | null) {
  const existing = await db
    .select()
    .from(appSchema.restaurantRole)
    .where(eq(appSchema.restaurantRole.restaurantId, restaurantId));

  // Cleanse any legacy permission strings from system roles
  for (const r of existing) {
    if (r.isSystem && Array.isArray(r.permissions) && r.name !== 'OWNER') {
      const filtered = r.permissions.filter((p: string) => !LEGACY_PERMISSIONS.includes(p as any));
      if (filtered.length !== r.permissions.length) {
        await db
          .update(appSchema.restaurantRole)
          .set({ permissions: filtered, updatedAt: new Date() })
          .where(eq(appSchema.restaurantRole.id, r.id));
        r.permissions = filtered;
      }
    }
  }

  const existingNames = new Set(existing.map((r: any) => r.name.toUpperCase()));

  const defaultDefs: Array<{
    name: SystemRestaurantRole;
    description: string;
    isSystem: boolean;
    allOutlets: boolean;
    permissions: readonly string[];
  }> = [
    {
      name: 'OWNER',
      description: 'Full uninhibited access to all outlets, financial settings, and role permissions',
      isSystem: true,
      allOutlets: true,
      permissions: ['*'],
    },
    {
      name: 'MANAGER',
      description: 'Full operational management over POS, KDS, inventory, floor, staff, and reports',
      isSystem: true,
      allOutlets: false,
      permissions: DEFAULT_ROLE_PERMISSIONS.MANAGER,
    },
    {
      name: 'CASHIER',
      description: 'Counter cashier billing, cash drawer, settlements, and shift summaries',
      isSystem: true,
      allOutlets: false,
      permissions: DEFAULT_ROLE_PERMISSIONS.CASHIER,
    },
    {
      name: 'CAPTAIN',
      description: 'Head waiter with tableside ordering, bill requests, settlements, and 86 stock controls',
      isSystem: true,
      allOutlets: false,
      permissions: DEFAULT_ROLE_PERMISSIONS.CAPTAIN,
    },
    {
      name: 'WAITER',
      description: 'Tableside order taking, course punch, guest assistance, and bill delivery',
      isSystem: true,
      allOutlets: false,
      permissions: DEFAULT_ROLE_PERMISSIONS.WAITER,
    },
    {
      name: 'KITCHEN',
      description: 'Kitchen bump screen display, prep stages, station filter, and 86 stock toggles',
      isSystem: true,
      allOutlets: false,
      permissions: DEFAULT_ROLE_PERMISSIONS.KITCHEN,
    },
    {
      name: 'RIDER',
      description: 'Delivery dispatch orders, address viewing, and delivery completion updates',
      isSystem: true,
      allOutlets: false,
      permissions: DEFAULT_ROLE_PERMISSIONS.RIDER,
    },
  ];

  const toInsert = defaultDefs.filter((d) => !existingNames.has(d.name));
  if (toInsert.length > 0) {
    for (const d of toInsert) {
      await db
        .insert(appSchema.restaurantRole)
        .values({
          id: `role_${generateId()}`,
          restaurantId,
          name: d.name,
          description: d.description,
          isSystem: true,
          allOutlets: d.allOutlets,
          permissions: [...d.permissions],
          createdBy: actorPhone || 'system',
          updatedBy: actorPhone || 'system',
        })
        .onConflictDoNothing();
    }
  }
}

// ─── GET /api/roles — List all roles + permissions metadata ───────────────────

app.get(
  '/',
  apiDoc({
    tags: ['Roles & Permissions'],
    summary: 'List Restaurant Roles',
    description: 'Lists all system and custom roles with assigned permissions and active staff counts.',
    responses: {
      200: z.object({
        roles: z.array(z.any()),
        modules: z.array(z.any()),
      }),
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const restaurantId = c.req.header('X-Restaurant-Id');
    if (!restaurantId) {
      return c.json({ error: 'Bad Request', message: 'X-Restaurant-Id header required' }, 400);
    }

    const { payload } = await resolveSessionPayload(c);
    if (!payload) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    const membership = payload.memberships.find((m) => m.restaurantId === restaurantId);
    if (!membership && payload.user.role !== 'ADMIN') {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this restaurant' }, 403);
    }

    const { db, close } = getDb(c);
    try {
      // 1. Ensure default system roles exist
      await ensureDefaultRoles(db, restaurantId, payload.user.phoneNumber);

      // 2. Fetch all roles
      const roles = await db
        .select()
        .from(appSchema.restaurantRole)
        .where(eq(appSchema.restaurantRole.restaurantId, restaurantId))
        .orderBy(appSchema.restaurantRole.isSystem, appSchema.restaurantRole.name);

      // 3. Count members per role
      const members = await db
        .select({ role: appSchema.restaurantMember.role })
        .from(appSchema.restaurantMember)
        .where(eq(appSchema.restaurantMember.restaurantId, restaurantId));

      const memberCounts = new Map<string, number>();
      for (const m of members) {
        const key = m.role.toUpperCase();
        memberCounts.set(key, (memberCounts.get(key) || 0) + 1);
        memberCounts.set(m.role, (memberCounts.get(m.role) || 0) + 1);
      }

      const rolesWithCounts = roles.map((r: any) => {
        const count = (memberCounts.get(r.id) || 0) + (memberCounts.get(r.name.toUpperCase()) || 0);
        return {
          id: r.id,
          restaurantId: r.restaurantId,
          name: r.name,
          description: r.description,
          isSystem: Boolean(r.isSystem),
          allOutlets: Boolean(r.allOutlets),
          permissions: Array.isArray(r.permissions) ? r.permissions : [],
          memberCount: count,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });

      return c.json({
        roles: rolesWithCounts,
        modules: PERMISSION_MODULES,
      });
    } finally {
      await close();
    }
  }
);

// ─── POST /api/roles — Create Custom Role (Owner Only) ─────────────────────────

const CreateRoleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(250).optional(),
  allOutlets: z.boolean().default(false),
  permissions: z.array(z.string()).default([]),
});

app.post(
  '/',
  requirePermission('roles:manage'),
  apiDoc({
    tags: ['Roles & Permissions'],
    summary: 'Create Custom Role',
    description: 'Creates a new custom role with specified granular permissions (Owner only).',
    body: CreateRoleSchema,
    responses: {
      201: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const tenant = c.get('tenant' as any);
    const restaurantId = tenant.restaurantId;
    const body = await c.req.json().catch(() => ({}));
    const parse = CreateRoleSchema.safeParse(body);
    if (!parse.success) {
      return c.json({ error: 'Validation Error', message: parse.error.issues[0]?.message }, 400);
    }

    const { name, description, allOutlets, permissions } = parse.data;
    const trimmedName = name.trim();

    // Check system role collision
    if (SYSTEM_RESTAURANT_ROLES.includes(trimmedName.toUpperCase() as any)) {
      return c.json({ error: 'Bad Request', message: `Cannot create a role named '${trimmedName}' as it is a reserved system role.` }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const existing = await db
        .select({ id: appSchema.restaurantRole.id })
        .from(appSchema.restaurantRole)
        .where(and(eq(appSchema.restaurantRole.restaurantId, restaurantId), eq(sql`LOWER(${appSchema.restaurantRole.name})`, trimmedName.toLowerCase())))
        .limit(1);

      if (existing.length > 0) {
        return c.json({ error: 'Conflict', message: `A role named '${trimmedName}' already exists.` }, 400);
      }

      const roleId = `role_${generateId()}`;
      const [newRole] = await db
        .insert(appSchema.restaurantRole)
        .values({
          id: roleId,
          restaurantId,
          name: trimmedName,
          description: description || null,
          isSystem: false,
          allOutlets: Boolean(allOutlets),
          permissions,
          createdBy: c.get('actorPhone' as any) || 'owner',
          updatedBy: c.get('actorPhone' as any) || 'owner',
        })
        .returning();

      return c.json({ role: newRole, ...newRole }, 201);
    } finally {
      await close();
    }
  }
);

// ─── PUT /api/roles/:id — Update Role & Permissions (Owner Only) ───────────────

const UpdateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(250).optional().nullable(),
  allOutlets: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
});

app.put(
  '/:id',
  requirePermission('roles:manage'),
  apiDoc({
    tags: ['Roles & Permissions'],
    summary: 'Update Role',
    description: 'Updates a role’s name, description, outlet scope, or granular permissions matrix (Owner only).',
    body: UpdateRoleSchema,
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const roleId = c.req.param('id');
    const tenant = c.get('tenant' as any);
    const restaurantId = tenant.restaurantId;

    const body = await c.req.json().catch(() => ({}));
    const parse = UpdateRoleSchema.safeParse(body);
    if (!parse.success) {
      return c.json({ error: 'Validation Error', message: parse.error.issues[0]?.message }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.restaurantRole)
        .where(and(eq(appSchema.restaurantRole.id, roleId), eq(appSchema.restaurantRole.restaurantId, restaurantId)))
        .limit(1);

      if (!existing) {
        return c.json({ error: 'Not Found', message: 'Role not found' }, 404);
      }

      // Safeguard OWNER role
      if (existing.name.toUpperCase() === 'OWNER') {
        if (parse.data.name && parse.data.name.toUpperCase() !== 'OWNER') {
          return c.json({ error: 'Forbidden', message: 'The OWNER role name cannot be modified.' }, 403);
        }
        // Owner must always retain wildcard permissions
        return c.json({ role: existing, ...existing });
      }

      const updates: any = {
        updatedAt: new Date(),
        updatedBy: c.get('actorPhone' as any) || 'owner',
      };

      if (parse.data.name && !existing.isSystem) {
        const trimmedName = parse.data.name.trim();
        if (SYSTEM_RESTAURANT_ROLES.includes(trimmedName.toUpperCase() as any)) {
          return c.json({ error: 'Bad Request', message: `Cannot rename to reserved system role name '${trimmedName}'.` }, 400);
        }
        updates.name = trimmedName;
      }

      if (parse.data.description !== undefined) {
        updates.description = parse.data.description;
      }
      if (parse.data.allOutlets !== undefined && !existing.isSystem) {
        updates.allOutlets = Boolean(parse.data.allOutlets);
      }
      if (parse.data.permissions !== undefined) {
        updates.permissions = parse.data.permissions;
      }

      const [updated] = await db
        .update(appSchema.restaurantRole)
        .set(updates)
        .where(eq(appSchema.restaurantRole.id, roleId))
        .returning();

      return c.json({ role: updated, ...updated });
    } finally {
      await close();
    }
  }
);

// ─── DELETE /api/roles/:id — Delete Custom Role (Owner Only) ───────────────────

app.delete(
  '/:id',
  requirePermission('roles:manage'),
  apiDoc({
    tags: ['Roles & Permissions'],
    summary: 'Delete Custom Role',
    description: 'Deletes a custom role. System roles and roles with active members cannot be deleted.',
    responses: {
      200: SuccessResponseSchema,
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const roleId = c.req.param('id');
    const tenant = c.get('tenant' as any);
    const restaurantId = tenant.restaurantId;

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.restaurantRole)
        .where(and(eq(appSchema.restaurantRole.id, roleId), eq(appSchema.restaurantRole.restaurantId, restaurantId)))
        .limit(1);

      if (!existing) {
        return c.json({ error: 'Not Found', message: 'Role not found' }, 404);
      }

      if (existing.isSystem || SYSTEM_RESTAURANT_ROLES.includes(existing.name.toUpperCase() as any)) {
        return c.json({ error: 'Bad Request', message: 'System default roles cannot be deleted.' }, 400);
      }

      // Check if any active members have this role assigned
      const assignedMembers = await db
        .select({ id: appSchema.restaurantMember.id, phone: appSchema.restaurantMember.phone })
        .from(appSchema.restaurantMember)
        .where(
          and(
            eq(appSchema.restaurantMember.restaurantId, restaurantId),
            sql`(${appSchema.restaurantMember.role} = ${roleId} OR LOWER(${appSchema.restaurantMember.role}) = LOWER(${existing.name}))`
          )
        )
        .limit(5);

      if (assignedMembers.length > 0) {
        return c.json({
          error: 'Role In Use',
          message: `Cannot delete role '${existing.name}' because ${assignedMembers.length} staff member(s) are assigned to it. Reassign them first.`,
        }, 400);
      }

      await db
        .delete(appSchema.restaurantRole)
        .where(eq(appSchema.restaurantRole.id, roleId));

      return c.json({ success: true, message: `Role '${existing.name}' deleted successfully.` });
    } finally {
      await close();
    }
  }
);

// ─── POST /api/roles/:id/reset — Reset System Role Permissions ─────────────────

app.post(
  '/:id/reset',
  requirePermission('roles:manage'),
  apiDoc({
    tags: ['Roles & Permissions'],
    summary: 'Reset System Role Permissions',
    description: 'Restores a built-in system role permissions to default values.',
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const roleId = c.req.param('id');
    const tenant = c.get('tenant' as any);
    const restaurantId = tenant.restaurantId;

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.restaurantRole)
        .where(and(eq(appSchema.restaurantRole.id, roleId), eq(appSchema.restaurantRole.restaurantId, restaurantId)))
        .limit(1);

      if (!existing) {
        return c.json({ error: 'Not Found', message: 'Role not found' }, 404);
      }

      const roleKey = existing.name.toUpperCase() as SystemRestaurantRole;
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[roleKey];
      if (!defaultPerms) {
        return c.json({ error: 'Bad Request', message: `'${existing.name}' is not a system role.` }, 400);
      }

      const [updated] = await db
        .update(appSchema.restaurantRole)
        .set({
          permissions: [...defaultPerms],
          updatedAt: new Date(),
          updatedBy: c.get('actorPhone' as any) || 'owner',
        })
        .where(eq(appSchema.restaurantRole.id, roleId))
        .returning();

      return c.json({ role: updated, ...updated });
    } finally {
      await close();
    }
  }
);

export const rolesRouter = app;
