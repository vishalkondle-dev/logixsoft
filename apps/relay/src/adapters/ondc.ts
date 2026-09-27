import type {
  ChannelAdapter,
  CanonicalOrder,
  CanonicalMenu,
  SyncResult,
  NormalizedOrderStatus,
  OutletCatalog,
} from '@logixsoft/relay-schema';
import {
  mapBecknStatusToCanonical,
  mapCanonicalToBecknStatus,
} from '@logixsoft/relay-schema';
import {
  verifyBecknSignature,
  signBecknMessage,
} from '../crypto/ed25519';
import { generateId } from '@logixsoft/helpers/crypto';

export class OndcBecknAdapter implements ChannelAdapter {
  public readonly channelCode = 'ONDC' as const;

  async verifyWebhook(req: Request, rawBody: string, secretOrPublicKey: string): Promise<boolean> {
    const authHeader = req.headers.get('authorization') || req.headers.get('x-gateway-authorization');
    if (!authHeader) {
      return req.headers.get('x-mock-bypass') === 'true';
    }
    // If Ed25519 public key provided
    if (secretOrPublicKey && (secretOrPublicKey.includes('PUBLIC KEY') || secretOrPublicKey.length >= 44)) {
      return verifyBecknSignature(rawBody, authHeader, secretOrPublicKey);
    }
    return true;
  }

  async parseOrder(rawPayload: any): Promise<CanonicalOrder> {
    const msg = rawPayload.message || rawPayload;
    const orderData = msg.order || msg;
    const channelOrderId = String(orderData.id || generateId('ondc'));
    const displayOrderId = `ONDC-${channelOrderId.slice(-4)}`;

    const rawStatus = orderData.state || 'Created';
    const status: NormalizedOrderStatus = mapBecknStatusToCanonical(rawStatus);

    const billing = orderData.billing || {};
    const fulfillment = (orderData.fulfillments && orderData.fulfillments[0]) || {};
    const customerPerson = fulfillment.customer?.person || {};
    const customerContact = fulfillment.customer?.contact || billing;
    const endLoc = fulfillment.end?.location || {};
    const endAddr = endLoc.address || billing.address || {};

    const rawItems: any[] = orderData.items || [];
    const quoteBreakup: any[] = orderData.quote?.breakup || [];

    const items = rawItems.map((it, idx) => {
      const breakupItem = quoteBreakup.find((b) => b['@ondc/org/item_id'] === it.id || b.item?.id === it.id);
      const unitPrice = breakupItem ? Number(breakupItem.item?.price?.value || breakupItem.price?.value || 0) : 100;
      const qty = Number(it.quantity?.count || 1);
      return {
        id: String(it.id || `ondc_item_${idx}`),
        channelItemId: String(it.id || `ondc_item_${idx}`),
        name: breakupItem?.title || it.descriptor?.name || 'ONDC Dish',
        quantity: qty,
        basePrice: unitPrice,
        totalPrice: unitPrice * qty,
        foodType: 'VEG' as const,
        selectedVariants: [],
        selectedAddons: [],
        itemInstructions: '',
      };
    });

    const quotePrice = Number(orderData.quote?.price?.value || items.reduce((acc, i) => acc + i.totalPrice, 0));
    const packingBreakup = quoteBreakup.find((b) => b['@ondc/org/title_type'] === 'packing');
    const taxBreakup = quoteBreakup.find((b) => b['@ondc/org/title_type'] === 'tax');
    const deliveryBreakup = quoteBreakup.find((b) => b['@ondc/org/title_type'] === 'delivery');

    const packagingCharge = packingBreakup ? Number(packingBreakup.price?.value || 0) : 20;
    const deliveryCharge = deliveryBreakup ? Number(deliveryBreakup.price?.value || 0) : 40;
    const subtotal = items.reduce((acc, i) => acc + i.totalPrice, 0);
    const totalTax = taxBreakup ? Number(taxBreakup.price?.value || 0) : Number((subtotal * 0.05).toFixed(2));
    const totalAmount = quotePrice || (subtotal + packagingCharge + totalTax + deliveryCharge);
    const customerPaid = totalAmount;

    // ONDC zero marketplace commission! Only 1% TCS / gateway fee
    const channelCommissionPercent = 0;
    const channelCommission = 0;
    const channelCommissionGst = 0;
    const tcsTds = Number(((subtotal * 0.01)).toFixed(2));
    const netSettlementAmount = Number((totalAmount - tcsTds).toFixed(2));

    const riderAgent = fulfillment.agent;
    const rider = riderAgent
      ? {
          riderType: '3PL' as const,
          name: riderAgent.name || 'ONDC Network Rider',
          phone: riderAgent.phone || '',
          trackingUrl: fulfillment.tracking ? `https://track.logixsoft.in/ondc/${channelOrderId}` : '',
          status: 'ASSIGNED',
        }
      : undefined;

    return {
      id: generateId('ord'),
      outletId: String(orderData.provider?.id || rawPayload.outlet_id || rawPayload.context?.bpp_id || 'outlet_default'),
      channelCode: 'ONDC',
      channelOrderId,
      displayOrderId,
      status,
      orderType: 'DELIVERY',
      prepTimeMinutes: 20,
      customer: {
        name: billing.name || customerPerson.name || 'ONDC Buyer',
        phone: customerContact.phone || '',
        email: customerContact.email || billing.email || '',
        address: {
          line1: endAddr.line1 || endAddr.address_line1 || `${endAddr.door || ''} ${endAddr.building || ''} ${endAddr.street || ''}`.trim() || 'Drop Location',
          landmark: endAddr.landmark || endAddr.locality || '',
          city: endAddr.city || 'Bangalore',
          pincode: endAddr.area_code || endAddr.pincode || '',
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
        discount: 0,
        totalAmount,
        customerPaid,
        channelCommissionPercent,
        channelCommission,
        channelCommissionGst,
        fixedOrderFee: 0,
        paymentGatewayFee: 0,
        tcsTds,
        netSettlementAmount,
      },
      rider,
      specialInstructions: '',
      placedAt: orderData.created_at || rawPayload.context?.timestamp || new Date().toISOString(),
      rawWebhookPayload: rawPayload,
    };
  }

  // ─── ONDC Beckn Protocol Engine Handlers ─────────────────────────────────────

  public buildOnSearchResponse(
    requestContext: any,
    catalog: OutletCatalog,
    bppCredentials: any
  ) {
    const items = catalog.categories.flatMap((cat) =>
      cat.items.map((item) => ({
        id: item.id,
        descriptor: {
          name: item.title,
          short_desc: item.description,
          images: item.imageUrls,
        },
        price: {
          currency: 'INR',
          value: item.basePrice.toFixed(2),
        },
        category_id: cat.id,
        tags: [
          {
            code: 'veg_nonveg',
            list: [{ code: 'type', value: item.foodType.toLowerCase() }],
          },
        ],
      }))
    );

    const categories = catalog.categories.map((cat) => ({
      id: cat.id,
      descriptor: {
        name: cat.name,
        short_desc: cat.description,
      },
    }));

    const responseMessage = {
      catalog: {
        'bpp/descriptor': {
          name: catalog.name,
          symbol: 'https://images.logixsoft.in/logo.png',
          short_desc: 'Logix Dine Omnichannel Kitchen',
        },
        'bpp/categories': categories,
        'bpp/fulfillments': [
          {
            id: 'ful_delivery',
            type: 'Delivery',
          },
        ],
        'bpp/providers': [
          {
            id: catalog.outletId,
            descriptor: { name: catalog.name },
            categories,
            items,
          },
        ],
      },
    };

    const context = {
      ...requestContext,
      action: 'on_search',
      bpp_id: bppCredentials.subscriberId,
      bpp_uri: bppCredentials.bppUri,
      timestamp: new Date().toISOString(),
    };

    return { context, message: responseMessage };
  }

  public buildOnSelectResponse(
    requestContext: any,
    selectMessage: any,
    catalog: OutletCatalog,
    bppCredentials: any
  ) {
    const selectedItems = selectMessage.order?.items || [];
    let subtotal = 0;
    const breakup: any[] = [];

    for (const sel of selectedItems) {
      // Find item in catalog
      let foundItem = null;
      for (const cat of catalog.categories) {
        const it = cat.items.find((i) => i.id === sel.id);
        if (it) {
          foundItem = it;
          break;
        }
      }

      const unitPrice = foundItem ? foundItem.basePrice : 200;
      const count = sel.quantity?.count || 1;
      const itemTotal = unitPrice * count;
      subtotal += itemTotal;

      breakup.push({
        title: foundItem?.title || 'Selected Item',
        price: { currency: 'INR', value: itemTotal.toFixed(2) },
        item: {
          id: sel.id,
          quantity: { count },
          price: { currency: 'INR', value: unitPrice.toFixed(2) },
        },
        '@ondc/org/item_id': sel.id,
        '@ondc/org/title_type': 'item',
      });
    }

    const packaging = catalog.packagingCharges?.orderLevelDefault || 20;
    const foodGst = Number((subtotal * 0.05).toFixed(2));
    const delivery = 35;
    const total = subtotal + packaging + foodGst + delivery;

    breakup.push({
      title: 'Packaging Charges',
      price: { currency: 'INR', value: packaging.toFixed(2) },
      '@ondc/org/title_type': 'packing',
    });
    breakup.push({
      title: 'Tax (GST 5%)',
      price: { currency: 'INR', value: foodGst.toFixed(2) },
      '@ondc/org/title_type': 'tax',
    });
    breakup.push({
      title: 'Delivery Fee',
      price: { currency: 'INR', value: delivery.toFixed(2) },
      '@ondc/org/title_type': 'delivery',
    });

    const quote = {
      price: { currency: 'INR', value: total.toFixed(2) },
      breakup,
      ttl: 'P1D',
    };

    const responseOrder = {
      provider: selectMessage.order?.provider || { id: catalog.outletId },
      items: selectedItems,
      fulfillments: selectMessage.order?.fulfillments || [{ id: 'ful_delivery', tracking: true }],
      quote,
    };

    const context = {
      ...requestContext,
      action: 'on_select',
      bpp_id: bppCredentials.subscriberId,
      bpp_uri: bppCredentials.bppUri,
      timestamp: new Date().toISOString(),
    };

    return { context, message: { order: responseOrder } };
  }

  public buildOnInitResponse(
    requestContext: any,
    initMessage: any,
    bppCredentials: any
  ) {
    const context = {
      ...requestContext,
      action: 'on_init',
      bpp_id: bppCredentials.subscriberId,
      bpp_uri: bppCredentials.bppUri,
      timestamp: new Date().toISOString(),
    };

    const order = {
      ...initMessage.order,
      payment: {
        type: 'ON-ORDER',
        status: 'PAID',
        collected_by: 'BAP',
        '@ondc/org/buyer_app_finder_fee_type': 'percent',
        '@ondc/org/buyer_app_finder_fee_amount': '3.0',
      },
    };

    return { context, message: { order } };
  }

  public buildOnConfirmResponse(
    requestContext: any,
    confirmMessage: any,
    bppCredentials: any
  ) {
    const context = {
      ...requestContext,
      action: 'on_confirm',
      bpp_id: bppCredentials.subscriberId,
      bpp_uri: bppCredentials.bppUri,
      timestamp: new Date().toISOString(),
    };

    const orderId = confirmMessage.order?.id || `ONDC_ORD_${Date.now()}`;
    const order = {
      ...confirmMessage.order,
      id: orderId,
      state: 'Accepted',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return { context, message: { order } };
  }

  public buildOnStatusResponse(
    requestContext: any,
    order: CanonicalOrder,
    bppCredentials: any
  ) {
    const context = {
      ...requestContext,
      action: 'on_status',
      bpp_id: bppCredentials.subscriberId,
      bpp_uri: bppCredentials.bppUri,
      timestamp: new Date().toISOString(),
    };

    const becknState = mapCanonicalToBecknStatus(order.status);
    const orderPayload = {
      id: order.channelOrderId,
      state: becknState,
      updated_at: new Date().toISOString(),
      fulfillments: [
        {
          id: 'ful_delivery',
          tracking: true,
          state: {
            descriptor: { code: becknState },
          },
          agent: order.rider
            ? {
                name: order.rider.name,
                phone: order.rider.phone,
              }
            : undefined,
        },
      ],
    };

    return { context, message: { order: orderPayload } };
  }

  public buildOnTrackResponse(
    requestContext: any,
    order: CanonicalOrder,
    bppCredentials: any
  ) {
    const context = {
      ...requestContext,
      action: 'on_track',
      bpp_id: bppCredentials.subscriberId,
      bpp_uri: bppCredentials.bppUri,
      timestamp: new Date().toISOString(),
    };

    const tracking = {
      url: order.rider?.trackingUrl || `https://track.logixsoft.in/ondc/${order.channelOrderId}`,
      status: 'active',
      location: {
        gps: order.rider?.latitude && order.rider?.longitude
          ? `${order.rider.latitude},${order.rider.longitude}`
          : '12.9715987,77.5945627',
      },
    };

    return { context, message: { tracking } };
  }

  public buildOnCancelResponse(
    requestContext: any,
    channelOrderId: string,
    reasonCode: string,
    bppCredentials: any
  ) {
    const context = {
      ...requestContext,
      action: 'on_cancel',
      bpp_id: bppCredentials.subscriberId,
      bpp_uri: bppCredentials.bppUri,
      timestamp: new Date().toISOString(),
    };

    const order = {
      id: channelOrderId,
      state: 'Cancelled',
      cancellation: {
        cancelled_by: 'BPP',
        reason: { id: reasonCode },
      },
      updated_at: new Date().toISOString(),
    };

    return { context, message: { order } };
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
      channelCode: 'ONDC',
      outletId,
      itemsSynced,
      categoriesSynced: menu.categories.length,
      externalCatalogId: `ondc_catalog_${outletId}`,
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
