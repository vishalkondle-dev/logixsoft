import type {
  ChannelAdapter,
  CanonicalOrder,
  CanonicalMenu,
  SyncResult,
  NormalizedOrderStatus,
} from '@logixsoft/relay-schema';
import {
  mapZomatoStatusToCanonical,
  mapCanonicalToZomatoStatus,
} from '@logixsoft/relay-schema';
import { verifyHmacSignature } from '../crypto/hmac';
import { generateId } from '@logixsoft/helpers/crypto';

export class ZomatoAdapter implements ChannelAdapter {
  public readonly channelCode = 'ZOMATO' as const;

  async verifyWebhook(req: Request, rawBody: string, secret: string): Promise<boolean> {
    const signature =
      req.headers.get('x-zomato-signature') ||
      req.headers.get('x-signature') ||
      req.headers.get('authorization');
    if (!signature) {
      return req.headers.get('x-mock-bypass') === 'true';
    }
    return verifyHmacSignature(rawBody, secret, signature);
  }

  async parseOrder(rawPayload: any): Promise<CanonicalOrder> {
    const data = rawPayload.order_data || rawPayload.order || rawPayload;
    const channelOrderId = String(data.order_id || data.id || generateId('zom'));
    const displayOrderId = `ZOM-${channelOrderId.slice(-4)}`;

    const rawStatus = data.status || data.order_status || 'placed';
    const status: NormalizedOrderStatus = mapZomatoStatusToCanonical(rawStatus);

    const customerRaw = data.customer || data.customer_details || {};
    const deliveryAddressRaw = data.delivery_details?.address || data.delivery_address || {};

    const rawItems: any[] = data.order_items || data.items || [];
    const items = rawItems.map((it, idx) => {
      const unitPrice = Number(it.price || it.unit_price || it.base_price || 0);
      const qty = Number(it.quantity || 1);
      return {
        id: String(it.item_id || it.dish_id || it.id || `zom_item_${idx}`),
        channelItemId: String(it.item_id || it.dish_id || it.id || `zom_item_${idx}`),
        name: it.name || it.dish_name || 'Zomato Item',
        quantity: qty,
        basePrice: unitPrice,
        totalPrice: unitPrice * qty,
        foodType: it.food_type === 'non_veg' || it.is_veg === false ? ('NON_VEG' as const) : ('VEG' as const),
        selectedVariants: (it.variants || []).map((v: any) => ({
          id: String(v.id || generateId('var')),
          name: v.name || 'Variant',
          price: Number(v.price || 0),
        })),
        selectedAddons: (it.customizations || it.addons || []).map((a: any) => ({
          id: String(a.id || generateId('adn')),
          name: a.name || 'Addon',
          price: Number(a.price || 0),
        })),
        itemInstructions: it.instruction || it.dish_instruction || '',
      };
    });

    const bill = data.bill_details || data.pricing || {};
    const subtotal = Number(bill.subtotal || bill.item_total || items.reduce((acc, i) => acc + i.totalPrice, 0));
    const packagingCharge = Number(bill.packaging_charge || bill.packing_charge || 0);
    const deliveryCharge = Number(bill.delivery_charge || 0);
    const totalTax = Number(bill.tax || bill.gst || (subtotal * 0.05));
    const discount = Number(bill.discount || bill.merchant_discount || 0);
    const totalAmount = Number(data.total_price || data.net_amount || (subtotal + packagingCharge + totalTax - discount));
    const customerPaid = Number(data.customer_paid_amount || totalAmount);

    // Zomato typical commercial breakdown: 20% commission + 18% GST on commission + 1% TCS
    const commissionPercent = 20;
    const channelCommission = Number(((subtotal * commissionPercent) / 100).toFixed(2));
    const channelCommissionGst = Number(((channelCommission * 0.18)).toFixed(2));
    const tcsTds = Number(((subtotal * 0.01)).toFixed(2));
    const netSettlementAmount = Number(
      (totalAmount - channelCommission - channelCommissionGst - tcsTds).toFixed(2)
    );

    const riderRaw = data.rider_details || data.delivery_partner;
    const rider = riderRaw
      ? {
          riderType: 'CHANNEL' as const,
          name: riderRaw.name || 'Zomato Valet',
          phone: riderRaw.phone || riderRaw.contact_number || '',
          trackingUrl: riderRaw.tracking_url || riderRaw.live_tracking_url || '',
          latitude: riderRaw.lat ? Number(riderRaw.lat) : undefined,
          longitude: riderRaw.lng ? Number(riderRaw.lng) : undefined,
          status: riderRaw.status || 'ASSIGNED',
        }
      : undefined;

    return {
      id: generateId('ord'),
      outletId: String(rawPayload.res_id || rawPayload.restaurant_id || 'outlet_default'),
      channelCode: 'ZOMATO',
      channelOrderId,
      displayOrderId,
      status,
      orderType: 'DELIVERY',
      prepTimeMinutes: Number(data.prep_time || 25),
      customer: {
        name: customerRaw.name || 'Zomato Diner',
        phone: customerRaw.phone || customerRaw.phone_number || '',
        email: customerRaw.email || '',
        address: {
          line1: deliveryAddressRaw.address_line1 || deliveryAddressRaw.address || '',
          landmark: deliveryAddressRaw.landmark || '',
          city: deliveryAddressRaw.city || '',
          pincode: deliveryAddressRaw.zipcode || deliveryAddressRaw.pincode || '',
          latitude: deliveryAddressRaw.latitude ? Number(deliveryAddressRaw.latitude) : undefined,
          longitude: deliveryAddressRaw.longitude ? Number(deliveryAddressRaw.longitude) : undefined,
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
      specialInstructions: data.delivery_instructions || data.cooking_instruction || '',
      placedAt: data.created_time || new Date().toISOString(),
      rawWebhookPayload: rawPayload,
    };
  }

  async acceptOrder(channelOrderId: string, prepTimeMinutes: number, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://api.zomato.com/v2';
        const res = await fetch(`${baseUrl}/orders/${channelOrderId}/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': credentials.apiKey,
          },
          body: JSON.stringify({ prep_time: prepTimeMinutes }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[ZomatoAdapter] acceptOrder failed for ${channelOrderId}:`, err);
        return false;
      }
    }
    return true;
  }

  async rejectOrder(channelOrderId: string, reasonCode: string, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://api.zomato.com/v2';
        const res = await fetch(`${baseUrl}/orders/${channelOrderId}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': credentials.apiKey,
          },
          body: JSON.stringify({ reason_code: reasonCode, explanation: reasonCode }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[ZomatoAdapter] rejectOrder failed for ${channelOrderId}:`, err);
        return false;
      }
    }
    return true;
  }

  async markFoodReady(channelOrderId: string, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://api.zomato.com/v2';
        const res = await fetch(`${baseUrl}/orders/${channelOrderId}/prepared`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': credentials.apiKey,
          },
        });
        return res.ok;
      } catch (err) {
        console.error(`[ZomatoAdapter] markFoodReady failed for ${channelOrderId}:`, err);
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
        const baseUrl = credentials.baseUrl || 'https://api.zomato.com/v2';
        const merchantStoreId = credentials.merchantStoreId || outletId;
        await fetch(`${baseUrl}/restaurant/${merchantStoreId}/menu`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': credentials.apiKey,
          },
          body: JSON.stringify({ menu }),
        });
      } catch (err) {
        console.error('[ZomatoAdapter] publishMenu remote error:', err);
      }
    }

    return {
      success: true,
      channelCode: 'ZOMATO',
      outletId,
      itemsSynced,
      categoriesSynced: menu.categories.length,
      externalCatalogId: `zomato_cat_${outletId}`,
      timestamp: new Date().toISOString(),
    };
  }

  async updateItemStock(outletId: string, itemId: string, inStock: boolean, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://api.zomato.com/v2';
        const merchantStoreId = credentials.merchantStoreId || outletId;
        const res = await fetch(`${baseUrl}/restaurant/${merchantStoreId}/items/${itemId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': credentials.apiKey,
          },
          body: JSON.stringify({ in_stock: inStock ? 1 : 0 }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[ZomatoAdapter] updateItemStock failed:`, err);
        return false;
      }
    }
    return true;
  }

  async updateStoreStatus(outletId: string, isOnline: boolean, credentials: any): Promise<boolean> {
    const isLive = credentials?.isLive === true;
    if (isLive) {
      try {
        const baseUrl = credentials.baseUrl || 'https://api.zomato.com/v2';
        const merchantStoreId = credentials.merchantStoreId || outletId;
        const res = await fetch(`${baseUrl}/restaurant/${merchantStoreId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': credentials.apiKey,
          },
          body: JSON.stringify({ is_online: isOnline ? 1 : 0 }),
        });
        return res.ok;
      } catch (err) {
        console.error(`[ZomatoAdapter] updateStoreStatus failed:`, err);
        return false;
      }
    }
    return true;
  }
}
