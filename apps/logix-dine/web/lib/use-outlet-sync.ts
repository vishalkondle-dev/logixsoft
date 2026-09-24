"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";

export interface SyncMessage {
  type: string;
  topic: "TABLES" | "ORDERS" | "KITCHEN" | "ALL";
  outletId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

/**
 * Fetch a short-lived (2-min) signed JWT from the API that can be passed
 * as ?token= on the WebSocket URL.  Browsers cannot set Cookie headers on
 * WebSocket connections when crossing origins, so this ticket approach is
 * the reliable way to authenticate the upgrade request.
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
 * Real-time WebSocket hook connected to the Cloudflare Durable Object for the outlet.
 * Automatically receives instant push notifications when tables, orders, or kitchen tickets change,
 * and invalidates React Query caches with 0ms delay.
 *
 * Auth: fetches a short-lived JWT ticket via /auth/ws-ticket and passes it as
 * ?token= on the WS URL — this avoids cross-origin cookie restrictions in browsers.
 *
 * Uses a stable connectRef so that the onclose handler always invokes the latest
 * connect function even after outletId / restaurantId change (fixes stale-closure bug).
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

  // Stable ref that always holds the latest connect function.
  // onclose handlers use this so they never capture a stale closure.
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(async () => {
    if (!outletId || typeof window === "undefined") {
      setStatus("disconnected");
      return;
    }

    // Cancel any pending reconnect before opening a new socket
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close any previous socket cleanly (null handlers first to prevent spurious reconnect)
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

    // Fetch a short-lived WS auth ticket (bypasses cross-origin cookie issue)
    const ticket = await fetchWsTicket();
    if (!ticket) {
      // Not authenticated — don't retry immediately, will retry on reconnect backoff
      setStatus("disconnected");
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
      retryCountRef.current++;
      reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), delay);
      return;
    }

    // Reset retry count on successful ticket fetch
    retryCountRef.current = 0;

    const wsBase = API_BASE.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/api/live/outlets/${outletId}?token=${encodeURIComponent(ticket)}`;

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
            queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["kitchenOrders", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["deliveryOrders", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["riders", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["waiterRequests", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["waiterStats", restaurantId] });
          }
          if (topic === "KITCHEN" || topic === "ALL") {
            queryClient.invalidateQueries({ queryKey: ["kitchenOrders", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["orders", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["waiterStats", restaurantId] });
          }

          if (
            msg.type === "WAITER_CALL" ||
            msg.type === "WAITER_REQUEST_UPDATED" ||
            msg.type === "WAITER_CALL_STATUS_CHANGED"
          ) {
            queryClient.invalidateQueries({ queryKey: ["waiterRequests", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["waiterStats", restaurantId] });
          }

          if (
            msg.type === "RIDER_STATUS_UPDATED" ||
            msg.type === "DELIVERY_STATUS_UPDATED" ||
            msg.type === "RIDER_ASSIGNED"
          ) {
            queryClient.invalidateQueries({ queryKey: ["riders", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["deliveryOrders", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["orders", restaurantId] });
          }

          if (
            msg.type === "MENU_UPDATED" ||
            msg.type === "ITEM_TOGGLED" ||
            msg.type === "ITEM_CREATED" ||
            msg.type === "ITEM_DELETED"
          ) {
            queryClient.invalidateQueries({ queryKey: ["items", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["categories", restaurantId] });
            queryClient.invalidateQueries({ queryKey: ["posBootstrap", restaurantId] });
          }

          if (msg.type === "WAITER_CALL") {
            const d = (msg.data || {}) as any;
            notifications.show({
              title: `🛎️ Table ${d.tableNo || "Guest"} Service Call`,
              message: `${d.serviceLabel || "Staff Assistance"}${d.note ? `: "${d.note}"` : ""}`,
              color: "yellow",
              autoClose: 12000,
            });
          } else if (msg.type === "WAITER_REQUEST_UPDATED") {
            const d = (msg.data || {}) as any;
            if (d.status === "COMPLETED") {
              notifications.show({
                title: `✅ Table ${d.tableNo || "Guest"} Request Completed`,
                message: `${d.serviceLabel || "Request"} resolved`,
                color: "green",
                autoClose: 4000,
              });
            }
          } else if (msg.type === "NEW_ROUND") {
            const d = (msg.data || {}) as any;
            notifications.show({
              title: `🍽️ Table ${d.tableNo || "Guest"} - Round ${d.round || ""}`,
              message: `${d.itemsCount || 1} new item(s) ordered from table!`,
              color: "teal",
              autoClose: 8000,
            });
          }
        } catch (e) {
          console.warn("[useOutletSync] Error processing event:", e);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, capped at 10s
        // Always call connectRef.current so we use the latest closure (avoids stale outletId)
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        retryCountRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), delay);
      };

      ws.onerror = () => {
        // onclose will trigger reconnect
      };
    } catch (e) {
      console.warn("[useOutletSync] Failed to initialize WebSocket:", e);
      setStatus("disconnected");
    }
  }, [restaurantId, outletId, queryClient]);

  // Keep the ref in sync with the latest connect function
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

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

  return {
    status,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
  };
}
