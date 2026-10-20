import { Hono } from 'hono';
import { eq, and, desc, inArray, ne, or, isNull, sql } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import { toReservation } from '@logixsoft/logix-dine/mappers/pos';
import {
  TableReservationSchema,
  CreateReservationSchema,
  UpdateReservationSchema,
} from '@logixsoft/logix-dine/schemas/pos';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';
import { getDb } from '../lib/order-helpers';
import { broadcastToOutlet } from '../lib/sync';
import * as z from 'zod';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

// ─── GET /reservations ────────────────────────────────────────────────────────
app.get(
  '/',
  apiDoc({
    tags: ['Reservations'],
    summary: 'List Table Reservations',
    description: 'Returns table reservations for the restaurant, optionally filtered by outlet, date, or status.',
    query: z.object({
      outletId: z.string().optional(),
      date: z.string().optional(),
      status: z.enum(['CONFIRMED', 'SEATED', 'CANCELLED', 'COMPLETED']).optional(),
    }),
    responses: {
      200: z.array(TableReservationSchema),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('table:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId');
    const date = c.req.query('date');
    const status = c.req.query('status') as any;

    if (outletId && !assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const conditions = [eq(appSchema.tableReservation.restaurantId, restaurantId)];

      if (outletId) {
        conditions.push(eq(appSchema.tableReservation.outletId, outletId));
      } else if (!tenant.allOutlets && tenant.role !== 'OWNER' && tenant.role !== 'ADMIN') {
        conditions.push(inArray(appSchema.tableReservation.outletId, tenant.outletIds || ['__none__']));
      }

      if (date) {
        conditions.push(eq(appSchema.tableReservation.reservationDate, date));
      }

      if (status) {
        conditions.push(eq(appSchema.tableReservation.status, status));
      }

      const rows = await db
        .select()
        .from(appSchema.tableReservation)
        .where(and(...conditions))
        .orderBy(desc(appSchema.tableReservation.reservationDate), desc(appSchema.tableReservation.startTime));

      return c.json(rows.map(toReservation));
    } finally {
      await close();
    }
  }
);

// ─── POST /reservations ───────────────────────────────────────────────────────
app.post(
  '/',
  apiDoc({
    tags: ['Reservations'],
    summary: 'Create Table Reservation',
    description: 'Creates a new guest reservation for a table or time slot.',
    body: CreateReservationSchema,
    responses: {
      201: TableReservationSchema,
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('table:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = (tenant as any).phone || (tenant as any).phoneNumber || 'system';
    const body = await c.req.json().catch(() => ({}));
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const { outletId, tableId, tableName, guestName, guestPhone, guestEmail, partySize, reservationDate, startTime, endTime, notes } = parsed.data;

    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      let resolvedTableName = tableName || null;
      if (tableId && !resolvedTableName) {
        const [table] = await db
          .select({ name: appSchema.posTable.name })
          .from(appSchema.posTable)
          .where(and(eq(appSchema.posTable.id, tableId), eq(appSchema.posTable.restaurantId, restaurantId)));
        if (table) resolvedTableName = table.name;
      }

      const id = generateId('res');
      const now = new Date();
      await db.insert(appSchema.tableReservation).values({
        id,
        restaurantId,
        outletId,
        tableId: tableId || null,
        tableName: resolvedTableName,
        guestName,
        guestPhone,
        guestEmail: guestEmail || null,
        partySize: partySize || 2,
        reservationDate,
        startTime,
        endTime: endTime || null,
        status: 'CONFIRMED',
        notes: notes || null,
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
      });

      const [created] = await db
        .select()
        .from(appSchema.tableReservation)
        .where(eq(appSchema.tableReservation.id, id));

      await broadcastToOutlet(c.env, outletId, {
        topic: 'TABLES',
        type: 'RESERVATION_CREATED',
        data: { reservationId: id },
      }).catch(() => {});

      return c.json(toReservation(created), 201);
    } finally {
      await close();
    }
  }
);

// ─── GET /reservations/:id ────────────────────────────────────────────────────
app.get(
  '/:id',
  apiDoc({
    tags: ['Reservations'],
    summary: 'Get Table Reservation by ID',
    params: z.object({ id: z.string() }),
    responses: {
      200: TableReservationSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('table:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const id = c.req.param('id');

    const { db, close } = getDb(c);
    try {
      const [row] = await db
        .select()
        .from(appSchema.tableReservation)
        .where(and(eq(appSchema.tableReservation.id, id), eq(appSchema.tableReservation.restaurantId, restaurantId)));

      if (!row) return c.json({ error: 'Not Found', message: 'Reservation not found' }, 404);
      if (!assertOutletAccess(tenant, row.outletId)) {
        return c.json({ error: 'Forbidden', message: 'No access to this reservation outlet' }, 403);
      }

      return c.json(toReservation(row));
    } finally {
      await close();
    }
  }
);

// ─── PATCH /reservations/:id ──────────────────────────────────────────────────
app.patch(
  '/:id',
  apiDoc({
    tags: ['Reservations'],
    summary: 'Update Table Reservation',
    description: 'Updates reservation status (CONFIRMED, SEATED, CANCELLED, COMPLETED) or reservation details.',
    params: z.object({ id: z.string() }),
    body: UpdateReservationSchema,
    responses: {
      200: TableReservationSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('table:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const actorPhone = (tenant as any).phone || (tenant as any).phoneNumber || 'system';
    const id = c.req.param('id');

    const body = await c.req.json().catch(() => ({}));
    const parsed = UpdateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.tableReservation)
        .where(and(eq(appSchema.tableReservation.id, id), eq(appSchema.tableReservation.restaurantId, restaurantId)));

      if (!existing) return c.json({ error: 'Not Found', message: 'Reservation not found' }, 404);
      if (!assertOutletAccess(tenant, existing.outletId)) {
        return c.json({ error: 'Forbidden', message: 'No access to this reservation outlet' }, 403);
      }

      const updateData: Record<string, any> = {
        ...parsed.data,
        updatedAt: new Date(),
        updatedBy: actorPhone,
      };

      if (parsed.data.tableId && !parsed.data.tableName) {
        const [table] = await db
          .select({ name: appSchema.posTable.name })
          .from(appSchema.posTable)
          .where(and(eq(appSchema.posTable.id, parsed.data.tableId), eq(appSchema.posTable.restaurantId, restaurantId)));
        if (table) updateData.tableName = table.name;
      }

      if (parsed.data.status === 'SEATED' && existing.status !== 'SEATED') {
        const targetTableName = updateData.tableName !== undefined ? updateData.tableName : existing.tableName;
        const targetTableId = updateData.tableId !== undefined ? updateData.tableId : existing.tableId;

        if (!targetTableName && !targetTableId) {
          return c.json({ error: 'Bad Request', message: 'Please assign a table before marking reservation as seated.' }, 400);
        }

        let resolvedName = targetTableName;
        let resolvedId = targetTableId;
        if (resolvedId && !resolvedName) {
          const [t] = await db
            .select({ name: appSchema.posTable.name })
            .from(appSchema.posTable)
            .where(and(eq(appSchema.posTable.id, resolvedId), eq(appSchema.posTable.restaurantId, restaurantId)));
          if (t) resolvedName = t.name;
        } else if (resolvedName && !resolvedId) {
          const [t] = await db
            .select({ id: appSchema.posTable.id })
            .from(appSchema.posTable)
            .where(
              and(
                eq(appSchema.posTable.restaurantId, restaurantId),
                eq(appSchema.posTable.outletId, existing.outletId),
                sql`LOWER(TRIM(${appSchema.posTable.name})) = LOWER(TRIM(${resolvedName}))`
              )
            );
          if (t) resolvedId = t.id;
        }

        // Check 1: Does this table have an active un-freed order?
        const tableOrderConditions = [];
        if (resolvedName) {
          tableOrderConditions.push(sql`LOWER(TRIM(${appSchema.saleOrder.tableNo})) = LOWER(TRIM(${resolvedName}))`);
        }
        if (resolvedId) {
          tableOrderConditions.push(eq(appSchema.saleOrder.tableNo, resolvedId));
        }

        const [activeOrder] = await db
          .select({
            id: appSchema.saleOrder.id,
            orderNo: appSchema.saleOrder.orderNo,
            tableNo: appSchema.saleOrder.tableNo,
          })
          .from(appSchema.saleOrder)
          .where(
            and(
              eq(appSchema.saleOrder.restaurantId, restaurantId),
              eq(appSchema.saleOrder.outletId, existing.outletId),
              isNull(appSchema.saleOrder.tableFreedAt),
              ne(appSchema.saleOrder.status, 'VOID'),
              or(...tableOrderConditions)
            )
          )
          .limit(1);

        if (activeOrder) {
          return c.json(
            {
              error: 'Conflict',
              message: `Cannot seat reservation: Table "${resolvedName || resolvedId}" is not free (occupied by Token #${activeOrder.orderNo}). Please free or settle the table before seating new guests.`,
            },
            409
          );
        }

        // Check 2: Does this table have another reservation currently SEATED?
        const resvConditions = [];
        if (resolvedName) {
          resvConditions.push(sql`LOWER(TRIM(${appSchema.tableReservation.tableName})) = LOWER(TRIM(${resolvedName}))`);
        }
        if (resolvedId) {
          resvConditions.push(eq(appSchema.tableReservation.tableId, resolvedId));
        }

        const [otherSeated] = await db
          .select({
            id: appSchema.tableReservation.id,
            guestName: appSchema.tableReservation.guestName,
          })
          .from(appSchema.tableReservation)
          .where(
            and(
              eq(appSchema.tableReservation.restaurantId, restaurantId),
              eq(appSchema.tableReservation.outletId, existing.outletId),
              ne(appSchema.tableReservation.id, id),
              eq(appSchema.tableReservation.status, 'SEATED'),
              or(...resvConditions)
            )
          )
          .limit(1);

        if (otherSeated) {
          return c.json(
            {
              error: 'Conflict',
              message: `Cannot seat reservation: Table "${resolvedName || resolvedId}" is already seated with guest "${otherSeated.guestName}".`,
            },
            409
          );
        }
      }

      await db
        .update(appSchema.tableReservation)
        .set(updateData)
        .where(eq(appSchema.tableReservation.id, id));

      const [updated] = await db
        .select()
        .from(appSchema.tableReservation)
        .where(eq(appSchema.tableReservation.id, id));

      await broadcastToOutlet(c.env, existing.outletId, {
        topic: 'TABLES',
        type: 'RESERVATION_UPDATED',
        data: { reservationId: id, status: updated?.status },
      }).catch(() => {});

      return c.json(toReservation(updated));
    } finally {
      await close();
    }
  }
);

// ─── DELETE /reservations/:id ─────────────────────────────────────────────────
app.delete(
  '/:id',
  apiDoc({
    tags: ['Reservations'],
    summary: 'Delete or Cancel Reservation',
    params: z.object({ id: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('table:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const id = c.req.param('id');

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.tableReservation)
        .where(and(eq(appSchema.tableReservation.id, id), eq(appSchema.tableReservation.restaurantId, restaurantId)));

      if (!existing) return c.json({ error: 'Not Found', message: 'Reservation not found' }, 404);
      if (!assertOutletAccess(tenant, existing.outletId)) {
        return c.json({ error: 'Forbidden', message: 'No access to this reservation outlet' }, 403);
      }

      await db.delete(appSchema.tableReservation).where(eq(appSchema.tableReservation.id, id));

      await broadcastToOutlet(c.env, existing.outletId, {
        topic: 'TABLES',
        type: 'RESERVATION_DELETED',
        data: { reservationId: id },
      }).catch(() => {});

      return c.json({ success: true, message: 'Reservation removed' });
    } finally {
      await close();
    }
  }
);

export { app as reservationRoutes };
export default app;
