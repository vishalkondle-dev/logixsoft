"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Container, Title, Text, Group, Stack, SimpleGrid, Paper, Badge,
  Button, ActionIcon, TextInput, NumberInput, Modal, Menu,
  ThemeIcon, Loader, Center, Box, Divider, SegmentedControl,
  Radio,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconTableAlias, IconPlus, IconSearch, IconUsers, IconClock,
  IconReceipt, IconCheck, IconDotsVertical, IconEdit, IconTrash,
  IconShoppingCart, IconEye, IconRefresh, IconArmchair,
  IconCash, IconCreditCard, IconQrcode, IconPrinter, IconX,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useTables, useOrders, useCreateTable, useUpdateTable,
  useDeleteTable, qk,
} from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { settleOrder, voidOrder } from "@/lib/api-client";
import { getStatusVisual, PAYMENT_STATUS_CONFIG } from "@/lib/order-status-ui";
import { buildBillPayload } from "@/lib/ticket";
import { printTicket } from "@/lib/print";

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

export default function TablesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { restaurant, activeOutlet, outlets, role } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? outlets[0]?.id ?? "";

  const canManage = role === "OWNER" || role === "MANAGER";

  // Re-render tick every 15s to update "Xm seated" time display
  const [, forceTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => clearInterval(timer);
  }, []);

  // ─── Real-time Dynamic Data Fetching ──────────────────────────────────────────
  // Tables: polling every 6s
  const {
    data: tables = [],
    isLoading: tablesLoading,
    refetch: refetchTables,
  } = useTables(restaurantId, outletId, { refetchInterval: 6_000 });

  // Open Orders: polling every 4s for instant table occupancy updates
  const {
    data: orders = [],
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useOrders(
    restaurantId,
    {
      status: "OPEN",
      outletId: outletId || undefined,
      limit: 100,
    },
    !!restaurantId && !!outletId,
    { refetchInterval: 4_000 },
  );

  // ─── Filter States ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "FREE" | "OCCUPIED">("ALL");

  // ─── Table Form / Modal States ────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [tableName, setTableName] = useState("");
  const [section, setSection] = useState("");
  const [capacity, setCapacity] = useState<number | string>(4);

  // ─── Free Table (Settle & Clear) Modal State ─────────────────────────────────
  const [freeModalTable, setFreeModalTable] = useState<any | null>(null);
  const [freeModalOrder, setFreeModalOrder] = useState<any | null>(null);
  const [settleMethod, setSettleMethod] = useState<string>("Cash");
  const [isFreeing, setIsFreeing] = useState(false);

  // ─── View Order Modal State ──────────────────────────────────────────────────
  const [viewOrderEntry, setViewOrderEntry] = useState<any | null>(null);
  const [isPrintingBill, setIsPrintingBill] = useState(false);

  // ─── QR Code Modal State ─────────────────────────────────────────────────────
  const [qrModalTable, setQrModalTable] = useState<any | null>(null);

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const createTableMut = useCreateTable(restaurantId, outletId);
  const updateTableMut = useUpdateTable(restaurantId, outletId);
  const deleteTableMut = useDeleteTable(restaurantId, outletId);

  // ─── Map Active Open Orders to Tables ─────────────────────────────────────────
  const tableOccupancyMap = useMemo(() => {
    const map = new Map<string, any>(); // key: normalized table name -> orderEntry
    for (const entry of orders) {
      if (entry.order?.tableNo && entry.order?.tableNo !== "Takeaway") {
        const norm = normalizeTable(entry.order.tableNo);
        if (!map.has(norm)) {
          map.set(norm, entry);
        }
      }
    }
    return map;
  }, [orders]);

  // Helper to get active order for a given table
  const getTableActiveOrder = (table: any) => {
    // 1. Direct name match
    for (const entry of orders) {
      if (isTableMatch(table.name, entry.order?.tableNo)) {
        return entry;
      }
    }
    // 2. Normalized match
    const norm = normalizeTable(table.name);
    return tableOccupancyMap.get(norm) ?? null;
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
    let free = 0;
    let totalSeats = 0;

    for (const t of tables) {
      if (t.active) {
        totalSeats += t.capacity || 0;
        const activeOrder = getTableActiveOrder(t);
        if (activeOrder) {
          occupied++;
        } else {
          free++;
        }
      }
    }

    return { total: tables.length, occupied, free, totalSeats };
  }, [tables, orders]);

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
      const activeOrder = getTableActiveOrder(t);
      const isOccupied = Boolean(activeOrder);

      if (statusFilter === "FREE" && isOccupied) return false;
      if (statusFilter === "OCCUPIED" && !isOccupied) return false;

      return true;
    });
  }, [tables, searchQuery, selectedSection, statusFilter, orders]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingTable(null);
    setTableName("");
    setSection("");
    setCapacity(4);
    setModalOpen(true);
  };

  const handleOpenEdit = (table: any) => {
    setEditingTable(table);
    setTableName(table.name);
    setSection(table.section || "");
    setCapacity(table.capacity || 4);
    setModalOpen(true);
  };

  const handleSaveTable = async () => {
    if (!outletId || !tableName.trim()) return;
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

  const handleDeleteTable = async (table: any) => {
    if (!confirm(`Delete table "${table.name}"?`)) return;
    try {
      await deleteTableMut.mutateAsync(table.id);
      notifications.show({ title: "Table deleted", message: `Table "${table.name}" removed`, color: "green" });
    } catch (err: any) {
      notifications.show({ title: "Failed to delete table", message: err.message || "An error occurred", color: "red" });
    }
  };

  // Open "Free Table" confirmation modal
  const handleOpenFreeModal = (table: any, orderEntry: any) => {
    setFreeModalTable(table);
    setFreeModalOrder(orderEntry);
    setSettleMethod("Cash");
  };

  // Action: Settle order and free table
  const handleSettleAndFreeTable = async () => {
    if (!freeModalOrder?.order?.id) return;
    setIsFreeing(true);
    try {
      await settleOrder(
        restaurantId,
        freeModalOrder.order.id,
        { method: settleMethod },
        outletId,
      );

      // Invalidate both orders and tables queries
      queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId, {}) });
      queryClient.invalidateQueries({ queryKey: qk.tables(restaurantId, outletId) });

      notifications.show({
        title: "Table Freed",
        message: `Table "${freeModalTable?.name}" is now Free. Paid via ${settleMethod}.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      setFreeModalTable(null);
      setFreeModalOrder(null);
    } catch (err: any) {
      notifications.show({ title: "Failed to free table", message: err.message || "Error settling order", color: "red" });
    } finally {
      setIsFreeing(false);
    }
  };

  // Action: Void order and release table immediately
  const handleVoidAndReleaseTable = async () => {
    if (!freeModalOrder?.order?.id) return;
    if (!confirm(`Release table "${freeModalTable?.name}" and void active order #${freeModalOrder.order.orderNo}?`)) return;
    setIsFreeing(true);
    try {
      await voidOrder(restaurantId, freeModalOrder.order.id, outletId);

      queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId, {}) });
      queryClient.invalidateQueries({ queryKey: qk.tables(restaurantId, outletId) });

      notifications.show({
        title: "Table Released",
        message: `Table "${freeModalTable?.name}" is now Free (Order #${freeModalOrder.order.orderNo} cancelled).`,
        color: "blue",
        icon: <IconCheck size={16} />,
      });

      setFreeModalTable(null);
      setFreeModalOrder(null);
    } catch (err: any) {
      notifications.show({ title: "Failed to release table", message: err.message || "Error voiding order", color: "red" });
    } finally {
      setIsFreeing(false);
    }
  };

  // Print bill from modal
  const handlePrintBill = async (orderEntry: any) => {
    if (!restaurant) return;
    setIsPrintingBill(true);
    try {
      const payload = buildBillPayload(orderEntry, restaurant);
      const result = await printTicket(payload);
      notifications.show({
        title: "Bill Printed",
        message: result === "ble" ? "Sent to Bluetooth printer" : "Sent to browser print",
        color: "green",
      });
    } catch (err: any) {
      notifications.show({ title: "Print Failed", message: err.message || "Could not print bill", color: "red" });
    } finally {
      setIsPrintingBill(false);
    }
  };

  const isSaving = createTableMut.isPending || updateTableMut.isPending;

  if (!restaurant) return null;

  return (
    <Container size="xl" pt="sm" pb={120} px={{ base: "sm", sm: "md" }}>
      {/* ─── Top Header ───────────────────────────────────────────────────────── */}
      <Group justify="space-between" align="center" mb="md" wrap="wrap">
        <div>
          <Group gap="xs" align="center">
            <Title order={2}>Tables</Title>
            <Badge size="sm" variant="dot" color="teal">
              Live Synced
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {activeOutlet ? activeOutlet.name : "All Outlets"} · {stats.occupied} Occupied · {stats.free} Free
          </Text>
        </div>

        <Group gap="xs">
          <Button
            size="sm"
            variant="light"
            leftSection={<IconRefresh size={15} />}
            onClick={() => {
              refetchTables();
              refetchOrders();
            }}
          >
            Refresh
          </Button>

          {canManage && (
            <Button
              size="sm"
              color="dinePrimary"
              leftSection={<IconPlus size={16} />}
              onClick={handleOpenCreate}
              disabled={!outletId}
            >
              Add Table
            </Button>
          )}
        </Group>
      </Group>

      {/* ─── KPI Counters ─────────────────────────────────────────────────────── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mb="md">
        {/* Total Tables */}
        <Paper withBorder p="sm" radius="md">
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
        <Paper
          withBorder
          p="sm"
          radius="md"
          style={{
            borderColor: stats.free > 0 ? "rgba(32, 201, 151, 0.45)" : undefined,
            backgroundColor: "rgba(32, 201, 151, 0.03)",
          }}
        >
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

        {/* Occupied Tables */}
        <Paper
          withBorder
          p="sm"
          radius="md"
          style={{
            borderColor: stats.occupied > 0 ? "rgba(253, 126, 20, 0.45)" : undefined,
            backgroundColor: stats.occupied > 0 ? "rgba(253, 126, 20, 0.03)" : undefined,
          }}
        >
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

        {/* Total Seating Capacity */}
        <Paper withBorder p="sm" radius="md">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Capacity</Text>
              <Text size="xl" fw={800}>{stats.totalSeats} Seats</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="dinePrimary">
              <IconArmchair size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ─── Filter & Search Bar ───────────────────────────────────────────────── */}
      <Paper withBorder p="sm" radius="md" mb="md">
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

            {/* Status Filter Toggle: ALL | FREE | OCCUPIED */}
            <SegmentedControl
              size="sm"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              data={[
                { label: `All (${tables.length})`, value: "ALL" },
                { label: `Free (${stats.free})`, value: "FREE" },
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
      {!outletId ? (
        <Text c="dimmed" ta="center" py={60}>
          Please select an outlet from the top navigation bar to view tables.
        </Text>
      ) : tablesLoading || ordersLoading ? (
        <Center py={80}>
          <Loader color="dinePrimary" size="lg" />
        </Center>
      ) : !filteredTables.length ? (
        <Paper withBorder p="xl" radius="md" style={{ textAlign: "center" }} my="lg">
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
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4, lg: 5 }} spacing="md">
          {filteredTables.map((table: any) => {
            const activeOrderEntry = getTableActiveOrder(table);
            const isOccupied = Boolean(activeOrderEntry);
            const activeOrder = activeOrderEntry?.order;
            const activeItems = activeOrderEntry?.items ?? [];

            const elapsedMinutes = activeOrder?.createdAt
              ? Math.max(0, Math.floor((Date.now() - new Date(activeOrder.createdAt).getTime()) / 60000))
              : 0;

            const orderVisual = activeOrder
              ? getStatusVisual(activeOrder.orderStatus || "ORDERED")
              : null;
            const OrderIcon = orderVisual?.icon;

            return (
              <Paper
                key={table.id}
                withBorder
                p="md"
                radius="md"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderColor: isOccupied ? "rgba(253, 126, 20, 0.45)" : "rgba(32, 201, 151, 0.3)",
                  backgroundColor: isOccupied ? "rgba(253, 126, 20, 0.02)" : "rgba(32, 201, 151, 0.01)",
                  boxShadow: isOccupied ? "0 4px 14px rgba(253, 126, 20, 0.08)" : "0 2px 8px rgba(0, 0, 0, 0.04)",
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
                      {/* Status Badge: Free vs Occupied */}
                      <Badge
                        size="sm"
                        variant="light"
                        color={isOccupied ? "orange" : "teal"}
                        leftSection={isOccupied ? <IconClock size={11} /> : <IconCheck size={11} />}
                      >
                        {isOccupied ? "Occupied" : "Free"}
                      </Badge>

                      {/* Management & Actions Menu */}
                      <Menu position="bottom-end" shadow="md" withArrow>
                        <Menu.Target>
                          <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Table options">
                            <IconDotsVertical size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
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
                  {isOccupied && activeOrder ? (
                    <Box
                      p="xs"
                      mb="sm"
                      style={{
                        backgroundColor: "rgba(253, 126, 20, 0.08)",
                        borderRadius: "6px",
                        border: "1px dashed rgba(253, 126, 20, 0.35)",
                      }}
                    >
                      {/* Token No & Amount */}
                      <Group justify="space-between" align="center" mb={2}>
                        <Group gap={4} align="center">
                          <Text size="xs" fw={800} c="orange.9">
                            Token #{activeOrder.orderNo}
                          </Text>
                          {orderVisual && OrderIcon && (
                            <Badge size="xs" variant="filled" color={orderVisual.color} leftSection={<OrderIcon size={9} />}>
                              {orderVisual.label}
                            </Badge>
                          )}
                        </Group>
                        <Text size="sm" fw={800} c="dinePrimary">
                          ₹{(activeOrder.subtotalPaise / 100).toFixed(0)}
                        </Text>
                      </Group>

                      {/* Seated duration & Items summary */}
                      <Group justify="space-between" align="center" mt={4}>
                        <Text size="11px" c="dimmed">
                          {activeItems.length} item{activeItems.length !== 1 ? "s" : ""}
                        </Text>
                        <Text size="11px" fw={600} c="orange.8">
                          {elapsedMinutes}m seated
                        </Text>
                      </Group>

                      {/* Brief item preview */}
                      {activeItems.length > 0 && (
                        <Text size="10px" c="dimmed" lineClamp={1} mt={3}>
                          {activeItems.map((i: any) => `${i.nameSnapshot || i.name} (${i.qty})`).join(", ")}
                        </Text>
                      )}
                    </Box>
                  ) : (
                    <Box
                      p="xs"
                      mb="sm"
                      style={{
                        backgroundColor: "rgba(32, 201, 151, 0.05)",
                        borderRadius: "6px",
                        border: "1px dashed rgba(32, 201, 151, 0.25)",
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
                        variant="filled"
                        leftSection={<IconCheck size={14} />}
                        onClick={() => handleOpenFreeModal(table, activeOrderEntry)}
                      >
                        Free Table
                      </Button>

                      {/* Secondary actions: View Order & + Add Items */}
                      <Group gap={6} grow>
                        <Button
                          size="xs"
                          variant="light"
                          color="gray"
                          leftSection={<IconEye size={13} />}
                          onClick={() => setViewOrderEntry(activeOrderEntry)}
                        >
                          View Bill
                        </Button>

                        <Button
                          size="xs"
                          variant="light"
                          color="dinePrimary"
                          leftSection={<IconShoppingCart size={13} />}
                          onClick={() => router.push(`/pos?table=${encodeURIComponent(table.name)}&outletId=${outletId}`)}
                        >
                          + Add
                        </Button>
                      </Group>
                    </Stack>
                  ) : (
                    <Button
                      fullWidth
                      size="sm"
                      color="dinePrimary"
                      variant="light"
                      leftSection={<IconShoppingCart size={16} />}
                      onClick={() => router.push(`/pos?table=${encodeURIComponent(table.name)}&outletId=${outletId}`)}
                    >
                      Take Order (Dine In)
                    </Button>
                  )}
                </div>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}

      {/* ─── Free Table (Settle & Clear) Modal ─────────────────────────────────── */}
      <Modal
        opened={Boolean(freeModalTable && freeModalOrder)}
        onClose={() => {
          if (!isFreeing) {
            setFreeModalTable(null);
            setFreeModalOrder(null);
          }
        }}
        title={`Free Table "${freeModalTable?.name}"`}
        size="md"
      >
        {freeModalOrder && (
          <Stack gap="md">
            <Paper withBorder p="sm" radius="md" style={{ backgroundColor: "rgba(0, 0, 0, 0.02)" }}>
              <Group justify="space-between" align="center" mb="xs">
                <div>
                  <Text size="sm" fw={700}>Token #{freeModalOrder.order.orderNo}</Text>
                  <Text size="xs" c="dimmed">
                    Seated {Math.max(0, Math.floor((Date.now() - new Date(freeModalOrder.order.createdAt).getTime()) / 60000))}m ago
                  </Text>
                </div>
                <Badge size="md" color="dinePrimary" variant="filled">
                  Total: ₹{(freeModalOrder.order.subtotalPaise / 100).toFixed(0)}
                </Badge>
              </Group>

              {/* Items summary */}
              <Text size="xs" c="dimmed">
                {freeModalOrder.items?.map((i: any) => `${i.nameSnapshot || i.name} × ${i.qty}`).join(", ")}
              </Text>
            </Paper>

            {/* Payment Method Selector */}
            <div>
              <Text size="sm" fw={600} mb={6}>Choose Payment Method to Settle & Free:</Text>
              <Radio.Group
                value={settleMethod}
                onChange={setSettleMethod}
              >
                <Group gap="sm">
                  <Radio value="Cash" label="Cash" />
                  <Radio value="UPI" label="UPI / QR" />
                  <Radio value="Card" label="Card" />
                  <Radio value="Other" label="Other" />
                </Group>
              </Radio.Group>
            </div>

            <Divider />

            {/* Action Buttons */}
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
                  onClick={() => {
                    setFreeModalTable(null);
                    setFreeModalOrder(null);
                  }}
                  disabled={isFreeing}
                >
                  Cancel
                </Button>

                {/* Settle & Free Table Primary Action */}
                <Button
                  color="teal"
                  size="sm"
                  leftSection={<IconCheck size={16} />}
                  loading={isFreeing}
                  onClick={handleSettleAndFreeTable}
                >
                  Settle & Free Table (₹{(freeModalOrder.order.subtotalPaise / 100).toFixed(0)})
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* ─── Active Order Bill / View Modal ─────────────────────────────────────── */}
      <Modal
        opened={Boolean(viewOrderEntry)}
        onClose={() => setViewOrderEntry(null)}
        title={viewOrderEntry ? `Table ${viewOrderEntry.order.tableNo} · Token #${viewOrderEntry.order.orderNo}` : "Order"}
        size="md"
      >
        {viewOrderEntry && (
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed" ff="monospace">ID: {viewOrderEntry.order.id}</Text>
                <Text size="xs" c="dimmed">
                  Placed at {new Date(viewOrderEntry.order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </div>
              <Group gap="xs">
                {(() => {
                  const oVisual = getStatusVisual(viewOrderEntry.order.orderStatus || "ORDERED");
                  const OIcon = oVisual.icon;
                  const pVisual = PAYMENT_STATUS_CONFIG[viewOrderEntry.order.status] || { color: "gray", label: viewOrderEntry.order.status };
                  return (
                    <>
                      <Badge size="xs" color={oVisual.color} leftSection={<OIcon size={10} />}>
                        {oVisual.label}
                      </Badge>
                      <Badge size="xs" variant="outline" color={pVisual.color}>
                        {pVisual.label}
                      </Badge>
                    </>
                  );
                })()}
              </Group>
            </Group>

            <Divider my="xs" />

            {/* Items list */}
            <Text size="sm" fw={700}>Order Items ({viewOrderEntry.items?.length ?? 0}):</Text>
            <Stack gap={6}>
              {viewOrderEntry.items?.map((item: any) => {
                const itemVisual = getStatusVisual(item.status || "ORDERED");
                return (
                  <Group key={item.id} justify="space-between" align="center">
                    <Group gap="xs" align="center">
                      <Text size="sm" fw={600}>{item.nameSnapshot || item.name}</Text>
                      <Badge size="xs" variant="light" color="gray">×{item.qty}</Badge>
                      <Badge size="xs" variant="dot" color={itemVisual.color}>{itemVisual.label}</Badge>
                    </Group>
                    <Text size="sm" fw={600} c="dimmed">
                      ₹{(((item.pricePaiseSnapshot ?? item.pricePaise ?? 0) * item.qty) / 100).toFixed(0)}
                    </Text>
                  </Group>
                );
              })}
            </Stack>

            <Divider my="xs" />

            <Group justify="space-between" align="center">
              <Text fw={700}>Total Amount</Text>
              <Text fw={800} size="lg" c="dinePrimary">
                ₹{(viewOrderEntry.order.subtotalPaise / 100).toFixed(0)}
              </Text>
            </Group>

            <Group grow mt="md">
              <Button
                variant="light"
                color="gray"
                leftSection={<IconPrinter size={15} />}
                loading={isPrintingBill}
                onClick={() => handlePrintBill(viewOrderEntry)}
              >
                Print Bill
              </Button>

              <Button
                variant="light"
                color="dinePrimary"
                leftSection={<IconShoppingCart size={15} />}
                onClick={() => {
                  router.push(`/pos?table=${encodeURIComponent(viewOrderEntry.order.tableNo)}&outletId=${outletId}`);
                  setViewOrderEntry(null);
                }}
              >
                + Add Items
              </Button>

              <Button
                color="teal"
                leftSection={<IconCheck size={15} />}
                onClick={() => {
                  const t = tables.find((tbl: any) => isTableMatch(tbl.name, viewOrderEntry.order.tableNo)) || { name: viewOrderEntry.order.tableNo };
                  const ord = viewOrderEntry;
                  setViewOrderEntry(null);
                  handleOpenFreeModal(t, ord);
                }}
              >
                Free Table
              </Button>
            </Group>
          </Stack>
        )}
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
                border: "2px solid #af73d7",
                boxShadow: "0 4px 16px rgba(175, 115, 215, 0.15)",
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
            onChange={(e) => setTableName(e.currentTarget.value)}
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
    </Container>
  );
}
