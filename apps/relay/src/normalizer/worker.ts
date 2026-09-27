import { orderQueue, type IngestJob } from '../queue/order-queue';
import { adapterRegistry } from '../adapters';
import { relayStore } from '../db';
import { desktopPosBridge } from '../bridge/desktop-bridge';
import { syncCanonicalOrderToLogixDine } from '../dine/sync-dine';
import type { CanonicalOrder } from '@logixsoft/relay-schema';

export class WorkerNormalizer {
  private isStarted = false;

  public start() {
    if (this.isStarted) return;
    this.isStarted = true;
    orderQueue.registerWorker(this.processJob.bind(this));
  }

  public async processJob(job: IngestJob): Promise<CanonicalOrder | null> {
    const { channelCode, channelOrderId, eventType, rawPayload } = job;

    try {
      const adapter = adapterRegistry.get(channelCode);

      // Handle Rider Status Update or Cancellation vs New Order Placed
      if (eventType === 'RIDER_UPDATE' || eventType === 'STATUS_UPDATE') {
        const existingOrder = await relayStore.getOrderByChannelOrderId(channelCode, channelOrderId);
        if (existingOrder) {
          const rawStatus = rawPayload.status || rawPayload.order_status || 'RIDER_ASSIGNED';
          // Update status
          await relayStore.updateOrderStatus(existingOrder.id, 'RIDER_ASSIGNED', 'RIDER_WEBHOOK', rawPayload);
          return existingOrder;
        }
      }

      if (eventType === 'ORDER_CANCELLED') {
        const existingOrder = await relayStore.getOrderByChannelOrderId(channelCode, channelOrderId);
        if (existingOrder) {
          await relayStore.updateOrderStatus(existingOrder.id, 'CANCELLED', 'CHANNEL_WEBHOOK_CANCEL', rawPayload);
          return existingOrder;
        }
      }

      // Normal order placement
      const canonicalOrder: CanonicalOrder = await adapter.parseOrder(rawPayload);

      // Check outlet integration configuration for auto-accept
      const integration = await relayStore.getOutletIntegration(canonicalOrder.outletId, channelCode);
      if (integration?.autoAcceptOrders) {
        canonicalOrder.status = 'ORDER_ACCEPTED';
        canonicalOrder.acceptedAt = new Date().toISOString();
        try {
          await adapter.acceptOrder(
            canonicalOrder.channelOrderId,
            canonicalOrder.prepTimeMinutes,
            integration.credentials
          );
        } catch (acceptErr) {
          console.error(`[WorkerNormalizer] Auto-accept call failed for ${canonicalOrder.id}:`, acceptErr);
        }
      }

      // Persist order and initial audit in database
      await relayStore.saveOrder(canonicalOrder);

      // Broadcast in real-time to Logix Dine POS, Kitchen Display System (KDS),
      // and Desktop PC app (triggering silent thermal KOT printing and audio chime)
      await syncCanonicalOrderToLogixDine(canonicalOrder, job.env);

      return canonicalOrder;
    } catch (err) {
      console.error(`[WorkerNormalizer] Error processing job ${job.id}:`, err);
      throw err;
    }
  }
}

export const workerNormalizer = new WorkerNormalizer();
// Auto-start worker
workerNormalizer.start();
