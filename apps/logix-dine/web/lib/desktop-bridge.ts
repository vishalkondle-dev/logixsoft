/**
 * Logix Dine Desktop PC / Electron Bridge & Relay Gateway Listener
 * Listens for incoming aggregator delivery orders from Logix Relay,
 * triggers desktop audio chime, and prints KOT silently via window.logixDinePC.printReceipt({ silent: true }).
 *
 * Supports Cloudflare Durable Object WebSockets (/bridge/ws) with automatic fallback to SSE (/bridge/events).
 */

declare global {
  interface Window {
    logixDinePC?: {
      printReceipt: (options: {
        silent: boolean;
        type: 'KOT' | 'BILL';
        [key: string]: any;
      }) => Promise<{ success: boolean; printerName?: string }>;
      playAudioChime?: () => void;
      isDesktopApp?: boolean;
    };
  }
}

export function playAudioChime(): void {
  try {
    if (typeof window !== 'undefined') {
      if (window.logixDinePC?.playAudioChime) {
        window.logixDinePC.playAudioChime();
        return;
      }
      // Web Audio API synthesized chime
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    }
  } catch (err) {
    console.warn('[desktop-bridge] Could not play audio chime:', err);
  }
}

export async function printSilentViaDesktopPC(receiptPayload: any): Promise<boolean> {
  if (typeof window !== 'undefined' && window.logixDinePC?.printReceipt) {
    try {
      const res = await window.logixDinePC.printReceipt({
        silent: true,
        ...receiptPayload,
      });
      return res?.success === true;
    } catch (err) {
      console.error('[desktop-bridge] Failed to print receipt silently:', err);
      return false;
    }
  }
  return false;
}

export function connectRelayDesktopBridge(
  relayUrl = 'https://relay.logixsoft.in',
  outletId = 'outlet_default'
): () => void {
  if (typeof window === 'undefined') return () => {};

  let isClosed = false;
  let activeWs: WebSocket | null = null;
  let activeEventSource: EventSource | null = null;
  let reconnectTimer: any = null;

  async function handleOrderEvent(data: any) {
    console.log('[desktop-bridge] Inbound Delivery Order Received:', data.order?.displayOrderId || data.orderId);

    // 1. Play audio chime
    playAudioChime();

    // 2. Silent thermal KOT print
    if (data.printReceipt) {
      await printSilentViaDesktopPC(data.printReceipt);
    }
  }

  // Attempt Cloudflare Durable Object WebSocket connection
  function connectWebSocket() {
    if (isClosed) return;

    try {
      const wsUrl = `${relayUrl.replace(/^http/, 'ws')}/bridge/ws?outletId=${encodeURIComponent(outletId)}`;
      const ws = new WebSocket(wsUrl);
      activeWs = ws;

      ws.onopen = () => {
        console.log('[desktop-bridge] Connected to Logix Relay Edge Durable Object WebSocket');
        // Heartbeat ping
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'DELIVERY_ORDER_ARRIVED' || data.type === 'ORDER_PLACED') {
            await handleOrderEvent(data);
          }
        } catch (err) {
          console.error('[desktop-bridge] Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = () => {
        // Fall back to SSE if WebSocket fails or 501s
        if (!activeEventSource) {
          connectSSE();
        }
      };

      ws.onclose = () => {
        if (!isClosed) {
          reconnectTimer = setTimeout(connectWebSocket, 5000);
        }
      };
    } catch {
      connectSSE();
    }
  }

  function connectSSE() {
    if (isClosed || activeEventSource) return;

    try {
      const sse = new EventSource(`${relayUrl}/bridge/events?outletId=${encodeURIComponent(outletId)}`);
      activeEventSource = sse;

      sse.addEventListener('DELIVERY_ORDER_ARRIVED', async (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          await handleOrderEvent(data);
        } catch (err) {
          console.error('[desktop-bridge] Error handling SSE delivery event:', err);
        }
      });

      sse.onerror = () => {
        sse.close();
        activeEventSource = null;
        if (!isClosed) {
          reconnectTimer = setTimeout(connectSSE, 5000);
        }
      };
    } catch (err) {
      console.error('[desktop-bridge] SSE connection error:', err);
    }
  }

  // Start with WebSocket (Cloudflare DO)
  connectWebSocket();

  return () => {
    isClosed = true;
    clearTimeout(reconnectTimer);
    if (activeWs) activeWs.close();
    if (activeEventSource) activeEventSource.close();
  };
}
