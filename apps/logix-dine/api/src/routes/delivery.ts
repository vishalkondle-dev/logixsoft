import { Hono } from 'hono';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import { toCustomerAddress, toDeliveryRider, toDeliveryOrder } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { broadcastToOutlet } from '../lib/sync';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { getDb, getPhoneVariants } from '../lib/order-helpers';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

// ─── GET /delivery/customer-addresses/:phone ──────────────────────────────────
async function handleGetCustomerAddresses(c: any) {
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

app.get(
  '/customer-addresses/:phone',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Get Saved Customer Addresses',
    description: 'Retrieves saved delivery addresses for a customer phone number.',
    responses: { 200: z.array(z.any()), 401: ErrorResponseSchema },
  }),
  requirePermission('order:read'),
  handleGetCustomerAddresses
);

// ─── POST /delivery/save-address ──────────────────────────────────────────────
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

async function handleSaveAddress(c: any) {
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
      receiverPhone: parsed.data.receiverPhone || null,
      addressLine1: parsed.data.addressLine1,
      addressLine2: parsed.data.addressLine2 || null,
      landmark: parsed.data.landmark || null,
      city: parsed.data.city,
      pincode: parsed.data.pincode,
      isDefault: parsed.data.isDefault,
      latitude: null,
      longitude: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(appSchema.customerAddress).values(newAddr);
    return c.json(toCustomerAddress(newAddr), 201);
  } finally {
    await close();
  }
}

app.post(
  '/save-address',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Save Customer Address',
    description: 'Creates or updates a saved delivery address for a customer.',
    body: SaveAddressSchema,
    responses: { 201: z.any(), 400: ErrorResponseSchema },
  }),
  requirePermission('order:create'),
  handleSaveAddress
);

// Alias
app.post('/addresses', requirePermission('order:create'), handleSaveAddress);

// ─── GET /delivery/riders ─────────────────────────────────────────────────────
app.get(
  '/riders',
  apiDoc({
    tags: ['Delivery'],
    summary: 'List Delivery Riders',
    description: 'Lists all registered delivery riders for the restaurant/outlet.',
    query: z.object({ outletId: z.string().optional() }),
    responses: { 200: z.array(z.any()), 403: ErrorResponseSchema },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const headerOutletId = c.req.header('X-Outlet-Id');
    const queryOutletId = c.req.query('outletId');
    const outletId = queryOutletId || headerOutletId || tenant.outletId || tenant.outletIds?.[0];

    const { db, close } = getDb(c);
    try {
      const conditions = [eq(appSchema.deliveryRider.restaurantId, restaurantId)];
      if (outletId) {
        conditions.push(eq(appSchema.deliveryRider.outletId, outletId));
      }

      const riders = await db
        .select()
        .from(appSchema.deliveryRider)
        .where(and(...conditions))
        .orderBy(desc(appSchema.deliveryRider.createdAt));

      return c.json(riders.map(toDeliveryRider));
    } finally {
      await close();
    }
  }
);

// ─── POST /delivery/register-rider ───────────────────────────────────────────
const CreateRiderSchema = z.object({
  outletId: z.string(),
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(25),
  vehicleType: z.enum(['BIKE', 'SCOOTER', 'CYCLE', 'EV', 'OTHER']).default('BIKE'),
  vehicleNumber: z.string().max(30).optional(),
});

async function handleRegisterRider(c: any) {
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
    return c.json(toDeliveryRider(newRider), 201);
  } finally {
    await close();
  }
}

app.post(
  '/register-rider',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Register Delivery Rider',
    description: 'Registers a new rider in the delivery fleet.',
    body: CreateRiderSchema,
    responses: { 201: z.any(), 400: ErrorResponseSchema },
  }),
  requirePermission('order:create'),
  handleRegisterRider
);

// ─── POST /delivery/update-rider-duty ─────────────────────────────────────────
const UpdateRiderDutySchema = z.object({
  riderId: z.string(),
  status: z.enum(['AVAILABLE', 'ON_DELIVERY', 'OFFLINE']),
});

async function handleUpdateRiderDuty(c: any, riderId: string, status: any) {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
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

    if (!rider) return c.json({ error: 'Not Found', message: 'Rider not found' }, 404);

    const now = new Date();
    await db
      .update(appSchema.deliveryRider)
      .set({ status, updatedAt: now })
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
        data: { riderId, status, riderName: rider.name },
      }
    );

    return c.json(toDeliveryRider(updated));
  } finally {
    await close();
  }
}

app.post(
  '/update-rider-duty',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Update Rider Duty Status',
    description: 'Toggles rider availability (AVAILABLE, OFFLINE).',
    body: UpdateRiderDutySchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('order:read'),
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = UpdateRiderDutySchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid status' }, 400);
    return handleUpdateRiderDuty(c, parsed.data.riderId, parsed.data.status);
  }
);

// Helper for delivery status transitions
async function transitionDeliveryStatus(c: any, orderId: string, newStatus: any, riderId?: string, deliveryOtp?: string) {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
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
    const updates: any = { status: newStatus, updatedAt: now };

    if (newStatus === 'DELIVERED' && deliveryOtp) {
      if (deliveryOtp.trim() !== existingDelivery.deliveryOtp.trim()) {
        return c.json({ error: 'Invalid OTP', message: 'The entered delivery OTP is incorrect.' }, 400);
      }
    }

    let riderToAssign: any = null;
    if (riderId) {
      const [rider] = await db
        .select()
        .from(appSchema.deliveryRider)
        .where(eq(appSchema.deliveryRider.id, riderId));
      if (rider) {
        riderToAssign = rider;
        updates.riderId = rider.id;
        updates.riderName = rider.name;
        updates.riderPhone = rider.phone;
        updates.riderVehicleNo = rider.vehicleNumber;
      }
    }

    if (newStatus === 'ASSIGNED') updates.assignedAt = now;
    else if (newStatus === 'OUT_FOR_DELIVERY') updates.pickedUpAt = now;
    else if (newStatus === 'DELIVERED') updates.deliveredAt = now;

    await db.transaction(async (tx: any) => {
      await tx
        .update(appSchema.deliveryOrder)
        .set(updates)
        .where(eq(appSchema.deliveryOrder.id, existingDelivery.id));

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

// ─── POST /delivery/assign-rider ──────────────────────────────────────────────
const AssignRiderSchema = z.object({
  orderId: z.string(),
  riderId: z.string(),
});

app.post(
  '/assign-rider',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Assign Rider to Delivery Order',
    description: 'Assigns a fleet rider to handle an order.',
    body: AssignRiderSchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('order:create'),
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AssignRiderSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid data' }, 400);
    return transitionDeliveryStatus(c, parsed.data.orderId, 'ASSIGNED', parsed.data.riderId);
  }
);

// ─── POST /delivery/dispatch-order ────────────────────────────────────────────
const DispatchOrderSchema = z.object({
  orderId: z.string(),
  riderId: z.string().optional(),
});

app.post(
  '/dispatch-order',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Dispatch Order (Out for Delivery)',
    description: 'Marks delivery order as OUT_FOR_DELIVERY.',
    body: DispatchOrderSchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('order:create'),
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = DispatchOrderSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid data' }, 400);
    return transitionDeliveryStatus(c, parsed.data.orderId, 'OUT_FOR_DELIVERY', parsed.data.riderId);
  }
);

// ─── POST /delivery/verify-otp-and-complete ───────────────────────────────────
const VerifyOtpActionSchema = z.object({
  orderId: z.string(),
  deliveryOtp: z.string().optional(),
});

app.post(
  '/verify-otp-and-complete',
  apiDoc({
    tags: ['Delivery'],
    summary: 'Verify OTP and Complete Delivery',
    description: 'Verifies customer 4-digit PIN and marks order DELIVERED and settled.',
    body: VerifyOtpActionSchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('order:create'),
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = VerifyOtpActionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid data' }, 400);
    return transitionDeliveryStatus(c, parsed.data.orderId, 'DELIVERED', undefined, parsed.data.deliveryOtp);
  }
);

export const deliveryRoutes = app;
