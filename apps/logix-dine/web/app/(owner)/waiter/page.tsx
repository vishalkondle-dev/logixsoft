"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Title, Stack, Paper, Group, Text, Badge, Select, Button,
  Loader, Center, Modal, Divider, Box, ActionIcon, Tooltip,
  SimpleGrid, Alert, Tabs, TextInput, Card, Switch, RingProgress,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import {
  IconBellRinging, IconCheck, IconClock, IconDroplet, IconToolsKitchen2,
  IconReceipt, IconSparkles, IconSearch, IconPlus, IconVolume,
  IconVolumeOff, IconTableAlias, IconRefresh, IconAlertCircle,
  IconArrowRight, IconUser, IconPhone, IconWifi,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useWaiterRequests, useWaiterStats, useCreateWaiterRequest,
  useUpdateWaiterRequestStatus, useTables, useOrders, qk,
} from "@/lib/queries";
import { useOutletSync } from "@/lib/use-outlet-sync";
import { updateOrderItemStatus } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";

const SERVICE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ size?: number }>; color: string; bg: string }
> = {
  WATER: { label: "Water / Refill", icon: IconDroplet, color: "blue", bg: "rgba(34, 139, 230, 0.08)" },
  CUTLERY: { label: "Extra Cutlery & Napkins", icon: IconToolsKitchen2, color: "orange", bg: "rgba(253, 126, 20, 0.08)" },
  BILL: { label: "Bill Requested", icon: IconReceipt, color: "grape", bg: "rgba(190, 75, 219, 0.08)" },
  CLEAN_TABLE: { label: "Clean Table", icon: IconSparkles, color: "teal", bg: "rgba(32, 201, 151, 0.08)" },
  OTHER: { label: "Staff Assistance", icon: IconBellRinging, color: "yellow", bg: "rgba(250, 176, 5, 0.08)" },
};

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

function formatElapsed(createdAt: string): { text: string; color: string } {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return { text: "Just now", color: "teal" };
  if (diffMin < 5) return { text: `${diffMin}m ago`, color: "teal" };
  if (diffMin < 12) return { text: `${diffMin}m ago`, color: "yellow" };
  return { text: `${diffMin}m ago`, color: "red" };
}

export default function WaiterPage() {
  const { restaurant, activeOutlet, outlets, setActiveOutlet, can } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;
  const queryClient = useQueryClient();

  const canView = can("waiter:view");
  const canAttendCall = can("waiter:attend_call");
  const canPunchOrder = can("waiter:punch_order");

  const [activeTab, setActiveTab] = useState<string>("active");
  const [serviceFilter, setServiceFilter] = useState<string>("ALL");
  const [searchTable, setSearchTable] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);

  // New Request Form State
  const [newTableNo, setNewTableNo] = useState("");
  const [newServiceType, setNewServiceType] = useState<"WATER" | "CUTLERY" | "BILL" | "CLEAN_TABLE" | "OTHER">("WATER");
  const [newNote, setNewNote] = useState("");

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [servingItemId, setServingItemId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Durable Object Live Sync
  const { isConnected, isConnecting } = useOutletSync(restaurantId, outletId);

  // Fetch Waiter Requests (Auto-updates via Cloudflare Durable Object)
  const {
    data: requests = [],
    isLoading: requestsLoading,
    refetch: refetchRequests,
  } = useWaiterRequests(
    restaurantId,
    outletId,
    {},
    { refetchInterval: false }
  );

  // Fetch Waiter Stats (Auto-updates via Cloudflare Durable Object)
  const { data: stats } = useWaiterStats(restaurantId, outletId, {
    refetchInterval: false,
  });

  // Fetch Tables for new request picker
  const { data: tables = [] } = useTables(restaurantId, outletId);

  // Auto-select first dining table when tables are loaded
  useEffect(() => {
    if (tables.length > 0 && (!newTableNo || newTableNo === "Takeaway" || !tables.some((t: any) => t.name === newTableNo))) {
      setNewTableNo(tables[0].name);
    }
  }, [tables, newTableNo]);

  // Fetch Orders to find dishes marked PREPARED by Kitchen (Auto-updates via Cloudflare Durable Object)
  const { data: openOrders = [] } = useOrders(
    restaurantId,
    { outletId: outletId || undefined, status: "OPEN" },
    true,
    { refetchInterval: false }
  );

  const createMutation = useCreateWaiterRequest();
  const updateStatusMutation = useUpdateWaiterRequestStatus();

  // Tick every 30s to update elapsed time labels
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Track new requests to play sound
  const prevPendingCount = useRef<number | null>(null);
  useEffect(() => {
    const pendingCount = requests.filter((r: any) => r.status === "PENDING").length;
    if (prevPendingCount.current !== null && pendingCount > prevPendingCount.current) {
      if (soundEnabled) playChime();
    }
    prevPendingCount.current = pendingCount;
  }, [requests, soundEnabled]);

  // Extract all dishes that are PREPARED from open orders
  const readyDishes = useMemo(() => {
    const list: Array<{
      orderId: string;
      orderNo: number;
      tableNo: string;
      orderType: string;
      item: any;
    }> = [];

    for (const o of openOrders) {
      const order = o.order;
      const items = o.items || [];
      const orderType =
        order.orderType ||
        ((order.tableNo || "").toLowerCase() === "delivery"
          ? "DELIVERY"
          : (order.tableNo || "").toLowerCase() === "takeaway"
          ? "TAKEAWAY"
          : "DINE_IN");
      for (const it of items) {
        if (it.status === "PREPARED") {
          list.push({
            orderId: order.id,
            orderNo: order.orderNo,
            tableNo: order.tableNo || (orderType === "DELIVERY" ? "Delivery" : "Takeaway"),
            orderType,
            item: it,
          });
        }
      }
    }
    return list;
  }, [openOrders]);

  // Filter requests based on tab, serviceType, and table search
  const filteredRequests = useMemo(() => {
    return requests.filter((r: any) => {
      // Tab filter
      if (activeTab === "active" && r.status !== "PENDING" && r.status !== "IN_PROGRESS") return false;
      if (activeTab === "completed" && r.status !== "COMPLETED") return false;
      // "all" includes all

      // Service filter
      if (serviceFilter !== "ALL" && r.serviceType !== serviceFilter) return false;

      // Table search
      if (searchTable.trim()) {
        const q = searchTable.toLowerCase().trim();
        const table = (r.tableNo || "").toLowerCase();
        const note = (r.note || "").toLowerCase();
        if (!table.includes(q) && !note.includes(q)) return false;
      }

      return true;
    });
  }, [requests, activeTab, serviceFilter, searchTable]);

  const pendingCount = requests.filter((r: any) => r.status === "PENDING").length;
  const inProgressCount = requests.filter((r: any) => r.status === "IN_PROGRESS").length;
  const completedCount = requests.filter((r: any) => r.status === "COMPLETED").length;

  const handleMarkStatus = async (
    requestId: string,
    status: "COMPLETED" | "IN_PROGRESS" | "PENDING"
  ) => {
    if (!outletId) return;
    setCompletingId(requestId);
    try {
      await updateStatusMutation.mutateAsync({
        restaurantId,
        outletId,
        requestId,
        status,
      });

      notifications.show({
        title: status === "COMPLETED" ? "Request Completed" : "Status Updated",
        message: status === "COMPLETED" ? "Marked as resolved" : `Status changed to ${status}`,
        color: status === "COMPLETED" ? "green" : "blue",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to update request",
        color: "red",
      });
    } finally {
      setCompletingId(null);
    }
  };

  const handleServeItem = async (orderId: string, orderItemId: string, dishName: string, tableNo: string) => {
    setServingItemId(orderItemId);
    try {
      await updateOrderItemStatus(restaurantId, orderId, orderItemId, { action: "next" }, outletId);
      notifications.show({
        title: "Dish Served!",
        message: `${dishName} marked as SERVED for ${tableNo}`,
        color: "green",
        icon: <IconCheck size={16} />,
      });
      queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
      queryClient.invalidateQueries({ queryKey: qk.waiterStats(restaurantId, outletId) });
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to serve dish",
        color: "red",
      });
    } finally {
      setServingItemId(null);
    }
  };

  const handleCreateRequest = async () => {
    if (!outletId) return;
    try {
      await createMutation.mutateAsync({
        restaurantId,
        outletId,
        body: {
          tableNo: newTableNo,
          serviceType: newServiceType,
          note: newNote.trim() || undefined,
        },
      });

      notifications.show({
        title: "Request Created",
        message: `Assistance logged for ${newTableNo}`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      setNewModalOpen(false);
      setNewNote("");
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to create request",
        color: "red",
      });
    }
  };

  if (!canView) {
    return (
      <Center py={100}>
        <Stack align="center" gap="md" style={{ maxWidth: 450, textAlign: "center" }}>
          <IconBellRinging size={48} color="#af73d7" />
          <Title order={3}>Access Restricted</Title>
          <Text c="dimmed" size="sm">
            Your current role does not have authorization to view the Waiter Dashboard (<code>waiter:view</code>).
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box pt="sm" pb={120} px={{ base: "xs", sm: "md" }}>
      <Stack gap="lg">
      {/* ─── Top Header ─── */}
      <Group justify="space-between" align="center" wrap="wrap" gap="md" mb="xs">
        <div>
          <Group gap="xs" align="center">
            <Title order={2}>Waiter & Floor Assistance</Title>
            <Badge
              size="sm"
              variant="dot"
              color={isConnected ? "teal" : isConnecting ? "yellow" : "gray"}
            >
              {isConnected ? "Live Synced" : isConnecting ? "Connecting..." : "Offline"}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {activeOutlet ? activeOutlet.name : "All Outlets"} · Real-time guest assistance calls & kitchen pickup
          </Text>
        </div>

        <Group gap="sm" wrap="wrap">
          {outlets.length > 0 && (
            <Select
              size="sm"
              data={outlets.map((o) => ({ value: o.id, label: o.name }))}
              value={activeOutlet?.id ?? outlets[0]?.id ?? null}
              readOnly={outlets.length <= 1}
              rightSection={outlets.length <= 1 ? null : undefined}
              styles={outlets.length <= 1 ? { input: { cursor: "default" } } : undefined}
              onChange={(val) => {
                const found = outlets.find((o) => o.id === val);
                if (found) setActiveOutlet(found.id);
              }}
              w={180}
            />
          )}

          <Tooltip label={soundEnabled ? "Chime sound enabled on new requests" : "Chime sound muted"}>
            <ActionIcon
              variant={soundEnabled ? "filled" : "light"}
              color={soundEnabled ? "indigo" : "gray"}
              size="lg"
              radius="md"
              onClick={() => setSoundEnabled((v) => !v)}
            >
              {soundEnabled ? <IconVolume size={18} /> : <IconVolumeOff size={18} />}
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Refresh requests">
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              onClick={() => {
                refetchRequests();
                queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
              }}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>

          {canPunchOrder && (
            <Button
              color="dinePrimary"
              leftSection={<IconPlus size={16} />}
              radius="md"
              onClick={() => setNewModalOpen(true)}
            >
              New Request
            </Button>
          )}
        </Group>
      </Group>

      {/* ─── Metric Strip ─── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            borderColor: pendingCount > 0 ? "var(--mantine-color-red-4)" : undefined,
            backgroundColor: pendingCount > 0 ? "rgba(224, 49, 49, 0.04)" : undefined,
          }}
        >
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Pending Calls
              </Text>
              <Text size="xl" fw={700} c={pendingCount > 0 ? "red" : undefined}>
                {pendingCount}
              </Text>
            </Stack>
            <Badge size="lg" circle color={pendingCount > 0 ? "red" : "gray"}>
              {pendingCount}
            </Badge>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                In Progress
              </Text>
              <Text size="xl" fw={700} c="blue">
                {inProgressCount}
              </Text>
            </Stack>
            <Badge size="lg" circle color="blue">
              {inProgressCount}
            </Badge>
          </Group>
        </Paper>

        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            borderColor: readyDishes.length > 0 ? "var(--mantine-color-orange-4)" : undefined,
            backgroundColor: readyDishes.length > 0 ? "rgba(253, 126, 20, 0.04)" : undefined,
          }}
        >
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Ready to Serve (KDS)
              </Text>
              <Text size="xl" fw={700} c={readyDishes.length > 0 ? "orange" : undefined}>
                {readyDishes.length}
              </Text>
            </Stack>
            <Badge size="lg" circle color={readyDishes.length > 0 ? "orange" : "gray"}>
              {readyDishes.length}
            </Badge>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Completed Today
              </Text>
              <Text size="xl" fw={700} c="teal">
                {completedCount}
              </Text>
            </Stack>
            <Badge size="lg" circle color="teal">
              {completedCount}
            </Badge>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ─── Navigation Tabs & Filters ─── */}
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Tabs
            value={activeTab}
            onChange={(val) => setActiveTab(val || "active")}
            variant="pills"
            color="dinePrimary"
          >
            <Tabs.List>
              <Tabs.Tab
                value="active"
                rightSection={
                  pendingCount + inProgressCount > 0 ? (
                    <Badge size="xs" color="red" circle>
                      {pendingCount + inProgressCount}
                    </Badge>
                  ) : undefined
                }
              >
                Active Requests
              </Tabs.Tab>
              <Tabs.Tab
                value="ready_dishes"
                rightSection={
                  readyDishes.length > 0 ? (
                    <Badge size="xs" color="orange" circle>
                      {readyDishes.length}
                    </Badge>
                  ) : undefined
                }
              >
                Ready to Serve (Kitchen)
              </Tabs.Tab>
              <Tabs.Tab value="completed">Completed Today ({completedCount})</Tabs.Tab>
              <Tabs.Tab value="all">All Requests ({requests.length})</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          <TextInput
            placeholder="Search table or note..."
            leftSection={<IconSearch size={16} />}
            value={searchTable}
            onChange={(e) => setSearchTable(e.target.value)}
            w={{ base: "100%", sm: 260 }}
            radius="md"
            size="sm"
          />
        </Group>

        {/* Service Type Filter Chips (Active on Request Tabs) */}
        {activeTab !== "ready_dishes" && (
          <Group gap="xs" wrap="wrap">
            <Badge
              variant={serviceFilter === "ALL" ? "filled" : "outline"}
              color={serviceFilter === "ALL" ? "dark" : "gray"}
              style={{ cursor: "pointer" }}
              onClick={() => setServiceFilter("ALL")}
              size="md"
              radius="sm"
            >
              All Types
            </Badge>
            {Object.entries(SERVICE_CONFIG).map(([type, conf]) => {
              const IconComp = conf.icon;
              const isSelected = serviceFilter === type;
              return (
                <Badge
                  key={type}
                  variant={isSelected ? "filled" : "light"}
                  color={conf.color}
                  style={{ cursor: "pointer", textTransform: "none" }}
                  onClick={() => setServiceFilter(isSelected ? "ALL" : type)}
                  size="md"
                  radius="sm"
                  leftSection={<IconComp size={12} />}
                >
                  {conf.label}
                </Badge>
              );
            })}
          </Group>
        )}
      </Stack>

      {/* ─── Tab Content: Ready to Serve from Kitchen ─── */}
      {activeTab === "ready_dishes" ? (
        <Stack gap="md">
          {readyDishes.length === 0 ? (
            <Paper p="xl" radius="md" withBorder style={{ textAlign: "center" }}>
              <Stack align="center" gap="sm" py="lg">
                <IconToolsKitchen2 size={40} color="var(--mantine-color-dimmed)" />
                <Text fw={600} size="lg">No Dishes Waiting to be Served</Text>
                <Text size="sm" c="dimmed">
                  When the kitchen marks dishes as PREPARED, they will appear here ready for floor staff to deliver.
                </Text>
              </Stack>
            </Paper>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
              {readyDishes.map(({ orderId, orderNo, tableNo, orderType, item }) => {
                const isDelivery = orderType === "DELIVERY" || (tableNo || "").toLowerCase() === "delivery";
                const isTakeaway = orderType === "TAKEAWAY" || (tableNo || "").toLowerCase() === "takeaway";
                const buttonLabel = isDelivery ? "Ready for Rider Pickup" : isTakeaway ? "Ready for Pickup" : "Mark as Served";
                const badgeLabel = isDelivery ? "Delivery" : isTakeaway ? "Takeaway" : tableNo;
                return (
                  <Card key={item.id} p="md" radius="md" withBorder shadow="sm">
                    <Group justify="space-between" align="flex-start" mb="xs">
                      <Group gap="xs">
                        <Badge size="lg" color={isDelivery ? "teal" : isTakeaway ? "orange" : "dark"} radius="sm">
                          {badgeLabel}
                        </Badge>
                        <Badge size="sm" variant="light" color="gray">
                          Order #{orderNo}
                        </Badge>
                      </Group>
                      <Badge color="orange" variant="light" leftSection={<IconClock size={12} />}>
                        Kitchen Prepared
                      </Badge>
                    </Group>

                    <Text fw={700} size="md" mb={4}>
                      {item.qty}x {item.nameSnapshot}
                    </Text>

                    {item.variant?.name && (
                      <Text size="xs" c="dimmed">
                        Variant: <strong>{item.variant.name}</strong>
                      </Text>
                    )}

                    {item.addons?.length > 0 && (
                      <Text size="xs" c="dimmed">
                        Add-ons: {item.addons.map((a: any) => a.name).join(", ")}
                      </Text>
                    )}

                    {item.note && (
                      <Alert color="yellow" p="xs" mt="xs" radius="sm">
                        <Text size="xs" fw={500}>Note: {item.note}</Text>
                      </Alert>
                    )}

                    <Divider my="sm" />

                    <Button
                      fullWidth
                      color="teal"
                      leftSection={<IconCheck size={16} />}
                      loading={servingItemId === item.id}
                      disabled={!canAttendCall}
                      title={!canAttendCall ? "Permission required: waiter:attend_call" : undefined}
                      onClick={() => handleServeItem(orderId, item.id, item.nameSnapshot, tableNo)}
                    >
                      {buttonLabel}
                    </Button>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}
        </Stack>
      ) : (
        /* ─── Tab Content: Waiter Service Calls ─── */
        <Stack gap="md">
          {requestsLoading ? (
            <Center py={80}>
              <Loader size="lg" color="dinePrimary" />
            </Center>
          ) : filteredRequests.length === 0 ? (
            <Paper p="xl" radius="md" withBorder style={{ textAlign: "center" }}>
              <Stack align="center" gap="sm" py="lg">
                <IconBellRinging size={40} color="var(--mantine-color-dimmed)" />
                <Text fw={600} size="lg">
                  {activeTab === "active" ? "No Active Waiter Requests" : "No Requests Found"}
                </Text>
                <Text size="sm" c="dimmed">
                  {activeTab === "active"
                    ? "All customer assistance requests have been completed! Tables can call using the digital menu portal."
                    : "No requests matched the selected filters."}
                </Text>
                <Button
                  variant="light"
                  color="dinePrimary"
                  size="sm"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setNewModalOpen(true)}
                >
                  Log Table Request
                </Button>
              </Stack>
            </Paper>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
              {filteredRequests.map((req: any) => {
                const conf = SERVICE_CONFIG[req.serviceType] || SERVICE_CONFIG.OTHER;
                const IconComp = conf.icon;
                const isPending = req.status === "PENDING";
                const isInProgress = req.status === "IN_PROGRESS";
                const isCompleted = req.status === "COMPLETED";
                const elapsed = formatElapsed(req.createdAt);

                return (
                  <Card
                    key={req.id}
                    p="md"
                    radius="md"
                    withBorder
                    shadow="sm"
                    style={{
                      borderLeft: `5px solid var(--mantine-color-${conf.color}-6)`,
                      backgroundColor: isPending ? "rgba(255, 255, 255, 1)" : undefined,
                    }}
                  >
                    {/* Header: Table & Elapsed */}
                    <Group justify="space-between" align="center" mb="xs">
                      <Group gap="xs">
                        <Badge size="lg" color="dark" radius="sm">
                          {req.tableNo}
                        </Badge>
                        <Badge
                          color={conf.color}
                          variant="light"
                          leftSection={<IconComp size={12} />}
                          style={{ textTransform: "none" }}
                        >
                          {req.serviceLabel}
                        </Badge>
                      </Group>

                      <Badge color={elapsed.color} variant="outline" size="sm">
                        {elapsed.text}
                      </Badge>
                    </Group>

                    {/* Customer or Order Info */}
                    <Group gap="md" mt={4} mb="xs">
                      {req.orderId && (
                        <Text size="xs" c="dimmed">
                          Linked Order ID:{" "}
                          <Text span fw={600} c="dark">
                            #{req.orderId.slice(-6).toUpperCase()}
                          </Text>
                        </Text>
                      )}
                      {req.customerPhone && (
                        <Group gap={4}>
                          <IconPhone size={12} color="gray" />
                          <Text size="xs" c="dimmed">
                            {req.customerPhone}
                          </Text>
                        </Group>
                      )}
                    </Group>

                    {/* Note Box */}
                    {req.note ? (
                      <Box
                        p="xs"
                        mb="md"
                        style={{
                          backgroundColor: conf.bg,
                          borderRadius: 6,
                          borderLeft: `3px solid var(--mantine-color-${conf.color}-6)`,
                        }}
                      >
                        <Text size="xs" c="dimmed" fw={600} mb={2}>
                          Customer Message:
                        </Text>
                        <Text size="sm" fw={500} style={{ wordBreak: "break-word" }}>
                          "{req.note}"
                        </Text>
                      </Box>
                    ) : (
                      <Box mb="sm" />
                    )}

                    {/* Completed Details */}
                    {isCompleted && (
                      <Alert color="green" p="xs" mb="sm" radius="sm">
                        <Text size="xs">
                          Resolved by <strong>{req.completedBy || "Staff"}</strong>
                          {req.completedAt && ` at ${new Date(req.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                        </Text>
                      </Alert>
                    )}

                    <Divider my="sm" />

                    {/* Actions */}
                    <Group gap="xs" justify="space-between">
                      {isPending && (
                        <>
                          <Button
                            variant="light"
                            color="blue"
                            size="sm"
                            leftSection={<IconClock size={14} />}
                            disabled={!canAttendCall || completingId === req.id}
                            loading={completingId === req.id}
                            onClick={() => handleMarkStatus(req.id, "IN_PROGRESS")}
                          >
                            Attending
                          </Button>
                          <Button
                            color="teal"
                            size="sm"
                            style={{ flex: 1 }}
                            leftSection={<IconCheck size={16} />}
                            disabled={!canAttendCall || completingId === req.id}
                            loading={completingId === req.id}
                            onClick={() => handleMarkStatus(req.id, "COMPLETED")}
                          >
                            Mark Completed
                          </Button>
                        </>
                      )}

                      {isInProgress && (
                        <>
                          <Button
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={() => handleMarkStatus(req.id, "PENDING")}
                            disabled={!canAttendCall || completingId === req.id}
                          >
                            Revert
                          </Button>
                          <Button
                            color="teal"
                            size="sm"
                            style={{ flex: 1 }}
                            leftSection={<IconCheck size={16} />}
                            disabled={!canAttendCall || completingId === req.id}
                            loading={completingId === req.id}
                            onClick={() => handleMarkStatus(req.id, "COMPLETED")}
                          >
                            Mark Completed
                          </Button>
                        </>
                      )}

                      {isCompleted && (
                        <Button
                          variant="light"
                          color="gray"
                          size="sm"
                          fullWidth
                          onClick={() => handleMarkStatus(req.id, "PENDING")}
                          disabled={!canAttendCall || completingId === req.id}
                        >
                          Re-open Request
                        </Button>
                      )}
                    </Group>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}
        </Stack>
      )}

      {/* ─── Modal: Log New Waiter Request ─── */}
      <Modal
        opened={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        title={
          <Group gap="xs">
            <IconBellRinging size={20} color="#7950f2" />
            <Text fw={700}>Log New Table Request</Text>
          </Group>
        }
        radius="md"
        centered
      >
        <Stack gap="md">
          <Select
            label="Table"
            description="Select the dining table requesting service"
            data={tables.map((t: any) => ({
              value: t.name,
              label: t.section ? `${t.name} · ${t.section}` : t.name,
            }))}
            value={newTableNo && newTableNo !== "Takeaway" ? newTableNo : null}
            onChange={(val) => setNewTableNo(val || (tables[0]?.name ?? ""))}
            placeholder={tables.length === 0 ? "No tables configured" : "Select table"}
            required
            nothingFoundMessage="No tables found"
          />

          <Select
            label="Service Requested"
            description="Choose the type of floor assistance"
            data={Object.entries(SERVICE_CONFIG).map(([val, conf]) => ({
              value: val,
              label: conf.label,
            }))}
            value={newServiceType}
            onChange={(val: any) => setNewServiceType(val || "WATER")}
            required
          />

          <TextInput
            label="Optional Note"
            placeholder="e.g. Extra hot water, 2 forks, split bill"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />

          <Divider my="xs" />

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setNewModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="dinePrimary"
              leftSection={<IconCheck size={16} />}
              loading={createMutation.isPending}
              onClick={handleCreateRequest}
            >
              Submit Request
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  </Box>
);
}
