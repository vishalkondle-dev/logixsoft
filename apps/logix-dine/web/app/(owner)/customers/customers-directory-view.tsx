"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Box,
  Stack,
  Group,
  Title,
  Text,
  Button,
  ActionIcon,
  Paper,
  SimpleGrid,
  Badge,
  ThemeIcon,
  TextInput,
  Select,
  Textarea,
  Modal,
  Table,
  Tooltip,
  Divider,
  Alert,
  Avatar,
  Menu,
  Center,
  Loader,
  Card,
  ScrollArea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconUsers,
  IconUserCheck,
  IconUserPlus,
  IconSearch,
  IconCrown,
  IconHeartHandshake,
  IconStar,
  IconClock,
  IconAlertCircle,
  IconCalendar,
  IconMail,
  IconPhone,
  IconBrandWhatsapp,
  IconDownload,
  IconEdit,
  IconRefresh,
  IconCash,
  IconSparkles,
  IconSend,
  IconCheck,
  IconEye,
  IconDotsVertical,
  IconToolsKitchen2,
  IconMotorbike,
  IconTag,
  IconMapPin,
  IconCake,
  IconGift,
  IconFlame,
  IconX,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useCustomers,
  useCreateCrmCustomer,
  useUpdateCrmCustomer,
  useBroadcastWhatsApp,
  useSendCustomerWhatsApp,
} from "@/lib/queries";
import type { CrmCustomerItem, CreateCustomerInput } from "@/lib/api-client";

// Format currency
function formatRupees(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Relative time formatter
function formatRecency(days: number, lastVisitAt: string | null) {
  if (!lastVisitAt || days >= 900) return { label: "Never", color: "gray" };
  if (days === 0) return { label: "Today", color: "green" };
  if (days === 1) return { label: "Yesterday", color: "green" };
  if (days <= 7) return { label: `${days}d ago`, color: "teal" };
  if (days <= 30) return { label: `${days}d ago`, color: "blue" };
  if (days <= 60) return { label: `${days}d ago (At Risk)`, color: "orange" };
  return { label: `${days}d ago (Inactive)`, color: "gray" };
}

const SEGMENT_TABS = [
  { id: "ALL", label: "All Customers", icon: IconUsers, color: "gray" },
  { id: "VIP", label: "VIP Champions", icon: IconCrown, color: "yellow" },
  { id: "REGULAR", label: "Loyal Regulars", icon: IconHeartHandshake, color: "teal" },
  { id: "NEW", label: "New Guests", icon: IconSparkles, color: "blue" },
  { id: "AT_RISK", label: "At-Risk (30-60d)", icon: IconClock, color: "orange" },
  { id: "INACTIVE", label: "Inactive (>60d)", icon: IconAlertCircle, color: "gray" },
  { id: "HIGH_SPEND", label: "High Ticket", icon: IconCash, color: "grape" },
  { id: "VEG", label: "Pure Veg", icon: IconToolsKitchen2, color: "green" },
  { id: "NON_VEG", label: "Non-Veg Lovers", icon: IconFlame, color: "red" },
  { id: "DELIVERY", label: "Takeaway & Delivery", icon: IconMotorbike, color: "indigo" },
] as const;

// Quick message templates for WhatsApp broadcast / single message
const MESSAGE_TEMPLATES = [
  {
    title: "Weekend VIP Special",
    text: "Hello {name}! We appreciate you dining with us at {restaurant_name}. This weekend, enjoy a complimentary chef special dessert on your visit! Show this message to your server.",
  },
  {
    title: "We Miss You (Win-Back)",
    text: "Hi {name}, we miss having you at {restaurant_name}! It's been a while since your last visit. Here is an exclusive 15% off on your next dine-in or takeaway order. Valid for the next 7 days!",
  },
  {
    title: "New Seasonal Dishes",
    text: "Exciting news {name}! {restaurant_name} has just launched a brand new seasonal menu featuring signature fresh ingredients. Book your table or drop by today to taste the flavors!",
  },
  {
    title: "Birthday / Celebration Treat",
    text: "Warmest celebration wishes from all of us at {restaurant_name}! Celebrate your special occasion with us and receive a complimentary celebration cake on the house.",
  },
];

export function CustomersDirectoryView() {
  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id || "";
  const outletId = activeOutlet?.id || null;

  // State
  const [selectedSegment, setSelectedSegment] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("recent");

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomerItem | null>(null);

  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastSegment, setBroadcastSegment] = useState<string>("AT_RISK");
  const [broadcastMessage, setBroadcastMessage] = useState<string>(MESSAGE_TEMPLATES[1].text);
  const [broadcastTestMode, setBroadcastTestMode] = useState<boolean>(true);
  const [broadcastPreviewData, setBroadcastPreviewData] = useState<any>(null);

  const [directWaModalOpen, setDirectWaModalOpen] = useState(false);
  const [directWaCustomer, setDirectWaCustomer] = useState<CrmCustomerItem | null>(null);
  const [directWaMessage, setDirectWaMessage] = useState<string>("");

  // Customer Form State
  const [custForm, setCustForm] = useState<CreateCustomerInput>({
    phone: "",
    name: "",
    email: "",
    dob: "",
    anniversary: "",
    gender: "PREFER_NOT_TO_SAY",
    address: "",
    tags: [],
    notes: "",
    dietaryPreference: "UNKNOWN",
    preferredChannel: "DINE_IN",
  });
  const [tagsInput, setTagsInput] = useState<string>("");

  // Fetch customers with directory metrics
  const {
    data: directoryData,
    isLoading,
    refetch,
    isFetching,
  } = useCustomers(restaurantId, {
    segment: selectedSegment,
    search: searchQuery,
    sortBy,
    limit: 100,
  });

  const createCustomerMutation = useCreateCrmCustomer(restaurantId);
  const updateCustomerMutation = useUpdateCrmCustomer(restaurantId);
  const broadcastMutation = useBroadcastWhatsApp(restaurantId);
  const sendWaMutation = useSendCustomerWhatsApp(restaurantId, directWaCustomer?.phone || "");

  const customers = directoryData?.customers || [];
  const metrics = directoryData?.metrics || {
    totalGuests: 0,
    vipGuests: 0,
    regularGuests: 0,
    newGuests: 0,
    atRiskGuests: 0,
    inactiveGuests: 0,
    highSpendGuests: 0,
    repeatRate: 0,
    totalLifetimeSpendPaise: 0,
    avgGuestSpendPaise: 0,
  };
  const segmentCounts = directoryData?.segmentCounts || {};

  // Open Edit Modal with Customer Data
  const handleOpenEdit = (cust: CrmCustomerItem) => {
    setEditingCustomer(cust);
    setCustForm({
      phone: cust.phone,
      name: cust.name || "",
      email: cust.email || "",
      dob: cust.dob || "",
      anniversary: cust.anniversary || "",
      gender: (cust.gender as any) || "PREFER_NOT_TO_SAY",
      address: cust.address || "",
      tags: cust.tags || [],
      notes: cust.notes || "",
      dietaryPreference: cust.dietaryPreference || "UNKNOWN",
      preferredChannel: cust.preferredChannel || "DINE_IN",
    });
    setTagsInput((cust.tags || []).join(", "));
    setEditModalOpen(true);
  };

  // Reset & Open Add Modal
  const handleOpenAdd = () => {
    setCustForm({
      phone: "",
      name: "",
      email: "",
      dob: "",
      anniversary: "",
      gender: "PREFER_NOT_TO_SAY",
      address: "",
      tags: [],
      notes: "",
      dietaryPreference: "UNKNOWN",
      preferredChannel: "DINE_IN",
    });
    setTagsInput("");
    setAddModalOpen(true);
  };

  // Submit Add Customer
  const handleSaveAdd = async () => {
    const rawDigits = custForm.phone.replace(/\D/g, "");
    if (rawDigits.length < 8) {
      notifications.show({
        title: "Invalid Phone",
        message: "Please enter a valid customer mobile number (min 8 digits)",
        color: "red",
      });
      return;
    }

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await createCustomerMutation.mutateAsync({
        body: {
          ...custForm,
          phone: rawDigits.slice(-10),
          tags: parsedTags,
        },
      });

      notifications.show({
        title: "Customer Added",
        message: `Guest ${custForm.name || custForm.phone} saved to central directory.`,
        color: "teal",
      });
      setAddModalOpen(false);
      refetch();
    } catch (err: any) {
      notifications.show({
        title: "Failed to Add",
        message: err.message || "Could not save customer profile",
        color: "red",
      });
    }
  };

  // Submit Edit Customer
  const handleSaveEdit = async () => {
    if (!editingCustomer) return;

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await updateCustomerMutation.mutateAsync({
        id: editingCustomer.id,
        body: {
          ...custForm,
          tags: parsedTags,
        },
      });

      notifications.show({
        title: "Customer Updated",
        message: "Customer profile and preferences saved.",
        color: "teal",
      });
      setEditModalOpen(false);
      refetch();
    } catch (err: any) {
      notifications.show({
        title: "Update Failed",
        message: err.message || "Failed to update profile",
        color: "red",
      });
    }
  };

  // Open Direct WhatsApp Modal
  const handleOpenDirectWa = (cust: CrmCustomerItem) => {
    setDirectWaCustomer(cust);
    const greeting = cust.name ? `Hello ${cust.name}` : "Hello";
    setDirectWaMessage(`${greeting}! Greetings from ${restaurant?.name || "our restaurant"}. `);
    setDirectWaModalOpen(true);
  };

  // Send Direct WhatsApp
  const handleSendDirectWa = async () => {
    if (!directWaCustomer || !directWaMessage.trim()) return;

    try {
      await sendWaMutation.mutateAsync({
        message: directWaMessage.trim(),
        outletId,
      });

      notifications.show({
        title: "Message Sent",
        message: `WhatsApp message dispatched to ${directWaCustomer.displayPhone}`,
        color: "green",
      });
      setDirectWaModalOpen(false);
    } catch (err: any) {
      notifications.show({
        title: "Delivery Failed",
        message: err.message || "Failed to send WhatsApp message",
        color: "red",
      });
    }
  };

  // Trigger Broadcast Preview / Send
  const handleBroadcast = async (isTest: boolean) => {
    if (!broadcastMessage.trim()) {
      notifications.show({ title: "Message Required", message: "Please type a message to broadcast.", color: "red" });
      return;
    }

    try {
      const res = await broadcastMutation.mutateAsync({
        body: {
          segment: broadcastSegment,
          message: broadcastMessage.trim(),
          testOnly: isTest,
        },
      });

      if (isTest) {
        setBroadcastPreviewData(res);
        notifications.show({
          title: "Preview Generated",
          message: `Target audience: ${res.totalTargets} guests in ${broadcastSegment} segment.`,
          color: "blue",
        });
      } else {
        notifications.show({
          title: "Campaign Broadcast Dispatched",
          message: `Successfully delivered to ${res.sentCount} of ${res.totalTargets} guests.`,
          color: "teal",
        });
        setBroadcastModalOpen(false);
        setBroadcastPreviewData(null);
      }
    } catch (err: any) {
      notifications.show({
        title: "Broadcast Error",
        message: err.message || "Could not dispatch broadcast",
        color: "red",
      });
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (customers.length === 0) {
      notifications.show({ title: "No Data", message: "No customers to export.", color: "orange" });
      return;
    }

    const headers = [
      "Customer Name",
      "Phone",
      "Email",
      "Segments",
      "Total Orders",
      "Lifetime Spend (INR)",
      "Avg Order (INR)",
      "Last Visit",
      "Days Inactive",
      "Dietary Preference",
      "Preferred Channel",
      "Tags",
      "Notes",
    ];

    const rows = customers.map((c) => [
      `"${(c.name || "Guest").replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${(c.email || "").replace(/"/g, '""')}"`,
      `"${c.segments.join(", ")}"`,
      c.totalOrders,
      (c.totalSpendPaise / 100).toFixed(2),
      (c.avgOrderPaise / 100).toFixed(2),
      c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString("en-IN") : "Never",
      c.daysSinceLastVisit,
      c.dietaryPreference,
      c.preferredChannel || "",
      `"${c.tags.join(", ")}"`,
      `"${(c.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customers_crm_${selectedSegment.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notifications.show({
      title: "Export Ready",
      message: `Exported ${customers.length} customer records to CSV.`,
      color: "teal",
    });
  };

  return (
    <Box pt="sm" pb={120} px={{ base: "xs", sm: "md" }}>
      <Stack gap="lg" w="100%">
        {/* ─── Top Header & Controls ─── */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <div>
              <Group gap="xs">
                <ThemeIcon color="dinePrimary" size="lg" radius="md" variant="light">
                  <IconUsers size={24} />
                </ThemeIcon>
                <div>
                  <Title order={3} fw={700}>
                    Central Customer CRM Directory & Segments
                  </Title>
                  <Text size="xs" c="dimmed">
                    Unified guest database, automated RFM segmentation, customer lifetime value, and targeted WhatsApp marketing.
                  </Text>
                </div>
              </Group>
            </div>

            <Group gap="xs" wrap="wrap">
              <Button
                variant="default"
                size="sm"
                leftSection={<IconRefresh size={16} />}
                loading={isFetching}
                onClick={() => refetch()}
              >
                Refresh
              </Button>

              <Button
                variant="default"
                size="sm"
                leftSection={<IconDownload size={16} />}
                onClick={handleExportCsv}
                disabled={customers.length === 0}
              >
                Export CSV
              </Button>

              <Button
                color="green"
                size="sm"
                leftSection={<IconBrandWhatsapp size={16} />}
                onClick={() => {
                  setBroadcastSegment(selectedSegment === "ALL" ? "AT_RISK" : selectedSegment);
                  setBroadcastPreviewData(null);
                  setBroadcastModalOpen(true);
                }}
              >
                Broadcast WhatsApp
              </Button>

              <Button
                color="dinePrimary"
                size="sm"
                leftSection={<IconUserPlus size={16} />}
                onClick={handleOpenAdd}
              >
                Add Customer
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* ─── CRM KPI Metrics ─── */}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
          <Card withBorder p="sm" radius="md" bg="#f8f9fa">
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Total Guests
              </Text>
              <ThemeIcon size={28} radius="md" color="blue" variant="light">
                <IconUsers size={16} />
              </ThemeIcon>
            </Group>
            <Title order={3} fw={700}>
              {metrics.totalGuests.toLocaleString("en-IN")}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Unique guest database
            </Text>
          </Card>

          <Card withBorder p="sm" radius="md" bg="#fff9db">
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text size="xs" c="#d97706" fw={600} tt="uppercase">
                VIP Champions
              </Text>
              <ThemeIcon size={28} radius="md" color="yellow" variant="filled">
                <IconCrown size={16} />
              </ThemeIcon>
            </Group>
            <Title order={3} fw={700} c="#b45309">
              {metrics.vipGuests}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              ₹5k+ spend or 8+ visits
            </Text>
          </Card>

          <Card withBorder p="sm" radius="md" bg="#e6fcf5">
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text size="xs" c="teal.8" fw={600} tt="uppercase">
                Loyal Regulars
              </Text>
              <ThemeIcon size={28} radius="md" color="teal" variant="light">
                <IconHeartHandshake size={16} />
              </ThemeIcon>
            </Group>
            <Title order={3} fw={700} c="teal.9">
              {metrics.regularGuests}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              3+ dine-in or takeaway visits
            </Text>
          </Card>

          <Card withBorder p="sm" radius="md" bg="#edf2ff">
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text size="xs" c="indigo.8" fw={600} tt="uppercase">
                Repeat Rate
              </Text>
              <ThemeIcon size={28} radius="md" color="indigo" variant="light">
                <IconRefresh size={16} />
              </ThemeIcon>
            </Group>
            <Title order={3} fw={700} c="indigo.9">
              {metrics.repeatRate}%
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Returning customer ratio
            </Text>
          </Card>

          <Card withBorder p="sm" radius="md" bg="#fff4e6">
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text size="xs" c="orange.8" fw={600} tt="uppercase">
                At-Risk Guests
              </Text>
              <ThemeIcon size={28} radius="md" color="orange" variant="light">
                <IconClock size={16} />
              </ThemeIcon>
            </Group>
            <Title order={3} fw={700} c="orange.9">
              {metrics.atRiskGuests}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              No visit in 30-60 days
            </Text>
          </Card>

          <Card withBorder p="sm" radius="md" bg="#ebfbee">
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text size="xs" c="green.8" fw={600} tt="uppercase">
                Total Spend LTV
              </Text>
              <ThemeIcon size={28} radius="md" color="green" variant="light">
                <IconCash size={16} />
              </ThemeIcon>
            </Group>
            <Title order={3} fw={700} c="green.9">
              {formatRupees(metrics.totalLifetimeSpendPaise)}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Avg: {formatRupees(metrics.avgGuestSpendPaise)} / guest
            </Text>
          </Card>
        </SimpleGrid>

        {/* ─── Segments Bar ─── */}
        <Paper withBorder p="xs" radius="md">
          <ScrollArea type="never">
            <Group gap="xs" wrap="nowrap">
              {SEGMENT_TABS.map((tab) => {
                const isSelected = selectedSegment === tab.id;
                const count = segmentCounts[tab.id] ?? 0;
                const TabIcon = tab.icon;

                return (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={isSelected ? "filled" : "subtle"}
                    color={isSelected ? "dinePrimary" : "gray"}
                    leftSection={<TabIcon size={16} />}
                    onClick={() => setSelectedSegment(tab.id)}
                    radius="xl"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {tab.label}
                    <Badge
                      size="sm"
                      variant={isSelected ? "white" : "light"}
                      color={isSelected ? "dinePrimary" : tab.color}
                      ml={6}
                      radius="xl"
                    >
                      {count}
                    </Badge>
                  </Button>
                );
              })}
            </Group>
          </ScrollArea>
        </Paper>

        {/* ─── Search & Sort Filter Toolbar ─── */}
        <Paper withBorder p="sm" radius="md">
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Group gap="sm" style={{ flex: 1, minWidth: 260 }}>
              <TextInput
                placeholder="Search by customer name, phone, email, notes, tags..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
                rightSection={
                  searchQuery ? (
                    <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => setSearchQuery("")}>
                      <IconX size={14} />
                    </ActionIcon>
                  ) : null
                }
              />
            </Group>

            <Group gap="xs">
              <Select
                size="sm"
                value={sortBy}
                onChange={(val) => setSortBy(val || "recent")}
                data={[
                  { value: "recent", label: "Sort: Most Recent Visit" },
                  { value: "spend_desc", label: "Sort: Highest Spend (LTV)" },
                  { value: "visits_desc", label: "Sort: Most Orders / Visits" },
                  { value: "name_asc", label: "Sort: Customer Name (A-Z)" },
                  { value: "oldest", label: "Sort: Oldest First Visit" },
                ]}
                style={{ width: 220 }}
              />

              <Badge size="lg" variant="light" color="gray">
                {customers.length} Guests
              </Badge>
            </Group>
          </Group>
        </Paper>

        {/* ─── Customer Directory Table ─── */}
        <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
          {isLoading ? (
            <Center py={60}>
              <Loader color="dinePrimary" size="md" />
            </Center>
          ) : customers.length === 0 ? (
            <Box py={60} px="md" ta="center">
              <ThemeIcon size={52} radius="xl" color="gray" variant="light" mb="sm">
                <IconUsers size={28} />
              </ThemeIcon>
              <Title order={4} fw={600} c="dimmed">
                No customers found in {selectedSegment === "ALL" ? "directory" : `${selectedSegment} segment`}
              </Title>
              <Text size="sm" c="dimmed" mt={4} maw={420} mx="auto">
                {searchQuery
                  ? `No guest matches "${searchQuery}". Try adjusting your search keywords.`
                  : "When customers place orders at the POS counter, digital QR menu, or delivery, they will appear here automatically."}
              </Text>
              {(searchQuery || selectedSegment !== "ALL") && (
                <Button
                  variant="light"
                  color="dinePrimary"
                  size="xs"
                  mt="md"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSegment("ALL");
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </Box>
          ) : (
            <Table.ScrollContainer minWidth={850}>
              <Table verticalSpacing="sm" horizontalSpacing="md" striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: "#f8f9fa" }}>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Segments & Tags</Table.Th>
                    <Table.Th ta="center">Orders</Table.Th>
                    <Table.Th ta="right">Lifetime Spend</Table.Th>
                    <Table.Th ta="right">Avg Order</Table.Th>
                    <Table.Th>Last Visit</Table.Th>
                    <Table.Th ta="right">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {customers.map((cust) => {
                    const recency = formatRecency(cust.daysSinceLastVisit, cust.lastVisitAt);
                    const initials = cust.name
                      ? cust.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : "G";

                    return (
                      <Table.Tr key={cust.id}>
                        {/* Customer Info */}
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap">
                            <Avatar
                              color={cust.isVip ? "yellow" : cust.isRegular ? "teal" : "blue"}
                              radius="xl"
                              size="md"
                            >
                              {initials}
                            </Avatar>
                            <div>
                              <Group gap={6} align="center">
                                <Text
                                  component={Link}
                                  href={`/customers/${cust.phone}`}
                                  size="sm"
                                  fw={700}
                                  c="dark.9"
                                  style={{ textDecoration: "none" }}
                                  className="hover-underline"
                                >
                                  {cust.name || "Walk-in Guest"}
                                </Text>
                                {cust.isVip && (
                                  <Tooltip label="VIP Guest: High spend / frequent visits" withArrow>
                                    <IconCrown size={15} color="#d97706" />
                                  </Tooltip>
                                )}
                              </Group>

                              <Group gap={8} align="center" mt={2}>
                                <Text size="xs" c="dimmed">
                                  {cust.displayPhone}
                                </Text>
                                <Tooltip label="Chat on WhatsApp" withArrow>
                                  <ActionIcon
                                    size="xs"
                                    color="green"
                                    variant="subtle"
                                    component="a"
                                    href={`https://wa.me/91${cust.phone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <IconBrandWhatsapp size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>

                              {cust.email && (
                                <Text size="xs" c="dimmed">
                                  {cust.email}
                                </Text>
                              )}
                            </div>
                          </Group>
                        </Table.Td>

                        {/* Segments & Tags */}
                        <Table.Td>
                          <Group gap={4} wrap="wrap">
                            {cust.isVip && (
                              <Badge size="xs" color="yellow" variant="filled">
                                VIP
                              </Badge>
                            )}
                            {cust.isRegular && (
                              <Badge size="xs" color="teal" variant="light">
                                Regular
                              </Badge>
                            )}
                            {cust.isNew && (
                              <Badge size="xs" color="blue" variant="light">
                                New
                              </Badge>
                            )}
                            {cust.isAtRisk && (
                              <Badge size="xs" color="orange" variant="light">
                                At Risk
                              </Badge>
                            )}
                            {cust.isInactive && (
                              <Badge size="xs" color="gray" variant="light">
                                Inactive
                              </Badge>
                            )}
                            {cust.dietaryPreference === "VEG" && (
                              <Badge size="xs" color="green" variant="outline">
                                Veg
                              </Badge>
                            )}
                            {cust.dietaryPreference === "NON_VEG" && (
                              <Badge size="xs" color="red" variant="outline">
                                Non-Veg
                              </Badge>
                            )}
                            {cust.tags.map((tag: string) => (
                              <Badge key={tag} size="xs" color="indigo" variant="subtle">
                                {tag}
                              </Badge>
                            ))}
                          </Group>
                        </Table.Td>

                        {/* Total Orders */}
                        <Table.Td ta="center">
                          <Badge size="sm" variant="light" color="dark">
                            {cust.totalOrders} {cust.totalOrders === 1 ? "order" : "orders"}
                          </Badge>
                        </Table.Td>

                        {/* Lifetime Spend */}
                        <Table.Td ta="right">
                          <Text fw={700} size="sm" c="teal.9">
                            {formatRupees(cust.totalSpendPaise)}
                          </Text>
                        </Table.Td>

                        {/* Avg Order */}
                        <Table.Td ta="right">
                          <Text size="xs" c="dimmed">
                            {formatRupees(cust.avgOrderPaise)}
                          </Text>
                        </Table.Td>

                        {/* Last Visit */}
                        <Table.Td>
                          <Badge size="xs" variant="light" color={recency.color}>
                            {recency.label}
                          </Badge>
                          {cust.lastVisitAt && (
                            <Text size="xs" c="dimmed" mt={2}>
                              {new Date(cust.lastVisitAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </Text>
                          )}
                        </Table.Td>

                        {/* Actions */}
                        <Table.Td ta="right">
                          <Group gap={6} justify="flex-end" wrap="nowrap">
                            <Tooltip label="View 360° Profile & Order History" withArrow>
                              <Button
                                component={Link}
                                href={`/customers/${cust.phone}`}
                                size="xs"
                                variant="light"
                                color="dinePrimary"
                                leftSection={<IconEye size={13} />}
                              >
                                360° Profile
                              </Button>
                            </Tooltip>

                            <Menu position="bottom-end" shadow="md">
                              <Menu.Target>
                                <ActionIcon variant="subtle" color="gray" size="sm">
                                  <IconDotsVertical size={16} />
                                </ActionIcon>
                              </Menu.Target>

                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<IconBrandWhatsapp size={14} color="#25D366" />}
                                  onClick={() => handleOpenDirectWa(cust)}
                                >
                                  Send WhatsApp
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconEdit size={14} />}
                                  onClick={() => handleOpenEdit(cust)}
                                >
                                  Edit Guest Info
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item
                                  leftSection={<IconEye size={14} />}
                                  component={Link}
                                  href={`/customers/${cust.phone}`}
                                >
                                  Full Order History
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Paper>

        {/* ─── ADD CUSTOMER MODAL ─── */}
        <Modal
          opened={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          title={
            <Group gap="xs">
              <ThemeIcon color="dinePrimary" size="md" radius="md">
                <IconUserPlus size={18} />
              </ThemeIcon>
              <Text fw={700} size="md">
                Add New Customer to CRM
              </Text>
            </Group>
          }
          size="lg"
          radius="md"
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Mobile Number (WhatsApp)"
                placeholder="e.g. 9876543210"
                required
                type="tel"
                value={custForm.phone}
                onChange={(e) => setCustForm({ ...custForm, phone: e.target.value.replace(/\D/g, "").slice(0, 15) })}
                leftSection={<IconPhone size={16} />}
              />

              <TextInput
                label="Customer Full Name"
                placeholder="e.g. Rahul Sharma"
                value={custForm.name || ""}
                onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Email Address"
                placeholder="rahul@example.com"
                type="email"
                value={custForm.email || ""}
                onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                leftSection={<IconMail size={16} />}
              />

              <Select
                label="Dietary Preference"
                value={custForm.dietaryPreference || "UNKNOWN"}
                onChange={(v) => setCustForm({ ...custForm, dietaryPreference: v as any })}
                data={[
                  { value: "UNKNOWN", label: "Unknown / No Preference" },
                  { value: "VEG", label: "Pure Vegetarian" },
                  { value: "NON_VEG", label: "Non-Vegetarian Lover" },
                  { value: "MIXED", label: "Mixed / Flexible" },
                ]}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Birthday (DOB)"
                placeholder="YYYY-MM-DD or DD-MM"
                value={custForm.dob || ""}
                onChange={(e) => setCustForm({ ...custForm, dob: e.target.value })}
                leftSection={<IconCake size={16} />}
              />

              <TextInput
                label="Anniversary"
                placeholder="YYYY-MM-DD or DD-MM"
                value={custForm.anniversary || ""}
                onChange={(e) => setCustForm({ ...custForm, anniversary: e.target.value })}
                leftSection={<IconGift size={16} />}
              />
            </SimpleGrid>

            <TextInput
              label="Custom Tags (comma separated)"
              placeholder="e.g. Family, Corporate, High Spender, Weekend Regular"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              leftSection={<IconTag size={16} />}
            />

            <TextInput
              label="Delivery / Address"
              placeholder="House, street, landmark, city"
              value={custForm.address || ""}
              onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
              leftSection={<IconMapPin size={16} />}
            />

            <Textarea
              label="Staff Notes & Preferences"
              placeholder="Special table preferences, allergy restrictions, spicy/mild instructions..."
              value={custForm.notes || ""}
              onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })}
              rows={2}
            />

            <Group justify="flex-end" gap="xs" mt="sm">
              <Button variant="default" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                color="dinePrimary"
                loading={createCustomerMutation.isPending}
                onClick={handleSaveAdd}
                leftSection={<IconCheck size={16} />}
              >
                Save Customer
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* ─── EDIT CUSTOMER MODAL ─── */}
        <Modal
          opened={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={
            <Group gap="xs">
              <ThemeIcon color="teal" size="md" radius="md">
                <IconEdit size={18} />
              </ThemeIcon>
              <Text fw={700} size="md">
                Edit Customer: {editingCustomer?.displayPhone}
              </Text>
            </Group>
          }
          size="lg"
          radius="md"
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Customer Full Name"
                placeholder="e.g. Rahul Sharma"
                value={custForm.name || ""}
                onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
              />

              <TextInput
                label="Email Address"
                placeholder="rahul@example.com"
                type="email"
                value={custForm.email || ""}
                onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                leftSection={<IconMail size={16} />}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Select
                label="Dietary Preference"
                value={custForm.dietaryPreference || "UNKNOWN"}
                onChange={(v) => setCustForm({ ...custForm, dietaryPreference: v as any })}
                data={[
                  { value: "UNKNOWN", label: "Unknown / No Preference" },
                  { value: "VEG", label: "Pure Vegetarian" },
                  { value: "NON_VEG", label: "Non-Vegetarian Lover" },
                  { value: "MIXED", label: "Mixed / Flexible" },
                ]}
              />

              <Select
                label="Preferred Channel"
                value={custForm.preferredChannel || "DINE_IN"}
                onChange={(v) => setCustForm({ ...custForm, preferredChannel: v as any })}
                data={[
                  { value: "DINE_IN", label: "Dine-In" },
                  { value: "TAKEAWAY", label: "Takeaway" },
                  { value: "DELIVERY", label: "Delivery" },
                ]}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Birthday (DOB)"
                placeholder="YYYY-MM-DD or DD-MM"
                value={custForm.dob || ""}
                onChange={(e) => setCustForm({ ...custForm, dob: e.target.value })}
                leftSection={<IconCake size={16} />}
              />

              <TextInput
                label="Anniversary"
                placeholder="YYYY-MM-DD or DD-MM"
                value={custForm.anniversary || ""}
                onChange={(e) => setCustForm({ ...custForm, anniversary: e.target.value })}
                leftSection={<IconGift size={16} />}
              />
            </SimpleGrid>

            <TextInput
              label="Custom Tags (comma separated)"
              placeholder="e.g. Family, Corporate, High Spender"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              leftSection={<IconTag size={16} />}
            />

            <TextInput
              label="Delivery / Address"
              placeholder="House, street, landmark, city"
              value={custForm.address || ""}
              onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
              leftSection={<IconMapPin size={16} />}
            />

            <Textarea
              label="Staff Notes & Seating Preferences"
              placeholder="Special table preferences, allergy restrictions, spicy/mild instructions..."
              value={custForm.notes || ""}
              onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })}
              rows={2}
            />

            <Group justify="flex-end" gap="xs" mt="sm">
              <Button variant="default" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                color="teal"
                loading={updateCustomerMutation.isPending}
                onClick={handleSaveEdit}
                leftSection={<IconCheck size={16} />}
              >
                Update Profile
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* ─── BROADCAST WHATSAPP MODAL ─── */}
        <Modal
          opened={broadcastModalOpen}
          onClose={() => setBroadcastModalOpen(false)}
          title={
            <Group gap="xs">
              <ThemeIcon color="green" size="md" radius="md">
                <IconBrandWhatsapp size={18} />
              </ThemeIcon>
              <Text fw={700} size="md">
                WhatsApp Segment Broadcast Campaign
              </Text>
            </Group>
          }
          size="lg"
          radius="md"
        >
          <Stack gap="md">
            <Alert color="green" variant="light" icon={<IconBrandWhatsapp size={16} />}>
              Reach targeted guest segments with personalized promotional greetings, anniversary treats, or win-back discounts directly on WhatsApp.
            </Alert>

            <Select
              label="Target Customer Segment"
              value={broadcastSegment}
              onChange={(v) => {
                setBroadcastSegment(v || "AT_RISK");
                setBroadcastPreviewData(null);
              }}
              data={SEGMENT_TABS.map((t) => ({
                value: t.id,
                label: `${t.label} (${segmentCounts[t.id] ?? 0} guests)`,
              }))}
            />

            {/* Quick Templates */}
            <div>
              <Text size="xs" fw={600} c="dimmed" mb={4}>
                Quick Template Starters
              </Text>
              <Group gap={6} wrap="wrap">
                {MESSAGE_TEMPLATES.map((tmpl) => (
                  <Button
                    key={tmpl.title}
                    size="compact-xs"
                    variant="light"
                    color="gray"
                    onClick={() => {
                      setBroadcastMessage(tmpl.text);
                      setBroadcastPreviewData(null);
                    }}
                  >
                    {tmpl.title}
                  </Button>
                ))}
              </Group>
            </div>

            <Textarea
              label="WhatsApp Message"
              description="Use {name} for guest name and {restaurant_name} for restaurant name."
              value={broadcastMessage}
              onChange={(e) => {
                setBroadcastMessage(e.target.value);
                setBroadcastPreviewData(null);
              }}
              rows={4}
            />

            {/* Live WhatsApp Preview Box */}
            <Paper p="sm" radius="md" withBorder bg="#f0fdf4" style={{ borderLeft: "4px solid #22c55e" }}>
              <Text size="xs" fw={700} c="teal.9" mb={4}>
                📱 Live Guest WhatsApp Preview:
              </Text>
              <Text size="xs" style={{ whiteSpace: "pre-wrap", fontFamily: "sans-serif" }} c="dark.8">
                {broadcastMessage
                  .replace(/\{name\}/gi, "Rahul")
                  .replace(/\{restaurant_name\}/gi, restaurant?.name || "Our Restaurant")}
              </Text>
            </Paper>

            {broadcastPreviewData && (
              <Paper p="sm" radius="md" withBorder bg="#f8f9fa">
                <Text size="xs" fw={600} c="blue.9">
                  Target Audience: {broadcastPreviewData.totalTargets} guests in {broadcastSegment}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  Sample numbers: {broadcastPreviewData.targetPreview?.map((t: any) => t.phone).join(", ") || "None"}
                </Text>
              </Paper>
            )}

            <Group justify="space-between" align="center" mt="sm">
              <Button
                variant="light"
                color="blue"
                size="sm"
                loading={broadcastMutation.isPending && broadcastTestMode}
                onClick={() => {
                  setBroadcastTestMode(true);
                  handleBroadcast(true);
                }}
              >
                Preview Audience
              </Button>

              <Group gap="xs">
                <Button variant="default" onClick={() => setBroadcastModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  color="green"
                  size="sm"
                  loading={broadcastMutation.isPending && !broadcastTestMode}
                  onClick={() => {
                    setBroadcastTestMode(false);
                    handleBroadcast(false);
                  }}
                  leftSection={<IconSend size={16} />}
                >
                  Send Campaign Now
                </Button>
              </Group>
            </Group>
          </Stack>
        </Modal>

        {/* ─── DIRECT WHATSAPP MODAL (Single Guest) ─── */}
        <Modal
          opened={directWaModalOpen}
          onClose={() => setDirectWaModalOpen(false)}
          title={
            <Group gap="xs">
              <ThemeIcon color="green" size="md" radius="md">
                <IconBrandWhatsapp size={18} />
              </ThemeIcon>
              <Text fw={700} size="md">
                Send WhatsApp: {directWaCustomer?.name || directWaCustomer?.displayPhone}
              </Text>
            </Group>
          }
          size="md"
          radius="md"
        >
          <Stack gap="md">
            <Text size="xs" c="dimmed">
              Direct message to {directWaCustomer?.displayPhone}
            </Text>

            <Textarea
              label="Message Content"
              value={directWaMessage}
              onChange={(e) => setDirectWaMessage(e.target.value)}
              rows={4}
            />

            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={() => setDirectWaModalOpen(false)}>
                Cancel
              </Button>
              <Button
                color="green"
                loading={sendWaMutation.isPending}
                onClick={handleSendDirectWa}
                leftSection={<IconSend size={16} />}
              >
                Send Message
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Box>
  );
}
