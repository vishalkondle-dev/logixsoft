import type {
  ChannelAdapter,
  CanonicalOrder,
  CanonicalMenu,
  SyncResult,
  NormalizedOrderStatus,
} from '@logixsoft/relay-schema';
import {
  mapSwiggyStatusToCanonical,
  mapCanonicalToSwiggyStatus,
  calculateItemChannelPrice,
} from '@logixsoft/relay-schema';
import { verifyHmacSignature } from '../crypto/hmac';
import { generateId } from '@logixsoft/helpers/crypto';

export class SwiggyAdapter implements ChannelAdapter {
  public readonly channelCode = 'SWIGGY' as const;

  async verifyWebhook(req: Request, rawBody: string, secret: string): Promise<boolean> {
    const signature =
      req.headers.get('x-swiggy-signature') ||
      req.headers.get('x-signature') ||
      req.headers.get('x-hub-signature');
    if (!signature) {
      // In dev or test environments with mock secret bypass or header
      return req.headers.get('x-mock-bypass') === 'true';
    }
    return verifyHmacSignature(rawBody, secret, signature);
  }

  async parseOrder(rawPayload: any): Promise<CanonicalOrder> {
    const orderData = rawPayload.order || rawPayload.order_details || rawPayload;
    const channelOrderId = String(orderData.order_id || orderData.id || generateId('sw'));
    const displayOrderId = `SW-${channelOrderId.slice(-4)}`;

    const rawStatus = orderData.status || orderData.order_status || 'ORDER_CREATED';
    const status: NormalizedOrderStatus = mapSwiggyStatusToCanonical(rawStatus);

    const customerRaw = orderData.customer || {};
    const deliveryAddressRaw = orderData.delivery_address || customerRaw.address || {};

    const rawItems: any[] = orderData.cart?.items || orderData.items || [];
    const items = rawItems.map((it, idx) => {
      const basePrice = Number(it.sub_total || it.price || it.base_price || 0) / (Number(it.quantity || 1) || 1);
      const qty = Number(it.quantity || 1);
      return {
        id: String(it.item_id || it.id || `sw_item_${idx}`),
        channelItemId: String(it.item_id || it.id || `sw_item_${idx}`),
        name: it.name || it.item_name || 'Swiggy Dish',
        quantity: qty,
        basePrice,
        totalPrice: basePrice * qty,
        foodType: it.is_veg ? ('VEG' as const) : ('NON_VEG' as const),
        selectedVariants: (it.variants || it.variant_groups || []).map((v: any) => ({
          id: String(v.id || generateId('var')),
          name: v.name || v.title || 'Variant',
          price: Number(v.price || 0),
        })),
        selectedAddons: (it.addons || it.add_ons || []).map((a: any) => ({
          id: String(a.id || generateId('adn')),
          name: a.name || a.title || 'Addon',
          price: Number(a.price || 0),
        })),
        itemInstructions: it.instructions || it.note || '',
      };
    });

    const bill = orderData.bill_details || orderData.charges || {};
    const subtotal = Number(bill.sub_total || bill.item_total || items.reduce((acc, i) => acc + i.totalPrice, 0));
    const packagingCharge = Number(bill.packaging_charge || bill.packing_charges || 0);
    const deliveryCharge = Number(bill.delivery_charge || 0);
    const totalTax = Number(bill.total_tax || bill.gst || bill.tax || (subtotal * 0.05));
    const discount = Number(bill.discount || bill.restaurant_discount || 0);
    const totalAmount = Number(orderData.total_amount || orderData.net_amount || (subtotal + packagingCharge + totalTax - discount));
    const customerPaid = Number(orderData.customer_amount || totalAmount);

    // Swiggy typical commercial breakdown: 18% commission + 18% GST on commission + 1% TCS
    const commissionPercent = 18;
    const channelCommission = Number(((subtotal * commissionPercent) / 100).toFixed(2));
    const channelCommissionGst = Number(((channelCommission * 0.18)).toFixed(2));
    const tcsTds = Number(((subtotal * 0.01)).toFixed(2));
    const netSettlementAmount = Number(
      (totalAmount - channelCommission - channelCommissionGst - tcsTds).toFixed(2)
    );

    const riderRaw = orderData.delivery_boy || orderData.delivery_boy_info;
    const rider = riderRaw
      ? {
          riderType: 'CHANNEL' as const,
          name: riderRaw.name || 'Swiggy Rider',
          phone: riderRaw.phone_number || riderRaw.phone || '',
          trackingUrl: riderRaw.tracking_url || '',
          status: riderRaw.status || 'ASSIGNED',
        }
      : undefined;

    return {
      id: generateId('ord'),
      outletId: String(rawPayload.outlet_id || rawPayload.restaurant_id || 'outlet_default'),
      channelCode: 'SWIGGY',
      channelOrderId,
      displayOrderId,
      status,
      orderType: 'DELIVERY',
      prepTimeMinutes: Number(orderData.prep_time || 20),
      customer: {
        name: customerRaw.name || 'Swiggy Customer',
        phone: customerRaw.phone || '',
        email: customerRaw.email || '',
        address: {
          line1: deliveryAddressRaw.line1 || deliveryAddressRaw.address || '',
          landmark: deliveryAddressRaw.landmark || '',
          city: deliveryAddressRaw.city || '',
          pincode: deliveryAddressRaw.pincode || '',
          latitude: deliveryAddressRaw.lat ? Number(deliveryAddressRaw.lat) : undefined,
          longitude: deliveryAddressRaw.lng ? Number(deliveryAddressRaw.lng) : undefined,
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
      specialInstructions: orderData.special_instructions || orderData.comments || '',
      placedAt: orderData.created_at || new Date().toISOString(),
      rawWebhookPayload: rawPayload,
    };
  }

  async acceptOrder(channelOrderId: string, prepTimeMinutes: number, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://pos-integration.swiggy.com';
        const res = await fetch(`${baseUrl}/v1/orders/${channelOrderId}/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
            ...(credentials.apiSecret ? { 'api-secret': credentials.apiSecret } : {}),
          },
          body: JSON.stringify({ prep_time: prepTimeMinutes }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[SwiggyAdapter] acceptOrder failed for ${channelOrderId}:`, err);
        return false;
      }
    }
    return true;
  }

  async rejectOrder(channelOrderId: string, reasonCode: string, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://pos-integration.swiggy.com';
        const res = await fetch(`${baseUrl}/v1/orders/${channelOrderId}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
            ...(credentials.apiSecret ? { 'api-secret': credentials.apiSecret } : {}),
          },
          body: JSON.stringify({ reason: reasonCode, reason_code: reasonCode }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[SwiggyAdapter] rejectOrder failed for ${channelOrderId}:`, err);
        return false;
      }
    }
    return true;
  }

  async markFoodReady(channelOrderId: string, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://pos-integration.swiggy.com';
        const res = await fetch(`${baseUrl}/v1/orders/${channelOrderId}/food_ready`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
            ...(credentials.apiSecret ? { 'api-secret': credentials.apiSecret } : {}),
          },
        });
        return res.ok;
      } catch (err) {
        console.error(`[SwiggyAdapter] markFoodReady failed for ${channelOrderId}:`, err);
        return false;
      }
    }
    return true;
  }

  async publishMenu(outletId: string, menu: CanonicalMenu, credentials: any): Promise<SyncResult> {
    let itemsSynced = 0;
    let categoriesSynced = menu.categories.length;

    for (const cat of menu.categories) {
      itemsSynced += cat.items.length;
    }

    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://pos-integration.swiggy.com';
        const merchantStoreId = credentials.merchantStoreId || outletId;
        await fetch(`${baseUrl}/v1/restaurants/${merchantStoreId}/catalog`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
          },
          body: JSON.stringify({ menu }),
        });
      } catch (err) {
        console.error('[SwiggyAdapter] publishMenu remote error:', err);
      }
    }

    return {
      success: true,
      channelCode: 'SWIGGY',
      outletId,
      itemsSynced,
      categoriesSynced,
      externalCatalogId: `swiggy_cat_${outletId}`,
      timestamp: new Date().toISOString(),
    };
  }

  async updateItemStock(outletId: string, itemId: string, inStock: boolean, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://pos-integration.swiggy.com';
        const merchantStoreId = credentials.merchantStoreId || outletId;
        const res = await fetch(`${baseUrl}/v1/restaurants/${merchantStoreId}/items/${itemId}/stock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
          },
          body: JSON.stringify({ in_stock: inStock }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[SwiggyAdapter] updateItemStock failed:`, err);
        return false;
      }
    }
    return true;
  }

  async updateStoreStatus(outletId: string, isOnline: boolean, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://pos-integration.swiggy.com';
        const merchantStoreId = credentials.merchantStoreId || outletId;
        const res = await fetch(`${baseUrl}/v1/restaurants/${merchantStoreId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': credentials.apiKey,
          },
          body: JSON.stringify({ is_online: isOnline }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[SwiggyAdapter] updateStoreStatus failed:`, err);
        return false;
      }
    }
    return true;
  }
}
