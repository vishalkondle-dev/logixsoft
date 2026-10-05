"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Box, Title, Text, SimpleGrid, Paper, Badge, Button, Group, Stack,
  Center, Loader, ActionIcon, Select, Tooltip, TextInput, Tabs, Card,
  Divider, RingProgress,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck, IconClock, IconTableAlias, IconArrowRight, IconX,
  IconBan, IconMotorbike, IconShoppingBag, IconToolsKitchen2,
  IconSearch, IconVolume, IconVolumeOff, IconRefresh, IconFlame,
  IconAlertTriangle, IconReceipt, IconChefHat, IconBuildingStore,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";
import { useUiStore } from "@/lib/stores";
import { useKitchenOrders, qk } from "@/lib/queries";
import { markOrderReady, updateOrderItemStatus } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  getStatusVisual,
  getNextItemStatus,
} from "@/lib/order-status-ui";
import { useOutletSync } from "@/lib/use-outlet-sync";
import { getOrderChannel } from "@/lib/channel-helpers";

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio Context blocked or not supported
  }
}

function urgency(createdAt: string): { color: string; label: string; minutes: number } {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes >= 20) return { color: "red", label: `${minutes}m`, minutes };
  if (minutes >= 10) return { color: "orange", label: `${minutes}m`, minutes };
  return { color: "teal", label: `${minutes}m`, minutes };
}

export default function KitchenPage() {
  const { isAuthenticated, isLoading: authLoading, openLoginModal } = useAuth();
  const { restaurant, outlets, activeOutlet, setActiveOutlet, isLoading: restLoading, role, can } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;
  const queryClient = useQueryClient();

  const canView = can("kitchen:view");
  const canBump = can("kitchen:item_bump");

  const activeTab = useUiStore((s) => s.kdsStatusFilter);
  const setActiveTab = useUiStore((s) => s.setKdsStatusFilter);
  const soundEnabled = useUiStore((s) => s.soundEnabled);
  const toggleSound = useUiStore((s) => s.toggleSound);

  const [searchQuery, setSearchQuery] = useState("");
  const [marking, setMarking] = useState<string | null>(null);
  const [updatingAction, setUpdatingAction] = useState<{ itemId: string; action: "next" | "close" } | null>(null);
  const [, forceTick] = useState(0);

  // Real-time live sync via Cloudflare Durable Object
  const { isConnected, isConnecting } = useOutletSync(restaurantId, outletId);

  // Auto-refreshes in real-time via Cloudflare Durable Object
  const { data: rawOrders = [], isLoading: loading, refetch } = useKitchenOrders(
    restaurantId,
    outletId,
    { refetchInterval: false }
  );

  const orders = useMemo(() => {
    return rawOrders.filter(
      (o: any) =>
        !o.order.readyAt &&
        o.order.orderStatus !== "SERVED" &&
        o.order.orderStatus !== "CANCELLED"
    );
  }, [rawOrders]);

  // Track previous count for incoming audio chime
  const prevCountRef = useRef<number>(orders.length);
  useEffect(() => {
    if (soundEnabled && orders.length > prevCountRef.current) {
      playChime();
    }
    prevCountRef.current = orders.length;
  }, [orders.length, soundEnabled]);

  // Re-render every 30s to update elapsed-time badges
  useEffect(() => {
    const tick = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(tick);
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalItemsCooking = 0;
    let totalItemsReady = 0;
    let urgentOrdersCount = 0;

    for (const entry of orders) {
      const u = urgency(entry.order.createdAt);
      if (u.minutes >= 15) urgentOrdersCount++;

      for (const item of entry.items || []) {
        if (item.status === "ORDERED" || item.status === "PREPARING") {
          totalItemsCooking += item.qty || 1;
        } else if (item.status === "PREPARED") {
          totalItemsReady += item.qty || 1;
        }
      }
    }

    return {
      activeTickets: orders.length,
      totalItemsCooking,
      totalItemsReady,
      urgentOrdersCount,
    };
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((entry: any) => {
      const { order, items } = entry;
      const isDelivery = order.orderType === "DELIVERY" || order.tableNo === "Delivery" || Boolean(entry.delivery);
      const isTakeaway = !isDelivery && (order.orderType === "TAKEAWAY" || order.tableNo === "Takeaway");
      const isDineIn = !isDelivery && !isTakeaway;
      const u = urgency(order.createdAt);

      if (activeTab === "DINE_IN" && !isDineIn) return false;
      if (activeTab === "TAKEAWAY" && !isTakeaway) return false;
      if (activeTab === "DELIVERY" && !isDelivery) return false;
      if (activeTab === "URGENT" && u.minutes < 15) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesToken = String(order.orderNo || "").includes(q);
        const matchesTable = String(order.tableNo || "").toLowerCase().includes(q);
        const matchesItem = (items || []).some((it: any) =>
          (it.nameSnapshot || it.name || "").toLowerCase().includes(q)
        );
        if (!matchesToken && !matchesTable && !matchesItem) return false;
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  const handleMarkReady = async (orderId: string) => {
    setMarking(orderId);
    const previousOrders = queryClient.getQueryData<any[]>(qk.kitchenOrders(restaurantId, outletId));

    // Instant optimistic update: mark all items as prepared and order ready immediately
    queryClient.setQueryData<any[]>(qk.kitchenOrders(restaurantId, outletId), (old = []) => {
      return old.map((entry) => {
        if (entry.order?.id !== orderId) return entry;
        const updatedItems = (entry.items || []).map((it: any) =>
          it.status === "ORDERED" || it.status === "PREPARING"
            ? { ...it, status: "PREPARED", updatedAt: new Date().toISOString() }
            : it
        );
        return {
          ...entry,
          order: {
            ...entry.order,
            orderStatus: "PREPARED",
            readyAt: new Date().toISOString(),
          },
          items: updatedItems,
        };
      });
    });

    notifications.show({
      id: `ready-${orderId}`,
      title: "Order marked ready",
      message: "All items set to Prepared and runners notified",
      color: "teal",
      icon: <IconCheck size={16} />,
      autoClose: 2500,
    });

    try {
      await markOrderReady(restaurantId, orderId, outletId);
      queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, outletId), refetchType: "none" });
    } catch (err: any) {
      if (previousOrders) {
        queryClient.setQueryData(qk.kitchenOrders(restaurantId, outletId), previousOrders);
      }
      notifications.show({ title: "Error", message: err.message || "Failed to mark ready", color: "red" });
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
    const isCancel = actionPayload.action === "close" || actionPayload.action === "cancel";
    const nextStatus = isCancel ? "CANCELLED" : (actionPayload.status || getNextItemStatus(item.status));
    if (!nextStatus) return;

    // Snapshot previous query data for instant rollback on error
    const previousOrders = queryClient.getQueryData<any[]>(qk.kitchenOrders(restaurantId, outletId));

    // Instant optimistic update (0ms latency feedback)
    queryClient.setQueryData<any[]>(qk.kitchenOrders(restaurantId, outletId), (old = []) => {
      return old.map((entry) => {
        if (entry.order?.id !== orderId) return entry;
        const updatedItems = (entry.items || []).map((it: any) =>
          it.id === itemId
            ? { ...it, status: nextStatus, updatedAt: new Date().toISOString() }
            : it
        );
        const activeStatuses = updatedItems.filter((i: any) => i.status !== "CANCELLED").map((i: any) => i.status);
        const allCancelled = updatedItems.length > 0 && activeStatuses.length === 0;
        const allServed = activeStatuses.length > 0 && activeStatuses.every((s: string) => s === "SERVED");
        const allPrepared = activeStatuses.length > 0 && activeStatuses.every((s: string) => s === "PREPARED" || s === "SERVED");
        const anyPreparing = activeStatuses.some((s: string) => s === "PREPARING");
        const newOrderStatus = allCancelled ? "CANCELLED" : allServed ? "SERVED" : allPrepared ? "PREPARED" : anyPreparing ? "PREPARING" : "ORDERED";
        const newReadyAt = (newOrderStatus === "PREPARED" || allPrepared) && !entry.order.readyAt ? new Date().toISOString() : entry.order.readyAt;

        return {
          ...entry,
          order: {
            ...entry.order,
            orderStatus: newOrderStatus,
            readyAt: newReadyAt,
          },
          items: updatedItems,
        };
      });
    });

    notifications.show({
      id: `item-${itemId}`,
      title: isCancel ? "Item cancelled" : "Item status updated",
      message: `${item.nameSnapshot || item.name}: ${isCancel ? "Cancelled" : `Advanced to ${nextStatus}`}`,
      color: isCancel ? "red" : "teal",
      icon: isCancel ? <IconBan size={16} /> : <IconCheck size={16} />,
      autoClose: 2000,
    });

    try {
      await updateOrderItemStatus(restaurantId, orderId, itemId, actionPayload, outletId);
      queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, outletId), refetchType: "none" });
    } catch (err: any) {
      if (previousOrders) {
        queryClient.setQueryData(qk.kitchenOrders(restaurantId, outletId), previousOrders);
      }
      notifications.show({ title: "Failed to update item", message: err.message || "Error", color: "red" });
    }
  };

  if (authLoading || restLoading) {
    return (
      <Center py={100}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Center py={100}>
        <Stack align="center" gap="md">
          <IconChefHat size={48} color="#af73d7" />
          <Title order={2}>Kitchen Display</Title>
          <Text c="dimmed" size="sm">Please sign in to access the kitchen display.</Text>
          <Button size="md" color="dinePrimary" onClick={openLoginModal}>Sign In</Button>
        </Stack>
      </Center>
    );
  }

  if (!canView) {
    return (
      <Center py={100}>
        <Stack align="center" gap="md" style={{ maxWidth: 450, textAlign: "center" }}>
          <IconChefHat size={48} color="#af73d7" />
          <Title order={3}>Access Restricted</Title>
          <Text c="dimmed" size="sm">
            Your current role does not have authorization to view the Kitchen Display System (<code>kitchen:view</code>).
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box pt="sm" pb="xl" px={{ base: "xs", sm: "md" }}>
      <Stack gap="lg">
        {/* ─── Top Header ─── */}
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm" align="center">
            <Box
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                backgroundColor: "rgba(175, 115, 215, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#af73d7",
              }}
            >
              <IconToolsKitchen2 size={24} stroke={2.2} />
            </Box>
            <div>
              <Group gap="xs" align="center">
                <Title order={2} style={{ lineHeight: 1.2 }}>Kitchen Display System</Title>
                <Badge
                  size="sm"
                  variant="dot"
                  color={isConnected ? "teal" : isConnecting ? "yellow" : "gray"}
                >
                  {isConnected ? "Live Synced" : isConnecting ? "Connecting..." : "Offline"}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {activeOutlet?.name || "Active Branch"} · Real-time order tickets & cooking preparation pipeline
              </Text>
            </div>
          </Group>

          <Group gap="xs" wrap="wrap">
            <Badge size="md" color="dinePrimary" variant="light" leftSection={<IconBuildingStore size={14} />}>
              {activeOutlet?.name || outlets[0]?.name || "Kitchen KDS"}
            </Badge>

            <Tooltip label={soundEnabled ? "Chime sound enabled on new tickets" : "Chime sound muted"}>
              <ActionIcon
                variant={soundEnabled ? "filled" : "light"}
                color={soundEnabled ? "indigo" : "gray"}
                size="lg"
                radius="md"
                onClick={toggleSound}
                aria-label="Toggle chime sound"
              >
                {soundEnabled ? <IconVolume size={18} /> : <IconVolumeOff size={18} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Refresh kitchen tickets">
              <ActionIcon
                variant="light"
                color="dinePrimary"
                size="lg"
                radius="md"
                onClick={() => refetch()}
                aria-label="Refresh tickets"
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* ─── Metric Cards ─── */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Paper p="sm" radius="md" withBorder shadow="xs" style={{ borderLeft: "4px solid #4f46e5" }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Active Tickets</Text>
                <Text size="xl" fw={800} c="dark">{metrics.activeTickets}</Text>
              </div>
              <ActionIcon variant="light" color="indigo" radius="md" size="lg">
                <IconReceipt size={20} />
              </ActionIcon>
            </Group>
          </Paper>

          <Paper p="sm" radius="md" withBorder shadow="xs" style={{ borderLeft: "4px solid #ea580c" }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Dishes Cooking</Text>
                <Text size="xl" fw={800} c="orange.7">{metrics.totalItemsCooking}</Text>
              </div>
              <ActionIcon variant="light" color="orange" radius="md" size="lg">
                <IconFlame size={20} />
              </ActionIcon>
            </Group>
          </Paper>

          <Paper p="sm" radius="md" withBorder shadow="xs" style={{ borderLeft: "4px solid #059669" }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Ready for Pickup</Text>
                <Text size="xl" fw={800} c="teal.7">{metrics.totalItemsReady}</Text>
              </div>
              <ActionIcon variant="light" color="teal" radius="md" size="lg">
                <IconCheck size={20} />
              </ActionIcon>
            </Group>
          </Paper>

          <Paper p="sm" radius="md" withBorder shadow="xs" style={{ borderLeft: `4px solid ${metrics.urgentOrdersCount > 0 ? "#dc2626" : "#868e96"}` }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Urgent (&gt;15m)</Text>
                <Text size="xl" fw={800} c={metrics.urgentOrdersCount > 0 ? "red.7" : "gray.6"}>
                  {metrics.urgentOrdersCount}
                </Text>
              </div>
              <ActionIcon variant="light" color={metrics.urgentOrdersCount > 0 ? "red" : "gray"} radius="md" size="lg">
                <IconAlertTriangle size={20} />
              </ActionIcon>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* ─── Tabs & Search Filters ─── */}
        <Paper p="xs" radius="md" withBorder shadow="xs">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Tabs value={activeTab} onChange={(val) => setActiveTab(val || "ALL")} variant="pills" color="dinePrimary">
              <Tabs.List>
                <Tabs.Tab value="ALL" leftSection={<IconToolsKitchen2 size={15} />}>
                  All Tickets ({orders.length})
                </Tabs.Tab>
                <Tabs.Tab value="DINE_IN" leftSection={<IconTableAlias size={15} />}>
                  Dine-In
                </Tabs.Tab>
                <Tabs.Tab value="TAKEAWAY" leftSection={<IconShoppingBag size={15} />}>
                  Takeaway
                </Tabs.Tab>
                <Tabs.Tab value="DELIVERY" leftSection={<IconMotorbike size={15} />}>
                  Delivery
                </Tabs.Tab>
                {metrics.urgentOrdersCount > 0 && (
                  <Tabs.Tab value="URGENT" color="red" leftSection={<IconAlertTriangle size={15} />}>
                    Urgent ({metrics.urgentOrdersCount})
                  </Tabs.Tab>
                )}
              </Tabs.List>
            </Tabs>

            <TextInput
              placeholder="Search token, table, dish..."
              size="xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              leftSection={<IconSearch size={14} />}
              style={{ minWidth: 220 }}
            />
          </Group>
        </Paper>

        {/* ─── Tickets Grid ─── */}
        {loading ? (
          <Center py={80}><Loader color="dinePrimary" size="md" /></Center>
        ) : !filteredOrders.length ? (
          <Paper p="xl" radius="md" withBorder shadow="xs">
            <Center py={40}>
              <Stack align="center" gap="sm">
                <Box
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    backgroundColor: "rgba(32, 201, 151, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#059669",
                  }}
                >
                  <IconChefHat size={32} />
                </Box>
                <Title order={3}>All Caught Up!</Title>
                <Text size="sm" c="dimmed" ta="center" maw={380}>
                  {searchQuery || activeTab !== "ALL"
                    ? "No kitchen tickets match your current filters."
                    : "There are no pending tickets in the kitchen right now. New orders will appear here automatically in real-time."}
                </Text>
                {(searchQuery || activeTab !== "ALL") && (
                  <Button
                    size="xs"
                    variant="light"
                    color="dinePrimary"
                    onClick={() => {
                      setActiveTab("ALL");
                      setSearchQuery("");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </Stack>
            </Center>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, xl: 4 }} spacing="md">
            {filteredOrders.map((entry: any) => {
              const { order, items } = entry;
              const u = urgency(order.createdAt);
              const orderStatusVisual = getStatusVisual(order.orderStatus || "ORDERED");
              const OrderStatusIcon = orderStatusVisual.icon;

              const activeItems = (items || []).filter((i: any) => i.status !== "CANCELLED");
              const allItemsPrepared =
                activeItems.length > 0 &&
                activeItems.every((i: any) => i.status === "PREPARED" || i.status === "SERVED");

              const channel = getOrderChannel(order, entry.delivery);
              const isDelivery = order.orderType === "DELIVERY" || order.tableNo === "Delivery" || Boolean(entry.delivery) || Boolean(channel);
              const isTakeaway = !isDelivery && (order.orderType === "TAKEAWAY" || order.tableNo === "Takeaway");

              return (
                <Paper
                  key={order.id}
                  radius="md"
                  withBorder
                  shadow="xs"
                  p="sm"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    borderTop: `4px solid ${u.color === "red" ? "#dc2626" : u.color === "orange" ? "#ea580c" : "#059669"}`,
                    backgroundColor: "#ffffff",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                >
                  <div>
                    {/* Header: Token No & Urgency */}
                    <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
                      <div>
                        <Group gap={6} align="center">
                          <Text fw={800} size="lg" c="dark">
                            Token #{order.orderNo}
                          </Text>
                        </Group>
                        {order.id && (
                          <Text size="10px" c="dimmed" ff="monospace">
                            {order.id.slice(-8)}
                          </Text>
                        )}
                      </div>

                      <Group gap={6} align="center" wrap="nowrap">
                        <Badge
                          size="sm"
                          variant="light"
                          color={u.color}
                          leftSection={<IconClock size={12} />}
                          fw={700}
                        >
                          {u.label}
                        </Badge>
                      </Group>
                    </Group>

                    {/* Order Type & Status Badges */}
                    <Group gap={6} mb="sm" wrap="wrap">
                      {channel ? (
                        <>
                          <Badge size="sm" variant="filled" color={channel.color} leftSection={<IconMotorbike size={12} />}>
                            {channel.name.toUpperCase()} DELIVERY
                          </Badge>
                          {channel.tag && (
                            <Badge size="xs" variant="light" color={channel.color}>
                              {channel.tag}
                            </Badge>
                          )}
                        </>
                      ) : isDelivery ? (
                        <Badge size="sm" variant="filled" color="teal" leftSection={<IconMotorbike size={12} />}>
                          DELIVERY
                        </Badge>
                      ) : isTakeaway ? (
                        <Badge size="sm" variant="light" color="orange" leftSection={<IconShoppingBag size={12} />}>
                          Takeaway
                        </Badge>
                      ) : (
                        <Badge size="sm" variant="light" color="indigo" leftSection={<IconTableAlias size={12} />}>
                          {order.tableNo ? (order.tableNo.toLowerCase().startsWith("table") ? order.tableNo : `Table ${order.tableNo}`) : "Dine-In"}
                        </Badge>
                      )}

                      <Badge size="xs" variant="outline" color={orderStatusVisual.color} leftSection={<OrderStatusIcon size={10} />}>
                        {orderStatusVisual.label}
                      </Badge>
                    </Group>

                    {/* Items List */}
                    <Stack gap={6} mb="md">
                      {([...(items || [])]
                        .sort(
                          (a: any, b: any) =>
                            (a.round || 1) - (b.round || 1) ||
                            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                        ))
                        .map((item: any) => {
                          const itemStatus = item.status || "ORDERED";
                          const isCancelled = itemStatus === "CANCELLED";
                          const isServed = itemStatus === "SERVED";
                          const isPrepared = itemStatus === "PREPARED";
                          const isPreparing = itemStatus === "PREPARING";
                          const itemVisual = getStatusVisual(itemStatus);
                          const ItemIcon = itemVisual.icon;
                          const nextStatus = getNextItemStatus(itemStatus);
                          const canNext = Boolean(nextStatus);
                          const canClose = !isCancelled && !isServed;

                          const isThisItemUpdating = updatingAction?.itemId === item.id;
                          const isNextLoading = isThisItemUpdating && updatingAction?.action === "next";
                          const isCloseLoading = isThisItemUpdating && updatingAction?.action === "close";

                          return (
                            <Paper
                              key={item.id}
                              p="xs"
                              radius="sm"
                              withBorder
                              style={{
                                backgroundColor: isCancelled
                                  ? "#fbfbfc"
                                  : isPrepared
                                  ? "rgba(32, 201, 151, 0.08)"
                                  : isPreparing
                                  ? "rgba(253, 126, 20, 0.06)"
                                  : "#f8f9fa",
                                borderColor: isPrepared
                                  ? "rgba(32, 201, 151, 0.3)"
                                  : isPreparing
                                  ? "rgba(253, 126, 20, 0.3)"
                                  : "rgba(0, 0, 0, 0.06)",
                              }}
                            >
                              <Stack gap={4}>
                                {/* Row 1: Dish name and quantity */}
                                <Group justify="space-between" align="flex-start" wrap="nowrap">
                                  <Group gap={6} align="center" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
                                    <Text
                                      size="sm"
                                      fw={600}
                                      c={isCancelled ? "dimmed" : "dark"}
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
                                      <Badge size="xs" color="indigo" variant="light">
                                        R{item.round}
                                      </Badge>
                                    )}
                                    <Badge size="sm" color="dark" variant="filled">
                                      ×{item.qty}
                                    </Badge>
                                  </Group>
                                </Group>

                                {/* Addons */}
                                {Array.isArray(item.addons) && item.addons.length > 0 && (
                                  <Text size="xs" c="dimmed" fw={500}>
                                    + {item.addons.map((a: any) => a.name).join(", ")}
                                  </Text>
                                )}

                                {/* Special instruction / notes */}
                                {item.note && (
                                  <Text size="xs" c="orange.8" fs="italic" fw={500}>
                                    Note: {item.note}
                                  </Text>
                                )}

                                {/* Row 2: Status pill & next action */}
                                <Group justify="space-between" align="center" mt={2} wrap="nowrap">
                                  <Badge
                                    size="xs"
                                    variant="light"
                                    color={itemVisual.color}
                                    leftSection={<ItemIcon size={10} />}
                                  >
                                    {itemVisual.label}
                                  </Badge>

                                  <Group gap={4} align="center" wrap="nowrap">
                                    {canNext && nextStatus && canBump && (
                                      <Tooltip label={`Advance to ${getStatusVisual(nextStatus).label}`} withArrow>
                                        <ActionIcon
                                          size="sm"
                                          color="dinePrimary"
                                          variant="filled"
                                          loading={isNextLoading}
                                          disabled={isThisItemUpdating && !isNextLoading}
                                          onClick={() => handleUpdateItemStatus(order.id, item, { action: "next" })}
                                          aria-label={`Advance to ${nextStatus}`}
                                        >
                                          <IconArrowRight size={13} />
                                        </ActionIcon>
                                      </Tooltip>
                                    )}

                                    {canClose && canBump && (
                                      <Tooltip label="Cancel item" withArrow>
                                        <ActionIcon
                                          size="sm"
                                          color="red"
                                          variant="subtle"
                                          loading={isCloseLoading}
                                          disabled={isThisItemUpdating && !isCloseLoading}
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
                  </div>

                  {/* Order Footer Ready Action */}
                  <Button
                    fullWidth
                    size="sm"
                    color={allItemsPrepared ? "teal" : "green"}
                    variant={allItemsPrepared ? "light" : "filled"}
                    leftSection={<IconCheck size={16} />}
                    loading={marking === order.id}
                    disabled={!canBump}
                    title={!canBump ? "Permission required: kitchen:item_bump" : undefined}
                    onClick={() => handleMarkReady(order.id)}
                  >
                    {allItemsPrepared ? "All Items Ready" : "Mark Order Ready"}
                  </Button>
                </Paper>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>
    </Box>
  );
}
