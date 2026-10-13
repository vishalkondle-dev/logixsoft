"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Title, Text, Group, Stack, SimpleGrid, Paper, Badge,
  Button, ActionIcon, TextInput, NumberInput, Modal, Menu,
  ThemeIcon, Loader, Center, Box, Divider, SegmentedControl,
  Radio, Alert, Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import {
  IconTableAlias, IconPlus, IconSearch, IconUsers, IconClock,
  IconReceipt, IconCheck, IconDotsVertical, IconEdit, IconTrash,
  IconShoppingCart, IconEye, IconArmchair,
  IconCash, IconCreditCard, IconQrcode, IconPrinter, IconX,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useTables, useOrders, useCreateTable, useUpdateTable,
  useDeleteTable, useReservations, useUpdateReservation, qk,
} from "@/lib/queries";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { freeTableOrder, voidOrder, getWaitlist } from "@/lib/api-client";
import { getStatusVisual, PAYMENT_STATUS_CONFIG } from "@/lib/order-status-ui";
import { buildBillPayload } from "@/lib/ticket";
import { printTicket } from "@/lib/print";
import { UpiQrCode } from "@/components/common/upi-qr-code";
import { useOutletSync } from "@/lib/use-outlet-sync";
import { WaitlistPanel } from "@/components/tables/waitlist-panel";

/** Helper to match table numbers flexibly (e.g. "T1" === "Table 1" === "t1" === "1") */
function normalizeTable(str: string): string {
  return str.toLowerCase().trim().replace(/^table\s*/i, "").replace(/^t\s*/i, "").replace(/[\s-_]+/g, "");
}

function isTableMatch(tableName: string, orderTableNo?: string | null): boolean {
  if (!orderTableNo || orderTableNo === "Takeaway") return false;
  const t1 = tableName.toLowerCase().trim();
  const t2 = orderTableNo.toLowerCase().trim();
  if (t1 === t2) return true;
  return normalizeTable(t1) === normalizeTable(t2);
}

export interface TableSession {
  table: any;
  orders: any[];
  isOccupied: boolean;
  totalPaise: number;
  paidPaise: number;
  duePaise: number;
  totalItemsCount: number;
  allItems: any[];
  roundsCount: number;
  tokensStr: string;
  orderStatus: string;
  oldestCreatedAt: string;
  elapsedMinutes: number;
}

function TablesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [viewMode, setViewMode] = useState<"TABLES" | "WAITLIST">(
    tabParam === "waitlist" ? "WAITLIST" : "TABLES"
  );

  useEffect(() => {
    if (tabParam === "waitlist") {
      setViewMode("WAITLIST");
    } else if (tabParam === "tables") {
      setViewMode("TABLES");
    }
  }, [tabParam]);

  const queryClient = useQueryClient();
  const { restaurant, activeOutlet, outlets, role } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? outlets[0]?.id ?? "";

  const canManage = role === "OWNER" || role === "MANAGER";

  // Waitlist query for header counter and badge
  const { data: waitlistData } = useQuery({
    queryKey: ["waitlist", restaurantId, outletId, "ACTIVE"],
    queryFn: () => getWaitlist(restaurantId, outletId, "ACTIVE"),
    enabled: Boolean(restaurantId && outletId),
    refetchInterval: 8000,
  });
  const waitingCount = waitlistData?.stats?.waitingCount ?? 0;

  // Re-render tick every 15s to update "Xm seated" time display
  const [, forceTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => clearInterval(timer);
  }, []);

  // ─── Real-time Dynamic Data Fetching ──────────────────────────────────────────
  // Live WebSocket sync via Cloudflare Durable Object
  const { isConnected, isConnecting } = useOutletSync(restaurantId, outletId);

  // Table Definitions (Real-time live sync via Cloudflare Durable Object)
  const {
    data: tables = [],
    isLoading: tablesLoading,
    refetch: refetchTables,
  } = useTables(restaurantId, outletId, { refetchInterval: false });

  // Occupied Table Orders (Real-time live sync via Cloudflare Durable Object)
  const {
    data: orders = [],
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useOrders(
    restaurantId,
    {
      tableOccupied: true,
      outletId: outletId || undefined,
      limit: 100,
    },
    !!restaurantId && !!outletId,
    { refetchInterval: false },
  );

  // ─── Filter States ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "FREE" | "RESERVED" | "OCCUPIED">("ALL");

  // ─── Table Form / Modal States ────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [tableName, setTableName] = useState("");
  const [tableNameError, setTableNameError] = useState<string | null>(null);
  const [section, setSection] = useState("");
  const [capacity, setCapacity] = useState<number | string>(4);
  const [deleteTableConfirm, setDeleteTableConfirm] = useState<any | null>(null);

  // ─── Free Table (Settle & Clear) Modal State ─────────────────────────────────
  const [freeModalSession, setFreeModalSession] = useState<TableSession | null>(null);
  const [settleMethod, setSettleMethod] = useState<string>("Cash");
  const [isFreeing, setIsFreeing] = useState(false);

  // ─── View Order Modal State ──────────────────────────────────────────────────
  const [viewSession, setViewSession] = useState<TableSession | null>(null);
  const [isPrintingBill, setIsPrintingBill] = useState(false);

  // ─── QR Code Modal State ─────────────────────────────────────────────────────
  const [qrModalTable, setQrModalTable] = useState<any | null>(null);

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const createTableMut = useCreateTable(restaurantId, outletId);
  const updateTableMut = useUpdateTable(restaurantId, outletId);
  const deleteTableMut = useDeleteTable(restaurantId, outletId);

  // ─── Reservations Integration ────────────────────────────────────────────────
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const { data: reservations = [] } = useReservations(restaurantId, outletId, { date: todayStr });
  const updateReservationMut = useUpdateReservation(restaurantId, outletId);

  // ─── Dining Settings Integration ─────────────────────────────────────────────
  const diningSettings = useMemo(() => {
    if (!activeOutlet?.diningSettings) return null;
    if (typeof activeOutlet.diningSettings === "string") {
      try {
        return JSON.parse(activeOutlet.diningSettings);
      } catch {
        return null;
      }
    }
    return activeOutlet.diningSettings as any;
  }, [activeOutlet?.diningSettings]);
  const isDineInDisabled = diningSettings?.dineInEnabled === false;

  // ─── Multi-Order / Multi-Round Active Orders for Table ────────────────────────
  const getTableActiveOrders = (table: any): any[] => {
    const matched: any[] = [];
    const seenIds = new Set<string>();
    for (const entry of orders) {
      if (entry.order?.tableNo && isTableMatch(table.name, entry.order.tableNo)) {
        if (!entry.order?.tableFreedAt && !seenIds.has(entry.order.id)) {
          seenIds.add(entry.order.id);
          matched.push(entry);
        }
      }
    }
    return matched;
  };

  const getTableSession = (table: any): TableSession => {
    const tableOrders = getTableActiveOrders(table);
    const isOccupied = tableOrders.length > 0;
    if (!isOccupied) {
      return {
        table,
        orders: [],
        isOccupied: false,
        totalPaise: 0,
        paidPaise: 0,
        duePaise: 0,
        totalItemsCount: 0,
        allItems: [],
        roundsCount: 0,
        tokensStr: "",
        orderStatus: "FREE",
        oldestCreatedAt: "",
        elapsedMinutes: 0,
      };
    }

    const allItems = tableOrders.flatMap((o: any) => o.items ?? []);
    const totalPaise = tableOrders.reduce((sum: number, o: any) => sum + (o.order?.subtotalPaise || 0), 0);
    const paidPaise = tableOrders.reduce((sum: number, o: any) => {
      const p = o.order?.paidPaise ?? 0;
      return sum + (o.order?.status === "PAID" ? Math.max(p, o.order?.subtotalPaise || 0) : p);
    }, 0);
    const duePaise = Math.max(0, totalPaise - paidPaise);
    
    // Group and count rounds strictly based on distinct item rounds
    const roundNumbers = Array.from(new Set(allItems.map((it: any) => it.round || 1))).sort((a: number, b: number) => a - b);
    const roundsCount = roundNumbers.length > 0 ? Math.max(...roundNumbers) : (tableOrders.length > 0 ? 1 : 0);
    
    const tokensStr = tableOrders.map((o: any) => `#${o.order.orderNo}`).join(", ");
    const oldestCreatedAt = tableOrders.reduce(
      (oldest: string, o: any) => (!oldest || new Date(o.order.createdAt) < new Date(oldest) ? o.order.createdAt : oldest),
      ""
    );
    const elapsedMinutes = oldestCreatedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(oldestCreatedAt).getTime()) / 60000))
      : 0;
    const orderStatus = tableOrders[0]?.order?.orderStatus || "ORDERED";

    return {
      table,
      orders: tableOrders,
      isOccupied: true,
      totalPaise,
      paidPaise,
      duePaise,
      totalItemsCount: allItems.length,
      allItems,
      roundsCount,
      tokensStr,
      orderStatus,
      oldestCreatedAt,
      elapsedMinutes,
    };
  };

  const getTableActiveReservation = (table: any) => {
    return (reservations as any[]).find(
      (r: any) =>
        (r.tableId === table.id || (r.tableName && isTableMatch(table.name, r.tableName)) || isTableMatch(table.name, r.tableId)) &&
        (r.status === "CONFIRMED" || r.status === "SEATED")
    );
  };

  // ─── Unique Sections ─────────────────────────────────────────────────────────
  const sections = useMemo(() => {
    const set = new Set<string>();
    for (const t of tables) {
      if (t.section?.trim()) {
        set.add(t.section.trim());
      }
    }
    return Array.from(set);
  }, [tables]);

  // ─── Statistics ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let occupied = 0;
    let reserved = 0;
    let free = 0;
    let totalSeats = 0;

    for (const t of tables) {
      if (t.active) {
        totalSeats += t.capacity || 0;
        const session = getTableSession(t);
        const res = getTableActiveReservation(t);

        if (session.isOccupied) {
          occupied++;
        } else if (res) {
          reserved++;
        } else {
          free++;
        }
      }
    }

    return { total: tables.length, occupied, reserved, free, totalSeats };
  }, [tables, orders, reservations]);

  // ─── Filtered Tables ──────────────────────────────────────────────────────────
  const filteredTables = useMemo(() => {
    return tables.filter((t: any) => {
      // Search by name or section
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.name?.toLowerCase().includes(q);
        const matchesSection = t.section?.toLowerCase().includes(q);
        if (!matchesName && !matchesSection) return false;
      }

      // Section filter
      if (selectedSection !== "ALL") {
        if ((t.section || "").trim().toLowerCase() !== selectedSection.toLowerCase()) {
          return false;
        }
      }

      // Status filter
      const session = getTableSession(t);
      const res = getTableActiveReservation(t);
      if (statusFilter === "FREE" && (session.isOccupied || res)) return false;
      if (statusFilter === "RESERVED" && (!res || session.isOccupied)) return false;
      if (statusFilter === "OCCUPIED" && !session.isOccupied) return false;

      return true;
    });
  }, [tables, searchQuery, selectedSection, statusFilter, orders, reservations]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingTable(null);
    setTableName("");
    setTableNameError(null);
    setSection("");
    setCapacity(4);
    setModalOpen(true);
  };

  const handleOpenEdit = (table: any) => {
    setEditingTable(table);
    setTableName(table.name);
    setTableNameError(null);
    setSection(table.section || "");
    setCapacity(table.capacity || 4);
    setModalOpen(true);
  };

  const handleSaveTable = async () => {
    if (!tableName.trim()) {
      setTableNameError("Table name is required");
      return;
    }
    if (!outletId) {
      notifications.show({ title: "No outlet selected", message: "Please select an outlet first", color: "orange" });
      return;
    }
    setTableNameError(null);
    try {
      if (editingTable) {
        await updateTableMut.mutateAsync({
          id: editingTable.id,
          body: {
            name: tableName.trim(),
            section: section.trim() || undefined,
            capacity: capacity ? Number(capacity) : undefined,
          },
        });
        notifications.show({ title: "Table updated", message: `Table "${tableName.trim()}" updated`, color: "green", icon: <IconCheck size={16} /> });
      } else {
        await createTableMut.mutateAsync({
          outletId,
          name: tableName.trim(),
          section: section.trim() || undefined,
          capacity: capacity ? Number(capacity) : undefined,
        });
        notifications.show({ title: "Table created", message: `Table "${tableName.trim()}" created`, color: "green", icon: <IconCheck size={16} /> });
      }
      setModalOpen(false);
    } catch (err: any) {
      notifications.show({ title: "Failed to save table", message: err.message || "An error occurred", color: "red" });
    }
  };

  const handleDeleteTable = (table: any) => {
    setDeleteTableConfirm(table);
  };

  const handleConfirmDeleteTable = async () => {
    if (!deleteTableConfirm) return;
    try {
      await deleteTableMut.mutateAsync(deleteTableConfirm.id);
      notifications.show({ title: "Table deleted", message: `Table "${deleteTableConfirm.name}" removed`, color: "green" });
      setDeleteTableConfirm(null);
    } catch (err: any) {
      notifications.show({ title: "Failed to delete table", message: err.message || "An error occurred", color: "red" });
    }
  };

  // Open "Free Table" confirmation modal
  const handleOpenFreeModal = (session: TableSession) => {
    setFreeModalSession(session);
    setSettleMethod("Cash");
  };

  // Action: Settle any remaining unpaid due and free table
  const handleSettleAndFreeTable = async () => {
    if (!freeModalSession || freeModalSession.orders.length === 0) return;
    setIsFreeing(true);
    try {
      const activeRes = getTableActiveReservation(freeModalSession.table);
      if (activeRes && (activeRes.status === "SEATED" || activeRes.status === "CONFIRMED")) {
        await updateReservationMut.mutateAsync({
          id: activeRes.id,
          body: { status: "COMPLETED" },
        }).catch(() => {});
      }

      await Promise.all(
        freeModalSession.orders.map((o: any) =>
          freeTableOrder(
            restaurantId,
            o.order.id,
            freeModalSession.duePaise > 0 ? { method: settleMethod } : {},
            outletId,
          )
        )
      );

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
      queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, outletId) });
      queryClient.invalidateQueries({ queryKey: qk.tables(restaurantId, outletId) });
      queryClient.invalidateQueries({ queryKey: ["reservations", restaurantId] });

      notifications.show({
        title: "Table Freed",
        message: `Table "${freeModalSession.table.name}" is now Free.${freeModalSession.duePaise > 0 ? ` Settled ₹${(freeModalSession.duePaise / 100).toFixed(0)} via ${settleMethod}.` : " All rounds were paid."}`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      setFreeModalSession(null);
    } catch (err: any) {
      notifications.show({ title: "Failed to free table", message: err.message || "Error freeing table", color: "red" });
    } finally {
      setIsFreeing(false);
    }
  };

  // Action: Void order(s) and release table immediately
  const handleVoidAndReleaseTable = () => {
    if (!freeModalSession || freeModalSession.orders.length === 0) return;
    const session = freeModalSession;
    modals.openConfirmModal({
      title: "Release Table & Void Orders",
      centered: true,
      children: (
        <Text size="sm">
          Release table &quot;{session.table.name}&quot; and void active orders ({session.tokensStr})? This action cannot be reversed.
        </Text>
      ),
      labels: { confirm: "Release & Void", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        setIsFreeing(true);
        try {
          await Promise.all(
            session.orders.map((o: any) =>
              voidOrder(restaurantId, o.order.id, outletId)
            )
          );

          queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
          queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, outletId) });
          queryClient.invalidateQueries({ queryKey: qk.tables(restaurantId, outletId) });

          notifications.show({
            title: "Table Released",
            message: `Table "${session.table.name}" is now Free.`,
            color: "blue",
            icon: <IconCheck size={16} />,
          });

          setFreeModalSession(null);
        } catch (err: any) {
          notifications.show({ title: "Failed to release table", message: err.message || "Error voiding order", color: "red" });
        } finally {
          setIsFreeing(false);
        }
      },
    });
  };

  // Print consolidated bill from modal
  const handlePrintBill = async (session: TableSession) => {
    if (!restaurant || !session.orders.length) return;
    setIsPrintingBill(true);
    try {
      const primaryOrder = session.orders[0];
      const payload = buildBillPayload(primaryOrder, restaurant, {
        items: session.allItems,
        subtotalPaise: session.totalPaise,
      });
      const result = await printTicket(payload);
      if (result === "ble") {
        notifications.show({
          title: "Bill Printed",
          message: "Sent to Bluetooth printer",
          color: "green",
        });
      } else if (result === "browser") {
        notifications.show({
          title: "Bill Printed",
          message: "Sent to default printer",
          color: "green",
        });
      } else {
        notifications.show({
          title: "Print Failed",
          message: "Could not send to printer. Please check printer connection.",
          color: "red",
        });
      }
    } catch (err: any) {
      notifications.show({ title: "Print Failed", message: err.message || "Could not print bill", color: "red" });
    } finally {
      setIsPrintingBill(false);
    }
  };

  const isSaving = createTableMut.isPending || updateTableMut.isPending;

  if (!restaurant) return null;

  return (
    <Box pt="sm" pb="xl" px={{ base: "xs", sm: "md" }}>
      {/* ─── Top Header & Mode Switcher ───────────────────────────────────────── */}
      <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
        <div>
          <Group gap="xs" align="center">
            <Title order={2}>Tables & Queue</Title>
            <Badge
              size="sm"
              variant="dot"
              color={isConnected ? "teal" : isConnecting ? "yellow" : "gray"}
            >
              {isConnected ? "Live Synced" : isConnecting ? "Connecting..." : "Offline"}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {activeOutlet?.name || "Active Outlet"} · {stats.occupied} Occupied{stats.reserved > 0 ? ` · ${stats.reserved} Reserved` : ""} · {stats.free} Free{waitingCount > 0 ? ` · ${waitingCount} Waiting` : ""}
          </Text>
        </div>

        <Group gap="xs" wrap="wrap">
          <SegmentedControl
            value={viewMode}
            onChange={(val) => setViewMode(val as "TABLES" | "WAITLIST")}
            data={[
              {
                value: "TABLES",
                label: (
                  <Center style={{ gap: 6 }}>
                    <IconTableAlias size={16} />
                    <span>Tables ({stats.total})</span>
                  </Center>
                ),
              },
              {
                value: "WAITLIST",
                label: (
                  <Center style={{ gap: 6 }}>
                    <IconUsers size={16} />
                    <span>Waitlist & Queue</span>
                    {waitingCount > 0 && (
                      <Badge size="xs" color="orange" variant="filled" circle>
                        {waitingCount}
                      </Badge>
                    )}
                  </Center>
                ),
              },
            ]}
          />

          {viewMode === "TABLES" && canManage && (
            <Tooltip label="Add Table" withArrow position="bottom">
              <ActionIcon
                size="lg"
                radius="md"
                color="dinePrimary"
                aria-label="Add Table"
                onClick={handleOpenCreate}
                disabled={!outletId}
              >
                <IconPlus size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {viewMode === "WAITLIST" ? (
        <WaitlistPanel
          restaurantId={restaurantId}
          outletId={outletId}
          tables={tables}
          canManage={canManage}
        />
      ) : (
        <>
          {/* ─── KPI Counters ─────────────────────────────────────────────────────── */}
      <SimpleGrid cols={{ base: 2, sm: stats.reserved > 0 ? 5 : 4 }} spacing="sm" mb="md">
        {/* Total Tables */}
        <Paper p="sm" radius="md">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Tables</Text>
              <Text size="xl" fw={800}>{stats.total}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="gray">
              <IconTableAlias size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        {/* Free / Available Tables */}
        <Paper p="sm" radius="md">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="teal.7" fw={700} tt="uppercase">Free Tables</Text>
              <Text size="xl" fw={800} c="teal.7">{stats.free}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="teal">
              <IconCheck size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        {/* Reserved Tables */}
        {stats.reserved > 0 && (
          <Paper p="sm" radius="md">
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="grape.7" fw={700} tt="uppercase">Reserved</Text>
                <Text size="xl" fw={800} c="grape.7">{stats.reserved}</Text>
              </div>
              <ThemeIcon size={38} radius="md" variant="light" color="grape">
                <IconArmchair size={20} />
              </ThemeIcon>
            </Group>
          </Paper>
        )}

        {/* Occupied Tables */}
        <Paper p="sm" radius="md">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="orange.8" fw={700} tt="uppercase">Occupied</Text>
              <Text size="xl" fw={800} c="orange.8">{stats.occupied}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="orange">
              <IconClock size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        {/* Total Seats */}
        <Paper p="sm" radius="md">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Seats</Text>
              <Text size="xl" fw={800}>{stats.totalSeats}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="dinePrimary">
              <IconArmchair size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ─── Filter & Search Bar ───────────────────────────────────────────────── */}
      <Paper p="sm" radius="md" mb="md">
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            {/* Search Input */}
            <TextInput
              size="sm"
              placeholder="Search table or section..."
              leftSection={<IconSearch size={15} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ minWidth: 200, flex: 1 }}
            />

            {/* Status Filter Tabs */}
            <SegmentedControl
              size="sm"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              data={[
                { label: `All (${tables.length})`, value: "ALL" },
                { label: `Free (${stats.free})`, value: "FREE" },
                ...(stats.reserved > 0 ? [{ label: `Reserved (${stats.reserved})`, value: "RESERVED" }] : []),
                { label: `Occupied (${stats.occupied})`, value: "OCCUPIED" },
              ]}
            />
          </Group>

          {/* Section Filter Pills */}
          {sections.length > 0 && (
            <Group gap={6} wrap="wrap" pt={4} style={{ borderTop: "1px solid #eee" }}>
              <Text size="xs" fw={600} c="dimmed" mr={4}>Section:</Text>
              <Badge
                size="md"
                variant={selectedSection === "ALL" ? "filled" : "light"}
                color={selectedSection === "ALL" ? "dinePrimary" : "gray"}
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedSection("ALL")}
              >
                All Sections
              </Badge>
              {sections.map((sec) => (
                <Badge
                  key={sec}
                  size="md"
                  variant={selectedSection === sec ? "filled" : "light"}
                  color={selectedSection === sec ? "dinePrimary" : "gray"}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedSection(sec)}
                >
                  {sec}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
      </Paper>

      {/* ─── Tables Grid ───────────────────────────────────────────────────────── */}
      {isDineInDisabled && (
        <Alert color="orange" icon={<IconAlertCircle size={16} />} radius="md" mb="md">
          <Text size="sm" fw={600}>Dine-In channel is disabled</Text>
          <Text size="xs">Dine-in dining is turned off in Settings &gt; Dining Options. New table orders and customer self-ordering are restricted.</Text>
        </Alert>
      )}

      {!outletId ? (
        <Text c="dimmed" ta="center" py={60}>
          Please select an outlet from the top navigation bar to view tables.
        </Text>
      ) : tablesLoading || ordersLoading ? (
        <Center py={80}>
          <Loader color="dinePrimary" size="lg" />
        </Center>
      ) : !filteredTables.length ? (
        <Paper p="xl" radius="md" style={{ textAlign: "center" }} my="lg">
          <ThemeIcon size={56} radius="xl" variant="light" color="gray" mx="auto" mb="sm">
            <IconTableAlias size={28} />
          </ThemeIcon>
          <Title order={4} mb={4}>No tables found</Title>
          <Text size="sm" c="dimmed" mb="md">
            {searchQuery || selectedSection !== "ALL" || statusFilter !== "ALL"
              ? "No tables matched your search or active filters."
              : "No tables have been added to this outlet yet."}
          </Text>
          {canManage && (
            <Button
              color="dinePrimary"
              size="sm"
              leftSection={<IconPlus size={14} />}
              onClick={handleOpenCreate}
            >
              Add First Table
            </Button>
          )}
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4 }} spacing="md">
          {filteredTables.map((table: any) => {
            const session = getTableSession(table);
            const isOccupied = session.isOccupied;

            const activeRes = getTableActiveReservation(table);

            const orderVisual = isOccupied
              ? getStatusVisual(session.orderStatus || "ORDERED")
              : null;
            const OrderIcon = orderVisual?.icon;

            return (
              <Paper
                key={table.id}
                p="md"
                radius="md"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease",
                }}
              >
                <div>
                  {/* Card Header: Table Name + Capacity + Options Menu */}
                  <Group justify="space-between" align="flex-start" mb="xs">
                    <div>
                      <Group gap="xs" align="center">
                        <Text size="lg" fw={800} style={{ letterSpacing: "-0.5px" }}>
                          {table.name}
                        </Text>
                        <ThemeIcon size="xs" variant="transparent" c="dimmed">
                          <IconUsers size={12} />
                        </ThemeIcon>
                        <Text size="xs" c="dimmed" fw={500}>
                          {table.capacity ? `${table.capacity}` : "4"}
                        </Text>
                      </Group>
                      {table.section && (
                        <Text size="xs" c="dimmed" fw={500} mt={1}>
                          {table.section}
                        </Text>
                      )}
                    </div>

                    <Group gap={4} align="center">
                      {/* Active Reservation Badge (only when occupied, so staff knows occupied table belongs to a reserved guest) */}
                      {isOccupied && activeRes && (
                        <Badge
                          size="sm"
                          variant="filled"
                          color={activeRes.status === "CONFIRMED" ? "grape" : "indigo"}
                          leftSection={<IconArmchair size={11} />}
                        >
                          {activeRes.guestName}
                        </Badge>
                      )}

                      {/* Status Badge: Occupied vs Reserved vs Free */}
                      {isOccupied ? (
                        <Badge
                          size="sm"
                          variant="light"
                          color={session.duePaise === 0 ? "teal" : "orange"}
                          leftSection={session.duePaise === 0 ? <IconCheck size={11} /> : <IconClock size={11} />}
                        >
                          {session.duePaise === 0 ? "Occupied · Paid" : "Occupied"}
                        </Badge>
                      ) : activeRes ? (
                        <Badge
                          size="sm"
                          variant="filled"
                          color={activeRes.status === "CONFIRMED" ? "grape" : "indigo"}
                          leftSection={<IconArmchair size={11} />}
                        >
                          {activeRes.status === "CONFIRMED"
                            ? `Reserved · ${activeRes.guestName}`
                            : `Seated · ${activeRes.guestName}`}
                        </Badge>
                      ) : (
                        <Badge
                          size="sm"
                          variant="light"
                          color="teal"
                          leftSection={<IconCheck size={11} />}
                        >
                          Free
                        </Badge>
                      )}

                      {/* Management & Actions Menu */}
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Table options">
                            <IconDotsVertical size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {activeRes && activeRes.status === "CONFIRMED" && (
                            <>
                              <Menu.Item
                                color="grape"
                                leftSection={<IconArmchair size={14} />}
                                disabled={isOccupied}
                                onClick={async () => {
                                  if (isOccupied) {
                                    notifications.show({
                                      title: "Table Not Free",
                                      message: `Cannot seat guest: Table "${table.name}" is currently occupied. Please free or settle the table first.`,
                                      color: "red",
                                      icon: <IconAlertCircle size={16} />,
                                    });
                                    return;
                                  }
                                  try {
                                    await updateReservationMut.mutateAsync({
                                      id: activeRes.id,
                                      body: { status: "SEATED" },
                                    });
                                    notifications.show({
                                      title: "Guest Seated",
                                      message: `${activeRes.guestName} (${activeRes.partySize} guests) seated at ${table.name}`,
                                      color: "teal",
                                      icon: <IconCheck size={16} />,
                                    });
                                  } catch (e: any) {
                                    notifications.show({
                                      title: "Failed to seat guest",
                                      message: e.message || "Could not update reservation",
                                      color: "red",
                                    });
                                  }
                                }}
                              >
                                {isOccupied ? `Table Occupied (${activeRes.guestName})` : `Seat Reserved Guest (${activeRes.guestName})`}
                              </Menu.Item>
                              <Menu.Item
                                color="dinePrimary"
                                leftSection={<IconShoppingCart size={14} />}
                                disabled={isOccupied || isDineInDisabled}
                                onClick={async () => {
                                  if (isOccupied) {
                                    notifications.show({
                                      title: "Table Not Free",
                                      message: `Cannot seat guest: Table "${table.name}" is currently occupied. Please free or settle the table first.`,
                                      color: "red",
                                      icon: <IconAlertCircle size={16} />,
                                    });
                                    return;
                                  }
                                  if (isDineInDisabled) return;
                                  try {
                                    await updateReservationMut.mutateAsync({
                                      id: activeRes.id,
                                      body: { status: "SEATED" },
                                    });
                                  } catch {}
                                  const phoneQuery = activeRes.guestPhone ? `&phone=${encodeURIComponent(activeRes.guestPhone)}` : "";
                                  router.push(`/pos?table=${encodeURIComponent(table.name)}&outletId=${outletId}${phoneQuery}`);
                                }}
                              >
                                Seat & Take Order
                              </Menu.Item>
                              <Menu.Divider />
                            </>
                          )}
                          {activeRes && activeRes.status === "SEATED" && !isOccupied && (
                            <>
                              <Menu.Item
                                color="dinePrimary"
                                leftSection={<IconShoppingCart size={14} />}
                                onClick={() => {
                                  if (isDineInDisabled) return;
                                  const phoneQuery = activeRes.guestPhone ? `&phone=${encodeURIComponent(activeRes.guestPhone)}` : "";
                                  router.push(`/pos?table=${encodeURIComponent(table.name)}&outletId=${outletId}${phoneQuery}`);
                                }}
                              >
                                Take Order ({activeRes.guestName})
                              </Menu.Item>
                              <Menu.Divider />
                            </>
                          )}
                          {activeRes && (
                            <>
                              <Menu.Item
                                color="teal"
                                leftSection={<IconCheck size={14} />}
                                onClick={async () => {
                                  try {
                                    await updateReservationMut.mutateAsync({
                                      id: activeRes.id,
                                      body: { status: "COMPLETED" },
                                    });
                                    notifications.show({
                                      title: "Reservation Completed",
                                      message: `Reservation for ${activeRes.guestName} marked completed.`,
                                      color: "teal",
                                    });
                                  } catch (e: any) {
                                    notifications.show({
                                      title: "Failed to complete reservation",
                                      message: e.message || "Could not update reservation",
                                      color: "red",
                                    });
                                  }
                                }}
                              >
                                Complete Reservation ({activeRes.guestName})
                              </Menu.Item>
                              <Menu.Divider />
                            </>
                          )}
                          <Menu.Item
                            leftSection={<IconQrcode size={14} />}
                            onClick={() => setQrModalTable(table)}
                          >
                            View Table QR Code
                          </Menu.Item>
                          {canManage && (
                            <>
                              <Menu.Item
                                leftSection={<IconEdit size={14} />}
                                onClick={() => handleOpenEdit(table)}
                              >
                                Edit Table
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                onClick={() => handleDeleteTable(table)}
                              >
                                Delete Table
                              </Menu.Item>
                            </>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>

                  {/* ─── Middle Section: Live Occupancy or Available Status ─────── */}
                  {isOccupied ? (
                    <Box
                      p="xs"
                      mb="sm"
                      style={{
                        backgroundColor: session.duePaise === 0 ? "rgba(32, 201, 151, 0.08)" : "rgba(253, 126, 20, 0.08)",
                        borderRadius: "6px",
                      }}
                    >
                      {/* Token No & Amount */}
                      <Group justify="space-between" align="center" mb={2}>
                        <Group gap={4} align="center">
                          <Text size="xs" fw={800} c={session.duePaise === 0 ? "teal.9" : "orange.9"}>
                            Token {session.tokensStr}
                          </Text>
                          {orderVisual && OrderIcon && (
                            <Badge size="xs" variant="filled" color={orderVisual.color} leftSection={<OrderIcon size={9} />}>
                              {orderVisual.label}
                            </Badge>
                          )}
                        </Group>
                        <Text size="sm" fw={800} c="dinePrimary">
                          ₹{(session.totalPaise / 100).toFixed(0)}
                        </Text>
                      </Group>

                      {/* Seated duration & Items summary */}
                      <Group justify="space-between" align="center" mt={4}>
                        <Group gap={6} align="center">
                          <Text size="11px" c="dimmed">
                            {session.totalItemsCount} item{session.totalItemsCount !== 1 ? "s" : ""}
                          </Text>
                          {session.roundsCount > 1 && (
                            <Badge size="xs" variant="filled" color="grape" style={{ height: 16, fontSize: 10, padding: "0 5px" }}>
                              ↻ {session.roundsCount} Rounds
                            </Badge>
                          )}
                        </Group>
                        <Text size="11px" fw={700} c={session.duePaise === 0 ? "teal.8" : "orange.8"}>
                          {session.duePaise === 0 ? "All Paid" : `Due: ₹${(session.duePaise / 100).toFixed(0)}`}
                        </Text>
                      </Group>

                      {/* Brief item preview */}
                      {session.allItems.length > 0 && (
                        <Text size="10px" c="dimmed" lineClamp={1} mt={3}>
                          {session.allItems.map((i: any) => `${i.nameSnapshot || i.name} (${i.qty})${i.round && i.round > 1 ? ` [R${i.round}]` : ""}`).join(", ")}
                        </Text>
                      )}
                    </Box>
                  ) : activeRes ? (
                    <Box
                      p="xs"
                      mb="sm"
                      style={{
                        backgroundColor: activeRes.status === "CONFIRMED" ? "rgba(190, 75, 219, 0.08)" : "rgba(76, 110, 245, 0.08)",
                        borderRadius: "6px",
                        textAlign: "center",
                        border: `1px dashed ${activeRes.status === "CONFIRMED" ? "rgba(190, 75, 219, 0.3)" : "rgba(76, 110, 245, 0.3)"}`,
                      }}
                    >
                      <Group gap={4} justify="center" align="center">
                        <IconArmchair size={13} color={activeRes.status === "CONFIRMED" ? "var(--mantine-color-grape-7)" : "var(--mantine-color-indigo-7)"} />
                        <Text size="xs" c={activeRes.status === "CONFIRMED" ? "grape.8" : "indigo.8"} fw={700}>
                          {activeRes.status === "CONFIRMED" ? `Reserved: ${activeRes.guestName}` : `Guest Seated: ${activeRes.guestName}`}
                        </Text>
                      </Group>
                      <Text size="11px" c="dimmed" mt={2}>
                        {activeRes.partySize ? `${activeRes.partySize} Guests · ` : ""}{activeRes.startTime || activeRes.reservationTime || "Today"}
                        {activeRes.notes ? ` · "${activeRes.notes}"` : ""}
                      </Text>
                    </Box>
                  ) : (
                    <Box
                      p="xs"
                      mb="sm"
                      style={{
                        backgroundColor: "rgba(32, 201, 151, 0.05)",
                        borderRadius: "6px",
                        textAlign: "center",
                      }}
                    >
                      <Text size="xs" c="teal.8" fw={500}>
                        Table is Free & Ready
                      </Text>
                    </Box>
                  )}
                </div>

                {/* ─── Bottom Action Buttons ────────────────────────────────────── */}
                <div>
                  <Divider mb="xs" />
                  {isOccupied ? (
                    <Stack gap={6}>
                      {/* Primary Free Table button */}
                      <Button
                        fullWidth
                        size="xs"
                        color="teal"
                        variant={session.duePaise === 0 ? "filled" : "light"}
                        leftSection={<IconCheck size={14} />}
                        onClick={() => handleOpenFreeModal(session)}
                      >
                        {session.duePaise === 0 ? "Free Table" : `Settle & Free (Due: ₹${(session.duePaise / 100).toFixed(0)})`}
                      </Button>

                      {/* Secondary actions: View Order & + Add Round */}
                      <Group gap={6} grow>
                        <Button
                          size="xs"
                          px={6}
                          variant="light"
                          color="gray"
                          leftSection={<IconEye size={13} />}
                          onClick={() => setViewSession(session)}
                        >
                          View Bill
                        </Button>

                        <Button
                          size="xs"
                          px={6}
                          variant="light"
                          color="dinePrimary"
                          leftSection={<IconPlus size={12} />}
                          onClick={() => router.push(`/pos?table=${encodeURIComponent(table.name)}&outletId=${outletId}`)}
                        >
                          Add Round
                        </Button>
                      </Group>
                    </Stack>
                  ) : activeRes && activeRes.status === "CONFIRMED" ? (
                    <Group gap={6} grow>
                      <Button
                        size="sm"
                        color="grape"
                        variant="light"
                        leftSection={<IconArmchair size={14} />}
                        onClick={async () => {
                          try {
                            await updateReservationMut.mutateAsync({
                              id: activeRes.id,
                              body: { status: "SEATED" },
                            });
                            notifications.show({
                              title: "Guest Seated",
                              message: `${activeRes.guestName} (${activeRes.partySize} guests) seated at ${table.name}`,
                              color: "teal",
                              icon: <IconCheck size={16} />,
                            });
                          } catch (e: any) {
                            notifications.show({
                              title: "Failed to seat guest",
                              message: e.message || "Could not update reservation",
                              color: "red",
                            });
                          }
                        }}
                      >
                        Seat Guest
                      </Button>
                      <Button
                        size="sm"
                        color={isDineInDisabled ? "gray" : "dinePrimary"}
                        variant="filled"
                        disabled={isDineInDisabled}
                        leftSection={<IconShoppingCart size={14} />}
                        onClick={async () => {
                          if (isDineInDisabled) return;
                          try {
                            await updateReservationMut.mutateAsync({
                              id: activeRes.id,
                              body: { status: "SEATED" },
                            });
                          } catch {}
                          const phoneQuery = activeRes.guestPhone ? `&phone=${encodeURIComponent(activeRes.guestPhone)}` : "";
                          router.push(`/pos?table=${encodeURIComponent(table.name)}&outletId=${outletId}${phoneQuery}`);
                        }}
                      >
                        Seat & Take Order
                      </Button>
                    </Group>
                  ) : activeRes && activeRes.status === "SEATED" ? (
                    <Button
                      fullWidth
                      size="sm"
                      color={isDineInDisabled ? "gray" : "dinePrimary"}
                      variant="filled"
                      disabled={isDineInDisabled}
                      leftSection={<IconShoppingCart size={16} />}
                      onClick={() => {
                        if (isDineInDisabled) return;
                        const phoneQuery = activeRes.guestPhone ? `&phone=${encodeURIComponent(activeRes.guestPhone)}` : "";
                        router.push(`/pos?table=${encodeURIComponent(table.name)}&outletId=${outletId}${phoneQuery}`);
                      }}
                    >
                      {isDineInDisabled ? "Dine-In Disabled" : `Take Order (${activeRes.guestName})`}
                    </Button>
                  ) : (
                    <Button
                      fullWidth
                      size="sm"
                      color={isDineInDisabled ? "gray" : "dinePrimary"}
                      variant="light"
                      disabled={isDineInDisabled}
                      leftSection={<IconShoppingCart size={16} />}
                      onClick={() => !isDineInDisabled && router.push(`/pos?table=${encodeURIComponent(table.name)}&outletId=${outletId}`)}
                    >
                      {isDineInDisabled ? "Dine-In Disabled" : "Take Order (Dine In)"}
                    </Button>
                  )}
                </div>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}
        </>
      )}

      {/* ─── Free Table (Settle & Clear) Modal ─────────────────────────────────── */}
      <Modal
        opened={Boolean(freeModalSession)}
        onClose={() => {
          if (!isFreeing) {
            setFreeModalSession(null);
          }
        }}
        title={`Free Table "${freeModalSession?.table.name}"`}
        size="md"
      >
        {freeModalSession && (
          <Stack gap="md">
            <Paper p="sm" radius="md">
              <Group justify="space-between" align="center" mb="xs">
                <div>
                  <Text size="sm" fw={700}>Token {freeModalSession.tokensStr}</Text>
                  <Text size="xs" c="dimmed">
                    Seated {freeModalSession.elapsedMinutes}m ago · {freeModalSession.roundsCount} Round{freeModalSession.roundsCount !== 1 ? "s" : ""}
                  </Text>
                </div>
                <Badge size="lg" color={freeModalSession.duePaise === 0 ? "teal" : "orange"} variant="filled">
                  {freeModalSession.duePaise === 0 ? `Paid: ₹${(freeModalSession.totalPaise / 100).toFixed(0)}` : `Due: ₹${(freeModalSession.duePaise / 100).toFixed(0)}`}
                </Badge>
              </Group>

              <Group justify="space-between" align="center" mt={4}>
                <Text size="xs" c="dimmed">
                  Total Bill: ₹{(freeModalSession.totalPaise / 100).toFixed(0)} · Paid: ₹{(freeModalSession.paidPaise / 100).toFixed(0)}
                </Text>
              </Group>

              {/* Items summary */}
              <Text size="xs" c="dimmed" mt={6}>
                {freeModalSession.allItems?.map((i: any) => `${i.nameSnapshot || i.name} × ${i.qty}${i.round && i.round > 1 ? ` [R${i.round}]` : ""}`).join(", ")}
              </Text>
            </Paper>

            {/* Payment Method Selector — only needed if there is unpaid due */}
            {freeModalSession.duePaise > 0 ? (
              <div>
                <Text size="sm" fw={600} mb={6}>
                  Choose Payment Method to Settle Remaining Due (₹{(freeModalSession.duePaise / 100).toFixed(0)}):
                </Text>
                <Radio.Group
                  value={settleMethod}
                  onChange={setSettleMethod}
                >
                  <Group gap="sm">
                    <Radio value="Cash" label={<Group gap={4} align="center" wrap="nowrap"><IconCash size={15} /><span>Cash</span></Group>} />
                    <Radio value="UPI" label={<Group gap={4} align="center" wrap="nowrap"><IconQrcode size={15} /><span>UPI</span></Group>} />
                    <Radio value="Card" label={<Group gap={4} align="center" wrap="nowrap"><IconCreditCard size={15} /><span>Card</span></Group>} />
                    <Radio value="Other" label="Other" />
                  </Group>
                </Radio.Group>
                {settleMethod === "UPI" && activeOutlet?.upiId && (
                  <Box mt="sm">
                    <UpiQrCode
                      upiId={activeOutlet.upiId}
                      payeeName={activeOutlet.name || restaurant?.name}
                      amount={freeModalSession.duePaise / 100}
                      transactionId={`Table-${freeModalSession.table.name}`}
                    />
                  </Box>
                )}
              </div>
            ) : (
              <Alert color="teal" icon={<IconCheck size={16} />}>
                All rounds on this table have already been settled. Confirming will vacate the table and make it free for new guests.
              </Alert>
            )}

            {/* Open Items Warning Banner */}
            {(() => {
              const openItems = (freeModalSession.allItems || []).filter(
                (i: any) => i.status !== "SERVED" && i.status !== "CANCELLED"
              );
              if (openItems.length === 0) return null;
              return (
                <Alert
                  color="red"
                  variant="light"
                  title="Cannot Free Table: Open Items Pending"
                  icon={<IconAlertCircle size={18} />}
                >
                  <Stack gap={4}>
                    <Text size="xs">
                      There are <b>{openItems.length} item(s)</b> not yet served or cancelled ({openItems.slice(0, 3).map((i: any) => `${i.nameSnapshot || i.name} [${i.status || "ORDERED"}]`).join(", ")}{openItems.length > 3 ? ` +${openItems.length - 3} more` : ""}).
                    </Text>
                    <Text size="xs" c="dimmed">
                      All items must be served to the table or cancelled in kitchen before this table can be freed.
                    </Text>
                  </Stack>
                </Alert>
              );
            })()}

            <Divider />

            {/* Action Buttons */}
            {(() => {
              const openItems = (freeModalSession.allItems || []).filter(
                (i: any) => i.status !== "SERVED" && i.status !== "CANCELLED"
              );
              const hasOpenItems = openItems.length > 0;
              return (
                <Group justify="space-between" align="center" wrap="wrap">
                  {/* Option to release / void table without payment (walkout/cancelled) */}
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    leftSection={<IconX size={14} />}
                    onClick={handleVoidAndReleaseTable}
                    disabled={isFreeing}
                  >
                    Void & Release Table
                  </Button>

                  <Group gap="xs">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setFreeModalSession(null)}
                      disabled={isFreeing}
                    >
                      Cancel
                    </Button>

                    {/* Free Table Primary Action */}
                    <Tooltip
                      label="All items must be served or cancelled before freeing table"
                      disabled={!hasOpenItems}
                    >
                      <Button
                        color="teal"
                        size="sm"
                        leftSection={<IconCheck size={16} />}
                        loading={isFreeing}
                        disabled={hasOpenItems}
                        onClick={handleSettleAndFreeTable}
                      >
                        {freeModalSession.duePaise > 0
                          ? `Settle ₹${(freeModalSession.duePaise / 100).toFixed(0)} & Free Table`
                          : "Free Table"}
                      </Button>
                    </Tooltip>
                  </Group>
                </Group>
              );
            })()}
          </Stack>
        )}
      </Modal>

      {/* ─── Active Order Bill / View Modal ─────────────────────────────────────── */}
      <Modal
        opened={Boolean(viewSession)}
        onClose={() => setViewSession(null)}
        title={viewSession ? `Table ${viewSession.table.name} · Bill Preview (${viewSession.roundsCount} Round${viewSession.roundsCount !== 1 ? "s" : ""})` : "Order"}
        size="md"
      >
        {viewSession && (() => {
          // Group items by round number
          const roundMap = new Map<number, any[]>();
          for (const item of viewSession.allItems) {
            const r = item.round || 1;
            if (!roundMap.has(r)) roundMap.set(r, []);
            roundMap.get(r)!.push(item);
          }
          const roundNumbers = Array.from(roundMap.keys()).sort((a, b) => a - b);

          return (
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <div>
                  <Text size="xs" c="dimmed" fw={600}>Tokens: {viewSession.tokensStr}</Text>
                  <Text size="xs" c="dimmed">
                    Seated {viewSession.elapsedMinutes}m ago · {viewSession.totalItemsCount} item{viewSession.totalItemsCount !== 1 ? "s" : ""}
                  </Text>
                </div>
                <Badge size="sm" color="orange" variant="light">
                  {viewSession.roundsCount} Round{viewSession.roundsCount !== 1 ? "s" : ""} Ordered
                </Badge>
              </Group>

              <Divider my="xs" />

              {/* Grouped items by Round */}
              <Stack gap="md">
                {roundNumbers.map((rNum) => {
                  const items = roundMap.get(rNum) || [];
                  const isRoundPaid = items.every((it: any) => it.paymentStatus === 'PAID');
                  const roundPaise = items.reduce((sum, it) => sum + ((it.pricePaiseSnapshot ?? it.pricePaise ?? 0) * it.qty), 0);
                  return (
                    <Paper key={rNum} p="xs" radius="sm">
                      <Group justify="space-between" align="center" mb="xs">
                        <Group gap="xs">
                          <Badge size="xs" color={rNum === 1 ? "blue" : "grape"} variant="filled">
                            Round {rNum}
                          </Badge>
                          <Badge size="xs" color={isRoundPaid ? "teal" : "orange"} variant="light">
                            {isRoundPaid ? "Paid" : "Unpaid"}
                          </Badge>
                        </Group>
                        <Text size="xs" fw={700} c={isRoundPaid ? "teal.8" : "dimmed"}>
                          ₹{(roundPaise / 100).toFixed(0)}
                        </Text>
                      </Group>

                      <Stack gap={6}>
                        {items.map((item: any, idx: number) => {
                          const itemVisual = getStatusVisual(item.status || "ORDERED");
                          return (
                            <Group key={item.id || idx} justify="space-between" align="flex-start" wrap="nowrap">
                              <Group gap="xs" align="center" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
                                <Text size="sm" fw={600} style={{ wordBreak: "break-word" }}>{item.nameSnapshot || item.name}</Text>
                                <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>×{item.qty}</Badge>
                                <Badge size="xs" variant="dot" color={itemVisual.color} style={{ flexShrink: 0 }}>{itemVisual.label}</Badge>
                              </Group>
                              <Text size="sm" fw={600} c="dimmed" style={{ flexShrink: 0, marginLeft: 8 }}>
                                ₹{(((item.pricePaiseSnapshot ?? item.pricePaise ?? 0) * item.qty) / 100).toFixed(0)}
                              </Text>
                            </Group>
                          );
                        })}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>

              <Divider my="xs" />

              <Group justify="space-between" align="center">
                <Text fw={700} size="md">Grand Total</Text>
                <Text fw={800} size="xl" c="dinePrimary">
                  ₹{(viewSession.totalPaise / 100).toFixed(0)}
                </Text>
              </Group>

              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">
                  Paid: ₹{(viewSession.paidPaise / 100).toFixed(0)}
                </Text>
                <Badge size="md" color={viewSession.duePaise === 0 ? "teal" : "orange"} variant="light">
                  {viewSession.duePaise === 0 ? "All Paid" : `Due: ₹${(viewSession.duePaise / 100).toFixed(0)}`}
                </Badge>
              </Group>

              <Group gap="xs" mt="md" wrap="wrap" justify="space-between">
                <Button
                  size="sm"
                  px={8}
                  variant="light"
                  color="gray"
                  leftSection={<IconPrinter size={15} />}
                  loading={isPrintingBill}
                  onClick={() => handlePrintBill(viewSession)}
                  style={{ flex: "1 1 110px" }}
                >
                  Print Bill
                </Button>

                <Button
                  size="sm"
                  px={8}
                  variant="light"
                  color="dinePrimary"
                  leftSection={<IconPlus size={15} />}
                  onClick={() => {
                    router.push(`/pos?table=${encodeURIComponent(viewSession.table.name)}&outletId=${outletId}`);
                    setViewSession(null);
                  }}
                  style={{ flex: "1 1 110px" }}
                >
                  Add Round
                </Button>

                <Button
                  size="sm"
                  px={8}
                  color="teal"
                  leftSection={<IconCheck size={15} />}
                  onClick={() => {
                    const sess = viewSession;
                    setViewSession(null);
                    handleOpenFreeModal(sess);
                  }}
                  style={{ flex: "1 1 110px" }}
                >
                  Free Table
                </Button>
              </Group>
            </Stack>
          );
        })()}
      </Modal>

      {/* ─── Table QR Code Modal ────────────────────────────────────────────────── */}
      <Modal
        opened={Boolean(qrModalTable)}
        onClose={() => setQrModalTable(null)}
        title={`Dine-in QR Code · Table ${qrModalTable?.name}`}
        size="sm"
      >
        {qrModalTable && (
          <Stack align="center" gap="md" py="xs">
            <Text size="xs" c="dimmed" ta="center">
              Customers can scan this QR code at Table {qrModalTable.name} to view the menu and order.
            </Text>

            {/* Generated QR Code Image */}
            <Box
              p="md"
              style={{
                background: "white",
                borderRadius: "12px",
              }}
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  `https://dine.logixsoft.in/menu?outletId=${outletId}&table=${encodeURIComponent(qrModalTable.name)}`
                )}`}
                alt={`Table ${qrModalTable.name} QR Code`}
                width={220}
                height={220}
                style={{ display: "block" }}
              />
            </Box>

            <Text size="sm" fw={700} ta="center">
              Table {qrModalTable.name} · {activeOutlet?.name}
            </Text>

            <Button
              fullWidth
              variant="light"
              color="dinePrimary"
              leftSection={<IconPrinter size={15} />}
              onClick={() => window.print()}
            >
              Print QR Code
            </Button>
          </Stack>
        )}
      </Modal>

      {/* ─── Add / Edit Table Modal ────────────────────────────────────────────── */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTable ? `Edit Table "${editingTable.name}"` : "Add New Table"}
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Table Name / Number"
            placeholder="e.g. T1, Table 4, Window 2..."
            required
            value={tableName}
            error={tableNameError}
            onChange={(e) => {
              setTableName(e.currentTarget.value);
              if (tableNameError) setTableNameError(null);
            }}
          />

          <TextInput
            label="Section / Floor"
            placeholder="e.g. Ground Floor, Terrace, First Floor..."
            value={section}
            onChange={(e) => setSection(e.currentTarget.value)}
          />

          <NumberInput
            label="Seating Capacity"
            placeholder="4"
            min={1}
            max={50}
            value={capacity}
            onChange={setCapacity}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" onClick={handleSaveTable} loading={isSaving}>
              {editingTable ? "Save Changes" : "Create Table"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── Delete Table Confirmation Modal ─── */}
      <Modal
        opened={Boolean(deleteTableConfirm)}
        onClose={() => setDeleteTableConfirm(null)}
        title="Delete Table Confirmation"
        size="sm"
        zIndex={1400}
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete table <b>"{deleteTableConfirm?.name}"</b>?
            This will remove it from the floor layout.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="sm" onClick={() => setDeleteTableConfirm(null)} disabled={deleteTableMut.isPending}>
              Cancel
            </Button>
            <Button
              color="red"
              size="sm"
              loading={deleteTableMut.isPending}
              onClick={handleConfirmDeleteTable}
              leftSection={<IconTrash size={16} />}
            >
              Delete Table
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

export default function TablesPage() {
  return (
    <Suspense
      fallback={
        <Center py={80}>
          <Loader color="dinePrimary" size="lg" />
        </Center>
      }
    >
      <TablesPageContent />
    </Suspense>
  );
}
