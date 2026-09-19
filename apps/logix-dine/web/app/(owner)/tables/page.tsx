"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Container, Title, Text, Group, Stack, SimpleGrid, Paper, Badge,
  Button, ActionIcon, TextInput, NumberInput, Modal, Menu,
  ThemeIcon, Loader, Center, Box, Tooltip, Divider, SegmentedControl,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconTableAlias, IconPlus, IconSearch, IconUsers, IconClock,
  IconReceipt, IconCheck, IconDotsVertical, IconEdit, IconTrash,
  IconShoppingCart, IconEye, IconRefresh, IconArmchair,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useTables, useOrders, useCreateTable, useUpdateTable,
  useDeleteTable,
} from "@/lib/queries";
import { getStatusVisual, PAYMENT_STATUS_CONFIG } from "@/lib/order-status-ui";

export default function TablesPage() {
  const router = useRouter();
  const { restaurant, activeOutlet, outlets, role } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? outlets[0]?.id ?? "";

  const canManage = role === "OWNER" || role === "MANAGER";

  // Data fetching
  const {
    data: tables = [],
    isLoading: tablesLoading,
    refetch: refetchTables,
  } = useTables(restaurantId, outletId);

  // Fetch open orders for this outlet to compute real-time table occupancy
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
  );

  // Table form & modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [capacity, setCapacity] = useState<number | string>(4);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL"); // ALL | AVAILABLE | OCCUPIED

  // Order preview modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Mutations
  const createTableMut = useCreateTable(restaurantId, outletId);
  const updateTableMut = useUpdateTable(restaurantId, outletId);
  const deleteTableMut = useDeleteTable(restaurantId, outletId);

  // Map open orders to table numbers (case-insensitive key)
  const occupiedMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const entry of orders) {
      if (entry.order?.tableNo && entry.order?.tableNo !== "Takeaway") {
        const key = entry.order.tableNo.trim().toLowerCase();
        // If multiple orders exist on same table, keep the most recent
        if (!map.has(key)) {
          map.set(key, entry);
        }
      }
    }
    return map;
  }, [orders]);

  // Extract unique sections
  const sections = useMemo(() => {
    const set = new Set<string>();
    for (const t of tables) {
      if (t.section?.trim()) {
        set.add(t.section.trim());
      }
    }
    return Array.from(set);
  }, [tables]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tables.filter((t: any) => {
      // Search filter
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
      const isOccupied = occupiedMap.has((t.name || "").trim().toLowerCase());
      if (selectedStatus === "OCCUPIED" && !isOccupied) return false;
      if (selectedStatus === "AVAILABLE" && isOccupied) return false;

      return true;
    });
  }, [tables, searchQuery, selectedSection, selectedStatus, occupiedMap]);

  // Statistics
  const stats = useMemo(() => {
    let occupied = 0;
    let available = 0;
    let totalSeats = 0;

    for (const t of tables) {
      if (t.active) {
        totalSeats += t.capacity || 0;
        if (occupiedMap.has((t.name || "").trim().toLowerCase())) {
          occupied++;
        } else {
          available++;
        }
      }
    }

    return { total: tables.length, occupied, available, totalSeats };
  }, [tables, occupiedMap]);

  // Modal open helpers
  const handleOpenCreate = () => {
    setEditingTable(null);
    setName("");
    setSection("");
    setCapacity(4);
    setModalOpen(true);
  };

  const handleOpenEdit = (table: any) => {
    setEditingTable(table);
    setName(table.name);
    setSection(table.section || "");
    setCapacity(table.capacity || 4);
    setModalOpen(true);
  };

  const handleSaveTable = async () => {
    if (!outletId || !name.trim()) return;
    try {
      if (editingTable) {
        await updateTableMut.mutateAsync({
          id: editingTable.id,
          body: {
            name: name.trim(),
            section: section.trim() || undefined,
            capacity: capacity ? Number(capacity) : undefined,
          },
        });
        notifications.show({ title: "Table updated", message: `Table "${name.trim()}" updated successfully`, color: "green" });
      } else {
        await createTableMut.mutateAsync({
          outletId,
          name: name.trim(),
          section: section.trim() || undefined,
          capacity: capacity ? Number(capacity) : undefined,
        });
        notifications.show({ title: "Table created", message: `Table "${name.trim()}" created successfully`, color: "green" });
      }
      setModalOpen(false);
    } catch (err: any) {
      notifications.show({ title: "Failed to save table", message: err.message || "An error occurred", color: "red" });
    }
  };

  const handleDeleteTable = async (table: any) => {
    if (!confirm(`Are you sure you want to delete table "${table.name}"?`)) return;
    try {
      await deleteTableMut.mutateAsync(table.id);
      notifications.show({ title: "Table deleted", message: `Table "${table.name}" removed`, color: "green" });
    } catch (err: any) {
      notifications.show({ title: "Failed to delete table", message: err.message || "An error occurred", color: "red" });
    }
  };

  const isSaving = createTableMut.isPending || updateTableMut.isPending;

  if (!restaurant) return null;

  return (
    <Container size="xl" pt="sm" pb={110} px={{ base: "sm", sm: "md" }}>
      {/* Top Header */}
      <Group justify="space-between" align="center" mb="md" wrap="wrap">
        <div>
          <Title order={2}>Tables</Title>
          <Text size="sm" c="dimmed">
            {activeOutlet ? activeOutlet.name : "All tables"} · {stats.occupied} occupied, {stats.available} available
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

      {/* Stats KPI Cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mb="md">
        <Paper withBorder p="sm" radius="md">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Tables</Text>
              <Text size="xl" fw={700}>{stats.total}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="gray">
              <IconTableAlias size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper withBorder p="sm" radius="md" style={{ borderColor: stats.occupied > 0 ? "rgba(253, 126, 20, 0.4)" : undefined }}>
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="orange.7" fw={600} tt="uppercase">Occupied</Text>
              <Text size="xl" fw={700} c="orange.7">{stats.occupied}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="orange">
              <IconClock size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper withBorder p="sm" radius="md" style={{ borderColor: stats.available > 0 ? "rgba(32, 201, 151, 0.4)" : undefined }}>
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="teal.7" fw={600} tt="uppercase">Available</Text>
              <Text size="xl" fw={700} c="teal.7">{stats.available}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="teal">
              <IconCheck size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper withBorder p="sm" radius="md">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Seating</Text>
              <Text size="xl" fw={700}>{stats.totalSeats}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="dinePrimary">
              <IconArmchair size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Filter and Search Bar */}
      <Paper withBorder p="sm" radius="md" mb="md">
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="sm" wrap="wrap" style={{ flex: 1 }}>
            <TextInput
              size="sm"
              placeholder="Search table or section..."
              leftSection={<IconSearch size={15} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ minWidth: 200, flex: 1 }}
            />

            <SegmentedControl
              size="sm"
              value={selectedStatus}
              onChange={setSelectedStatus}
              data={[
                { label: `All (${tables.length})`, value: "ALL" },
                { label: `Available (${stats.available})`, value: "AVAILABLE" },
                { label: `Occupied (${stats.occupied})`, value: "OCCUPIED" },
              ]}
            />
          </Group>

          {/* Section filter pills */}
          {sections.length > 0 && (
            <Group gap={6} wrap="wrap">
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
        </Group>
      </Paper>

      {/* Tables Grid */}
      {!outletId ? (
        <Text c="dimmed" ta="center" py={60}>
          Please select an outlet from the top navigation to view tables.
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
            {searchQuery || selectedSection !== "ALL" || selectedStatus !== "ALL"
              ? "No tables matched the active filters."
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
            const occupiedEntry = occupiedMap.get((table.name || "").trim().toLowerCase());
            const isOccupied = Boolean(occupiedEntry);
            const activeOrder = occupiedEntry?.order;
            const activeItems = occupiedEntry?.items ?? [];

            const elapsedMinutes = activeOrder?.createdAt
              ? Math.floor((Date.now() - new Date(activeOrder.createdAt).getTime()) / 60000)
              : 0;

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
                  borderColor: isOccupied ? "rgba(253, 126, 20, 0.45)" : undefined,
                  backgroundColor: isOccupied ? "rgba(253, 126, 20, 0.02)" : undefined,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                <div>
                  {/* Card Header: Table Name + Capacity + Options */}
                  <Group justify="space-between" align="flex-start" mb="xs">
                    <div>
                      <Text size="lg" fw={800} style={{ letterSpacing: "-0.5px" }}>
                        {table.name}
                      </Text>
                      {table.section && (
                        <Text size="xs" c="dimmed" fw={500}>
                          {table.section}
                        </Text>
                      )}
                    </div>

                    <Group gap={4} align="center">
                      <Badge
                        size="xs"
                        variant="light"
                        color={isOccupied ? "orange" : "teal"}
                        leftSection={isOccupied ? <IconClock size={10} /> : <IconCheck size={10} />}
                      >
                        {isOccupied ? "Occupied" : "Available"}
                      </Badge>

                      {canManage && (
                        <Menu position="bottom-end" shadow="sm" withArrow>
                          <Menu.Target>
                            <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Table options">
                              <IconDotsVertical size={14} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => handleOpenEdit(table)}>
                              Edit Table
                            </Menu.Item>
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => handleDeleteTable(table)}
                            >
                              Delete Table
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      )}
                    </Group>
                  </Group>

                  {/* Seating capacity */}
                  <Group gap={6} mb="sm">
                    <ThemeIcon size="xs" variant="transparent" c="dimmed">
                      <IconUsers size={13} />
                    </ThemeIcon>
                    <Text size="xs" c="dimmed">
                      {table.capacity ? `${table.capacity} Seater` : "Standard Seating"}
                    </Text>
                  </Group>

                  {/* Middle Status: Occupied Order Details or Available Status */}
                  {isOccupied && activeOrder ? (
                    <Box
                      p="xs"
                      mb="sm"
                      style={{
                        backgroundColor: "rgba(253, 126, 20, 0.08)",
                        borderRadius: "6px",
                        border: "1px dashed rgba(253, 126, 20, 0.3)",
                      }}
                    >
                      <Group justify="space-between" align="center" mb={2}>
                        <Text size="xs" fw={700} c="orange.8">
                          Token #{activeOrder.orderNo}
                        </Text>
                        <Text size="xs" fw={700} c="dinePrimary">
                          ₹{(activeOrder.subtotalPaise / 100).toFixed(0)}
                        </Text>
                      </Group>
                      <Group justify="space-between" align="center">
                        <Text size="11px" c="dimmed">
                          {activeItems.length} item{activeItems.length !== 1 ? "s" : ""}
                        </Text>
                        <Text size="11px" c="dimmed">
                          {elapsedMinutes}m seated
                        </Text>
                      </Group>
                    </Box>
                  ) : (
                    <Box
                      p="xs"
                      mb="sm"
                      style={{
                        backgroundColor: "rgba(32, 201, 151, 0.05)",
                        borderRadius: "6px",
                        border: "1px dashed rgba(32, 201, 151, 0.2)",
                      }}
                    >
                      <Text size="xs" c="teal.7" ta="center">
                        Ready for new guests
                      </Text>
                    </Box>
                  )}
                </div>

                {/* Bottom Actions */}
                <div>
                  <Divider mb="xs" />
                  {isOccupied ? (
                    <Group gap="xs" grow>
                      <Button
                        size="xs"
                        variant="light"
                        color="orange"
                        leftSection={<IconEye size={13} />}
                        onClick={() => setSelectedOrder(occupiedEntry)}
                      >
                        Order
                      </Button>
                      <Button
                        size="xs"
                        variant="filled"
                        color="dinePrimary"
                        leftSection={<IconShoppingCart size={13} />}
                        onClick={() => router.push(`/pos?table=${encodeURIComponent(table.name)}&outletId=${outletId}`)}
                      >
                        + Add
                      </Button>
                    </Group>
                  ) : (
                    <Button
                      fullWidth
                      size="xs"
                      color="dinePrimary"
                      variant="light"
                      leftSection={<IconShoppingCart size={13} />}
                      onClick={() => router.push(`/pos?table=${encodeURIComponent(table.name)}&outletId=${outletId}`)}
                    >
                      Take Order
                    </Button>
                  )}
                </div>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}

      {/* Add / Edit Table Modal */}
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
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
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

      {/* Active Order Quick Preview Modal */}
      <Modal
        opened={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Table ${selectedOrder.order.tableNo} · Token #${selectedOrder.order.orderNo}` : "Order"}
        size="md"
      >
        {selectedOrder && (
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed" ff="monospace">ID: {selectedOrder.order.id}</Text>
                <Text size="xs" c="dimmed">
                  Placed at {new Date(selectedOrder.order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </div>
              <Group gap="xs">
                {(() => {
                  const oVisual = getStatusVisual(selectedOrder.order.orderStatus || "ORDERED");
                  const OIcon = oVisual.icon;
                  const pVisual = PAYMENT_STATUS_CONFIG[selectedOrder.order.status] || { color: "gray", label: selectedOrder.order.status };
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
            <Text size="sm" fw={700}>Order Items ({selectedOrder.items?.length ?? 0}):</Text>
            <Stack gap={6}>
              {selectedOrder.items?.map((item: any) => {
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
                ₹{(selectedOrder.order.subtotalPaise / 100).toFixed(0)}
              </Text>
            </Group>

            <Group grow mt="md">
              <Button
                variant="light"
                color="dinePrimary"
                leftSection={<IconShoppingCart size={14} />}
                onClick={() => {
                  router.push(`/pos?table=${encodeURIComponent(selectedOrder.order.tableNo)}&outletId=${outletId}`);
                  setSelectedOrder(null);
                }}
              >
                + Add Items
              </Button>
              <Button
                color="dinePrimary"
                leftSection={<IconReceipt size={14} />}
                onClick={() => {
                  router.push(`/orders?outletId=${outletId}`);
                  setSelectedOrder(null);
                }}
              >
                Go to Orders
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
