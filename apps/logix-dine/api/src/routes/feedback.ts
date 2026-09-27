import { Hono } from 'hono';
import { sql, eq, and, desc, inArray, or, isNull } from 'drizzle-orm';
import * as z from 'zod';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, requireAuth, assertOutletAccess } from '../lib/tenancy';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';
import { generateId } from '@logixsoft/helpers/crypto';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// ─── GET /feedback ────────────────────────────────────────────────────────────
// Owner/Manager review & feedback analytics dashboard
app.get(
  '/',
  apiDoc({
    tags: ['Feedback'],
    summary: 'Get Feedback Summary & Reviews',
    description: 'Retrieves rating breakdown, overall scores, and customer reviews with filters. Masked for anonymous reviews.',
    responses: { 200: z.any(), 401: ErrorResponseSchema, 403: ErrorResponseSchema },
  }),
  requirePermission('feedback:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || null;
    const ratingFilter = c.req.query('rating') ? parseInt(c.req.query('rating')!, 10) : null;
    const orderTypeFilter = c.req.query('orderType') || null;
    const search = (c.req.query('search') || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    if (outletId && !assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }

    const { db, close } = getDb(c);
    try {
      // 1. Base conditions
      const conditions: any[] = [eq(appSchema.orderFeedback.restaurantId, restaurantId)];
      if (outletId) {
        conditions.push(eq(appSchema.orderFeedback.outletId, outletId));
      }

      // 2. Fetch all reviews for calculating statistics
      const allFeedback = await db
        .select()
        .from(appSchema.orderFeedback)
        .where(and(...conditions));

      const totalReviews = allFeedback.length;
      let averageRating = 0;
      const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let sumFood = 0, countFood = 0;
      let sumService = 0, countService = 0;
      let sumDelivery = 0, countDelivery = 0;
      const tagCountMap = new Map<string, number>();

      if (totalReviews > 0) {
        let sumRating = 0;
        for (const f of allFeedback) {
          sumRating += f.rating;
          if (f.rating >= 1 && f.rating <= 5) {
            distribution[f.rating] = (distribution[f.rating] || 0) + 1;
          }
          if (f.foodRating) {
            sumFood += f.foodRating;
            countFood++;
          }
          if (f.serviceRating) {
            sumService += f.serviceRating;
            countService++;
          }
          if (f.deliveryRating) {
            sumDelivery += f.deliveryRating;
            countDelivery++;
          }
          const tags = Array.isArray(f.tags) ? (f.tags as string[]) : [];
          for (const t of tags) {
            if (t && typeof t === 'string') {
              tagCountMap.set(t, (tagCountMap.get(t) || 0) + 1);
            }
          }
        }
        averageRating = Math.round((sumRating / totalReviews) * 10) / 10;
      }

      const topTags = Array.from(tagCountMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top & Bottom rated items
      const menuItems = await db
        .select({
          id: appSchema.menuItem.id,
          name: appSchema.menuItem.name,
          ratingAvg: appSchema.menuItem.ratingAvg,
          ratingCount: appSchema.menuItem.ratingCount,
        })
        .from(appSchema.menuItem)
        .where(
          and(
            eq(appSchema.menuItem.restaurantId, restaurantId),
            sql`${appSchema.menuItem.ratingCount} > 0`
          )
        );

      const sortedByRating = [...menuItems].sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
      const topItems = sortedByRating.slice(0, 5);
      const needsAttentionItems = [...menuItems]
        .filter((i) => (i.ratingAvg || 0) < 4.0)
        .sort((a, b) => (a.ratingAvg || 0) - (b.ratingAvg || 0))
        .slice(0, 5);

      // 3. Filtered reviews query
      const filteredConditions = [...conditions];
      if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
        filteredConditions.push(eq(appSchema.orderFeedback.rating, ratingFilter));
      }

      const rawReviews = await db
        .select({
          feedback: appSchema.orderFeedback,
          order: {
            id: appSchema.saleOrder.id,
            orderNo: appSchema.saleOrder.orderNo,
            tableNo: appSchema.saleOrder.tableNo,
            orderType: appSchema.saleOrder.orderType,
            status: appSchema.saleOrder.status,
            createdAt: appSchema.saleOrder.createdAt,
          },
        })
        .from(appSchema.orderFeedback)
        .innerJoin(appSchema.saleOrder, eq(appSchema.orderFeedback.orderId, appSchema.saleOrder.id))
        .where(and(...filteredConditions))
        .orderBy(desc(appSchema.orderFeedback.createdAt));

      // In-memory filter for orderType and search if provided
      let filtered = rawReviews;
      if (orderTypeFilter) {
        const ot = orderTypeFilter.toUpperCase();
        filtered = filtered.filter((r) => (r.order.orderType || '').toUpperCase() === ot);
      }
      if (search) {
        filtered = filtered.filter((r) => {
          const commentMatch = (r.feedback.comment || '').toLowerCase().includes(search);
          const nameMatch = !r.feedback.isAnonymous && (r.feedback.customerName || '').toLowerCase().includes(search);
          const tagsMatch = Array.isArray(r.feedback.tags) && (r.feedback.tags as string[]).some((t) => t.toLowerCase().includes(search));
          return commentMatch || nameMatch || tagsMatch;
        });
      }

      const totalFiltered = filtered.length;
      const paginatedReviews = filtered.slice(offset, offset + limit);

      // Fetch item ratings for the paginated reviews
      const reviewIds = paginatedReviews.map((r) => r.feedback.id);
      let itemFeedbacks: any[] = [];
      if (reviewIds.length > 0) {
        itemFeedbacks = await db
          .select({
            id: appSchema.orderItemFeedback.id,
            reviewId: appSchema.orderItemFeedback.reviewId,
            menuItemId: appSchema.orderItemFeedback.menuItemId,
            itemName: appSchema.menuItem.name,
            rating: appSchema.orderItemFeedback.rating,
            comment: appSchema.orderItemFeedback.comment,
          })
          .from(appSchema.orderItemFeedback)
          .leftJoin(appSchema.menuItem, eq(appSchema.orderItemFeedback.menuItemId, appSchema.menuItem.id))
          .where(inArray(appSchema.orderItemFeedback.reviewId, reviewIds));
      }

      const itemFeedbackMap = new Map<string, any[]>();
      for (const ifb of itemFeedbacks) {
        const list = itemFeedbackMap.get(ifb.reviewId) || [];
        list.push(ifb);
        itemFeedbackMap.set(ifb.reviewId, list);
      }

      const reviews = paginatedReviews.map(({ feedback: f, order: o }) => {
        const isAnon = Boolean(f.isAnonymous);
        return {
          id: f.id,
          orderId: f.orderId,
          orderNo: o.orderNo,
          tableNo: o.tableNo,
          orderType: o.orderType || 'DINE_IN',
          customerName: isAnon ? 'Anonymous Customer' : (f.customerName || 'Customer'),
          customerPhone: isAnon ? '+91 ••••• •••••' : f.customerPhone,
          isAnonymous: isAnon,
          rating: f.rating,
          foodRating: f.foodRating,
          serviceRating: f.serviceRating,
          deliveryRating: f.deliveryRating,
          tags: (f.tags as string[]) || [],
          comment: f.comment || null,
          ownerReply: f.ownerReply || null,
          ownerRepliedAt: f.ownerRepliedAt ? f.ownerRepliedAt.toISOString() : null,
          createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
          updatedAt: f.updatedAt instanceof Date ? f.updatedAt.toISOString() : f.updatedAt,
          items: itemFeedbackMap.get(f.id) || [],
        };
      });

      return c.json({
        summary: {
          totalReviews,
          averageRating,
          distribution,
          categoryAverages: {
            food: countFood > 0 ? Math.round((sumFood / countFood) * 10) / 10 : null,
            service: countService > 0 ? Math.round((sumService / countService) * 10) / 10 : null,
            delivery: countDelivery > 0 ? Math.round((sumDelivery / countDelivery) * 10) / 10 : null,
          },
          topTags,
          topItems,
          needsAttentionItems,
        },
        reviews,
        pagination: {
          page,
          limit,
          total: totalFiltered,
          totalPages: Math.ceil(totalFiltered / limit),
        },
      });
    } finally {
      await close();
    }
  }
);

// ─── POST /feedback/:id/reply ─────────────────────────────────────────────────
// Owner replies to a customer review (NO edit or delete permitted!)
const OwnerReplySchema = z.object({
  reply: z.string().min(1, 'Reply message cannot be empty').max(1000, 'Reply too long'),
});

app.post(
  '/:id/reply',
  apiDoc({
    tags: ['Feedback'],
    summary: 'Owner Reply to Feedback',
    description: 'Allows owner to add an official response to customer feedback. Owners cannot edit or delete the customer review.',
    body: OwnerReplySchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('feedback:reply'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const reviewId = c.req.param('id');

    const body = await c.req.json().catch(() => ({}));
    const parsed = OwnerReplySchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { db, close } = getDb(c);
    try {
      const [review] = await db
        .select()
        .from(appSchema.orderFeedback)
        .where(
          and(
            eq(appSchema.orderFeedback.id, reviewId),
            eq(appSchema.orderFeedback.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!review) {
        return c.json({ error: 'Not Found', message: 'Review not found' }, 404);
      }

      if (!assertOutletAccess(tenant, review.outletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }

      const now = new Date();
      await db
        .update(appSchema.orderFeedback)
        .set({
          ownerReply: parsed.data.reply.trim(),
          ownerRepliedAt: now,
          updatedAt: now,
        })
        .where(eq(appSchema.orderFeedback.id, reviewId));

      return c.json({
        success: true,
        message: 'Reply saved successfully',
        ownerReply: parsed.data.reply.trim(),
        ownerRepliedAt: now.toISOString(),
      });
    } finally {
      await close();
    }
  }
);

// ─── POST /feedback/submit ────────────────────────────────────────────────────
// Customer submits or edits their review for an order
const SubmitFeedbackSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  rating: z.number().int().min(1).max(5),
  foodRating: z.number().int().min(1).max(5).optional(),
  serviceRating: z.number().int().min(1).max(5).optional(),
  deliveryRating: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string().max(50)).max(15).optional(),
  comment: z.string().max(1000).optional(),
  isAnonymous: z.boolean().default(false),
  itemRatings: z.array(
    z.object({
      itemId: z.string().min(1),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(250).optional(),
    })
  ).optional(),
});

app.post(
  '/submit',
  apiDoc({
    tags: ['Feedback'],
    summary: 'Submit or Update Order Rating & Feedback',
    description: 'Allows customer to rate their completed order and dishes. Only allowed after order completion.',
    body: SubmitFeedbackSchema,
    responses: { 200: z.any(), 400: ErrorResponseSchema, 401: ErrorResponseSchema },
  }),
  requireAuth(),
  async (c) => {
    const sessionUser = c.get('sessionUser') as any;
    const customerPhone = sessionUser?.phoneNumber;

    if (!customerPhone) {
      return c.json({ error: 'Unauthorized', message: 'Sign in required to submit feedback' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = SubmitFeedbackSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const {
      orderId,
      rating,
      foodRating,
      serviceRating,
      deliveryRating,
      tags = [],
      comment,
      isAnonymous = false,
      itemRatings = [],
    } = parsed.data;

    const { db, close } = getDb(c);
    try {
      // 1. Fetch order
      const [order] = await db
        .select()
        .from(appSchema.saleOrder)
        .where(eq(appSchema.saleOrder.id, orderId))
        .limit(1);

      if (!order) {
        return c.json({ error: 'Not Found', message: 'Order not found' }, 404);
      }

      // Check if cancelled/void
      if (order.status === 'VOID' || order.orderStatus === 'CANCELLED') {
        return c.json({ error: 'Bad Request', message: 'Cannot review a cancelled or voided order' }, 400);
      }

      // 2. Fetch delivery record if applicable
      const [delivery] = await db
        .select()
        .from(appSchema.deliveryOrder)
        .where(eq(appSchema.deliveryOrder.orderId, orderId))
        .limit(1);

      // 3. Validation: Rating allowed only after Dine-in / Takeaway / Delivery completion
      const isDelivery = order.orderType === 'DELIVERY' || (order.tableNo || '').toLowerCase() === 'delivery' || Boolean(delivery);
      const isTakeaway = (order.tableNo || '').toLowerCase() === 'takeaway' || order.orderType === 'TAKEAWAY';
      const isDineIn = !isTakeaway && !isDelivery;

      let isCompleted = false;
      if (isDelivery) {
        // Delivery completed when status is DELIVERED or settled
        isCompleted = delivery?.status === 'DELIVERED' || order.status === 'PAID';
        if (!isCompleted) {
          return c.json({
            error: 'Not Completed',
            message: 'Feedback is only available once your delivery order has been delivered.',
          }, 400);
        }
      } else if (isTakeaway) {
        // Takeaway completed when served or paid
        isCompleted = order.orderStatus === 'SERVED' || order.status === 'PAID';
        if (!isCompleted) {
          return c.json({
            error: 'Not Completed',
            message: 'Feedback is only available once your takeaway order has been served or paid.',
          }, 400);
        }
      } else {
        // Dine-in completed when table freed, bill paid, or items served
        isCompleted = order.tableFreedAt !== null || order.status === 'PAID' || order.orderStatus === 'SERVED';
        if (!isCompleted) {
          return c.json({
            error: 'Not Completed',
            message: 'Feedback is only available once your dining experience is completed or bill is settled.',
          }, 400);
        }
      }

      const now = new Date();
      const customerName = sessionUser?.name || null;

      // 4. Check if existing review exists (Customer editing review)
      const [existingReview] = await db
        .select()
        .from(appSchema.orderFeedback)
        .where(eq(appSchema.orderFeedback.orderId, orderId))
        .limit(1);

      let reviewId = existingReview?.id;
      const isUpdate = Boolean(existingReview);

      if (isUpdate) {
        // Update existing review (Customer is editing their review)
        await db
          .update(appSchema.orderFeedback)
          .set({
            rating,
            foodRating: foodRating ?? existingReview.foodRating,
            serviceRating: serviceRating ?? existingReview.serviceRating,
            deliveryRating: deliveryRating ?? existingReview.deliveryRating,
            tags,
            comment: comment ?? existingReview.comment,
            isAnonymous,
            customerName: customerName || existingReview.customerName,
            updatedAt: now,
          })
          .where(eq(appSchema.orderFeedback.id, reviewId));

        // Replace item feedback rows
        await db
          .delete(appSchema.orderItemFeedback)
          .where(eq(appSchema.orderItemFeedback.reviewId, reviewId));
      } else {
        // Insert new review
        reviewId = generateId('rev');
        await db
          .insert(appSchema.orderFeedback)
          .values({
            id: reviewId,
            restaurantId: order.restaurantId,
            outletId: order.outletId,
            orderId,
            customerPhone: String(customerPhone),
            customerName,
            isAnonymous,
            rating,
            foodRating: foodRating || null,
            serviceRating: serviceRating || null,
            deliveryRating: deliveryRating || null,
            tags,
            comment: comment || null,
            createdAt: now,
            updatedAt: now,
          });
      }

      // 5. Insert item-level reviews
      const ratedItemIds: string[] = [];
      if (itemRatings.length > 0) {
        const itemFeedbackRows = itemRatings.map((ir) => {
          ratedItemIds.push(ir.itemId);
          return {
            id: generateId('irev'),
            reviewId: reviewId!,
            orderId,
            menuItemId: ir.itemId,
            rating: ir.rating,
            comment: ir.comment || null,
            createdAt: now,
            updatedAt: now,
          };
        });

        await db.insert(appSchema.orderItemFeedback).values(itemFeedbackRows);

        // 6. Recalculate average ratings for all rated menu items
        for (const itemId of Array.from(new Set(ratedItemIds))) {
          const [agg] = await db
            .select({
              avgRating: sql<number>`ROUND(AVG(${appSchema.orderItemFeedback.rating})::numeric, 1)`,
              count: sql<number>`COUNT(*)`,
            })
            .from(appSchema.orderItemFeedback)
            .where(eq(appSchema.orderItemFeedback.menuItemId, itemId));

          const ratingAvg = agg?.avgRating ? Number(agg.avgRating) : 0;
          const ratingCount = agg?.count ? Number(agg.count) : 0;

          await db
            .update(appSchema.menuItem)
            .set({ ratingAvg, ratingCount, updatedAt: now })
            .where(eq(appSchema.menuItem.id, itemId));
        }
      }

      return c.json({
        success: true,
        message: isUpdate ? 'Review updated successfully!' : 'Thank you for your feedback!',
        isUpdate,
        reviewId,
      });
    } finally {
      await close();
    }
  }
);

// ─── GET /feedback/order/:orderId ─────────────────────────────────────────────
// Get existing review for an order (allows customer to view & edit their review)
app.get(
  '/order/:orderId',
  apiDoc({
    tags: ['Feedback'],
    summary: 'Get Feedback for Specific Order',
    description: 'Retrieves customer review and dish ratings for an order.',
    responses: { 200: z.any(), 404: ErrorResponseSchema },
  }),
  requireAuth(),
  async (c) => {
    const orderId = c.req.param('orderId');
    const { db, close } = getDb(c);
    try {
      const [review] = await db
        .select()
        .from(appSchema.orderFeedback)
        .where(eq(appSchema.orderFeedback.orderId, orderId))
        .limit(1);

      if (!review) {
        return c.json({ feedback: null });
      }

      const itemRatings = await db
        .select({
          id: appSchema.orderItemFeedback.id,
          menuItemId: appSchema.orderItemFeedback.menuItemId,
          rating: appSchema.orderItemFeedback.rating,
          comment: appSchema.orderItemFeedback.comment,
        })
        .from(appSchema.orderItemFeedback)
        .where(eq(appSchema.orderItemFeedback.reviewId, review.id));

      return c.json({
        feedback: {
          id: review.id,
          orderId: review.orderId,
          rating: review.rating,
          foodRating: review.foodRating,
          serviceRating: review.serviceRating,
          deliveryRating: review.deliveryRating,
          tags: (review.tags as string[]) || [],
          comment: review.comment || null,
          isAnonymous: review.isAnonymous,
          ownerReply: review.ownerReply || null,
          ownerRepliedAt: review.ownerRepliedAt ? review.ownerRepliedAt.toISOString() : null,
          createdAt: review.createdAt instanceof Date ? review.createdAt.toISOString() : review.createdAt,
          updatedAt: review.updatedAt instanceof Date ? review.updatedAt.toISOString() : review.updatedAt,
          itemRatings,
        },
      });
    } finally {
      await close();
    }
  }
);

export default app;
