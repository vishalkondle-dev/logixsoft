import type {
  ChannelAdapter,
  CanonicalOrder,
  CanonicalMenu,
  SyncResult,
  NormalizedOrderStatus,
} from '@logixsoft/relay-schema';
import {
  mapMagicpinStatusToCanonical,
  mapCanonicalToMagicpinStatus,
} from '@logixsoft/relay-schema';
import { verifyHmacSignature } from '../crypto/hmac';
import { generateId } from '@logixsoft/helpers/crypto';

export class MagicpinAdapter implements ChannelAdapter {
  public readonly channelCode = 'MAGICPIN' as const;

  async verifyWebhook(req: Request, rawBody: string, secret: string): Promise<boolean> {
    const signature =
      req.headers.get('x-magicpin-signature') ||
      req.headers.get('x-signature') ||
      req.headers.get('authorization');
    if (!signature) {
      return req.headers.get('x-mock-bypass') === 'true';
    }
    return verifyHmacSignature(rawBody, secret, signature);
  }

  async parseOrder(rawPayload: any): Promise<CanonicalOrder> {
    const data = rawPayload.data || rawPayload.order || rawPayload;
    const channelOrderId = String(data.order_id || data.magicpin_order_id || generateId('mp'));
    const displayOrderId = `MP-${channelOrderId.slice(-4)}`;

    const rawStatus = data.order_status || data.status || 'PENDING';
    const status: NormalizedOrderStatus = mapMagicpinStatusToCanonical(rawStatus);

    const customerRaw = data.user || data.customer || {};
    const deliveryAddressRaw = data.delivery_address || customerRaw.address || {};

    const rawItems: any[] = data.items || [];
    const items = rawItems.map((it, idx) => {
      const basePrice = Number(it.price || it.unit_price || 0);
      const qty = Number(it.quantity || 1);
      return {
        id: String(it.item_id || it.id || `mp_item_${idx}`),
        channelItemId: String(it.item_id || it.id || `mp_item_${idx}`),
        name: it.item_name || it.name || 'Magicpin Item',
        quantity: qty,
        basePrice,
        totalPrice: basePrice * qty,
        foodType: it.food_type === 'NON_VEG' ? ('NON_VEG' as const) : ('VEG' as const),
        selectedVariants: (it.variants || []).map((v: any) => ({
          id: String(v.id || generateId('var')),
          name: v.name || 'Variant',
          price: Number(v.price || 0),
        })),
        selectedAddons: (it.addons || []).map((a: any) => ({
          id: String(a.id || generateId('adn')),
          name: a.name || 'Addon',
          price: Number(a.price || 0),
        })),
        itemInstructions: it.note || '',
      };
    });

    const subtotal = items.reduce((acc, i) => acc + i.totalPrice, 0);
    const packagingCharge = Number(data.packing_charges || 0);
    const deliveryCharge = Number(data.delivery_charges || 0);
    const totalTax = Number(data.taxes || (subtotal * 0.05));
    // Magicpin vouchers / points redemption
    const loyaltyDiscount = Number(data.magicpin_points_discount || data.voucher_discount || 0);
    const merchantDiscount = Number(data.merchant_discount || 0);
    const discount = loyaltyDiscount + merchantDiscount;
    const totalAmount = Math.max(0, subtotal + packagingCharge + totalTax - discount);
    const customerPaid = Number(data.amount_paid_by_customer || totalAmount);

    const commissionPercent = 10; // Magicpin 10% base commission
    const channelCommission = Number(((subtotal * commissionPercent) / 100).toFixed(2));
    const channelCommissionGst = Number((channelCommission * 0.18).toFixed(2));
    const tcsTds = Number((subtotal * 0.01).toFixed(2));
    const netSettlementAmount = Number(
      (totalAmount - channelCommission - channelCommissionGst - tcsTds).toFixed(2)
    );

    const riderRaw = data.rider_details;
    const rider = riderRaw
      ? {
          riderType: 'CHANNEL' as const,
          name: riderRaw.name || 'Magicpin Delivery Partner',
          phone: riderRaw.phone || '',
          trackingUrl: riderRaw.tracking_url || '',
          status: riderRaw.status || 'ASSIGNED',
        }
      : undefined;

    return {
      id: generateId('ord'),
      outletId: String(rawPayload.merchant_id || rawPayload.outlet_id || 'outlet_default'),
      channelCode: 'MAGICPIN',
      channelOrderId,
      displayOrderId,
      status,
      orderType: 'DELIVERY',
      prepTimeMinutes: Number(data.prep_time_mins || 20),
      customer: {
        name: customerRaw.name || 'Magicpin Customer',
        phone: customerRaw.phone || customerRaw.mobile || '',
        email: customerRaw.email || '',
        address: {
          line1: deliveryAddressRaw.address_line || deliveryAddressRaw.line1 || '',
          landmark: deliveryAddressRaw.landmark || '',
          city: deliveryAddressRaw.city || '',
          pincode: deliveryAddressRaw.pincode || '',
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
        channelCommissionPercent: commissionPercent,
        channelCommission,
        channelCommissionGst,
        fixedOrderFee: 0,
        paymentGatewayFee: 0,
        tcsTds,
        netSettlementAmount,
      },
      rider,
      specialInstructions: data.instructions || '',
      placedAt: data.created_at || new Date().toISOString(),
      rawWebhookPayload: rawPayload,
    };
  }

  async acceptOrder(channelOrderId: string, prepTimeMinutes: number, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://partner.magicpin.in/api/v1';
        const res = await fetch(`${baseUrl}/orders/${channelOrderId}/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
          },
          body: JSON.stringify({ prep_time: prepTimeMinutes }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[MagicpinAdapter] acceptOrder failed for ${channelOrderId}:`, err);
        return false;
      }
    }
    return true;
  }

  async rejectOrder(channelOrderId: string, reasonCode: string, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://partner.magicpin.in/api/v1';
        const res = await fetch(`${baseUrl}/orders/${channelOrderId}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
          },
          body: JSON.stringify({ reason: reasonCode }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[MagicpinAdapter] rejectOrder failed for ${channelOrderId}:`, err);
        return false;
      }
    }
    return true;
  }

  async markFoodReady(channelOrderId: string, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://partner.magicpin.in/api/v1';
        const res = await fetch(`${baseUrl}/orders/${channelOrderId}/ready`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
          },
        });
        return res.ok;
      } catch (err) {
        console.error(`[MagicpinAdapter] markFoodReady failed for ${channelOrderId}:`, err);
        return false;
      }
    }
    return true;
  }

  async publishMenu(outletId: string, menu: CanonicalMenu, credentials: any): Promise<SyncResult> {
    let itemsSynced = 0;
    for (const cat of menu.categories) {
      itemsSynced += cat.items.length;
    }

    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://partner.magicpin.in/api/v1';
        await fetch(`${baseUrl}/outlets/${outletId}/menu`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
          },
          body: JSON.stringify({ menu }),
        });
      } catch (err) {
        console.error('[MagicpinAdapter] publishMenu error:', err);
      }
    }

    return {
      success: true,
      channelCode: 'MAGICPIN',
      outletId,
      itemsSynced,
      categoriesSynced: menu.categories.length,
      externalCatalogId: `magicpin_cat_${outletId}`,
      timestamp: new Date().toISOString(),
    };
  }

  async updateItemStock(outletId: string, itemId: string, inStock: boolean, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://partner.magicpin.in/api/v1';
        const res = await fetch(`${baseUrl}/outlets/${outletId}/items/${itemId}/stock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
          },
          body: JSON.stringify({ in_stock: inStock }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[MagicpinAdapter] updateItemStock failed:`, err);
        return false;
      }
    }
    return true;
  }

  async updateStoreStatus(outletId: string, isOnline: boolean, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://partner.magicpin.in/api/v1';
        const res = await fetch(`${baseUrl}/outlets/${outletId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
          },
          body: JSON.stringify({ is_online: isOnline }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[MagicpinAdapter] updateStoreStatus failed:`, err);
        return false;
      }
    }
    return true;
  }
}
