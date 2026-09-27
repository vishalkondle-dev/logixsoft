import type { CanonicalOrder } from '@logixsoft/relay-schema';

export interface ThermalPrintPayload {
  silent: boolean;
  type: 'KOT' | 'BILL';
  restaurantName: string;
  orderNo: string;
  channel: string;
  channelOrderId: string;
  time: string;
  date: string;
  items: Array<{
    name: string;
    qty: number;
    pricePaise: number;
    foodType: string;
    note?: string;
    modifiers?: string[];
  }>;
  customer: {
    name: string;
    phone: string;
    address?: string;
  };
  specialInstructions?: string;
  totalPaise: number;
}

export interface DesktopBridgeEvent {
  id: string;
  type: 'DELIVERY_ORDER_ARRIVED' | 'ORDER_STATUS_CHANGED' | 'RIDER_UPDATE';
  timestamp: number;
  audioChime: boolean;
  chimeSound: string;
  printReceipt: ThermalPrintPayload;
  order: CanonicalOrder;
}

export type BridgeListener = (event: DesktopBridgeEvent) => void;

/**
 * Interface mimicking the Electron / Desktop PC POS preload bridge `window.logixDinePC`.
 */
export interface LogixDinePCBridge {
  printReceipt: (options: { silent: boolean;[key: string]: any }) => Promise<{ success: boolean; printerName?: string }>;
  playChime?: () => void;
}

export class DesktopPosBridge {
  private listeners: Set<BridgeListener> = new Set();
  private eventHistory: DesktopBridgeEvent[] = [];

  /**
   * Subscribes a listener (e.g. SSE stream or WebSocket connection).
   */
  public subscribe(listener: BridgeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Broadcasts an incoming delivery order to all connected desktop POS clients,
   * kitchen display systems (KDS), and thermal printers.
   */
  public broadcastIncomingDeliveryOrder(order: CanonicalOrder, env?: any): DesktopBridgeEvent {
    const printPayload: ThermalPrintPayload = {
      silent: true,
      type: 'KOT',
      restaurantName: 'Logix Dine',
      orderNo: order.displayOrderId,
      channel: order.channelCode,
      channelOrderId: order.channelOrderId,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('en-IN'),
      items: order.items.map((it: any) => ({
        name: it.name,
        qty: it.quantity,
        pricePaise: Math.round(it.basePrice * 100),
        foodType: it.foodType,
        note: it.itemInstructions,
        modifiers: [
          ...(it.selectedVariants || []).map((v: any) => v.name),
          ...(it.selectedAddons || []).map((a: any) => `+${a.name}`),
        ],
      })),
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.address
          ? `${order.customer.address.line1} ${order.customer.address.landmark || ''}`
          : undefined,
      },
      specialInstructions: order.specialInstructions,
      totalPaise: Math.round(order.pricing.totalAmount * 100),
    };

    const event: DesktopBridgeEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'DELIVERY_ORDER_ARRIVED',
      timestamp: Date.now(),
      audioChime: true,
      chimeSound: 'new_order_alert.wav',
      printReceipt: printPayload,
      order,
    };

    this.eventHistory.push(event);
    if (this.eventHistory.length > 100) this.eventHistory.shift();

    // 1. Notify local in-memory listeners (SSE streams / test listeners)
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[DesktopPosBridge] Listener notification error:', err);
      }
    }

    // 2. Broadcast via Cloudflare Durable Object (RELAY_BRIDGE) across all global edge nodes
    if (env?.RELAY_BRIDGE) {
      try {
        const outletId = order.outletId || 'outlet_default';
        const id = env.RELAY_BRIDGE.idFromName(outletId);
        const stub = env.RELAY_BRIDGE.get(id);
        stub
          .fetch(
            new Request('http://internal/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(event),
            })
          )
          .catch((err: any) => {
            console.error('[DesktopPosBridge] Durable Object broadcast error:', err);
          });
      } catch (err) {
        console.error('[DesktopPosBridge] Durable Object resolution error:', err);
      }
    }

    return event;
  }

  /**
   * Client-side driver: Simulates execution inside Electron / Desktop PC POS
   * calling window.logixDinePC.printReceipt({ silent: true }) and audio chime.
   */
  public async handleClientEvent(
    event: DesktopBridgeEvent,
    pcBridge?: LogixDinePCBridge
  ): Promise<{ chimePlayed: boolean; receiptPrinted: boolean; printerResult?: any }> {
    let chimePlayed = false;
    let receiptPrinted = false;
    let printerResult: any = null;

    if (event.audioChime) {
      chimePlayed = true;
      if (pcBridge?.playChime) {
        pcBridge.playChime();
      }
    }

    if (pcBridge?.printReceipt) {
      printerResult = await pcBridge.printReceipt(event.printReceipt);
      receiptPrinted = printerResult?.success === true;
    } else {
      // Default mock success if running in desktop environment
      receiptPrinted = true;
      printerResult = { success: true, silent: true, job: 'KOT_PRINTED' };
    }

    return {
      chimePlayed,
      receiptPrinted,
      printerResult,
    };
  }

  public getHistory(): DesktopBridgeEvent[] {
    return [...this.eventHistory];
  }

  public clearHistory() {
    this.eventHistory = [];
  }
}

// Global Desktop POS Bridge singleton
export const desktopPosBridge = new DesktopPosBridge();
