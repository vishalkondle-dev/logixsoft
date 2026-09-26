import { eq, and, sql, inArray } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { appSchema } from '../db';

/**
 * Deduct inventory for an order based on recipes of the order's items.
 * Guaranteed to be non-fatal (never fails the parent order transaction).
 */
export async function deductOrderInventory(
  db: any,
  orderId: string,
  outletId: string,
  staffPhone?: string | null
): Promise<void> {
  try {
    // 1. Check if inventory is enabled for this outlet
    const [outlet] = await db
      .select({ inventorySettings: appSchema.restaurantOutlet.inventorySettings })
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, outletId))
      .limit(1);

    const settings = (outlet?.inventorySettings as any) || {};
    if (!settings.enabled) {
      return; // Inventory tracking is disabled for this outlet
    }

    // 2. Fetch the order details
    const [order] = await db
      .select()
      .from(appSchema.saleOrder)
      .where(eq(appSchema.saleOrder.id, orderId))
      .limit(1);

    if (!order) return;

    // 3. Fetch all active (non-cancelled) order items
    const orderItems = await db
      .select()
      .from(appSchema.saleOrderItem)
      .where(
        and(
          eq(appSchema.saleOrderItem.orderId, orderId),
          sql`${appSchema.saleOrderItem.status} != 'CANCELLED'`
        )
      );

    if (orderItems.length === 0) return;

    const menuItemIds = [...new Set(orderItems.map((oi: any) => oi.itemId))];

    // 4. Fetch all recipe ingredients for these menu items
    const recipes = await db
      .select()
      .from(appSchema.menuItemRecipe)
      .where(
        and(
          inArray(appSchema.menuItemRecipe.menuItemId as any, menuItemIds),
          eq(appSchema.menuItemRecipe.restaurantId, order.restaurantId)
        )
      );

    if (recipes.length === 0) return; // None of the ordered items have recipes configured

    // 5. Calculate required ingredient deductions
    // Map: ingredientId -> { qtyToDeduct: number, notes: string[] }
    const ingredientDeductions = new Map<
      string,
      { qtyToDeduct: number; notes: string[] }
    >();

    for (const item of orderItems) {
      const itemRecipes = recipes.filter((r: any) => r.menuItemId === item.itemId);
      if (itemRecipes.length === 0) continue;

      const variantId = (item.variant as any)?.id || null;
      const addonIds: string[] = (item.addons as any[])?.map((a: any) => a.id) || [];

      for (const recipe of itemRecipes) {
        // If recipe is variant-specific, only match if order item variant matches
        if (recipe.variantId && recipe.variantId !== variantId) continue;
        // If recipe is addon-specific, only match if order item has this addon
        if (recipe.addonId && !addonIds.includes(recipe.addonId)) continue;

        // Base recipe quantity with waste loss factor
        const wasteLoss = 1 + (recipe.wastePercent || 0) / 100;
        const totalQty = recipe.quantity * wasteLoss * item.qty;

        const current = ingredientDeductions.get(recipe.ingredientId) || {
          qtyToDeduct: 0,
          notes: [],
        };
        current.qtyToDeduct += totalQty;
        current.notes.push(
          `${item.qty}x ${item.nameSnapshot}${variantId ? ' (' + (item.variant as any)?.name + ')' : ''}`
        );
        ingredientDeductions.set(recipe.ingredientId, current);
      }
    }

    if (ingredientDeductions.size === 0) return;

    // 6. Execute deduction and ledger logging for each ingredient
    for (const [ingredientId, { qtyToDeduct, notes }] of ingredientDeductions.entries()) {
      // Fetch current stock
      const [ing] = await db
        .select({
          id: appSchema.inventoryItem.id,
          name: appSchema.inventoryItem.name,
          currentStock: appSchema.inventoryItem.currentStock,
          costPerBaseUnitPaise: appSchema.inventoryItem.costPerBaseUnitPaise,
        })
        .from(appSchema.inventoryItem)
        .where(eq(appSchema.inventoryItem.id, ingredientId))
        .limit(1);

      if (!ing) continue;

      const newBalance = Math.round((ing.currentStock - qtyToDeduct) * 1000) / 1000;

      // Update current stock
      await db
        .update(appSchema.inventoryItem)
        .set({
          currentStock: newBalance,
          updatedAt: new Date(),
          updatedBy: staffPhone || 'SYSTEM',
        })
        .where(eq(appSchema.inventoryItem.id, ingredientId));

      // Insert ledger entry
      await db.insert(appSchema.inventoryTransaction).values({
        id: generateId('itx'),
        restaurantId: order.restaurantId,
        outletId,
        ingredientId,
        type: 'ORDER_CONSUMPTION',
        quantity: -qtyToDeduct,
        balanceAfter: newBalance,
        unitCostPaise: ing.costPerBaseUnitPaise,
        referenceId: orderId,
        referenceNote: `Order #${order.orderNo}: ${notes.slice(0, 3).join(', ')}`,
        createdAt: new Date(),
        createdBy: staffPhone || 'SYSTEM',
      });
    }
  } catch (err: any) {
    // Non-fatal: log error but allow order to complete without crashing
    console.error('[InventoryDeduction] Error auto-deducting order stock:', err?.message || err);
  }
}

/**
 * Restore inventory when an order item is cancelled before kitchen prep.
 */
export async function restoreOrderItemInventory(
  db: any,
  orderItemId: string,
  staffPhone?: string | null
): Promise<void> {
  try {
    const [item] = await db
      .select()
      .from(appSchema.saleOrderItem)
      .where(eq(appSchema.saleOrderItem.id, orderItemId))
      .limit(1);

    if (!item) return;

    const [order] = await db
      .select()
      .from(appSchema.saleOrder)
      .where(eq(appSchema.saleOrder.id, item.orderId))
      .limit(1);

    if (!order) return;

    // Check outlet settings
    const [outlet] = await db
      .select({ inventorySettings: appSchema.restaurantOutlet.inventorySettings })
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, order.outletId))
      .limit(1);

    const settings = (outlet?.inventorySettings as any) || {};
    if (!settings.enabled) return;

    // Fetch recipes for this item
    const recipes = await db
      .select()
      .from(appSchema.menuItemRecipe)
      .where(
        and(
          eq(appSchema.menuItemRecipe.menuItemId, item.itemId),
          eq(appSchema.menuItemRecipe.restaurantId, order.restaurantId)
        )
      );

    if (recipes.length === 0) return;

    const variantId = (item.variant as any)?.id || null;
    const addonIds: string[] = (item.addons as any[])?.map((a: any) => a.id) || [];

    for (const recipe of recipes) {
      if (recipe.variantId && recipe.variantId !== variantId) continue;
      if (recipe.addonId && !addonIds.includes(recipe.addonId)) continue;

      const wasteLoss = 1 + (recipe.wastePercent || 0) / 100;
      const totalQtyToRestore = recipe.quantity * wasteLoss * item.qty;

      const [ing] = await db
        .select()
        .from(appSchema.inventoryItem)
        .where(eq(appSchema.inventoryItem.id, recipe.ingredientId))
        .limit(1);

      if (!ing) continue;

      const newBalance = Math.round((ing.currentStock + totalQtyToRestore) * 1000) / 1000;

      await db
        .update(appSchema.inventoryItem)
        .set({
          currentStock: newBalance,
          updatedAt: new Date(),
          updatedBy: staffPhone || 'SYSTEM',
        })
        .where(eq(appSchema.inventoryItem.id, recipe.ingredientId));

      await db.insert(appSchema.inventoryTransaction).values({
        id: generateId('itx'),
        restaurantId: order.restaurantId,
        outletId: order.outletId,
        ingredientId: recipe.ingredientId,
        type: 'ORDER_RESTORE',
        quantity: totalQtyToRestore,
        balanceAfter: newBalance,
        unitCostPaise: ing.costPerBaseUnitPaise,
        referenceId: item.orderId,
        referenceNote: `Cancelled Item: ${item.nameSnapshot} (#${order.orderNo})`,
        createdAt: new Date(),
        createdBy: staffPhone || 'SYSTEM',
      });
    }
  } catch (err: any) {
    console.error('[InventoryRestore] Error restoring cancelled item stock:', err?.message || err);
  }
}
