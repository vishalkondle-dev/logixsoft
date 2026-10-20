import { Hono } from 'hono';
import { eq, and, or, desc, inArray, sql, asc, gte, lt } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { sendWhatsAppText } from '@logixsoft/wa';
import { appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import { toWaitlistEntry } from '@logixsoft/logix-dine/mappers/pos';
import {
  OutletWaitlistSchema,
  JoinWaitlistSchema,
  CallWaitlistSchema,
  SeatWaitlistSchema,
  CancelWaitlistSchema,
} from '@logixsoft/logix-dine/schemas/pos';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';
import { getDb } from '../lib/order-helpers';
import { broadcastToOutlet } from '../lib/sync';
import * as z from 'zod';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

// ─── GET /waitlist ────────────────────────────────────────────────────────────
app.get(
  '/',
  apiDoc({
    tags: ['Waitlist'],
    summary: 'List Waitlist Entries',
    description: 'Returns active and historical queue entries for the outlet with live queue stats.',
    query: z.object({
      outletId: z.string().optional(),
      status: z.string().optional(), // 'ACTIVE' (WAITING + CALLED) or specific status
    }),
    responses: {
      200: z.object({
        entries: z.array(OutletWaitlistSchema),
        stats: z.object({
          waitingCount: z.number(),
          calledCount: z.number(),
          seatedTodayCount: z.number(),
          totalTodayCount: z.number(),
          avgWaitMinutes: z.number(),
        }),
      }),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission(['reservations:view', 'table:read']),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || tenant.outletId;
    const statusParam = c.req.query('status');

    if (outletId && !assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const conditions = [eq(appSchema.outletWaitlist.restaurantId, restaurantId)];

      if (outletId) {
        conditions.push(eq(appSchema.outletWaitlist.outletId, outletId));
      } else if (!tenant.allOutlets && tenant.role !== 'OWNER' && tenant.role !== 'ADMIN') {
        conditions.push(inArray(appSchema.outletWaitlist.outletId, tenant.outletIds || ['__none__']));
      }

      if (statusParam === 'ACTIVE' || !statusParam) {
        conditions.push(inArray(appSchema.outletWaitlist.status, ['WAITING', 'CALLED']));
      } else if (statusParam === 'ALL') {
        conditions.push(gte(appSchema.outletWaitlist.createdAt, todayStart));
      } else {
        conditions.push(eq(appSchema.outletWaitlist.status, statusParam));
      }

      const rows = await db
        .select()
        .from(appSchema.outletWaitlist)
        .where(and(...conditions))
        .orderBy(asc(appSchema.outletWaitlist.createdAt));

      // Calculate queue stats for this outlet
      const targetOutletId = outletId || (tenant.outletIds && tenant.outletIds[0]);
      let waitingCount = 0;
      let calledCount = 0;
      let seatedTodayCount = 0;
      let totalTodayCount = 0;
      let totalWaitMins = 0;
      let seatedCountForAvg = 0;

      if (targetOutletId) {
        const allToday = await db
          .select({
            status: appSchema.outletWaitlist.status,
            createdAt: appSchema.outletWaitlist.createdAt,
            seatedAt: appSchema.outletWaitlist.seatedAt,
          })
          .from(appSchema.outletWaitlist)
          .where(
            and(
              eq(appSchema.outletWaitlist.restaurantId, restaurantId),
              eq(appSchema.outletWaitlist.outletId, targetOutletId),
              gte(appSchema.outletWaitlist.createdAt, todayStart),
            ),
          );

        totalTodayCount = allToday.length;

        for (const r of allToday) {
          if (r.status === 'WAITING') waitingCount++;
          else if (r.status === 'CALLED') calledCount++;
          else if (r.status === 'SEATED') {
            seatedTodayCount++;
            if (r.seatedAt && r.createdAt) {
              const diffMins = Math.round((new Date(r.seatedAt).getTime() - new Date(r.createdAt).getTime()) / 60000);
              if (diffMins > 0 && diffMins < 300) {
                totalWaitMins += diffMins;
                seatedCountForAvg++;
              }
            }
          }
        }
      }

      const avgWaitMinutes = seatedCountForAvg > 0 ? Math.round(totalWaitMins / seatedCountForAvg) : 15;

      return c.json({
        entries: rows.map(toWaitlistEntry),
        stats: {
          waitingCount,
          calledCount,
          seatedTodayCount,
          totalTodayCount,
          avgWaitMinutes,
        },
      });
    } finally {
      await close();
    }
  },
);

// ─── POST /waitlist/join ──────────────────────────────────────────────────────
app.post(
  '/join',
  apiDoc({
    tags: ['Waitlist'],
    summary: 'Join Waitlist (Staff or Guest Self-Service)',
    description: 'Registers a new guest party into the outlet queue, assigns daily sequential token, and dispatches WhatsApp notification.',
    body: JoinWaitlistSchema,
    responses: {
      201: z.object({
        entry: OutletWaitlistSchema,
        queuePosition: z.number(),
        partiesAhead: z.number(),
        trackerUrl: z.string(),
      }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = JoinWaitlistSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', message: parsed.error.issues[0]?.message || 'Invalid input' }, 400);
    }

    const { outletId, guestName, guestPhone, partySize, seatingPreference, notes, preOrderItems } = parsed.data;

    const { db, close } = getDb(c);
    try {
      // Find outlet & restaurant details
      const [outlet] = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, outletId));

      if (!outlet) {
        return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);
      }

      const [rest] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, outlet.restaurantId));

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      // Count active parties currently waiting ahead
      const [waitingAheadResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(appSchema.outletWaitlist)
        .where(
          and(
            eq(appSchema.outletWaitlist.outletId, outletId),
            inArray(appSchema.outletWaitlist.status, ['WAITING', 'CALLED']),
          ),
        );

      const partiesAhead = Number(waitingAheadResult?.count || 0);
      const queuePosition = partiesAhead + 1;

      // Smart wait time calculation (10 min base + 8 min per party ahead)
      const estimatedWaitMinutes = Math.max(10, Math.round(partiesAhead * 10 + 5));

      const newId = generateId('waitlist');
      const cleanPhone = guestPhone.replace(/\D/g, '');
      const actorPhone = c.get('actorPhone') || 'Customer';

      let tokenNumber = 'Q-01';
      let newEntry: any = null;

      // Concurrency lock: serialize daily token sequence using row-level lock on outlet
      await db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT id FROM "restaurantOutlet" WHERE id = ${outletId} FOR UPDATE`);

        const [todayCountResult] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(appSchema.outletWaitlist)
          .where(
            and(
              eq(appSchema.outletWaitlist.outletId, outletId),
              gte(appSchema.outletWaitlist.createdAt, todayStart),
            ),
          );

        const seqNumber = Number(todayCountResult?.count || 0) + 1;
        tokenNumber = `Q-${String(seqNumber).padStart(2, '0')}`;

        const [created] = await tx
          .insert(appSchema.outletWaitlist)
          .values({
            id: newId,
            restaurantId: outlet.restaurantId,
            outletId,
            tokenNumber,
            guestName: guestName.trim(),
            guestPhone: cleanPhone,
            partySize: partySize || 2,
            seatingPreference: seatingPreference || 'ANY',
            status: 'WAITING',
            estimatedWaitMinutes,
            preOrderItems: preOrderItems || [],
            notes: notes ? notes.trim() : null,
            createdAt: now,
            updatedAt: now,
            createdBy: actorPhone,
            updatedBy: actorPhone,
          })
          .returning();

        newEntry = created;
      });

      // Tracker link
      const frontendUrl = c.env?.FRONTEND_URL || 'https://dine.logixsoft.in';
      const trackerUrl = `${frontendUrl}/q/${outletId}/${newId}`;

      // Broadcast real-time waitlist update via Durable Object
      await broadcastToOutlet(c.env, outletId, {
        topic: 'CUSTOMER',
        type: 'WAITLIST_UPDATED',
        data: {
          action: 'JOIN',
          waitlistId: newId,
          tokenNumber,
          guestName,
          partySize,
        },
      }).catch(() => {});

      // WhatsApp Automated Confirmation
      const waPromise = (async () => {
        try {
          const restaurantName = rest?.name || 'Logix Dine';
          const msg =
            `🎫 *Waitlist Token: ${tokenNumber}* at *${restaurantName}*\n\n` +
            `Hello *${guestName.trim()}*, you have joined our live table queue!\n\n` +
            `👥 Party Size: *${partySize} Guests*\n` +
            `🪑 Seating: *${seatingPreference}*\n` +
            `⏳ Estimated Wait: *~${estimatedWaitMinutes} mins* (${partiesAhead} parties ahead)\n\n` +
            `👉 *Track Live Queue & Pre-Order Menu:*\n${trackerUrl}\n\n` +
            `_We will notify you immediately on WhatsApp when your table is ready._`;

          await sendWhatsAppText(cleanPhone, msg, undefined, {
            url: c.env?.WA_API_URL,
            apiKey: c.env?.WA_API_KEY,
          });
        } catch (err) {
          console.warn('[Waitlist Join] WhatsApp ping error:', err);
        }
      })();

      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(waPromise);
      } else {
        waPromise.catch(() => {});
      }

      return c.json(
        {
          entry: toWaitlistEntry(newEntry),
          queuePosition,
          partiesAhead,
          trackerUrl,
        },
        201,
      );
    } finally {
      await close();
    }
  },
);

// ─── POST /waitlist/call ──────────────────────────────────────────────────────
app.post(
  '/call',
  apiDoc({
    tags: ['Waitlist'],
    summary: 'Call / Notify Waiting Guest',
    description: 'Updates queue status to CALLED, sets calledAt timestamp, and dispatches "Table Ready" WhatsApp alert.',
    body: CallWaitlistSchema,
    responses: {
      200: OutletWaitlistSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission(['reservations:manage', 'table:write']),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parsed = CallWaitlistSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', message: parsed.error.issues[0]?.message || 'Invalid input' }, 400);
    }

    const { waitlistId, notifyWhatsApp } = parsed.data;

    const { db, close } = getDb(c);
    try {
      const [entry] = await db
        .select()
        .from(appSchema.outletWaitlist)
        .where(
          and(
            eq(appSchema.outletWaitlist.id, waitlistId),
            eq(appSchema.outletWaitlist.restaurantId, restaurantId),
          ),
        );

      if (!entry) {
        return c.json({ error: 'Not Found', message: 'Waitlist entry not found' }, 404);
      }

      if (!assertOutletAccess(tenant, entry.outletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }

      const now = new Date();
      const actorPhone = c.get('actorPhone') || 'Host';

      const [updated] = await db
        .update(appSchema.outletWaitlist)
        .set({
          status: 'CALLED',
          calledAt: now,
          updatedAt: now,
          updatedBy: actorPhone,
        })
        .where(eq(appSchema.outletWaitlist.id, waitlistId))
        .returning();

      // Real-time broadcast
      await broadcastToOutlet(c.env, entry.outletId, {
        topic: 'CUSTOMER',
        type: 'WAITLIST_UPDATED',
        data: {
          action: 'CALLED',
          waitlistId,
          tokenNumber: entry.tokenNumber,
        },
      }).catch(() => {});

      // WhatsApp Table Ready ping
      if (notifyWhatsApp !== false) {
        const waPromise = (async () => {
          try {
            const [rest] = await db
              .select()
              .from(appSchema.restaurant)
              .where(eq(appSchema.restaurant.id, restaurantId));

            const restaurantName = rest?.name || 'Logix Dine';
            const msg =
              `🔔 *Your Table is Ready!* - *${restaurantName}*\n\n` +
              `Hello *${entry.guestName}*, your table is now prepared! 🍽️\n\n` +
              `🎫 Token: *#${entry.tokenNumber}* (Party of ${entry.partySize})\n\n` +
              `📍 Please proceed to the entrance / host desk within *5 minutes* to be seated.\n\n` +
              `_We are excited to host you!_`;

            await sendWhatsAppText(entry.guestPhone, msg, undefined, {
              url: c.env?.WA_API_URL,
              apiKey: c.env?.WA_API_KEY,
            });
          } catch (err) {
            console.warn('[Waitlist Call] WhatsApp ping error:', err);
          }
        })();

        if (c.executionCtx?.waitUntil) {
          c.executionCtx.waitUntil(waPromise);
        } else {
          waPromise.catch(() => {});
        }
      }

      return c.json(toWaitlistEntry(updated));
    } finally {
      await close();
    }
  },
);

// ─── POST /waitlist/seat ──────────────────────────────────────────────────────
app.post(
  '/seat',
  apiDoc({
    tags: ['Waitlist'],
    summary: 'Seat Waiting Guest at Table',
    description: 'Marks queue status as SEATED, assigns dining table, and marks table OCCUPIED.',
    body: SeatWaitlistSchema,
    responses: {
      200: z.object({
        entry: OutletWaitlistSchema,
        tableId: z.string(),
      }),
      404: ErrorResponseSchema,
    },
  }),
  requirePermission(['reservations:manage', 'table:write']),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parsed = SeatWaitlistSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', message: parsed.error.issues[0]?.message || 'Invalid input' }, 400);
    }

    const { waitlistId, tableId, tableName } = parsed.data;

    const { db, close } = getDb(c);
    try {
      const [entry] = await db
        .select()
        .from(appSchema.outletWaitlist)
        .where(
          and(
            eq(appSchema.outletWaitlist.id, waitlistId),
            eq(appSchema.outletWaitlist.restaurantId, restaurantId),
          ),
        );

      if (!entry) {
        return c.json({ error: 'Not Found', message: 'Waitlist entry not found' }, 404);
      }

      if (!assertOutletAccess(tenant, entry.outletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }

      const now = new Date();
      const actorPhone = c.get('actorPhone') || 'Host';

      let resolvedTableName = tableName;
      if (!resolvedTableName) {
        const [targetTable] = await db
          .select({ name: appSchema.posTable.name })
          .from(appSchema.posTable)
          .where(eq(appSchema.posTable.id, tableId));
        resolvedTableName = targetTable?.name || 'Assigned Table';
      }

      // Verify table does not have an active confirmed reservation
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const [conflictingRes] = await db
        .select({
          id: appSchema.tableReservation.id,
          guestName: appSchema.tableReservation.guestName,
          startTime: appSchema.tableReservation.startTime,
        })
        .from(appSchema.tableReservation)
        .where(
          and(
            eq(appSchema.tableReservation.tableId, tableId),
            eq(appSchema.tableReservation.status, 'CONFIRMED'),
            gte(appSchema.tableReservation.createdAt, todayStart)
          )
        )
        .limit(1);

      if (conflictingRes) {
        return c.json(
          {
            error: 'Conflict',
            message: `Table "${resolvedTableName}" is reserved for ${conflictingRes.guestName} (${conflictingRes.startTime || 'Scheduled'}). Please select a free table.`,
          },
          409
        );
      }

      // 1. Mark waitlist entry SEATED
      await db
        .update(appSchema.outletWaitlist)
        .set({
          status: 'SEATED',
          seatedAt: now,
          assignedTableId: tableId,
          assignedTableName: resolvedTableName,
          updatedAt: now,
          updatedBy: actorPhone,
        })
        .where(eq(appSchema.outletWaitlist.id, waitlistId));

      const [updatedEntry] = await db
        .select()
        .from(appSchema.outletWaitlist)
        .where(eq(appSchema.outletWaitlist.id, waitlistId));

      // Broadcast real-time updates
      await Promise.all([
        broadcastToOutlet(c.env, entry.outletId, {
          topic: 'CUSTOMER',
          type: 'WAITLIST_UPDATED',
          data: {
            action: 'SEATED',
            waitlistId,
            tableId,
            tableName: resolvedTableName,
          },
        }),
        broadcastToOutlet(c.env, entry.outletId, {
          topic: 'TABLES',
          type: 'TABLES_UPDATED',
          data: {
            tableId,
            tableName: resolvedTableName,
            status: 'OCCUPIED',
          },
        }),
      ]).catch(() => {});

      return c.json({
        entry: toWaitlistEntry(updatedEntry),
        tableId,
      });
    } finally {
      await close();
    }
  },
);

// ─── POST /waitlist/cancel ────────────────────────────────────────────────────
app.post(
  '/cancel',
  apiDoc({
    tags: ['Waitlist'],
    summary: 'Cancel or Mark No-Show',
    description: 'Removes party from active queue with cancellation or no-show reason.',
    body: CancelWaitlistSchema,
    responses: {
      200: OutletWaitlistSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission(['reservations:manage', 'table:write']),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parsed = CancelWaitlistSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', message: parsed.error.issues[0]?.message || 'Invalid input' }, 400);
    }

    const { waitlistId, reason, status } = parsed.data;

    const { db, close } = getDb(c);
    try {
      const [entry] = await db
        .select()
        .from(appSchema.outletWaitlist)
        .where(
          and(
            eq(appSchema.outletWaitlist.id, waitlistId),
            eq(appSchema.outletWaitlist.restaurantId, restaurantId),
          ),
        );

      if (!entry) {
        return c.json({ error: 'Not Found', message: 'Waitlist entry not found' }, 404);
      }

      if (!assertOutletAccess(tenant, entry.outletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }

      const now = new Date();
      const actorPhone = c.get('actorPhone') || 'Host';

      const [updated] = await db
        .update(appSchema.outletWaitlist)
        .set({
          status: status || 'CANCELLED',
          notes: reason ? `${entry.notes ? entry.notes + ' | ' : ''}${reason}` : entry.notes,
          updatedAt: now,
          updatedBy: actorPhone,
        })
        .where(eq(appSchema.outletWaitlist.id, waitlistId))
        .returning();

      await Promise.all([
        broadcastToOutlet(c.env, entry.outletId, {
          topic: 'CUSTOMER',
          type: 'WAITLIST_UPDATED',
          data: {
            action: status || 'CANCELLED',
            waitlistId,
          },
        }),
        entry.assignedTableId
          ? broadcastToOutlet(c.env, entry.outletId, {
              topic: 'TABLES',
              type: 'TABLES_UPDATED',
              data: {
                tableId: entry.assignedTableId,
                status: 'FREE',
              },
            })
          : Promise.resolve(),
      ]).catch(() => {});

      return c.json(toWaitlistEntry(updated));
    } finally {
      await close();
    }
  },
);

// ─── GET /waitlist/public/info/:outletId ──────────────────────────────────────
app.get(
  '/public/info/:outletId',
  apiDoc({
    tags: ['Waitlist'],
    summary: 'Public Outlet Waitlist Info',
    description: 'Returns restaurant and outlet details with current waiting count and wait estimate for joining queue.',
    params: z.object({
      outletId: z.string(),
    }),
    responses: {
      200: z.any(),
      404: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const { outletId } = c.req.param();

    const { db, close } = getDb(c);
    try {
      const [outlet] = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, outletId));

      if (!outlet) {
        return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);
      }

      const [rest] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, outlet.restaurantId));

      const [waitingResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(appSchema.outletWaitlist)
        .where(
          and(
            eq(appSchema.outletWaitlist.outletId, outletId),
            inArray(appSchema.outletWaitlist.status, ['WAITING', 'CALLED']),
          ),
        );

      const waitingCount = Number(waitingResult?.count || 0);
      const estimatedWaitMinutes = Math.max(10, Math.round(waitingCount * 10 + 5));

      return c.json({
        outletId,
        restaurantName: rest?.name || 'Restaurant',
        outletName: outlet?.name || 'Main Outlet',
        address: rest?.address || outlet?.address || '',
        phone: rest?.phone || outlet?.phone || '',
        waitingCount,
        estimatedWaitMinutes,
      });
    } finally {
      await close();
    }
  },
);

// ─── GET /waitlist/public/:outletId/:waitlistId ───────────────────────────────
app.get(
  '/public/:outletId/:waitlistId',
  apiDoc({
    tags: ['Waitlist'],
    summary: 'Public Guest Queue Status & Pre-Order Menu',
    description: 'Lightweight unauthenticated endpoint for guest mobile queue tracking and menu pre-ordering.',
    params: z.object({
      outletId: z.string(),
      waitlistId: z.string(),
    }),
    responses: {
      200: z.any(),
      404: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const { outletId, waitlistId } = c.req.param();

    const { db, close } = getDb(c);
    try {
      const [entry] = await db
        .select()
        .from(appSchema.outletWaitlist)
        .where(
          and(
            eq(appSchema.outletWaitlist.outletId, outletId),
            or(
              eq(appSchema.outletWaitlist.id, waitlistId),
              eq(appSchema.outletWaitlist.tokenNumber, waitlistId),
              sql`LOWER(${appSchema.outletWaitlist.tokenNumber}) = LOWER(${waitlistId})`,
            ),
          ),
        );

      if (!entry) {
        return c.json({ error: 'Not Found', message: 'Queue ticket not found' }, 404);
      }

      const [outlet] = await db
        .select()
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, outletId));

      const [rest] = await db
        .select()
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, entry.restaurantId));

      // Calculate how many parties are ahead
      let partiesAhead = 0;
      if (entry.status === 'WAITING') {
        const [aheadResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(appSchema.outletWaitlist)
          .where(
            and(
              eq(appSchema.outletWaitlist.outletId, outletId),
              eq(appSchema.outletWaitlist.status, 'WAITING'),
              lt(appSchema.outletWaitlist.createdAt, entry.createdAt instanceof Date ? entry.createdAt : new Date(entry.createdAt)),
            ),
          );
        partiesAhead = Number(aheadResult?.count || 0);
      }

      // Fetch menu categories & items for pre-ordering
      const categories = await db
        .select()
        .from(appSchema.menuCategory)
        .where(eq(appSchema.menuCategory.restaurantId, entry.restaurantId))
        .orderBy(asc(appSchema.menuCategory.sortOrder));

      const items = await db
        .select()
        .from(appSchema.menuItem)
        .where(
          and(
            eq(appSchema.menuItem.restaurantId, entry.restaurantId),
            eq(appSchema.menuItem.available, true),
          ),
        );

      return c.json({
        entry: toWaitlistEntry(entry),
        queuePosition: partiesAhead + 1,
        partiesAhead,
        restaurant: {
          name: rest?.name || 'Restaurant',
          phone: rest?.phone || '',
          address: rest?.address || '',
        },
        outlet: {
          name: outlet?.name || 'Main Outlet',
        },
        categories,
        items,
      });
    } finally {
      await close();
    }
  },
);

// ─── POST /waitlist/public/pre-order ──────────────────────────────────────────
app.post(
  '/public/pre-order',
  apiDoc({
    tags: ['Waitlist'],
    summary: 'Submit Guest Pre-Order from Live Queue',
    description: 'Allows waiting guests to pre-select dishes so kitchen/servers have it ready upon seating.',
    body: z.object({
      outletId: z.string(),
      waitlistId: z.string(),
      items: z.array(
        z.object({
          itemId: z.string(),
          name: z.string(),
          qty: z.number().int().min(1),
          pricePaise: z.number().int(),
          notes: z.string().optional(),
        }),
      ),
    }),
    responses: {
      200: SuccessResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const outletId = body.outletId;
    const waitlistId = body.waitlistId;
    const items = body.items || body.preOrderItems;

    if (!waitlistId || !outletId || !Array.isArray(items)) {
      return c.json({ error: 'Validation Error', message: 'Missing waitlistId or items' }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const [entry] = await db
        .select()
        .from(appSchema.outletWaitlist)
        .where(
          and(
            eq(appSchema.outletWaitlist.outletId, outletId),
            or(
              eq(appSchema.outletWaitlist.id, waitlistId),
              eq(appSchema.outletWaitlist.tokenNumber, waitlistId),
              sql`LOWER(${appSchema.outletWaitlist.tokenNumber}) = LOWER(${waitlistId})`,
            ),
          ),
        );

      if (!entry) {
        return c.json({ error: 'Not Found', message: 'Queue ticket not found' }, 404);
      }

      await db
        .update(appSchema.outletWaitlist)
        .set({
          preOrderItems: items,
          updatedAt: new Date(),
        })
        .where(eq(appSchema.outletWaitlist.id, waitlistId));

      await broadcastToOutlet(c.env, outletId, {
        topic: 'CUSTOMER',
        type: 'WAITLIST_UPDATED',
        data: {
          action: 'PREORDER',
          waitlistId,
          itemsCount: items.length,
        },
      }).catch(() => {});

      return c.json({ success: true, message: 'Pre-order saved successfully!' });
    } finally {
      await close();
    }
  },
);

export default app;
