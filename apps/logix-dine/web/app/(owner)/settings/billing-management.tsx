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
  SimpleGrid,
  Box,
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
  IconRefresh,
  IconQrcode,
  IconShieldCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { useRestaurantStore } from "@/lib/stores/restaurant-store";
import {
  getBillingData,
  updateOutletSubscription,
  initiateOutletOneTimePay,
  initiateOutletAutopay,
  cancelOutletAutopay,
} from "@/lib/api-client";
import { DEFAULT_FREE_TRIAL_DAYS } from "@logixsoft/logix-dine/types/plans";

export function BillingManagement() {
  const { restaurant, activeOutlet, outlets: ctxOutlets } = useRestaurant();
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

  // Upgrade / Change Plan Modal
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedPlanTier, setSelectedPlanTier] = useState<string>("PRO");
  const [selectedCycle, setSelectedCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [submitting, setSubmitting] = useState(false);

  // One-Time Payment state
  const [paymentModalOpened, setPaymentModalOpened] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    orderId: string;
    checkoutUrl: string;
    upiString: string;
    amount: number;
    frequency: string;
    outletName: string;
    planTier: string;
  } | null>(null);
  const [initiatingPayment, setInitiatingPayment] = useState(false);

  // AutoPay state
  const [autopayModalOpened, setAutopayModalOpened] = useState(false);
  const [autopayData, setAutopayData] = useState<{
    mandateId: string;
    checkoutUrl: string;
    upiString: string;
    recurringAmount: number;
    frequency: string;
    outletName: string;
    planTier: string;
  } | null>(null);
  const [initiatingAutopay, setInitiatingAutopay] = useState(false);
  const [cancellingOutletId, setCancellingOutletId] = useState<string | null>(null);
  const [cancelConfirmOpened, setCancelConfirmOpened] = useState(false);

  const loadBilling = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const res = await getBillingData(restaurantId);
      setData(res);
      if (res?.outlets && res.outlets.length > 0) {
        const targetId = activeOutlet?.id || urlOutletId || res.outlets[0]?.id;
        const matched = res.outlets.find((o: any) => o.id === targetId) || res.outlets[0];
        if (matched) {
          setSelectedPlanTier(matched.planTier || "PRO");
          setSelectedCycle((matched.billingCycle as any) || "MONTHLY");
        }
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
  }, [restaurantId, activeOutlet?.id, urlOutletId]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  // Listen for iframe postMessage from PG checkout (AutoPay or One-Time)
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && (e.data.type === "LOGIXSOFT_MANDATE_SUCCESS" || e.data.event === "mandate.activated")) {
        notifications.show({
          title: "AutoPay Mandate Authorized!",
          message: "UPI AutoPay has been successfully activated. Subscription extended.",
          color: "teal",
          icon: <IconCheck size={16} />,
        });
        setAutopayModalOpened(false);
        setModalOpened(false);
        loadBilling();
        if (restaurantId) useRestaurantStore.getState().fetchData(restaurantId);
      } else if (e.data && (e.data.type === "LOGIXSOFT_PAYMENT_SUCCESS" || e.data.event === "payment.success")) {
        notifications.show({
          title: "Payment Received Successfully!",
          message: "Your subscription payment was confirmed. Plan activated.",
          color: "teal",
          icon: <IconCheck size={16} />,
        });
        setPaymentModalOpened(false);
        setModalOpened(false);
        loadBilling();
        if (restaurantId) useRestaurantStore.getState().fetchData(restaurantId);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [loadBilling, restaurantId]);

  // Resolve target outlet strictly for the currently active outlet
  const outlets = data?.outlets || [];
  const plans = data?.plans || [];
  const invoices = data?.invoices || [];

  const targetOutletId = activeOutlet?.id || urlOutletId || ctxOutlets[0]?.id || outlets[0]?.id;
  const currentOutlet = outlets.find((o: any) => o.id === targetOutletId) || outlets[0] || null;

  const handleStartOneTimePay = async (planTier?: string, cycle?: "MONTHLY" | "ANNUAL") => {
    if (!currentOutlet || !restaurantId) return;

    const tier = (planTier || selectedPlanTier || currentOutlet.planTier || "PRO") as "BASIC" | "PRO";
    const billCycle = cycle || selectedCycle || currentOutlet.billingCycle || "MONTHLY";

    setInitiatingPayment(true);
    try {
      const res = await initiateOutletOneTimePay(restaurantId, currentOutlet.id, {
        planTier: tier,
        billingCycle: billCycle,
      });

      setPaymentData({
        orderId: res.orderId,
        checkoutUrl: res.checkoutUrl,
        upiString: res.upiString,
        amount: res.amount,
        frequency: res.frequency,
        outletName: currentOutlet.name,
        planTier: tier,
      });
      setPaymentModalOpened(true);
    } catch (err: any) {
      notifications.show({
        title: "Payment Initiation Failed",
        message: err.message || "Failed to initiate payment with payment gateway.",
        color: "red",
      });
    } finally {
      setInitiatingPayment(false);
    }
  };

  const handleStartAutopay = async (planTier?: string, cycle?: "MONTHLY" | "ANNUAL") => {
    if (!currentOutlet || !restaurantId) return;

    const tier = (planTier || selectedPlanTier || currentOutlet.planTier || "PRO") as "BASIC" | "PRO";
    const billCycle = cycle || selectedCycle || currentOutlet.billingCycle || "MONTHLY";

    setInitiatingAutopay(true);
    try {
      const res = await initiateOutletAutopay(restaurantId, currentOutlet.id, {
        planTier: tier,
        billingCycle: billCycle,
      });

      setAutopayData({
        mandateId: res.mandateId,
        checkoutUrl: res.checkoutUrl,
        upiString: res.upiString,
        recurringAmount: res.recurringAmount,
        frequency: res.frequency,
        outletName: currentOutlet.name,
        planTier: tier,
      });
      setAutopayModalOpened(true);
    } catch (err: any) {
      notifications.show({
        title: "AutoPay Initiation Failed",
        message: err.message || "Failed to initiate mandate with payment gateway.",
        color: "red",
      });
    } finally {
      setInitiatingAutopay(false);
    }
  };

  const handleCancelAutopay = async () => {
    if (!currentOutlet || !restaurantId) return;
    setCancellingOutletId(currentOutlet.id);
    try {
      await cancelOutletAutopay(restaurantId, currentOutlet.id);
      const expiryFormatted = currentOutlet.subscriptionExpiresAt
        ? new Date(currentOutlet.subscriptionExpiresAt).toLocaleDateString("en-IN")
        : "the end of your current cycle";
      notifications.show({
        title: "AutoPay Cancelled",
        message: `UPI AutoPay for "${currentOutlet.name}" has been revoked. Your subscription remains active with full access until ${expiryFormatted}.`,
        color: "yellow",
        autoClose: 8000,
      });
      setCancelConfirmOpened(false);
      await loadBilling();
    } catch (err: any) {
      notifications.show({
        title: "Cancellation Failed",
        message: err.message || "Failed to cancel AutoPay mandate.",
        color: "red",
      });
    } finally {
      setCancellingOutletId(null);
    }
  };

  const handleOpenPlanModal = (defaultPlan?: string) => {
    if (!currentOutlet) return;
    setSelectedPlanTier(defaultPlan || currentOutlet.planTier || "BASIC");
    setSelectedCycle((currentOutlet.billingCycle as any) || "MONTHLY");
    setModalOpened(true);
  };

  const handleSavePlan = async () => {
    if (!currentOutlet || !restaurantId) return;
    setSubmitting(true);
    try {
      await updateOutletSubscription(restaurantId, currentOutlet.id, {
        planTier: selectedPlanTier,
        billingCycle: selectedCycle,
        status: "ACTIVE",
      });
      notifications.show({
        title: "Plan Updated",
        message: `Subscription for "${currentOutlet.name}" successfully updated to ${selectedPlanTier} Plan.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setModalOpened(false);
      await loadBilling();
      await useRestaurantStore.getState().fetchData(restaurantId);
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

  if (loading || !data || !currentOutlet) {
    return (
      <Center py={80}>
        <Loader color="dinePrimary" size="lg" />
      </Center>
    );
  }

  const monthlyPrice = currentOutlet.monthlyPrice || (currentOutlet.planTier === "PRO" ? 1499 : 499);
  const isAutoPayActive = currentOutlet.autopayStatus === "ACTIVE";
  const isExpired =
    currentOutlet.status === "EXPIRED" ||
    currentOutlet.status === "SUSPENDED" ||
    (currentOutlet.subscriptionExpiresAt ? new Date(currentOutlet.subscriptionExpiresAt).getTime() < Date.now() : false);
  const isAutoPayRevokedActive =
    !isAutoPayActive &&
    (currentOutlet.autopayStatus === "REVOKED" || currentOutlet.autopayStatus === "CANCELLED") &&
    !isExpired &&
    Boolean(currentOutlet.subscriptionExpiresAt);

  const isTrial = Boolean(
    currentOutlet.trialEndsAt && new Date(currentOutlet.trialEndsAt).getTime() > Date.now()
  );
  const trialDaysLeft = isTrial
    ? Math.max(1, Math.ceil((new Date(currentOutlet.trialEndsAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Filter invoices strictly to the active outlet
  const outletInvoices = invoices.filter(
    (inv: any) =>
      (inv.outletId && inv.outletId === currentOutlet.id) ||
      (inv.outletName && inv.outletName.toLowerCase() === currentOutlet.name.toLowerCase())
  );

  return (
    <Stack gap="xl">
      {/* 1. Scoped Overview Cards for Active Outlet */}
      <Grid gap="md" align="stretch">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper
            withBorder
            p="md"
            radius="md"
            style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase" truncate>
                    Active Outlet Branch
                  </Text>
                  <Title
                    order={3}
                    mt={4}
                    title={currentOutlet.name}
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {currentOutlet.name}
                  </Title>
                </Box>
                <ThemeIcon size={40} radius="md" color="indigo" variant="light" style={{ flexShrink: 0 }}>
                  <IconBuildingStore size={22} />
                </ThemeIcon>
              </Group>
            </div>
            <Group gap={6} mt="xs" align="center">
              <Badge size="xs" color={isExpired ? "red" : isTrial ? "violet" : "teal"} variant="light">
                {isExpired ? "EXPIRED" : isTrial ? `${trialDaysLeft}d Trial` : (currentOutlet.status || "ACTIVE")}
              </Badge>
              {currentOutlet.isDefault && (
                <Badge size="xs" color="dinePrimary" variant="outline">
                  Default Branch
                </Badge>
              )}
            </Group>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper
            withBorder
            p="md"
            radius="md"
            style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase" truncate>
                    Monthly Subscription
                  </Text>
                  <Title
                    order={3}
                    mt={4}
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    ₹{monthlyPrice.toLocaleString("en-IN")}
                    <Text component="span" size="sm" c="dimmed" fw={400}>
                      /mo
                    </Text>
                  </Title>
                </Box>
                <ThemeIcon size={40} radius="md" color="teal" variant="light" style={{ flexShrink: 0 }}>
                  <IconCreditCard size={22} />
                </ThemeIcon>
              </Group>
            </div>
            <Text size="xs" c="teal" mt="xs" fw={500}>
              {currentOutlet.planTier || "BASIC"} Plan Tier
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper
            withBorder
            p="md"
            radius="md"
            style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase" truncate>
                    UPI AutoPay
                  </Text>
                  <Title
                    order={3}
                    mt={4}
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {isAutoPayActive ? "Active" : currentOutlet.autopayStatus === "PENDING" ? "Pending" : "Inactive"}
                  </Title>
                </Box>
                <ThemeIcon
                  size={40}
                  radius="md"
                  color={isAutoPayActive ? "teal" : "violet"}
                  variant="light"
                  style={{ flexShrink: 0 }}
                >
                  <IconSparkles size={22} />
                </ThemeIcon>
              </Group>
            </div>
            <Text size="xs" c={isAutoPayActive ? "teal" : "dimmed"} mt="xs" truncate>
              {currentOutlet.autopayUmn ? "Auto-debit registered" : "Manual / on-demand billing"}
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Paper
            withBorder
            p="md"
            radius="md"
            style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase" truncate>
                    Billing Cycle
                  </Text>
                  <Title
                    order={3}
                    mt={4}
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {isTrial ? `${DEFAULT_FREE_TRIAL_DAYS}-Day Trial` : `${currentOutlet.billingCycle === "ANNUAL" ? "Annual" : "Monthly"} SaaS`}
                  </Title>
                </Box>
                <ThemeIcon size={40} radius="md" color={isTrial ? "violet" : "orange"} variant="light" style={{ flexShrink: 0 }}>
                  <IconCalendar size={22} />
                </ThemeIcon>
              </Group>
            </div>
            <Text size="xs" c={isTrial ? "violet" : "dimmed"} mt="xs" truncate>
              {isTrial
                ? `Trial ends: ${new Date(currentOutlet.trialEndsAt!).toLocaleDateString("en-IN")}`
                : currentOutlet.subscriptionExpiresAt
                ? `Expires: ${new Date(currentOutlet.subscriptionExpiresAt).toLocaleDateString("en-IN")}`
                : "Active period"}
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* 2. Free Trial Banner if active */}
      {isTrial && (
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            background: "linear-gradient(135deg, rgba(121, 80, 242, 0.08) 0%, rgba(243, 240, 255, 0.5) 100%)",
            borderColor: "rgba(121, 80, 242, 0.3)",
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <ThemeIcon size={42} radius="md" color="dinePrimary" variant="light" style={{ flexShrink: 0 }}>
                <IconSparkles size={22} />
              </ThemeIcon>
              <div>
                <Group gap="xs" align="center">
                  <Text fw={700} size="sm">
                    {DEFAULT_FREE_TRIAL_DAYS}-Day Free Trial Active
                  </Text>
                  <Badge color="dinePrimary" variant="filled" size="xs">
                    {trialDaysLeft} {trialDaysLeft === 1 ? "Day" : "Days"} Remaining
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  Full access to Starter POS counter, digital receipts, and floor tables until {new Date(currentOutlet.trialEndsAt!).toLocaleDateString("en-IN")}. Set up AutoPay or pay to avoid service disruption.
                </Text>
              </div>
            </Group>
            <Group gap="xs">
              <Button
                size="xs"
                color="dinePrimary"
                leftSection={<IconSparkles size={14} />}
                onClick={() => handleStartAutopay()}
                loading={initiatingAutopay}
              >
                Setup AutoPay
              </Button>
              <Button
                size="xs"
                variant="outline"
                color="teal"
                leftSection={<IconCreditCard size={14} />}
                onClick={() => handleStartOneTimePay()}
                loading={initiatingPayment}
              >
                Pay Once
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      {/* 2. Active Outlet License & Subscription Card */}
      <Card withBorder radius="md" p="lg">
        {isAutoPayRevokedActive && (
          <Alert
            color="yellow"
            variant="light"
            icon={<IconAlertCircle size={18} />}
            mb="md"
            title="AutoPay Cancelled — Active Until Expiry"
          >
            Recurring auto-debit has been cancelled and no further deductions will occur. Your subscription remains{" "}
            <strong>fully active with unrestricted access</strong> until{" "}
            <strong>{new Date(currentOutlet.subscriptionExpiresAt).toLocaleDateString("en-IN")}</strong>.
          </Alert>
        )}

        <Group justify="space-between" align="center" mb="lg">
          <div>
            <Group gap="xs" align="center">
              <ThemeIcon size="md" color="dinePrimary" variant="light" radius="md">
                <IconBuildingStore size={18} />
              </ThemeIcon>
              <Title order={4}>{currentOutlet.name} Subscription</Title>
              <Badge size="sm" color="indigo" variant="filled">
                {currentOutlet.planTier || "BASIC"} Plan
              </Badge>
              <Badge size="sm" color={isExpired ? "red" : "teal"} variant="light">
                {isExpired ? "EXPIRED" : (currentOutlet.status || "ACTIVE")}
              </Badge>
              {isAutoPayActive && (
                <Badge size="sm" color="teal" variant="outline" leftSection={<IconCheck size={12} />}>
                  AutoPay Active
                </Badge>
              )}
              {isAutoPayRevokedActive && (
                <Badge size="sm" color="yellow" variant="outline" leftSection={<IconAlertCircle size={12} />}>
                  AutoPay Off (Active until {new Date(currentOutlet.subscriptionExpiresAt).toLocaleDateString("en-IN")})
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              License details, recurring auto-debit, and feature tier for this specific outlet location.
            </Text>
          </div>

          <Group gap="xs">
            <Button
              size="sm"
              color="dinePrimary"
              leftSection={<IconCreditCard size={15} />}
              onClick={() => handleOpenPlanModal()}
            >
              Change Plan
            </Button>
          </Group>
        </Group>

        <Divider mb="lg" />

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          <Paper withBorder p="md" radius="md" bg="gray.0">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">
              Plan & Pricing
            </Text>
            <Group justify="space-between" mb={4}>
              <Text size="sm" c="dimmed">Tier:</Text>
              <Text size="sm" fw={700}>{currentOutlet.planTier || "BASIC"} Plan</Text>
            </Group>
            <Group justify="space-between" mb={4}>
              <Text size="sm" c="dimmed">Monthly Fee:</Text>
              <Text size="sm" fw={700}>₹{monthlyPrice.toLocaleString("en-IN")} / mo</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Billing Frequency:</Text>
              <Text size="sm" fw={600}>{currentOutlet.billingCycle || "MONTHLY"}</Text>
            </Group>
          </Paper>

          <Paper withBorder p="md" radius="md" bg="gray.0">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">
              UPI AutoPay Mandate
            </Text>
            <Group justify="space-between" mb={4}>
              <Text size="sm" c="dimmed">Status:</Text>
              <Badge size="xs" color={isAutoPayActive ? "teal" : "gray"}>
                {isAutoPayActive ? "ACTIVE" : currentOutlet.autopayStatus || "INACTIVE"}
              </Badge>
            </Group>
            {currentOutlet.autopayUmn && (
              <Group justify="space-between" mb={4} wrap="nowrap">
                <Text size="sm" c="dimmed">UMN:</Text>
                <Text size="xs" fw={600} style={{ fontFamily: "monospace" }} truncate>
                  {currentOutlet.autopayUmn}
                </Text>
              </Group>
            )}
            {currentOutlet.nextBillingDate && (
              <Group justify="space-between" mb={6}>
                <Text size="sm" c="dimmed">Next Debit:</Text>
                <Text size="xs" fw={600}>
                  {new Date(currentOutlet.nextBillingDate).toLocaleDateString("en-IN")}
                </Text>
              </Group>
            )}
            <Box mt="xs">
              {isAutoPayActive ? (
                <Button
                  size="compact-xs"
                  color="red"
                  variant="subtle"
                  loading={cancellingOutletId === currentOutlet.id}
                  onClick={() => setCancelConfirmOpened(true)}
                >
                  Cancel AutoPay
                </Button>
              ) : (
                <Group gap={6}>
                  <Button
                    size="compact-xs"
                    color="teal"
                    variant="filled"
                    leftSection={<IconCreditCard size={12} />}
                    loading={initiatingPayment}
                    onClick={() => handleStartOneTimePay(currentOutlet.planTier || "PRO")}
                  >
                    Pay Once
                  </Button>
                  <Button
                    size="compact-xs"
                    color="indigo"
                    variant="light"
                    leftSection={<IconSparkles size={12} />}
                    loading={initiatingAutopay}
                    onClick={() => handleStartAutopay(currentOutlet.planTier || "PRO")}
                  >
                    Setup AutoPay
                  </Button>
                </Group>
              )}
            </Box>
          </Paper>

          <Paper withBorder p="md" radius="md" bg="gray.0">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">
              Branch Location
            </Text>
            <Group justify="space-between" mb={4}>
              <Text size="sm" c="dimmed">Address:</Text>
              <Text size="xs" fw={600} ta="right" maw={160} truncate>
                {currentOutlet.address || "Standard Address"}
              </Text>
            </Group>
            <Group justify="space-between" mb={4}>
              <Text size="sm" c="dimmed">Phone:</Text>
              <Text size="xs" fw={600}>{currentOutlet.phone || "—"}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">UPI Merchant ID:</Text>
              <Text size="xs" fw={600}>{currentOutlet.upiId || "—"}</Text>
            </Group>
          </Paper>
        </SimpleGrid>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mt="lg">
          Currently managing subscription for <strong>{currentOutlet.name}</strong>. To view or manage subscriptions for another outlet, use the branch switcher in the top navigation bar.
        </Alert>
      </Card>

      {/* 3. Available Plans Catalog for Active Outlet */}
      <div>
        <Group justify="space-between" align="flex-end" mb="md" wrap="wrap">
          <div>
            <Title order={4}>Available Plans for {currentOutlet.name}</Title>
            <Text size="xs" c="dimmed">
              Select or upgrade the capability tier for this branch location.
            </Text>
          </div>
        </Group>

        <Grid gap="md">
          {plans.map((p) => {
            const isPro = p.popular;
            const isCurrentForActive = currentOutlet.planTier === p.id;
            return (
              <Grid.Col key={p.id} span={{ base: 12, md: 6 }}>
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
                      Current Plan for {currentOutlet.name}
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

                  <Stack gap="xs" mt="lg">
                    <Button
                      fullWidth
                      color={isCurrentForActive ? "teal" : isPro ? "indigo" : "dinePrimary"}
                      variant={isCurrentForActive ? "light" : isPro ? "filled" : "outline"}
                      disabled={isCurrentForActive}
                      leftSection={isCurrentForActive ? <IconCheck size={14} /> : undefined}
                      onClick={() => handleOpenPlanModal(p.id)}
                    >
                      {isCurrentForActive
                        ? `Active on ${currentOutlet.name}`
                        : `Switch ${currentOutlet.name} to ${p.name}`}
                    </Button>

                    {!isCurrentForActive && (
                      <Group grow gap="xs">
                        <Button
                          size="xs"
                          variant="filled"
                          color="teal"
                          leftSection={<IconCreditCard size={13} />}
                          loading={initiatingPayment}
                          onClick={() => handleStartOneTimePay(p.id)}
                        >
                          Pay Once (₹{p.monthlyPrice.toLocaleString("en-IN")})
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="indigo"
                          leftSection={<IconSparkles size={13} />}
                          loading={initiatingAutopay}
                          onClick={() => handleStartAutopay(p.id)}
                        >
                          AutoPay (₹{p.monthlyPrice.toLocaleString("en-IN")})
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>
            );
          })}
        </Grid>
      </div>

      {/* 4. Invoices & Billing History for Active Outlet */}
      <Card withBorder radius="md" p="lg">
        <Title order={4} mb="xs">
          Tax Invoices for {currentOutlet.name}
        </Title>
        <Text size="xs" c="dimmed" mb="md">
          Official GST invoices and payment receipts generated for this outlet.
        </Text>

        {outletInvoices.length === 0 ? (
          <Paper p="xl" radius="md" ta="center" bg="gray.0">
            <ThemeIcon size={44} radius="xl" color="gray" variant="light" mb="xs">
              <IconReceipt size={22} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              No invoices generated yet for {currentOutlet.name}.
            </Text>
          </Paper>
        ) : (
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
                {outletInvoices.map((inv: any) => (
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
                      <Text size="xs">{inv.outletName || currentOutlet.name}</Text>
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
        )}
      </Card>

      {/* Plan Selection / Upgrade Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs">
            <IconCreditCard size={20} color="#7950f2" />
            <Text fw={700}>Manage {currentOutlet.name} Subscription</Text>
          </Group>
        }
        size="md"
        radius="md"
      >
        <Stack gap="md">
          <Paper p="sm" radius="md" bg="gray.0" withBorder>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Target Branch
                </Text>
                <Text size="sm" fw={700} c="dinePrimary">
                  {currentOutlet.name}
                </Text>
              </div>
              <Badge size="sm" color="indigo" variant="light">
                Current: {currentOutlet.planTier || "BASIC"} Plan
              </Badge>
            </Group>
          </Paper>

          <div>
            <Text size="sm" fw={600} mb="xs">
              Choose Plan Tier for {currentOutlet.name}
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

          {(() => {
            const plan = plans.find((p) => p.id === selectedPlanTier) || plans[0];
            const isSameTierAsCurrent = currentOutlet?.planTier === selectedPlanTier;
            const targetFullAmount = selectedCycle === "ANNUAL"
              ? (isSameTierAsCurrent && currentOutlet?.isCustomPrice && currentOutlet?.annualPrice
                  ? currentOutlet.annualPrice
                  : plan?.annualPrice || (plan?.monthlyPrice || 1499) * 10)
              : (isSameTierAsCurrent && currentOutlet?.isCustomPrice && currentOutlet?.monthlyPrice
                  ? currentOutlet.monthlyPrice
                  : plan?.monthlyPrice || 1499);
            const periodLabel = selectedCycle === "ANNUAL" ? "1 Year" : "1 Month";

            // Option 2 Prorated Credit Calculation:
            const isUpgradeFromStarter = currentOutlet?.planTier === "BASIC" && selectedPlanTier === "PRO";
            const now = Date.now();
            const expiresAt = currentOutlet?.subscriptionExpiresAt ? new Date(currentOutlet.subscriptionExpiresAt).getTime() : 0;
            const hasRemainingTime = expiresAt > now;

            let remainingDays = 0;
            let unusedCredit = 0;
            let payableAmount = targetFullAmount;

            if (isUpgradeFromStarter && hasRemainingTime) {
              const remainingMs = expiresAt - now;
              const totalDaysInCurrent = (currentOutlet?.billingCycle || "MONTHLY") === "ANNUAL" ? 365 : 30;
              remainingDays = Math.min(totalDaysInCurrent, Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))));
              const currentMonthly = currentOutlet?.monthlyPrice || 999;
              const dailyRate = currentMonthly / totalDaysInCurrent;
              unusedCredit = Math.min(targetFullAmount - 1, Math.round(remainingDays * dailyRate));
              payableAmount = Math.max(1, targetFullAmount - unusedCredit);
            }

            return (
              <Stack gap="xs">
                {isUpgradeFromStarter && unusedCredit > 0 && (
                  <Paper withBorder p="sm" radius="md" style={{ backgroundColor: "#e6fcf5", borderColor: "#63e6be" }}>
                    <Group justify="space-between" align="center" mb={4}>
                      <Group gap="xs">
                        <ThemeIcon size="sm" color="teal" variant="filled" radius="xl">
                          <IconCheck size={12} />
                        </ThemeIcon>
                        <Text size="xs" fw={700} c="teal.9">
                          Unused Starter Credit Applied
                        </Text>
                      </Group>
                      <Badge size="xs" color="teal" variant="light">
                        {remainingDays} days remaining
                      </Badge>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Pro Plan Standard ({periodLabel}):</Text>
                      <Text size="xs" fw={600}>₹{targetFullAmount.toLocaleString("en-IN")}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="teal.8">Unused Starter Value Credit:</Text>
                      <Text size="xs" fw={700} c="teal.8">-₹{unusedCredit.toLocaleString("en-IN")}</Text>
                    </Group>
                    <Divider my={4} />
                    <Text size="xs" c="dimmed">
                      Your unused {remainingDays} days of Starter plan are credited immediately today, starting a <strong>fresh 30-day Pro cycle</strong> with zero lost value.
                    </Text>
                  </Paper>
                )}

                <Paper withBorder p="md" radius="md" bg="gray.0">
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        {unusedCredit > 0 ? "Total Payable Today (With Credit)" : `Total Payable (${periodLabel})`}
                      </Text>
                      <Group align="baseline" gap="xs" mt={2}>
                        <Title order={3} c="teal">
                          ₹{payableAmount.toLocaleString("en-IN")}
                        </Title>
                        {unusedCredit > 0 && (
                          <Text size="xs" c="dimmed" td="line-through">
                            ₹{targetFullAmount.toLocaleString("en-IN")}
                          </Text>
                        )}
                      </Group>
                    </div>
                    <Badge size="md" color={selectedCycle === "ANNUAL" ? "orange" : "blue"} variant="light">
                      {selectedCycle === "ANNUAL" ? "Annual (Save 15%)" : "Monthly Billing"}
                    </Badge>
                  </Group>
                </Paper>
              </Stack>
            );
          })()}

          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            Choose <strong>Pay Once</strong> for a single {selectedCycle === "ANNUAL" ? "year" : "month"} without auto-debit, or <strong>Setup AutoPay</strong> for hands-free recurring renewals via UPI.
          </Alert>

          <Group justify="space-between" mt="md" wrap="wrap" gap="xs">
            <Button variant="subtle" color="gray" size="sm" onClick={() => setModalOpened(false)}>
              Cancel
            </Button>
            <Group gap="xs">
              <Button
                variant="default"
                size="sm"
                loading={submitting}
                onClick={handleSavePlan}
              >
                Direct Save (Offline)
              </Button>
              <Button
                variant="light"
                color="indigo"
                size="sm"
                leftSection={<IconSparkles size={16} />}
                loading={initiatingAutopay}
                onClick={() => {
                  setModalOpened(false);
                  handleStartAutopay(selectedPlanTier, selectedCycle);
                }}
              >
                Setup AutoPay
              </Button>
              <Button
                color="teal"
                variant="filled"
                size="sm"
                leftSection={<IconCreditCard size={16} />}
                loading={initiatingPayment}
                onClick={() => {
                  setModalOpened(false);
                  handleStartOneTimePay(selectedPlanTier, selectedCycle);
                }}
              >
                Pay Once (One-Time)
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* One-Time Payment Checkout Modal */}
      <Modal
        opened={paymentModalOpened}
        onClose={() => setPaymentModalOpened(false)}
        title={
          <Group gap="xs">
            <IconCreditCard size={20} color="#12b886" />
            <Text fw={700}>Complete One-Time Subscription Payment</Text>
          </Group>
        }
        size="lg"
        radius="md"
      >
        {paymentData && (
          <Stack gap="md">
            <Alert icon={<IconShieldCheck size={18} />} color="teal" variant="light">
              Pay <strong>₹{paymentData.amount.toLocaleString("en-IN")}</strong> for{" "}
              <strong>{paymentData.outletName}</strong> ({paymentData.planTier} Plan - {paymentData.frequency}).
              No recurring mandate or auto-debit will be set on your bank account.
            </Alert>

            <Paper withBorder p="xs" radius="md" style={{ overflow: "hidden" }}>
              <iframe
                src={`${paymentData.checkoutUrl}?embed=true`}
                style={{
                  width: "100%",
                  height: "580px",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="Logix Payment Gateway Checkout"
              />
            </Paper>

            <Group justify="space-between" align="center">
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => window.open(paymentData.checkoutUrl, "_blank")}
                rightSection={<IconArrowUpRight size={14} />}
              >
                Open in Full Window
              </Button>
              <Button
                color="dinePrimary"
                variant="default"
                size="xs"
                onClick={() => {
                  setPaymentModalOpened(false);
                  loadBilling();
                }}
              >
                Close Checkout
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* AutoPay Mandate Authorization Modal */}
      <Modal
        opened={autopayModalOpened}
        onClose={() => setAutopayModalOpened(false)}
        title={
          <Group gap="xs">
            <IconSparkles size={20} color="#12b886" />
            <Text fw={700}>Authorize UPI AutoPay Mandate</Text>
          </Group>
        }
        size="lg"
        radius="md"
      >
        {autopayData && (
          <Stack gap="md">
            <Alert icon={<IconShieldCheck size={18} />} color="teal" variant="light">
              Authorize a recurring AutoPay mandate of{" "}
              <strong>₹{autopayData.recurringAmount} / {autopayData.frequency.toLowerCase()}</strong> for{" "}
              <strong>{autopayData.outletName}</strong>. You can cancel anytime directly from this dashboard.
            </Alert>

            <Paper withBorder p="xs" radius="md" style={{ overflow: "hidden" }}>
              <iframe
                src={`${autopayData.checkoutUrl}?embed=true`}
                style={{
                  width: "100%",
                  height: "580px",
                  border: "none",
                  borderRadius: "8px",
                }}
                title="UPI AutoPay Mandate Checkout"
              />
            </Paper>

            <Group justify="space-between" align="center">
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => window.open(autopayData.checkoutUrl, "_blank")}
                rightSection={<IconArrowUpRight size={14} />}
              >
                Open in Full Window
              </Button>
              <Button
                color="dinePrimary"
                variant="default"
                size="xs"
                onClick={() => {
                  setAutopayModalOpened(false);
                  loadBilling();
                }}
              >
                Close Checkout
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Cancel AutoPay Confirmation Modal */}
      <Modal
        opened={cancelConfirmOpened}
        onClose={() => setCancelConfirmOpened(false)}
        title={
          <Group gap="xs">
            <IconAlertCircle size={20} color="#f59f00" />
            <Text fw={700}>Cancel UPI AutoPay Mandate</Text>
          </Group>
        }
        radius="md"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to cancel recurring UPI AutoPay for <strong>{currentOutlet?.name}</strong>?
          </Text>

          <Paper withBorder p="sm" radius="md" bg="gray.0">
            <Stack gap="xs">
              <Group gap="xs" align="flex-start" wrap="nowrap">
                <ThemeIcon size="xs" color="teal" variant="light" radius="xl" mt={2}>
                  <IconCheck size={10} />
                </ThemeIcon>
                <Text size="xs">
                  <strong>Access continues until end of paid period:</strong> Your subscription stays active and fully functional until{" "}
                  <strong>
                    {currentOutlet?.subscriptionExpiresAt
                      ? new Date(currentOutlet.subscriptionExpiresAt).toLocaleDateString("en-IN")
                      : "the end of your current cycle"}
                  </strong>.
                </Text>
              </Group>
              <Group gap="xs" align="flex-start" wrap="nowrap">
                <ThemeIcon size="xs" color="teal" variant="light" radius="xl" mt={2}>
                  <IconCheck size={10} />
                </ThemeIcon>
                <Text size="xs">
                  <strong>No further bank deductions:</strong> Your recurring UPI mandate will be cancelled immediately with NPCI and your bank.
                </Text>
              </Group>
              <Group gap="xs" align="flex-start" wrap="nowrap">
                <ThemeIcon size="xs" color="teal" variant="light" radius="xl" mt={2}>
                  <IconCheck size={10} />
                </ThemeIcon>
                <Text size="xs">
                  <strong>Re-enable anytime:</strong> You can pay on-demand or restart AutoPay at any time with no penalty.
                </Text>
              </Group>
            </Stack>
          </Paper>

          <Group justify="flex-end" gap="xs" mt="xs">
            <Button variant="default" size="xs" onClick={() => setCancelConfirmOpened(false)}>
              Keep Subscription
            </Button>
            <Button
              color="red"
              size="xs"
              loading={cancellingOutletId === currentOutlet?.id}
              onClick={handleCancelAutopay}
            >
              Confirm Cancellation
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
