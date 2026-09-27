import { relayStore } from '../db';
import { adapterRegistry } from '../adapters';
import type { ChannelCode } from '@logixsoft/relay-schema';

export interface StoreStatusUpdateResult {
  channelCode: ChannelCode;
  success: boolean;
  isOnline: boolean;
  error?: string;
}

export interface StorePauseResult {
  outletId: string;
  isOnline: boolean;
  reason?: string;
  durationMinutes?: number;
  totalChannels: number;
  successfulChannels: number;
  channelResults: StoreStatusUpdateResult[];
}

/**
 * Toggles store status (online/paused) across all integrated delivery aggregator channels simultaneously.
 */
export async function updateStoreStatusFanOut(params: {
  outletId: string;
  isOnline: boolean;
  reason?: string;
  durationMinutes?: number;
}): Promise<StorePauseResult> {
  const { outletId, isOnline, reason, durationMinutes } = params;

  let integrations = await relayStore.listOutletIntegrations(outletId);
  if (integrations.length === 0) {
    integrations = adapterRegistry.list().map((a) => ({
      outletId,
      channelCode: a.channelCode,
      credentials: {},
    }));
  }

  const updatePromises = integrations.map(async (intg): Promise<StoreStatusUpdateResult> => {
    const channelCode = intg.channelCode as ChannelCode;
    try {
      const adapter = adapterRegistry.get(channelCode);
      const ok = await adapter.updateStoreStatus(outletId, isOnline, intg.credentials);

      // Update store DB record
      await relayStore.updateOutletStoreStatus(outletId, channelCode, isOnline);

      return {
        channelCode,
        success: Boolean(ok),
        isOnline,
      };
    } catch (err: any) {
      return {
        channelCode,
        success: false,
        isOnline: !isOnline,
        error: err.message,
      };
    }
  });

  const channelResults = await Promise.all(updatePromises);
  const successfulChannels = channelResults.filter((c) => c.success).length;

  return {
    outletId,
    isOnline,
    reason,
    durationMinutes,
    totalChannels: channelResults.length,
    successfulChannels,
    channelResults,
  };
}
