import { Hono } from 'hono';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import type { AuthEnv } from '../lib/auth';
import * as z from 'zod';
import { broadcastToOutlet } from '../lib/sync';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

export const ServiceTypeEnum = z.enum(['WATER', 'CUTLERY', 'BILL', 'CLEAN_TABLE', 'OTHER']);
export const WaiterRequestStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

export const ServiceLabels: Record<string, string> = {
  WATER: 'Water / Refill',
  CUTLERY: 'Extra Cutlery & Napkins',
  BILL: 'Bill Requested',
  CLEAN_TABLE: 'Clean Table',
  OTHER: 'Staff Assistance',
};

const CreateWaiterRequestSchema = z.object({
  outletId: z.string().optional(),
  tableNo: z.string().min(1).max(50),
  serviceType: ServiceTypeEnum,
  serviceLabel: z.string().max(100).optional(),
  note: z.string().max(250).optional(),
  orderId: z.string().optional(),
  customerPhone: z.string().optional(),
});

const UpdateWaiterRequestStatusSchema = z.object({
  status: WaiterRequestStatusEnum,
});

// ─── GET /waiter/requests ───────────────────────────────────────────────────
app.get(
  '/requests',
  apiDoc({
    tags: ['Waiter'],
    summary: 'List Waiter Requests',
    description: 'Retrieves all waiter and assistance requests for an outlet.',
    query: z.object({
      outletId: z.string().optional(),
      status: z.string().optional(), // 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ALL'
      tableNo: z.string().optional(),
      limit: z.string().optional(),
    }),
    responses: {
      200: z.array(z.any()),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const headerOutletId = c.req.header('X-Outlet-Id');
    const queryOutletId = c.req.query('outletId');
    const outletId = queryOutletId || headerOutletId || tenant.outletId || tenant.outletIds?.[0];

    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

    const statusFilter = c.req.query('status') || 'ALL';
    const tableNoFilter = c.req.query('tableNo');
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 200);

    const { db, close } = getDb(c);
    try {
      const conditions = [
        eq(appSchema.waiterRequest.restaurantId, restaurantId),
        eq(appSchema.waiterRequest.outletId, outletId),
      ];

      if (statusFilter && statusFilter !== 'ALL') {
        conditions.push(eq(appSchema.waiterRequest.status, statusFilter));
      }
      if (tableNoFilter) {
        conditions.push(eq(appSchema.waiterRequest.tableNo, tableNoFilter));
      }

      const rows = await db
        .select()
        .from(appSchema.waiterRequest)
        .where(and(...conditions))
        .orderBy(desc(appSchema.waiterRequest.createdAt))
        .limit(limit);

      return c.json(
        rows.map((r: any) => ({
          ...r,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
          completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
        }))
      );
    } finally {
      await close();
    }
  }
);

// ─── POST /waiter/requests ──────────────────────────────────────────────────
app.get(
  '/stats',
  apiDoc({
    tags: ['Waiter'],
    summary: 'Get Waiter & Floor Statistics',
    description: 'Returns counters for pending, in progress, completed today, and ready dishes.',
    query: z.object({
      outletId: z.string().optional(),
    }),
    responses: {
      200: z.any(),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const headerOutletId = c.req.header('X-Outlet-Id');
    const queryOutletId = c.req.query('outletId');
    const outletId = queryOutletId || headerOutletId || tenant.outletId || tenant.outletIds?.[0];

    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const requests = await db
        .select()
        .from(appSchema.waiterRequest)
        .where(
          and(
            eq(appSchema.waiterRequest.restaurantId, restaurantId),
            eq(appSchema.waiterRequest.outletId, outletId),
            gte(appSchema.waiterRequest.createdAt, todayStart)
          )
        );

      let pendingCount = 0;
      let inProgressCount = 0;
      let completedTodayCount = 0;

      for (const r of requests) {
        if (r.status === 'PENDING') pendingCount++;
        else if (r.status === 'IN_PROGRESS') inProgressCount++;
        else if (r.status === 'COMPLETED') completedTodayCount++;
      }

      // Also count dishes in PREPARED status (ready from kitchen waiting for waiter delivery)
      const readyDishesRows = await db
        .select({ id: appSchema.saleOrderItem.id })
        .from(appSchema.saleOrderItem)
        .innerJoin(appSchema.saleOrder, eq(appSchema.saleOrderItem.orderId, appSchema.saleOrder.id))
        .where(
          and(
            eq(appSchema.saleOrder.restaurantId, restaurantId),
            eq(appSchema.saleOrder.outletId, outletId),
            eq(appSchema.saleOrderItem.status, 'PREPARED')
          )
        );

      return c.json({
        pendingCount,
        inProgressCount,
        completedTodayCount,
        readyDishesCount: readyDishesRows.length,
      });
    } finally {
      await close();
    }
  }
);

// ─── POST /waiter/requests ──────────────────────────────────────────────────
app.post(
  '/requests',
  apiDoc({
    tags: ['Waiter'],
    summary: 'Create Waiter Request',
    description: 'Manually creates a new service or assistance request for a table.',
    body: CreateWaiterRequestSchema,
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const user = c.get('sessionUser');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parsed = CreateWaiterRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const headerOutletId = c.req.header('X-Outlet-Id');
    const outletId = parsed.data.outletId || headerOutletId || tenant.outletId || tenant.outletIds?.[0];

    if (!outletId) {
      return c.json({ error: 'Bad Request', message: 'outletId required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

    const id = `wr_${generateId()}`;
    const serviceLabel = parsed.data.serviceLabel || ServiceLabels[parsed.data.serviceType] || 'Staff Assistance';
    const now = new Date();

    const { db, close } = getDb(c);
    try {
      const [newRow] = await db
        .insert(appSchema.waiterRequest)
        .values({
          id,
          restaurantId,
          outletId,
          orderId: parsed.data.orderId || null,
          tableNo: parsed.data.tableNo,
          serviceType: parsed.data.serviceType,
          serviceLabel,
          note: parsed.data.note || null,
          customerPhone: parsed.data.customerPhone || null,
          status: 'PENDING',
          createdBy: (user?.phoneNumber || user?.name || user?.id || null) as string | null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Real-time broadcast to Outlet DO
      await broadcastToOutlet(
        c.env,
        outletId,
        {
          topic: 'ORDERS',
          type: 'WAITER_CALL',
          data: {
            id,
            tableNo: parsed.data.tableNo,
            serviceType: parsed.data.serviceType,
            serviceLabel,
            note: parsed.data.note || null,
            customerPhone: parsed.data.customerPhone || null,
            timestamp: now.getTime(),
          },
        },
        parsed.data.customerPhone
      );

      return c.json(
        {
          ...newRow,
          createdAt: newRow.createdAt.toISOString(),
          updatedAt: newRow.updatedAt.toISOString(),
          completedAt: newRow.completedAt ? newRow.completedAt.toISOString() : null,
        },
        201
      );
    } finally {
      await close();
    }
  }
);

// ─── PATCH /waiter/requests/:id/status ──────────────────────────────────────
app.patch(
  '/requests/:id/status',
  apiDoc({
    tags: ['Waiter'],
    summary: 'Update Waiter Request Status',
    description: 'Marks a waiter request as COMPLETED, IN_PROGRESS, or CANCELLED.',
    params: z.object({ id: z.string() }),
    body: UpdateWaiterRequestStatusSchema,
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const user = c.get('sessionUser');
    const { restaurantId } = tenant;
    const requestId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = UpdateWaiterRequestStatusSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const nextStatus = parsed.data.status;
    const now = new Date();
    const { db, close } = getDb(c);

    try {
      const [existing] = await db
        .select()
        .from(appSchema.waiterRequest)
        .where(
          and(
            eq(appSchema.waiterRequest.id, requestId),
            eq(appSchema.waiterRequest.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!existing) {
        return c.json({ error: 'Not Found', message: 'Waiter request not found' }, 404);
      }

      if (!assertOutletAccess(tenant, existing.outletId)) {
        return c.json({ error: 'Forbidden', message: `You do not have access to this request's outlet` }, 403);
      }

      const updateData: any = {
        status: nextStatus,
        updatedAt: now,
        updatedBy: user?.phoneNumber || user?.name || user?.id || null,
      };

      if (nextStatus === 'COMPLETED') {
        updateData.completedAt = now;
        updateData.completedBy = user?.phoneNumber || user?.name || user?.id || 'Staff';
        updateData.completedByRole = tenant.role || 'WAITER';
      } else if (nextStatus === 'PENDING') {
        updateData.completedAt = null;
        updateData.completedBy = null;
        updateData.completedByRole = null;
      }

      const [updated] = await db
        .update(appSchema.waiterRequest)
        .set(updateData)
        .where(eq(appSchema.waiterRequest.id, requestId))
        .returning();

      // Real-time broadcast to Outlet DO & Customer DO
      await broadcastToOutlet(
        c.env,
        existing.outletId,
        {
          topic: 'ORDERS',
          type: 'WAITER_REQUEST_UPDATED',
          data: {
            id: requestId,
            status: nextStatus,
            tableNo: existing.tableNo,
            serviceType: existing.serviceType,
            serviceLabel: existing.serviceLabel,
            completedAt: updateData.completedAt ? now.getTime() : null,
            completedBy: updateData.completedBy,
            timestamp: now.getTime(),
          },
        },
        existing.customerPhone
      );

      return c.json({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
      });
    } finally {
      await close();
    }
  }
);

export { app as waiterRoutes };
