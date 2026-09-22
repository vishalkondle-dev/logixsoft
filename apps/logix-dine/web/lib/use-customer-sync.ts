"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "./queries";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export interface CustomerSyncOptions {
  activeOutletIds?: string[];
}

/**
 * Real-time Customer WebSocket hook connecting to Cloudflare Durable Objects.
 * Subscribes to customer-specific and outlet-specific rooms for 0ms push updates
 * when orders are created, items progress in the kitchen, bills are settled, or profile is updated.
 *
 * Replaces polling entirely with native Cloudflare WebSocket Hibernation.
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

  const connect = useCallback(() => {
    if (!rawPhone || typeof window === "undefined") {
      setStatus("disconnected");
      return;
    }

    // Clean up previous main customer socket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";
    const wsBase = apiUrl.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/api/live/customers/${rawPhone}`;

    setStatus("connecting");

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
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, capped at 10s
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        retryCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // Handled by onclose
      };
    } catch (err) {
      console.warn("[useCustomerSync] Failed to initialize WebSocket:", err);
      setStatus("disconnected");
    }
  }, [rawPhone, queryClient]);

  // Connect to customer room DO
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Also connect to active outlet DOs for redundant real-time kitchen & order events
  useEffect(() => {
    if (typeof window === "undefined" || activeOutletIds.length === 0) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";
    const wsBase = apiUrl.replace(/^http/, "ws");

    activeOutletIds.forEach((outletId) => {
      if (!outletId || outletWsRefs.current.has(outletId)) return;

      try {
        const outletWs = new WebSocket(`${wsBase}/api/live/outlets/${outletId}`);
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

    return () => {
      outletWsRefs.current.forEach((sock) => {
        try {
          sock.close();
        } catch {
          // ignore
        }
      });
      outletWsRefs.current.clear();
    };
  }, [activeOutletIds, queryClient]);

  return {
    status,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    isDisconnected: status === "disconnected",
  };
}
