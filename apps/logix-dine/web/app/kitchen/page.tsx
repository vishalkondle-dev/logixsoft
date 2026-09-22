"use client";

import React, { useState, useEffect } from "react";
import {
  Box, Title, Text, SimpleGrid, Paper, Badge, Button, Group, Stack,
  Center, Loader, ActionIcon, Select, Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck, IconClock, IconLogout, IconTableAlias,
  IconArrowRight, IconX, IconBan, IconMotorbike,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";
import { useKitchenOrders, qk } from "@/lib/queries";
import { markOrderReady, updateOrderItemStatus } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  getStatusVisual,
  getNextItemStatus,
} from "@/lib/order-status-ui";
import { useOutletSync } from "@/lib/use-outlet-sync";

function urgency(createdAt: string): { color: string; label: string; minutes: number } {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes >= 20) return { color: "#e03131", label: `${minutes}m`, minutes };
  if (minutes >= 10) return { color: "#f59f00", label: `${minutes}m`, minutes };
  return { color: "#2f9e44", label: `${minutes}m`, minutes };
}

export default function KitchenPage() {
  const { isAuthenticated, isLoading: authLoading, openLoginModal, signOut } = useAuth();
  const { restaurant, outlets, activeOutlet, setActiveOutlet, isLoading: restLoading, role } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;
  const queryClient = useQueryClient();

  const [marking, setMarking] = useState<string | null>(null);
  const [updatingAction, setUpdatingAction] = useState<{ itemId: string; action: "next" | "close" } | null>(null);
  const [, forceTick] = useState(0);

  // Real-time live sync via Cloudflare Durable Object
  const { isConnected, isConnecting } = useOutletSync(restaurantId, outletId);

  // Auto-refreshes in real-time via WebSocket (30s fallback when offline)
  const { data: rawOrders = [], isLoading: loading, refetch } = useKitchenOrders(
    restaurantId,
    outletId,
    { refetchInterval: isConnected ? false : 30_000 }
  );
  const orders = rawOrders.filter((o: any) => !o.order.readyAt && o.order.orderStatus !== "SERVED" && o.order.orderStatus !== "CANCELLED");

  // Re-render every 30s to update elapsed-time badges
  useEffect(() => {
    const tick = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(tick);
  }, []);

  const handleMarkReady = async (orderId: string) => {
    setMarking(orderId);
    try {
      await markOrderReady(restaurantId, orderId, outletId);
      queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, outletId) });
      notifications.show({ title: "Order marked ready", message: "All items set to Prepared", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setMarking(null);
    }
  };

  const handleUpdateItemStatus = async (
    orderId: string,
    item: any,
    actionPayload: { status?: string; action?: "next" | "close" | "cancel" },
  ) => {
    const itemId = item.id;
    const actionType = actionPayload.action === "close" || actionPayload.action === "cancel" ? "close" : "next";
    setUpdatingAction({ itemId, action: actionType });
    try {
      await updateOrderItemStatus(restaurantId, orderId, itemId, actionPayload, outletId);
      queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, outletId) });

      const isCancel = actionPayload.action === "close" || actionPayload.action === "cancel";
      notifications.show({
        title: isCancel ? "Item cancelled" : "Item status updated",
        message: `${item.nameSnapshot}: ${isCancel ? "Cancelled" : "Advanced to next stage"}`,
        color: isCancel ? "red" : "green",
        icon: isCancel ? <IconBan size={16} /> : <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({ title: "Failed to update item", message: err.message || "Error", color: "red" });
    } finally {
      setUpdatingAction(null);
    }
  };

  if (authLoading || restLoading) {
    return (
      <Center py={100} style={{ minHeight: "100dvh" }}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Center style={{ minHeight: "100dvh" }}>
        <Stack align="center" gap="md">
          <Title order={2} c="white">Kitchen Display</Title>
          <Button size="lg" color="dinePrimary" onClick={openLoginModal}>Sign In</Button>
        </Stack>
      </Center>
    );
  }

  if (!restaurant) {
    return (
      <Center style={{ minHeight: "100dvh" }}>
        <Text c="white">No restaurant found for this account.</Text>
      </Center>
    );
  }

  return (
    <Box py="md" px={{ base: "xs", sm: "md" }}>
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap="xs" align="center">
            <Title order={2} c="white">Kitchen Display</Title>
            <Badge
              size="sm"
              variant="dot"
              color={isConnected ? "teal" : isConnecting ? "yellow" : "gray"}
            >
              {isConnected ? "Live Synced" : isConnecting ? "Connecting..." : "Offline"}
            </Badge>
          </Group>
          <Text size="sm" c="gray.4">{restaurant.name}{activeOutlet ? ` · ${activeOutlet.name}` : ""}</Text>
        </div>
        <Group>
          {outlets.length > 1 && (
            <Select
              size="xs"
              value={activeOutlet?.id ?? null}
              onChange={(v) => v && setActiveOutlet(v)}
              data={outlets.map((o) => ({ value: o.id, label: o.name }))}
              w={140}
            />
          )}
          {role !== "KITCHEN" && (
            <Button component="a" href={activeOutlet ? `/pos?outletId=${activeOutlet.id}` : "/pos"} size="sm" variant="light" color="gray">
              Back to POS
            </Button>
          )}
          <ActionIcon size="lg" variant="light" color="red" onClick={() => signOut()} title="Sign out">
            <IconLogout size={18} />
          </ActionIcon>
        </Group>
      </Group>

      {loading ? (
        <Center py={100}><Loader color="dinePrimary" /></Center>
      ) : !orders.length ? (
        <Center py={100}>
          <Stack align="center" gap="xs">
            <IconCheck size={48} color="#2f9e44" />
            <Text c="gray.4" size="lg">All caught up — no pending orders</Text>
          </Stack>
        </Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
          {orders.map((entry: any) => {
            const { order, items } = entry;
            const u = urgency(order.createdAt);
            const orderStatusVisual = getStatusVisual(order.orderStatus || "ORDERED");
            const OrderStatusIcon = orderStatusVisual.icon;

            const activeItems = items.filter((i: any) => i.status !== "CANCELLED");
            const allItemsPrepared = activeItems.length > 0 && activeItems.every((i: any) => i.status === "PREPARED" || i.status === "SERVED");

            return (
              <Paper
                key={order.id}
                radius="md"
                p="md"
                style={{ background: "#252525", borderLeft: `4px solid ${u.color}` }}
              >
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text fw={800} size="xl" c="white">Token #{order.orderNo}</Text>
                    {order.id && <Text size="xs" c="gray.5" ff="monospace">{order.id}</Text>}
                  </div>
                  <Group gap={6}>
                    <Badge size="xs" color={orderStatusVisual.color} leftSection={<OrderStatusIcon size={10} />}>
                      {orderStatusVisual.label}
                    </Badge>
                    <Badge size="md" style={{ background: u.color, color: "white" }} leftSection={<IconClock size={12} />}>
                      {u.label}
                    </Badge>
                  </Group>
                </Group>

                {(order.orderType === "DELIVERY" || order.tableNo === "Delivery" || Boolean(order.delivery)) ? (
                  <Badge size="sm" variant="filled" color="teal" mb="sm" leftSection={<IconMotorbike size={12} />}>
                    DELIVERY
                  </Badge>
                ) : order.tableNo ? (
                  <Badge size="sm" variant="light" color="gray" mb="sm" leftSection={<IconTableAlias size={12} />}>
                    {order.tableNo === "Takeaway" ? "Takeaway" : `Table ${order.tableNo}`}
                  </Badge>
                ) : null}

                {/* Items List with Next and Close buttons */}
                <Stack gap={6} mb="md">
                  {([...(items || [])].sort((a: any, b: any) => (a.round || 1) - (b.round || 1) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())).map((item: any) => {
                    const itemStatus = item.status || "ORDERED";
                    const isCancelled = itemStatus === "CANCELLED";
                    const isServed = itemStatus === "SERVED";
                    const isPrepared = itemStatus === "PREPARED";
                    const itemVisual = getStatusVisual(itemStatus);
                    const ItemIcon = itemVisual.icon;
                    const nextStatus = getNextItemStatus(itemStatus);
                    const canNext = Boolean(nextStatus);
                    const canClose = !isCancelled && !isServed;

                    const isThisItemUpdating = updatingAction?.itemId === item.id;
                    const isNextLoading = isThisItemUpdating && updatingAction?.action === "next";
                    const isCloseLoading = isThisItemUpdating && updatingAction?.action === "close";
                    const isNextDisabled = isThisItemUpdating && !isNextLoading;
                    const isCloseDisabled = isThisItemUpdating && !isCloseLoading;

                    return (
                      <Paper
                        key={item.id}
                        p="xs"
                        radius="sm"
                        style={{
                          background: isCancelled
                            ? "rgba(224, 49, 49, 0.1)"
                            : isPrepared
                            ? "rgba(32, 201, 151, 0.12)"
                            : "rgba(255, 255, 255, 0.05)",
                          border: isPrepared ? "1px solid rgba(32, 201, 151, 0.3)" : undefined,
                        }}
                      >
                        <Stack gap={5}>
                          {/* Row 1: Dish name and quantity / round badge */}
                          <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <Group gap={6} align="center" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                size="sm"
                                fw={600}
                                c={isCancelled ? "gray.6" : "white"}
                                style={{
                                  textDecoration: isCancelled ? "line-through" : "none",
                                  wordBreak: "break-word",
                                  lineHeight: 1.3,
                                }}
                              >
                                {item.nameSnapshot || item.name}
                              </Text>
                              {item.variant && (
                                <Badge size="xs" variant="light" color="blue">
                                  {item.variant.name}
                                </Badge>
                              )}
                            </Group>
                            <Group gap={4} align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
                              {item.round && item.round > 1 && (
                                <Badge size="xs" color="indigo" variant="light">R{item.round}</Badge>
                              )}
                              <Badge size="xs" color="dark" variant="filled">×{item.qty}</Badge>
                            </Group>
                          </Group>

                          {Array.isArray(item.addons) && item.addons.length > 0 && (
                            <Text size="xs" c="yellow.4" fw={500}>
                              + {item.addons.map((a: any) => a.name).join(", ")}
                            </Text>
                          )}

                          {item.note && (
                            <Text size="xs" c="orange.3" fs="italic">Note: {item.note}</Text>
                          )}

                          {/* Row 2: Status badge on left, Action buttons on right */}
                          <Group justify="space-between" align="center" mt={2} wrap="nowrap">
                            <Badge
                              size="xs"
                              variant="light"
                              color={itemVisual.color}
                              leftSection={<ItemIcon size={10} />}
                            >
                              {itemVisual.label}
                            </Badge>

                            <Group gap={6} align="center" wrap="nowrap">
                              {/* Next button */}
                              {canNext && nextStatus && (
                                <Tooltip label={`Next: ${getStatusVisual(nextStatus).label}`} withArrow position="top">
                                  <ActionIcon
                                    size="sm"
                                    color="dinePrimary"
                                    variant="filled"
                                    loading={isNextLoading}
                                    disabled={isNextDisabled}
                                    onClick={() => handleUpdateItemStatus(order.id, item, { action: "next" })}
                                    aria-label={`Advance to ${nextStatus}`}
                                  >
                                    <IconArrowRight size={13} />
                                  </ActionIcon>
                                </Tooltip>
                              )}

                              {/* Close (Cancel) button */}
                              {canClose && (
                                <Tooltip label="Close (Cancel item)" withArrow position="top">
                                  <ActionIcon
                                    size="sm"
                                    color="red"
                                    variant="subtle"
                                    loading={isCloseLoading}
                                    disabled={isCloseDisabled}
                                    onClick={() => handleUpdateItemStatus(order.id, item, { action: "close" })}
                                    aria-label="Cancel item"
                                  >
                                    <IconX size={13} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </Group>
                          </Group>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>

                <Button
                  fullWidth
                  color={allItemsPrepared ? "teal" : "green"}
                  leftSection={<IconCheck size={16} />}
                  loading={marking === order.id}
                  onClick={() => handleMarkReady(order.id)}
                >
                  {allItemsPrepared ? "Order Ready ✓" : "Mark All Ready"}
                </Button>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}
    </Box>
  );
}
