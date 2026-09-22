"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "./queries";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export interface CustomerSyncOptions {
  activeOutletIds?: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

/**
 * Fetch a short-lived (2-min) signed JWT ticket from the API that can be passed
 * as ?token= on the WebSocket URL. Browsers cannot set Cookie headers on
 * WebSocket connections cross-origin, so this ticket approach is the reliable
 * way to authenticate the upgrade request.
 */
async function fetchWsTicket(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/ws-ticket`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ticket ?? null;
  } catch {
    return null;
  }
}

/**
 * Real-time Customer WebSocket hook connecting to Cloudflare Durable Objects.
 * Subscribes to customer-specific and outlet-specific rooms for 0ms push updates
 * when orders are created, items progress in the kitchen, bills are settled, or profile is updated.
 *
 * Replaces polling entirely with native Cloudflare WebSocket Hibernation.
 * Uses ticket-based auth via ?token= to prevent browser cross-origin cookie omission.
 */
export function useCustomerSync(
  phone: string | undefined | null,
  options: CustomerSyncOptions = {}
) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const outletWsRefs = useRef<Map<string, WebSocket>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);

  const rawPhone = useMemo(() => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    return digits.slice(-10);
  }, [phone]);

  const activeOutletIds = options.activeOutletIds || [];

  // Stable ref holding latest connect function to prevent stale closures in onclose
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(async () => {
    if (!rawPhone || typeof window === "undefined") {
      setStatus("disconnected");
      return;
    }

    // Cancel any pending reconnect before opening a new socket
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clean up previous main customer socket cleanly
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    setStatus("connecting");

    // Fetch a short-lived WS auth ticket
    const ticket = await fetchWsTicket();
    if (!ticket) {
      setStatus("disconnected");
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
      retryCountRef.current++;
      reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), delay);
      return;
    }

    retryCountRef.current = 0;

    const wsBase = API_BASE.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/api/live/customers/${rawPhone}?token=${encodeURIComponent(ticket)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        retryCountRef.current = 0;

        // Keep-alive heartbeat ping every 25 seconds
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "pong") return;

          // Invalidate and immediately refetch customer portal query upon any event from Durable Object
          queryClient.invalidateQueries({ queryKey: qk.customerPortal() });
          queryClient.refetchQueries({ queryKey: qk.customerPortal() });
        } catch (e) {
          console.warn("[useCustomerSync] Error processing event:", e);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, capped at 10s
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        retryCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), delay);
      };

      ws.onerror = () => {
        // onclose will trigger reconnect
      };
    } catch (err) {
      console.warn("[useCustomerSync] Failed to initialize WebSocket:", err);
      setStatus("disconnected");
    }
  }, [rawPhone, queryClient]);

  // Keep ref up to date
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Connect to customer room DO
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
    };
  }, [connect]);

  const activeOutletIdsKey = (options.activeOutletIds || []).filter(Boolean).sort().join(",");

  // Also connect to active outlet DOs for redundant real-time kitchen & order events
  useEffect(() => {
    if (typeof window === "undefined" || !activeOutletIdsKey) return;

    const outletList = activeOutletIdsKey.split(",").filter(Boolean);
    let isCancelled = false;

    (async () => {
      const ticket = await fetchWsTicket();
      if (isCancelled || !ticket) return;

      const wsBase = API_BASE.replace(/^http/, "ws");

      outletList.forEach((outletId) => {
        if (!outletId || outletWsRefs.current.has(outletId)) return;

        try {
          const outletWs = new WebSocket(
            `${wsBase}/api/live/outlets/${outletId}?token=${encodeURIComponent(ticket)}`
          );
          outletWsRefs.current.set(outletId, outletWs);

          outletWs.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === "pong") return;
              // Instantly invalidate and refetch customer portal queries
              queryClient.invalidateQueries({ queryKey: qk.customerPortal() });
              queryClient.refetchQueries({ queryKey: qk.customerPortal() });
            } catch {
              // ignore
            }
          };

          outletWs.onclose = () => {
            outletWsRefs.current.delete(outletId);
          };
        } catch {
          // ignore
        }
      });
    })();

    return () => {
      isCancelled = true;
      outletWsRefs.current.forEach((sock) => {
        sock.onclose = null;
        sock.onerror = null;
        try {
          sock.close();
        } catch {
          // ignore
        }
      });
      outletWsRefs.current.clear();
    };
  }, [activeOutletIdsKey, queryClient]);

  return {
    status,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    isDisconnected: status === "disconnected",
  };
}
