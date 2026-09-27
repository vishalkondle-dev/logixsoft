import { sendWhatsAppText } from '@logixsoft/wa';
import { relayStore } from '../db';
import type { RiderTrackingUpdate } from '@logixsoft/relay-schema';

/**
 * Dispatches live map tracking links and order status updates to the customer via WhatsApp.
 */
export async function sendCustomerRiderTrackingWhatsApp(update: RiderTrackingUpdate) {
  let customerPhone = update.customerPhone;
  let customerName = update.customerName;

  // If customer details not in event, look up from canonical order
  if (!customerPhone && update.orderId) {
    const order = await relayStore.getOrderById(update.orderId);
    if (order) {
      customerPhone = order.customer.phone;
      customerName = order.customer.name;
    }
  }

  if (!customerPhone) {
    console.warn(`[LogisticsWhatsApp] No customer phone found for order ${update.orderId}`);
    return { sent: false, reason: 'NO_PHONE' };
  }

  const trackingLink = update.trackingUrl || `https://track.logixsoft.in/3pl/${update.waybillNumber}`;
  const riderName = update.riderName || 'Your Delivery Rider';
  const riderPhone = update.riderPhone ? ` (${update.riderPhone})` : '';

  let messageText = '';
  switch (update.status) {
    case 'RIDER_ASSIGNED':
      messageText =
        `🍽️ *Logix Dine Update*\n\n` +
        `Hi ${customerName || 'there'}! A delivery partner has been assigned for your order.\n\n` +
        `🛵 *Rider:* ${riderName}${riderPhone}\n` +
        `📍 *Live Map:* ${trackingLink}\n\n` +
        `Our kitchen is freshly preparing your food!`;
      break;

    case 'ARRIVED_AT_STORE':
      messageText =
        `🍽️ *Logix Dine Update*\n\n` +
        `Your delivery partner has arrived at our outlet to pick up your order.\n\n` +
        `🛵 *Rider:* ${riderName}\n` +
        `📍 *Live Map:* ${trackingLink}`;
      break;

    case 'OUT_FOR_DELIVERY':
      messageText =
        `🚀 *Order on the Way!*\n\n` +
        `Hi ${customerName || 'there'}! Your food is packed hot & fresh and is out for delivery.\n\n` +
        `🛵 *Rider:* ${riderName}${riderPhone}\n` +
        `📍 *Track Live Location:* ${trackingLink}\n` +
        `⏱️ *ETA:* ${update.etaMinutes || 15} minutes.\n\n` +
        `Enjoy your meal!`;
      break;

    case 'DELIVERED':
      messageText =
        `✅ *Order Delivered!*\n\n` +
        `Your order has been delivered by ${riderName}. Thank you for ordering with Logix Dine!\n\n` +
        `How was your food? Rate us here: https://dine.logixsoft.in/feedback`;
      break;

    default:
      messageText =
        `🍽️ *Logix Dine Delivery Update*\n\n` +
        `Status: ${update.status.replace(/_/g, ' ')}\n` +
        `Track: ${trackingLink}`;
  }

  try {
    const res = await sendWhatsAppText(customerPhone, messageText);
    return {
      sent: true,
      messageId: res.messageId,
      customerPhone,
      status: update.status,
    };
  } catch (err: any) {
    console.error(`[LogisticsWhatsApp] Failed sending WhatsApp tracking to ${customerPhone}:`, err);
    return {
      sent: false,
      error: err.message,
    };
  }
}
