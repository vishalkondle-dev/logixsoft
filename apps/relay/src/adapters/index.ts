import { adapterRegistry } from './base';
import { SwiggyAdapter } from './swiggy';
import { ZomatoAdapter } from './zomato';
import { MagicpinAdapter } from './magicpin';
import { OndcBecknAdapter } from './ondc';
import { DirectChannelAdapter } from './direct';

export * from './base';
export * from './swiggy';
export * from './zomato';
export * from './magicpin';
export * from './ondc';
export * from './direct';

export function initializeAdapters() {
  adapterRegistry.register(new SwiggyAdapter());
  adapterRegistry.register(new ZomatoAdapter());
  adapterRegistry.register(new MagicpinAdapter());
  adapterRegistry.register(new OndcBecknAdapter());
  adapterRegistry.register(new DirectChannelAdapter('OWNLY'));
  adapterRegistry.register(new DirectChannelAdapter('TOING'));
}

// Auto-initialize default registry
initializeAdapters();
