import { Hono } from 'hono';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import { toCustomerAddress, toDeliveryRider, toDeliveryOrder } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { broadcastToOutlet } from '../lib/sync';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { getPhoneVariants } from './customer-portal';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// ─── GET /delivery/addresses/:phone ──────────────────────────────────────────
app.get(
  '/addresses/:phone',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Get Saved Customer Addresses',
    description: 'Retrieves saved delivery addresses for a customer phone number.',
    responses: {
      200: z.array(z.any()),
      401: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const phone = c.req.param('phone');
    if (!phone) {
      return c.json({ error: 'Bad Request', message: 'Phone number is required' }, 400);
    }

    const { variants } = getPhoneVariants(phone);
    const { db, close } = getDb(c);

    try {
      const addresses = await db
        .select()
        .from(appSchema.customerAddress)
        .where(inArray(appSchema.customerAddress.customerPhone, variants))
        .orderBy(desc(appSchema.customerAddress.isDefault), desc(appSchema.customerAddress.updatedAt));

      return c.json(addresses.map(toCustomerAddress));
    } finally {
      await close();
    }
  }
);

// ─── POST /delivery/addresses ────────────────────────────────────────────────
const SaveAddressSchema = z.object({
  customerPhone: z.string().min(10).max(25),
  label: z.string().max(50).optional().default('Home'),
  receiverName: z.string().max(100).optional(),
  receiverPhone: z.string().max(25).optional(),
  addressLine1: z.string().min(1).max(255),
  addressLine2: z.string().max(255).optional(),
  landmark: z.string().max(100).optional(),
  city: z.string().max(100).optional().default(''),
  pincode: z.string().max(10).optional().default(''),
  isDefault: z.boolean().optional().default(false),
});

app.post(
  '/addresses',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Save Customer Address',
    description: 'Creates or updates a saved delivery address for a customer.',
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SaveAddressSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid address' }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const now = new Date();
      const addrId = generateId('addr');

      if (parsed.data.isDefault) {
        await db
          .update(appSchema.customerAddress)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(appSchema.customerAddress.customerPhone, parsed.data.customerPhone));
      }

      const newAddr = {
        id: addrId,
        customerPhone: parsed.data.customerPhone,
        label: parsed.data.label,
        receiverName: parsed.data.receiverName || null,
        receiverPhone: parsed.data.receiverPhone || parsed.data.customerPhone,
        addressLine1: parsed.data.addressLine1,
        addressLine2: parsed.data.addressLine2 || null,
        landmark: parsed.data.landmark || null,
        city: parsed.data.city,
        pincode: parsed.data.pincode,
        latitude: null,
        longitude: null,
        isDefault: parsed.data.isDefault,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(appSchema.customerAddress).values(newAddr);
      return c.json(toCustomerAddress(newAddr));
    } finally {
      await close();
    }
  }
);

// ─── GET /delivery/riders ────────────────────────────────────────────────────
app.get(
  '/riders',
  apiDoc({
    tags: ['Delivery'],
    summary: 'List Delivery Riders',
    description: 'Retrieves all delivery riders for the outlet fleet.',
    query: z.object({ outletId: z.string().optional() }),
    responses: {
      200: z.array(z.any()),
      401: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || c.req.header('x-outlet-id');

    if (outletId && !assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const conditions = [eq(appSchema.deliveryRider.restaurantId, restaurantId)];
      if (outletId) {
        conditions.push(eq(appSchema.deliveryRider.outletId, outletId));
      } else if (tenant.outletIds && tenant.outletIds.length > 0) {
        conditions.push(inArray(appSchema.deliveryRider.outletId, tenant.outletIds));
      }

      const riders = await db
        .select()
        .from(appSchema.deliveryRider)
        .where(and(...conditions))
        .orderBy(appSchema.deliveryRider.name);

      return c.json(riders.map(toDeliveryRider));
    } finally {
      await close();
    }
  }
);

// ─── POST /delivery/riders ───────────────────────────────────────────────────
const CreateRiderSchema = z.object({
  outletId: z.string(),
  name: z.string().min(1).max(100),
  phone: z.string().min(10).max(25),
  vehicleType: z.string().optional().default('BIKE'),
  vehicleNumber: z.string().max(50).optional(),
});

app.post(
  '/riders',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Create Delivery Rider',
    description: 'Adds a new rider to the delivery fleet.',
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => null);
    const parsed = CreateRiderSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid rider data' }, 400);
    }

    if (!assertOutletAccess(tenant, parsed.data.outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${parsed.data.outletId}'` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const now = new Date();
      const riderId = generateId('rider');
      const newRider = {
        id: riderId,
        restaurantId,
        outletId: parsed.data.outletId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        vehicleType: parsed.data.vehicleType,
        vehicleNumber: parsed.data.vehicleNumber || null,
        status: 'AVAILABLE',
        currentLatitude: null,
        currentLongitude: null,
        lastLocationAt: null,
        activeOrderId: null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(appSchema.deliveryRider).values(newRider);
      return c.json(toDeliveryRider(newRider));
    } finally {
      await close();
    }
  }
);

// ─── PATCH /delivery/orders/:id/status ───────────────────────────────────────
const UpdateDeliveryStatusSchema = z.object({
  status: z.enum(['ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
  riderId: z.string().optional(),
  deliveryOtp: z.string().optional(),
  failedReason: z.string().max(255).optional(),
});

app.patch(
  '/orders/:id/status',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Update Delivery Order Status',
    description: 'Transitions delivery order state, assigns rider, or marks delivered with OTP.',
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const orderId = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    const parsed = UpdateDeliveryStatusSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid update data' }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const [existingDelivery] = await db
        .select()
        .from(appSchema.deliveryOrder)
        .where(
          and(
            eq(appSchema.deliveryOrder.orderId, orderId),
            eq(appSchema.deliveryOrder.restaurantId, restaurantId)
          )
        );

      if (!existingDelivery) {
        return c.json({ error: 'Not Found', message: `Delivery details not found for order '${orderId}'` }, 404);
      }

      if (!assertOutletAccess(tenant, existingDelivery.outletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }

      const now = new Date();
      const newStatus = parsed.data.status;
      const updates: any = {
        status: newStatus,
        updatedAt: now,
      };

      // OTP Verification on DELIVERED if provided
      if (newStatus === 'DELIVERED' && parsed.data.deliveryOtp) {
        if (parsed.data.deliveryOtp.trim() !== existingDelivery.deliveryOtp.trim()) {
          return c.json({ error: 'Invalid OTP', message: 'The entered delivery OTP is incorrect.' }, 400);
        }
      }

      // Rider details
      let riderToAssign: any = null;
      if (parsed.data.riderId) {
        const [rider] = await db
          .select()
          .from(appSchema.deliveryRider)
          .where(eq(appSchema.deliveryRider.id, parsed.data.riderId));
        if (rider) {
          riderToAssign = rider;
          updates.riderId = rider.id;
          updates.riderName = rider.name;
          updates.riderPhone = rider.phone;
          updates.riderVehicleNo = rider.vehicleNumber;
        }
      }

      if (newStatus === 'ASSIGNED') {
        updates.assignedAt = now;
      } else if (newStatus === 'OUT_FOR_DELIVERY') {
        updates.pickedUpAt = now;
      } else if (newStatus === 'DELIVERED') {
        updates.deliveredAt = now;
      } else if (newStatus === 'CANCELLED') {
        updates.failedReason = parsed.data.failedReason || null;
      }

      await db.transaction(async (tx: any) => {
        await tx
          .update(appSchema.deliveryOrder)
          .set(updates)
          .where(eq(appSchema.deliveryOrder.id, existingDelivery.id));

        // Update rider active order status
        if (riderToAssign && (newStatus === 'ASSIGNED' || newStatus === 'OUT_FOR_DELIVERY')) {
          await tx
            .update(appSchema.deliveryRider)
            .set({ status: 'ON_DELIVERY', activeOrderId: orderId, updatedAt: now })
            .where(eq(appSchema.deliveryRider.id, riderToAssign.id));
        } else if ((newStatus === 'DELIVERED' || newStatus === 'CANCELLED') && existingDelivery.riderId) {
          await tx
            .update(appSchema.deliveryRider)
            .set({ status: 'AVAILABLE', activeOrderId: null, updatedAt: now })
            .where(eq(appSchema.deliveryRider.id, existingDelivery.riderId));
        }

        // If DELIVERED, also settle the sale order if it was not settled
        if (newStatus === 'DELIVERED') {
          const [saleOrder] = await tx
            .select()
            .from(appSchema.saleOrder)
            .where(eq(appSchema.saleOrder.id, orderId));

          if (saleOrder && saleOrder.status !== 'PAID' && saleOrder.status !== 'VOID') {
            await tx
              .update(appSchema.saleOrder)
              .set({
                status: 'PAID',
                paidPaise: saleOrder.subtotalPaise,
                settledAt: now,
                updatedAt: now,
              })
              .where(eq(appSchema.saleOrder.id, orderId));
          }
        }
      });

      const [updatedDelivery] = await db
        .select()
        .from(appSchema.deliveryOrder)
        .where(eq(appSchema.deliveryOrder.id, existingDelivery.id));

      // Broadcast real-time event to outlet and customer
      await broadcastToOutlet(
        c.env,
        existingDelivery.outletId,
        {
          topic: 'ORDERS',
          type: 'DELIVERY_STATUS_UPDATED',
          data: {
            orderId,
            status: newStatus,
            riderName: updatedDelivery?.riderName,
            riderPhone: updatedDelivery?.riderPhone,
            customerPhone: existingDelivery.customerPhone,
          },
        },
        existingDelivery.customerPhone
      );

      return c.json(toDeliveryOrder(updatedDelivery));
    } finally {
      await close();
    }
  }
);

// ─── PATCH /delivery/riders/:id/status ───────────────────────────────────────
const UpdateRiderStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'ON_DELIVERY', 'OFFLINE']),
});

app.patch(
  '/riders/:id/status',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Update Delivery Rider Status',
    description: 'Updates rider duty status (AVAILABLE, ON_DELIVERY, OFFLINE).',
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const riderId = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    const parsed = UpdateRiderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid status' }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const [rider] = await db
        .select()
        .from(appSchema.deliveryRider)
        .where(
          and(
            eq(appSchema.deliveryRider.id, riderId),
            eq(appSchema.deliveryRider.restaurantId, restaurantId)
          )
        );

      if (!rider) {
        return c.json({ error: 'Not Found', message: 'Rider not found' }, 404);
      }

      const now = new Date();
      await db
        .update(appSchema.deliveryRider)
        .set({ status: parsed.data.status, updatedAt: now })
        .where(eq(appSchema.deliveryRider.id, riderId));

      const [updated] = await db
        .select()
        .from(appSchema.deliveryRider)
        .where(eq(appSchema.deliveryRider.id, riderId));

      await broadcastToOutlet(
        c.env,
        rider.outletId,
        {
          topic: 'ORDERS',
          type: 'RIDER_STATUS_UPDATED',
          data: { riderId, status: parsed.data.status, riderName: rider.name },
        }
      );

      return c.json(toDeliveryRider(updated));
    } finally {
      await close();
    }
  }
);

export const deliveryRoutes = app;
