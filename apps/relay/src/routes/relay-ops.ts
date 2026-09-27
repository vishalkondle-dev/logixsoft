import { Hono } from 'hono';
import { updateItemStockFanOut } from '../inventory/fanout';
import { updateStoreStatusFanOut } from '../inventory/store-pause';

export const relayOpsRouter = new Hono();

/**
 * Sub-Second Inventory Fan-Out:
 * POST /relay/inventory/item-status with { outletId, itemId, isInStock }
 * Looks up all active channel integrations and fires parallel update requests
 * to Swiggy, Zomato, Magicpin, and ONDC simultaneously with SLA < 1500ms.
 */
relayOpsRouter.post('/inventory/item-status', async (c) => {
  const body = await c.req.json();
  const outletId = body.outletId || 'outlet_default';
  const itemId = body.itemId;
  const isInStock = body.isInStock !== undefined ? Boolean(body.isInStock) : Boolean(body.inStock);

  if (!itemId) {
    return c.json({ error: 'Bad Request', message: 'itemId is required' }, 400);
  }

  const result = await updateItemStockFanOut({
    outletId,
    itemId,
    inStock: isInStock,
  });

  return c.json(
    {
      ...result,
      message: `Item stock fan-out completed across ${result.successfulChannels}/${result.totalChannels} channels in ${result.totalLatencyMs}ms`,
    },
    result.completedWithinSla ? 200 : 207
  );
});

/**
 * Rush-Hour Store Pause:
 * POST /relay/store/status with { outletId, isOnline, reason, durationMinutes }
 * Temporarily toggles orders off across all platforms with a single click during kitchen surges.
 */
relayOpsRouter.post('/store/status', async (c) => {
  const body = await c.req.json();
  const outletId = body.outletId || 'outlet_default';
  const isOnline = Boolean(body.isOnline);
  const reason = body.reason || (isOnline ? 'Store open for orders' : 'Kitchen surge / Rush-hour pause');
  const durationMinutes = body.durationMinutes ? Number(body.durationMinutes) : undefined;

  const result = await updateStoreStatusFanOut({
    outletId,
    isOnline,
    reason,
    durationMinutes,
  });

  return c.json({
    ...result,
    message: isOnline
      ? 'Store online across all active channels'
      : `Store paused across all active channels (${reason})`,
  });
});
