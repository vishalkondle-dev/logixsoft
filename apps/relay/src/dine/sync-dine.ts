import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient } from '@logixsoft/helpers/db';
import type { CanonicalOrder } from '@logixsoft/relay-schema';
import { desktopPosBridge } from '../bridge/desktop-bridge';

/**
 * Synchronizes an incoming Aggregator/D2C Canonical Order into Logix Dine's
 * primary POS database tables (`saleOrder` and `deliveryOrder`) and broadcasts
 * real-time events to Logix Dine's Kitchen Display System (KDS), Cashier POS,
 * and Electron Desktop PC with silent thermal KOT printing.
 */
export async function syncCanonicalOrderToLogixDine(
  order: CanonicalOrder,
  env?: any
): Promise<{ success: boolean; saleOrderId?: string; deliveryOrderId?: string; error?: string }> {
  try {
    // 1. Broadcast to Desktop POS Bridge for Audio Chime & Silent Thermal KOT Print
    desktopPosBridge.broadcastIncomingDeliveryOrder(order, env);

    // 2. Broadcast to Logix Dine OutletRoomDO Durable Object (if bound)
    if (env?.OUTLET_ROOM) {
      try {
        const id = env.OUTLET_ROOM.idFromName(order.outletId || 'outlet_default');
        const stub = env.OUTLET_ROOM.get(id);

        const syncMessage = {
          topic: 'ORDERS',
          type: 'DELIVERY_ORDER_ARRIVED',
          outletId: order.outletId,
          timestamp: Date.now(),
          data: {
            orderId: order.id,
            displayOrderId: order.displayOrderId,
            channelCode: order.channelCode,
            customerName: order.customer.name,
            totalAmount: order.pricing.totalAmount,
            itemCount: order.items.length,
          },
        };

        stub
          .fetch(
            new Request('http://do/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(syncMessage),
            })
          )
          .catch((err: any) => {
            console.warn('[SyncDine] OutletRoomDO broadcast error:', err);
          });
      } catch (err) {
        console.warn('[SyncDine] OutletRoomDO resolution error:', err);
      }
    }

    // 3. Persist into Logix Dine saleOrder & deliveryOrder PostgreSQL tables if database is connected
    const dbUrl =
      env?.HYPERDRIVE?.connectionString ||
      env?.DATABASE_URL ||
      (typeof process !== 'undefined' ? process.env?.DATABASE_URL : undefined);

    if (dbUrl) {
      try {
        const { client } = createDbWithClient({
          connectionString: dbUrl,
          maxConnections: 1,
        });

        const saleOrderId = order.id;
        const subtotalPaise = Math.round(order.pricing.subtotal * 100);
        const packagingChargePaise = Math.round(order.pricing.packagingCharge * 100);
        const deliveryChargePaise = Math.round(order.pricing.deliveryCharge * 100);
        const totalPaise = Math.round(order.pricing.totalAmount * 100);
        const orderNo = parseInt(order.channelOrderId.replace(/\D/g, '').slice(-4), 10) || Math.floor(100 + Math.random() * 900);
        const now = new Date();

        let restaurantId = order.outletId;
        const outletRows = await client`SELECT "restaurantId" FROM "restaurantOutlet" WHERE id = ${order.outletId} LIMIT 1`;
        if (outletRows.length > 0 && outletRows[0].restaurantId) {
          restaurantId = outletRows[0].restaurantId;
        }

        const nowStr = new Date().toISOString();

        // Raw SQL insert for zero-dependency cross-schema robustness
        await client`
          INSERT INTO "saleOrder" (
            "id", "restaurantId", "outletId", "orderNo", "tableNo", "customerPhone",
            "status", "orderStatus", "subtotalPaise", "paidPaise", "orderType",
            "packagingChargePaise", "deliveryChargePaise", "note", "createdAt", "updatedAt"
          ) VALUES (
            ${saleOrderId},
            ${restaurantId},
            ${order.outletId},
            ${orderNo},
            ${`${order.channelCode} #${order.displayOrderId}`},
            ${order.customer.phone || '0000000000'},
            'OPEN',
            'ORDERED',
            ${totalPaise},
            ${Math.round(order.pricing.customerPaid * 100)},
            'DELIVERY',
            ${packagingChargePaise},
            ${deliveryChargePaise},
            ${`${order.channelCode} Aggregator Order: ${order.displayOrderId} | Notes: ${order.specialInstructions || 'None'}`},
            ${nowStr},
            ${nowStr}
          )
          ON CONFLICT ("id") DO UPDATE SET
            "orderStatus" = EXCLUDED."orderStatus",
            "updatedAt" = EXCLUDED."updatedAt";
        `;

        const existingDelivery = await client`SELECT id FROM "deliveryOrder" WHERE "orderId" = ${saleOrderId} LIMIT 1`;
        let deliveryOrderId = existingDelivery.length > 0 ? existingDelivery[0].id : null;

        if (!deliveryOrderId) {
          deliveryOrderId = generateId('del');
          await client`
            INSERT INTO "deliveryOrder" (
              "id", "orderId", "restaurantId", "outletId", "customerName", "customerPhone",
              "addressLine1", "deliveryMode", "deliveryProvider", "riderName", "riderPhone",
              "deliveryOtp", "status", "createdAt", "updatedAt"
            ) VALUES (
              ${deliveryOrderId},
              ${saleOrderId},
              ${restaurantId},
              ${order.outletId},
              ${order.customer.name},
              ${order.customer.phone || '0000000000'},
              ${order.customer.address?.line1 || 'Online Delivery'},
              'THIRD_PARTY',
              ${order.channelCode},
              ${order.rider?.name || null},
              ${order.rider?.phone || null},
              null,
              ${order.rider ? 'ASSIGNED' : 'PENDING_ASSIGNMENT'},
              ${nowStr},
              ${nowStr}
            );
          `;
        }

        // 4. Insert line items into saleOrderItem
        if (order.items && order.items.length > 0) {
          const outletMenuItems = await client`
            SELECT id, name FROM "menuItem"
            WHERE "outletId" = ${order.outletId} OR "restaurantId" = ${restaurantId}
          `;
          const fallbackItemId = outletMenuItems.length > 0 ? outletMenuItems[0].id : null;

          for (const it of order.items) {
            const soiId = generateId('soi');
            let matchedItemId = fallbackItemId;
            if (outletMenuItems.length > 0) {
              const exactMatch = outletMenuItems.find(
                (m: any) => m.id === it.id || m.id === (it as any).channelItemId
              );
              if (exactMatch) {
                matchedItemId = exactMatch.id;
              } else {
                const nameMatch = outletMenuItems.find(
                  (m: any) =>
                    m.name.toLowerCase().trim() === it.name.toLowerCase().trim() ||
                    it.name.toLowerCase().includes(m.name.toLowerCase()) ||
                    m.name.toLowerCase().includes(it.name.toLowerCase())
                );
                if (nameMatch) {
                  matchedItemId = nameMatch.id;
                }
              }
            }

            if (matchedItemId) {
              const pricePaise = Math.round(
                (it.basePrice || (it.totalPrice / (it.quantity || 1))) * 100
              );
              const variantJson = it.selectedVariants?.[0]
                ? JSON.stringify({
                    id: it.selectedVariants[0].id,
                    name: it.selectedVariants[0].name,
                    pricePaise: Math.round(it.selectedVariants[0].price * 100),
                  })
                : null;
              const addonsJson = JSON.stringify(
                (it.selectedAddons || []).map((a: any) => ({
                  id: a.id,
                  name: a.name,
                  pricePaise: Math.round(a.price * 100),
                }))
              );

              await client`
                INSERT INTO "saleOrderItem" (
                  "id", "orderId", "itemId", "nameSnapshot", "pricePaiseSnapshot",
                  "qty", "status", "paymentStatus", "round", "note", "variant", "addons",
                  "createdAt", "updatedAt"
                ) VALUES (
                  ${soiId},
                  ${saleOrderId},
                  ${matchedItemId},
                  ${it.name},
                  ${pricePaise},
                  ${it.quantity || 1},
                  'ORDERED',
                  'PAID',
                  1,
                  ${it.itemInstructions || ''},
                  ${variantJson}::jsonb,
                  ${addonsJson}::jsonb,
                  ${nowStr},
                  ${nowStr}
                )
                ON CONFLICT ("id") DO NOTHING;
              `;
            }
          }
        }

        await client.end({ timeout: 2 }).catch(() => {});

        return {
          success: true,
          saleOrderId,
          deliveryOrderId,
        };
      } catch (dbErr: any) {
        console.warn('[SyncDine] PostgreSQL direct insertion skipped/failed:', dbErr.message);
      }
    }

    return {
      success: true,
      saleOrderId: order.id,
    };
  } catch (err: any) {
    console.error('[SyncDine] syncCanonicalOrderToLogixDine error:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}
