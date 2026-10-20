import { Hono } from 'hono';
import { sql, eq, and, desc, inArray, or } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { sendWhatsAppText } from '@logixsoft/wa';
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
  BroadcastWhatsAppSchema,
  CUSTOMER_SEGMENTS,
} from '@logixsoft/logix-dine/schemas/pos';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function kv(c: any) {
  return c.env?.CACHE;
}

// Normalize phone number to match various database stored formats
function getPhoneVariants(input: string): { rawDigits: string; variants: string[] } {
  const cleaned = input.trim();
  const digits = cleaned.replace(/\D/g, '');
  const last10 = digits.slice(-10);

  const variants = new Set<string>();
  if (digits) variants.add(digits);
  if (cleaned) variants.add(cleaned);
  if (last10.length === 10) {
    variants.add(last10);
    variants.add(`91${last10}`);
    variants.add(`+91${last10}`);
    variants.add(`0${last10}`);
  }
  return { rawDigits: last10 || digits, variants: Array.from(variants) };
}

function checkIsNonVeg(name?: string | null): boolean {
  if (!name) return false;
  return /chicken|mutton|fish|prawn|egg|lamb|meat|keema|beef|pork|seafood/i.test(name) && !/veg/i.test(name);
}

// ─── GET /customers (Central Customer CRM Directory & Segments) ───────────────
app.get(
  '/',
  apiDoc({
    tags: ['Customers'],
    summary: 'Central Customer CRM Directory & Segments',
    description: 'Lists all customers with dynamic segmentation, lifetime spend, visits, recency, and directory analytics.',
    query: z.object({
      search: z.string().optional(),
      segment: z.string().optional(),
      outletId: z.string().optional(),
      sortBy: z.string().optional(),
      limit: z.coerce.number().optional().default(50),
      offset: z.coerce.number().optional().default(0),
    }),
    responses: {
      200: z.any(),
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const filterOutletId = c.req.query('outletId');
    const search = (c.req.query('search') || '').toLowerCase().trim();
    const segment = (c.req.query('segment') || 'ALL').toUpperCase().trim();
    const sortBy = c.req.query('sortBy') || 'recent';
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit')) || 50));
    const offset = Math.max(0, Number(c.req.query('offset')) || 0);

    if (filterOutletId && !assertOutletAccess(tenant, filterOutletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${filterOutletId}'` }, 403);
    }

    const { db, close } = getDb(c);

    try {
      // 1. Fast sync of orders into restaurantCustomer table
      try {
        await db.execute(sql`
          INSERT INTO "restaurantCustomer" (
            "id", "restaurantId", "phone", "name", "email", "totalOrders", "totalSpendPaise", "avgOrderPaise", "firstVisitAt", "lastVisitAt", "createdAt", "updatedAt"
          )
          SELECT 
            gen_random_uuid()::text,
            "restaurantId",
            RIGHT(REGEXP_REPLACE("customerPhone", '\D', '', 'g'), 10) as p,
            MAX(u.name),
            MAX(u.email),
            COUNT(*),
            COALESCE(SUM("paidPaise"), 0),
            CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM("paidPaise"), 0) / COUNT(*) ELSE 0 END,
            MIN("saleOrder"."createdAt"),
            MAX("saleOrder"."createdAt"),
            MIN("saleOrder"."createdAt"),
            MAX("saleOrder"."updatedAt")
          FROM "saleOrder"
          LEFT JOIN "user" u ON RIGHT(REGEXP_REPLACE(u."phoneNumber", '\D', '', 'g'), 10) = RIGHT(REGEXP_REPLACE("saleOrder"."customerPhone", '\D', '', 'g'), 10)
          WHERE "restaurantId" = ${restaurantId}
            AND "customerPhone" IS NOT NULL 
            AND LENGTH(REGEXP_REPLACE("customerPhone", '\D', '', 'g')) >= 10
          GROUP BY "restaurantId", RIGHT(REGEXP_REPLACE("customerPhone", '\D', '', 'g'), 10)
          ON CONFLICT ("restaurantId", "phone") DO UPDATE SET
            "name" = COALESCE("restaurantCustomer"."name", EXCLUDED."name"),
            "email" = COALESCE("restaurantCustomer"."email", EXCLUDED."email"),
            "totalOrders" = EXCLUDED."totalOrders",
            "totalSpendPaise" = EXCLUDED."totalSpendPaise",
            "avgOrderPaise" = EXCLUDED."avgOrderPaise",
            "firstVisitAt" = EXCLUDED."firstVisitAt",
            "lastVisitAt" = EXCLUDED."lastVisitAt",
            "updatedAt" = now()
          WHERE "restaurantCustomer"."totalOrders" != EXCLUDED."totalOrders"
             OR "restaurantCustomer"."totalSpendPaise" != EXCLUDED."totalSpendPaise";
        `);

        // Sync names from deliveryOrder if missing
        await db.execute(sql`
          UPDATE "restaurantCustomer" c
          SET "name" = d."customerName"
          FROM "deliveryOrder" d
          WHERE c."restaurantId" = ${restaurantId}
            AND (c.name IS NULL OR c.name = '')
            AND d."customerPhone" IS NOT NULL
            AND RIGHT(REGEXP_REPLACE(d."customerPhone", '\D', '', 'g'), 10) = c.phone
            AND d."customerName" IS NOT NULL AND d."customerName" != '';
        `);
      } catch (syncErr) {
        console.warn('Auto-sync orders into customer CRM warning:', syncErr);
      }

      // 2. Fetch all customers for this restaurant
      const rows = await db
        .select()
        .from(appSchema.restaurantCustomer)
        .where(eq(appSchema.restaurantCustomer.restaurantId, restaurantId));

      const now = Date.now();

      // Enrich & classify all customers
      const allCustomers = rows.map((row: any) => {
        const lastVisitMs = row.lastVisitAt ? new Date(row.lastVisitAt).getTime() : 0;
        const daysSinceLastVisit = lastVisitMs > 0 ? Math.floor((now - lastVisitMs) / (1000 * 60 * 60 * 24)) : 999;
        const totalOrders = row.totalOrders || 0;
        const totalSpendPaise = row.totalSpendPaise || 0;
        const avgOrderPaise = row.avgOrderPaise || (totalOrders > 0 ? Math.round(totalSpendPaise / totalOrders) : 0);

        // Dynamic Segments
        const isRegular = totalOrders >= 3;
        const isNew = totalOrders === 1 && daysSinceLastVisit <= 30;
        const isAtRisk = totalOrders >= 2 && daysSinceLastVisit >= 30 && daysSinceLastVisit <= 60;
        const isInactive = daysSinceLastVisit > 60;
        const isHighSpend = avgOrderPaise >= 80000 || totalSpendPaise >= 500000;
        const isVeg = row.dietaryPreference === 'VEG';
        const isNonVeg = row.dietaryPreference === 'NON_VEG';
        const isDelivery = row.preferredChannel === 'DELIVERY' || row.preferredChannel === 'TAKEAWAY';

        const computedSegments: string[] = [];
        if (isRegular) computedSegments.push('REGULAR');
        else if (isNew) computedSegments.push('NEW');

        if (isAtRisk) computedSegments.push('AT_RISK');
        if (isInactive) computedSegments.push('INACTIVE');
        if (isHighSpend) computedSegments.push('HIGH_SPEND');
        if (isVeg) computedSegments.push('VEG');
        if (isNonVeg) computedSegments.push('NON_VEG');
        if (isDelivery) computedSegments.push('DELIVERY');

        const cleanPhone = row.phone.replace(/\D/g, '');
        const displayPhone = cleanPhone.length === 10
          ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`
          : `+${cleanPhone}`;

        return {
          id: row.id,
          phone: cleanPhone,
          displayPhone,
          name: row.name || null,
          email: row.email || null,
          dob: row.dob || null,
          anniversary: row.anniversary || null,
          gender: row.gender || null,
          address: row.address || null,
          tags: Array.isArray(row.tags) ? row.tags : [],
          notes: row.notes || null,
          dietaryPreference: row.dietaryPreference || 'UNKNOWN',
          preferredChannel: row.preferredChannel || null,
          totalOrders,
          totalSpendPaise,
          avgOrderPaise,
          firstVisitAt: row.firstVisitAt ? new Date(row.firstVisitAt).toISOString() : null,
          lastVisitAt: row.lastVisitAt ? new Date(row.lastVisitAt).toISOString() : null,
          daysSinceLastVisit,
          isBlacklisted: Boolean(row.isBlacklisted),
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
          segments: computedSegments,
          isRegular,
          isNew,
          isAtRisk,
          isInactive,
          isHighSpend,
          isVeg,
          isNonVeg,
          isDelivery,
        };
      });

      // Overall Directory Metrics across ALL guests
      const totalGuests = allCustomers.length;
      let regularGuests = 0;
      let newGuests = 0;
      let atRiskGuests = 0;
      let inactiveGuests = 0;
      let highSpendGuests = 0;
      let vegGuests = 0;
      let nonVegGuests = 0;
      let deliveryGuests = 0;
      let totalLifetimeSpendPaise = 0;

      for (const cust of allCustomers) {
        if (cust.isRegular) regularGuests++;
        if (cust.isNew) newGuests++;
        if (cust.isAtRisk) atRiskGuests++;
        if (cust.isInactive) inactiveGuests++;
        if (cust.isHighSpend) highSpendGuests++;
        if (cust.isVeg) vegGuests++;
        if (cust.isNonVeg) nonVegGuests++;
        if (cust.isDelivery) deliveryGuests++;
        totalLifetimeSpendPaise += cust.totalSpendPaise;
      }

      const repeatRate = totalGuests > 0 ? Number(((regularGuests) / totalGuests * 100).toFixed(1)) : 0;
      const avgGuestSpendPaise = totalGuests > 0 ? Math.round(totalLifetimeSpendPaise / totalGuests) : 0;

      const segmentCounts = {
        ALL: totalGuests,
        REGULAR: regularGuests,
        NEW: newGuests,
        AT_RISK: atRiskGuests,
        INACTIVE: inactiveGuests,
        HIGH_SPEND: highSpendGuests,
        VEG: vegGuests,
        NON_VEG: nonVegGuests,
        DELIVERY: deliveryGuests,
      };

      const metrics = {
        totalGuests,
        regularGuests,
        newGuests,
        atRiskGuests,
        inactiveGuests,
        highSpendGuests,
        repeatRate,
        totalLifetimeSpendPaise,
        avgGuestSpendPaise,
      };

      // Apply Segment Filter
      let filtered = allCustomers;
      if (segment && segment !== 'ALL') {
        if (segment === 'REGULAR') filtered = filtered.filter((c) => c.isRegular);
        else if (segment === 'NEW') filtered = filtered.filter((c) => c.isNew);
        else if (segment === 'AT_RISK') filtered = filtered.filter((c) => c.isAtRisk);
        else if (segment === 'INACTIVE') filtered = filtered.filter((c) => c.isInactive);
        else if (segment === 'HIGH_SPEND') filtered = filtered.filter((c) => c.isHighSpend);
        else if (segment === 'VEG') filtered = filtered.filter((c) => c.isVeg);
        else if (segment === 'NON_VEG') filtered = filtered.filter((c) => c.isNonVeg);
        else if (segment === 'DELIVERY') filtered = filtered.filter((c) => c.isDelivery);
      }

      // Apply Search Filter
      if (search) {
        filtered = filtered.filter((c) => {
          const matchName = c.name ? c.name.toLowerCase().includes(search) : false;
          const matchPhone = c.phone.includes(search);
          const matchEmail = c.email ? c.email.toLowerCase().includes(search) : false;
          const matchNotes = c.notes ? c.notes.toLowerCase().includes(search) : false;
          const matchTags = c.tags.some((t: string) => t.toLowerCase().includes(search));
          return matchName || matchPhone || matchEmail || matchNotes || matchTags;
        });
      }

      // Sort
      filtered.sort((a, b) => {
        if (sortBy === 'spend_desc') return b.totalSpendPaise - a.totalSpendPaise;
        if (sortBy === 'visits_desc') return b.totalOrders - a.totalOrders;
        if (sortBy === 'name_asc') return (a.name || a.phone).localeCompare(b.name || b.phone);
        if (sortBy === 'oldest') return new Date(a.firstVisitAt || 0).getTime() - new Date(b.firstVisitAt || 0).getTime();
        return new Date(b.lastVisitAt || 0).getTime() - new Date(a.lastVisitAt || 0).getTime();
      });

      const paged = filtered.slice(offset, offset + limit);

      return c.json({
        customers: paged,
        totalCount: filtered.length,
        metrics,
        segmentCounts,
        limit,
        offset,
      });
    } finally {
      await close();
    }
  }
);

// ─── POST /customers (Register / Add Customer) ────────────────────────────────
app.post(
  '/',
  apiDoc({
    tags: ['Customers'],
    summary: 'Add or Register Customer in CRM',
    description: 'Manually creates or updates a customer profile with contact information, tags, and preferences.',
    body: CreateCustomerSchema,
    responses: {
      201: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parse = CreateCustomerSchema.safeParse(body);
    if (!parse.success) {
      return c.json({ error: 'Validation Error', message: parse.error.issues[0]?.message || 'Invalid customer payload' }, 400);
    }

    const {
      phone,
      name,
      email,
      dob,
      anniversary,
      gender,
      address,
      tags,
      notes,
      dietaryPreference,
      preferredChannel,
    } = parse.data;

    const rawDigits = phone.replace(/\D/g, '');
    const cleanPhone = rawDigits.slice(-10);
    if (cleanPhone.length < 8) {
      return c.json({ error: 'Validation Error', message: 'Valid phone number is required (min 8 digits)' }, 400);
    }

    const { db, close } = getDb(c);

    try {
      const customerId = generateId();
      const [inserted] = await db
        .insert(appSchema.restaurantCustomer)
        .values({
          id: customerId,
          restaurantId,
          phone: cleanPhone,
          name: name ? name.trim() : null,
          email: email ? email.trim().toLowerCase() : null,
          dob: dob || null,
          anniversary: anniversary || null,
          gender: gender || null,
          address: address ? address.trim() : null,
          tags: tags || [],
          notes: notes ? notes.trim() : null,
          dietaryPreference: dietaryPreference || 'UNKNOWN',
          preferredChannel: preferredChannel || null,
        })
        .onConflictDoUpdate({
          target: [appSchema.restaurantCustomer.restaurantId, appSchema.restaurantCustomer.phone],
          set: {
            name: name ? name.trim() : sql`"restaurantCustomer"."name"`,
            email: email ? email.trim().toLowerCase() : sql`"restaurantCustomer"."email"`,
            dob: dob || sql`"restaurantCustomer"."dob"`,
            anniversary: anniversary || sql`"restaurantCustomer"."anniversary"`,
            gender: gender || sql`"restaurantCustomer"."gender"`,
            address: address ? address.trim() : sql`"restaurantCustomer"."address"`,
            tags: tags || sql`"restaurantCustomer"."tags"`,
            notes: notes ? notes.trim() : sql`"restaurantCustomer"."notes"`,
            dietaryPreference: dietaryPreference || sql`"restaurantCustomer"."dietaryPreference"`,
            preferredChannel: preferredChannel || sql`"restaurantCustomer"."preferredChannel"`,
            updatedAt: new Date(),
          },
        })
        .returning();

      return c.json(inserted, 201);
    } finally {
      await close();
    }
  }
);

// ─── POST /customers/broadcast-whatsapp (Broadcast to Segment) ────────────────
app.post(
  '/broadcast-whatsapp',
  apiDoc({
    tags: ['Customers'],
    summary: 'Broadcast WhatsApp to Segment',
    description: 'Previews or dispatches WhatsApp campaign messages to a customer segment.',
    body: BroadcastWhatsAppSchema,
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parse = BroadcastWhatsAppSchema.safeParse(body);
    if (!parse.success) {
      return c.json({ error: 'Validation Error', message: parse.error.issues[0]?.message || 'Invalid broadcast payload' }, 400);
    }

    const { message, segment, phoneNumbers, testOnly } = parse.data;
    const { db, close } = getDb(c);

    try {
      const [restRow] = await db
        .select({ name: appSchema.restaurant.name })
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      const restaurantName = restRow?.name || 'Our Restaurant';

      // Gather target customer list
      let targets: { phone: string; name: string | null }[] = [];

      if (phoneNumbers && phoneNumbers.length > 0) {
        targets = phoneNumbers.map((p) => ({ phone: p.replace(/\D/g, '').slice(-10), name: null }));
      } else {
        const rows = await db
          .select()
          .from(appSchema.restaurantCustomer)
          .where(eq(appSchema.restaurantCustomer.restaurantId, restaurantId));

        const now = Date.now();
        targets = rows
          .filter((row: any) => {
            if (!segment || segment === 'ALL') return true;
            const lastVisitMs = row.lastVisitAt ? new Date(row.lastVisitAt).getTime() : 0;
            const daysSinceLastVisit = lastVisitMs > 0 ? Math.floor((now - lastVisitMs) / (1000 * 60 * 60 * 24)) : 999;
            const totalOrders = row.totalOrders || 0;
            const totalSpendPaise = row.totalSpendPaise || 0;
            const avgOrderPaise = row.avgOrderPaise || (totalOrders > 0 ? Math.round(totalSpendPaise / totalOrders) : 0);

            if (segment === 'REGULAR') return totalOrders >= 3;
            if (segment === 'NEW') return totalOrders === 1 && daysSinceLastVisit <= 30;
            if (segment === 'AT_RISK') return totalOrders >= 2 && daysSinceLastVisit >= 30 && daysSinceLastVisit <= 60;
            if (segment === 'INACTIVE') return daysSinceLastVisit > 60;
            if (segment === 'HIGH_SPEND') return avgOrderPaise >= 80000 || totalSpendPaise >= 500000;
            if (segment === 'VEG') return row.dietaryPreference === 'VEG';
            if (segment === 'NON_VEG') return row.dietaryPreference === 'NON_VEG';
            if (segment === 'DELIVERY') return row.preferredChannel === 'DELIVERY' || row.preferredChannel === 'TAKEAWAY';
            return true;
          })
          .map((row: any) => ({ phone: row.phone, name: row.name || null }));
      }

      // Sample rendered message
      const sampleCustomer = targets[0] || { name: 'Valued Guest', phone: '9876543210' };
      const sampleText = message
        .replace(/\{name\}/gi, sampleCustomer.name || 'Valued Guest')
        .replace(/\{restaurant_name\}/gi, restaurantName);

      if (testOnly) {
        return c.json({
          previewOnly: true,
          totalTargets: targets.length,
          sampleMessage: sampleText,
          restaurantName,
          targetPreview: targets.slice(0, 5),
        });
      }

      // Dispatched (limit to batch of 100 for safety)
      const dispatchBatch = targets.slice(0, 100);
      let sentCount = 0;
      const failures: string[] = [];

      for (const target of dispatchBatch) {
        const personalized = message
          .replace(/\{name\}/gi, target.name || 'Valued Guest')
          .replace(/\{restaurant_name\}/gi, restaurantName);

        const targetPhone = target.phone.length === 10 ? `91${target.phone}` : target.phone;

        try {
          await sendWhatsAppText(
            targetPhone,
            personalized,
            undefined,
            { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY }
          );
          sentCount++;
        } catch (err: any) {
          failures.push(`${target.phone}: ${err.message || String(err)}`);
        }
      }

      return c.json({
        success: true,
        sentCount,
        totalTargets: targets.length,
        failuresCount: failures.length,
        failures: failures.slice(0, 5),
      });
    } finally {
      await close();
    }
  }
);

// ─── PUT /customers/:id (Update Customer Details) ─────────────────────────────
app.put(
  '/:id',
  apiDoc({
    tags: ['Customers'],
    summary: 'Update Customer Profile',
    description: 'Updates customer profile, tags, notes, address, birthday, or dietary preferences.',
    params: z.object({ id: z.string() }),
    body: UpdateCustomerSchema,
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
    const { restaurantId } = tenant;
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parse = UpdateCustomerSchema.safeParse(body);
    if (!parse.success) {
      return c.json({ error: 'Validation Error', message: parse.error.issues[0]?.message || 'Invalid customer update payload' }, 400);
    }

    const { db, close } = getDb(c);

    try {
      const updateData: any = { updatedAt: new Date() };
      if (parse.data.name !== undefined) updateData.name = parse.data.name ? parse.data.name.trim() : null;
      if (parse.data.email !== undefined) updateData.email = parse.data.email ? parse.data.email.trim().toLowerCase() : null;
      if (parse.data.dob !== undefined) updateData.dob = parse.data.dob || null;
      if (parse.data.anniversary !== undefined) updateData.anniversary = parse.data.anniversary || null;
      if (parse.data.gender !== undefined) updateData.gender = parse.data.gender || null;
      if (parse.data.address !== undefined) updateData.address = parse.data.address ? parse.data.address.trim() : null;
      if (parse.data.tags !== undefined) updateData.tags = parse.data.tags;
      if (parse.data.notes !== undefined) updateData.notes = parse.data.notes ? parse.data.notes.trim() : null;
      if (parse.data.dietaryPreference !== undefined) updateData.dietaryPreference = parse.data.dietaryPreference;
      if (parse.data.preferredChannel !== undefined) updateData.preferredChannel = parse.data.preferredChannel;

      const [updated] = await db
        .update(appSchema.restaurantCustomer)
        .set(updateData)
        .where(
          and(
            eq(appSchema.restaurantCustomer.id, id),
            eq(appSchema.restaurantCustomer.restaurantId, restaurantId)
          )
        )
        .returning();

      if (!updated) {
        return c.json({ error: 'Not Found', message: 'Customer record not found' }, 404);
      }

      return c.json(updated);
    } finally {
      await close();
    }
  }
);

// ─── GET /customers/:phone ───────────────────────────────────────────────────
app.get(
  '/:phone',
  apiDoc({
    tags: ['Customers'],
    summary: 'Get Detailed Customer Profile',
    description: 'Retrieves comprehensive customer profile, order history, spend metrics, and preferences for a restaurant or specific outlet.',
    params: z.object({
      phone: z.string().meta({ description: 'Customer mobile number (10 digits or E.164)' }),
    }),
    query: z.object({
      outletId: z.string().optional().meta({ description: 'Filter metrics and orders by specific outlet' }),
    }),
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('order:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const rawParamPhone = c.req.param('phone');
    const filterOutletId = c.req.query('outletId');

    if (filterOutletId && !assertOutletAccess(tenant, filterOutletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${filterOutletId}'` }, 403);
    }

    if (!rawParamPhone || rawParamPhone.trim().length < 5) {
      return c.json({ error: 'Bad Request', message: 'Valid mobile number is required' }, 400);
    }

    const { rawDigits, variants } = getPhoneVariants(rawParamPhone);
    const { db, close } = getDb(c);

    try {
      // 1. Fetch restaurant details
      const [restaurantRow] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      // 2. Fetch outlets for name mapping
      const outlets = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));

      const outletMap = new Map<string, any>();
      outlets.forEach((o: any) => outletMap.set(o.id, o));

      // 3. Find registered user if any
      const [matchedUser] = await db
        .select()
        .from(appSchema.user)
        .where(
          or(
            inArray(appSchema.user.phoneNumber, variants),
            sql`${appSchema.user.phoneNumber} LIKE ${'%' + rawDigits}`
          )
        )
        .limit(1);

      // 4. Query all sale orders for this restaurant matching customer phone
      const orderConditions: any[] = [
        eq(appSchema.saleOrder.restaurantId, restaurantId),
        or(
          inArray(appSchema.saleOrder.customerPhone, variants),
          sql`${appSchema.saleOrder.customerPhone} LIKE ${'%' + rawDigits}`
        ),
      ];
      if (filterOutletId) {
        orderConditions.push(eq(appSchema.saleOrder.outletId, filterOutletId));
      } else if (!tenant.allOutlets && tenant.role !== 'OWNER' && tenant.role !== 'ADMIN') {
        orderConditions.push(inArray(appSchema.saleOrder.outletId, tenant.outletIds || ['__none__']));
      }

      const allOrders = await db
        .select()
        .from(appSchema.saleOrder)
        .where(and(...orderConditions))
        .orderBy(desc(appSchema.saleOrder.createdAt));

      // 5. Fetch all items for these orders
      const orderIds = allOrders.map((o: any) => o.id);
      const allItems = orderIds.length
        ? await db
            .select()
            .from(appSchema.saleOrderItem)
            .where(inArray(appSchema.saleOrderItem.orderId, orderIds))
            .orderBy(desc(appSchema.saleOrderItem.createdAt))
        : [];

      // Group items by orderId
      const itemsByOrderId = new Map<string, any[]>();
      allItems.forEach((item: any) => {
        const list = itemsByOrderId.get(item.orderId) || [];
        list.push(item);
        itemsByOrderId.set(item.orderId, list);
      });

      // 6. Fetch custom customer notes & tags from KV
      let savedNotes = '';
      let savedTags: string[] = [];
      if (kv(c)) {
        try {
          const cachedProfile = await kv(c).get(`cust:meta:${restaurantId}:${rawDigits}`, 'json');
          if (cachedProfile && typeof cachedProfile === 'object') {
            savedNotes = (cachedProfile as any).notes || '';
            savedTags = (cachedProfile as any).tags || [];
          }
        } catch {
          // ignore kv read errors
        }
      }

      // Filter orders if outletId is specified
      const scopedOrders = filterOutletId
        ? allOrders.filter((o: any) => o.outletId === filterOutletId)
        : allOrders;

      const scopedOrderIds = new Set(scopedOrders.map((o: any) => o.id));
      const scopedItems = allItems.filter((item: any) => scopedOrderIds.has(item.orderId));

      // Compute metrics
      const totalOrdersCount = scopedOrders.length;
      const completedOrders = scopedOrders.filter((o: any) => o.status === 'PAID');
      const cancelledOrders = scopedOrders.filter((o: any) => o.status === 'VOID' || o.orderStatus === 'CANCELLED');
      const openOrders = scopedOrders.filter((o: any) => o.status === 'OPEN' && o.orderStatus !== 'CANCELLED');

      const lifetimeSpendPaise = completedOrders.reduce((sum: number, o: any) => sum + (o.paidPaise || o.subtotalPaise || 0), 0);
      const averageOrderValuePaise = completedOrders.length ? Math.round(lifetimeSpendPaise / completedOrders.length) : 0;
      const highestOrderPaise = scopedOrders.reduce((max: number, o: any) => Math.max(max, o.subtotalPaise || 0), 0);

      // Visit dates
      const validDates = scopedOrders
        .map((o: any) => o.createdAt ? new Date(o.createdAt).getTime() : 0)
        .filter((t: number) => t > 0);

      const firstVisitAt = validDates.length ? new Date(Math.min(...validDates)).toISOString() : null;
      const lastVisitAt = validDates.length ? new Date(Math.max(...validDates)).toISOString() : null;

      const daysSinceLastVisit = lastVisitAt
        ? Math.max(0, Math.floor((Date.now() - new Date(lastVisitAt).getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      let visitFrequencyDays: number | null = null;
      if (validDates.length > 1 && firstVisitAt && lastVisitAt) {
        const totalSpanDays = (new Date(lastVisitAt).getTime() - new Date(firstVisitAt).getTime()) / (1000 * 60 * 60 * 24);
        visitFrequencyDays = Math.round((totalSpanDays / (validDates.length - 1)) * 10) / 10;
      }

      // Dining preference (Dine-In vs Takeaway vs Delivery)
      const deliveryOrders = scopedOrders.filter(
        (o: any) => o.orderType === 'DELIVERY' || (o.tableNo || '').toLowerCase() === 'delivery'
      );
      const takeawayOrders = scopedOrders.filter(
        (o: any) =>
          !deliveryOrders.includes(o) &&
          ((o.tableNo || '').toLowerCase() === 'takeaway' || o.orderType === 'TAKEAWAY')
      );
      const dineInOrders = scopedOrders.filter(
        (o: any) => !deliveryOrders.includes(o) && !takeawayOrders.includes(o) && o.tableNo
      );

      let preferredDineMode: 'Dine-In' | 'Takeaway' | 'Delivery' = 'Dine-In';
      if (deliveryOrders.length > dineInOrders.length && deliveryOrders.length >= takeawayOrders.length) {
        preferredDineMode = 'Delivery';
      } else if (takeawayOrders.length > dineInOrders.length) {
        preferredDineMode = 'Takeaway';
      }

      // Preferred table (only actual dine-in tables, never Delivery or Takeaway)
      const tableCounts: Record<string, number> = {};
      dineInOrders.forEach((o: any) => {
        const tbl = (o.tableNo || '').trim();
        if (tbl && tbl.toLowerCase() !== 'takeaway' && tbl.toLowerCase() !== 'delivery') {
          tableCounts[tbl] = (tableCounts[tbl] || 0) + 1;
        }
      });
      let preferredTable: string | null = null;
      let maxTableOrders = 0;
      Object.entries(tableCounts).forEach(([tbl, cnt]) => {
        if (cnt > maxTableOrders) {
          maxTableOrders = cnt;
          preferredTable = tbl;
        }
      });

      // Payment method breakdown
      const methodCounts: Record<string, { count: number; totalPaise: number }> = {};
      completedOrders.forEach((o: any) => {
        const m = o.method || 'Cash';
        const current = methodCounts[m] || { count: 0, totalPaise: 0 };
        current.count += 1;
        current.totalPaise += (o.paidPaise || o.subtotalPaise || 0);
        methodCounts[m] = current;
      });

      let preferredPaymentMethod: string | null = null;
      let maxPaymentCount = 0;
      Object.entries(methodCounts).forEach(([m, stat]) => {
        if (stat.count > maxPaymentCount) {
          maxPaymentCount = stat.count;
          preferredPaymentMethod = m;
        }
      });

      // Most visited day of week
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayCounts: Record<string, number> = {
        Sunday: 0,
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
      };
      scopedOrders.forEach((o: any) => {
        if (o.createdAt) {
          const d = new Date(o.createdAt);
          const dayName = dayNames[d.getDay()];
          if (dayName) {
            dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
          }
        }
      });

      let mostVisitedDay: string | null = null;
      let maxDayOrders = 0;
      Object.entries(dayCounts).forEach(([day, count]) => {
        if (count > maxDayOrders) {
          maxDayOrders = count;
          mostVisitedDay = day;
        }
      });

      const visitedDaysBreakdown = dayNames.map((day) => ({
        day,
        short: day.slice(0, 3),
        count: dayCounts[day],
        percentage: scopedOrders.length > 0 ? Math.round((dayCounts[day] / scopedOrders.length) * 100) : 0,
      }));

      // Dietary preference (Veg vs Non-Veg items ordered)
      let vegItemsCount = 0;
      let nonVegItemsCount = 0;
      const itemAggregate: Record<string, { itemId: string; name: string; isNonVeg: boolean; qty: number; totalSpendPaise: number; orderCount: number; lastOrderedAt: string }> = {};

      scopedItems.forEach((item: any) => {
        if (item.status === 'CANCELLED') return;
        const isNonVeg = checkIsNonVeg(item.nameSnapshot);
        if (isNonVeg) {
          nonVegItemsCount += item.qty;
        } else {
          vegItemsCount += item.qty;
        }

        const key = item.nameSnapshot.trim();
        const existing = itemAggregate[key] || {
          itemId: item.itemId,
          name: key,
          isNonVeg,
          qty: 0,
          totalSpendPaise: 0,
          orderCount: 0,
          lastOrderedAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        };

        existing.qty += item.qty;
        existing.totalSpendPaise += (item.pricePaiseSnapshot * item.qty);
        existing.orderCount += 1;
        if (item.createdAt && new Date(item.createdAt).getTime() > new Date(existing.lastOrderedAt).getTime()) {
          existing.lastOrderedAt = new Date(item.createdAt).toISOString();
        }
        itemAggregate[key] = existing;
      });

      const totalDishesCount = vegItemsCount + nonVegItemsCount;
      let primaryDietaryPreference: 'Veg' | 'Non-Veg' | 'Mixed' = 'Mixed';
      if (totalDishesCount > 0) {
        const vegRatio = vegItemsCount / totalDishesCount;
        if (vegRatio >= 0.85) primaryDietaryPreference = 'Veg';
        else if (vegRatio <= 0.2) primaryDietaryPreference = 'Non-Veg';
      }

      // Favorite items sorted by quantity
      const favoriteItems = Object.values(itemAggregate)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

      // Outlet Breakdown (across all orders of this customer in the restaurant)
      const outletBreakdownMap: Record<string, { outletId: string; outletName: string; ordersCount: number; totalSpendPaise: number; lastVisit: string | null }> = {};
      allOrders.forEach((o: any) => {
        const oId = o.outletId;
        const oName = outletMap.get(oId)?.name || 'Main Outlet';
        const current = outletBreakdownMap[oId] || {
          outletId: oId,
          outletName: oName,
          ordersCount: 0,
          totalSpendPaise: 0,
          lastVisit: null,
        };
        current.ordersCount += 1;
        if (o.status === 'PAID') {
          current.totalSpendPaise += (o.paidPaise || o.subtotalPaise || 0);
        }
        const ordTime = o.createdAt ? new Date(o.createdAt).toISOString() : null;
        if (ordTime && (!current.lastVisit || new Date(ordTime).getTime() > new Date(current.lastVisit).getTime())) {
          current.lastVisit = ordTime;
        }
        outletBreakdownMap[oId] = current;
      });

      // Compute dynamic tags
      const computedTags = new Set<string>(savedTags);
      if (totalOrdersCount >= 3) {
        computedTags.add('Regular Customer');
      } else if (totalOrdersCount === 1) {
        computedTags.add('New Customer');
      }

      if (primaryDietaryPreference === 'Veg') {
        computedTags.add('Pure Vegetarian');
      } else if (primaryDietaryPreference === 'Non-Veg') {
        computedTags.add('Non-Veg Lover');
      }

      if (takeawayOrders.length > 0 && takeawayOrders.length >= scopedOrders.length * 0.7) {
        computedTags.add('Takeaway Preferer');
      } else if (dineInOrders.length > 0 && dineInOrders.length >= scopedOrders.length * 0.7) {
        computedTags.add('Dine-In Lover');
      }

      // Format customer phone for clean display
      let displayPhone = rawParamPhone;
      if (rawDigits.length === 10) {
        displayPhone = `+91 ${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}`;
      }

      // Formatted list of orders with items
      const formattedOrders = scopedOrders.map((o: any) => {
        const ordItems = itemsByOrderId.get(o.id) || [];
        return {
          id: o.id,
          orderNo: o.orderNo,
          outletId: o.outletId,
          outletName: outletMap.get(o.outletId)?.name || 'Main Outlet',
          tableNo: o.tableNo || 'Takeaway',
          orderType: o.orderType || ((o.tableNo || '').toLowerCase() === 'delivery' ? 'DELIVERY' : (o.tableNo || '').toLowerCase() === 'takeaway' ? 'TAKEAWAY' : 'DINE_IN'),
          customerPhone: o.customerPhone,
          status: o.status,
          orderStatus: o.orderStatus,
          subtotalPaise: o.subtotalPaise,
          paidPaise: o.paidPaise,
          method: o.method,
          note: o.note,
          createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
          settledAt: o.settledAt ? new Date(o.settledAt).toISOString() : null,
          itemsCount: ordItems.reduce((sum: number, it: any) => sum + it.qty, 0),
          items: ordItems.map((it: any) => ({
            id: it.id,
            itemId: it.itemId,
            name: it.nameSnapshot,
            pricePaise: it.pricePaiseSnapshot,
            qty: it.qty,
            variant: it.variant,
            addons: it.addons,
            status: it.status,
            paymentStatus: it.paymentStatus,
            round: it.round,
            note: it.note,
          })),
        };
      });

      return c.json({
        customer: {
          phone: displayPhone,
          rawPhone: rawDigits,
          name: matchedUser?.name || null,
          email: matchedUser?.email || null,
          image: matchedUser?.image || null,
          tags: Array.from(computedTags),
          notes: savedNotes,
        },
        scope: {
          filterOutletId: filterOutletId || null,
          activeOutletName: filterOutletId ? outletMap.get(filterOutletId)?.name || null : 'All Outlets',
          restaurantName: restaurantRow?.name || 'Restaurant',
        },
        metrics: {
          totalOrdersCount,
          completedOrdersCount: completedOrders.length,
          cancelledOrdersCount: cancelledOrders.length,
          openOrdersCount: openOrders.length,
          lifetimeSpendPaise,
          averageOrderValuePaise,
          highestOrderPaise,
          firstVisitAt,
          lastVisitAt,
          daysSinceLastVisit,
          visitFrequencyDays,
          dineInCount: dineInOrders.length,
          takeawayCount: takeawayOrders.length,
          deliveryCount: deliveryOrders.length,
          preferredDineMode,
          preferredTable,
          preferredPaymentMethod,
          paymentMethodsBreakdown: Object.entries(methodCounts).map(([method, data]) => ({
            method,
            count: data.count,
            totalPaise: data.totalPaise,
          })),
          mostVisitedDay,
          mostVisitedDayCount: maxDayOrders,
          visitedDaysBreakdown,
          dietaryPreference: {
            vegCount: vegItemsCount,
            nonVegCount: nonVegItemsCount,
            totalDishes: totalDishesCount,
            primary: primaryDietaryPreference,
          },
        },
        overallChainMetrics: {
          totalChainOrders: allOrders.length,
          totalChainSpendPaise: allOrders
            .filter((o: any) => o.status === 'PAID')
            .reduce((sum: number, o: any) => sum + (o.paidPaise || o.subtotalPaise || 0), 0),
          outletBreakdown: Object.values(outletBreakdownMap),
        },
        favoriteItems,
        orders: formattedOrders,
      });
    } finally {
      await close();
    }
  }
);

// ─── PUT /customers/:phone/notes ─────────────────────────────────────────────
app.put(
  '/:phone/notes',
  apiDoc({
    tags: ['Customers'],
    summary: 'Update Customer Notes & Tags',
    description: 'Saves staff notes and custom tags for this customer.',
    params: z.object({
      phone: z.string(),
    }),
    body: z.object({
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const phone = c.req.param('phone');
    const { rawDigits } = getPhoneVariants(phone);

    const body = await c.req.json().catch(() => ({}));
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const tags = Array.isArray(body.tags) ? body.tags.filter((t: any) => typeof t === 'string' && t.trim()) : [];

    if (kv(c)) {
      await kv(c).put(
        `cust:meta:${restaurantId}:${rawDigits}`,
        JSON.stringify({ notes, tags, updatedAt: new Date().toISOString() })
      );
    }

    return c.json({ success: true, notes, tags });
  }
);

// ─── POST /customers/:phone/whatsapp ─────────────────────────────────────────
app.post(
  '/:phone/whatsapp',
  apiDoc({
    tags: ['Customers'],
    summary: 'Send WhatsApp to Customer',
    description: 'Sends a direct WhatsApp message to the customer via OpenWA.',
    params: z.object({
      phone: z.string(),
    }),
    body: z.object({
      message: z.string().min(1),
    }),
    responses: {
      200: z.object({ success: z.boolean(), waResponse: z.any() }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('order:create'),
  async (c) => {
    const phone = c.req.param('phone');
    const { rawDigits } = getPhoneVariants(phone);
    const body = await c.req.json().catch(() => ({}));
    const message = body.message;

    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Validation Error', message: 'message is required' }, 400);
    }

    const targetPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;

    try {
      const waRes = await sendWhatsAppText(
        targetPhone,
        message,
        undefined,
        { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY }
      );
      return c.json({ success: true, waResponse: waRes });
    } catch (err: any) {
      return c.json({ error: 'WhatsApp Delivery Failed', message: err.message || String(err) }, 500);
    }
  }
);

export const customerRoutes = app;
