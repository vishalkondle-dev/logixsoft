"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
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
  Table,
  Box,
  Divider,
  Loader,
  Center,
  SimpleGrid,
  Textarea,
  Modal,
  CopyButton,
  Tooltip,
  SegmentedControl,
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
  IconPlus,
  IconReceiptOff,
  IconSparkles,
  IconFlame,
  IconLeaf,
  IconMeat,
  IconSalad,
  IconMotorbike,
  IconShoppingBag,
  IconBriefcase,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useCustomerProfile,
  useUpdateCustomerNotes,
  useSendCustomerWhatsApp,
} from "@/lib/queries";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";

const DAYS_OF_WEEK = [
  { day: "Sunday", short: "Sun" },
  { day: "Monday", short: "Mon" },
  { day: "Tuesday", short: "Tue" },
  { day: "Wednesday", short: "Wed" },
  { day: "Thursday", short: "Thu" },
  { day: "Friday", short: "Fri" },
  { day: "Saturday", short: "Sat" },
];

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const rawParam = params?.mobile_number;
  const mobileNumber = Array.isArray(rawParam) ? rawParam[0] : (rawParam as string);

  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id || "";

  // Outlet scope filter: strictly scoped to active outlet
  const selectedOutletId = activeOutlet?.id || null;

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

  const toggleOrderExpand = (orderId: string, currentExpanded: boolean) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !currentExpanded }));
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
    if (orderFilterStatus === "DELIVERY") {
      return profile.orders.filter(
        (o) => o.orderType === "DELIVERY" || (o.tableNo || "").toLowerCase() === "delivery"
      );
    }
    if (orderFilterStatus === "TAKEAWAY") {
      return profile.orders.filter(
        (o) =>
          o.orderType !== "DELIVERY" &&
          (o.tableNo || "").toLowerCase() !== "delivery" &&
          ((o.tableNo || "").toLowerCase() === "takeaway" || o.orderType === "TAKEAWAY")
      );
    }
    if (orderFilterStatus === "DINE_IN") {
      return profile.orders.filter(
        (o) =>
          o.orderType !== "DELIVERY" &&
          (o.tableNo || "").toLowerCase() !== "delivery" &&
          (o.tableNo || "").toLowerCase() !== "takeaway" &&
          o.orderType !== "TAKEAWAY"
      );
    }
    return profile.orders;
  }, [profile?.orders, orderFilterStatus]);

  // Compute Visited Days Breakdown (combines API data with client calculation fallback)
  const visitedDaysData = useMemo(() => {
    if (profile?.metrics?.visitedDaysBreakdown && profile.metrics.visitedDaysBreakdown.length > 0) {
      return {
        breakdown: profile.metrics.visitedDaysBreakdown,
        mostVisitedDay: profile.metrics.mostVisitedDay || null,
        mostVisitedDayCount: profile.metrics.mostVisitedDayCount || 0,
      };
    }

    const counts: Record<string, number> = {
      Sunday: 0,
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
    };

    const orders = profile?.orders || [];
    let validCount = 0;
    orders.forEach((o) => {
      if (o.createdAt) {
        const d = new Date(o.createdAt);
        const dayName = DAYS_OF_WEEK[d.getDay()]?.day;
        if (dayName) {
          counts[dayName] = (counts[dayName] || 0) + 1;
          validCount++;
        }
      }
    });

    let topDay: string | null = null;
    let maxCount = 0;
    Object.entries(counts).forEach(([day, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topDay = day;
      }
    });

    const breakdown = DAYS_OF_WEEK.map(({ day, short }) => ({
      day,
      short,
      count: counts[day] || 0,
      percentage: validCount > 0 ? Math.round(((counts[day] || 0) / validCount) * 100) : 0,
    }));

    return {
      breakdown,
      mostVisitedDay: topDay,
      mostVisitedDayCount: maxCount,
    };
  }, [profile?.metrics?.visitedDaysBreakdown, profile?.metrics?.mostVisitedDay, profile?.metrics?.mostVisitedDayCount, profile?.orders]);

  // Determine dining habit from visited days (Weekend vs Weekday pattern)
  const diningHabitInsight = useMemo(() => {
    const { breakdown } = visitedDaysData;
    const weekendCount = (breakdown.find((d) => d.day === "Saturday")?.count || 0) +
      (breakdown.find((d) => d.day === "Sunday")?.count || 0) +
      (breakdown.find((d) => d.day === "Friday")?.count || 0);
    const totalCount = breakdown.reduce((sum, d) => sum + d.count, 0);

    if (totalCount === 0) return null;
    if (weekendCount / totalCount >= 0.6) {
      return {
        label: "Weekend Regular",
        description: "Visits predominantly on Fridays, Saturdays & Sundays",
        color: "violet",
        badge: "Weekend Regular",
        icon: IconCalendarEvent,
      };
    }
    if (weekendCount / totalCount <= 0.3) {
      return {
        label: "Weekday Diner",
        description: "Visits predominantly on Monday through Thursday",
        color: "blue",
        badge: "Weekday Guest",
        icon: IconBriefcase,
      };
    }
    return {
      label: "Balanced Diner",
      description: "Visits evenly distributed throughout the week",
      color: "teal",
      badge: "All-Week Guest",
      icon: IconSparkles,
    };
  }, [visitedDaysData]);

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
      <Box p="xl" maw={600} mx="auto">
        <Paper p="xl" radius="md" withBorder style={{ textAlign: "center" }}>
          <Stack align="center" gap="md">
            <ThemeIcon size={64} radius="xl" color="red" variant="light">
              <IconNotes size={32} />
            </ThemeIcon>
            <Title order={3}>Customer Not Found</Title>
            <Text size="sm" c="dimmed">
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
      </Box>
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
      pb={{ base: 120, sm: "xl" }}
    >
      <Stack gap="lg" maw={1440} mx="auto">
        {/* ─── 1. TOP HEADER & QUICK ACTIONS ────────────────────────────── */}
        <Box>
          <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
            {/* Left: Back button & Title */}
            <Group gap="xs" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
              <ActionIcon
                variant="default"
                size="lg"
                radius="md"
                onClick={() => router.back()}
                aria-label="Go back"
                style={{ flexShrink: 0 }}
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Box style={{ minWidth: 0 }}>
                <Group gap="xs" align="center" wrap="nowrap">
                  <Title
                    order={2}
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Customer 360° Profile
                  </Title>
                  <Badge
                    size="sm"
                    variant="light"
                    color={isVip ? "yellow" : isRegular ? "blue" : "teal"}
                    leftSection={isVip ? <IconStar size={12} /> : undefined}
                    visibleFrom="sm"
                  >
                    {isVip ? "VIP Customer" : isRegular ? "Regular Guest" : isNew ? "New Guest" : "Customer"}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" lineClamp={1} visibleFrom="sm">
                  Complete dining routine, order history, favorite dishes & hospitality notes
                </Text>
              </Box>
            </Group>

            {/* Desktop Actions (sm+) */}
            <Group gap="sm" wrap="nowrap" visibleFrom="sm">
              {/* Active Outlet Scope Badge */}
              <Badge
                size="md"
                variant="light"
                color="dinePrimary"
                leftSection={<IconBuildingStore size={14} />}
              >
                {activeOutlet?.name || "Active Outlet"}
              </Badge>

              <Button
                color="dinePrimary"
                size="sm"
                radius="md"
                leftSection={<IconShoppingCart size={16} />}
                onClick={() => router.push(`/pos?phone=${encodeURIComponent(rawCleanPhone)}`)}
              >
                Start Order in POS
              </Button>

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

            {/* Mobile Actions (Icons only, hiddenFrom="sm") */}
            <Group gap={6} align="center" wrap="nowrap" hiddenFrom="sm" style={{ flexShrink: 0 }}>
              <Tooltip label="Start Order in POS" position="bottom" withArrow>
                <ActionIcon
                  color="dinePrimary"
                  variant="filled"
                  size="lg"
                  radius="md"
                  onClick={() => router.push(`/pos?phone=${encodeURIComponent(rawCleanPhone)}`)}
                  aria-label="Start Order in POS"
                >
                  <IconShoppingCart size={18} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="WhatsApp Customer" position="bottom" withArrow>
                <ActionIcon
                  color="green"
                  variant="filled"
                  size="lg"
                  radius="md"
                  onClick={() => {
                    setWhatsappMessage(
                      `Hello from ${restaurant?.name || "Logix Dine"}! Thank you for dining with us. We appreciate your patronage!`
                    );
                    setWhatsappModalOpen(true);
                  }}
                  aria-label="WhatsApp Customer"
                >
                  <IconBrandWhatsapp size={18} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Call Customer" position="bottom" withArrow>
                <ActionIcon
                  component="a"
                  href={`tel:+91${rawCleanPhone}`}
                  variant="default"
                  size="lg"
                  radius="md"
                  aria-label="Call Customer"
                >
                  <IconPhone size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {/* Mobile Scope Switcher Bar */}
          <Group justify="space-between" align="center" mt="xs" hiddenFrom="sm">
            <Badge
              size="sm"
              variant="light"
              color="dinePrimary"
              leftSection={<IconBuildingStore size={12} />}
            >
              {activeOutlet?.name || "Active Outlet"}
            </Badge>
            <Badge
              size="sm"
              variant="light"
              color={isVip ? "yellow" : isRegular ? "blue" : "teal"}
              leftSection={isVip ? <IconStar size={12} /> : undefined}
            >
              {isVip ? "VIP Customer" : isRegular ? "Regular Guest" : isNew ? "New Guest" : "Customer"}
            </Badge>
          </Group>
        </Box>

        {/* ─── 2. HERO SECTION: IDENTITY & STAFF NOTES ─────────────────── */}
        <Grid gap="md" align="stretch">
          {/* Left: Customer Identity & Visit Timeline */}
          <Grid.Col span={{ base: 12, lg: 7.5 }}>
            <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff", height: "100%" }}>
              <Stack gap="md" justify="space-between" style={{ height: "100%" }}>
                {/* Header Identity */}
                <Group gap="md" align="flex-start" wrap="nowrap">
                  <Box
                    style={{
                      borderRadius: 16,
                      backgroundColor: isVip ? "#fff8e1" : "#e8f5e9",
                      border: `2px solid ${isVip ? "#ffd54f" : "#a5d6a7"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isVip ? "#f57f17" : "#2e7d32",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                    w={{ base: 56, sm: 68 }}
                    h={{ base: 56, sm: 68 }}
                    fz={{ base: 20, sm: 24 }}
                  >
                    {customer.name ? customer.name.slice(0, 2).toUpperCase() : rawCleanPhone.slice(-2)}
                  </Box>

                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" align="center" wrap="wrap">
                      <Title order={3} style={{ fontSize: 18, fontWeight: 700 }}>
                        {customer.name || `Guest (${rawCleanPhone})`}
                      </Title>
                      {customer.email && (
                        <Text size="xs" c="dimmed">
                          • {customer.email}
                        </Text>
                      )}
                    </Group>

                    {/* Phone with One-Click Copy */}
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

                    {/* Dining Persona Badges */}
                    <Group gap={6} mt={8} wrap="wrap">
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
                        leftSection={
                          metrics.dietaryPreference.primary === "Veg" ? (
                            <IconLeaf size={12} />
                          ) : metrics.dietaryPreference.primary === "Non-Veg" ? (
                            <IconMeat size={12} />
                          ) : (
                            <IconSalad size={12} />
                          )
                        }
                      >
                        {metrics.dietaryPreference.primary === "Veg"
                          ? "Pure Vegetarian"
                          : metrics.dietaryPreference.primary === "Non-Veg"
                          ? "Non-Veg Lover"
                          : "Mixed Dining"}
                      </Badge>

                      {/* Preferred Dining Mode */}
                      <Badge
                        size="sm"
                        variant="dot"
                        color={
                          metrics.preferredDineMode === "Delivery"
                            ? "teal"
                            : metrics.preferredDineMode === "Dine-In"
                            ? "blue"
                            : "gray"
                        }
                        leftSection={
                          metrics.preferredDineMode === "Delivery" ? (
                            <IconMotorbike size={12} />
                          ) : metrics.preferredDineMode === "Dine-In" ? (
                            <IconToolsKitchen2 size={12} />
                          ) : (
                            <IconShoppingBag size={12} />
                          )
                        }
                      >
                        {metrics.preferredDineMode === "Delivery"
                          ? `Delivery (${metrics.deliveryCount || 0})`
                          : metrics.preferredDineMode === "Dine-In"
                          ? `Dine-In (${metrics.dineInCount})`
                          : `Takeaway (${metrics.takeawayCount})`}
                      </Badge>

                      {/* Dining Habit Badge */}
                      {diningHabitInsight && (
                        <Badge
                          size="sm"
                          variant="outline"
                          color={diningHabitInsight.color}
                          leftSection={<diningHabitInsight.icon size={12} />}
                        >
                          {diningHabitInsight.badge}
                        </Badge>
                      )}

                      {/* Custom Tags */}
                      {customer.tags
                        .filter((tag) => {
                          const l = tag.toLowerCase();
                          return (
                            !l.includes("veg") &&
                            !l.includes("takeaway") &&
                            !l.includes("dine-in") &&
                            !l.includes("delivery") &&
                            !l.includes("vip") &&
                            !l.includes("regular") &&
                            !l.includes("new customer")
                          );
                        })
                        .map((tag) => (
                          <Badge key={tag} size="sm" variant="outline" color="teal">
                            {tag}
                          </Badge>
                        ))}
                    </Group>
                  </Box>
                </Group>

                {/* 4 Quick Visit Insights */}
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mt="xs">
                  <Box p="xs" style={{ backgroundColor: "#f8f9fa", borderRadius: 8, border: "1px solid #f1f3f5" }}>
                    <Text size="11px" c="dimmed">
                      First Visit
                    </Text>
                    <Text size="xs" fw={700} c="dark.7" mt={2}>
                      {formatShortDate(metrics.firstVisitAt)}
                    </Text>
                  </Box>

                  <Box p="xs" style={{ backgroundColor: "#f8f9fa", borderRadius: 8, border: "1px solid #f1f3f5" }}>
                    <Text size="11px" c="dimmed">
                      Last Visit
                    </Text>
                    <Text size="xs" fw={700} c="dark.7" mt={2}>
                      {formatShortDate(metrics.lastVisitAt)}
                      {metrics.daysSinceLastVisit !== null && (
                        <span style={{ fontWeight: 500, color: "#868e96", marginLeft: 4 }}>
                          ({metrics.daysSinceLastVisit === 0 ? "Today" : `${metrics.daysSinceLastVisit}d ago`})
                        </span>
                      )}
                    </Text>
                  </Box>

                  <Box p="xs" style={{ backgroundColor: "#f8f9fa", borderRadius: 8, border: "1px solid #f1f3f5" }}>
                    <Text size="11px" c="dimmed">
                      Visit Frequency
                    </Text>
                    <Text size="xs" fw={700} c="dark.7" mt={2}>
                      {metrics.visitFrequencyDays ? `Every ~${metrics.visitFrequencyDays} days` : "Single Visit"}
                    </Text>
                  </Box>

                  <Box p="xs" style={{ backgroundColor: "#f8f9fa", borderRadius: 8, border: "1px solid #f1f3f5" }}>
                    <Text size="11px" c="dimmed">
                      Favorite Table
                    </Text>
                    <Text size="xs" fw={700} c="dark.7" mt={2}>
                      {metrics.preferredTable
                        ? `Table ${metrics.preferredTable}`
                        : metrics.dineInCount > 0
                        ? "Dine-In"
                        : (metrics.deliveryCount || 0) > 0 && metrics.takeawayCount > 0
                        ? "Delivery & Takeaway"
                        : (metrics.deliveryCount || 0) > 0
                        ? "Delivery Only"
                        : metrics.takeawayCount > 0
                        ? "Takeaway Only"
                        : "N/A"}
                    </Text>
                  </Box>
                </SimpleGrid>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* Right: Staff Notes & Quick Hospitality Tags */}
          <Grid.Col span={{ base: 12, lg: 4.5 }}>
            <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff", height: "100%" }}>
              <Stack gap="xs" justify="space-between" style={{ height: "100%" }}>
                <div>
                  <Group justify="space-between" align="center" mb={4}>
                    <Group gap={6} align="center">
                      <ThemeIcon size={22} radius="md" color="violet" variant="light">
                        <IconNotes size={13} />
                      </ThemeIcon>
                      <Text fw={700} size="sm">
                        Staff Notes & Preferences
                      </Text>
                    </Group>
                    {staffNotes.trim().length > 0 && (
                      <Badge size="xs" color="teal" variant="light">
                        Active Note
                      </Badge>
                    )}
                  </Group>

                  <Text size="11px" c="dimmed" mb="xs">
                    Visible to POS servers to ensure personalized customer care.
                  </Text>

                  <Textarea
                    placeholder="e.g. Likes extra spicy, prefers window corner, allergic to peanuts, close family friend..."
                    minRows={2}
                    maxRows={4}
                    autosize
                    value={staffNotes}
                    onChange={(e) => setStaffNotes(e.target.value)}
                    size="xs"
                    radius="sm"
                    mb="xs"
                  />

                  {/* Tag Chips */}
                  <Group gap={5} mb="xs" wrap="wrap">
                    {customTags.map((tag) => (
                      <Badge
                        key={tag}
                        size="sm"
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

                  {/* Add Tag Input */}
                  <Group gap={6} wrap="nowrap">
                    <input
                      type="text"
                      placeholder="Add tag (e.g. VIP, Corporate)..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      style={{
                        padding: "5px 10px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid #ced4da",
                        outline: "none",
                        flex: 1,
                        minWidth: 0,
                      }}
                    />
                    <Button size="xs" variant="default" onClick={handleAddTag}>
                      <IconPlus size={13} style={{ marginRight: 3 }} /> Add
                    </Button>
                  </Group>
                </div>

                <Button
                  color="dinePrimary"
                  size="xs"
                  radius="md"
                  fullWidth
                  loading={updateNotesMutation.isPending}
                  onClick={handleSaveNotes}
                  leftSection={<IconCheck size={14} />}
                >
                  Save Notes & Tags
                </Button>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* ─── 3. KPI STATS RIBBON (7 CARDS) ────────────────────────────── */}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 7 }} spacing={{ base: "xs", sm: "sm" }}>
          {/* 1. Lifetime Spend */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Lifetime Spend
              </Text>
              <ThemeIcon size={22} radius="md" color="teal" variant="light">
                <IconCash size={13} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 18, fontWeight: 700, color: "#2b8a3e" }}>
              ₹{(metrics.lifetimeSpendPaise / 100).toLocaleString("en-IN")}
            </Title>
            <Text size="10px" c="dimmed" mt={2} lineClamp={1}>
              At {activeOutlet?.name || "this outlet"}
            </Text>
          </Paper>

          {/* 2. Total Orders */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Total Orders
              </Text>
              <ThemeIcon size={22} radius="md" color="blue" variant="light">
                <IconReceipt size={13} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 18, fontWeight: 700 }}>
              {metrics.totalOrdersCount}
            </Title>
            <Text size="10px" c="dimmed" mt={2} lineClamp={1}>
              {metrics.completedOrdersCount} paid • {metrics.openOrdersCount} active
            </Text>
          </Paper>

          {/* 3. Avg Order Value */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Avg Order Value
              </Text>
              <ThemeIcon size={22} radius="md" color="violet" variant="light">
                <IconChartBar size={13} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 18, fontWeight: 700 }}>
              ₹{(metrics.averageOrderValuePaise / 100).toFixed(0)}
            </Title>
            <Text size="10px" c="dimmed" mt={2} lineClamp={1}>
              Per settled bill
            </Text>
          </Paper>

          {/* 4. Highest Bill */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Highest Bill
              </Text>
              <ThemeIcon size={22} radius="md" color="yellow" variant="light">
                <IconStar size={13} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 18, fontWeight: 700 }}>
              ₹{(metrics.highestOrderPaise / 100).toFixed(0)}
            </Title>
            <Text size="10px" c="dimmed" mt={2} lineClamp={1}>
              Max single bill
            </Text>
          </Paper>

          {/* 5. Most Visited Day (NEW!) */}
          <Paper
            p="sm"
            radius="md"
            withBorder
            style={{
              backgroundColor: visitedDaysData.mostVisitedDay ? "#fdfbf7" : "#ffffff",
              borderColor: visitedDaysData.mostVisitedDay ? "#ffe8cc" : "#e9ecef",
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Most Visited Day
              </Text>
              <ThemeIcon size={22} radius="md" color="orange" variant="light">
                <IconCalendar size={13} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 17, fontWeight: 700, color: "#d9480f" }}>
              {visitedDaysData.mostVisitedDay || "N/A"}
            </Title>
            <Text size="10px" c="dimmed" mt={2} lineClamp={1}>
              {visitedDaysData.mostVisitedDayCount > 0
                ? `${visitedDaysData.mostVisitedDayCount} visits on this day`
                : "No visits recorded"}
            </Text>
          </Paper>

          {/* 6. Payment Mode */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Payment Mode
              </Text>
              <ThemeIcon size={22} radius="md" color="cyan" variant="light">
                <IconReceipt size={13} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 18, fontWeight: 700 }}>
              {metrics.preferredPaymentMethod || "Cash"}
            </Title>
            <Text size="10px" c="dimmed" mt={2} lineClamp={1}>
              {metrics.paymentMethodsBreakdown.length > 1
                ? `${metrics.paymentMethodsBreakdown.length} modes used`
                : "Primary mode"}
            </Text>
          </Paper>

          {/* 7. Dining Type Ratio */}
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={600}>
                Order Channels
              </Text>
              <ThemeIcon size={22} radius="md" color="orange" variant="light">
                <IconToolsKitchen2 size={13} />
              </ThemeIcon>
            </Group>
            <Title order={3} mt={4} style={{ fontSize: 17, fontWeight: 700 }}>
              {metrics.preferredDineMode}
            </Title>
            <Text size="10px" c="dimmed" mt={2} lineClamp={1}>
              {metrics.dineInCount} Dine • {metrics.takeawayCount} Take{metrics.deliveryCount ? ` • ${metrics.deliveryCount} Del` : ""}
            </Text>
          </Paper>
        </SimpleGrid>

        {/* ─── 4. MAIN CONTENT: NO TABS (ORDERS LEFT, ANALYTICS RIGHT) ───── */}
        <Grid gap="md" align="flex-start">
          {/* LEFT COLUMN: ORDER HISTORY & RECEIPTS */}
          <Grid.Col span={{ base: 12, lg: 7.5 }}>
            <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
              <Stack gap="md">
                {/* Header Row */}
                <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                  <Group gap={6} align="center">
                    <ThemeIcon size={26} radius="md" color="dinePrimary" variant="light">
                      <IconReceipt size={15} />
                    </ThemeIcon>
                    <Title order={4} style={{ fontSize: 16, fontWeight: 700 }}>
                      Order History & Receipts
                    </Title>
                    <Badge size="xs" variant="light" color="gray">
                      {profile.orders.length}
                    </Badge>
                  </Group>

                  {/* Filter Segmented Control */}
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
                      { label: "Delivery", value: "DELIVERY" },
                    ]}
                  />
                </Group>

                {/* Orders List */}
                {filteredOrders.length === 0 ? (
                  <Paper p="xl" radius="md" withBorder style={{ textAlign: "center", backgroundColor: "#fdfdfd" }}>
                    <Stack align="center" gap="xs">
                      <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                        <IconReceiptOff size={24} />
                      </ThemeIcon>
                      <Text size="sm" fw={600}>
                        No orders found
                      </Text>
                      <Text size="xs" c="dimmed">
                        No orders matching the selected &ldquo;{orderFilterStatus}&rdquo; filter.
                      </Text>
                      <Button size="xs" variant="default" onClick={() => setOrderFilterStatus("ALL")} mt="xs">
                        Reset Filter
                      </Button>
                    </Stack>
                  </Paper>
                ) : (
                  <Stack gap="xs">
                    {filteredOrders.map((order, idx) => {
                      const isExpanded = expandedOrders[order.id] !== undefined
                        ? Boolean(expandedOrders[order.id])
                        : idx === 0;
                      const isDelivery =
                        order.orderType === "DELIVERY" ||
                        (order.tableNo || "").toLowerCase() === "delivery";
                      const isTakeaway =
                        !isDelivery &&
                        ((order.tableNo || "").toLowerCase() === "takeaway" ||
                          order.orderType === "TAKEAWAY");

                      return (
                        <Paper
                          key={order.id}
                          p={{ base: "xs", sm: "sm" }}
                          radius="md"
                          withBorder
                          style={{
                            backgroundColor: order.status === "PAID" ? "#ffffff" : "#fffdf5",
                            borderColor: order.status === "PAID" ? "#e9ecef" : "#ffe066",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {/* Order Summary Header (Click to expand) */}
                          <Box
                            onClick={() => toggleOrderExpand(order.id, isExpanded)}
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                              {/* Left Info: Token, Badges, Date */}
                              <Box style={{ minWidth: 0, flex: 1 }}>
                                <Group gap={6} align="center" wrap="wrap">
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
                                  <Badge
                                    size="xs"
                                    variant="outline"
                                    color={isDelivery ? "teal" : isTakeaway ? "gray" : "blue"}
                                    leftSection={
                                      isDelivery ? (
                                        <IconMotorbike size={11} />
                                      ) : isTakeaway ? (
                                        <IconShoppingBag size={11} />
                                      ) : (
                                        <IconToolsKitchen2 size={11} />
                                      )
                                    }
                                  >
                                    {isDelivery
                                      ? "Delivery"
                                      : isTakeaway
                                      ? "Takeaway"
                                      : `Table ${order.tableNo}`}
                                  </Badge>
                                </Group>

                                <Group gap={6} align="center" mt={3} wrap="nowrap" style={{ overflow: "hidden" }}>
                                  <Text size="11px" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                                    {formatDate(order.createdAt)}
                                  </Text>
                                  <Text size="11px" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                                    • {order.itemsCount} {order.itemsCount === 1 ? "item" : "items"}
                                  </Text>
                                  <Text size="11px" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                                    • {order.method || "Cash"}
                                  </Text>
                                </Group>
                              </Box>

                              {/* Right Info: Amount & Chevron */}
                              <Group gap="xs" align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
                                <Box style={{ textAlign: "right" }}>
                                  <Text
                                    fw={700}
                                    size="sm"
                                    c={order.status === "PAID" ? "green.8" : "dark.8"}
                                    style={{ fontSize: 16 }}
                                  >
                                    ₹{((order.subtotalPaise || 0) / 100).toFixed(0)}
                                  </Text>
                                </Box>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  size="sm"
                                  aria-label={isExpanded ? "Collapse order details" : "Expand order details"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOrderExpand(order.id, isExpanded);
                                  }}
                                >
                                  {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                </ActionIcon>
                              </Group>
                            </Group>
                          </Box>

                          {/* Expandable Itemized Details */}
                          <Collapse expanded={isExpanded}>
                            <Box mt="xs" pt="xs" style={{ borderTop: "1px solid #f1f3f5" }}>
                              {/* Mobile View: Clean List */}
                              <Box hiddenFrom="sm">
                                <Stack gap={6} mb="xs">
                                  {order.items.map((it) => (
                                    <Group key={it.id} justify="space-between" align="flex-start" wrap="nowrap" py={2}>
                                      <Box style={{ minWidth: 0, flex: 1 }}>
                                        <Text size="xs" fw={600} lineClamp={2} style={{ lineHeight: 1.35 }}>
                                          <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0, marginRight: 6 }}>
                                            ×{it.qty}
                                          </Badge>
                                          <span
                                            style={{
                                              display: "inline-flex",
                                              verticalAlign: "text-top",
                                              marginRight: 5,
                                            }}
                                          >
                                            <VegNonVegIcon isNonVeg={(it as any).isNonVeg} size={12} />
                                          </span>
                                          {it.name}
                                        </Text>

                                        {(it.variant || (it.addons && it.addons.length > 0) || it.note) && (
                                          <Stack gap={1} pl={34} mt={2}>
                                            {it.variant && (
                                              <Text size="10px" c="dimmed">
                                                Variant: {typeof it.variant === "object" ? it.variant.name : it.variant}
                                              </Text>
                                            )}
                                            {it.addons && it.addons.length > 0 && (
                                              <Text size="10px" c="dimmed">
                                                Addons: {it.addons.map((a: any) => typeof a === "object" ? a.name : a).join(", ")}
                                              </Text>
                                            )}
                                            {it.note && (
                                              <Text size="10px" c="orange.7" style={{ fontStyle: "italic" }}>
                                                Note: {it.note}
                                              </Text>
                                            )}
                                          </Stack>
                                        )}
                                      </Box>
                                      <Text size="xs" fw={600} style={{ flexShrink: 0 }}>
                                        ₹{((it.pricePaise * it.qty) / 100).toFixed(0)}
                                      </Text>
                                    </Group>
                                  ))}
                                </Stack>
                              </Box>

                              {/* Desktop View: Clean Table */}
                              <Box visibleFrom="sm">
                                <Table.ScrollContainer minWidth={280}>
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
                                            <Text size="xs" fw={600} lineClamp={2} style={{ lineHeight: 1.35 }}>
                                              <span
                                                style={{
                                                  display: "inline-flex",
                                                  verticalAlign: "text-top",
                                                  marginRight: 6,
                                                }}
                                              >
                                                <VegNonVegIcon isNonVeg={(it as any).isNonVeg} size={12} />
                                              </span>
                                              {it.name}
                                            </Text>
                                            {it.variant && (
                                              <Text size="10px" c="dimmed" pl={18}>
                                                Variant: {typeof it.variant === "object" ? it.variant.name : it.variant}
                                              </Text>
                                            )}
                                            {it.addons && it.addons.length > 0 && (
                                              <Text size="10px" c="dimmed" pl={18}>
                                                Addons: {it.addons.map((a: any) => typeof a === "object" ? a.name : a).join(", ")}
                                              </Text>
                                            )}
                                            {it.note && (
                                              <Text size="10px" c="orange.7" style={{ fontStyle: "italic" }} pl={18}>
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
                                </Table.ScrollContainer>
                              </Box>

                              {/* Order Footnote & WhatsApp Receipt Button */}
                              <Group justify="space-between" align="center" mt="xs" pt="xs" style={{ borderTop: "1px dashed #e9ecef" }}>
                                <Text size="11px" c="dimmed">
                                  ID: <code style={{ fontSize: 10 }}>{order.id.slice(0, 8)}...</code>
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
            </Paper>
          </Grid.Col>

          {/* RIGHT COLUMN: INTELLIGENCE CARDS (VISITED DAYS, FAVORITES, PREFERENCES, OUTLETS) */}
          <Grid.Col span={{ base: 12, lg: 4.5 }}>
            <Stack gap="md">
              {/* ─── CARD 1: MOST VISITED DAYS (NEW & HIGHLIGHTED) ─────────── */}
              <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                <Group justify="space-between" align="center" mb="xs">
                  <Group gap={6} align="center">
                    <ThemeIcon size={24} radius="md" color="orange" variant="light">
                      <IconCalendar size={14} />
                    </ThemeIcon>
                    <Title order={4} style={{ fontSize: 15, fontWeight: 700 }}>
                      Most Visited Days
                    </Title>
                  </Group>

                  {visitedDaysData.mostVisitedDay && (
                    <Badge size="sm" variant="filled" color="orange" leftSection={<IconFlame size={12} />}>
                      {visitedDaysData.mostVisitedDay} Peak
                    </Badge>
                  )}
                </Group>

                {visitedDaysData.mostVisitedDay ? (
                  <Box>
                    <Paper
                      p="xs"
                      radius="sm"
                      mb="sm"
                      style={{
                        backgroundColor: "#fff4e6",
                        border: "1px solid #ffd8a8",
                      }}
                    >
                      <Group justify="space-between" align="center">
                        <Group gap={6} align="center">
                          <IconSparkles size={15} color="#e8590c" />
                          <Text size="xs" fw={700} c="orange.9">
                            {visitedDaysData.mostVisitedDay} is the favorite visit day!
                          </Text>
                        </Group>
                        <Badge size="xs" variant="light" color="orange">
                          {visitedDaysData.breakdown.find((d) => d.day === visitedDaysData.mostVisitedDay)?.percentage}% visits
                        </Badge>
                      </Group>
                      {diningHabitInsight && (
                        <Text size="11px" c="orange.8" mt={3}>
                          {diningHabitInsight.description}
                        </Text>
                      )}
                    </Paper>

                    {/* 7-Day Visual Distribution Chart */}
                    <Stack gap={6}>
                      {visitedDaysData.breakdown.map((item) => {
                        const isTop = item.day === visitedDaysData.mostVisitedDay && item.count > 0;
                        return (
                          <Box key={item.day}>
                            <Group justify="space-between" align="center" mb={2}>
                              <Group gap={6} align="center">
                                <Text
                                  size="xs"
                                  fw={isTop ? 700 : 500}
                                  c={isTop ? "orange.9" : "dark.7"}
                                  style={{ minWidth: 64 }}
                                >
                                  {item.short} ({item.day})
                                </Text>
                                {isTop && (
                                  <Badge size="xs" variant="dot" color="orange" px={4} py={0}>
                                    Top
                                  </Badge>
                                )}
                              </Group>
                              <Group gap={6} align="center">
                                <Text size="11px" fw={600} c={isTop ? "orange.9" : "dimmed"}>
                                  {item.count} {item.count === 1 ? "visit" : "visits"}
                                </Text>
                                <Text size="11px" c="dimmed" style={{ minWidth: 32, textAlign: "right" }}>
                                  {item.percentage}%
                                </Text>
                              </Group>
                            </Group>
                            <Progress
                              value={item.percentage}
                              color={isTop ? "orange" : item.count > 0 ? "blue" : "gray.3"}
                              size="sm"
                              radius="xl"
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                ) : (
                  <Center py="md">
                    <Text size="xs" c="dimmed">
                      No order visit day data recorded yet.
                    </Text>
                  </Center>
                )}
              </Paper>

              {/* ─── CARD 2: FAVORITE DISHES ─────────────────────────────── */}
              <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                <Group justify="space-between" align="center" mb="sm">
                  <Group gap={6} align="center">
                    <ThemeIcon size={24} radius="md" color="teal" variant="light">
                      <IconSoup size={14} />
                    </ThemeIcon>
                    <Title order={4} style={{ fontSize: 15, fontWeight: 700 }}>
                      Favorite Dishes
                    </Title>
                  </Group>
                  <Badge size="xs" variant="light" color="teal">
                    {favoriteItems.length} Dishes
                  </Badge>
                </Group>

                {favoriteItems.length === 0 ? (
                  <Center py="md">
                    <Text size="xs" c="dimmed">
                      No favorite dishes recorded yet.
                    </Text>
                  </Center>
                ) : (
                  <Stack gap="xs">
                    {favoriteItems.slice(0, 6).map((item, idx) => (
                      <Paper
                        key={item.itemId || item.name}
                        p="xs"
                        radius="sm"
                        withBorder
                        style={{
                          backgroundColor: idx === 0 ? "#fdfbf7" : "#ffffff",
                          borderColor: idx === 0 ? "#ffe8cc" : "#f1f3f5",
                        }}
                      >
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Box style={{ minWidth: 0, flex: 1 }}>
                            <Group gap={6} align="flex-start" wrap="nowrap">
                              <Badge
                                size="xs"
                                variant="filled"
                                color={idx === 0 ? "yellow" : idx === 1 ? "gray" : idx === 2 ? "orange" : "teal"}
                                style={{ flexShrink: 0 }}
                              >
                                #{idx + 1}
                              </Badge>
                              <Box style={{ minWidth: 0, flex: 1 }}>
                                <Text size="xs" fw={700} lineClamp={1} style={{ lineHeight: 1.35 }}>
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      verticalAlign: "text-top",
                                      marginRight: 5,
                                    }}
                                  >
                                    <VegNonVegIcon isNonVeg={item.isNonVeg} size={12} />
                                  </span>
                                  {item.name}
                                </Text>
                                <Text size="11px" c="dimmed" mt={1}>
                                  Ordered {item.qty} × across {item.orderCount} visits
                                </Text>
                              </Box>
                            </Group>
                          </Box>

                          <Text size="xs" fw={700} c="green.8" style={{ flexShrink: 0 }}>
                            ₹{(item.totalSpendPaise / 100).toLocaleString("en-IN")}
                          </Text>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>

              {/* ─── CARD 3: DIETARY & PAYMENT PREFERENCES ────────────────── */}
              <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                <Title order={4} style={{ fontSize: 15, fontWeight: 700 }} mb="xs">
                  Dining Habits & Payment Preferences
                </Title>

                {/* Dietary Distribution */}
                <Box mb="md">
                  <Group justify="space-between" align="center" mb={4}>
                    <Text size="xs" fw={600} c="dark.7">
                      Dietary Distribution
                    </Text>
                    <Group gap={6}>
                      <Group gap={3} align="center">
                        <IconLeaf size={12} color="#2f9e44" />
                        <Text size="11px" fw={600} c="green.8">
                          Veg: {metrics.dietaryPreference.vegCount}
                        </Text>
                      </Group>
                      <Text size="11px" c="dimmed">
                        •
                      </Text>
                      <Group gap={3} align="center">
                        <IconMeat size={12} color="#e03131" />
                        <Text size="11px" fw={600} c="red.8">
                          Non-Veg: {metrics.dietaryPreference.nonVegCount}
                        </Text>
                      </Group>
                    </Group>
                  </Group>

                  {metrics.dietaryPreference.totalDishes > 0 ? (
                    <Progress.Root size="lg" radius="md">
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
                      No dish preference data recorded yet.
                    </Text>
                  )}
                </Box>

                <Divider my="xs" />

                {/* Payment Methods Breakdown */}
                <Box>
                  <Text size="xs" fw={600} c="dark.7" mb="xs">
                    Payment Channels Used
                  </Text>
                  <Stack gap={6}>
                    {metrics.paymentMethodsBreakdown.map((pm) => (
                      <Group key={pm.method} justify="space-between" align="center">
                        <Group gap={6}>
                          <Badge size="xs" variant="light" color="blue">
                            {pm.method}
                          </Badge>
                          <Text size="11px" c="dimmed">
                            {pm.count} {pm.count === 1 ? "bill" : "bills"}
                          </Text>
                        </Group>
                        <Text size="xs" fw={700}>
                          ₹{(pm.totalPaise / 100).toLocaleString("en-IN")}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Box>
              </Paper>

              {/* ─── CARD 4: CROSS-OUTLET VISITS ─────────────────────────── */}
              {overallChainMetrics.outletBreakdown && overallChainMetrics.outletBreakdown.length > 0 && (
                <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                  <Group justify="space-between" align="center" mb="xs">
                    <Group gap={6} align="center">
                      <ThemeIcon size={24} radius="md" color="indigo" variant="light">
                        <IconBuildingStore size={14} />
                      </ThemeIcon>
                      <Title order={4} style={{ fontSize: 15, fontWeight: 700 }}>
                        Cross-Outlet Activity
                      </Title>
                    </Group>
                    <Badge size="xs" variant="light" color="indigo">
                      {overallChainMetrics.outletBreakdown.length} Outlets
                    </Badge>
                  </Group>

                  <Stack gap={6}>
                    {overallChainMetrics.outletBreakdown.map((ob) => (
                      <Paper key={ob.outletId} p="xs" radius="sm" withBorder style={{ backgroundColor: "#fafafa" }}>
                        <Group justify="space-between" align="center">
                          <Box style={{ minWidth: 0 }}>
                            <Text size="xs" fw={700} lineClamp={1}>
                              {ob.outletName}
                            </Text>
                            <Text size="10px" c="dimmed">
                              {ob.ordersCount} orders • Last visit: {formatShortDate(ob.lastVisit)}
                            </Text>
                          </Box>
                          <Text size="xs" fw={700} c="green.8">
                            ₹{(ob.totalSpendPaise / 100).toLocaleString("en-IN")}
                          </Text>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
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
