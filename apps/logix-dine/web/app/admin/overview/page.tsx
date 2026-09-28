"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import {
  Stack,
  Group,
  Text,
  SimpleGrid,
  Card,
  Badge,
  Table,
  Button,
  TextInput,
  Select,
  Center,
  Loader,
  Box,
  Divider,
} from "@mantine/core";
import {
  IconBuildingStore,
  IconUsers,
  IconReceipt,
  IconCoin,
  IconSearch,
  IconFilter,
  IconArrowRight,
  IconCheck,
  IconAlertCircle,
  IconX,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

function OverviewContent() {
  const { metrics, selectedRestFilter, refreshing } = useAdmin();
  const { getFilter, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const statusFilter = getFilter("status", "ALL");
  const restaurantFilter = getFilter("restaurantId", selectedRestFilter);

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentOrders() {
      try {
        const qs = restaurantFilter && restaurantFilter !== "ALL" ? `&restaurantId=${restaurantFilter}` : "";
        const res = await fetch(`${API_BASE}/admin/orders?limit=15${qs}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setOrders(Array.isArray(data) ? data : data.orders || []);
        }
      } catch (err) {
        console.error("Failed to load overview orders:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecentOrders();
  }, [refreshing, restaurantFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        String(o.orderNo || "").includes(q) ||
        o.customerPhone?.toLowerCase().includes(q) ||
        o.restaurantName?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || o.status === statusFilter || o.orderStatus === statusFilter;
      const matchesRest = restaurantFilter === "ALL" || o.restaurantId === restaurantFilter;
      return matchesSearch && matchesStatus && matchesRest;
    });
  }, [orders, searchQuery, statusFilter, restaurantFilter]);

  return (
    <Stack gap="lg">
      <div>
        <Text fw={800} size="xl">
          Platform Overview & Telemetry
        </Text>
        <Text size="sm" c="dimmed">
          Live macro metrics across all onboarded restaurants, branches, and fleet operations.
        </Text>
      </div>

      {/* KPI Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Card withBorder padding="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Total Outlets
            </Text>
            <IconBuildingStore size={20} color="#7950f2" />
          </Group>
          <Text fw={800} size="xl" mt="xs">
            {metrics?.totalOutlets ?? 0}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Active dining & cloud outlets
          </Text>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Platform Users
            </Text>
            <IconUsers size={20} color="#228be6" />
          </Group>
          <Text fw={800} size="xl" mt="xs">
            {metrics?.totalUsers ?? 0}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Registered staff & customer profiles
          </Text>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Platform Orders
            </Text>
            <IconReceipt size={20} color="#40c057" />
          </Group>
          <Text fw={800} size="xl" mt="xs">
            {metrics?.totalOrders ?? 0}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Processed lifetime transactions
          </Text>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Total Platform GMV
            </Text>
            <IconCoin size={20} color="#fab005" />
          </Group>
          <Text fw={800} size="xl" mt="xs">
            ₹{(Number(metrics?.totalGmvPaise ?? 0) / 100).toLocaleString("en-IN")}
          </Text>
          <Text size="xs" c="teal" mt={4}>
            Cross-tenant gross volume
          </Text>
        </Card>
      </SimpleGrid>

      {/* Infrastructure Telemetry Indicators */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Card withBorder padding="xs" radius="md">
          <Group justify="space-between">
            <Text size="xs" fw={600}>
              API Gateway
            </Text>
            <Badge size="xs" color="green" leftSection={<IconCheck size={10} />}>
              Operational
            </Badge>
          </Group>
          <Text size="10px" c="dimmed" mt={4}>
            Cloudflare Edge Worker
          </Text>
        </Card>
        <Card withBorder padding="xs" radius="md">
          <Group justify="space-between">
            <Text size="xs" fw={600}>
              Database Node
            </Text>
            <Badge size="xs" color="green" leftSection={<IconCheck size={10} />}>
              Healthy
            </Badge>
          </Group>
          <Text size="10px" c="dimmed" mt={4}>
            Hyperdrive Pooled PG
          </Text>
        </Card>
        <Card withBorder padding="xs" radius="md">
          <Group justify="space-between">
            <Text size="xs" fw={600}>
              Real-time Relay
            </Text>
            <Badge size="xs" color="green" leftSection={<IconCheck size={10} />}>
              Active
            </Badge>
          </Group>
          <Text size="10px" c="dimmed" mt={4}>
            Durable Object WebSocket
          </Text>
        </Card>
        <Card withBorder padding="xs" radius="md">
          <Group justify="space-between">
            <Text size="xs" fw={600}>
              Fleet Dispatch
            </Text>
            <Badge size="xs" color="green" leftSection={<IconCheck size={10} />}>
              Online
            </Badge>
          </Group>
          <Text size="10px" c="dimmed" mt={4}>
            Cross-Tenant Routing
          </Text>
        </Card>
      </SimpleGrid>

      {/* Recent Cross-Tenant Orders Feed with URL Filter support */}
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" mb="md" wrap="wrap">
          <div>
            <Text fw={700} size="md">
              Recent Cross-Tenant Orders Feed
            </Text>
            <Text size="xs" c="dimmed">
              Real-time ingested transactions across all restaurant stores.
            </Text>
          </div>
          <Link href="/admin/orders" style={{ textDecoration: "none" }}>
            <Button variant="light" color="dinePrimary" size="xs" rightSection={<IconArrowRight size={14} />}>
              View All Orders
            </Button>
          </Link>
        </Group>

        {/* Search & URL Filters Toolbar */}
        <Group mb="md" gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by Order #, Customer, or Store..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setFilter("search", e.target.value)}
            w={{ base: "100%", sm: 280 }}
            size="xs"
          />
          <Select
            placeholder="Status"
            data={[
              { value: "ALL", label: "All Statuses" },
              { value: "PLACED", label: "Placed" },
              { value: "CONFIRMED", label: "Confirmed" },
              { value: "PREPARING", label: "Preparing" },
              { value: "DELIVERED", label: "Delivered" },
              { value: "COMPLETED", label: "Completed" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
            value={statusFilter}
            onChange={(val) => setFilter("status", val || "ALL")}
            w={{ base: "100%", sm: 160 }}
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
            Showing {filteredOrders.length} of {orders.length}
          </Badge>
        </Group>

        {loading ? (
          <Center py={40}>
            <Loader size="sm" color="dinePrimary" />
          </Center>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order #</Table.Th>
                <Table.Th>Restaurant</Table.Th>
                <Table.Th>Customer</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Timestamp</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredOrders.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: "center", padding: 24 }}>
                    <Text c="dimmed" size="sm">
                      No matching orders found.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredOrders.map((o) => (
                  <Table.Tr key={o.id}>
                    <Table.Td>
                      <Text fw={700} size="xs">
                        #{o.orderNo}
                      </Text>
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
                        {new Date(o.createdAt).toLocaleTimeString()}
                      </Text>
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

export default function OverviewPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <OverviewContent />
    </Suspense>
  );
}
