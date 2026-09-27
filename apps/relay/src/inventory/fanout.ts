import { relayStore } from '../db';
import { adapterRegistry } from '../adapters';
import { config } from '../config';
import type { ChannelCode } from '@logixsoft/relay-schema';

export interface ChannelStockUpdateResult {
  channelCode: ChannelCode;
  success: boolean;
  latencyMs: number;
  error?: string;
}

export interface FanOutStockResult {
  outletId: string;
  itemId: string;
  inStock: boolean;
  totalChannels: number;
  successfulChannels: number;
  totalLatencyMs: number;
  completedWithinSla: boolean; // SLA < 1500ms
  channelResults: ChannelStockUpdateResult[];
}

/**
 * Fires parallel sub-second stockout (86'ing) updates to all active aggregator channels.
 * Strict SLA: Must complete in <1500ms.
 */
export async function updateItemStockFanOut(params: {
  outletId: string;
  itemId: string;
  inStock: boolean;
}): Promise<FanOutStockResult> {
  const startTime = performance.now();
  const { outletId, itemId, inStock } = params;

  // 1. Fetch all active integrations for this restaurant outlet
  let integrations = await relayStore.listOutletIntegrations(outletId);
  if (integrations.length === 0) {
    // Fallback to all registered adapters with default dummy credentials
    integrations = adapterRegistry.list().map((a) => ({
      outletId,
      channelCode: a.channelCode,
      credentials: {},
    }));
  }

  // 2. Fire parallel updates using Promise.allSettled with per-channel timeout
  const timeoutMs = config.fanoutTimeoutMs || 1500;

  const updatePromises = integrations.map(async (intg): Promise<ChannelStockUpdateResult> => {
    const chStart = performance.now();
    const channelCode = intg.channelCode as ChannelCode;

    try {
      const adapter = adapterRegistry.get(channelCode);

      // Wrap individual adapter call in a timeout promise
      const callPromise = adapter.updateItemStock(outletId, itemId, inStock, intg.credentials);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Channel timeout exceeded')), timeoutMs)
      );

      const success = await Promise.race([callPromise, timeoutPromise]);
      const latencyMs = Number((performance.now() - chStart).toFixed(2));

      return {
        channelCode,
        success: Boolean(success),
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Number((performance.now() - chStart).toFixed(2));
      return {
        channelCode,
        success: false,
        latencyMs,
        error: err.message || 'Unknown stock update error',
      };
    }
  });

  const results = await Promise.allSettled(updatePromises);
  const totalLatencyMs = Number((performance.now() - startTime).toFixed(2));

  const channelResults: ChannelStockUpdateResult[] = results.map((r, idx) => {
    if (r.status === 'fulfilled') {
      return r.value;
    }
    return {
      channelCode: integrations[idx].channelCode as ChannelCode,
      success: false,
      latencyMs: totalLatencyMs,
      error: r.reason?.message || 'Rejected',
    };
  });

  const successfulChannels = channelResults.filter((c) => c.success).length;

  return {
    outletId,
    itemId,
    inStock,
    totalChannels: channelResults.length,
    successfulChannels,
    totalLatencyMs,
    completedWithinSla: totalLatencyMs <= timeoutMs,
    channelResults,
  };
}
