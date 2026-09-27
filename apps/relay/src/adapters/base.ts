import type { ChannelAdapter, ChannelCode, SyncResult, CanonicalMenu } from '@logixsoft/relay-schema';

export class AdapterRegistry {
  private adapters = new Map<ChannelCode, ChannelAdapter>();

  public register(adapter: ChannelAdapter) {
    this.adapters.set(adapter.channelCode, adapter);
  }

  public get(channelCode: ChannelCode): ChannelAdapter {
    const adapter = this.adapters.get(channelCode);
    if (!adapter) {
      throw new Error(`No ChannelAdapter registered for code: ${channelCode}`);
    }
    return adapter;
  }

  public has(channelCode: ChannelCode): boolean {
    return this.adapters.has(channelCode);
  }

  public list(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const adapterRegistry = new AdapterRegistry();
