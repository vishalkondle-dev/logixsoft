import process from 'node:process';
import {
  relayChannels,
  relayOutletIntegrations,
  relayMenus,
  relayOrders,
  relayOrderAudits,
  relayLogisticsDispatches,
  relaySettlements,
  type ChannelCode,
  type CanonicalOrder,
  type OutletCatalog,
  type NormalizedOrderStatus,
} from '@logixsoft/relay-schema';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient } from '@logixsoft/helpers/db';
import { encryptJson, decryptJson } from '../crypto/aes';
import { DrizzleRelayStore } from './drizzle-store';

/**
 * Universal Store interface for Logix Relay persistence.
 */
export interface RelayStore {
  // Channels
  getChannel(code: ChannelCode): Promise<any | null>;
  listChannels(): Promise<any[]>;
  saveChannel(channel: { id: string; code: ChannelCode; name: string; isActive: boolean }): Promise<void>;

  // Outlet Integrations
  getOutletIntegration(outletId: string, channelCode: ChannelCode): Promise<any | null>;
  listOutletIntegrations(outletId: string): Promise<any[]>;
  saveOutletIntegration(integration: {
    id?: string;
    outletId: string;
    channelCode: ChannelCode;
    merchantStoreId: string;
    credentials: any;
    isOnline?: boolean;
    autoAcceptOrders?: boolean;
    defaultPrepMinutes?: number;
    channelPriceMarkupPercent?: number;
  }): Promise<any>;
  updateOutletStoreStatus(outletId: string, channelCode: ChannelCode, isOnline: boolean): Promise<boolean>;

  // Menus
  getOutletMenu(outletId: string): Promise<OutletCatalog | null>;
  saveOutletMenu(outletId: string, name: string, catalog: OutletCatalog): Promise<void>;

  // Orders
  getOrderById(orderId: string): Promise<CanonicalOrder | null>;
  getOrderByChannelOrderId(channelCode: ChannelCode, channelOrderId: string): Promise<CanonicalOrder | null>;
  listOrders(filters?: { outletId?: string; channelCode?: ChannelCode; status?: NormalizedOrderStatus }): Promise<CanonicalOrder[]>;
  saveOrder(order: CanonicalOrder): Promise<void>;
  updateOrderStatus(orderId: string, newStatus: NormalizedOrderStatus, triggeredBy: string, meta?: any): Promise<boolean>;

  // Order Audits
  getOrderAudits(orderId: string): Promise<any[]>;
  addOrderAudit(orderId: string, fromStatus: string, toStatus: string, triggeredBy: string, meta?: any): Promise<void>;

  // Logistics Dispatches
  saveLogisticsDispatch(dispatch: {
    id?: string;
    orderId: string;
    providerCode: string;
    waybillNumber: string;
    feeAmount: number;
    riderName?: string;
    riderPhone?: string;
    trackingUrl?: string;
    status: string;
  }): Promise<any>;
  getLogisticsDispatchByOrderId(orderId: string): Promise<any | null>;
  getLogisticsDispatchByWaybill(waybillNumber: string): Promise<any | null>;
  updateLogisticsStatus(waybillNumber: string, status: string, riderMeta?: any): Promise<boolean>;

  // Settlements
  saveSettlement(settlement: any): Promise<any>;
  listSettlements(outletId?: string): Promise<any[]>;
  getSettlementDiscrepancies(outletId?: string): Promise<any[]>;
}

/**
 * In-memory high performance implementation of RelayStore for edge, tests, and zero-latency ops.
 */
export class MemoryRelayStore implements RelayStore {
  private channels = new Map<string, any>();
  private outletIntegrations = new Map<string, any>(); // key: `${outletId}:${channelCode}`
  private menus = new Map<string, any>(); // key: outletId
  private orders = new Map<string, CanonicalOrder>(); // key: id
  private channelOrderLookup = new Map<string, string>(); // key: `${channelCode}:${channelOrderId}` -> orderId
  private orderAudits: any[] = [];
  private dispatches = new Map<string, any>(); // key: id
  private waybillLookup = new Map<string, string>(); // key: waybill -> dispatchId
  private settlements = new Map<string, any>();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const defaultChannels = [
      { id: 'chan_swiggy', code: 'SWIGGY', name: 'Swiggy POS Partner', isActive: true, createdAt: new Date() },
      { id: 'chan_zomato', code: 'ZOMATO', name: 'Zomato Food Partner v2', isActive: true, createdAt: new Date() },
      { id: 'chan_magicpin', code: 'MAGICPIN', name: 'Magicpin Delivery Hub', isActive: true, createdAt: new Date() },
      { id: 'chan_ondc', code: 'ONDC', name: 'ONDC Beckn Protocol v1.2', isActive: true, createdAt: new Date() },
      { id: 'chan_ownly', code: 'OWNLY', name: 'Ownly Direct Portal', isActive: true, createdAt: new Date() },
      { id: 'chan_toing', code: 'TOING', name: 'Toing Voice & Direct', isActive: true, createdAt: new Date() },
    ];

    for (const ch of defaultChannels) {
      this.channels.set(ch.code, ch);
    }

    const defaultOutletId = 'outlet_default';
    const defaultIntegrations = [
      {
        outletId: defaultOutletId,
        channelCode: 'SWIGGY',
        merchantStoreId: 'swiggy_rest_94821',
        credentials: {
          isLive: false,
          apiKey: 'swiggy_pos_key_test_7788',
          apiSecret: 'swiggy_webhook_secret_xyz123',
          webhookSecret: 'swiggy_webhook_secret_xyz123',
          baseUrl: 'https://api.swiggy.com',
        },
        isOnline: true,
        autoAcceptOrders: false,
        defaultPrepMinutes: 20,
        channelPriceMarkupPercent: 15.0,
      },
      {
        outletId: defaultOutletId,
        channelCode: 'ZOMATO',
        merchantStoreId: 'zomato_res_55123',
        credentials: {
          isLive: false,
          apiKey: 'zomato_partner_v2_key_8899',
          apiSecret: 'zomato_webhook_secret_abc456',
          webhookSecret: 'zomato_webhook_secret_abc456',
          baseUrl: 'https://api.zomato.com',
        },
        isOnline: true,
        autoAcceptOrders: false,
        defaultPrepMinutes: 25,
        channelPriceMarkupPercent: 20.0,
      },
      {
        outletId: defaultOutletId,
        channelCode: 'MAGICPIN',
        merchantStoreId: 'magicpin_store_3321',
        credentials: {
          isLive: false,
          apiKey: 'magicpin_api_key_5544',
          apiSecret: 'magicpin_secret_7711',
          webhookSecret: 'magicpin_secret_7711',
          baseUrl: 'https://api.magicpin.in',
        },
        isOnline: true,
        autoAcceptOrders: false,
        defaultPrepMinutes: 20,
        channelPriceMarkupPercent: 10.0,
      },
      {
        outletId: defaultOutletId,
        channelCode: 'ONDC',
        merchantStoreId: 'ondc_bpp_seller_001',
        credentials: {
          subscriberId: 'bpp.logixsoft.in',
          uniqueKeyId: 'key-1',
          bppUri: 'https://relay.logixsoft.in/onboard/beckn/bpp',
        },
        isOnline: true,
        autoAcceptOrders: true,
        defaultPrepMinutes: 15,
        channelPriceMarkupPercent: 0.0,
      },
      {
        outletId: defaultOutletId,
        channelCode: 'OWNLY',
        merchantStoreId: 'ownly_store_101',
        credentials: {
          apiKey: 'ownly_api_key_direct_991',
          webhookSecret: 'ownly_secret_991',
        },
        isOnline: true,
        autoAcceptOrders: true,
        defaultPrepMinutes: 15,
        channelPriceMarkupPercent: 0.0,
      },
      {
        outletId: defaultOutletId,
        channelCode: 'TOING',
        merchantStoreId: 'toing_agent_202',
        credentials: {
          apiKey: 'toing_voice_api_key_882',
          webhookSecret: 'toing_secret_882',
        },
        isOnline: true,
        autoAcceptOrders: true,
        defaultPrepMinutes: 15,
        channelPriceMarkupPercent: 0.0,
      },
    ];

    for (const intg of defaultIntegrations) {
      this.outletIntegrations.set(`${intg.outletId}:${intg.channelCode}`, {
        id: `intg_${intg.channelCode.toLowerCase()}`,
        ...intg,
        credentials: intg.credentials,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const defaultCatalog = {
      outletId: defaultOutletId,
      name: 'Logix Dine Kitchen',
      operatingHours: [],
      categories: [
        {
          id: 'cat_mains',
          name: 'Main Courses',
          items: [
            {
              id: 'dish_biryani_01',
              name: 'Hyderabadi Dum Biryani',
              price: 320,
              isVeg: false,
              inStock: true,
            },
          ],
        },
      ],
    };
    this.menus.set(defaultOutletId, defaultCatalog);
  }

  async getChannel(code: ChannelCode) {
    return this.channels.get(code) || null;
  }

  async listChannels() {
    return Array.from(this.channels.values());
  }

  async saveChannel(ch: { id: string; code: ChannelCode; name: string; isActive: boolean }) {
    this.channels.set(ch.code, { ...ch, createdAt: new Date() });
  }

  async getOutletIntegration(outletId: string, channelCode: ChannelCode) {
    const key = `${outletId}:${channelCode}`;
    const row = this.outletIntegrations.get(key);
    if (!row) return null;
    return {
      ...row,
      credentials: row.credentials || (row.credentialsEncrypted ? decryptJson(row.credentialsEncrypted) : {}),
    };
  }

  async listOutletIntegrations(outletId: string) {
    const result: any[] = [];
    for (const [key, val] of this.outletIntegrations.entries()) {
      if (key.startsWith(`${outletId}:`)) {
        result.push({
          ...val,
          credentials: val.credentials || (val.credentialsEncrypted ? decryptJson(val.credentialsEncrypted) : {}),
        });
      }
    }
    return result;
  }

  async saveOutletIntegration(data: {
    id?: string;
    outletId: string;
    channelCode: ChannelCode;
    merchantStoreId: string;
    credentials: any;
    isOnline?: boolean;
    autoAcceptOrders?: boolean;
    defaultPrepMinutes?: number;
    channelPriceMarkupPercent?: number;
  }) {
    const id = data.id || generateId('intg');
    const key = `${data.outletId}:${data.channelCode}`;
    const existing = this.outletIntegrations.get(key);

    const record = {
      id,
      outletId: data.outletId,
      channelCode: data.channelCode,
      merchantStoreId: data.merchantStoreId || existing?.merchantStoreId || `store_${data.channelCode.toLowerCase()}`,
      credentials: data.credentials,
      isOnline: data.isOnline ?? existing?.isOnline ?? true,
      autoAcceptOrders: data.autoAcceptOrders ?? existing?.autoAcceptOrders ?? false,
      defaultPrepMinutes: data.defaultPrepMinutes ?? existing?.defaultPrepMinutes ?? 20,
      channelPriceMarkupPercent: data.channelPriceMarkupPercent ?? existing?.channelPriceMarkupPercent ?? 0.0,
      updatedAt: new Date(),
    };

    this.outletIntegrations.set(key, record);
    return { ...record };
  }

  async updateOutletStoreStatus(outletId: string, channelCode: ChannelCode, isOnline: boolean) {
    const key = `${outletId}:${channelCode}`;
    const existing = this.outletIntegrations.get(key);
    if (!existing) return false;
    existing.isOnline = isOnline;
    existing.updatedAt = new Date();
    this.outletIntegrations.set(key, existing);
    return true;
  }

  async getOutletMenu(outletId: string): Promise<OutletCatalog | null> {
    const menuRow = this.menus.get(outletId);
    return menuRow ? menuRow.catalogDataJson : null;
  }

  async saveOutletMenu(outletId: string, name: string, catalog: OutletCatalog) {
    const existing = this.menus.get(outletId);
    const version = existing ? existing.version + 1 : 1;
    this.menus.set(outletId, {
      id: generateId('menu'),
      outletId,
      version,
      name,
      catalogDataJson: catalog,
      lastSyncedAt: new Date(),
    });
  }

  async getOrderById(orderId: string): Promise<CanonicalOrder | null> {
    return this.orders.get(orderId) || null;
  }

  async getOrderByChannelOrderId(channelCode: ChannelCode, channelOrderId: string): Promise<CanonicalOrder | null> {
    const orderId = this.channelOrderLookup.get(`${channelCode}:${channelOrderId}`);
    if (!orderId) return null;
    return this.orders.get(orderId) || null;
  }

  async listOrders(filters?: { outletId?: string; channelCode?: ChannelCode; status?: NormalizedOrderStatus }) {
    let list = Array.from(this.orders.values());
    if (filters?.outletId) {
      list = list.filter((o) => o.outletId === filters.outletId);
    }
    if (filters?.channelCode) {
      list = list.filter((o) => o.channelCode === filters.channelCode);
    }
    if (filters?.status) {
      list = list.filter((o) => o.status === filters.status);
    }
    return list.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  }

  async saveOrder(order: CanonicalOrder) {
    const isNew = !this.orders.has(order.id);
    this.orders.set(order.id, order);
    this.channelOrderLookup.set(`${order.channelCode}:${order.channelOrderId}`, order.id);

    if (isNew) {
      await this.addOrderAudit(order.id, 'NONE', order.status, 'INGESTION', {
        channelCode: order.channelCode,
        channelOrderId: order.channelOrderId,
      });
    }
  }

  async updateOrderStatus(orderId: string, newStatus: NormalizedOrderStatus, triggeredBy: string, meta?: any) {
    const order = this.orders.get(orderId);
    if (!order) return false;

    const fromStatus = order.status;
    order.status = newStatus;

    if (newStatus === 'ORDER_ACCEPTED') order.acceptedAt = new Date().toISOString();
    if (newStatus === 'FOOD_READY') order.readyAt = new Date().toISOString();
    if (newStatus === 'DISPATCHED') order.dispatchedAt = new Date().toISOString();
    if (newStatus === 'DELIVERED') order.deliveredAt = new Date().toISOString();
    if (newStatus === 'CANCELLED') order.cancelledAt = new Date().toISOString();

    this.orders.set(orderId, order);
    await this.addOrderAudit(orderId, fromStatus, newStatus, triggeredBy, meta);
    return true;
  }

  async getOrderAudits(orderId: string) {
    return this.orderAudits.filter((a) => a.orderId === orderId);
  }

  async addOrderAudit(orderId: string, fromStatus: string, toStatus: string, triggeredBy: string, meta?: any) {
    this.orderAudits.push({
      id: generateId('audit'),
      orderId,
      fromStatus,
      toStatus,
      triggeredBy,
      metaJson: meta,
      timestamp: new Date(),
    });
  }

  async saveLogisticsDispatch(dispatch: {
    id?: string;
    orderId: string;
    providerCode: string;
    waybillNumber: string;
    feeAmount: number;
    riderName?: string;
    riderPhone?: string;
    trackingUrl?: string;
    status: string;
  }) {
    const id = dispatch.id || generateId('disp');
    const record = {
      ...dispatch,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.dispatches.set(id, record);
    this.waybillLookup.set(dispatch.waybillNumber, id);
    return record;
  }

  async getLogisticsDispatchByOrderId(orderId: string) {
    for (const d of this.dispatches.values()) {
      if (d.orderId === orderId) return d;
    }
    return null;
  }

  async getLogisticsDispatchByWaybill(waybillNumber: string) {
    const dispatchId = this.waybillLookup.get(waybillNumber);
    if (!dispatchId) return null;
    return this.dispatches.get(dispatchId) || null;
  }

  async updateLogisticsStatus(waybillNumber: string, status: string, riderMeta?: any) {
    const dispatchId = this.waybillLookup.get(waybillNumber);
    if (!dispatchId) return false;
    const existing = this.dispatches.get(dispatchId);
    if (!existing) return false;

    existing.status = status;
    if (riderMeta?.riderName) existing.riderName = riderMeta.riderName;
    if (riderMeta?.riderPhone) existing.riderPhone = riderMeta.riderPhone;
    if (riderMeta?.trackingUrl) existing.trackingUrl = riderMeta.trackingUrl;
    existing.updatedAt = new Date();

    this.dispatches.set(dispatchId, existing);
    return true;
  }

  async saveSettlement(settlement: any) {
    const id = settlement.id || generateId('stl');
    const record = { ...settlement, id, createdAt: new Date() };
    this.settlements.set(id, record);
    return record;
  }

  async listSettlements(outletId?: string) {
    const list = Array.from(this.settlements.values());
    if (outletId) {
      return list.filter((s) => s.outletId === outletId);
    }
    return list;
  }

  async getSettlementDiscrepancies(outletId?: string) {
    const list = Array.from(this.settlements.values()).filter(
      (s) => s.reconciliationStatus === 'DISCREPANCIES_DETECTED' || (s.discrepancyAmount && s.discrepancyAmount > 0)
    );
    if (outletId) {
      return list.filter((s) => s.outletId === outletId);
    }
    return list;
  }
}

let cachedDrizzleStore: DrizzleRelayStore | null = null;
const memoryStore = new MemoryRelayStore();

/**
 * Resolves the appropriate RelayStore based on the active runtime environment.
 * If Cloudflare Hyperdrive or DATABASE_URL is available, returns a high-performance Drizzle PostgreSQL store.
 * Otherwise, falls back to MemoryRelayStore for local testing.
 */
export function getRelayStore(c?: any): RelayStore {
  const url =
    c?.env?.HYPERDRIVE?.connectionString ||
    c?.env?.DATABASE_URL ||
    (typeof process !== 'undefined' ? process.env?.DATABASE_URL : undefined);

  if (!url) {
    return memoryStore;
  }

  if (!cachedDrizzleStore) {
    const { db } = createDbWithClient({
      connectionString: url,
      schema: {
        relayChannels,
        relayOutletIntegrations,
        relayMenus,
        relayOrders,
        relayOrderAudits,
        relayLogisticsDispatches,
        relaySettlements,
      },
      maxConnections: 1,
    });
    cachedDrizzleStore = new DrizzleRelayStore(db);
  }

  return cachedDrizzleStore;
}

// Global store proxy for Relay gateway that dynamically resolves to Hyperdrive/Postgres or Memory
export const relayStore: RelayStore = new Proxy({} as RelayStore, {
  get(_target, prop) {
    const store = getRelayStore();
    const val = (store as any)[prop];
    return typeof val === 'function' ? val.bind(store) : val;
  },
});

