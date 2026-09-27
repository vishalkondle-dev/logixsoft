export const relayOpenApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Logix Relay Gateway API',
    version: '1.0.0',
    description: 'High-performance, low-latency omnichannel relay gateway bridging Swiggy, Zomato, ONDC Beckn, and Magicpin with Logix Dine POS.',
    contact: {
      name: 'Logixsoft Team',
      url: 'https://logixsoft.in',
    },
  },
  servers: [
    { url: 'https://relay.logixsoft.in', description: 'Production Edge Gateway' },
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
                      example: ['SWIGGY', 'ZOMATO', 'MAGICPIN', 'ONDC'],
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
        summary: 'Swiggy Inbound Webhook',
        description: 'Ingests new orders, cancellations, and delivery updates from Swiggy with HMAC SHA-256 validation (<300ms SLA).',
        responses: {
          '200': { description: 'Acknowledged' },
          '401': { description: 'Invalid HMAC signature' },
        },
      },
    },
    '/webhooks/zomato': {
      post: {
        summary: 'Zomato Inbound Webhook',
        description: 'Ingests new orders, status transitions, and rider tracking from Zomato with signature validation (<300ms SLA).',
        responses: {
          '200': { description: 'Acknowledged' },
          '401': { description: 'Invalid signature' },
        },
      },
    },
    '/webhooks/magicpin': {
      post: {
        summary: 'Magicpin Inbound Webhook',
        description: 'Ingests voucher-applied orders from Magicpin with merchant verification (<300ms SLA).',
        responses: {
          '200': { description: 'Acknowledged' },
        },
      },
    },
    '/onboard/beckn/bpp/search': {
      post: {
        summary: 'ONDC Beckn /search',
        description: 'Returns restaurant catalog, descriptors, and pricing to buyer apps (Paytm, Pincode, Magicpin).',
        responses: {
          '200': { description: 'Catalog returned successfully' },
        },
      },
    },
    '/onboard/beckn/bpp/select': {
      post: {
        summary: 'ONDC Beckn /select',
        description: 'Generates itemized order quote with food taxes and packaging charges.',
        responses: {
          '200': { description: 'Quote returned successfully' },
        },
      },
    },
    '/onboard/beckn/bpp/init': {
      post: {
        summary: 'ONDC Beckn /init',
        description: 'Initializes billing, delivery address, and settlement terms.',
        responses: {
          '200': { description: 'Order initialized' },
        },
      },
    },
    '/onboard/beckn/bpp/confirm': {
      post: {
        summary: 'ONDC Beckn /confirm',
        description: 'Confirms canonical order, triggers desktop POS chime, and prints thermal KOT.',
        responses: {
          '200': { description: 'Order confirmed' },
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
    '/logistics/quote': {
      post: {
        summary: '3PL Multi-Carrier Live Quote',
        description: 'Queries Shadowfax, Dunzo, and Borzo for cheapest and fastest on-demand delivery quotes.',
        responses: {
          '200': { description: 'Live delivery quotes returned' },
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
  },
};
