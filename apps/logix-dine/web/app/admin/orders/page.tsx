"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import {
  Stack,
  Group,
  Text,
  Card,
  Table,
  Badge,
  Button,
  ActionIcon,
  Modal,
  TextInput,
  Select,
  Center,
  Loader,
  Divider,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconReceipt,
  IconSearch,
  IconEye,
  IconBan,
  IconX,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";
import { useUrlFilters } from "../use-url-filters";
import { DependentOutletSelect } from "../dependent-outlet-select";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

const ORDER_STATUSES = [
  { value: "ALL", label: "All Statuses" },
  { value: "PLACED", label: "Placed" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY", label: "Ready" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled / Void" },
];

const ORDER_TYPES = [
  { value: "ALL", label: "All Order Types" },
  { value: "DINE_IN", label: "Dine-In" },
  { value: "TAKEAWAY", label: "Takeaway" },
  { value: "DELIVERY", label: "Delivery" },
];

function OrdersContent() {
  const { restaurants } = useAdmin();
  const { getFilter, setFilter, setFilters, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const restaurantFilter = getFilter("restaurantId", "ALL");
  const outletFilter = getFilter("outletId", "ALL");
  const statusFilter = getFilter("status", "ALL");
  const typeFilter = getFilter("orderType", "ALL");
  const sortBy = getFilter("sortBy", "newest");

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [viewOrderOpened, setViewOrderOpened] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [voidOrderOpened, setVoidOrderOpened] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  // Server-side filtering
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (restaurantFilter && restaurantFilter !== "ALL") params.set("restaurantId", restaurantFilter);
      if (outletFilter && outletFilter !== "ALL") params.set("outletId", outletFilter);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (typeFilter && typeFilter !== "ALL") params.set("orderType", typeFilter);
      if (sortBy) params.set("sortBy", sortBy);

      const res = await fetch(`${API_BASE}/admin/orders?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setOrders(Array.isArray(d) ? d : d.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, restaurantFilter, outletFilter, statusFilter, typeFilter, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVoidOrder = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${selectedOrder.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: voidReason || "Cancelled by Superadmin" }),
      });
      if (!res.ok) throw new Error("Failed to void order");
      notifications.show({ title: "Order Voided", message: `Order #${selectedOrder.orderNo} cancelled.`, color: "teal" });
      setVoidOrderOpened(false);
      setVoidReason("");
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = orders;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Platform Orders Feed
          </Text>
          <Text size="sm" c="dimmed">
            Cross-tenant ingest of all live table, takeaway, and delivery orders.
          </Text>
        </div>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by order #, phone, or store..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setFilter("search", e.target.value)}
            w={{ base: "100%", sm: 260 }}
            size="xs"
          />
          <Select
            placeholder="Filter by Restaurant"
            data={[
              { value: "ALL", label: "🌐 All Restaurants" },
              ...restaurants.map((r) => ({ value: r.id, label: r.name })),
            ]}
            value={restaurantFilter}
            onChange={(val) => {
              setFilters({
                restaurantId: val || "ALL",
                outletId: "ALL",
              });
            }}
            w={{ base: "100%", sm: 190 }}
            size="xs"
          />
          <DependentOutletSelect
            restaurantId={restaurantFilter}
            value={outletFilter}
            onChange={(val) => setFilter("outletId", val)}
            isFilter
            filterAllLabel="All Outlets"
            size="xs"
            w={{ base: "100%", sm: 160 }}
          />
          <Select
            placeholder="Status"
            data={ORDER_STATUSES}
            value={statusFilter}
            onChange={(val) => setFilter("status", val || "ALL")}
            w={{ base: "100%", sm: 140 }}
            size="xs"
          />
          <Select
            placeholder="Order Type"
            data={ORDER_TYPES}
            value={typeFilter}
            onChange={(val) => setFilter("orderType", val || "ALL")}
            w={{ base: "100%", sm: 120 }}
            size="xs"
          />
          <Select
            placeholder="Sort By"
            data={[
              { value: "newest", label: "Newest First" },
              { value: "oldest", label: "Oldest First" },
              { value: "total", label: "Highest Total" },
              { value: "orderNo", label: "Order Number" },
            ]}
            value={sortBy}
            onChange={(val) => setFilter("sortBy", val || "newest")}
            w={{ base: "100%", sm: 140 }}
            size="xs"
          />
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconX size={14} />}
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          )}
          <Badge size="sm" variant="light" color="gray" ml="auto">
            Showing {filtered.length} of {orders.length} Orders
          </Badge>
        </Group>
      </Card>

      {/* Main Table */}
      <Card withBorder padding="0" radius="md">
        {loading ? (
          <Center py={60}>
            <Loader color="dinePrimary" />
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={750}>
            <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order #</Table.Th>
                <Table.Th>Restaurant</Table.Th>
                <Table.Th>Customer Phone</Table.Th>
                <Table.Th>Order Type</Table.Th>
                <Table.Th>Amount (₹)</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Timestamp</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No platform orders found matching criteria.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((o) => (
                  <Table.Tr key={o.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconReceipt size={16} color="#7950f2" />
                        <Text fw={700} size="xs">
                          #{o.orderNo}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{o.restaurantName || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{o.customerPhone || "Guest"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="outline">
                        {o.orderType || "DINE_IN"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={700}>
                        ₹{((o.totalPaise || 0) / 100).toLocaleString("en-IN")}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={
                          o.status === "COMPLETED" || o.status === "DELIVERED"
                            ? "green"
                            : o.status === "CANCELLED"
                            ? "red"
                            : "blue"
                        }
                      >
                        {o.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {new Date(o.createdAt).toLocaleString()}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap="xs" justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="indigo"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(o);
                            setViewOrderOpened(true);
                          }}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                        {o.status !== "CANCELLED" && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(o);
                              setVoidOrderOpened(true);
                            }}
                          >
                            <IconBan size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      {/* Modal: View Order Items */}
      <Modal
        opened={viewOrderOpened}
        onClose={() => setViewOrderOpened(false)}
        centered
        size="md"
        title={
          <Text fw={700}>
            Order #{selectedOrder?.orderNo} Breakdown
          </Text>
        }
      >
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Restaurant:
            </Text>
            <Text size="xs" fw={600}>
              {selectedOrder?.restaurantName}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Customer:
            </Text>
            <Text size="xs" fw={600}>
              {selectedOrder?.customerPhone || "Guest"}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Total Amount:
            </Text>
            <Text size="sm" fw={700} c="green">
              ₹{((selectedOrder?.totalPaise || 0) / 100).toLocaleString("en-IN")}
            </Text>
          </Group>
          <Divider my="xs" />
          <Text fw={700} size="xs">
            Line Items:
          </Text>
          {selectedOrder?.items && selectedOrder.items.length > 0 ? (
            selectedOrder.items.map((it: any, idx: number) => (
              <Group key={idx} justify="space-between">
                <Text size="xs">
                  {it.quantity}x {it.name || it.menuItem?.name || "Dish"}
                </Text>
                <Text size="xs" fw={600}>
                  ₹{((it.pricePaise || 0) * (it.quantity || 1) / 100).toLocaleString("en-IN")}
                </Text>
              </Group>
            ))
          ) : (
            <Text size="xs" c="dimmed">
              No item details recorded for this draft transaction.
            </Text>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setViewOrderOpened(false)}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Void Order */}
      <Modal
        opened={voidOrderOpened}
        onClose={() => setVoidOrderOpened(false)}
        centered
        size="md"
        title={
          <Text fw={700} c="red">
            Void Order #{selectedOrder?.orderNo}
          </Text>
        }
      >
        <Stack gap="sm">
          <Text size="sm">
            Are you sure you want to void this transaction? This updates payment records and reverses stock decrements.
          </Text>
          <TextInput
            label="Void Reason"
            placeholder="e.g. Customer cancelled / Duplicate entry"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setVoidOrderOpened(false)}>
              Cancel
            </Button>
            <Button color="red" loading={submitting} onClick={handleVoidOrder}>
              Confirm Void
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
