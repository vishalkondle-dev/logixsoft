"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
  Select,
  Radio,
  Center,
  Loader,
  Paper,
  Grid,
  ThemeIcon,
  Title,
  Divider,
  List,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCreditCard,
  IconBuildingStore,
  IconCheck,
  IconCalendar,
  IconReceipt,
  IconDownload,
  IconInfoCircle,
  IconSparkles,
  IconClock,
  IconArrowUpRight,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { getBillingData, updateOutletSubscription } from "@/lib/api-client";

export function BillingManagement() {
  const { restaurant } = useRestaurant();
  const restaurantId = restaurant?.id || "";
  const searchParams = useSearchParams();
  const urlOutletId = searchParams.get("outletId");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    restaurant: { id: string; name: string };
    outlets: any[];
    plans: any[];
    invoices: any[];
  } | null>(null);

  // Active branch being inspected/configured in the plans catalog
  const [activeBranchId, setActiveBranchId] = useState<string>("");

  // Upgrade / Change Plan Modal
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<any>(null);
  const [selectedPlanTier, setSelectedPlanTier] = useState<string>("PRO");
  const [selectedCycle, setSelectedCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [submitting, setSubmitting] = useState(false);

  const loadBilling = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const res = await getBillingData(restaurantId);
      setData(res);
      if (res?.outlets && res.outlets.length > 0) {
        if (urlOutletId) {
          const matched = res.outlets.find((o: any) => o.id === urlOutletId);
          if (matched) {
            setActiveBranchId(matched.id);
            setSelectedOutlet(matched);
            setSelectedPlanTier(matched.planTier || "PRO");
            setSelectedCycle((matched.billingCycle as any) || "MONTHLY");
            setModalOpened(true);
            return;
          }
        }
        setActiveBranchId((curr) => curr || res.outlets[0].id);
      }
    } catch (err: any) {
      notifications.show({
        title: "Failed to load billing",
        message: err.message || "Could not retrieve subscription details.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, [restaurantId, urlOutletId]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const handleOpenPlanModal = (outlet?: any, defaultPlan?: string) => {
    const target = outlet || (data?.outlets && (data.outlets.find((o: any) => o.id === activeBranchId) || data.outlets[0])) || null;
    setSelectedOutlet(target);
    setSelectedPlanTier(defaultPlan || target?.planTier || "PRO");
    setSelectedCycle((target?.billingCycle as any) || "MONTHLY");
    setModalOpened(true);
  };

  const handleSavePlan = async () => {
    if (!selectedOutlet || !restaurantId) return;
    setSubmitting(true);
    try {
      await updateOutletSubscription(restaurantId, selectedOutlet.id, {
        planTier: selectedPlanTier,
        billingCycle: selectedCycle,
        status: selectedPlanTier === "FREE" ? "TRIAL" : "ACTIVE",
      });
      notifications.show({
        title: "Plan Updated",
        message: `Subscription for "${selectedOutlet.name}" successfully updated to ${selectedPlanTier} Plan.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setModalOpened(false);
      await loadBilling();
    } catch (err: any) {
      notifications.show({
        title: "Update Failed",
        message: err.message || "Failed to update outlet plan.",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data) {
    return (
      <Center py={80}>
        <Loader color="dinePrimary" size="lg" />
      </Center>
    );
  }

  const outlets = data.outlets || [];
  const plans = data.plans || [];
  const invoices = data.invoices || [];
  const activeBranch = outlets.find((o) => o.id === activeBranchId) || outlets[0];

  const totalMonthly = outlets.reduce((sum, o) => {
    if (o.status === "SUSPENDED" || o.status === "EXPIRED") return sum;
    return sum + (o.monthlyPrice || 0);
  }, 0);

  const activeCount = outlets.filter((o) => o.status === "ACTIVE" || o.status === "TRIAL").length;

  return (
    <Stack gap="xl">
      {/* 1. Header Overview Cards */}
      <Grid gap="md">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Active Outlet Licenses
                </Text>
                <Title order={3} mt={4}>
                  {activeCount} / {outlets.length}
                </Title>
              </div>
              <ThemeIcon size={40} radius="md" color="indigo" variant="light">
                <IconBuildingStore size={22} />
              </ThemeIcon>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              {outlets.length === 1 ? "1 branch managed" : `${outlets.length} branches managed`}
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Current Investment
                </Text>
                <Title order={3} mt={4}>
                  ₹{totalMonthly.toLocaleString("en-IN")}
                  <Text component="span" size="sm" c="dimmed" fw={400}>
                    /mo
                  </Text>
                </Title>
              </div>
              <ThemeIcon size={40} radius="md" color="teal" variant="light">
                <IconCreditCard size={22} />
              </ThemeIcon>
            </Group>
            <Text size="xs" c="teal" mt="xs" fw={500}>
              Billed per active outlet
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Billing Frequency
                </Text>
                <Title order={3} mt={4}>
                  Monthly SaaS
                </Title>
              </div>
              <ThemeIcon size={40} radius="md" color="violet" variant="light">
                <IconCalendar size={22} />
              </ThemeIcon>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              Next cycle: 1st of next month
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  License Model
                </Text>
                <Title order={3} mt={4}>
                  Per-Outlet
                </Title>
              </div>
              <ThemeIcon size={40} radius="md" color="orange" variant="light">
                <IconSparkles size={22} />
              </ThemeIcon>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              Independent store lifecycles
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* 2. Outlet Licenses Management Table */}
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="center" mb="md">
          <div>
            <Title order={4}>Store & Outlet Subscriptions</Title>
            <Text size="xs" c="dimmed">
              Each branch operates under its own assigned license tier and billing status.
            </Text>
          </div>
          <Button
            size="xs"
            color="dinePrimary"
            leftSection={<IconCreditCard size={14} />}
            onClick={() => handleOpenPlanModal()}
          >
            Upgrade Plan
          </Button>
        </Group>

        <Table.ScrollContainer minWidth={650}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Outlet Branch</Table.Th>
                <Table.Th>Current Plan</Table.Th>
                <Table.Th>License Status</Table.Th>
                <Table.Th>Billing Cycle</Table.Th>
                <Table.Th>Monthly Fee</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {outlets.map((o) => {
                const isTrial = o.status === "TRIAL";
                const isExpired = o.status === "EXPIRED" || o.status === "SUSPENDED";
                return (
                  <Table.Tr key={o.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <IconBuildingStore size={18} color="#7950f2" />
                        <div>
                          <Group gap={6} wrap="nowrap">
                            <Text fw={600} size="sm">
                              {o.name}
                            </Text>
                            {o.isDefault && (
                              <Badge size="xs" color="dinePrimary" variant="light">
                                Default
                              </Badge>
                            )}
                          </Group>
                          {o.address && (
                            <Text size="xs" c="dimmed">
                              {o.address}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="filled"
                        color={
                          o.planTier === "ENTERPRISE"
                            ? "violet"
                            : o.planTier === "PRO"
                            ? "indigo"
                            : o.planTier === "BASIC"
                            ? "cyan"
                            : "gray"
                        }
                      >
                        {o.planName || o.planTier}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      {isTrial ? (
                        <Badge size="sm" color="blue" variant="light" leftSection={<IconClock size={12} />}>
                          {o.trialDaysRemaining !== null ? `${o.trialDaysRemaining}d Trial Left` : "Free Trial"}
                        </Badge>
                      ) : isExpired ? (
                        <Badge size="sm" color="red" variant="filled">
                          {o.status}
                        </Badge>
                      ) : (
                        <Badge size="sm" color="teal" variant="light" leftSection={<IconCheck size={12} />}>
                          Active
                        </Badge>
                      )}
                    </Table.Td>

                    <Table.Td>
                      <Text size="xs" fw={500}>
                        {o.billingCycle === "ANNUAL" ? "Annual (Save 15%)" : "Monthly Recurring"}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Text size="sm" fw={700}>
                        ₹{(o.monthlyPrice || 0).toLocaleString("en-IN")}
                        <Text component="span" size="xs" c="dimmed" fw={400}>
                          /mo
                        </Text>
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ textAlign: "right" }}>
                      <Button
                        size="xs"
                        variant="light"
                        color="dinePrimary"
                        onClick={() => handleOpenPlanModal(o)}
                      >
                        Change Plan
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      {/* 3. Available Plans Comparison Grid */}
      <div>
        <Group justify="space-between" align="flex-end" mb="md" wrap="wrap">
          <div>
            <Title order={4}>Available SaaS Plans</Title>
            <Text size="xs" c="dimmed">
              Choose different capability tiers for different branches based on store format and volume.
            </Text>
          </div>
        </Group>

        {/* Branch Context Selector */}
        {outlets.length > 0 && (
          <Paper withBorder p="md" radius="md" mb="md" bg="gray.0">
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="sm">
                <ThemeIcon color="dinePrimary" variant="light" size="lg" radius="md">
                  <IconBuildingStore size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.5px" }}>
                    Configure Subscription For Outlet
                  </Text>
                  <Group gap="xs" mt={2}>
                    <Text size="sm" fw={700}>
                      {activeBranch?.name || "Selected Branch"}
                    </Text>
                    {activeBranch?.isDefault && (
                      <Badge size="xs" color="dinePrimary" variant="light">
                        Default Branch
                      </Badge>
                    )}
                    <Badge size="xs" color="indigo" variant="filled">
                      {activeBranch?.planTier || "PRO"} Plan
                    </Badge>
                  </Group>
                </div>
              </Group>

              {outlets.length > 1 && (
                <Group gap="xs">
                  <Text size="xs" fw={600} c="dimmed">
                    Switch Outlet:
                  </Text>
                  <Select
                    size="xs"
                    w={220}
                    value={activeBranchId}
                    onChange={(val) => val && setActiveBranchId(val)}
                    data={outlets.map((o: any) => ({
                      value: o.id,
                      label: `${o.name} (${o.planTier || "PRO"} Plan)`,
                    }))}
                  />
                </Group>
              )}
            </Group>
          </Paper>
        )}

        <Grid gap="md">
          {plans.map((p) => {
            const isPro = p.popular;
            const isCurrentForActive = activeBranch?.planTier === p.id;
            return (
              <Grid.Col key={p.id} span={{ base: 12, sm: 6, lg: 3 }}>
                <Paper
                  withBorder
                  p="lg"
                  radius="md"
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderColor: isCurrentForActive
                      ? "var(--mantine-color-teal-6)"
                      : isPro
                      ? "var(--mantine-color-indigo-6)"
                      : undefined,
                    borderWidth: isCurrentForActive || isPro ? 2 : 1,
                    position: "relative",
                  }}
                >
                  {isCurrentForActive ? (
                    <Badge
                      color="teal"
                      variant="filled"
                      size="sm"
                      style={{ position: "absolute", top: -12, right: 16 }}
                    >
                      Active on Branch
                    </Badge>
                  ) : isPro ? (
                    <Badge
                      color="indigo"
                      variant="filled"
                      size="sm"
                      style={{ position: "absolute", top: -12, right: 16 }}
                    >
                      Most Popular
                    </Badge>
                  ) : null}

                  <Title order={4}>{p.name}</Title>
                  <Text size="xs" c="dimmed" mt={4}>
                    Billed per outlet branch
                  </Text>

                  <Group align="baseline" gap={4} my="md">
                    <Title order={2}>
                      ₹{p.monthlyPrice.toLocaleString("en-IN")}
                    </Title>
                    <Text size="xs" c="dimmed">
                      / month
                    </Text>
                  </Group>

                  <Divider mb="sm" />

                  <List
                    spacing="xs"
                    size="xs"
                    icon={
                      <ThemeIcon size={18} radius="xl" color="teal" variant="light">
                        <IconCheck size={12} />
                      </ThemeIcon>
                    }
                    style={{ flexGrow: 1 }}
                  >
                    {p.features.map((feat: string, idx: number) => (
                      <List.Item key={idx}>{feat}</List.Item>
                    ))}
                  </List>

                  <Button
                    fullWidth
                    mt="lg"
                    color={isCurrentForActive ? "teal" : isPro ? "indigo" : "dinePrimary"}
                    variant={isCurrentForActive ? "light" : isPro ? "filled" : "outline"}
                    disabled={isCurrentForActive}
                    leftSection={isCurrentForActive ? <IconCheck size={14} /> : undefined}
                    onClick={() => handleOpenPlanModal(activeBranch, p.id)}
                  >
                    {isCurrentForActive
                      ? `Active on ${activeBranch?.name || "Branch"}`
                      : `Assign to ${activeBranch?.name || "Branch"}`}
                  </Button>
                </Paper>
              </Grid.Col>
            );
          })}
        </Grid>
      </div>

      {/* 4. Invoices & Billing History */}
      <Card withBorder radius="md" p="lg">
        <Title order={4} mb="xs">
          Tax Invoices & Payment History
        </Title>
        <Text size="xs" c="dimmed" mb="md">
          Official GST invoices and receipts generated for your SaaS subscriptions.
        </Text>

        <Table.ScrollContainer minWidth={600}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice #</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Branch</Table.Th>
                <Table.Th>Plan</Table.Th>
                <Table.Th>Amount (incl. GST)</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Receipt</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {invoices.map((inv) => (
                <Table.Tr key={inv.id}>
                  <Table.Td>
                    <Text size="xs" fw={700}>
                      {inv.id}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{new Date(inv.date).toLocaleDateString("en-IN")}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{inv.outletName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light" color="indigo">
                      {inv.planName}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" fw={700}>
                      ₹{inv.total.toLocaleString("en-IN")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color="teal">
                      {inv.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <ActionIcon
                      variant="subtle"
                      color="dinePrimary"
                      size="sm"
                      title="Download Invoice PDF"
                      onClick={() =>
                        notifications.show({
                          title: "Invoice Download",
                          message: `Downloading tax invoice ${inv.id}...`,
                          color: "blue",
                        })
                      }
                    >
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      {/* Plan Selection / Upgrade Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs">
            <IconCreditCard size={20} color="#7950f2" />
            <Text fw={700}>Manage Outlet Subscription</Text>
          </Group>
        }
        size="md"
        radius="md"
      >
        <Stack gap="md">
          <Select
            label="Target Outlet Branch"
            description="Choose which store branch license this subscription will apply to"
            data={outlets.map((o: any) => ({
              value: o.id,
              label: `${o.name} (Current: ${o.planTier || "PRO"} Plan • ${o.status || "ACTIVE"})`,
            }))}
            value={selectedOutlet?.id || ""}
            onChange={(val) => {
              const found = outlets.find((o: any) => o.id === val);
              if (found) {
                setSelectedOutlet(found);
                setSelectedPlanTier(found.planTier || "PRO");
                setSelectedCycle(found.billingCycle || "MONTHLY");
              }
            }}
          />

          <div>
            <Text size="sm" fw={600} mb="xs">
              Choose Plan Tier for {selectedOutlet?.name || "this outlet"}
            </Text>
            <Stack gap="xs">
              {plans.map((p) => (
                <Paper
                  key={p.id}
                  withBorder
                  p="sm"
                  radius="md"
                  style={{
                    cursor: "pointer",
                    borderColor:
                      selectedPlanTier === p.id
                        ? "var(--mantine-color-indigo-6)"
                        : undefined,
                    backgroundColor:
                      selectedPlanTier === p.id
                        ? "var(--mantine-color-indigo-0)"
                        : undefined,
                  }}
                  onClick={() => setSelectedPlanTier(p.id)}
                >
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <Radio
                        checked={selectedPlanTier === p.id}
                        onChange={() => setSelectedPlanTier(p.id)}
                        value={p.id}
                      />
                      <div>
                        <Text size="sm" fw={600}>
                          {p.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {p.features.slice(0, 2).join(" • ")}
                        </Text>
                      </div>
                    </Group>
                    <Text size="sm" fw={700}>
                      ₹{p.monthlyPrice.toLocaleString("en-IN")}
                      <Text component="span" size="xs" c="dimmed">
                        /mo
                      </Text>
                    </Text>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </div>

          <div>
            <Text size="sm" fw={600} mb="xs">
              Billing Cycle
            </Text>
            <Group gap="md">
              <Radio
                label="Monthly (₹/month billed each month)"
                checked={selectedCycle === "MONTHLY"}
                onChange={() => setSelectedCycle("MONTHLY")}
              />
              <Radio
                label="Annual (15% Savings / 2 Months Free)"
                checked={selectedCycle === "ANNUAL"}
                onChange={() => setSelectedCycle("ANNUAL")}
              />
            </Group>
          </div>

          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            Plan upgrades take effect immediately. All POS terminals and staff in this outlet will receive the updated feature capabilities without interruption.
          </Alert>

          <Group justify="flex-end" gap="xs" mt="sm">
            <Button variant="default" onClick={() => setModalOpened(false)}>
              Cancel
            </Button>
            <Button
              color="dinePrimary"
              loading={submitting}
              leftSection={<IconCheck size={16} />}
              onClick={handleSavePlan}
            >
              Activate Subscription
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
