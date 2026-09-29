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
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCreditCard,
  IconSearch,
  IconEdit,
  IconX,
} from "@tabler/icons-react";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

const PLAN_TIERS = [
  { value: "ALL", label: "All Plan Tiers" },
  { value: "FREE", label: "Free Tier" },
  { value: "BASIC", label: "Basic Tier" },
  { value: "PRO", label: "Pro Tier" },
  { value: "ENTERPRISE", label: "Enterprise Tier" },
];

function SubscriptionsContent() {
  const { getFilter, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const tierFilter = getFilter("tier", "ALL");
  const statusFilter = getFilter("status", "ALL");
  const sortBy = getFilter("sortBy", "name");

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Edit Subscription Modal
  const [editOpened, setEditOpened] = useState(false);
  const [selectedRest, setSelectedRest] = useState<any>(null);
  const [planTier, setPlanTier] = useState("PRO");
  const [subStatus, setSubStatus] = useState("ACTIVE");
  const [billingCycle, setBillingCycle] = useState("MONTHLY");

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (tierFilter && tierFilter !== "ALL") params.set("tier", tierFilter);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (sortBy) params.set("sortBy", sortBy);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/admin/subscriptions${qs}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setRestaurants(Array.isArray(d) ? d : d.restaurants || d.outlets || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, tierFilter, statusFilter, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateSubscription = async () => {
    if (!selectedRest) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/subscriptions/${selectedRest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planTier, status: subStatus, billingCycle }),
      });
      if (!res.ok) throw new Error("Failed to update subscription");
      notifications.show({ title: "Subscription Updated", message: "Plan tier and status updated.", color: "teal" });
      setEditOpened(false);
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Server-side filtered and sorted
  const filtered = restaurants;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Subscriptions &amp; Plans Governance
          </Text>
          <Text size="sm" c="dimmed">
            Manage per-outlet SaaS licensing, plan tiers, billing cycles, and feature access.
          </Text>
        </div>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by outlet or store name..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setFilter("search", e.target.value)}
            w={{ base: "100%", sm: 280 }}
            size="xs"
          />
          <Select
            placeholder="Plan Tier"
            data={PLAN_TIERS}
            value={tierFilter}
            onChange={(val) => setFilter("tier", val || "ALL")}
            w={{ base: "100%", sm: 160 }}
            size="xs"
          />
          <Select
            placeholder="Status"
            data={[
              { value: "ALL", label: "All Statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "TRIAL", label: "Trial" },
              { value: "SUSPENDED", label: "Suspended" },
              { value: "EXPIRED", label: "Expired" },
            ]}
            value={statusFilter}
            onChange={(val) => setFilter("status", val || "ALL")}
            w={{ base: "100%", sm: 130 }}
            size="xs"
          />
          <Select
            placeholder="Sort By"
            data={[
              { value: "name", label: "Outlet Name (A-Z)" },
              { value: "status", label: "Status" },
              { value: "recent", label: "Most Recent" },
              { value: "oldest", label: "Oldest" },
            ]}
            value={sortBy}
            onChange={(val) => setFilter("sortBy", val || "name")}
            w={{ base: "100%", sm: 150 }}
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
            Showing {filtered.length} of {restaurants.length} Outlet Licenses
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
                <Table.Th>Outlet &amp; Restaurant</Table.Th>
                <Table.Th>Current Plan Tier</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Billing Cycle</Table.Th>
                <Table.Th>Renewal / Expiry</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No outlet subscriptions found matching criteria.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconCreditCard size={18} color="#7950f2" />
                        <div>
                          <Text fw={700} size="sm">
                            {r.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {r.restaurantName || "Parent Restaurant"}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="filled"
                        color={
                          r.planTier === "ENTERPRISE"
                            ? "grape"
                            : r.planTier === "PRO"
                            ? "indigo"
                            : r.planTier === "BASIC"
                            ? "blue"
                            : "gray"
                        }
                      >
                        {r.planTier || "PRO"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={
                          (r.status || "ACTIVE") === "ACTIVE"
                            ? "green"
                            : (r.status || "") === "TRIAL"
                            ? "orange"
                            : "red"
                        }
                      >
                        {r.status || r.subscriptionStatus || "ACTIVE"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={500}>{r.billingCycle || "MONTHLY"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {r.status === "TRIAL" && r.trialEndsAt
                          ? `Trial ends ${new Date(r.trialEndsAt).toLocaleDateString()}`
                          : r.subscriptionExpiresAt
                          ? new Date(r.subscriptionExpiresAt).toLocaleDateString()
                          : "Auto-renews"}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <ActionIcon
                        variant="subtle"
                        color="dinePrimary"
                        size="sm"
                        onClick={() => {
                          setSelectedRest(r);
                          setPlanTier(r.planTier || "PRO");
                          setSubStatus(r.status || r.subscriptionStatus || "ACTIVE");
                          setBillingCycle(r.billingCycle || "MONTHLY");
                          setEditOpened(true);
                        }}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      {/* Modal: Edit Subscription */}
      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title={<Text fw={700}>Modify Outlet Subscription Plan</Text>}
        centered
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm">
            Outlet: <strong>{selectedRest?.name}</strong>
          </Text>
          <Text size="xs" c="dimmed" mt={-6}>
            Parent Restaurant: {selectedRest?.restaurantName}
          </Text>
          <Select
            label="Plan Tier"
            data={PLAN_TIERS.filter((p) => p.value !== "ALL")}
            value={planTier}
            onChange={(v) => setPlanTier(v || "PRO")}
          />
          <Select
            label="Billing Cycle"
            data={[
              { value: "MONTHLY", label: "Monthly Recurring" },
              { value: "ANNUAL", label: "Annual (Upfront)" },
            ]}
            value={billingCycle}
            onChange={(v) => setBillingCycle(v || "MONTHLY")}
          />
          <Select
            label="Subscription Status"
            data={[
              { value: "ACTIVE", label: "Active" },
              { value: "TRIAL", label: "14-Day Trial" },
              { value: "SUSPENDED", label: "Suspended" },
              { value: "EXPIRED", label: "Expired" },
            ]}
            value={subStatus}
            onChange={(v) => setSubStatus(v || "ACTIVE")}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleUpdateSubscription}>
              Update License
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <SubscriptionsContent />
    </Suspense>
  );
}
