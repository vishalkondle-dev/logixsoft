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
  NumberInput,
  Select,
  Center,
  Loader,
  Paper,
  SimpleGrid,
  Divider,
  ThemeIcon,
  Box,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCreditCard,
  IconSearch,
  IconEdit,
  IconX,
  IconAdjustments,
  IconCheck,
  IconCoin,
  IconSparkles,
  IconBuildingStore,
  IconTag,
} from "@tabler/icons-react";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

const PLAN_TIERS = [
  { value: "ALL", label: "All Plan Tiers" },
  { value: "BASIC", label: "Basic Tier (Starter)" },
  { value: "PRO", label: "Pro Tier" },
];

function SubscriptionsContent() {
  const { getFilter, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const tierFilter = getFilter("tier", "ALL");
  const statusFilter = getFilter("status", "ALL");
  const sortBy = getFilter("sortBy", "name");

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([
    { id: "BASIC", name: "Starter Plan", monthlyPrice: 999, annualPrice: 9990 },
    { id: "PRO", name: "Pro Plan", monthlyPrice: 1499, annualPrice: 14990, popular: true },
  ]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Global Plan Amounts Customization Modal
  const [plansModalOpened, setPlansModalOpened] = useState(false);
  const [savingPlans, setSavingPlans] = useState(false);
  const [editPlanAmounts, setEditPlanAmounts] = useState({
    basicMonthly: 999,
    basicAnnual: 9990,
    proMonthly: 1499,
    proAnnual: 14990,
  });

  // Edit Outlet Subscription Modal
  const [editOpened, setEditOpened] = useState(false);
  const [selectedRest, setSelectedRest] = useState<any>(null);
  const [planTier, setPlanTier] = useState("BASIC");
  const [subStatus, setSubStatus] = useState("ACTIVE");
  const [billingCycle, setBillingCycle] = useState("MONTHLY");
  const [customMonthlyPrice, setCustomMonthlyPrice] = useState<number | string>("");
  const [customAnnualPrice, setCustomAnnualPrice] = useState<number | string>("");

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
        if (d.plans && Array.isArray(d.plans) && d.plans.length > 0) {
          setPlans(d.plans);
        }
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

  // Open Global Customize Plan Amounts Modal
  const handleOpenPlansModal = () => {
    const basic = plans.find((p) => p.id === "BASIC") || { monthlyPrice: 999, annualPrice: 9990 };
    const pro = plans.find((p) => p.id === "PRO") || { monthlyPrice: 1499, annualPrice: 14990 };
    setEditPlanAmounts({
      basicMonthly: basic.monthlyPrice ?? 999,
      basicAnnual: basic.annualPrice ?? 9990,
      proMonthly: pro.monthlyPrice ?? 1499,
      proAnnual: pro.annualPrice ?? 14990,
    });
    setPlansModalOpened(true);
  };

  // Save Global Customized Plan Amounts
  const handleSavePlanAmounts = async () => {
    setSavingPlans(true);
    try {
      const res = await fetch(`${API_BASE}/admin/plans`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plans: [
            {
              id: "BASIC",
              name: "Starter Plan",
              monthlyPrice: Number(editPlanAmounts.basicMonthly),
              annualPrice: Number(editPlanAmounts.basicAnnual),
            },
            {
              id: "PRO",
              name: "Pro Plan",
              monthlyPrice: Number(editPlanAmounts.proMonthly),
              annualPrice: Number(editPlanAmounts.proAnnual),
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update plan amounts");

      notifications.show({
        title: "Plan Amounts Updated",
        message: `Starter: ₹${Number(editPlanAmounts.basicMonthly).toLocaleString("en-IN")}/mo, Pro: ₹${Number(editPlanAmounts.proMonthly).toLocaleString("en-IN")}/mo. Applied platform-wide.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setPlans(data.plans || []);
      setPlansModalOpened(false);
      await loadData();
    } catch (err: any) {
      notifications.show({
        title: "Update Failed",
        message: err.message || "Could not save custom plan amounts.",
        color: "red",
      });
    } finally {
      setSavingPlans(false);
    }
  };

  // Update Specific Outlet Subscription & Custom Pricing
  const handleUpdateSubscription = async () => {
    if (!selectedRest) return;
    setSubmitting(true);
    try {
      const payload: any = {
        planTier,
        status: subStatus,
        billingCycle,
        customMonthlyPrice: customMonthlyPrice !== "" && customMonthlyPrice !== undefined ? Number(customMonthlyPrice) : null,
        customAnnualPrice: customAnnualPrice !== "" && customAnnualPrice !== undefined ? Number(customAnnualPrice) : null,
      };

      const res = await fetch(`${API_BASE}/admin/subscriptions/${selectedRest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update subscription");

      notifications.show({
        title: "Subscription Updated",
        message: `License for "${selectedRest.name}" updated successfully.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setEditOpened(false);
      await loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = restaurants;
  const basicPlan = plans.find((p) => p.id === "BASIC") || { monthlyPrice: 999, annualPrice: 9990 };
  const proPlan = plans.find((p) => p.id === "PRO") || { monthlyPrice: 1499, annualPrice: 14990 };

  return (
    <Stack gap="lg">
      {/* Page Header */}
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Subscriptions &amp; Plans Governance
          </Text>
          <Text size="sm" c="dimmed">
            Configure global SaaS plan amounts, per-outlet negotiated rates, billing cycles, and feature licensing.
          </Text>
        </div>

        <Button
          color="dinePrimary"
          leftSection={<IconAdjustments size={16} />}
          onClick={handleOpenPlansModal}
        >
          Customize Plan Amounts
        </Button>
      </Group>

      {/* Global Plan Pricing Governance Banner */}
      <Paper withBorder p="md" radius="md" bg="var(--mantine-color-body)">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm">
            <ThemeIcon size={42} radius="md" color="dinePrimary" variant="light">
              <IconCoin size={22} />
            </ThemeIcon>
            <div>
              <Group gap="xs" align="center">
                <Text fw={700} size="sm">Active Platform SaaS Plans</Text>
                <Badge size="xs" color="teal" variant="light">Live Pricing</Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Standard recurring amounts charged to restaurants for Starter and Pro tiers.
              </Text>
            </div>
          </Group>

          <Group gap="xl" wrap="wrap">
            <Box>
              <Group gap={6} align="center">
                <Badge size="xs" color="blue" variant="filled">Starter</Badge>
                <Text size="sm" fw={700}>
                  ₹{(basicPlan.monthlyPrice || 999).toLocaleString("en-IN")}
                  <Text component="span" size="xs" c="dimmed" fw={400}> / mo</Text>
                </Text>
              </Group>
              <Text size="11px" c="dimmed">
                Annual: ₹{(basicPlan.annualPrice || 9990).toLocaleString("en-IN")} / yr
              </Text>
            </Box>

            <Divider orientation="vertical" />

            <Box>
              <Group gap={6} align="center">
                <Badge size="xs" color="indigo" variant="filled">Pro</Badge>
                <Text size="sm" fw={700}>
                  ₹{(proPlan.monthlyPrice || 1499).toLocaleString("en-IN")}
                  <Text component="span" size="xs" c="dimmed" fw={400}> / mo</Text>
                </Text>
              </Group>
              <Text size="11px" c="dimmed">
                Annual: ₹{(proPlan.annualPrice || 14990).toLocaleString("en-IN")} / yr
              </Text>
            </Box>

            <Button
              size="xs"
              variant="light"
              color="dinePrimary"
              leftSection={<IconEdit size={14} />}
              onClick={handleOpenPlansModal}
            >
              Edit Pricing
            </Button>
          </Group>
        </Group>
      </Paper>

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
          <Table.ScrollContainer minWidth={850}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Outlet &amp; Restaurant</Table.Th>
                  <Table.Th>Plan Tier</Table.Th>
                  <Table.Th>Plan Amount</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Billing Cycle</Table.Th>
                  <Table.Th>Renewal / Expiry</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7} style={{ textAlign: "center", padding: 30 }}>
                      <Text c="dimmed">No outlet subscriptions found matching criteria.</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filtered.map((r) => {
                    const isAnnual = r.billingCycle === "ANNUAL";
                    const price = isAnnual
                      ? r.annualPrice || (r.planTier === "PRO" ? proPlan.annualPrice : basicPlan.annualPrice)
                      : r.monthlyPrice || (r.planTier === "PRO" ? proPlan.monthlyPrice : basicPlan.monthlyPrice);

                    return (
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
                            color={r.planTier === "PRO" ? "indigo" : "blue"}
                          >
                            {r.planTier || "BASIC"}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6} align="center">
                            <Text size="sm" fw={700}>
                              ₹{(price || 0).toLocaleString("en-IN")}
                              <Text component="span" size="xs" c="dimmed" fw={400}>
                                {isAnnual ? " / yr" : " / mo"}
                              </Text>
                            </Text>
                            {r.isCustomPrice && (
                              <Badge size="xs" color="grape" variant="light" leftSection={<IconTag size={10} />}>
                                Custom Override
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            color={(r.status || "ACTIVE") === "ACTIVE" ? "green" : "red"}
                          >
                            {r.status || r.subscriptionStatus || "ACTIVE"}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" fw={500}>{r.billingCycle || "MONTHLY"}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {r.subscriptionExpiresAt
                              ? new Date(r.subscriptionExpiresAt).toLocaleDateString()
                              : "Auto-renews"}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <ActionIcon
                            variant="subtle"
                            color="dinePrimary"
                            size="sm"
                            title="Edit Plan & Pricing"
                            onClick={() => {
                              setSelectedRest(r);
                              setPlanTier(r.planTier || "PRO");
                              setSubStatus(r.status || r.subscriptionStatus || "ACTIVE");
                              setBillingCycle(r.billingCycle || "MONTHLY");

                              const cp = r.customPlanPricing;
                              setCustomMonthlyPrice(cp?.monthlyPrice !== undefined ? cp.monthlyPrice : "");
                              setCustomAnnualPrice(cp?.annualPrice !== undefined ? cp.annualPrice : "");
                              setEditOpened(true);
                            }}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      {/* Modal 1: Customize Global Platform Plan Amounts */}
      <Modal
        opened={plansModalOpened}
        onClose={() => setPlansModalOpened(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} color="dinePrimary" variant="light" radius="md">
              <IconCoin size={18} />
            </ThemeIcon>
            <Text fw={700}>Customize Platform Plan Amounts</Text>
          </Group>
        }
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Set global base subscription amounts for restaurant owners. Changes apply immediately to new checkouts and billing renewal summaries.
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {/* Starter Plan */}
            <Paper withBorder p="md" radius="md" bg="gray.0">
              <Group justify="space-between" mb="xs">
                <Badge color="blue" variant="filled">Starter (Basic)</Badge>
                <Text size="xs" c="dimmed">Entry POS & Billing</Text>
              </Group>

              <Stack gap="xs">
                <NumberInput
                  label="Monthly Price (₹)"
                  description="Billed every month via AutoPay"
                  min={0}
                  step={100}
                  value={editPlanAmounts.basicMonthly}
                  onChange={(v) =>
                    setEditPlanAmounts((prev) => ({ ...prev, basicMonthly: Number(v) || 0 }))
                  }
                />
                <NumberInput
                  label="Annual Price (₹)"
                  description="Billed once per year (upfront)"
                  min={0}
                  step={500}
                  value={editPlanAmounts.basicAnnual}
                  onChange={(v) =>
                    setEditPlanAmounts((prev) => ({ ...prev, basicAnnual: Number(v) || 0 }))
                  }
                />
                {editPlanAmounts.basicMonthly > 0 && editPlanAmounts.basicAnnual > 0 && (
                  <Text size="11px" c="teal" fw={600} mt={4}>
                    Annual saves ~
                    {Math.round(
                      (1 - editPlanAmounts.basicAnnual / (editPlanAmounts.basicMonthly * 12)) * 100
                    )}
                    % vs monthly
                  </Text>
                )}
              </Stack>
            </Paper>

            {/* Pro Plan */}
            <Paper withBorder p="md" radius="md" bg="gray.0">
              <Group justify="space-between" mb="xs">
                <Badge color="indigo" variant="filled">Pro Tier</Badge>
                <Text size="xs" c="dimmed">Full Ecosystem + KDS</Text>
              </Group>

              <Stack gap="xs">
                <NumberInput
                  label="Monthly Price (₹)"
                  description="Billed every month via AutoPay"
                  min={0}
                  step={100}
                  value={editPlanAmounts.proMonthly}
                  onChange={(v) =>
                    setEditPlanAmounts((prev) => ({ ...prev, proMonthly: Number(v) || 0 }))
                  }
                />
                <NumberInput
                  label="Annual Price (₹)"
                  description="Billed once per year (upfront)"
                  min={0}
                  step={500}
                  value={editPlanAmounts.proAnnual}
                  onChange={(v) =>
                    setEditPlanAmounts((prev) => ({ ...prev, proAnnual: Number(v) || 0 }))
                  }
                />
                {editPlanAmounts.proMonthly > 0 && editPlanAmounts.proAnnual > 0 && (
                  <Text size="11px" c="teal" fw={600} mt={4}>
                    Annual saves ~
                    {Math.round(
                      (1 - editPlanAmounts.proAnnual / (editPlanAmounts.proMonthly * 12)) * 100
                    )}
                    % vs monthly
                  </Text>
                )}
              </Stack>
            </Paper>
          </SimpleGrid>

          <Divider my="xs" />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPlansModalOpened(false)}>
              Cancel
            </Button>
            <Button
              color="dinePrimary"
              loading={savingPlans}
              leftSection={<IconCheck size={16} />}
              onClick={handleSavePlanAmounts}
            >
              Save Plan Pricing
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal 2: Modify Outlet Subscription & Custom Pricing */}
      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title={
          <Group gap="xs">
            <IconBuildingStore size={20} color="#7950f2" />
            <Text fw={700}>Modify Outlet Subscription &amp; Pricing</Text>
          </Group>
        }
        centered
        size="md"
      >
        <Stack gap="sm">
          <Paper p="xs" radius="md" bg="gray.0" withBorder>
            <Text size="sm" fw={700}>
              {selectedRest?.name}
            </Text>
            <Text size="xs" c="dimmed">
              Restaurant: {selectedRest?.restaurantName || "Parent Restaurant"}
            </Text>
          </Paper>

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
              { value: "SUSPENDED", label: "Suspended" },
              { value: "EXPIRED", label: "Expired" },
            ]}
            value={subStatus}
            onChange={(v) => setSubStatus(v || "ACTIVE")}
          />

          <Divider my="xs" label="Negotiated Custom Price Override" labelPosition="center" />

          <Text size="xs" c="dimmed" mt={-4}>
            Leave blank to use the standard platform plan price ({planTier === "PRO" ? `₹${proPlan.monthlyPrice}/mo` : `₹${basicPlan.monthlyPrice}/mo`}), or specify a custom negotiated amount for this specific outlet.
          </Text>

          <Group grow>
            <NumberInput
              label="Custom Monthly (₹)"
              placeholder={`Default: ₹${planTier === "PRO" ? proPlan.monthlyPrice : basicPlan.monthlyPrice}`}
              min={0}
              value={customMonthlyPrice}
              onChange={(v) => setCustomMonthlyPrice(v ?? "")}
            />
            <NumberInput
              label="Custom Annual (₹)"
              placeholder={`Default: ₹${planTier === "PRO" ? proPlan.annualPrice : basicPlan.annualPrice}`}
              min={0}
              value={customAnnualPrice}
              onChange={(v) => setCustomAnnualPrice(v ?? "")}
            />
          </Group>

          {(customMonthlyPrice !== "" || customAnnualPrice !== "") && (
            <Group justify="space-between" align="center" mt={-4}>
              <Badge size="xs" color="grape" variant="light">
                Custom pricing active
              </Badge>
              <Button
                variant="subtle"
                color="red"
                size="compact-xs"
                onClick={() => {
                  setCustomMonthlyPrice("");
                  setCustomAnnualPrice("");
                }}
              >
                Reset to Default Pricing
              </Button>
            </Group>
          )}

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
