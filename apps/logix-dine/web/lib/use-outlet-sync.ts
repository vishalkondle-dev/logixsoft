"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "./queries";

export interface SyncMessage {
  type: string;
  topic: "TABLES" | "ORDERS" | "KITCHEN" | "ALL";
  outletId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

/**
 * Real-time WebSocket hook connected to the Cloudflare Durable Object for the outlet.
 * Automatically receives instant push notifications when tables, orders, or kitchen tickets change,
 * and invalidates React Query caches with 0ms delay.
 */
export function useOutletSync(
  restaurantId: string | undefined | null,
  outletId: string | undefined | null
) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);

  const connect = useCallback(() => {
    if (!outletId || typeof window === "undefined") {
      setStatus("disconnected");
      return;
    }

    // Close any previous socket cleanly
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
    const wsUrl = `${wsBase}/api/live/outlets/${outletId}`;

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
          const msg = JSON.parse(event.data) as SyncMessage;
          if (msg.type === "pong") return;

          if (!restaurantId) return;

          const topic = msg.topic;
          if (topic === "TABLES" || topic === "ALL") {
            queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["orders", restaurantId] });
          }
          if (topic === "ORDERS" || topic === "ALL") {
            queryClient.invalidateQueries({ queryKey: ["orders", restaurantId] });
          }
          if (topic === "KITCHEN" || topic === "ALL") {
            queryClient.invalidateQueries({ queryKey: ["kitchenOrders", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["orders", restaurantId] });
          }
        } catch (e) {
          console.warn("[useOutletSync] Error processing event:", e);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, capped at 10s
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        retryCountRef.current++;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose will trigger reconnect
      };
    } catch (e) {
      console.warn("[useOutletSync] Failed to initialize WebSocket:", e);
      setStatus("disconnected");
    }
  }, [restaurantId, outletId, queryClient]);

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

  return {
    status,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
  };
}
