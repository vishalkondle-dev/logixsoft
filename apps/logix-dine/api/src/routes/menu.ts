import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission } from '../lib/tenancy';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CreateItemSchema,
  UpdateItemSchema,
  ReorderSchema,
} from '@logixsoft/logix-dine/schemas/pos';
import { toCategory, toMenuItem } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { cacheGet, cacheSet, invalidateMenu, CacheKey, TTL } from '../lib/cache';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function kv(c: any) { return c.env?.CACHE; }

// ─── Categories ───────────────────────────────────────────────────────────────

app.get('/categories', requirePermission('menu:read'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || '';

  const cacheKey = CacheKey.categories(restaurantId, outletId);
  const cached = await cacheGet<any[]>(kv(c), cacheKey);
  if (cached) return c.json(cached);

  const { db, close } = getDb(c);
  try {
    const where = outletId
      ? and(eq(appSchema.menuCategory.restaurantId, restaurantId), eq(appSchema.menuCategory.outletId, outletId))
      : eq(appSchema.menuCategory.restaurantId, restaurantId);
    const cats = await db.select().from(appSchema.menuCategory).where(where);
    const result = cats.map(toCategory);
    await cacheSet(kv(c), cacheKey, result, TTL.menu);
    return c.json(result);
  } finally {
    await close();
  }
});

app.post('/categories', requirePermission('menu:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const headerOutletId = c.req.header('x-outlet-id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateCategorySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const outletId = parsed.data.outletId || headerOutletId || null;

  const { db, close } = getDb(c);
  try {
    const now = new Date();
    const id = generateId('cat');
    await db.insert(appSchema.menuCategory).values({
      id, restaurantId, outletId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
      active: true, createdAt: now, updatedAt: now,
    });
    const [cat] = await db.select().from(appSchema.menuCategory).where(eq(appSchema.menuCategory.id, id));
    await invalidateMenu(kv(c), restaurantId);
    return c.json(toCategory(cat), 201);
  } finally {
    await close();
  }
});

app.put('/categories/:id', requirePermission('menu:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateCategorySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    await db
      .update(appSchema.menuCategory)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(appSchema.menuCategory.id, id), eq(appSchema.menuCategory.restaurantId, restaurantId)));
    const [cat] = await db.select().from(appSchema.menuCategory).where(eq(appSchema.menuCategory.id, id));
    if (!cat) return c.json({ error: 'Not Found' }, 404);
    await invalidateMenu(kv(c), restaurantId);
    return c.json(toCategory(cat));
  } finally {
    await close();
  }
});

app.delete('/categories/:id', requirePermission('menu:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const id = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const items = await db
      .select({ id: appSchema.menuItem.id })
      .from(appSchema.menuItem)
      .where(and(eq(appSchema.menuItem.categoryId, id), eq(appSchema.menuItem.restaurantId, restaurantId)))
      .limit(1);
    if (items.length) {
      return c.json({ error: 'Conflict', message: 'Cannot delete category with items. Delete or move items first.' }, 409);
    }
    await db
      .delete(appSchema.menuCategory)
      .where(and(eq(appSchema.menuCategory.id, id), eq(appSchema.menuCategory.restaurantId, restaurantId)));
    await invalidateMenu(kv(c), restaurantId);
    return c.json({ success: true });
  } finally {
    await close();
  }
});

app.patch('/categories/reorder', requirePermission('menu:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const body = await c.req.json().catch(() => []);
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    await db.transaction(async (tx) => {
      for (const { id, sortOrder } of parsed.data) {
        await tx
          .update(appSchema.menuCategory)
          .set({ sortOrder, updatedAt: new Date() })
          .where(and(eq(appSchema.menuCategory.id, id), eq(appSchema.menuCategory.restaurantId, restaurantId)));
      }
    });
    await invalidateMenu(kv(c), restaurantId);
    return c.json({ success: true });
  } finally {
    await close();
  }
});

// ─── Items ────────────────────────────────────────────────────────────────────

app.get('/items', requirePermission('menu:read'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const categoryId = c.req.query('categoryId');
  const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || '';

  // Cache only full-outlet item lists (no categoryId filter) — that is what the web uses
  const cacheKey = !categoryId ? CacheKey.items(restaurantId, outletId) : null;
  if (cacheKey) {
    const cached = await cacheGet<any[]>(kv(c), cacheKey);
    if (cached) return c.json(cached);
  }

  const { db, close } = getDb(c);
  try {
    const conditions = [eq(appSchema.menuItem.restaurantId, restaurantId)];
    if (categoryId) conditions.push(eq(appSchema.menuItem.categoryId, categoryId));
    if (outletId) conditions.push(eq(appSchema.menuItem.outletId, outletId));

    const items = await db.select().from(appSchema.menuItem).where(and(...conditions));
    const result = items.map(toMenuItem);
    if (cacheKey) await cacheSet(kv(c), cacheKey, result, TTL.menu);
    return c.json(result);
  } finally {
    await close();
  }
});

app.post('/items', requirePermission('menu:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const headerOutletId = c.req.header('x-outlet-id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const [cat] = await db
      .select({ id: appSchema.menuCategory.id, outletId: appSchema.menuCategory.outletId })
      .from(appSchema.menuCategory)
      .where(and(eq(appSchema.menuCategory.id, parsed.data.categoryId), eq(appSchema.menuCategory.restaurantId, restaurantId)))
      .limit(1);
    if (!cat) return c.json({ error: 'Not Found', message: 'Category not found' }, 404);

    const outletId = parsed.data.outletId || headerOutletId || cat.outletId || null;
    const now = new Date();
    const id = generateId('item');
    await db.insert(appSchema.menuItem).values({
      id, restaurantId, outletId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      pricePaise: parsed.data.pricePaise,
      available: true,
      sortOrder: parsed.data.sortOrder ?? 0,
      createdAt: now, updatedAt: now,
    });
    const [item] = await db.select().from(appSchema.menuItem).where(eq(appSchema.menuItem.id, id));
    await invalidateMenu(kv(c), restaurantId);
    return c.json(toMenuItem(item), 201);
  } finally {
    await close();
  }
});

app.put('/items/:id', requirePermission('menu:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    await db
      .update(appSchema.menuItem)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(appSchema.menuItem.id, id), eq(appSchema.menuItem.restaurantId, restaurantId)));
    const [item] = await db.select().from(appSchema.menuItem).where(eq(appSchema.menuItem.id, id));
    if (!item) return c.json({ error: 'Not Found' }, 404);
    await invalidateMenu(kv(c), restaurantId);
    return c.json(toMenuItem(item));
  } finally {
    await close();
  }
});

app.delete('/items/:id', requirePermission('menu:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const id = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    await db
      .delete(appSchema.menuItem)
      .where(and(eq(appSchema.menuItem.id, id), eq(appSchema.menuItem.restaurantId, restaurantId)));
    await invalidateMenu(kv(c), restaurantId);
    return c.json({ success: true });
  } finally {
    await close();
  }
});

app.patch('/items/:id/toggle', requirePermission('menu:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const id = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [item] = await db
      .select()
      .from(appSchema.menuItem)
      .where(and(eq(appSchema.menuItem.id, id), eq(appSchema.menuItem.restaurantId, restaurantId)));
    if (!item) return c.json({ error: 'Not Found' }, 404);
    await db
      .update(appSchema.menuItem)
      .set({ available: !item.available, updatedAt: new Date() })
      .where(eq(appSchema.menuItem.id, id));
    const [updated] = await db.select().from(appSchema.menuItem).where(eq(appSchema.menuItem.id, id));
    await invalidateMenu(kv(c), restaurantId);
    return c.json(toMenuItem(updated));
  } finally {
    await close();
  }
});

app.patch('/items/reorder', requirePermission('menu:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const body = await c.req.json().catch(() => []);
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    await db.transaction(async (tx) => {
      for (const { id, sortOrder } of parsed.data) {
        await tx
          .update(appSchema.menuItem)
          .set({ sortOrder, updatedAt: new Date() })
          .where(and(eq(appSchema.menuItem.id, id), eq(appSchema.menuItem.restaurantId, restaurantId)));
      }
    });
    await invalidateMenu(kv(c), restaurantId);
    return c.json({ success: true });
  } finally {
    await close();
  }
});

export { app as menuRoutes };
