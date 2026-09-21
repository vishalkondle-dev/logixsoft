"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  ActionIcon,
  Grid,
  ThemeIcon,
  Tabs,
  Table,
  Box,
  Divider,
  Loader,
  Center,
  Card,
  SimpleGrid,
  Textarea,
  Modal,
  CopyButton,
  Tooltip,
  SegmentedControl,
  RingProgress,
  Progress,
  Collapse,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconBrandWhatsapp,
  IconPhone,
  IconCopy,
  IconCheck,
  IconShoppingCart,
  IconReceipt,
  IconClock,
  IconCalendar,
  IconToolsKitchen2,
  IconCash,
  IconChevronDown,
  IconChevronUp,
  IconStar,
  IconHeartHandshake,
  IconNotes,
  IconChartBar,
  IconSend,
  IconBuildingStore,
  IconSoup,
  IconTag,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useCustomerProfile,
  useUpdateCustomerNotes,
  useSendCustomerWhatsApp,
} from "@/lib/queries";

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const rawParam = params?.mobile_number;
  const mobileNumber = Array.isArray(rawParam) ? rawParam[0] : (rawParam as string);

  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id || "";

  // Outlet scope filter: "current" (activeOutlet.id) vs "all" (null)
  const [scopeMode, setScopeMode] = useState<"current" | "all">("current");
  const selectedOutletId = scopeMode === "current" ? activeOutlet?.id || null : null;

  // Fetch customer profile
  const { data: profile, isLoading, isError, refetch } = useCustomerProfile(
    restaurantId,
    mobileNumber,
    selectedOutletId
  );

  // Notes state
  const [staffNotes, setStaffNotes] = useState<string>("");
  const [notesInitialized, setNotesInitialized] = useState<boolean>(false);
  const [newTagInput, setNewTagInput] = useState<string>("");
  const [customTags, setCustomTags] = useState<string[]>([]);

  // WhatsApp Modal state
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappSending, setWhatsappSending] = useState(false);

  // Expandable orders state
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>("ALL");

  // Mutations
  const updateNotesMutation = useUpdateCustomerNotes(restaurantId, mobileNumber);
  const sendWhatsAppMutation = useSendCustomerWhatsApp(restaurantId, mobileNumber);

  // Initialize staff notes when profile loads
  if (profile && !notesInitialized) {
    setStaffNotes(profile.customer.notes || "");
    setCustomTags(profile.customer.tags || []);
    setNotesInitialized(true);
  }

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleSaveNotes = async () => {
    try {
      await updateNotesMutation.mutateAsync({
        body: { notes: staffNotes, tags: customTags },
        outletId: selectedOutletId,
      });
      notifications.show({
        title: "Notes Saved",
        message: "Customer notes & tags have been saved successfully.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Failed to save",
        message: err.message || "Could not save notes",
        color: "red",
      });
    }
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    if (!customTags.includes(trimmed)) {
      setCustomTags([...customTags, trimmed]);
    }
    setNewTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setCustomTags(customTags.filter((t) => t !== tagToRemove));
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappMessage.trim()) return;
    setWhatsappSending(true);
    try {
      await sendWhatsAppMutation.mutateAsync({
        message: whatsappMessage,
        outletId: selectedOutletId,
      });
      notifications.show({
        title: "WhatsApp Sent",
        message: `Message sent to ${profile?.customer?.phone || mobileNumber}`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setWhatsappModalOpen(false);
      setWhatsappMessage("");
    } catch (err: any) {
      notifications.show({
        title: "Delivery Failed",
        message: err.message || "Could not send WhatsApp message",
        color: "red",
      });
    } finally {
      setWhatsappSending(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "N/A";
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (isoString?: string | null) => {
    if (!isoString) return "N/A";
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    if (!profile?.orders) return [];
    if (orderFilterStatus === "ALL") return profile.orders;
    if (orderFilterStatus === "PAID") return profile.orders.filter((o) => o.status === "PAID");
    if (orderFilterStatus === "OPEN") return profile.orders.filter((o) => o.status === "OPEN");
    if (orderFilterStatus === "DINE_IN") return profile.orders.filter((o) => o.tableNo.toLowerCase() !== "takeaway");
    if (orderFilterStatus === "TAKEAWAY") return profile.orders.filter((o) => o.tableNo.toLowerCase() === "takeaway");
    return profile.orders;
  }, [profile?.orders, orderFilterStatus]);

  if (isLoading) {
    return (
      <Center py={120}>
        <Stack align="center" gap="sm">
          <Loader size="lg" color="dinePrimary" />
          <Text size="sm" c="dimmed">
            Loading customer profile for {mobileNumber}...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (isError || !profile) {
    return (
      <Container size="md" py="xl">
        <Paper p="xl" radius="md" withBorder style={{ textAlign: "center" }}>
          <Stack align="center" gap="md">
            <ThemeIcon size={64} radius="xl" color="red" variant="light">
              <IconNotes size={32} />
            </ThemeIcon>
            <Title order={3}>Customer Not Found</Title>
            <Text size="sm" c="dimmed" maw={500}>
              Could not find any order records or profile for mobile number <b>{mobileNumber}</b> in this restaurant.
            </Text>
            <Group gap="sm">
              <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => router.back()}>
                Go Back
              </Button>
              <Button
                color="dinePrimary"
                leftSection={<IconShoppingCart size={16} />}
                onClick={() => router.push(`/pos?phone=${encodeURIComponent(mobileNumber)}`)}
              >
                Create First Order in POS
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    );
  }

  const { customer, metrics, overallChainMetrics, favoriteItems } = profile;
  const rawCleanPhone = customer.rawPhone || mobileNumber;

  // Determine loyalty badge info
  const isVip = customer.tags.includes("VIP Customer");
  const isRegular = customer.tags.includes("Regular Customer");
  const isNew = customer.tags.includes("New Customer");

  return (
    <Box
      style={{
        boxSizing: "border-box",
        minHeight: "calc(100dvh - var(--app-shell-header-offset, 60px))",
        backgroundColor: "#f8f9fa",
      }}
      px={{ base: "xs", sm: "md", md: "lg" }}
      py="md"
    >
      <Stack gap="md" maw={1400} mx="auto">
        {/* Top Header Bar */}
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="sm" align="center">
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              onClick={() => router.back()}
              aria-label="Go back"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Box>
              <Group gap="xs" align="center">
                <Title order={2} style={{ fontSize: 22, fontWeight: 700 }}>
                  Customer Profile
                </Title>
                <Badge
                  size="md"
                  variant="light"
                  color={isVip ? "yellow" : isRegular ? "blue" : "teal"}
                  leftSection={isVip ? <IconStar size={12} /> : undefined}
                >
                  {isVip ? "VIP Customer" : isRegular ? "Regular Guest" : isNew ? "New Guest" : "Customer"}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Detailed customer history & dining analytics
              </Text>
            </Box>
          </Group>

          {/* Scope & Quick Actions */}
          <Group gap="sm" wrap="wrap">
            {/* Scope Switcher */}
            <SegmentedControl
              size="xs"
              radius="md"
              value={scopeMode}
              onChange={(val) => setScopeMode(val as "current" | "all")}
              data={[
                {
                  value: "current",
                  label: (
                    <Group gap={5} wrap="nowrap">
                      <IconBuildingStore size={14} />
                      <span>{activeOutlet?.name || "This Outlet"}</span>
                    </Group>
                  ),
                },
                {
                  value: "all",
                  label: (
                    <Group gap={5} wrap="nowrap">
                      <span>All Outlets</span>
                    </Group>
                  ),
                },
              ]}
            />

            {/* Start POS Order */}
            <Button
              color="dinePrimary"
              size="sm"
              radius="md"
              leftSection={<IconShoppingCart size={16} />}
              onClick={() => router.push(`/pos?phone=${encodeURIComponent(rawCleanPhone)}`)}
            >
              Start Order in POS
            </Button>

            {/* Direct WhatsApp Message */}
            <Button
              color="green"
              variant="filled"
              size="sm"
              radius="md"
              leftSection={<IconBrandWhatsapp size={16} />}
              onClick={() => {
                setWhatsappMessage(
                  `Hello from ${restaurant?.name || "Logix Dine"}! Thank you for dining with us. We appreciate your patronage!`
                );
                setWhatsappModalOpen(true);
              }}
            >
              WhatsApp
            </Button>

            {/* Direct Phone Call */}
            <Button
              component="a"
              href={`tel:+91${rawCleanPhone}`}
              variant="default"
              size="sm"
              radius="md"
              leftSection={<IconPhone size={16} />}
            >
              Call
            </Button>
          </Group>
        </Group>

        {/* ─── 1. Customer Hero Identity Card ────────────────────────────── */}
        <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
          <Grid align="center" gap="md">
            {/* Left: Avatar & Basic Info */}
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Group gap="md" align="center" wrap="nowrap">
                <Box
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    backgroundColor: isVip ? "#fff8e1" : "#e8f5e9",
                    border: `2px solid ${isVip ? "#ffd54f" : "#a5d6a7"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isVip ? "#f57f17" : "#2e7d32",
                    fontSize: 22,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {customer.name ? customer.name.slice(0, 2).toUpperCase() : rawCleanPhone.slice(-2)}
                </Box>

                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" align="center">
                    <Title order={3} style={{ fontSize: 18, fontWeight: 700 }}>
                      {customer.name || `Guest (${rawCleanPhone})`}
                    </Title>
                    {customer.email && (
                      <Text size="xs" c="dimmed">
                        • {customer.email}
                      </Text>
                    )}
                  </Group>

                  {/* Phone with Copy Button */}
                  <Group gap={6} align="center" mt={3}>
                    <Text size="sm" fw={600} c="dark.6">
                      {customer.phone}
                    </Text>
                    <CopyButton value={rawCleanPhone} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? "Copied" : "Copy phone number"} withArrow position="right">
                          <ActionIcon color={copied ? "teal" : "gray"} variant="subtle" size="sm" onClick={copy}>
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>

                  {/* Badges / Tags */}
                  <Group gap={6} mt={6} wrap="wrap">
                    {customer.tags.map((tag) => (
                      <Badge key={tag} size="sm" variant="outline" color={tag.includes("VIP") ? "yellow" : "teal"}>
                        {tag}
                      </Badge>
                    ))}

                    {/* Dietary Preference Badge */}
                    <Badge
                      size="sm"
                      variant="light"
                      color={
                        metrics.dietaryPreference.primary === "Veg"
                          ? "green"
                          : metrics.dietaryPreference.primary === "Non-Veg"
                          ? "red"
                          : "orange"
                      }
                    >
                      {metrics.dietaryPreference.primary === "Veg"
                        ? "🌱 Pure Vegetarian"
                        : metrics.dietaryPreference.primary === "Non-Veg"
                        ? "🍗 Non-Veg Lover"
                        : "🥗 Mixed Dining"}
                    </Badge>

                    {/* Preferred Dining Mode */}
                    <Badge size="sm" variant="dot" color="blue">
                      {metrics.preferredDineMode === "Dine-In"
                        ? `🍽️ Dine-In (${metrics.dineInCount})`
                        : `🛍️ Takeaway (${metrics.takeawayCount})`}
                    </Badge>
                  </Group>
                </Box>
              </Group>
            </Grid.Col>

            {/* Right: Visit Timeline Snippet */}
            <Grid.Col span={{ base: 12, md: 5 }}>
              <SimpleGrid cols={2} spacing="xs">
                <Box p="xs" style={{ backgroundColor: "#f8f9fa", borderRadius: 8 }}>
                  <Text size="xs" c="dimmed">
                    First Visit
                  </Text>
                  <Text size="xs" fw={700} c="dark.7">
                    {formatShortDate(metrics.firstVisitAt)}
                  </Text>
                </Box>
                <Box p="xs" style={{ backgroundColor: "#f8f9fa", borderRadius: 8 }}>
                  <Text size="xs" c="dimmed">
                    Last Visit
                  </Text>
                  <Text size="xs" fw={700} c="dark.7">
                    {formatShortDate(metrics.lastVisitAt)}
                    {metrics.daysSinceLastVisit !== null && (
                      <span style={{ fontWeight: 400, color: "#868e96", marginLeft: 4 }}>
                        ({metrics.daysSinceLastVisit === 0 ? "Today" : `${metrics.daysSinceLastVisit}d ago`})
                      </span>
                    )}
                  </Text>
                </Box>
                <Box p="xs" style={{ backgroundColor: "#f8f9fa", borderRadius: 8 }}>
                  <Text size="xs" c="dimmed">
                    Visit Frequency
                  </Text>
                  <Text size="xs" fw={700} c="dark.7">
                    {metrics.visitFrequencyDays ? `Every ~${metrics.visitFrequencyDays} days` : "Single Visit"}
                  </Text>
                </Box>
                <Box p="xs" style={{ backgroundColor: "#f8f9fa", borderRadius: 8 }}>
                  <Text size="xs" c="dimmed">
                    Favorite Table
                  </Text>
                  <Text size="xs" fw={700} c="dark.7">
                    {metrics.preferredTable || (metrics.takeawayCount > 0 ? "Takeaway" : "N/A")}
                  </Text>
                </Box>
              </SimpleGrid>
            </Grid.Col>
          </Grid>
        </Paper>

        {/* ─── 2. Key Performance Indicators (6 Stat Cards) ─────────────── */}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
          {/* Lifetime Spend */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Lifetime Spend
              </Text>
              <ThemeIcon size={24} radius="md" color="teal" variant="light">
                <IconCash size={14} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 19, fontWeight: 700, color: "#2b8a3e" }}>
              ₹{(metrics.lifetimeSpendPaise / 100).toLocaleString("en-IN")}
            </Title>
            <Text size="10px" c="dimmed" mt={2}>
              {scopeMode === "current"
                ? `Total Chain: ₹${(overallChainMetrics.totalChainSpendPaise / 100).toLocaleString("en-IN")}`
                : "Across all settled orders"}
            </Text>
          </Paper>

          {/* Total Orders / Visits */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Total Orders
              </Text>
              <ThemeIcon size={24} radius="md" color="blue" variant="light">
                <IconReceipt size={14} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 19, fontWeight: 700 }}>
              {metrics.totalOrdersCount}
            </Title>
            <Text size="10px" c="dimmed" mt={2}>
              {metrics.completedOrdersCount} paid • {metrics.openOrdersCount} active
            </Text>
          </Paper>

          {/* Average Order Value (AOV) */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Avg Order Value
              </Text>
              <ThemeIcon size={24} radius="md" color="violet" variant="light">
                <IconChartBar size={14} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 19, fontWeight: 700 }}>
              ₹{(metrics.averageOrderValuePaise / 100).toFixed(0)}
            </Title>
            <Text size="10px" c="dimmed" mt={2}>
              Per settled bill
            </Text>
          </Paper>

          {/* Highest Bill */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Highest Bill
              </Text>
              <ThemeIcon size={24} radius="md" color="yellow" variant="light">
                <IconStar size={14} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 19, fontWeight: 700 }}>
              ₹{(metrics.highestOrderPaise / 100).toFixed(0)}
            </Title>
            <Text size="10px" c="dimmed" mt={2}>
              Max single order
            </Text>
          </Paper>

          {/* Preferred Payment */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Payment Mode
              </Text>
              <ThemeIcon size={24} radius="md" color="cyan" variant="light">
                <IconReceipt size={14} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 18, fontWeight: 700 }}>
              {metrics.preferredPaymentMethod || "Cash"}
            </Title>
            <Text size="10px" c="dimmed" mt={2}>
              {metrics.paymentMethodsBreakdown.length > 1
                ? `${metrics.paymentMethodsBreakdown.length} modes used`
                : "Primary choice"}
            </Text>
          </Paper>

          {/* Dining Type Ratio */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Dine-In vs Takeaway
              </Text>
              <ThemeIcon size={24} radius="md" color="orange" variant="light">
                <IconToolsKitchen2 size={14} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 18, fontWeight: 700 }}>
              {metrics.dineInCount} : {metrics.takeawayCount}
            </Title>
            <Text size="10px" c="dimmed" mt={2}>
              {metrics.preferredDineMode} preferred
            </Text>
          </Paper>
        </SimpleGrid>

        {/* ─── 3. Detailed Tabs Section ───────────────────────────────────── */}
        <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
          <Tabs defaultValue="orders" color="dinePrimary">
            <Tabs.List mb="md">
              <Tabs.Tab value="orders" leftSection={<IconReceipt size={16} />}>
                Order History ({metrics.totalOrdersCount})
              </Tabs.Tab>
              <Tabs.Tab value="favorites" leftSection={<IconSoup size={16} />}>
                Favorite Dishes ({favoriteItems.length})
              </Tabs.Tab>
              <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
                Dining Preferences & Outlets
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                Staff Notes & Requests
              </Tabs.Tab>
            </Tabs.List>

            {/* ─── TAB 1: ORDER HISTORY ────────────────────────────────────── */}
            <Tabs.Panel value="orders">
              <Stack gap="sm">
                {/* Orders Filter Row */}
                <Group justify="space-between" align="center" wrap="wrap">
                  <SegmentedControl
                    size="xs"
                    radius="md"
                    value={orderFilterStatus}
                    onChange={setOrderFilterStatus}
                    data={[
                      { label: `All (${profile.orders.length})`, value: "ALL" },
                      { label: "Paid", value: "PAID" },
                      { label: "Open", value: "OPEN" },
                      { label: "Dine-In", value: "DINE_IN" },
                      { label: "Takeaway", value: "TAKEAWAY" },
                    ]}
                  />
                  <Text size="xs" c="dimmed">
                    Showing {filteredOrders.length} of {profile.orders.length} orders
                  </Text>
                </Group>

                {filteredOrders.length === 0 ? (
                  <Center py={60}>
                    <Text size="sm" c="dimmed">
                      No orders found matching the selected filter.
                    </Text>
                  </Center>
                ) : (
                  <Stack gap="xs">
                    {filteredOrders.map((order) => {
                      const isExpanded = Boolean(expandedOrders[order.id]);
                      const isTakeaway = order.tableNo.toLowerCase() === "takeaway";

                      return (
                        <Paper
                          key={order.id}
                          p="sm"
                          radius="md"
                          withBorder
                          style={{
                            backgroundColor: order.status === "PAID" ? "#ffffff" : "#fffdf5",
                            borderColor: order.status === "PAID" ? "#e9ecef" : "#ffe066",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {/* Order Summary Row */}
                          <Group justify="space-between" align="center" wrap="wrap">
                            <Group gap="sm" align="center">
                              <Box>
                                <Group gap={6} align="center">
                                  <Text fw={700} size="sm">
                                    Token #{order.orderNo}
                                  </Text>
                                  <Badge
                                    size="xs"
                                    variant="light"
                                    color={
                                      order.status === "PAID"
                                        ? "green"
                                        : order.status === "OPEN"
                                        ? "orange"
                                        : "gray"
                                    }
                                  >
                                    {order.status}
                                  </Badge>
                                  <Badge size="xs" variant="outline" color={isTakeaway ? "gray" : "blue"}>
                                    {isTakeaway ? "Takeaway" : `Table ${order.tableNo}`}
                                  </Badge>
                                  <Badge size="xs" variant="default">
                                    {order.outletName}
                                  </Badge>
                                </Group>
                                <Text size="11px" c="dimmed" mt={2}>
                                  {formatDate(order.createdAt)}
                                </Text>
                              </Box>
                            </Group>

                            <Group gap="md" align="center">
                              {/* Payment Info */}
                              <Box style={{ textAlign: "right" }}>
                                <Text fw={700} size="md" c={order.status === "PAID" ? "green.8" : "dark.8"}>
                                  ₹{((order.subtotalPaise || 0) / 100).toFixed(0)}
                                </Text>
                                <Text size="10px" c="dimmed">
                                  {order.itemsCount} items • {order.method || "Cash"}
                                </Text>
                              </Box>

                              {/* Expand/Collapse Toggle */}
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="sm"
                                onClick={() => toggleOrderExpand(order.id)}
                                aria-label="Expand order details"
                              >
                                {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                              </ActionIcon>
                            </Group>
                          </Group>

                          {/* Expandable Order Items Details */}
                          <Collapse expanded={isExpanded}>
                            <Box mt="sm" pt="xs" style={{ borderTop: "1px solid #f1f3f5" }}>
                              <Table verticalSpacing={4} style={{ fontSize: 12 }}>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>Item</Table.Th>
                                    <Table.Th style={{ textAlign: "center" }}>Qty</Table.Th>
                                    <Table.Th style={{ textAlign: "right" }}>Price</Table.Th>
                                    <Table.Th style={{ textAlign: "right" }}>Total</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {order.items.map((it) => (
                                    <Table.Tr key={it.id}>
                                      <Table.Td>
                                        <Text size="xs" fw={600}>
                                          {it.name}
                                        </Text>
                                        {it.variant && (
                                          <Text size="10px" c="dimmed">
                                            Variant: {it.variant.name}
                                          </Text>
                                        )}
                                        {it.addons && it.addons.length > 0 && (
                                          <Text size="10px" c="dimmed">
                                            Addons: {it.addons.map((a: any) => a.name).join(", ")}
                                          </Text>
                                        )}
                                        {it.note && (
                                          <Text size="10px" c="orange.7" fs="italic">
                                            Note: {it.note}
                                          </Text>
                                        )}
                                      </Table.Td>
                                      <Table.Td style={{ textAlign: "center" }}>
                                        <Badge size="xs" variant="light" color="gray">
                                          ×{it.qty}
                                        </Badge>
                                      </Table.Td>
                                      <Table.Td style={{ textAlign: "right" }}>
                                        ₹{(it.pricePaise / 100).toFixed(0)}
                                      </Table.Td>
                                      <Table.Td style={{ textAlign: "right", fontWeight: 600 }}>
                                        ₹{((it.pricePaise * it.qty) / 100).toFixed(0)}
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>

                              {/* Order Footnote & Actions */}
                              <Group justify="space-between" align="center" mt="xs" pt="xs">
                                <Text size="11px" c="dimmed">
                                  Order ID: <code style={{ fontSize: 10 }}>{order.id}</code>
                                </Text>
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="green"
                                  leftSection={<IconBrandWhatsapp size={14} />}
                                  onClick={() => {
                                    setWhatsappMessage(
                                      `Receipt for Order #${order.orderNo} from ${restaurant?.name || "Logix Dine"}:\nTotal: ₹${(
                                        (order.subtotalPaise || 0) / 100
                                      ).toFixed(0)}\nStatus: ${order.status}\nThank you!`
                                    );
                                    setWhatsappModalOpen(true);
                                  }}
                                >
                                  Share Receipt
                                </Button>
                              </Group>
                            </Box>
                          </Collapse>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Stack>
            </Tabs.Panel>

            {/* ─── TAB 2: FAVORITE DISHES ──────────────────────────────────── */}
            <Tabs.Panel value="favorites">
              {favoriteItems.length === 0 ? (
                <Center py={60}>
                  <Text size="sm" c="dimmed">
                    No favorite dish data available yet.
                  </Text>
                </Center>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                  {favoriteItems.map((item, idx) => (
                    <Paper key={item.itemId || item.name} p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Group gap="xs" align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
                          {/* Veg/Non-Veg icon */}
                          <Box
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 3,
                              border: `1.5px solid ${item.isNonVeg ? "#c62828" : "#2e7d32"}`,
                              backgroundColor: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              marginTop: 3,
                              flexShrink: 0,
                            }}
                          >
                            <Box
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                backgroundColor: item.isNonVeg ? "#c62828" : "#2e7d32",
                              }}
                            />
                          </Box>

                          <Box style={{ minWidth: 0 }}>
                            <Text size="sm" fw={700} lineClamp={1}>
                              {item.name}
                            </Text>
                            <Text size="xs" c="dimmed" mt={1}>
                              Ordered {item.qty} times across {item.orderCount} visits
                            </Text>
                          </Box>
                        </Group>

                        <Badge size="xs" variant="filled" color={idx === 0 ? "yellow" : idx === 1 ? "gray" : "teal"}>
                          #{idx + 1}
                        </Badge>
                      </Group>

                      <Divider my="xs" />

                      <Group justify="space-between" align="center">
                        <Text size="xs" c="dimmed">
                          Total Spent:
                        </Text>
                        <Text size="xs" fw={700} c="green.8">
                          ₹{(item.totalSpendPaise / 100).toLocaleString("en-IN")}
                        </Text>
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
              )}
            </Tabs.Panel>

            {/* ─── TAB 3: DINING PREFERENCES & OUTLETS ──────────────────────── */}
            <Tabs.Panel value="analytics">
              <Grid gap="md">
                {/* Dietary Distribution */}
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                    <Title order={4} style={{ fontSize: 15, fontWeight: 700 }}>
                      Dietary Preference Breakdown
                    </Title>
                    <Text size="xs" c="dimmed" mb="md">
                      Ratio of Vegetarian to Non-Vegetarian items ordered
                    </Text>

                    <Group justify="space-between" mb={4}>
                      <Text size="xs" fw={600} c="green.8">
                        🌱 Veg: {metrics.dietaryPreference.vegCount} items
                      </Text>
                      <Text size="xs" fw={600} c="red.8">
                        🍗 Non-Veg: {metrics.dietaryPreference.nonVegCount} items
                      </Text>
                    </Group>

                    {metrics.dietaryPreference.totalDishes > 0 ? (
                      <Progress.Root size="xl" radius="md">
                        <Progress.Section
                          value={
                            (metrics.dietaryPreference.vegCount / metrics.dietaryPreference.totalDishes) * 100
                          }
                          color="green"
                        >
                          <Progress.Label>
                            {Math.round(
                              (metrics.dietaryPreference.vegCount / metrics.dietaryPreference.totalDishes) * 100
                            )}
                            %
                          </Progress.Label>
                        </Progress.Section>
                        <Progress.Section
                          value={
                            (metrics.dietaryPreference.nonVegCount / metrics.dietaryPreference.totalDishes) * 100
                          }
                          color="red"
                        >
                          <Progress.Label>
                            {Math.round(
                              (metrics.dietaryPreference.nonVegCount / metrics.dietaryPreference.totalDishes) * 100
                            )}
                            %
                          </Progress.Label>
                        </Progress.Section>
                      </Progress.Root>
                    ) : (
                      <Text size="xs" c="dimmed">
                        No food items recorded.
                      </Text>
                    )}
                  </Paper>
                </Grid.Col>

                {/* Payment Methods */}
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                    <Title order={4} style={{ fontSize: 15, fontWeight: 700 }}>
                      Payment Methods Used
                    </Title>
                    <Text size="xs" c="dimmed" mb="sm">
                      Settlement channels preferred by this guest
                    </Text>

                    <Stack gap="xs">
                      {metrics.paymentMethodsBreakdown.map((pm) => (
                        <Group key={pm.method} justify="space-between" align="center">
                          <Group gap="xs">
                            <Badge size="sm" variant="light" color="blue">
                              {pm.method}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {pm.count} bills
                            </Text>
                          </Group>
                          <Text size="xs" fw={700}>
                            ₹{(pm.totalPaise / 100).toLocaleString("en-IN")}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                </Grid.Col>

                {/* Outlet Distribution */}
                <Grid.Col span={12}>
                  <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                    <Title order={4} style={{ fontSize: 15, fontWeight: 700 }}>
                      Cross-Outlet Activity
                    </Title>
                    <Text size="xs" c="dimmed" mb="sm">
                      Customer visit summary across all branches in {restaurant?.name || "the restaurant"}
                    </Text>

                    <Table verticalSpacing="xs" style={{ fontSize: 12 }}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Outlet Branch</Table.Th>
                          <Table.Th style={{ textAlign: "center" }}>Orders Count</Table.Th>
                          <Table.Th style={{ textAlign: "right" }}>Total Revenue</Table.Th>
                          <Table.Th style={{ textAlign: "right" }}>Last Visit Date</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {overallChainMetrics.outletBreakdown.map((ob) => (
                          <Table.Tr key={ob.outletId}>
                            <Table.Td fw={600}>
                              <Group gap="xs">
                                <IconBuildingStore size={15} color="#228be6" />
                                <span>{ob.outletName}</span>
                              </Group>
                            </Table.Td>
                            <Table.Td style={{ textAlign: "center" }}>
                              <Badge size="xs" variant="light" color="blue">
                                {ob.ordersCount} orders
                              </Badge>
                            </Table.Td>
                            <Table.Td style={{ textAlign: "right", fontWeight: 700, color: "#2b8a3e" }}>
                              ₹{(ob.totalSpendPaise / 100).toLocaleString("en-IN")}
                            </Table.Td>
                            <Table.Td style={{ textAlign: "right", color: "#868e96" }}>
                              {formatShortDate(ob.lastVisit)}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Tabs.Panel>

            {/* ─── TAB 4: STAFF NOTES & REQUESTS ──────────────────────────── */}
            <Tabs.Panel value="notes">
              <Stack gap="md" maw={800}>
                <Box>
                  <Title order={4} style={{ fontSize: 16, fontWeight: 700 }}>
                    Customer Notes & Special Preferences
                  </Title>
                  <Text size="xs" c="dimmed">
                    Notes saved here are visible to staff across POS and Orders to provide personalized hospitality.
                  </Text>
                </Box>

                <Textarea
                  placeholder="e.g. Prefers window table, allergic to peanuts, likes extra spicy dishes, friend of owner..."
                  minRows={4}
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  size="sm"
                  radius="md"
                />

                {/* Tag Management */}
                <Box>
                  <Text size="xs" fw={600} mb="xs">
                    Customer Tags:
                  </Text>
                  <Group gap="xs" mb="xs" wrap="wrap">
                    {customTags.map((tag) => (
                      <Badge
                        key={tag}
                        size="md"
                        variant="light"
                        color="blue"
                        rightSection={
                          <ActionIcon
                            size="xs"
                            color="blue"
                            radius="xl"
                            variant="transparent"
                            onClick={() => handleRemoveTag(tag)}
                          >
                            ×
                          </ActionIcon>
                        }
                      >
                        {tag}
                      </Badge>
                    ))}
                  </Group>

                  <Group gap="xs">
                    <input
                      type="text"
                      placeholder="Add custom tag (e.g. VIP, Corporate, Regular)..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      style={{
                        padding: "6px 12px",
                        fontSize: 13,
                        borderRadius: 6,
                        border: "1px solid #ced4da",
                        outline: "none",
                        width: 250,
                      }}
                    />
                    <Button size="xs" variant="default" onClick={handleAddTag}>
                      Add Tag
                    </Button>
                  </Group>
                </Box>

                <Group justify="flex-start">
                  <Button
                    color="dinePrimary"
                    size="sm"
                    radius="md"
                    loading={updateNotesMutation.isPending}
                    onClick={handleSaveNotes}
                    leftSection={<IconCheck size={16} />}
                  >
                    Save Notes & Preferences
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Stack>

      {/* ─── WHATSAPP MODAL ────────────────────────────────────────────── */}
      <Modal
        opened={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="green" size="md" radius="md">
              <IconBrandWhatsapp size={16} />
            </ThemeIcon>
            <Text fw={700}>Send WhatsApp Message</Text>
          </Group>
        }
        radius="md"
        size="md"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Directly message <b>{customer.phone}</b> via OpenWA:
          </Text>

          {/* Quick template chips */}
          <Group gap={6} wrap="wrap">
            <Badge
              size="xs"
              variant="outline"
              style={{ cursor: "pointer" }}
              onClick={() =>
                setWhatsappMessage(
                  `Hello from ${restaurant?.name || "Logix Dine"}! Thank you for visiting us today. We hope you enjoyed your meal!`
                )
              }
            >
              Thank You Note
            </Badge>
            <Badge
              size="xs"
              variant="outline"
              style={{ cursor: "pointer" }}
              onClick={() =>
                setWhatsappMessage(
                  `Special Offer from ${restaurant?.name || "Logix Dine"}! Enjoy 10% off on your next dining experience with code WELCOME10.`
                )
              }
            >
              Special Offer
            </Badge>
            <Badge
              size="xs"
              variant="outline"
              style={{ cursor: "pointer" }}
              onClick={() =>
                setWhatsappMessage(
                  `Hi! We would love to hear your feedback on your recent meal at ${restaurant?.name || "Logix Dine"}. Please rate us!`
                )
              }
            >
              Feedback Request
            </Badge>
          </Group>

          <Textarea
            minRows={4}
            value={whatsappMessage}
            onChange={(e) => setWhatsappMessage(e.target.value)}
            placeholder="Type your WhatsApp message..."
            size="sm"
            radius="md"
          />

          <Group justify="flex-end" gap="sm" mt="xs">
            <Button variant="default" size="xs" onClick={() => setWhatsappModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="green"
              size="xs"
              leftSection={<IconSend size={14} />}
              loading={whatsappSending}
              onClick={handleSendWhatsApp}
            >
              Send WhatsApp
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
