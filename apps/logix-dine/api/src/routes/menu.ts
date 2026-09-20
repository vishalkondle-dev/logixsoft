import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createStorageClient } from '@logixsoft/helpers/storage';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission } from '../lib/tenancy';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  MenuCategorySchema,
  MenuItemSchema,
  CreateItemSchema,
  UpdateItemSchema,
  ReorderSchema,
} from '@logixsoft/logix-dine/schemas/pos';
import { toCategory, toMenuItem } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { cacheGet, cacheSet, invalidateMenu, CacheKey, TTL } from '../lib/cache';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function kv(c: any) { return c.env?.CACHE; }

function getStorage(c: any) {
  return createStorageClient({
    endpoint: c.env?.MINIO_ENDPOINT || 'https://storage.logixsoft.in',
    bucket: c.env?.MINIO_BUCKET || 'logix-dine',
    accessKeyId: c.env?.MINIO_ACCESS_KEY || 'vishalkondledev',
    secretAccessKey: c.env?.MINIO_SECRET_KEY || 'Vammavg@1605',
    region: 'us-east-1',
    forcePathStyle: true,
  });
}

// ─── Categories ───────────────────────────────────────────────────────────────

app.get(
  '/categories',
  apiDoc({
    tags: ['Menu'],
    summary: 'List Menu Categories',
    description: 'Fetches active menu categories for the current restaurant/outlet.',
    query: z.object({ outletId: z.string().optional() }),
    responses: { 200: z.array(MenuCategorySchema) },
  }),
  requirePermission('menu:read'),
  async (c) => {
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

app.post(
  '/categories',
  apiDoc({
    tags: ['Menu'],
    summary: 'Create Menu Category',
    description: 'Creates a new menu category for the restaurant/outlet.',
    body: CreateCategorySchema,
    responses: {
      201: MenuCategorySchema,
      400: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  async (c) => {
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

app.put(
  '/categories/:id',
  apiDoc({
    tags: ['Menu'],
    summary: 'Update Menu Category',
    description: 'Updates a menu category name, description, active status, or sort order.',
    params: z.object({ id: z.string() }),
    body: UpdateCategorySchema,
    responses: {
      200: MenuCategorySchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  async (c) => {
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

app.delete(
  '/categories/:id',
  apiDoc({
    tags: ['Menu'],
    summary: 'Delete Menu Category',
    description: 'Deletes a menu category if no items are assigned to it.',
    params: z.object({ id: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      409: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  async (c) => {
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

app.patch(
  '/categories/reorder',
  apiDoc({
    tags: ['Menu'],
    summary: 'Reorder Menu Categories',
    description: 'Updates sort order for an array of categories.',
    body: ReorderSchema,
    responses: {
      200: SuccessResponseSchema,
      400: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  async (c) => {
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

app.get(
  '/items',
  apiDoc({
    tags: ['Menu'],
    summary: 'List Menu Items',
    description: 'Fetches menu items with optional categoryId or outletId filter.',
    query: z.object({
      categoryId: z.string().optional(),
      outletId: z.string().optional(),
    }),
    responses: { 200: z.array(MenuItemSchema) },
  }),
  requirePermission('menu:read'),
  async (c) => {
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

app.post(
  '/items',
  apiDoc({
    tags: ['Menu'],
    summary: 'Create Menu Item',
    description: 'Creates a new menu item under a specific category.',
    body: CreateItemSchema,
    responses: {
      201: MenuItemSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  async (c) => {
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
    const variants = (parsed.data.variants || []).map((v) => ({
      id: v.id || generateId('var'),
      name: v.name.trim(),
      pricePaise: v.pricePaise,
    }));
    const addons = (parsed.data.addons || []).map((a) => ({
      id: a.id || generateId('add'),
      name: a.name.trim(),
      pricePaise: a.pricePaise,
    }));
    await db.insert(appSchema.menuItem).values({
      id, restaurantId, outletId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      pricePaise: parsed.data.pricePaise,
      available: true,
      sortOrder: parsed.data.sortOrder ?? 0,
      variants,
      addons,
      createdAt: now, updatedAt: now,
    });
    const [item] = await db.select().from(appSchema.menuItem).where(eq(appSchema.menuItem.id, id));
    await invalidateMenu(kv(c), restaurantId);
    return c.json(toMenuItem(item), 201);
  } finally {
    await close();
  }
});

const handleGetItem = async (c: any) => {
  const { restaurantId } = c.get('tenant');
  const id = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [item] = await db
      .select()
      .from(appSchema.menuItem)
      .where(and(eq(appSchema.menuItem.id, id), eq(appSchema.menuItem.restaurantId, restaurantId)));
    if (!item) return c.json({ error: 'Not Found', message: 'Menu item not found' }, 404);
    return c.json(toMenuItem(item));
  } finally {
    await close();
  }
};

app.get(
  '/items/:id',
  apiDoc({
    tags: ['Menu'],
    summary: 'Get Menu Item by ID',
    description: 'Fetches details of a specific menu item.',
    params: z.object({ id: z.string() }),
    responses: {
      200: MenuItemSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:read'),
  handleGetItem
);

app.get(
  '/:id',
  requirePermission('menu:read'),
  handleGetItem
);

const handleUpdateItem = async (c: any) => {
  const { restaurantId } = c.get('tenant');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const updateData: any = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.variants !== undefined) {
      updateData.variants = parsed.data.variants.map((v) => ({
        id: v.id || generateId('var'),
        name: v.name.trim(),
        pricePaise: v.pricePaise,
      }));
    }
    if (parsed.data.addons !== undefined) {
      updateData.addons = parsed.data.addons.map((a) => ({
        id: a.id || generateId('add'),
        name: a.name.trim(),
        pricePaise: a.pricePaise,
      }));
    }
    await db
      .update(appSchema.menuItem)
      .set(updateData)
      .where(and(eq(appSchema.menuItem.id, id), eq(appSchema.menuItem.restaurantId, restaurantId)));
    const [item] = await db.select().from(appSchema.menuItem).where(eq(appSchema.menuItem.id, id));
    if (!item) return c.json({ error: 'Not Found' }, 404);
    await invalidateMenu(kv(c), restaurantId);
    return c.json(toMenuItem(item));
  } finally {
    await close();
  }
};

app.put(
  '/items/:id',
  apiDoc({
    tags: ['Menu'],
    summary: 'Update Menu Item',
    description: 'Updates menu item details, price, category, or sort order.',
    params: z.object({ id: z.string() }),
    body: UpdateItemSchema,
    responses: {
      200: MenuItemSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  handleUpdateItem
);

app.put(
  '/:id',
  requirePermission('menu:write'),
  handleUpdateItem
);

const handleDeleteItem = async (c: any) => {
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
};

app.delete(
  '/items/:id',
  apiDoc({
    tags: ['Menu'],
    summary: 'Delete Menu Item',
    description: 'Deletes a menu item from the restaurant catalog.',
    params: z.object({ id: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  handleDeleteItem
);

app.delete(
  '/:id',
  requirePermission('menu:write'),
  handleDeleteItem
);

const handleUploadItemImage = async (c: any) => {
  const { restaurantId } = c.get('tenant');
  const id = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select()
      .from(appSchema.menuItem)
      .where(and(eq(appSchema.menuItem.id, id), eq(appSchema.menuItem.restaurantId, restaurantId)));
    if (!existing) return c.json({ error: 'Not Found', message: 'Menu item not found' }, 404);

    const formData = await c.req.formData();
    const file = formData.get('file') || formData.get('image');
    if (!file || typeof file === 'string') {
      return c.json({ error: 'Validation Error', message: 'No image file provided' }, 400);
    }

    const fileObj = file as File;
    const fileName = fileObj.name || 'image.jpg';
    const extMatch = fileName.split('.').pop()?.toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'];
    const ext = extMatch && allowedExts.includes(extMatch)
      ? extMatch
      : (fileObj.type?.includes('png') ? 'png' : fileObj.type?.includes('webp') ? 'webp' : 'jpg');

    const key = `logixsoft/logix-dine/assets/images/menu/${id}.${ext}`;
    const buffer = await fileObj.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const storage = getStorage(c);
    const { url } = await storage.upload(key, bytes, {
      contentType: fileObj.type || 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    await db
      .update(appSchema.menuItem)
      .set({ imageUrl: url, updatedAt: new Date() })
      .where(and(eq(appSchema.menuItem.id, id), eq(appSchema.menuItem.restaurantId, restaurantId)));

    const [updated] = await db.select().from(appSchema.menuItem).where(eq(appSchema.menuItem.id, id));
    await invalidateMenu(kv(c), restaurantId);
    return c.json(toMenuItem(updated));
  } catch (err: any) {
    return c.json({ error: 'Upload Failed', message: err.message || 'Failed to upload image' }, 500);
  } finally {
    await close();
  }
};

const handleDeleteItemImage = async (c: any) => {
  const { restaurantId } = c.get('tenant');
  const id = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select()
      .from(appSchema.menuItem)
      .where(and(eq(appSchema.menuItem.id, id), eq(appSchema.menuItem.restaurantId, restaurantId)));
    if (!existing) return c.json({ error: 'Not Found', message: 'Menu item not found' }, 404);

    if (existing.imageUrl) {
      try {
        const storage = getStorage(c);
        const urlObj = new URL(existing.imageUrl);
        const key = urlObj.pathname.replace(/^\/+logix-dine\//, '');
        await storage.delete(key);
      } catch {
        // ignore delete failure
      }
    }

    await db
      .update(appSchema.menuItem)
      .set({ imageUrl: null, updatedAt: new Date() })
      .where(and(eq(appSchema.menuItem.id, id), eq(appSchema.menuItem.restaurantId, restaurantId)));

    const [updated] = await db.select().from(appSchema.menuItem).where(eq(appSchema.menuItem.id, id));
    await invalidateMenu(kv(c), restaurantId);
    return c.json(toMenuItem(updated));
  } finally {
    await close();
  }
};

app.post(
  '/items/:id/image',
  apiDoc({
    tags: ['Menu'],
    summary: 'Upload Menu Item Image',
    description: 'Uploads an image file to MinIO storage and associates it with the menu item.',
    params: z.object({ id: z.string() }),
    responses: {
      200: MenuItemSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  handleUploadItemImage
);

app.post('/:id/image', requirePermission('menu:write'), handleUploadItemImage);

app.delete(
  '/items/:id/image',
  apiDoc({
    tags: ['Menu'],
    summary: 'Delete Menu Item Image',
    description: 'Removes the image for a menu item.',
    params: z.object({ id: z.string() }),
    responses: {
      200: MenuItemSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  handleDeleteItemImage
);

app.delete('/:id/image', requirePermission('menu:write'), handleDeleteItemImage);

const handleToggleItem = async (c: any) => {
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
};

app.patch(
  '/items/:id/toggle',
  apiDoc({
    tags: ['Menu'],
    summary: 'Toggle Menu Item Availability',
    description: 'Flips availability of a menu item on or off.',
    params: z.object({ id: z.string() }),
    responses: {
      200: MenuItemSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  handleToggleItem
);

app.patch(
  '/:id/toggle',
  requirePermission('menu:write'),
  handleToggleItem
);

app.patch(
  '/items/reorder',
  apiDoc({
    tags: ['Menu'],
    summary: 'Reorder Menu Items',
    description: 'Updates sort order for an array of items.',
    body: ReorderSchema,
    responses: {
      200: SuccessResponseSchema,
      400: ErrorResponseSchema,
    },
  }),
  requirePermission('menu:write'),
  async (c) => {
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
