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
  Menu,
  TextInput,
  Select,
  Center,
  Loader,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconMotorbike,
  IconSearch,
  IconDotsVertical,
  IconX,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

const DELIVERY_STATUSES = [
  { value: "ALL", label: "All Fleet Statuses" },
  { value: "PENDING", label: "Pending Assignment" },
  { value: "ASSIGNED", label: "Rider Assigned" },
  { value: "PICKED_UP", label: "Picked Up / Out for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

function DeliveryContent() {
  const { restaurants } = useAdmin();
  const { getFilter, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const statusFilter = getFilter("status", "ALL");
  const restaurantFilter = getFilter("restaurantId", "ALL");

  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (restaurantFilter && restaurantFilter !== "ALL") params.set("restaurantId", restaurantFilter);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/admin/delivery${qs}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setDeliveries(Array.isArray(d) ? d : d.deliveries || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, restaurantFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateStatus = async (delId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/delivery/${delId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Status update failed");
      notifications.show({ title: "Status Updated", message: `Delivery marked as ${status}`, color: "teal" });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Server-side filtered
  const filtered = deliveries;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Delivery Fleet Operations
          </Text>
          <Text size="sm" c="dimmed">
            Cross-tenant delivery dispatches, rider assignments, and live status routing.
          </Text>
        </div>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by address, city, or delivery ID..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setFilter("search", e.target.value)}
            w={{ base: "100%", sm: 280 }}
            size="xs"
          />
          <Select
            placeholder="Restaurant"
            data={[{ value: "ALL", label: "All Restaurants" }, ...restaurants.map((r) => ({ value: r.id, label: r.name }))]}
            value={restaurantFilter}
            onChange={(val) => setFilter("restaurantId", val || "ALL")}
            w={{ base: "100%", sm: 200 }}
            size="xs"
          />
          <Select
            placeholder="Delivery Status"
            data={DELIVERY_STATUSES}
            value={statusFilter}
            onChange={(val) => setFilter("status", val || "ALL")}
            w={{ base: "100%", sm: 180 }}
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
            Showing {filtered.length} of {deliveries.length} Dispatches
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
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Delivery ID</Table.Th>
                <Table.Th>Order #</Table.Th>
                <Table.Th>Delivery Address</Table.Th>
                <Table.Th>Fleet Status</Table.Th>
                <Table.Th>Dispatch Time</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No fleet deliveries registered.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((d) => (
                  <Table.Tr key={d.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconMotorbike size={16} color="#4c6ef5" />
                        <Text fw={700} size="xs">
                          {d.id.slice(0, 10)}...
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={600}>
                        #{d.orderNo || d.orderId?.slice(0, 8) || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {d.addressLine1}, {d.city}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={
                          d.status === "DELIVERED"
                            ? "green"
                            : d.status === "CANCELLED"
                            ? "red"
                            : "orange"
                        }
                      >
                        {d.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{new Date(d.createdAt).toLocaleTimeString()}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Menu position="bottom-end" shadow="md">
                        <Menu.Target>
                          <Button
                            size="xs"
                            variant="light"
                            color="indigo"
                            rightSection={<IconDotsVertical size={14} />}
                          >
                            Update
                          </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item onClick={() => handleUpdateStatus(d.id, "ASSIGNED")}>
                            Mark Assigned
                          </Menu.Item>
                          <Menu.Item onClick={() => handleUpdateStatus(d.id, "PICKED_UP")}>
                            Mark Picked Up
                          </Menu.Item>
                          <Menu.Item color="green" onClick={() => handleUpdateStatus(d.id, "DELIVERED")}>
                            Mark Delivered
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item color="red" onClick={() => handleUpdateStatus(d.id, "CANCELLED")}>
                            Cancel Delivery
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}

export default function DeliveryPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <DeliveryContent />
    </Suspense>
  );
}
