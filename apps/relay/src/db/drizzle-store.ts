import {
  eq,
  and,
  desc,
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
import { encryptJson, decryptJson } from '../crypto/aes';
import type { RelayStore } from './index';

export class DrizzleRelayStore implements RelayStore {
  constructor(private db: any) {}

  // ─── Channels ─────────────────────────────────────────────────────────────
  async getChannel(code: ChannelCode) {
    const [row] = await this.db
      .select()
      .from(relayChannels)
      .where(eq(relayChannels.code, code))
      .limit(1);
    return row || null;
  }

  async listChannels() {
    return this.db.select().from(relayChannels);
  }

  async saveChannel(channel: { id: string; code: ChannelCode; name: string; isActive: boolean }) {
    await this.db
      .insert(relayChannels)
      .values(channel)
      .onConflictDoUpdate({
        target: relayChannels.code,
        set: { name: channel.name, isActive: channel.isActive },
      });
  }

  // ─── Outlet Integrations ──────────────────────────────────────────────────
  async getOutletIntegration(outletId: string, channelCode: ChannelCode) {
    const [row] = await this.db
      .select()
      .from(relayOutletIntegrations)
      .where(
        and(
          eq(relayOutletIntegrations.outletId, outletId),
          eq(relayOutletIntegrations.channelCode, channelCode)
        )
      )
      .limit(1);

    if (!row) return null;
    return {
      ...row,
      credentials: decryptJson(row.credentialsEncrypted),
    };
  }

  async listOutletIntegrations(outletId: string) {
    const rows = await this.db
      .select()
      .from(relayOutletIntegrations)
      .where(eq(relayOutletIntegrations.outletId, outletId));

    return rows.map((r: any) => ({
      ...r,
      credentials: decryptJson(r.credentialsEncrypted),
    }));
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
    const encrypted = encryptJson(data.credentials);

    const record = {
      id,
      outletId: data.outletId,
      channelCode: data.channelCode,
      merchantStoreId: data.merchantStoreId,
      credentialsEncrypted: encrypted,
      isOnline: data.isOnline ?? true,
      autoAcceptOrders: data.autoAcceptOrders ?? false,
      defaultPrepMinutes: data.defaultPrepMinutes ?? 20,
      channelPriceMarkupPercent: data.channelPriceMarkupPercent ?? 0.0,
      updatedAt: new Date(),
    };

    await this.db
      .insert(relayOutletIntegrations)
      .values(record)
      .onConflictDoUpdate({
        target: [relayOutletIntegrations.outletId, relayOutletIntegrations.channelCode],
        set: {
          merchantStoreId: record.merchantStoreId,
          credentialsEncrypted: record.credentialsEncrypted,
          isOnline: record.isOnline,
          autoAcceptOrders: record.autoAcceptOrders,
          defaultPrepMinutes: record.defaultPrepMinutes,
          channelPriceMarkupPercent: record.channelPriceMarkupPercent,
          updatedAt: record.updatedAt,
        },
      });

    return { ...record, credentials: data.credentials };
  }

  async updateOutletStoreStatus(outletId: string, channelCode: ChannelCode, isOnline: boolean) {
    const result = await this.db
      .update(relayOutletIntegrations)
      .set({ isOnline, updatedAt: new Date() })
      .where(
        and(
          eq(relayOutletIntegrations.outletId, outletId),
          eq(relayOutletIntegrations.channelCode, channelCode)
        )
      );
    return Boolean(result);
  }

  // ─── Menus ────────────────────────────────────────────────────────────────
  async getOutletMenu(outletId: string): Promise<OutletCatalog | null> {
    const [row] = await this.db
      .select()
      .from(relayMenus)
      .where(eq(relayMenus.outletId, outletId))
      .orderBy(desc(relayMenus.version))
      .limit(1);

    return row ? (row.catalogDataJson as OutletCatalog) : null;
  }

  async saveOutletMenu(outletId: string, name: string, catalog: OutletCatalog) {
    const current = await this.getOutletMenu(outletId);
    const version = current ? 2 : 1;

    await this.db.insert(relayMenus).values({
      id: generateId('menu'),
      outletId,
      version,
      name,
      catalogDataJson: catalog,
      lastSyncedAt: new Date(),
    });
  }

  // ─── Orders ───────────────────────────────────────────────────────────────
  async getOrderById(orderId: string): Promise<CanonicalOrder | null> {
    const [row] = await this.db
      .select()
      .from(relayOrders)
      .where(eq(relayOrders.id, orderId))
      .limit(1);

    if (!row) return null;
    return this.mapOrderRow(row);
  }

  async getOrderByChannelOrderId(channelCode: ChannelCode, channelOrderId: string): Promise<CanonicalOrder | null> {
    const [row] = await this.db
      .select()
      .from(relayOrders)
      .where(
        and(
          eq(relayOrders.channelCode, channelCode),
          eq(relayOrders.channelOrderId, channelOrderId)
        )
      )
      .limit(1);

    if (!row) return null;
    return this.mapOrderRow(row);
  }

  async listOrders(filters?: { outletId?: string; channelCode?: ChannelCode; status?: NormalizedOrderStatus }) {
    let query = this.db.select().from(relayOrders);
    const conditions = [];

    if (filters?.outletId) conditions.push(eq(relayOrders.outletId, filters.outletId));
    if (filters?.channelCode) conditions.push(eq(relayOrders.channelCode, filters.channelCode));
    if (filters?.status) conditions.push(eq(relayOrders.status, filters.status));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const rows = await query.orderBy(desc(relayOrders.createdAt));
    return rows.map((r: any) => this.mapOrderRow(r));
  }

  async saveOrder(order: CanonicalOrder) {
    const record = {
      id: order.id,
      outletId: order.outletId,
      channelCode: order.channelCode,
      channelOrderId: order.channelOrderId,
      displayOrderId: order.displayOrderId,
      status: order.status,
      customerDetailsJson: order.customer,
      itemsJson: order.items,
      pricingBreakdownJson: order.pricing,
      riderDetailsJson: order.rider || null,
      rawWebhookJson: order.rawWebhookPayload || null,
      updatedAt: new Date(),
    };

    await this.db
      .insert(relayOrders)
      .values({ ...record, createdAt: new Date(order.placedAt || Date.now()) })
      .onConflictDoUpdate({
        target: relayOrders.id,
        set: record,
      });

    await this.addOrderAudit(order.id, 'NONE', order.status, 'INGESTION', {
      channelCode: order.channelCode,
      channelOrderId: order.channelOrderId,
    });
  }

  async updateOrderStatus(orderId: string, newStatus: NormalizedOrderStatus, triggeredBy: string, meta?: any) {
    const order = await this.getOrderById(orderId);
    if (!order) return false;

    const fromStatus = order.status;
    await this.db
      .update(relayOrders)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(relayOrders.id, orderId));

    await this.addOrderAudit(orderId, fromStatus, newStatus, triggeredBy, meta);
    return true;
  }

  // ─── Order Audits ─────────────────────────────────────────────────────────
  async getOrderAudits(orderId: string) {
    return this.db
      .select()
      .from(relayOrderAudits)
      .where(eq(relayOrderAudits.orderId, orderId))
      .orderBy(desc(relayOrderAudits.timestamp));
  }

  async addOrderAudit(orderId: string, fromStatus: string, toStatus: string, triggeredBy: string, meta?: any) {
    await this.db.insert(relayOrderAudits).values({
      id: generateId('audit'),
      orderId,
      fromStatus,
      toStatus,
      triggeredBy,
      metaJson: meta || null,
      timestamp: new Date(),
    });
  }

  // ─── Logistics Dispatches ─────────────────────────────────────────────────
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

    await this.db
      .insert(relayLogisticsDispatches)
      .values(record)
      .onConflictDoUpdate({
        target: relayLogisticsDispatches.waybillNumber,
        set: {
          status: record.status,
          riderName: record.riderName,
          riderPhone: record.riderPhone,
          trackingUrl: record.trackingUrl,
          updatedAt: new Date(),
        },
      });

    return record;
  }

  async getLogisticsDispatchByOrderId(orderId: string) {
    const [row] = await this.db
      .select()
      .from(relayLogisticsDispatches)
      .where(eq(relayLogisticsDispatches.orderId, orderId))
      .limit(1);
    return row || null;
  }

  async getLogisticsDispatchByWaybill(waybillNumber: string) {
    const [row] = await this.db
      .select()
      .from(relayLogisticsDispatches)
      .where(eq(relayLogisticsDispatches.waybillNumber, waybillNumber))
      .limit(1);
    return row || null;
  }

  async updateLogisticsStatus(waybillNumber: string, status: string, riderMeta?: any) {
    const updateData: any = { status, updatedAt: new Date() };
    if (riderMeta?.riderName) updateData.riderName = riderMeta.riderName;
    if (riderMeta?.riderPhone) updateData.riderPhone = riderMeta.riderPhone;
    if (riderMeta?.trackingUrl) updateData.trackingUrl = riderMeta.trackingUrl;

    const result = await this.db
      .update(relayLogisticsDispatches)
      .set(updateData)
      .where(eq(relayLogisticsDispatches.waybillNumber, waybillNumber));
    return Boolean(result);
  }

  // ─── Settlements ──────────────────────────────────────────────────────────
  async saveSettlement(settlement: any) {
    const id = settlement.id || generateId('stl');
    const record = {
      ...settlement,
      id,
      createdAt: new Date(),
    };
    await this.db.insert(relaySettlements).values(record);
    return record;
  }

  async listSettlements(outletId?: string) {
    if (outletId) {
      return this.db
        .select()
        .from(relaySettlements)
        .where(eq(relaySettlements.outletId, outletId))
        .orderBy(desc(relaySettlements.settlementDate));
    }
    return this.db.select().from(relaySettlements).orderBy(desc(relaySettlements.settlementDate));
  }

  async getSettlementDiscrepancies(outletId?: string) {
    const list = await this.listSettlements(outletId);
    return list.filter(
      (s: any) =>
        s.reconciliationStatus === 'DISCREPANCIES_DETECTED' ||
        (s.discrepancyAmount && Number(s.discrepancyAmount) > 0)
    );
  }

  private mapOrderRow(row: any): CanonicalOrder {
    return {
      id: row.id,
      outletId: row.outletId,
      channelCode: row.channelCode,
      channelOrderId: row.channelOrderId,
      displayOrderId: row.displayOrderId,
      status: row.status,
      orderType: 'DELIVERY',
      prepTimeMinutes: 20,
      specialInstructions: '',
      placedAt: new Date(row.createdAt).toISOString(),
      customer: row.customerDetailsJson,
      items: row.itemsJson,
      pricing: row.pricingBreakdownJson,
      rider: row.riderDetailsJson || undefined,
      rawWebhookPayload: row.rawWebhookJson || undefined,
    };
  }
}
