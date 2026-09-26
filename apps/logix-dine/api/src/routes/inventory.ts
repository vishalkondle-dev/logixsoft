import { Hono } from 'hono';
import { eq, and, or, sql, desc, inArray, gte, lte } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import {
  CreateInventoryItemSchema,
  UpdateInventoryItemSchema,
  CreateInventorySupplierSchema,
  UpdateInventorySupplierSchema,
  SaveMenuItemRecipeSchema,
  InventoryAdjustSchema,
  InventoryWastageSchema,
  CreatePurchaseOrderSchema,
  UpdateInventorySettingsSchema,
  InventoryItemSchema,
  InventorySupplierSchema,
  PurchaseOrderSchema,
  InventoryTransactionSchema,
} from '@logixsoft/logix-dine/schemas/pos';
import {
  toInventoryItem,
  toMenuItemRecipe,
  toInventoryTransaction,
  toInventorySupplier,
  toPurchaseOrder,
} from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';

export const inventoryRoutes = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// ─── 1. Inventory Overview & KPIs ───────────────────────────────────────────

inventoryRoutes.get(
  '/overview',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Inventory Overview & KPIs',
    description: 'Retrieves stock valuation, low-stock count, daily consumption, and wastage KPIs.',
    query: z.object({ outletId: z.string().optional() }),
    responses: {
      200: z.object({
        totalStockValuePaise: z.number(),
        totalItemsCount: z.number(),
        lowStockCount: z.number(),
        outOfStockCount: z.number(),
        todayConsumptionPaise: z.number(),
        todayWastagePaise: z.number(),
        inventorySettings: z.any(),
      }),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || '';
    if (outletId && !assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: 'No access to outlet' }, 403);
    }

    const { db, close } = getDb(c);
    try {
      let inventorySettings = {
        enabled: false,
        autoDeductOn: 'ON_ORDER',
        allowNegativeStock: true,
        lowStockAlerts: true,
        auto86OnDepletion: false,
      };

      if (outletId) {
        const [outlet] = await db
          .select({ inventorySettings: appSchema.restaurantOutlet.inventorySettings })
          .from(appSchema.restaurantOutlet)
          .where(eq(appSchema.restaurantOutlet.id, outletId))
          .limit(1);
        if (outlet?.inventorySettings) {
          inventorySettings = { ...inventorySettings, ...(outlet.inventorySettings as any) };
        }
      }

      const whereItems = outletId
        ? and(
            eq(appSchema.inventoryItem.restaurantId, restaurantId),
            eq(appSchema.inventoryItem.outletId, outletId),
            eq(appSchema.inventoryItem.active, true)
          )
        : and(
            eq(appSchema.inventoryItem.restaurantId, restaurantId),
            eq(appSchema.inventoryItem.active, true)
          );

      const items = await db.select().from(appSchema.inventoryItem).where(whereItems);

      let totalStockValuePaise = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      for (const it of items) {
        const stock = it.currentStock || 0;
        const cost = it.costPerBaseUnitPaise || 0;
        if (stock > 0) {
          totalStockValuePaise += Math.round(stock * cost);
        }
        if (stock <= 0) {
          outOfStockCount++;
        } else if (it.lowStockThreshold && stock <= it.lowStockThreshold) {
          lowStockCount++;
        }
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const whereTx = outletId
        ? and(
            eq(appSchema.inventoryTransaction.restaurantId, restaurantId),
            eq(appSchema.inventoryTransaction.outletId, outletId),
            gte(appSchema.inventoryTransaction.createdAt, todayStart)
          )
        : and(
            eq(appSchema.inventoryTransaction.restaurantId, restaurantId),
            gte(appSchema.inventoryTransaction.createdAt, todayStart)
          );

      const todayTxs = await db.select().from(appSchema.inventoryTransaction).where(whereTx);

      let todayConsumptionPaise = 0;
      let todayWastagePaise = 0;

      for (const tx of todayTxs) {
        const val = Math.abs(tx.quantity) * (tx.unitCostPaise || 0);
        if (tx.type === 'ORDER_CONSUMPTION') {
          todayConsumptionPaise += Math.round(val);
        } else if (tx.type === 'WASTAGE') {
          todayWastagePaise += Math.round(val);
        }
      }

      return c.json({
        totalStockValuePaise,
        totalItemsCount: items.length,
        lowStockCount,
        outOfStockCount,
        todayConsumptionPaise,
        todayWastagePaise,
        inventorySettings,
      });
    } finally {
      await close();
    }
  }
);

// ─── 2. Inventory Items CRUD ────────────────────────────────────────────────

inventoryRoutes.get(
  '/items',
  apiDoc({
    tags: ['Inventory'],
    summary: 'List Inventory Items',
    description: 'Lists raw ingredients and packaging materials for the outlet.',
    query: z.object({
      outletId: z.string().optional(),
      category: z.string().optional(),
      lowStock: z.string().optional(),
    }),
    responses: {
      200: z.array(z.any()),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || '';
    const category = c.req.query('category');
    const lowStock = c.req.query('lowStock') === 'true';

    if (outletId && !assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: 'No access to outlet' }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const conditions: any[] = [
        eq(appSchema.inventoryItem.restaurantId, restaurantId),
        eq(appSchema.inventoryItem.active, true),
      ];
      if (outletId) conditions.push(eq(appSchema.inventoryItem.outletId, outletId));
      if (category && category !== 'ALL') conditions.push(eq(appSchema.inventoryItem.category, category));

      const rows = await db
        .select({
          item: appSchema.inventoryItem,
          supplierName: appSchema.inventorySupplier.name,
        })
        .from(appSchema.inventoryItem)
        .leftJoin(
          appSchema.inventorySupplier,
          eq(appSchema.inventoryItem.supplierId, appSchema.inventorySupplier.id)
        )
        .where(and(...conditions))
        .orderBy(desc(appSchema.inventoryItem.createdAt));

      let items = rows.map((r: any) => ({
        ...toInventoryItem(r.item),
        supplierName: r.supplierName || null,
      }));

      if (lowStock) {
        items = items.filter(
          (i) => i.lowStockThreshold && i.currentStock <= i.lowStockThreshold
        );
      }

      return c.json(items);
    } finally {
      await close();
    }
  }
);

inventoryRoutes.post(
  '/items',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Create Inventory Item',
    description: 'Creates a new ingredient or raw material.',
    responses: {
      201: InventoryItemSchema,
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.header('x-outlet-id') || c.req.query('outletId') || '';
    if (!outletId) {
      return c.json({ error: 'BadRequest', message: 'x-outlet-id header is required' }, 400);
    }
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: 'No access to outlet' }, 403);
    }

    const body = await c.req.json();
    const parsed = CreateInventoryItemSchema.parse(body);

    const { db, close } = getDb(c);
    try {
      const id = generateId('ing');
      const caller = c.get('actorPhone') || 'STAFF';

      const [created] = await db
        .insert(appSchema.inventoryItem)
        .values({
          id,
          restaurantId,
          outletId,
          name: parsed.name,
          sku: parsed.sku || null,
          category: parsed.category || 'GENERAL',
          baseUom: parsed.baseUom,
          purchaseUom: parsed.purchaseUom || null,
          purchaseConversionFactor: parsed.purchaseConversionFactor || 1,
          costPerBaseUnitPaise: parsed.costPerBaseUnitPaise || 0,
          currentStock: parsed.currentStock || 0,
          lowStockThreshold: parsed.lowStockThreshold || 0,
          idealStock: parsed.idealStock || null,
          supplierId: parsed.supplierId || null,
          active: true,
          createdBy: caller,
          updatedBy: caller,
        })
        .returning();

      if (parsed.currentStock && parsed.currentStock > 0) {
        await db.insert(appSchema.inventoryTransaction).values({
          id: generateId('itx'),
          restaurantId,
          outletId,
          ingredientId: id,
          type: 'ADJUSTMENT',
          quantity: parsed.currentStock,
          balanceAfter: parsed.currentStock,
          unitCostPaise: parsed.costPerBaseUnitPaise || 0,
          referenceNote: 'Opening Stock Count',
          createdAt: new Date(),
          createdBy: caller,
        });
      }

      return c.json(toInventoryItem(created), 201);
    } finally {
      await close();
    }
  }
);

inventoryRoutes.patch(
  '/items/:id',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Update Inventory Item',
    description: 'Updates details or thresholds of an ingredient.',
    responses: {
      200: InventoryItemSchema,
      404: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateInventoryItemSchema.parse(body);

    const { db, close } = getDb(c);
    try {
      const caller = c.get('actorPhone') || 'STAFF';

      const [updated] = await db
        .update(appSchema.inventoryItem)
        .set({
          ...parsed,
          updatedAt: new Date(),
          updatedBy: caller,
        })
        .where(
          and(
            eq(appSchema.inventoryItem.id, id),
            eq(appSchema.inventoryItem.restaurantId, restaurantId)
          )
        )
        .returning();

      if (!updated) {
        return c.json({ error: 'NotFound', message: 'Item not found' }, 404);
      }

      return c.json(toInventoryItem(updated));
    } finally {
      await close();
    }
  }
);

inventoryRoutes.delete(
  '/items/:id',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Delete Inventory Item',
    description: 'Soft-deletes/archives an ingredient.',
    responses: {
      200: SuccessResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const id = c.req.param('id');

    const { db, close } = getDb(c);
    try {
      await db
        .update(appSchema.inventoryItem)
        .set({ active: false, updatedAt: new Date() })
        .where(
          and(
            eq(appSchema.inventoryItem.id, id),
            eq(appSchema.inventoryItem.restaurantId, restaurantId)
          )
        );

      return c.json({ success: true, message: 'Item deleted' });
    } finally {
      await close();
    }
  }
);

// ─── 3. Recipe Management (BOM) ─────────────────────────────────────────────

inventoryRoutes.get(
  '/recipes',
  apiDoc({
    tags: ['Inventory'],
    summary: 'List All Menu Recipes',
    description: 'Returns all menu items with calculated food cost and ingredient count.',
    query: z.object({ outletId: z.string().optional() }),
    responses: {
      200: z.array(z.any()),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || '';

    const { db, close } = getDb(c);
    try {
      const itemWhere = outletId
        ? and(
            eq(appSchema.menuItem.restaurantId, restaurantId),
            or(eq(appSchema.menuItem.outletId, outletId), sql`${appSchema.menuItem.outletId} IS NULL`),
            eq(appSchema.menuItem.available, true)
          )
        : and(
            eq(appSchema.menuItem.restaurantId, restaurantId),
            eq(appSchema.menuItem.available, true)
          );

      const items = await db
        .select({
          id: appSchema.menuItem.id,
          name: appSchema.menuItem.name,
          pricePaise: appSchema.menuItem.pricePaise,
          categoryId: appSchema.menuItem.categoryId,
          categoryName: appSchema.menuCategory.name,
          variants: appSchema.menuItem.variants,
          addons: appSchema.menuItem.addons,
        })
        .from(appSchema.menuItem)
        .leftJoin(appSchema.menuCategory, eq(appSchema.menuItem.categoryId, appSchema.menuCategory.id))
        .where(itemWhere);

      const recipeRows = await db
        .select({
          recipe: appSchema.menuItemRecipe,
          ingredientCost: appSchema.inventoryItem.costPerBaseUnitPaise,
          ingredientName: appSchema.inventoryItem.name,
          baseUom: appSchema.inventoryItem.baseUom,
        })
        .from(appSchema.menuItemRecipe)
        .innerJoin(
          appSchema.inventoryItem,
          eq(appSchema.menuItemRecipe.ingredientId, appSchema.inventoryItem.id)
        )
        .where(eq(appSchema.menuItemRecipe.restaurantId, restaurantId));

      const recipesByMenuItem = new Map<string, any[]>();
      for (const r of recipeRows) {
        const list = recipesByMenuItem.get(r.recipe.menuItemId) || [];
        list.push(r);
        recipesByMenuItem.set(r.recipe.menuItemId, list);
      }

      const result = items.map((dish: any) => {
        const dishRecipes = recipesByMenuItem.get(dish.id) || [];
        let totalCostPaise = 0;

        for (const line of dishRecipes) {
          if (!line.recipe.variantId && !line.recipe.addonId) {
            const waste = 1 + (line.recipe.wastePercent || 0) / 100;
            totalCostPaise += Math.round(line.recipe.quantity * waste * line.ingredientCost);
          }
        }

        const sellingPrice = dish.pricePaise || 1;
        const foodCostPercent = sellingPrice > 0 ? (totalCostPaise / sellingPrice) * 100 : 0;

        return {
          id: dish.id,
          name: dish.name,
          categoryName: dish.categoryName || 'General',
          pricePaise: dish.pricePaise,
          hasRecipe: dishRecipes.length > 0,
          ingredientCount: dishRecipes.length,
          totalCostPaise,
          foodCostPercent: Math.round(foodCostPercent * 10) / 10,
          grossMarginPercent: Math.round((100 - foodCostPercent) * 10) / 10,
        };
      });

      return c.json(result);
    } finally {
      await close();
    }
  }
);

inventoryRoutes.get(
  '/recipes/:menuItemId',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Get Recipe for Menu Item',
    description: 'Retrieves ingredient breakdown and food cost for a specific dish.',
    responses: {
      200: z.any(),
      404: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const menuItemId = c.req.param('menuItemId');

    const { db, close } = getDb(c);
    try {
      const [item] = await db
        .select()
        .from(appSchema.menuItem)
        .where(
          and(
            eq(appSchema.menuItem.id, menuItemId),
            eq(appSchema.menuItem.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!item) {
        return c.json({ error: 'NotFound', message: 'Menu item not found' }, 404);
      }

      const lines = await db
        .select({
          recipe: appSchema.menuItemRecipe,
          ingredient: appSchema.inventoryItem,
        })
        .from(appSchema.menuItemRecipe)
        .innerJoin(
          appSchema.inventoryItem,
          eq(appSchema.menuItemRecipe.ingredientId, appSchema.inventoryItem.id)
        )
        .where(
          and(
            eq(appSchema.menuItemRecipe.menuItemId, menuItemId),
            eq(appSchema.menuItemRecipe.restaurantId, restaurantId)
          )
        );

      let totalCostPaise = 0;
      const ingredients = lines.map((l: any) => {
        const waste = 1 + (l.recipe.wastePercent || 0) / 100;
        const lineCostPaise = Math.round(
          l.recipe.quantity * waste * l.ingredient.costPerBaseUnitPaise
        );
        if (!l.recipe.variantId && !l.recipe.addonId) {
          totalCostPaise += lineCostPaise;
        }

        return {
          id: l.recipe.id,
          ingredientId: l.ingredient.id,
          ingredientName: l.ingredient.name,
          category: l.ingredient.category,
          baseUom: l.ingredient.baseUom,
          quantity: l.recipe.quantity,
          wastePercent: l.recipe.wastePercent || 0,
          costPerBaseUnitPaise: l.ingredient.costPerBaseUnitPaise,
          lineCostPaise,
          variantId: l.recipe.variantId,
          addonId: l.recipe.addonId,
        };
      });

      const sellingPrice = item.pricePaise || 1;
      const foodCostPercent = sellingPrice > 0 ? (totalCostPaise / sellingPrice) * 100 : 0;

      return c.json({
        menuItemId: item.id,
        menuItemName: item.name,
        pricePaise: item.pricePaise,
        variants: item.variants || [],
        addons: item.addons || [],
        totalCostPaise,
        foodCostPercent: Math.round(foodCostPercent * 10) / 10,
        grossMarginPercent: Math.round((100 - foodCostPercent) * 10) / 10,
        ingredients,
      });
    } finally {
      await close();
    }
  }
);

inventoryRoutes.put(
  '/recipes/:menuItemId',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Save Recipe for Menu Item',
    description: 'Atomically replaces all ingredient lines for a dish.',
    responses: {
      200: z.object({ success: z.boolean(), count: z.number() }),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const menuItemId = c.req.param('menuItemId');
    const body = await c.req.json();
    const parsed = SaveMenuItemRecipeSchema.parse(body);

    const { db, close } = getDb(c);
    try {
      await db
        .delete(appSchema.menuItemRecipe)
        .where(
          and(
            eq(appSchema.menuItemRecipe.menuItemId, menuItemId),
            eq(appSchema.menuItemRecipe.restaurantId, restaurantId)
          )
        );

      if (parsed.ingredients.length > 0) {
        const rows = parsed.ingredients.map((ing) => ({
          id: generateId('rcp'),
          restaurantId,
          menuItemId,
          ingredientId: ing.ingredientId,
          quantity: ing.quantity,
          wastePercent: ing.wastePercent || 0,
          variantId: ing.variantId || null,
          addonId: ing.addonId || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        await db.insert(appSchema.menuItemRecipe).values(rows);
      }

      return c.json({ success: true, count: parsed.ingredients.length });
    } finally {
      await close();
    }
  }
);

// ─── 4. Stock Adjustments & Wastage ──────────────────────────────────────────

inventoryRoutes.post(
  '/adjust',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Adjust Stock Count (Physical Audit)',
    description: 'Reconciles current stock to a new audited physical count.',
    responses: {
      200: z.object({
        success: z.boolean(),
        previousStock: z.number(),
        newStock: z.number(),
        difference: z.number(),
      }),
      404: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json();
    const parsed = InventoryAdjustSchema.parse(body);

    const { db, close } = getDb(c);
    try {
      const [item] = await db
        .select()
        .from(appSchema.inventoryItem)
        .where(
          and(
            eq(appSchema.inventoryItem.id, parsed.ingredientId),
            eq(appSchema.inventoryItem.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!item) {
        return c.json({ error: 'NotFound', message: 'Item not found' }, 404);
      }

      const caller = c.get('actorPhone') || 'STAFF';
      const diff = Math.round((parsed.newStock - item.currentStock) * 1000) / 1000;

      await db
        .update(appSchema.inventoryItem)
        .set({
          currentStock: parsed.newStock,
          updatedAt: new Date(),
          updatedBy: caller,
        })
        .where(eq(appSchema.inventoryItem.id, parsed.ingredientId));

      await db.insert(appSchema.inventoryTransaction).values({
        id: generateId('itx'),
        restaurantId,
        outletId: item.outletId,
        ingredientId: parsed.ingredientId,
        type: 'ADJUSTMENT',
        quantity: diff,
        balanceAfter: parsed.newStock,
        unitCostPaise: item.costPerBaseUnitPaise,
        referenceNote: parsed.reason,
        createdAt: new Date(),
        createdBy: caller,
      });

      return c.json({
        success: true,
        previousStock: item.currentStock,
        newStock: parsed.newStock,
        difference: diff,
      });
    } finally {
      await close();
    }
  }
);

inventoryRoutes.post(
  '/wastage',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Log Food Wastage / Spoilage',
    description: 'Records ingredient spillage, burning, or expiration.',
    responses: {
      200: z.object({
        success: z.boolean(),
        quantityWasted: z.number(),
        remainingStock: z.number(),
      }),
      404: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json();
    const parsed = InventoryWastageSchema.parse(body);

    const { db, close } = getDb(c);
    try {
      const [item] = await db
        .select()
        .from(appSchema.inventoryItem)
        .where(
          and(
            eq(appSchema.inventoryItem.id, parsed.ingredientId),
            eq(appSchema.inventoryItem.restaurantId, restaurantId)
          )
        )
        .limit(1);

      if (!item) {
        return c.json({ error: 'NotFound', message: 'Item not found' }, 404);
      }

      const caller = c.get('actorPhone') || 'STAFF';
      const newStock = Math.round((item.currentStock - parsed.quantity) * 1000) / 1000;

      await db
        .update(appSchema.inventoryItem)
        .set({
          currentStock: newStock,
          updatedAt: new Date(),
          updatedBy: caller,
        })
        .where(eq(appSchema.inventoryItem.id, parsed.ingredientId));

      await db.insert(appSchema.inventoryTransaction).values({
        id: generateId('itx'),
        restaurantId,
        outletId: item.outletId,
        ingredientId: parsed.ingredientId,
        type: 'WASTAGE',
        quantity: -parsed.quantity,
        balanceAfter: newStock,
        unitCostPaise: item.costPerBaseUnitPaise,
        referenceNote: parsed.reason,
        createdAt: new Date(),
        createdBy: caller,
      });

      return c.json({
        success: true,
        quantityWasted: parsed.quantity,
        remainingStock: newStock,
      });
    } finally {
      await close();
    }
  }
);

// ─── 5. Movement Ledger (Audit Log) ──────────────────────────────────────────

inventoryRoutes.get(
  '/transactions',
  apiDoc({
    tags: ['Inventory'],
    summary: 'List Inventory Transactions',
    description: 'Audit log of stock movements (purchases, orders, wastage, adjustments).',
    query: z.object({
      outletId: z.string().optional(),
      ingredientId: z.string().optional(),
      type: z.string().optional(),
      limit: z.string().optional(),
    }),
    responses: {
      200: z.array(z.any()),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || '';
    const ingredientId = c.req.query('ingredientId');
    const type = c.req.query('type');
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);

    const { db, close } = getDb(c);
    try {
      const conditions: any[] = [eq(appSchema.inventoryTransaction.restaurantId, restaurantId)];
      if (outletId) conditions.push(eq(appSchema.inventoryTransaction.outletId, outletId));
      if (ingredientId) conditions.push(eq(appSchema.inventoryTransaction.ingredientId, ingredientId));
      if (type && type !== 'ALL') conditions.push(eq(appSchema.inventoryTransaction.type, type));

      const rows = await db
        .select({
          tx: appSchema.inventoryTransaction,
          ingredientName: appSchema.inventoryItem.name,
          baseUom: appSchema.inventoryItem.baseUom,
        })
        .from(appSchema.inventoryTransaction)
        .innerJoin(
          appSchema.inventoryItem,
          eq(appSchema.inventoryTransaction.ingredientId, appSchema.inventoryItem.id)
        )
        .where(and(...conditions))
        .orderBy(desc(appSchema.inventoryTransaction.createdAt))
        .limit(limit);

      const result = rows.map((r: any) => ({
        ...toInventoryTransaction(r.tx),
        ingredientName: r.ingredientName,
        baseUom: r.baseUom,
      }));

      return c.json(result);
    } finally {
      await close();
    }
  }
);

// ─── 6. Purchases (Stock In / GRN) ───────────────────────────────────────────

inventoryRoutes.get(
  '/purchases',
  apiDoc({
    tags: ['Inventory'],
    summary: 'List Purchase Orders',
    description: 'Lists inward supplier deliveries and bills.',
    query: z.object({ outletId: z.string().optional() }),
    responses: {
      200: z.array(z.any()),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || '';

    const { db, close } = getDb(c);
    try {
      const conditions: any[] = [eq(appSchema.purchaseOrder.restaurantId, restaurantId)];
      if (outletId) conditions.push(eq(appSchema.purchaseOrder.outletId, outletId));

      const rows = await db
        .select({
          po: appSchema.purchaseOrder,
          supplierName: appSchema.inventorySupplier.name,
        })
        .from(appSchema.purchaseOrder)
        .leftJoin(
          appSchema.inventorySupplier,
          eq(appSchema.purchaseOrder.supplierId, appSchema.inventorySupplier.id)
        )
        .where(and(...conditions))
        .orderBy(desc(appSchema.purchaseOrder.createdAt))
        .limit(50);

      const result = rows.map((r: any) => ({
        ...toPurchaseOrder(r.po),
        supplierName: r.supplierName || 'Unknown Supplier',
      }));

      return c.json(result);
    } finally {
      await close();
    }
  }
);

inventoryRoutes.post(
  '/purchases',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Record Inward Purchase Order',
    description: 'Records goods received from a vendor and automatically increments stock.',
    responses: {
      201: PurchaseOrderSchema,
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const outletId = c.req.header('x-outlet-id') || c.req.query('outletId') || '';
    if (!outletId) {
      return c.json({ error: 'BadRequest', message: 'x-outlet-id header is required' }, 400);
    }

    const body = await c.req.json();
    const parsed = CreatePurchaseOrderSchema.parse(body);

    const { db, close } = getDb(c);
    try {
      const caller = c.get('actorPhone') || 'STAFF';
      const poId = generateId('po');

      let totalAmountPaise = 0;
      for (const item of parsed.items) {
        totalAmountPaise += Math.round(item.quantity * item.unitCostPaise);
      }

      const [po] = await db
        .insert(appSchema.purchaseOrder)
        .values({
          id: poId,
          restaurantId,
          outletId,
          supplierId: parsed.supplierId || null,
          poNumber: parsed.poNumber,
          invoiceNumber: parsed.invoiceNumber || null,
          invoiceDate: parsed.invoiceDate || null,
          status: 'RECEIVED',
          totalAmountPaise,
          notes: parsed.notes || null,
          receivedAt: new Date(),
          createdAt: new Date(),
          createdBy: caller,
        })
        .returning();

      for (const line of parsed.items) {
        const lineTotal = Math.round(line.quantity * line.unitCostPaise);

        await db.insert(appSchema.purchaseOrderItem).values({
          id: generateId('poi'),
          purchaseOrderId: poId,
          ingredientId: line.ingredientId,
          quantity: line.quantity,
          unitCostPaise: line.unitCostPaise,
          totalPaise: lineTotal,
          createdAt: new Date(),
        });

        const [ing] = await db
          .select()
          .from(appSchema.inventoryItem)
          .where(eq(appSchema.inventoryItem.id, line.ingredientId))
          .limit(1);

        if (ing) {
          const newStock = Math.round((ing.currentStock + line.quantity) * 1000) / 1000;

          await db
            .update(appSchema.inventoryItem)
            .set({
              currentStock: newStock,
              costPerBaseUnitPaise: line.unitCostPaise,
              updatedAt: new Date(),
              updatedBy: caller,
            })
            .where(eq(appSchema.inventoryItem.id, line.ingredientId));

          await db.insert(appSchema.inventoryTransaction).values({
            id: generateId('itx'),
            restaurantId,
            outletId,
            ingredientId: line.ingredientId,
            type: 'PURCHASE',
            quantity: line.quantity,
            balanceAfter: newStock,
            unitCostPaise: line.unitCostPaise,
            referenceId: poId,
            referenceNote: `PO #${parsed.poNumber}${parsed.invoiceNumber ? ' (Inv #' + parsed.invoiceNumber + ')' : ''}`,
            createdAt: new Date(),
            createdBy: caller,
          });
        }
      }

      return c.json(toPurchaseOrder(po), 201);
    } finally {
      await close();
    }
  }
);

// ─── 7. Suppliers Registry ───────────────────────────────────────────────────

inventoryRoutes.get(
  '/suppliers',
  apiDoc({
    tags: ['Inventory'],
    summary: 'List Suppliers',
    description: 'Lists vendor directory.',
    responses: {
      200: z.array(InventorySupplierSchema),
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;

    const { db, close } = getDb(c);
    try {
      const rows = await db
        .select()
        .from(appSchema.inventorySupplier)
        .where(
          and(
            eq(appSchema.inventorySupplier.restaurantId, restaurantId),
            eq(appSchema.inventorySupplier.active, true)
          )
        )
        .orderBy(appSchema.inventorySupplier.name);

      return c.json(rows.map(toInventorySupplier));
    } finally {
      await close();
    }
  }
);

inventoryRoutes.post(
  '/suppliers',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Create Supplier',
    description: 'Adds a new vendor to the directory.',
    responses: {
      201: InventorySupplierSchema,
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json();
    const parsed = CreateInventorySupplierSchema.parse(body);

    const { db, close } = getDb(c);
    try {
      const id = generateId('sup');
      const [created] = await db
        .insert(appSchema.inventorySupplier)
        .values({
          id,
          restaurantId,
          name: parsed.name,
          contactPerson: parsed.contactPerson || null,
          phone: parsed.phone || null,
          email: parsed.email || null,
          gstin: parsed.gstin || null,
          address: parsed.address || null,
          paymentTerms: parsed.paymentTerms || null,
          active: true,
          createdAt: new Date(),
        })
        .returning();

      return c.json(toInventorySupplier(created), 201);
    } finally {
      await close();
    }
  }
);

inventoryRoutes.patch(
  '/suppliers/:id',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Update Supplier',
    description: 'Updates vendor details.',
    responses: {
      200: InventorySupplierSchema,
      404: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateInventorySupplierSchema.parse(body);

    const { db, close } = getDb(c);
    try {
      const [updated] = await db
        .update(appSchema.inventorySupplier)
        .set(parsed)
        .where(
          and(
            eq(appSchema.inventorySupplier.id, id),
            eq(appSchema.inventorySupplier.restaurantId, restaurantId)
          )
        )
        .returning();

      if (!updated) {
        return c.json({ error: 'NotFound', message: 'Supplier not found' }, 404);
      }

      return c.json(toInventorySupplier(updated));
    } finally {
      await close();
    }
  }
);

// ─── 8. Inventory Settings Toggle ───────────────────────────────────────────

inventoryRoutes.get(
  '/settings',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Get Inventory Settings',
    description: 'Retrieves outlet inventory configuration.',
    query: z.object({ outletId: z.string().optional() }),
    responses: {
      200: z.object({
        enabled: z.boolean(),
        autoDeductOn: z.string(),
        allowNegativeStock: z.boolean(),
        lowStockAlerts: z.boolean(),
        auto86OnDepletion: z.boolean(),
      }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:read'),
  async (c) => {
    const tenant = c.get('tenant');
    const outletId = c.req.query('outletId') || c.req.header('x-outlet-id') || '';

    if (!outletId) {
      return c.json({ error: 'BadRequest', message: 'Outlet ID required' }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const [outlet] = await db
        .select({ inventorySettings: appSchema.restaurantOutlet.inventorySettings })
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .limit(1);

      const defaults = {
        enabled: false,
        autoDeductOn: 'ON_ORDER',
        allowNegativeStock: true,
        lowStockAlerts: true,
        auto86OnDepletion: false,
      };

      const settings = { ...defaults, ...(outlet?.inventorySettings as any) };
      return c.json(settings);
    } finally {
      await close();
    }
  }
);

inventoryRoutes.patch(
  '/settings',
  apiDoc({
    tags: ['Inventory'],
    summary: 'Update Inventory Settings',
    description: 'Enables/disables inventory tracking and updates deduction preferences.',
    responses: {
      200: z.any(),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
    },
  }),
  requirePermission('inventory:write'),
  async (c) => {
    const tenant = c.get('tenant');
    const outletId = c.req.header('x-outlet-id') || c.req.query('outletId') || '';

    if (!outletId) {
      return c.json({ error: 'BadRequest', message: 'x-outlet-id header required' }, 400);
    }

    const body = await c.req.json();
    const parsed = UpdateInventorySettingsSchema.parse(body);

    const { db, close } = getDb(c);
    try {
      const [updated] = await db
        .update(appSchema.restaurantOutlet)
        .set({
          inventorySettings: parsed,
          updatedAt: new Date(),
        })
        .where(eq(appSchema.restaurantOutlet.id, outletId))
        .returning({ inventorySettings: appSchema.restaurantOutlet.inventorySettings });

      return c.json(updated?.inventorySettings || parsed);
    } finally {
      await close();
    }
  }
);
