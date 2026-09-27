export const relayOpenApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Logix Relay Gateway API',
    version: '1.0.0',
    description: 'High-performance, low-latency omnichannel relay gateway bridging Swiggy, Zomato, ONDC Beckn, Magicpin, and Direct D2C channels with Logix Dine POS.',
    contact: {
      name: 'Logixsoft Team',
      url: 'https://logixsoft.in',
    },
  },
  servers: [
    { url: 'https://relay.logixsoft.in', description: 'Production Edge Gateway (Cloudflare Workers)' },
    { url: 'http://localhost:8788', description: 'Local Development' },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Gateway Health Check',
        description: 'Returns real-time operational status, queue depth, active channels, and uptime.',
        responses: {
          '200': {
            description: 'Gateway is operational',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'HEALTHY' },
                    service: { type: 'string', example: 'Logix Relay Gateway' },
                    timestamp: { type: 'string', format: 'date-time' },
                    queueDepth: { type: 'integer', example: 0 },
                    uptimeSeconds: { type: 'integer', example: 1420 },
                    activeChannels: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['SWIGGY', 'ZOMATO', 'MAGICPIN', 'ONDC', 'OWNLY', 'TOING'],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/webhooks/swiggy': {
      post: {
        summary: 'Swiggy Inbound Webhook (Base / Order)',
        description: 'Ingests new orders, cancellations, and delivery updates from Swiggy with HMAC SHA-256 validation (<300ms Fast-Ack SLA).',
        responses: {
          '200': { description: 'Acknowledged & Queued' },
          '401': { description: 'Invalid HMAC signature' },
        },
      },
    },
    '/webhooks/swiggy/order': {
      post: {
        summary: 'Swiggy Order Ingestion Webhook',
        description: 'Ingests new orders from Swiggy with HMAC SHA-256 validation (<300ms SLA).',
        responses: {
          '200': { description: 'Fast-Ack Acknowledged' },
          '401': { description: 'Invalid HMAC signature' },
        },
      },
    },
    '/webhooks/swiggy/status': {
      post: {
        summary: 'Swiggy Rider & Delivery Status',
        description: 'Handles rider assignment, arrival, and delivery completion notifications.',
        responses: {
          '200': { description: 'Status updated' },
        },
      },
    },
    '/webhooks/zomato': {
      post: {
        summary: 'Zomato Inbound Webhook (Base / Order)',
        description: 'Ingests new orders and delivery status transitions from Zomato with signature validation (<300ms SLA).',
        responses: {
          '200': { description: 'Acknowledged & Queued' },
          '401': { description: 'Invalid signature' },
        },
      },
    },
    '/webhooks/zomato/order': {
      post: {
        summary: 'Zomato Order Placement Webhook',
        description: 'Ingests orders from Zomato food partner with cryptographic signature validation.',
        responses: {
          '200': { description: 'Acknowledged' },
          '401': { description: 'Invalid signature' },
        },
      },
    },
    '/webhooks/zomato/status': {
      post: {
        summary: 'Zomato Delivery Status Update',
        description: 'Receives delivery boy arrival and dispatch events from Zomato.',
        responses: {
          '200': { description: 'Status updated' },
        },
      },
    },
    '/webhooks/magicpin': {
      post: {
        summary: 'Magicpin Inbound Webhook (Base / Order)',
        description: 'Ingests voucher-applied orders from Magicpin with merchant verification (<300ms SLA).',
        responses: {
          '200': { description: 'Acknowledged' },
        },
      },
    },
    '/webhooks/magicpin/order': {
      post: {
        summary: 'Magicpin Order Ingestion',
        description: 'Ingests Magicpin orders with merchant voucher discount breakdowns.',
        responses: {
          '200': { description: 'Acknowledged' },
        },
      },
    },
    '/webhooks/ownly/order': {
      post: {
        summary: 'Ownly Direct D2C Order Webhook',
        description: 'Ingests direct branded storefront orders from Ownly with 0% aggregator commission.',
        responses: {
          '200': { description: 'Acknowledged' },
        },
      },
    },
    '/webhooks/toing/order': {
      post: {
        summary: 'Toing AI Voice Order Webhook',
        description: 'Ingests phone/voice AI agent orders directly into the kitchen stream.',
        responses: {
          '200': { description: 'Acknowledged' },
        },
      },
    },
    '/onboard/beckn/bpp/search': {
      post: {
        summary: 'ONDC Beckn /search (Catalog Discovery)',
        description: 'Returns restaurant catalog, descriptors, and pricing to buyer apps (Paytm, Pincode, Magicpin).',
        responses: {
          '200': { description: 'Catalog returned successfully' },
        },
      },
    },
    '/onboard/beckn/bpp/select': {
      post: {
        summary: 'ONDC Beckn /select (Quote Generation)',
        description: 'Generates itemized order quote with food taxes and packaging charges.',
        responses: {
          '200': { description: 'Quote returned successfully' },
        },
      },
    },
    '/onboard/beckn/bpp/init': {
      post: {
        summary: 'ONDC Beckn /init (Terms Handshake)',
        description: 'Initializes billing, delivery address, and settlement terms.',
        responses: {
          '200': { description: 'Order initialized' },
        },
      },
    },
    '/onboard/beckn/bpp/confirm': {
      post: {
        summary: 'ONDC Beckn /confirm (Order Placement)',
        description: 'Confirms canonical order, triggers desktop POS chime, and prints thermal KOT.',
        responses: {
          '200': { description: 'Order confirmed' },
        },
      },
    },
    '/onboard/beckn/bpp/status': {
      post: {
        summary: 'ONDC Beckn /status (Live State Feed)',
        description: 'Returns real-time fulfillment status of an ONDC network order.',
        responses: {
          '200': { description: 'Order status returned' },
        },
      },
    },
    '/onboard/beckn/bpp/track': {
      post: {
        summary: 'ONDC Beckn /track (Rider Tracking URL)',
        description: 'Returns live rider GPS tracking URL to the buyer app.',
        responses: {
          '200': { description: 'Tracking URL returned' },
        },
      },
    },
    '/onboard/beckn/bpp/cancel': {
      post: {
        summary: 'ONDC Beckn /cancel (Cancellation)',
        description: 'Handles mutual cancellation handshake per ONDC protocol.',
        responses: {
          '200': { description: 'Order cancelled' },
        },
      },
    },
    '/orders': {
      get: {
        summary: 'List Active Channel Orders',
        description: 'Returns active incoming aggregator and D2C orders across all channels.',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Active orders returned' },
        },
      },
    },
    '/orders/{orderId}': {
      get: {
        summary: 'Get Canonical Order Details',
        description: 'Returns normalized order, item breakdowns, taxes, packaging, and rider info.',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Order details' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/orders/{orderId}/accept': {
      post: {
        summary: 'Accept Order',
        description: 'Sends confirmation and prep time back to the aggregator platform.',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Order accepted' },
        },
      },
    },
    '/orders/{orderId}/ready': {
      post: {
        summary: 'Mark Food Ready',
        description: 'Alerts aggregator delivery partner that food is cooked and ready for parcel pickup.',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Food ready notified' },
        },
      },
    },
    '/orders/{orderId}/dispatch': {
      post: {
        summary: 'Dispatch Order',
        description: 'Marks food handed over to delivery partner rider.',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Dispatched' },
        },
      },
    },
    '/orders/{orderId}/reject': {
      post: {
        summary: 'Reject Order',
        description: 'Rejects order back to aggregator with structured failure reason.',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Order rejected' },
        },
      },
    },
    '/outlets/{outletId}/items/{itemId}/status': {
      post: {
        summary: 'Real-time 86ing (Out of Stock)',
        description: 'Fans out item out-of-stock toggle across Swiggy, Zomato, and ONDC in <1500ms.',
        parameters: [
          { name: 'outletId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Item stock updated across channels' },
        },
      },
    },
    '/outlets/{outletId}/status': {
      post: {
        summary: 'Store Pause / Rush Hour Toggle',
        description: 'Toggles restaurant online/offline state across all channels simultaneously.',
        parameters: [
          { name: 'outletId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Store status updated' },
        },
      },
    },
    '/outlets/{outletId}/integrations': {
      get: {
        summary: 'List Outlet Channel Integrations',
        description: 'Returns configuration status, store IDs, and price markups for all aggregators.',
        parameters: [
          { name: 'outletId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Integrations list returned' },
        },
      },
      post: {
        summary: 'Save/Update Channel Integration',
        description: 'Saves merchant credentials, markup percentages, and prep times with encryption.',
        parameters: [
          { name: 'outletId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Integration saved' },
        },
      },
    },
    '/outlets/{outletId}/integrations/{channelCode}': {
      get: {
        summary: 'Get Single Channel Integration',
        description: 'Returns masked credentials and operational settings for specified aggregator.',
        parameters: [
          { name: 'outletId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'channelCode', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Integration returned' },
          '404': { description: 'Integration not found' },
        },
      },
    },
    '/outlets/{outletId}/webhook-urls': {
      get: {
        summary: 'Get Channel Webhook URLs',
        description: 'Returns pasteable webhook endpoints and instructions for aggregator developer consoles.',
        parameters: [
          { name: 'outletId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Webhook URLs map returned' },
        },
      },
    },
    '/relay/inventory/item-status': {
      post: {
        summary: 'Relay 86ing Fan-Out',
        description: 'Sub-second inventory 86ing endpoint (<1.5s SLA).',
        responses: {
          '200': { description: 'Fan-out dispatched' },
        },
      },
    },
    '/relay/store/status': {
      post: {
        summary: 'Relay Store Rush Pause',
        description: 'Multi-channel rush-hour throttle and pause toggle.',
        responses: {
          '200': { description: 'Store pause updated' },
        },
      },
    },
    '/logistics/quote': {
      post: {
        summary: '3PL Multi-Carrier Live Quote',
        description: 'Queries Shadowfax, Dunzo, Borzo, and Porter for cheapest and fastest on-demand delivery quotes.',
        responses: {
          '200': { description: 'Live delivery quotes returned' },
        },
      },
    },
    '/logistics/dispatch': {
      post: {
        summary: 'Dispatch 3PL Courier',
        description: 'Books on-demand delivery rider and generates tracking waybill.',
        responses: {
          '200': { description: 'Rider booked' },
        },
      },
    },
    '/logistics/track/{waybillNumber}': {
      get: {
        summary: 'Track 3PL Waybill',
        description: 'Returns live rider GPS tracking and ETA.',
        parameters: [
          { name: 'waybillNumber', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Tracking info returned' },
        },
      },
    },
    '/reconciliation/upload': {
      post: {
        summary: 'Aggregator Settlement Audit',
        description: 'Uploads weekly aggregator CSV payout, cross-checks commissions against POS sales, and flags penalties.',
        responses: {
          '200': { description: 'Reconciliation report generated' },
        },
      },
    },
    '/reconciliation/upload-settlement': {
      post: {
        summary: 'Upload Settlement CSV',
        description: 'Parses settlement file and matches transaction records against saleOrder ledger.',
        responses: {
          '200': { description: 'Audit result returned' },
        },
      },
    },
    '/reconciliation/summary': {
      get: {
        summary: 'Reconciliation Summary Analytics',
        description: 'Returns gross sales, platform commissions, PG deductions, and net payouts across all channels.',
        responses: {
          '200': { description: 'Summary returned' },
        },
      },
    },
    '/reconciliation/discrepancies': {
      get: {
        summary: 'Reconciliation Discrepancy Auditor',
        description: 'Flags underpaid payouts, commission mismatches, and cancellation penalties.',
        responses: {
          '200': { description: 'Discrepancies returned' },
        },
      },
    },
    '/bridge/stats': {
      get: {
        summary: 'Desktop Bridge Stats',
        description: 'Returns real-time status of connected POS Electron desktop clients.',
        responses: {
          '200': { description: 'Stats returned' },
        },
      },
    },
    '/bridge/history': {
      get: {
        summary: 'Desktop Bridge Event History',
        description: 'Returns recent order arrival events broadcasted to desktop clients.',
        responses: {
          '200': { description: 'History returned' },
        },
      },
    },
    '/bridge/simulate-order': {
      post: {
        summary: 'Simulate Desktop POS Order Event',
        description: 'Broadcasts order event to test desktop audio chime and thermal silent printing.',
        responses: {
          '200': { description: 'Event broadcasted' },
        },
      },
    },
  },
};
