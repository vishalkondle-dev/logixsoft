"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
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
 * Subscribes to customer-specific DO rooms for 0ms push updates when orders are created,
 * waiter calls change status, items progress in the kitchen, bills are settled, or profile is updated.
 *
 * Implements:
 * 1. Single authoritative customer room connection when phone number is available.
 * 2. Fallback outlet room connection only for anonymous table guests without phone login.
 * 3. Message deduplication (2.5s window) to eliminate duplicate toasts.
 * 4. Debounced query invalidation (150ms) to ensure exactly 1 /portal/session network request.
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

  // Debounce timer for query invalidations to prevent burst requests
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cache to deduplicate events received in rapid succession or across sockets
  const recentEventsRef = useRef<Map<string, number>>(new Map());

  const rawPhone = useMemo(() => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    return digits.slice(-10);
  }, [phone]);

  /**
   * Debounced invalidation of customer portal query.
   * Only calls queryClient.invalidateQueries once per 150ms window.
   * Does NOT call refetchQueries concurrently, letting React Query manage the active fetch cleanly.
   */
  const triggerCustomerPortalRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: qk.customerPortal() });
      debounceTimerRef.current = null;
    }, 150);
  }, [queryClient]);

  /**
   * Checks whether an incoming message is a duplicate within a 2.5s window.
   */
  const shouldProcessEvent = useCallback((msg: any): boolean => {
    if (!msg || typeof msg !== "object") return false;
    const now = Date.now();
    const d = msg.data || {};
    const key = `${msg.type}_${d.id || d.orderId || ""}_${d.status || d.targetStatus || ""}_${d.round || ""}`;

    const lastSeen = recentEventsRef.current.get(key);
    if (lastSeen && now - lastSeen < 2500) {
      return false; // Duplicate event
    }

    recentEventsRef.current.set(key, now);

    // Prune stale cache entries
    if (recentEventsRef.current.size > 100) {
      for (const [k, t] of recentEventsRef.current.entries()) {
        if (now - t > 10000) recentEventsRef.current.delete(k);
      }
    }

    return true;
  }, []);

  /**
   * Centralized message handler for both customer DO socket and fallback outlet DO socket.
   */
  const handleEventMessage = useCallback(
    (msg: any) => {
      try {
        if (!msg || msg.type === "pong") return;
        if (!shouldProcessEvent(msg)) return;

        // Invalidate customer portal query (debounced to avoid multiple /portal/session requests)
        triggerCustomerPortalRefresh();

        if (msg.type === "STAFF_ROLE_UPDATED" || msg.type === "STAFF_UPDATED") {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dine:role-updated", { detail: msg.data }));
          }
        }

        if (msg.type === "WAITER_REQUEST_UPDATED" || msg.type === "WAITER_CALL_STATUS_CHANGED") {
          const d = (msg.data || {}) as any;
          if (d.status === "IN_PROGRESS") {
            notifications.show({
              title: "Staff Attending",
              message: `Staff is attending to your request for "${d.serviceLabel || "Staff Assistance"}"`,
              color: "blue",
              autoClose: 6000,
            });
          } else if (d.status === "COMPLETED") {
            notifications.show({
              title: "Request Resolved",
              message: `Your request for "${d.serviceLabel || "Staff Assistance"}" has been completed`,
              color: "green",
              autoClose: 5000,
            });
          }
        } else if (msg.type === "ITEM_STATUS_CHANGED") {
          const d = (msg.data || {}) as any;
          if (d.targetStatus === "PREPARED") {
            notifications.show({
              title: "Dish Ready!",
              message: "Your dish is freshly prepared and will be served shortly",
              color: "teal",
              autoClose: 5000,
            });
          } else if (d.targetStatus === "SERVED") {
            notifications.show({
              title: "Dish Served",
              message: "Served to your table. Enjoy your meal!",
              color: "green",
              autoClose: 4000,
            });
          }
        } else if (msg.type === "ROUND_ADDED" || msg.type === "NEW_ROUND") {
          notifications.show({
            title: "New Round Placed",
            message: "Your new items have been queued in the kitchen",
            color: "violet",
            autoClose: 5000,
          });
        }
      } catch (e) {
        console.warn("[useCustomerSync] Error processing event:", e);
      }
    },
    [shouldProcessEvent, triggerCustomerPortalRefresh]
  );

  // Stable ref holding latest connect function to prevent stale closures in onclose
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(async () => {
    if (!rawPhone || typeof window === "undefined") {
      setStatus("disconnected");
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

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
          handleEventMessage(msg);
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        retryCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), delay);
      };

      ws.onerror = () => {
        // onclose handles reconnect
      };
    } catch (err) {
      console.warn("[useCustomerSync] Failed to initialize WebSocket:", err);
      setStatus("disconnected");
    }
  }, [rawPhone, handleEventMessage]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
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

  // Fallback: connect to outlet DO room ONLY when customer is NOT signed in with phone (anonymous table guest)
  // When rawPhone is available, the customer room DO receives all events exclusively and authoritatively
  useEffect(() => {
    if (typeof window === "undefined" || !activeOutletIdsKey || Boolean(rawPhone)) return;

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
              handleEventMessage(msg);
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
  }, [activeOutletIdsKey, rawPhone, handleEventMessage]);

  return {
    status,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    isDisconnected: status === "disconnected",
  };
}
