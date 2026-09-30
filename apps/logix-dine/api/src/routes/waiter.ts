import { Hono } from 'hono';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { appSchema } from '../db';
import { requirePermission, assertOutletAccess, assertOutletPlanFeature } from '../lib/tenancy';
import type { AuthEnv } from '../lib/auth';
import * as z from 'zod';
import { broadcastToOutlet } from '../lib/sync';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { getDb, getOrderWithItems } from '../lib/order-helpers';
import { computeOrderStatus } from '@logixsoft/logix-dine/types/pos-schema';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

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

const UpdateRequestStatusSchema = z.object({
  requestId: z.string(),
  status: WaiterRequestStatusEnum,
});

const RequestActionSchema = z.object({
  requestId: z.string(),
});

// Helper for fetching requests
async function handleListRequests(c: any) {
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
  const planCheck = assertOutletPlanFeature(tenant, outletId, 'waiter');
  if (!planCheck.allowed) {
    return c.json({ error: planCheck.error || 'Plan Upgrade Required', message: planCheck.message }, 403);
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

// ─── GET /waiter/active-requests ──────────────────────────────────────────────
app.get(
  '/active-requests',
  apiDoc({
    tags: ['Waiter'],
    summary: 'List Active Waiter Requests',
    description: 'Retrieves all waiter and assistance requests for an outlet.',
    query: z.object({
      outletId: z.string().optional(),
      status: z.string().optional(),
      tableNo: z.string().optional(),
      limit: z.string().optional(),
    }),
    responses: { 200: z.array(z.any()), 403: ErrorResponseSchema },
  }),
  requirePermission('waiter:read'),
  handleListRequests
);

// ─── GET /waiter/stats ────────────────────────────────────────────────────────
app.get(
  '/stats',
  apiDoc({
    tags: ['Waiter'],
    summary: 'Get Waiter & Floor Statistics',
    description: 'Returns counters for pending, in progress, completed today, and ready dishes.',
    query: z.object({ outletId: z.string().optional() }),
    responses: { 200: z.any(), 403: ErrorResponseSchema },
  }),
  requirePermission('waiter:read'),
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

// ─── POST /waiter/call-assistance ─────────────────────────────────────────────
async function handleCreateRequest(c: any) {
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

app.post(
  '/call-assistance',
  apiDoc({
    tags: ['Waiter'],
    summary: 'Call Waiter Assistance',
    description: 'Creates a new assistance request for a table.',
    body: CreateWaiterRequestSchema,
    responses: { 201: z.any(), 400: ErrorResponseSchema, 403: ErrorResponseSchema },
  }),
  requirePermission('waiter:write'),
  handleCreateRequest
);

// ─── POST /waiter/attend-request ──────────────────────────────────────────────
app.post(
  '/attend-request',
  apiDoc({
    tags: ['Waiter'],
    summary: 'Attend Waiter Request',
    description: 'Staff claims the request and marks status as IN_PROGRESS.',
    body: RequestActionSchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('waiter:write'),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = RequestActionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    return updateStatusHelper(c, parsed.data.requestId, 'IN_PROGRESS');
  }
);

// ─── POST /waiter/complete-request ────────────────────────────────────────────
app.post(
  '/complete-request',
  apiDoc({
    tags: ['Waiter'],
    summary: 'Complete Waiter Request',
    description: 'Marks assistance request as completed.',
    body: RequestActionSchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('waiter:write'),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = RequestActionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    return updateStatusHelper(c, parsed.data.requestId, 'COMPLETED');
  }
);

// ─── POST /waiter/update-request-status ────────────────────────────────────────
app.post(
  '/update-request-status',
  apiDoc({
    tags: ['Waiter'],
    summary: 'Update Waiter Request Status',
    description: 'Sets status to PENDING, IN_PROGRESS, COMPLETED, or CANCELLED.',
    body: UpdateRequestStatusSchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('waiter:write'),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = UpdateRequestStatusSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    return updateStatusHelper(c, parsed.data.requestId, parsed.data.status);
  }
);

async function updateStatusHelper(c: any, requestId: string, nextStatus: any) {
  const tenant = c.get('tenant');
  const user = c.get('sessionUser');
  const { restaurantId } = tenant;
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
      updateData.completedBy = user?.phoneNumber || user?.name || user?.id || null;
    }

    const [updated] = await db
      .update(appSchema.waiterRequest)
      .set(updateData)
      .where(eq(appSchema.waiterRequest.id, requestId))
      .returning();

    await broadcastToOutlet(
      c.env,
      existing.outletId,
      {
        topic: 'ORDERS',
        type: 'WAITER_CALL_STATUS_CHANGED',
        data: {
          id: requestId,
          status: nextStatus,
          tableNo: existing.tableNo,
          customerPhone: existing.customerPhone,
          serviceLabel: existing.serviceLabel,
          updatedAt: now.getTime(),
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

// ─── POST /waiter/mark-item-served ────────────────────────────────────────────
const MarkItemServedSchema = z.object({
  orderId: z.string(),
  orderItemId: z.string(),
});

app.post(
  '/mark-item-served',
  apiDoc({
    tags: ['Waiter'],
    summary: 'Mark Prepared Item as Served',
    description: 'Waiter marks a prepared dish as delivered/served to the table.',
    body: MarkItemServedSchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('waiter:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const user = c.get('sessionUser');
    const { restaurantId } = tenant;
    const actorPhone = c.get('actorPhone') || '';
    const body = await c.req.json().catch(() => ({}));
    const parsed = MarkItemServedSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { orderId, orderItemId } = parsed.data;
    const { db, close } = getDb(c);

    try {
      const [order] = await db
        .select()
        .from(appSchema.saleOrder)
        .where(and(eq(appSchema.saleOrder.id, orderId), eq(appSchema.saleOrder.restaurantId, restaurantId)));

      if (!order) return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
      if (!assertOutletAccess(tenant, order.outletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }

      const now = new Date();
      await db.transaction(async (tx: any) => {
        await tx
          .update(appSchema.saleOrderItem)
          .set({ status: 'SERVED', updatedAt: now, updatedBy: actorPhone || 'Waiter' })
          .where(eq(appSchema.saleOrderItem.id, orderItemId));

        await tx.insert(appSchema.orderItemAudit).values({
          id: generateId('audit'),
          orderId,
          orderItemId,
          fromStatus: 'PREPARED',
          toStatus: 'SERVED',
          changedBy: actorPhone || 'Waiter',
          changedByRole: tenant.role || 'WAITER',
          createdAt: now,
        });

        const allItems = await tx
          .select({ status: appSchema.saleOrderItem.status })
          .from(appSchema.saleOrderItem)
          .where(eq(appSchema.saleOrderItem.orderId, orderId));
        const newOrderStatus = computeOrderStatus(allItems.map((i: any) => i.status));
        await tx
          .update(appSchema.saleOrder)
          .set({ orderStatus: newOrderStatus, updatedAt: now, updatedBy: actorPhone })
          .where(eq(appSchema.saleOrder.id, orderId));
      });

      const result = await getOrderWithItems(db, orderId, restaurantId);
      await broadcastToOutlet(
        c.env,
        order.outletId,
        {
          topic: 'KITCHEN',
          type: 'ITEM_STATUS_CHANGED',
          data: { orderId, orderItemId, status: 'SERVED', tableNo: order.tableNo },
        },
        order.customerPhone
      );

      return c.json(result);
    } finally {
      await close();
    }
  }
);

export { app as waiterRoutes };
