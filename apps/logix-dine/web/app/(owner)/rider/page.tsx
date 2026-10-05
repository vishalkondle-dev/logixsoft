"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Title, Stack, Paper, Group, Text, Badge, Select, Button,
  Loader, Center, Modal, Divider, Box, ActionIcon, Tooltip,
  SimpleGrid, Alert, Tabs, TextInput, Card, Switch, RingProgress,
  Collapse,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import {
  IconMotorbike, IconCheck, IconClock, IconPhoneCall, IconBrandWhatsapp,
  IconMapPin, IconNavigation, IconVolume, IconVolumeOff, IconRefresh,
  IconAlertCircle, IconUser, IconCash, IconReceipt, IconChevronDown,
  IconChevronUp, IconCircleDot, IconPlus, IconNotes, IconCircleFilled, IconBuildingStore,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useOrders, useDeliveryRiders, useUpdateDeliveryStatus,
  useUpdateDeliveryRiderStatus, qk,
} from "@/lib/queries";
import { useOutletSync } from "@/lib/use-outlet-sync";
import { useQueryClient } from "@tanstack/react-query";
import { getOrderChannel } from "@/lib/channel-helpers";

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio Context blocked or unsupported
  }
}

function formatElapsed(createdAt?: string | null): { text: string; color: string } {
  if (!createdAt) return { text: "Just now", color: "teal" };
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return { text: "Just now", color: "teal" };
  if (diffMin < 10) return { text: `${diffMin}m ago`, color: "teal" };
  if (diffMin < 25) return { text: `${diffMin}m ago`, color: "yellow" };
  return { text: `${diffMin}m ago`, color: "red" };
}

export default function RiderPage() {
  const { restaurant, activeOutlet, outlets, setActiveOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("active");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);

  // Expanded items state for order card bag checks
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Verify Delivery OTP Modal state
  const [otpModalOrder, setOtpModalOrder] = useState<any | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Status updates mutations
  const updateDeliveryStatusMutation = useUpdateDeliveryStatus(restaurantId, outletId);
  const updateRiderStatusMutation = useUpdateDeliveryRiderStatus(restaurantId, outletId);

  // Durable Object Live Sync
  const { isConnected, isConnecting } = useOutletSync(restaurantId, outletId);

  // Fetch Delivery Riders
  const { data: riders = [], isLoading: ridersLoading } = useDeliveryRiders(restaurantId, outletId);

  // Fetch recent orders for active delivery tracking (real-time push via Durable Object)
  const {
    data: allOrders = [],
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useOrders(
    restaurantId,
    { outletId: outletId ?? undefined, limit: 100 },
    Boolean(restaurantId && outletId),
    { refetchInterval: false }
  );

  // Persist selected rider in localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("logix_dine_rider_id");
      if (saved && riders.some((r: any) => r.id === saved)) {
        setSelectedRiderId(saved);
      } else if (riders.length > 0 && !selectedRiderId) {
        setSelectedRiderId(riders[0].id);
        localStorage.setItem("logix_dine_rider_id", riders[0].id);
      }
    }
  }, [riders]);

  const handleSelectRider = (id: string | null) => {
    setSelectedRiderId(id);
    if (id && typeof window !== "undefined") {
      localStorage.setItem("logix_dine_rider_id", id);
    }
  };

  const activeRider = useMemo(() => {
    return riders.find((r: any) => r.id === selectedRiderId) || null;
  }, [riders, selectedRiderId]);

  // Filter delivery orders
  const deliveryOrders = useMemo(() => {
    return (allOrders as any[]).filter((entry) => {
      return entry.order?.orderType === "DELIVERY" || Boolean(entry.delivery) || entry.order?.tableNo === "Delivery";
    });
  }, [allOrders]);

  // My Active Deliveries
  const myActiveDeliveries = useMemo(() => {
    if (!activeRider) return [];
    return deliveryOrders.filter((entry) => {
      const isMine = entry.delivery?.riderId === activeRider.id;
      const status = entry.delivery?.status;
      return isMine && (status === "ASSIGNED" || status === "OUT_FOR_DELIVERY");
    });
  }, [deliveryOrders, activeRider]);

  // My Completed Today
  const myCompletedDeliveries = useMemo(() => {
    if (!activeRider) return [];
    return deliveryOrders.filter((entry) => {
      const isMine = entry.delivery?.riderId === activeRider.id;
      const status = entry.delivery?.status;
      return isMine && status === "DELIVERED";
    });
  }, [deliveryOrders, activeRider]);

  // Outlet Unassigned Delivery Pool (excludes aggregator-managed deliveries)
  const unassignedDeliveries = useMemo(() => {
    return deliveryOrders.filter((entry) => {
      const status = entry.delivery?.status;
      if (status === "CANCELLED" || entry.order?.status === "VOID") return false;
      if (status !== "PENDING_ASSIGNMENT" && entry.delivery?.riderId) return false;
      // Skip aggregator-managed deliveries — their riders are assigned by the platform
      const channel = getOrderChannel(entry.order, entry.delivery);
      if (channel?.isAggregator) return false;
      return true;
    });
  }, [deliveryOrders]);

  // Audio chime when active delivery count increases
  const prevActiveCount = useRef(myActiveDeliveries.length);
  useEffect(() => {
    if (myActiveDeliveries.length > prevActiveCount.current) {
      if (soundEnabled) {
        playChime();
      }
      notifications.show({
        title: "New Delivery Assigned!",
        message: "You have a new delivery order waiting for pickup.",
        color: "teal",
        icon: <IconMotorbike size={16} />,
      });
    }
    prevActiveCount.current = myActiveDeliveries.length;
  }, [myActiveDeliveries.length, soundEnabled]);

  // Duty stats
  const codToCollect = useMemo(() => {
    return myActiveDeliveries.reduce((sum, entry) => {
      const isPaid = entry.order?.status === "PAID";
      return isPaid ? sum : sum + (entry.order?.subtotalPaise || 0);
    }, 0);
  }, [myActiveDeliveries]);

  const codCollectedToday = useMemo(() => {
    return myCompletedDeliveries.reduce((sum, entry) => {
      return sum + (entry.order?.subtotalPaise || 0);
    }, 0);
  }, [myCompletedDeliveries]);

  // Toggle Duty Status
  const handleToggleDuty = async (checked: boolean) => {
    if (!activeRider) return;
    const nextStatus = checked ? "AVAILABLE" : "OFFLINE";
    try {
      await updateRiderStatusMutation.mutateAsync({
        riderId: activeRider.id,
        status: nextStatus,
      });
      notifications.show({
        title: checked ? "You are On Duty" : "You are Off Duty",
        message: checked ? "Ready to receive delivery orders." : "You won't receive new delivery assignments.",
        color: checked ? "green" : "gray",
      });
    } catch (err: any) {
      notifications.show({ title: "Failed to update status", message: err.message, color: "red" });
    }
  };

  // Start Delivery (Pick Up & Out for Delivery)
  const handleStartDelivery = async (orderId: string) => {
    try {
      await updateDeliveryStatusMutation.mutateAsync({
        orderId,
        body: { status: "OUT_FOR_DELIVERY", riderId: activeRider?.id },
      });
      notifications.show({
        title: "Delivery Started!",
        message: "Customer and outlet notified that order is on the way.",
        color: "orange",
      });
    } catch (err: any) {
      notifications.show({ title: "Failed to update status", message: err.message, color: "red" });
    }
  };

  // Claim unassigned delivery
  const handleClaimDelivery = async (orderId: string) => {
    if (!activeRider) return;
    try {
      await updateDeliveryStatusMutation.mutateAsync({
        orderId,
        body: { status: "ASSIGNED", riderId: activeRider.id },
      });
      notifications.show({
        title: "Delivery Claimed",
        message: "Order assigned to your active queue.",
        color: "teal",
      });
      setActiveTab("active");
    } catch (err: any) {
      notifications.show({ title: "Failed to claim", message: err.message, color: "red" });
    }
  };

  // Confirm Delivered with OTP
  const handleConfirmDelivered = async (orderId: string, otp?: string) => {
    setVerifyingOtp(true);
    try {
      await updateDeliveryStatusMutation.mutateAsync({
        orderId,
        body: { status: "DELIVERED", deliveryOtp: otp?.trim() || undefined },
      });
      notifications.show({
        title: "Order Delivered!",
        message: "Delivery completed successfully and recorded.",
        color: "green",
        icon: <IconCheck size={16} />,
      });
      setOtpModalOrder(null);
      setOtpInput("");
    } catch (err: any) {
      notifications.show({
        title: "Verification Failed",
        message: err.message || "Invalid OTP code entered",
        color: "red",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const toggleItemsExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const loading = ridersLoading || ordersLoading;

  return (
    <Box pt="sm" pb="xl" px={{ base: "xs", sm: "md" }}>
      <Stack gap="lg">
        {/* ─── Top Header ─── */}
        <Group justify="space-between" align="center" wrap="wrap" gap="md" mb="xs">
          <div>
            <Group gap="xs" align="center">
              <Title order={2}>Rider Delivery Portal</Title>
              <Badge
                size="sm"
                variant="dot"
                color={isConnected ? "teal" : isConnecting ? "yellow" : "gray"}
              >
                {isConnected ? "Live Synced" : isConnecting ? "Connecting..." : "Offline"}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {activeOutlet?.name || "Active Branch"} · Real-time order dispatch, navigation & OTP verification
            </Text>
          </div>

          <Group gap="xs" align="center" wrap="wrap">
            <Badge size="md" color="dinePrimary" variant="light" leftSection={<IconBuildingStore size={14} />}>
              {activeOutlet?.name || outlets[0]?.name || "Rider Delivery"}
            </Badge>

            {/* Rider Selector */}
            {riders.length > 0 && (
              <Select
                size="sm"
                placeholder="Choose rider"
                value={selectedRiderId}
                onChange={handleSelectRider}
                data={riders.map((r: any) => ({
                  value: r.id,
                  label: `${r.name} (${r.vehicleType || "Bike"})`,
                }))}
                leftSection={<IconUser size={14} />}
                w={190}
                allowDeselect={false}
              />
            )}

            {/* Sound Toggle */}
            <Tooltip label={soundEnabled ? "Mute notification sound" : "Enable notification chime"}>
              <ActionIcon
                variant={soundEnabled ? "filled" : "light"}
                color={soundEnabled ? "teal" : "gray"}
                size="lg"
                radius="md"
                onClick={() => setSoundEnabled((v) => !v)}
                aria-label="Toggle chime sound"
              >
                {soundEnabled ? <IconVolume size={18} /> : <IconVolumeOff size={18} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Refresh orders">
              <ActionIcon
                variant="light"
                color="teal"
                size="lg"
                radius="md"
                onClick={() => {
                  refetchOrders();
                  notifications.show({ title: "Refreshed", message: "Orders list updated", color: "teal" });
                }}
                aria-label="Refresh orders"
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Active Rider Status Banner & Duty Switch */}
        {activeRider && (
          <Paper p="sm" radius="md" withBorder>
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Group gap="xs">
                <Text size="sm" fw={700}>
                  {activeRider.name}
                </Text>
                <Badge
                  size="xs"
                  color={activeRider.status === "AVAILABLE" ? "green" : activeRider.status === "ON_DELIVERY" ? "orange" : "gray"}
                  variant="filled"
                  leftSection={activeRider.status === "ON_DELIVERY" ? <IconMotorbike size={10} /> : <IconCircleFilled size={8} />}
                >
                  {activeRider.status === "AVAILABLE" ? "On Duty (Available)" : activeRider.status === "ON_DELIVERY" ? "On Delivery" : "Off Duty"}
                </Badge>
                <Group gap={4} align="center">
                  <IconMotorbike size={13} color="var(--mantine-color-dimmed)" />
                  <Text size="xs" c="dimmed">
                    {activeRider.vehicleType || "Bike"} {activeRider.vehicleNumber ? `(${activeRider.vehicleNumber})` : ""}
                  </Text>
                </Group>
              </Group>

              <Group gap="xs" align="center">
                <Text size="xs" fw={600} c="dimmed">Duty Status:</Text>
                <Switch
                  size="sm"
                  color="teal"
                  checked={activeRider.status !== "OFFLINE"}
                  onChange={(e) => handleToggleDuty(e.currentTarget.checked)}
                  label={activeRider.status !== "OFFLINE" ? "On Duty" : "Off Duty"}
                />
              </Group>
            </Group>
          </Paper>
        )}

        {/* Quick Duty Metrics */}
        {activeRider && (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Paper p="xs" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
              <Text size="xs" c="dimmed" fw={600}>Active Deliveries</Text>
              <Text fw={800} size="xl" c="teal">
                {myActiveDeliveries.length}
              </Text>
            </Paper>

            <Paper p="xs" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
              <Text size="xs" c="dimmed" fw={600}>Delivered Today</Text>
              <Text fw={800} size="xl" c="blue">
                {myCompletedDeliveries.length}
              </Text>
            </Paper>

            <Paper p="xs" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
              <Text size="xs" c="dimmed" fw={600}>COD to Collect</Text>
              <Text fw={800} size="xl" c="orange">
                ₹{(codToCollect / 100).toFixed(0)}
              </Text>
            </Paper>

            <Paper p="xs" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
              <Text size="xs" c="dimmed" fw={600}>Cash Collected Today</Text>
              <Text fw={800} size="xl" c="dark.6">
                ₹{(codCollectedToday / 100).toFixed(0)}
              </Text>
            </Paper>
          </SimpleGrid>
        )}

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v || "active")}>
          <Tabs.List>
            <Tabs.Tab
              value="active"
              leftSection={<IconMotorbike size={15} />}
              rightSection={
                myActiveDeliveries.length > 0 ? (
                  <Badge size="xs" color="teal" variant="filled">
                    {myActiveDeliveries.length}
                  </Badge>
                ) : null
              }
            >
              My Active Deliveries
            </Tabs.Tab>
            <Tabs.Tab
              value="pool"
              leftSection={<IconPlus size={15} />}
              rightSection={
                unassignedDeliveries.length > 0 ? (
                  <Badge size="xs" color="orange" variant="filled">
                    {unassignedDeliveries.length}
                  </Badge>
                ) : null
              }
            >
              Outlet Pool ({unassignedDeliveries.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="completed"
              leftSection={<IconCheck size={15} />}
              rightSection={
                myCompletedDeliveries.length > 0 ? (
                  <Badge size="xs" color="gray" variant="light">
                    {myCompletedDeliveries.length}
                  </Badge>
                ) : null
              }
            >
              Completed Today ({myCompletedDeliveries.length})
            </Tabs.Tab>
          </Tabs.List>

          {/* TAB 1: My Active Deliveries */}
          <Tabs.Panel value="active" pt="md">
            {loading ? (
              <Center py={60}><Loader color="teal" /></Center>
            ) : !activeRider ? (
              <Paper p="xl" radius="md" withBorder ta="center">
                <Text fw={600} size="md">Select your rider profile above to view your deliveries.</Text>
              </Paper>
            ) : myActiveDeliveries.length === 0 ? (
              <Paper p="xl" radius="md" withBorder ta="center" style={{ backgroundColor: "#ffffff" }}>
                <Stack align="center" gap="xs">
                  <IconMotorbike size={48} color="#adb5bd" stroke={1.5} />
                  <Text fw={700} size="md">No Deliveries in Progress</Text>
                  <Text size="xs" c="dimmed" style={{ maxWidth: 360 }}>
                    When POS assigns orders to you, they'll appear here with live notifications, customer navigation, and delivery PIN verification.
                  </Text>
                  {unassignedDeliveries.length > 0 && (
                    <Button size="xs" color="teal" variant="light" onClick={() => setActiveTab("pool")}>
                      View {unassignedDeliveries.length} Available Orders in Pool
                    </Button>
                  )}
                </Stack>
              </Paper>
            ) : (
              <Stack gap="md">
                {myActiveDeliveries.map((entry: any) => {
                  const { order, items, delivery } = entry;
                  const dStatus = delivery?.status || "ASSIGNED";
                  const isOut = dStatus === "OUT_FOR_DELIVERY";
                  const isPaid = order.status === "PAID";
                  const customerName = delivery?.customerName || "Customer";
                  const customerPhone = delivery?.customerPhone || order.customerPhone || "";
                  const fullAddr = [delivery?.addressLine1, delivery?.landmark, delivery?.pincode].filter(Boolean).join(", ");
                  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddr)}`;
                  const elapsed = formatElapsed(order.createdAt);
                  const isExpanded = Boolean(expandedOrders[order.id]);

                  return (
                    <Card
                      key={order.id}
                      radius="lg"
                      withBorder
                      shadow="sm"
                      p="md"
                      style={{
                        borderLeft: isOut ? "6px solid #fd7e14" : "6px solid #0ca678",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <Stack gap="xs">
                        {/* Header: Token, Status, Elapsed */}
                        <Group justify="space-between" align="flex-start" wrap="wrap">
                          <div>
                            <Group gap="xs" align="center">
                              <Badge color="teal" variant="filled" size="lg" style={{ fontSize: 14 }}>
                                #{order.orderNo}
                              </Badge>
                              <Text fw={800} size="md">
                                {customerName}
                              </Text>
                            </Group>
                            <Text size="xs" c="dimmed" mt={3}>
                              Order ID: #{order.id.slice(-8)}
                            </Text>
                          </div>

                          <Group gap={6} align="center">
                            <Badge color={elapsed.color} variant="light" size="xs" leftSection={<IconClock size={11} />}>
                              {elapsed.text}
                            </Badge>
                            <Badge
                              color={isOut ? "orange" : "teal"}
                              variant="filled"
                              size="sm"
                              leftSection={isOut ? <IconMotorbike size={12} /> : undefined}
                            >
                              {isOut ? "Out for Delivery" : "Ready at Counter"}
                            </Badge>
                          </Group>
                        </Group>

                        {/* Customer Contact Quick Bar */}
                        <Paper p="xs" radius="md" style={{ backgroundColor: "#f8f9fa", border: "1px solid #e9ecef" }}>
                          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                            <Group gap={6} align="center">
                              <IconPhoneCall size={14} color="var(--mantine-color-dark-6)" />
                              <Text size="xs" fw={700} c="dark.6">
                                {customerPhone}
                              </Text>
                            </Group>

                            <Group gap={6}>
                              {customerPhone && (
                                <>
                                  <Button
                                    component="a"
                                    href={`tel:${customerPhone}`}
                                    size="xs"
                                    color="dark"
                                    variant="light"
                                    leftSection={<IconPhoneCall size={13} />}
                                  >
                                    Call Customer
                                  </Button>
                                  <Button
                                    component="a"
                                    href={`https://wa.me/91${customerPhone.replace(/\D/g, "").slice(-10)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    size="xs"
                                    color="teal"
                                    variant="light"
                                    leftSection={<IconBrandWhatsapp size={13} />}
                                  >
                                    WhatsApp
                                  </Button>
                                </>
                              )}
                            </Group>
                          </Group>
                        </Paper>

                        {/* Delivery Address & 1-Tap Google Maps Navigation */}
                        {fullAddr && (
                          <Paper p="xs" radius="md" style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                              <Group gap={8} align="flex-start" style={{ flex: 1 }}>
                                <IconMapPin size={18} color="#0ca678" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div>
                                  <Text size="xs" fw={600} c="dark.8">
                                    {fullAddr}
                                  </Text>
                                  {delivery?.deliveryNotes && (
                                    <Group gap={4} align="center" mt={2}>
                                      <IconNotes size={12} color="var(--mantine-color-orange-9)" />
                                      <Text size="xs" fw={700} c="orange.9">
                                        Delivery Note: {delivery.deliveryNotes}
                                      </Text>
                                    </Group>
                                  )}
                                </div>
                              </Group>

                              <Button
                                component="a"
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="xs"
                                color="teal"
                                variant="filled"
                                leftSection={<IconNavigation size={13} />}
                                style={{ flexShrink: 0 }}
                              >
                                Maps
                              </Button>
                            </Group>
                          </Paper>
                        )}

                        {/* Payment & Amount Notice */}
                        <Paper p="xs" radius="md" style={{ backgroundColor: isPaid ? "rgba(43, 138, 62, 0.08)" : "rgba(253, 126, 20, 0.1)" }}>
                          <Group justify="space-between" align="center">
                            <Group gap={6}>
                              <IconCash size={16} color={isPaid ? "#2b8a3e" : "#fd7e14"} />
                              <Text size="xs" fw={700} c={isPaid ? "green.9" : "orange.9"}>
                                {isPaid ? "PAID ONLINE" : "CASH ON DELIVERY (COD)"}
                              </Text>
                            </Group>
                            <Text size="sm" fw={800} c={isPaid ? "green.9" : "orange.9"}>
                              {isPaid ? "Do Not Collect Cash" : `Collect ₹${(order.subtotalPaise / 100).toFixed(0)}`}
                            </Text>
                          </Group>
                        </Paper>

                        {/* Collapsible Items Check */}
                        <Box>
                          <Group justify="space-between" align="center" style={{ cursor: "pointer" }} onClick={() => toggleItemsExpand(order.id)}>
                            <Text size="xs" fw={600} c="dimmed">
                              Items Checklist ({items?.length || 0} items)
                            </Text>
                            {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                          </Group>

                          <Collapse expanded={isExpanded}>
                            <Stack gap={4} mt={6}>
                              {(items || []).map((it: any) => (
                                <Group key={it.id} justify="space-between" align="center">
                                  <Text size="xs">
                                    • <b>{it.qty}x</b> {it.nameSnapshot || it.name}
                                  </Text>
                                  <Badge size="xs" color="gray" variant="light">
                                    {it.status || "ORDERED"}
                                  </Badge>
                                </Group>
                              ))}
                            </Stack>
                          </Collapse>
                        </Box>

                        {/* Big Primary Actions */}
                        <Divider my={4} />
                        <Group grow mt={4}>
                          {!isOut ? (
                            <Button
                              size="md"
                              color="orange"
                              leftSection={<IconMotorbike size={18} />}
                              loading={updateDeliveryStatusMutation.isPending}
                              onClick={() => handleStartDelivery(order.id)}
                            >
                              Pick Up & Start Delivery
                            </Button>
                          ) : (
                            <Button
                              size="md"
                              color="green"
                              leftSection={<IconCheck size={18} />}
                              onClick={() => {
                                setOtpModalOrder(entry);
                                setOtpInput("");
                              }}
                            >
                              Complete Delivery (Verify PIN)
                            </Button>
                          )}
                        </Group>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Tabs.Panel>

          {/* TAB 2: Unassigned Outlet Pool */}
          <Tabs.Panel value="pool" pt="md">
            {unassignedDeliveries.length === 0 ? (
              <Paper p="xl" radius="md" withBorder ta="center" style={{ backgroundColor: "#ffffff" }}>
                <Text fw={600} size="md">No unassigned delivery orders in pool right now.</Text>
                <Text size="xs" c="dimmed">When new delivery orders arrive without a rider, they'll show here for 1-tap claiming.</Text>
              </Paper>
            ) : (
              <Stack gap="sm">
                {unassignedDeliveries.map((entry: any) => {
                  const { order, items, delivery } = entry;
                  const customerName = delivery?.customerName || "Customer";
                  const customerPhone = delivery?.customerPhone || order.customerPhone || "";
                  const fullAddr = [delivery?.addressLine1, delivery?.landmark, delivery?.pincode].filter(Boolean).join(", ");
                  const isPaid = order.status === "PAID";

                  return (
                    <Paper key={order.id} p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                        <div>
                          <Group gap="xs">
                            <Badge color="orange" variant="filled" size="md">
                              #{order.orderNo}
                            </Badge>
                            <Text fw={700} size="sm">{customerName}</Text>
                          </Group>
                          {fullAddr && (
                            <Group gap={4} align="center" mt={4}>
                              <IconMapPin size={12} color="var(--mantine-color-dimmed)" />
                              <Text size="xs" c="dimmed">
                                {fullAddr}
                              </Text>
                            </Group>
                          )}
                          <Group gap="xs" mt={4}>
                            <Badge size="xs" color={isPaid ? "green" : "orange"} variant="light">
                              {isPaid ? "Paid Online" : `COD ₹${(order.subtotalPaise / 100).toFixed(0)}`}
                            </Badge>
                            <Text size="xs" c="dimmed">{items?.length || 0} items</Text>
                          </Group>
                        </div>

                        <Button
                          size="sm"
                          color="teal"
                          leftSection={<IconPlus size={15} />}
                          loading={updateDeliveryStatusMutation.isPending}
                          onClick={() => handleClaimDelivery(order.id)}
                        >
                          Claim Delivery
                        </Button>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Tabs.Panel>

          {/* TAB 3: Completed Today */}
          <Tabs.Panel value="completed" pt="md">
            {myCompletedDeliveries.length === 0 ? (
              <Paper p="xl" radius="md" withBorder ta="center" style={{ backgroundColor: "#ffffff" }}>
                <Text fw={600} size="md">No completed deliveries yet today.</Text>
              </Paper>
            ) : (
              <Stack gap="xs">
                {myCompletedDeliveries.map((entry: any) => {
                  const { order, delivery } = entry;
                  const customerName = delivery?.customerName || "Customer";
                  const isPaid = order.status === "PAID";

                  return (
                    <Paper key={order.id} p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                      <Group justify="space-between" align="center">
                        <div>
                          <Group gap="xs">
                            <Badge color="green" variant="light" size="sm">
                              #{order.orderNo}
                            </Badge>
                            <Text fw={600} size="sm">{customerName}</Text>
                            <Badge size="xs" color="teal" variant="outline" leftSection={<IconCheck size={10} />}>Delivered</Badge>
                          </Group>
                          <Group gap={4} align="center" mt={2}>
                            <IconMapPin size={12} color="var(--mantine-color-dimmed)" />
                            <Text size="xs" c="dimmed">
                              {delivery?.addressLine1}
                            </Text>
                          </Group>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <Text fw={700} size="sm">
                            ₹{(order.subtotalPaise / 100).toFixed(0)}
                          </Text>
                          <Text size="xs" c={isPaid ? "green" : "orange"}>
                            {isPaid ? "Paid Online" : "COD"}
                          </Text>
                        </div>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Rider Delivery PIN Verification Modal */}
      <Modal
        opened={Boolean(otpModalOrder)}
        onClose={() => {
          setOtpModalOrder(null);
          setOtpInput("");
        }}
        title={<Text fw={700}>Complete Delivery for #{otpModalOrder?.order?.orderNo}</Text>}
        size="sm"
        centered
        zIndex={1400}
      >
        {otpModalOrder && (
          <Stack gap="sm">
            <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: "#f8f9fa" }}>
              <Text size="xs" fw={700}>
                {otpModalOrder.delivery?.customerName || "Customer"} ({otpModalOrder.delivery?.customerPhone})
              </Text>
              <Group gap={4} align="center">
                <IconMapPin size={12} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">
                  {otpModalOrder.delivery?.addressLine1}
                </Text>
              </Group>
              <Divider my={4} />
              <Group justify="space-between">
                <Text size="xs" fw={700}>
                  {otpModalOrder.order?.status === "PAID" ? "Payment:" : "Collect Cash:"}
                </Text>
                <Text size="sm" fw={800} c={otpModalOrder.order?.status === "PAID" ? "green" : "orange"}>
                  {otpModalOrder.order?.status === "PAID" ? "Already Paid Online" : `Collect ₹${(otpModalOrder.order?.subtotalPaise / 100).toFixed(0)} COD`}
                </Text>
              </Group>
            </Paper>

            <TextInput
              label="Customer 4-Digit Delivery PIN"
              placeholder="e.g. 1234"
              description="Ask customer for the 4-digit PIN shown on their order screen/SMS"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              size="md"
              type="tel"
              maxLength={6}
              autoFocus
            />

            <Group grow mt="xs">
              <Button
                variant="light"
                color="gray"
                loading={verifyingOtp}
                onClick={() => handleConfirmDelivered(otpModalOrder.order.id)}
              >
                Bypass PIN (Delivered)
              </Button>
              <Button
                color="green"
                loading={verifyingOtp}
                disabled={!otpInput.trim()}
                onClick={() => handleConfirmDelivered(otpModalOrder.order.id, otpInput)}
              >
                Verify PIN & Complete
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
