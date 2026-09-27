import { Hono } from 'hono';
import { relayStore } from '../db';
import { adapterRegistry } from '../adapters';
import { logisticsBroker } from '../logistics/broker';
import { isValidStatusTransition } from '@logixsoft/relay-schema';

export const ordersRouter = new Hono();

// ─── GET /orders ──────────────────────────────────────────────────────────────
ordersRouter.get('/', async (c) => {
  const outletId = c.req.query('outletId');
  const channelCode = c.req.query('channelCode') as any;
  const status = c.req.query('status') as any;

  const orders = await relayStore.listOrders({ outletId, channelCode, status });
  return c.json({ total: orders.length, orders });
});

// ─── GET /orders/:orderId ─────────────────────────────────────────────────────
ordersRouter.get('/:orderId', async (c) => {
  const orderId = c.req.param('orderId');
  const order = await relayStore.getOrderById(orderId);
  if (!order) {
    return c.json({ error: 'Not Found', message: `Order ${orderId} not found` }, 404);
  }

  const audits = await relayStore.getOrderAudits(orderId);
  const dispatch = await relayStore.getLogisticsDispatchByOrderId(orderId);

  return c.json({
    order,
    audits,
    logisticsDispatch: dispatch,
  });
});

// ─── POST /orders/:orderId/accept ─────────────────────────────────────────────
ordersRouter.post('/:orderId/accept', async (c) => {
  const orderId = c.req.param('orderId');
  const body = await c.req.json().catch(() => ({}));
  const prepTimeMinutes = Number(body.prepTimeMinutes || 20);

  const order = await relayStore.getOrderById(orderId);
  if (!order) {
    return c.json({ error: 'Not Found', message: `Order ${orderId} not found` }, 404);
  }

  if (!isValidStatusTransition(order.status, 'ORDER_ACCEPTED')) {
    return c.json(
      { error: 'Invalid Transition', message: `Cannot transition from ${order.status} to ORDER_ACCEPTED` },
      400
    );
  }

  const adapter = adapterRegistry.get(order.channelCode);
  const intg = await relayStore.getOutletIntegration(order.outletId, order.channelCode);

  try {
    await adapter.acceptOrder(order.channelOrderId, prepTimeMinutes, intg?.credentials || {});
    await relayStore.updateOrderStatus(orderId, 'ORDER_ACCEPTED', 'POS_USER', { prepTimeMinutes });
    order.prepTimeMinutes = prepTimeMinutes;

    return c.json({
      success: true,
      orderId,
      status: 'ORDER_ACCEPTED',
      prepTimeMinutes,
      message: `Order accepted on ${order.channelCode}`,
    });
  } catch (err: any) {
    return c.json({ error: 'Channel Error', message: err.message }, 502);
  }
});

// ─── POST /orders/:orderId/reject ─────────────────────────────────────────────
ordersRouter.post('/:orderId/reject', async (c) => {
  const orderId = c.req.param('orderId');
  const body = await c.req.json().catch(() => ({}));
  const reasonCode = body.reasonCode || 'KITCHEN_OVERLOADED';
  const explanation = body.explanation || 'Kitchen unable to fulfill order at this time';

  const order = await relayStore.getOrderById(orderId);
  if (!order) {
    return c.json({ error: 'Not Found', message: `Order ${orderId} not found` }, 404);
  }

  const adapter = adapterRegistry.get(order.channelCode);
  const intg = await relayStore.getOutletIntegration(order.outletId, order.channelCode);

  try {
    await adapter.rejectOrder(order.channelOrderId, reasonCode, intg?.credentials || {});
    await relayStore.updateOrderStatus(orderId, 'CANCELLED', 'POS_USER', {
      reasonCode,
      explanation,
    });

    return c.json({
      success: true,
      orderId,
      status: 'CANCELLED',
      reasonCode,
      message: `Order rejected on ${order.channelCode}`,
    });
  } catch (err: any) {
    return c.json({ error: 'Channel Error', message: err.message }, 502);
  }
});

// ─── POST /orders/:orderId/ready ──────────────────────────────────────────────
ordersRouter.post('/:orderId/ready', async (c) => {
  const orderId = c.req.param('orderId');
  const order = await relayStore.getOrderById(orderId);
  if (!order) {
    return c.json({ error: 'Not Found', message: `Order ${orderId} not found` }, 404);
  }

  const adapter = adapterRegistry.get(order.channelCode);
  const intg = await relayStore.getOutletIntegration(order.outletId, order.channelCode);

  try {
    await adapter.markFoodReady(order.channelOrderId, intg?.credentials || {});
    await relayStore.updateOrderStatus(orderId, 'FOOD_READY', 'KITCHEN_KDS');

    return c.json({
      success: true,
      orderId,
      status: 'FOOD_READY',
      message: `Food marked ready on ${order.channelCode}. Rider alerted.`,
    });
  } catch (err: any) {
    return c.json({ error: 'Channel Error', message: err.message }, 502);
  }
});

// ─── POST /orders/:orderId/dispatch ───────────────────────────────────────────
ordersRouter.post('/:orderId/dispatch', async (c) => {
  const orderId = c.req.param('orderId');
  const body = await c.req.json().catch(() => ({}));
  const riderType = body.riderType || 'CHANNEL';
  const preferredProvider = body.preferredProvider || 'SHADOWFAX';

  const order = await relayStore.getOrderById(orderId);
  if (!order) {
    return c.json({ error: 'Not Found', message: `Order ${orderId} not found` }, 404);
  }

  if (riderType === '3PL') {
    const dispatchResult = await logisticsBroker.dispatch({
      orderId,
      preferredProvider,
    });
    return c.json({
      success: true,
      orderId,
      status: 'DISPATCHED',
      riderType: '3PL',
      dispatch: dispatchResult,
      message: '3PL Rider successfully assigned and dispatched',
    });
  }

  // Channel or In-house rider
  await relayStore.updateOrderStatus(orderId, 'DISPATCHED', 'POS_USER', {
    riderType,
    riderDetails: body.riderDetails,
  });

  return c.json({
    success: true,
    orderId,
    status: 'DISPATCHED',
    riderType,
    message: 'Order dispatched with rider',
  });
});
