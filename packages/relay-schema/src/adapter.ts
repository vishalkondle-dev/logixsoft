import type { ChannelCode } from './channels';
import type { CanonicalOrder } from './orders';
import type { OutletCatalog, Item, Category } from './menu';

export type CanonicalMenu = OutletCatalog;

export interface SyncResult {
  success: boolean;
  channelCode: ChannelCode;
  outletId: string;
  itemsSynced: number;
  categoriesSynced: number;
  errors?: string[];
  externalCatalogId?: string;
  timestamp: string;
}

export interface ChannelCredentials {
  apiKey?: string;
  apiSecret?: string;
  merchantStoreId?: string;
  webhookSecret?: string;
  baseUrl?: string;
  authToken?: string;
  // ONDC Ed25519 Keys
  signingPrivateKey?: string;
  signingPublicKey?: string;
  subscriberId?: string;
  uniqueKeyId?: string;
  [key: string]: any;
}

export interface ChannelAdapter {
  readonly channelCode: ChannelCode;

  /**
   * Verifies authenticity of inbound webhook (HMAC-SHA256, Ed25519, or token).
   */
  verifyWebhook(req: Request, rawBody: string, secret: string): Promise<boolean>;

  /**
   * Translates incoming platform-specific order payload into the Canonical Universal Order schema.
   */
  parseOrder(rawPayload: any): Promise<CanonicalOrder>;

  /**
   * Outbound command: Confirms / accepts an order with kitchen preparation time.
   */
  acceptOrder(channelOrderId: string, prepTimeMinutes: number, credentials: any): Promise<boolean>;

  /**
   * Outbound command: Rejects or cancels an order with a standardized reason code.
   */
  rejectOrder(channelOrderId: string, reasonCode: string, credentials: any): Promise<boolean>;

  /**
   * Outbound command: Marks food as prepared/ready and alerts delivery fleet/rider.
   */
  markFoodReady(channelOrderId: string, credentials: any): Promise<boolean>;

  /**
   * Outbound command: Publishes entire restaurant catalog/menu to the channel.
   */
  publishMenu(outletId: string, menu: CanonicalMenu, credentials: any): Promise<SyncResult>;

  /**
   * Outbound command: Toggles item availability (86'ing out-of-stock) in sub-second SLA.
   */
  updateItemStock(outletId: string, itemId: string, inStock: boolean, credentials: any): Promise<boolean>;

  /**
   * Outbound command: Temporarily pauses or enables incoming orders for the store.
   */
  updateStoreStatus(outletId: string, isOnline: boolean, credentials: any): Promise<boolean>;
}
