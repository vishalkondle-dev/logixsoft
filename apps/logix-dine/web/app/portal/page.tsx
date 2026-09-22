"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Container,
  Paper,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Badge,
  ThemeIcon,
  Card,
  SimpleGrid,
  Tabs,
  Collapse,
  ActionIcon,
  Avatar,
  TextInput,
  Modal,
  Loader,
  Center,
  Divider,
  Box,
  Tooltip,
} from "@mantine/core";
import {
  IconFlame,
  IconReceipt,
  IconUser,
  IconClock,
  IconHistory,
  IconStar,
  IconCrown,
  IconHeart,
  IconBrandWhatsapp,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconToolsKitchen2,
  IconEdit,
  IconLogout,
  IconCalendar,
  IconMapPin,
  IconCurrencyRupee,
  IconShieldCheck,
  IconShare,
  IconRefresh,
  IconBolt,
  IconNotes,
} from "@tabler/icons-react";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import { notifications } from "@mantine/notifications";
import { useAuth } from "@/lib/auth-context";
import { useCustomerPortal, useUpdateCustomerProfile } from "@/lib/queries";
import { useCustomerSync } from "@/lib/use-customer-sync";
import type { CustomerPortalOrder } from "@/lib/api-client";
import { ActiveOrderCard } from "@/components/portal/active-order-card";

// Format paise to INR string
function formatINR(paise?: number | null): string {
  if (paise == null) return "₹0.00";
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Format date nicely
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function CustomerPortalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") || "active";
  const activeTab = ["active", "past", "profile"].includes(rawTab) ? rawTab : "active";

  const { user, isAuthenticated, isLoading: authLoading, openLoginModal, signOut } = useAuth();
  const [activeOutletIds, setActiveOutletIds] = useState<string[]>([]);

  // Real-time live sync via Cloudflare Durable Object
  const { isConnected, isConnecting } = useCustomerSync(
    isAuthenticated ? user?.phoneNumber : null,
    { activeOutletIds }
  );

  // Auto-refreshes in 0ms real-time via Cloudflare Durable Object (30s fallback only when offline)
  const { data, isLoading: dataLoading, isRefetching, refetch } = useCustomerPortal({
    refetchInterval: isConnected ? false : 30_000,
  });
  const updateProfileMutation = useUpdateCustomerProfile();

  // Profile Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Accordion open states for past orders
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (data?.customer) {
      setEditName(data.customer.name || "");
      setEditEmail(data.customer.email || "");
    } else if (user) {
      setEditName(user.name || "");
      setEditEmail(user.email || "");
    }
  }, [data, user]);

  const handleTabChange = (newTab: string | null) => {
    if (!newTab) return;
    router.push(`/portal?tab=${newTab}`, { scroll: false });
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      notifications.show({
        title: "Name required",
        message: "Please enter your name",
        color: "red",
      });
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name: editName.trim(),
        email: editEmail.trim() || undefined,
      });
      notifications.show({
        title: "Profile Updated",
        message: "Your profile details have been saved successfully.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setIsEditModalOpen(false);
    } catch (err: any) {
      notifications.show({
        title: "Update Failed",
        message: err.message || "Failed to update profile",
        color: "red",
      });
    }
  };

  const shareReceiptWhatsApp = (order: CustomerPortalOrder) => {
    const itemsText = order.items
      .map(
        (it) =>
          `• ${it.name} × ${it.qty} = ₹${((it.pricePaise * it.qty) / 100).toFixed(2)}`
      )
      .join("\n");

    const message = `🧾 *Logix Dine Bill Receipt*
🍽️ *${order.restaurantName}* (${order.outletName})
🎫 Token #${order.tokenNo || "N/A"} | Table: ${order.tableNo}
📅 Date: ${formatDate(order.settledAt || order.createdAt)}
--------------------------------
${itemsText}
--------------------------------
💰 *Total Paid: ${formatINR(order.paidPaise || order.subtotalPaise)}*
💳 Payment: ${order.method || "Cash"}
🙏 Thank you for dining with us!`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const customer = data?.customer;
  const stats = data?.stats;
  const activeOrders = data?.activeOrders || [];
  const pastOrders = data?.pastOrders || [];

  useEffect(() => {
    if (activeOrders.length > 0) {
      const ids = Array.from(new Set(activeOrders.map((o) => o.outletId).filter(Boolean)));
      setActiveOutletIds((prev) => {
        const prevKey = prev.slice().sort().join(",");
        const nextKey = ids.slice().sort().join(",");
        return prevKey === nextKey ? prev : ids;
      });
    }
  }, [activeOrders]);

  // 1. Auth Loading State
  if (authLoading) {
    return (
      <Center py={100} style={{ minHeight: "70vh" }}>
        <Stack align="center" gap="md">
          <Loader size="lg" color="dinePrimary" />
          <Text size="sm" c="dimmed">Loading your dining portal...</Text>
        </Stack>
      </Center>
    );
  }

  // 2. Not Logged In State
  if (!isAuthenticated) {
    return (
      <Container size="sm" py={60}>
        <Paper p={{ base: "lg", sm: "xl" }} radius="xl" withBorder shadow="md" style={{ textAlign: "center", background: "#fff" }}>
          <Stack align="center" gap="lg">
            <ThemeIcon size={72} radius="xl" color="dinePrimary" variant="light">
              <IconBrandWhatsapp size={38} />
            </ThemeIcon>

            <div>
              <Title order={2} style={{ fontSize: "1.75rem", fontWeight: 800 }}>
                Customer Dining Portal
              </Title>
              <Text c="dimmed" size="sm" mt={6} maw={420} mx="auto">
                Sign in with your mobile number to track live dine-in orders, check past bills, and view your VIP loyalty rewards.
              </Text>
            </div>

            <Button
              size="lg"
              color="dinePrimary"
              leftSection={<IconBrandWhatsapp size={22} />}
              onClick={openLoginModal}
              radius="md"
              fullWidth
              maw={320}
            >
              Sign In with WhatsApp OTP
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  const tierBadgeColor =
    customer?.loyaltyTier === "VIP Customer"
      ? "yellow"
      : customer?.loyaltyTier === "Regular Guest"
      ? "blue"
      : "teal";

  const TierIcon =
    customer?.loyaltyTier === "VIP Customer"
      ? IconCrown
      : customer?.loyaltyTier === "Regular Guest"
      ? IconStar
      : IconHeart;

  const isPureVeg = customer?.dietaryPreference === "Pure Vegetarian";
  const isNonVeg = customer?.dietaryPreference === "Non-Veg Lover";

  return (
    <Container size="md" py={{ base: "sm", sm: "lg" }} pb={120}>
      <Stack gap="md">
        {/* ─── Hero / Customer Identity Banner ─── */}
        <Paper
          p={{ base: "md", sm: "lg" }}
          radius="lg"
          withBorder
          style={{
            background: "linear-gradient(135deg, rgba(175, 115, 215, 0.08) 0%, rgba(255, 255, 255, 0.9) 100%)",
            borderColor: "rgba(175, 115, 215, 0.25)",
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="sm" wrap="nowrap">
              <Avatar
                size="lg"
                radius="xl"
                color="dinePrimary"
                style={{
                  border: "2px solid #af73d7",
                  fontWeight: 700,
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {customer?.name ? customer.name.slice(0, 2).toUpperCase() : "G"}
              </Avatar>
              <Box style={{ minWidth: 0 }}>
                <Group gap={8} align="center" wrap="wrap">
                  <Title order={2} style={{ fontSize: "1.25rem", fontWeight: 800 }} lineClamp={1}>
                    {customer?.name || user?.name || "Valued Guest"}
                  </Title>
                  {customer?.loyaltyTier && (
                    <Badge
                      color={tierBadgeColor}
                      variant="filled"
                      size="sm"
                      leftSection={<TierIcon size={12} />}
                      style={{ textTransform: "none", fontWeight: 700 }}
                    >
                      {customer.loyaltyTier}
                    </Badge>
                  )}
                </Group>
                <Group gap={8} align="center" mt={3} wrap="wrap">
                  <Badge
                    color="teal"
                    variant="light"
                    size="xs"
                    leftSection={<IconShieldCheck size={11} />}
                    style={{ textTransform: "none" }}
                  >
                    {customer?.phone || user?.phoneNumber || "Verified"}
                  </Badge>
                  {customer?.dietaryPreference && (
                    <Badge
                      color={isPureVeg ? "green" : isNonVeg ? "red" : "violet"}
                      variant="light"
                      size="xs"
                      leftSection={
                        isPureVeg ? <VegNonVegIcon isNonVeg={false} size={11} /> : isNonVeg ? <VegNonVegIcon isNonVeg={true} size={11} /> : <IconToolsKitchen2 size={11} />
                      }
                      style={{ textTransform: "none" }}
                    >
                      {customer.dietaryPreference}
                    </Badge>
                  )}
                  {isConnected ? (
                    <Badge
                      color="teal"
                      variant="light"
                      size="xs"
                      leftSection={<IconBolt size={11} />}
                      style={{ textTransform: "none" }}
                    >
                      Durable Object Live
                    </Badge>
                  ) : isConnecting ? (
                    <Badge
                      color="yellow"
                      variant="light"
                      size="xs"
                      style={{ textTransform: "none" }}
                    >
                      Connecting DO...
                    </Badge>
                  ) : null}
                </Group>
              </Box>
            </Group>

            <Group gap="xs">
              <Tooltip label="Refresh live data">
                <ActionIcon
                  variant="default"
                  size="md"
                  radius="md"
                  onClick={() => refetch()}
                  loading={isRefetching}
                  aria-label="Refresh orders"
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
              <Button
                variant="light"
                color="dinePrimary"
                size="xs"
                radius="md"
                leftSection={<IconEdit size={14} />}
                onClick={() => setIsEditModalOpen(true)}
              >
                <Text span visibleFrom="xs">Edit Profile</Text>
                <Text span hiddenFrom="xs">Edit</Text>
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* ─── Navigation Tabs ─── */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="pills"
          radius="xl"
          color="dinePrimary"
          styles={{
            list: {
              background: "rgba(0,0,0,0.03)",
              padding: 4,
              borderRadius: 9999,
              border: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "nowrap",
            },
            tab: {
              fontWeight: 600,
              fontSize: 13,
              flex: 1,
              justifyContent: "center",
              padding: "6px 8px",
            },
          }}
        >
          <Tabs.List>
            <Tabs.Tab
              value="active"
              leftSection={<IconFlame size={16} color={activeTab === "active" ? "#fff" : "#e67700"} />}
              rightSection={
                activeOrders.length > 0 ? (
                  <Badge size="xs" circle color="orange">
                    {activeOrders.length}
                  </Badge>
                ) : null
              }
            >
              <Text span visibleFrom="xs">Active Orders</Text>
              <Text span hiddenFrom="xs">Active</Text>
            </Tabs.Tab>
            <Tabs.Tab
              value="past"
              leftSection={<IconHistory size={16} />}
              rightSection={
                pastOrders.length > 0 ? (
                  <Badge size="xs" circle variant="light" color="dinePrimary">
                    {pastOrders.length}
                  </Badge>
                ) : null
              }
            >
              <Text span visibleFrom="xs">Past Orders</Text>
              <Text span hiddenFrom="xs">Past</Text>
            </Tabs.Tab>
            <Tabs.Tab value="profile" leftSection={<IconUser size={16} />}>
              <Text span visibleFrom="xs">My Profile</Text>
              <Text span hiddenFrom="xs">Profile</Text>
            </Tabs.Tab>
          </Tabs.List>

          {/* ══════════════════════════════════════════════════════════
              TAB 1: ACTIVE ORDERS
             ══════════════════════════════════════════════════════════ */}
          <Tabs.Panel value="active" pt="md">
            {dataLoading ? (
              <Center py={60}>
                <Loader size="md" color="dinePrimary" />
              </Center>
            ) : activeOrders.length === 0 ? (
              <Paper p="xl" radius="lg" withBorder style={{ textAlign: "center", background: "#fff" }}>
                <Stack align="center" gap="sm">
                  <ThemeIcon size={56} radius="xl" color="orange" variant="light">
                    <IconToolsKitchen2 size={30} />
                  </ThemeIcon>
                  <Title order={3} style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                    No Active Orders Right Now
                  </Title>
                  <Text c="dimmed" size="sm" maw={420} mx="auto">
                    You don't have any ongoing dine-in or takeaway orders. When you order at any outlet with your mobile number, live item tracking and bill updates will appear here automatically!
                  </Text>
                  <Button
                    variant="light"
                    color="dinePrimary"
                    size="sm"
                    mt="xs"
                    onClick={() => handleTabChange("past")}
                    leftSection={<IconHistory size={16} />}
                  >
                    View Order History ({pastOrders.length})
                  </Button>
                </Stack>
              </Paper>
            ) : (
              <Stack gap="md">
                <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                  <Group gap={6} align="center">
                    <Box
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: isConnected ? "#2b8a3e" : isConnecting ? "#f59f00" : "#868e96",
                        boxShadow: isConnected ? "0 0 0 3px rgba(43, 138, 62, 0.25)" : "none",
                        animation: isConnected ? "pulse 2s infinite" : "none",
                      }}
                    />
                    <Text fw={700} size="sm" c={isConnected ? "green.8" : "dimmed"}>
                      Live Kitchen Tracking ({activeOrders.length} Active {activeOrders.length === 1 ? "Order" : "Orders"})
                    </Text>
                  </Group>
                  <Badge
                    color={isConnected ? "teal" : isConnecting ? "yellow" : "gray"}
                    variant="light"
                    size="xs"
                    leftSection={<IconBolt size={11} />}
                    style={{ textTransform: "none" }}
                  >
                    {isConnected ? "Durable Object Live Sync" : isConnecting ? "Connecting Live..." : "Offline"}
                  </Badge>
                </Group>

                {activeOrders.map((order) => (
                  <ActiveOrderCard
                    key={order.id}
                    order={order}
                    onRefresh={refetch}
                  />
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          {/* ══════════════════════════════════════════════════════════
              TAB 2: PAST ORDERS
             ══════════════════════════════════════════════════════════ */}
          <Tabs.Panel value="past" pt="md">
            {dataLoading ? (
              <Center py={60}>
                <Loader size="md" color="dinePrimary" />
              </Center>
            ) : pastOrders.length === 0 ? (
              <Paper p="xl" radius="lg" withBorder style={{ textAlign: "center", background: "#fff" }}>
                <Stack align="center" gap="sm">
                  <ThemeIcon size={56} radius="xl" color="gray" variant="light">
                    <IconReceipt size={30} />
                  </ThemeIcon>
                  <Title order={3} style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                    No Past Orders Found
                  </Title>
                  <Text c="dimmed" size="sm" maw={420} mx="auto">
                    You haven't settled any dining bills yet. When your active orders are paid and settled, your full receipts and itemized history will be preserved here.
                  </Text>
                </Stack>
              </Paper>
            ) : (
              <Stack gap="sm">
                {/* Stats Header Bar */}
                <Paper p="sm" radius="md" withBorder style={{ background: "#fdfbff" }}>
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Group gap="xs">
                      <ThemeIcon size="md" radius="xl" color="dinePrimary" variant="light">
                        <IconReceipt size={16} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed" fw={600}>
                          Total Completed Visits
                        </Text>
                        <Text size="sm" fw={800}>
                          {pastOrders.length} {pastOrders.length === 1 ? "Visit" : "Visits"}
                        </Text>
                      </div>
                    </Group>
                    <Box style={{ textAlign: "right" }}>
                      <Text size="xs" c="dimmed" fw={600}>
                        Total Settled Spend
                      </Text>
                      <Text size="sm" fw={800} style={{ color: "#af73d7" }}>
                        {formatINR(stats?.lifetimeSpendPaise)}
                      </Text>
                    </Box>
                  </Group>
                </Paper>

                {/* Orders List */}
                {pastOrders.map((order) => {
                  const isExpanded = !!expandedOrders[order.id];
                  const totalPaid = order.paidPaise || order.subtotalPaise || 0;

                  return (
                    <Card
                      key={order.id}
                      radius="md"
                      withBorder
                      p={0}
                      style={{
                        background: "#fff",
                        overflow: "hidden",
                        borderColor: isExpanded ? "#af73d7" : "rgba(0,0,0,0.08)",
                        transition: "border-color 0.2s ease",
                      }}
                    >
                      {/* Collapsed Header Bar */}
                      <Box
                        p="sm"
                        onClick={() => toggleOrderExpand(order.id)}
                        style={{
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                          {/* Left Details */}
                          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                            <Box style={{ minWidth: 0 }}>
                              <Group gap={6} align="center" wrap="wrap">
                                <Text fw={700} size="sm" lineClamp={1}>
                                  {order.restaurantName}
                                </Text>
                                <Badge size="xs" variant="light" color="gray">
                                  {order.outletName}
                                </Badge>
                              </Group>

                              <Group gap={6} mt={2} align="center" wrap="wrap">
                                <Text size="xs" c="dimmed">
                                  {formatDate(order.settledAt || order.createdAt)}
                                </Text>
                                <Text size="xs" c="dimmed">•</Text>
                                <Text size="xs" c="dimmed">
                                  Token #{order.tokenNo || "—"}
                                </Text>
                                <Text size="xs" c="dimmed">•</Text>
                                <Badge size="xs" color="gray" variant="outline">
                                  {order.tableNo}
                                </Badge>
                                <Badge size="xs" color="green" variant="light">
                                  {order.method || "Paid"}
                                </Badge>
                              </Group>
                            </Box>
                          </Group>

                          {/* Right Amount + Chevron */}
                          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                            <Box style={{ textAlign: "right" }}>
                              <Text fw={800} size="sm" style={{ color: "#2f9e44" }}>
                                {formatINR(totalPaid)}
                              </Text>
                              <Text size="10px" c="dimmed">
                                {order.itemsCount} {order.itemsCount === 1 ? "item" : "items"}
                              </Text>
                            </Box>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="gray"
                              aria-label="Toggle details"
                            >
                              {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Box>

                      {/* Expanded Section */}
                      <Collapse expanded={isExpanded}>
                        <Box
                          p="sm"
                          style={{
                            backgroundColor: "rgba(175, 115, 215, 0.04)",
                            borderTop: "1px solid rgba(0,0,0,0.06)",
                          }}
                        >
                          <Stack gap="xs">
                            <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase" }}>
                              Itemized Receipt
                            </Text>

                            {order.note && (
                              <Paper p="xs" radius="xs" style={{ backgroundColor: "rgba(175, 115, 215, 0.08)", border: "1px dashed #af73d7" }}>
                                <Group gap={6} align="flex-start" wrap="nowrap">
                                  <IconNotes size={13} color="#af73d7" style={{ marginTop: 2, flexShrink: 0 }} />
                                  <Text size="xs" c="dark.4">
                                    <strong style={{ color: "#af73d7" }}>Order Note:</strong> {order.note}
                                  </Text>
                                </Group>
                              </Paper>
                            )}

                            {order.items.map((item) => (
                              <Group key={item.id} justify="space-between" align="flex-start">
                                <Group gap="xs" wrap="nowrap" align="flex-start">
                                  <Box style={{ flexShrink: 0, marginTop: 3 }}>
                                    <VegNonVegIcon isNonVeg={item.isNonVeg} size={12} />
                                  </Box>
                                  <Badge size="xs" circle color="gray" variant="light" style={{ flexShrink: 0 }}>
                                    {item.qty}
                                  </Badge>
                                  <div>
                                    <Text size="xs" fw={500}>
                                      {item.name}
                                    </Text>
                                    {item.note && (
                                      <Text size="10px" fw={600} c="yellow.9" style={{ fontStyle: "italic" }}>
                                        Note: {item.note}
                                      </Text>
                                    )}
                                  </div>
                                </Group>
                                <Text size="xs" fw={600} style={{ flexShrink: 0 }}>
                                  {formatINR(item.pricePaise * item.qty)}
                                </Text>
                              </Group>
                            ))}

                            <Divider my={4} />

                            <Group justify="space-between" align="center">
                              <Text size="xs" fw={600} c="dimmed">
                                Total Paid via {order.method || "Cash"}
                              </Text>
                              <Text size="sm" fw={800} c="green.8">
                                {formatINR(totalPaid)}
                              </Text>
                            </Group>

                            <Group justify="flex-end" mt="xs">
                              <Button
                                size="xs"
                                variant="light"
                                color="teal"
                                leftSection={<IconBrandWhatsapp size={14} />}
                                onClick={() => shareReceiptWhatsApp(order)}
                              >
                                Share Receipt via WhatsApp
                              </Button>
                            </Group>
                          </Stack>
                        </Box>
                      </Collapse>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Tabs.Panel>

          {/* ══════════════════════════════════════════════════════════
              TAB 3: MY PROFILE
             ══════════════════════════════════════════════════════════ */}
          <Tabs.Panel value="profile" pt="md">
            <Stack gap="md">
              {/* Profile Card */}
              <Paper p={{ base: "sm", sm: "md" }} radius="md" withBorder style={{ background: "#fff" }}>
                <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                  <Group gap="sm" wrap="nowrap">
                    <Avatar size="lg" radius="xl" color="dinePrimary">
                      {customer?.name ? customer.name.slice(0, 2).toUpperCase() : "G"}
                    </Avatar>
                    <Box>
                      <Text fw={800} size="md">
                        {customer?.name || "Customer"}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {customer?.phone || user?.phoneNumber}
                      </Text>
                      {customer?.email && (
                        <Text size="xs" c="dimmed">
                          {customer.email}
                        </Text>
                      )}
                    </Box>
                  </Group>

                  <Button
                    size="xs"
                    variant="default"
                    leftSection={<IconEdit size={14} />}
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    Edit Name & Email
                  </Button>
                </Group>
              </Paper>

              {/* Loyalty & Dining Preference Badges */}
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    <ThemeIcon size="lg" radius="md" color={tierBadgeColor} variant="light">
                      <TierIcon size={20} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed" fw={600}>
                        Loyalty Status
                      </Text>
                      <Text size="md" fw={800}>
                        {customer?.loyaltyTier || "New Guest"}
                      </Text>
                      <Text size="xs" c="dimmed" mt={2}>
                        {customer?.loyaltyTier === "VIP Customer"
                          ? "Top-tier guest with priority table service and exclusive perks."
                          : customer?.loyaltyTier === "Regular Guest"
                          ? "Frequent diner! Keep visiting to reach VIP tier."
                          : "Welcome! Complete 3 orders to unlock Regular Guest rewards."}
                      </Text>
                    </div>
                  </Group>
                </Paper>

                <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    <ThemeIcon
                      size="lg"
                      radius="md"
                      color={isPureVeg ? "green" : isNonVeg ? "red" : "violet"}
                      variant="light"
                    >
                      {isPureVeg ? <VegNonVegIcon isNonVeg={false} size={18} /> : isNonVeg ? <VegNonVegIcon isNonVeg={true} size={18} /> : <IconToolsKitchen2 size={20} />}
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed" fw={600}>
                        Dietary Preference
                      </Text>
                      <Text size="md" fw={800}>
                        {customer?.dietaryPreference || "Mixed Dining"}
                      </Text>
                      <Text size="xs" c="dimmed" mt={2}>
                        Calculated from your food orders ({stats?.vegItemsCount || 0} veg, {stats?.nonVegItemsCount || 0} non-veg items).
                      </Text>
                    </div>
                  </Group>
                </Paper>
              </SimpleGrid>

              {/* Statistics Grid */}
              <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
                <Text fw={700} size="sm" mb="sm" c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Your Dining Summary
                </Text>
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                  <Box p="xs" style={{ background: "rgba(175, 115, 215, 0.06)", borderRadius: 8 }}>
                    <Text size="xs" c="dimmed" fw={600}>
                      Lifetime Spend
                    </Text>
                    <Text size="md" fw={800} style={{ color: "#af73d7" }}>
                      {formatINR(stats?.lifetimeSpendPaise)}
                    </Text>
                  </Box>

                  <Box p="xs" style={{ background: "rgba(0,0,0,0.03)", borderRadius: 8 }}>
                    <Text size="xs" c="dimmed" fw={600}>
                      Total Orders
                    </Text>
                    <Text size="md" fw={800}>
                      {stats?.totalOrdersCount || 0}
                    </Text>
                  </Box>

                  <Box p="xs" style={{ background: "rgba(43, 138, 62, 0.08)", borderRadius: 8 }}>
                    <Text size="xs" c="green.8" fw={600}>
                      Veg Items
                    </Text>
                    <Text size="md" fw={800} c="green.9">
                      {stats?.vegItemsCount || 0}
                    </Text>
                  </Box>

                  <Box p="xs" style={{ background: "rgba(224, 49, 49, 0.08)", borderRadius: 8 }}>
                    <Text size="xs" c="red.8" fw={600}>
                      Non-Veg Items
                    </Text>
                    <Text size="md" fw={800} c="red.9">
                      {stats?.nonVegItemsCount || 0}
                    </Text>
                  </Box>
                </SimpleGrid>
              </Paper>

              {/* Favorite Dishes */}
              {stats?.favoriteDishes && stats.favoriteDishes.length > 0 && (
                <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
                  <Text fw={700} size="sm" mb="sm" c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Your Most Ordered Dishes
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    {stats.favoriteDishes.map((dish, idx) => (
                      <Paper key={dish.name} p="xs" withBorder radius="sm" style={{ background: "#fdfdfd" }}>
                        <Group justify="space-between" align="center" wrap="nowrap">
                          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                            <VegNonVegIcon isNonVeg={dish.isNonVeg} size={14} />
                            <Box style={{ minWidth: 0 }}>
                              <Text size="xs" fw={700} lineClamp={1}>
                                {dish.name}
                              </Text>
                              <Text size="10px" c="dimmed">
                                Ordered {dish.qty} {dish.qty === 1 ? "time" : "times"}
                              </Text>
                            </Box>
                          </Group>
                          <Text size="xs" fw={700} style={{ flexShrink: 0, color: "#af73d7" }}>
                            {formatINR(dish.totalSpendPaise)}
                          </Text>
                        </Group>
                      </Paper>
                    ))}
                  </SimpleGrid>
                </Paper>
              )}

              {/* Sign Out Card */}
              <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
                <Group justify="space-between" align="center">
                  <div>
                    <Text size="sm" fw={700}>
                      Session Security
                    </Text>
                    <Text size="xs" c="dimmed">
                      You are signed in via your verified mobile number.
                    </Text>
                  </div>
                  <Button
                    color="red"
                    variant="light"
                    size="xs"
                    leftSection={<IconLogout size={14} />}
                    onClick={() => signOut()}
                  >
                    Sign Out
                  </Button>
                </Group>
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Edit Profile Modal */}
      <Modal
        opened={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={<Text fw={700}>Edit Customer Profile</Text>}
        radius="md"
        centered
      >
        <form onSubmit={handleUpdateProfile}>
          <Stack gap="md">
            <TextInput
              label="Full Name"
              placeholder="e.g. Vishal Kondle"
              required
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
            />
            <TextInput
              label="Email Address (Optional)"
              placeholder="e.g. name@example.com"
              type="email"
              description="For receiving digital invoices and billing updates."
              value={editEmail}
              onChange={(e) => setEditEmail(e.currentTarget.value)}
            />
            <TextInput
              label="Phone Number"
              disabled
              value={customer?.phone || user?.phoneNumber || ""}
              description="Phone number is verified and tied to your WhatsApp account."
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button color="dinePrimary" type="submit" loading={updateProfileMutation.isPending}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}

export default function CustomerPortalPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader size="lg" color="dinePrimary" />
        </Center>
      }
    >
      <CustomerPortalInner />
    </Suspense>
  );
}
