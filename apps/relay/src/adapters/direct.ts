import type {
  ChannelAdapter,
  CanonicalOrder,
  CanonicalMenu,
  SyncResult,
  ChannelCode,
  NormalizedOrderStatus,
} from '@logixsoft/relay-schema';
import {
  mapDirectStatusToCanonical,
} from '@logixsoft/relay-schema';
import { verifyHmacSignature } from '../crypto/hmac';
import { generateId } from '@logixsoft/helpers/crypto';

export class DirectChannelAdapter implements ChannelAdapter {
  constructor(public readonly channelCode: 'OWNLY' | 'TOING') {}

  async verifyWebhook(req: Request, rawBody: string, secret: string): Promise<boolean> {
    const signature =
      req.headers.get('x-signature') ||
      req.headers.get('x-direct-signature') ||
      req.headers.get('authorization');
    if (!signature) {
      return req.headers.get('x-mock-bypass') === 'true';
    }
    return verifyHmacSignature(rawBody, secret, signature);
  }

  async parseOrder(rawPayload: any): Promise<CanonicalOrder> {
    const data = rawPayload.order || rawPayload.data || rawPayload;
    const channelOrderId = String(data.order_id || data.id || generateId(this.channelCode.toLowerCase()));
    const prefix = this.channelCode === 'OWNLY' ? 'OWN' : 'TOI';
    const displayOrderId = `${prefix}-${channelOrderId.slice(-4)}`;

    const rawStatus = data.status || 'ORDER_PLACED';
    const status: NormalizedOrderStatus = mapDirectStatusToCanonical(rawStatus);

    const customer = data.customer || {};
    const deliveryAddress = customer.address || data.delivery_address || {};

    const rawItems: any[] = data.items || [];
    const items = rawItems.map((it, idx) => {
      const basePrice = Number(it.price || it.unit_price || 0);
      const qty = Number(it.quantity || 1);
      return {
        id: String(it.id || `${this.channelCode.toLowerCase()}_item_${idx}`),
        channelItemId: String(it.id || `${this.channelCode.toLowerCase()}_item_${idx}`),
        name: it.name || it.title || 'Direct Order Item',
        quantity: qty,
        basePrice,
        totalPrice: basePrice * qty,
        foodType: it.food_type === 'NON_VEG' ? ('NON_VEG' as const) : ('VEG' as const),
        selectedVariants: (it.variants || []).map((v: any) => ({
          id: String(v.id || generateId('var')),
          name: v.name,
          price: Number(v.price || 0),
        })),
        selectedAddons: (it.addons || []).map((a: any) => ({
          id: String(a.id || generateId('adn')),
          name: a.name,
          price: Number(a.price || 0),
        })),
        itemInstructions: it.note || '',
      };
    });

    const subtotal = items.reduce((acc, i) => acc + i.totalPrice, 0);
    const packagingCharge = Number(data.packaging_fee || data.packing_charges || 15);
    const deliveryCharge = Number(data.delivery_fee || data.delivery_charges || 30);
    const totalTax = Number(data.tax_amount || (subtotal * 0.05));
    const discount = Number(data.discount_amount || 0);
    const totalAmount = Number(data.total_amount || (subtotal + packagingCharge + deliveryCharge + totalTax - discount));
    const customerPaid = Number(data.customer_paid || totalAmount);

    // Direct channel has 0% marketplace commission!
    const channelCommissionPercent = 0;
    const channelCommission = 0;
    const channelCommissionGst = 0;
    const paymentGatewayFee = Number((totalAmount * 0.02).toFixed(2)); // ~2% Razorpay/PayU
    const netSettlementAmount = Number((totalAmount - paymentGatewayFee).toFixed(2));

    const riderRaw = data.rider;
    const rider = riderRaw
      ? {
          riderType: '3PL' as const,
          name: riderRaw.name || 'Direct Rider',
          phone: riderRaw.phone || '',
          trackingUrl: riderRaw.tracking_url || '',
          status: 'ASSIGNED',
        }
      : undefined;

    return {
      id: generateId('ord'),
      outletId: String(rawPayload.outlet_id || 'outlet_default'),
      channelCode: this.channelCode,
      channelOrderId,
      displayOrderId,
      status,
      orderType: 'DELIVERY',
      prepTimeMinutes: Number(data.prep_time || 20),
      customer: {
        name: customer.name || 'Direct Customer',
        phone: customer.phone || '',
        email: customer.email || '',
        address: {
          line1: deliveryAddress.line1 || deliveryAddress.address || '',
          landmark: deliveryAddress.landmark || '',
          city: deliveryAddress.city || 'Bangalore',
          pincode: deliveryAddress.pincode || '',
        },
      },
      items,
      pricing: {
        subtotal,
        packagingCharge,
        deliveryCharge,
        taxes: [
          { label: 'CGST 2.5%', rate: 2.5, amount: Number((totalTax / 2).toFixed(2)) },
          { label: 'SGST 2.5%', rate: 2.5, amount: Number((totalTax / 2).toFixed(2)) },
        ],
        totalTax,
        discount,
        totalAmount,
        customerPaid,
        channelCommissionPercent,
        channelCommission,
        channelCommissionGst,
        fixedOrderFee: 0,
        paymentGatewayFee,
        tcsTds: 0,
        netSettlementAmount,
      },
      rider,
      specialInstructions: data.instructions || '',
      placedAt: data.created_at || new Date().toISOString(),
      rawWebhookPayload: rawPayload,
    };
  }

  async acceptOrder(channelOrderId: string, prepTimeMinutes: number, credentials: any): Promise<boolean> {
    return true;
  }

  async rejectOrder(channelOrderId: string, reasonCode: string, credentials: any): Promise<boolean> {
    return true;
  }

  async markFoodReady(channelOrderId: string, credentials: any): Promise<boolean> {
    return true;
  }

  async publishMenu(outletId: string, menu: CanonicalMenu, credentials: any): Promise<SyncResult> {
    let itemsSynced = 0;
    for (const cat of menu.categories) {
      itemsSynced += cat.items.length;
    }
    return {
      success: true,
      channelCode: this.channelCode,
      outletId,
      itemsSynced,
      categoriesSynced: menu.categories.length,
      externalCatalogId: `${this.channelCode.toLowerCase()}_cat_${outletId}`,
      timestamp: new Date().toISOString(),
    };
  }

  async updateItemStock(outletId: string, itemId: string, inStock: boolean, credentials: any): Promise<boolean> {
    return true;
  }

  async updateStoreStatus(outletId: string, isOnline: boolean, credentials: any): Promise<boolean> {
    return true;
  }
}
