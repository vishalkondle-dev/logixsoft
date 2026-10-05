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
  Avatar,
  Menu,
  Center,
  Loader,
  Card,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconUsers,
  IconUserPlus,
  IconSearch,
  IconMail,
  IconPhone,
  IconBrandWhatsapp,
  IconDownload,
  IconEdit,
  IconRefresh,
  IconCash,
  IconReceipt,
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
  IconX,
  IconSpeakerphone,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useCustomers,
  useCreateCrmCustomer,
  useUpdateCrmCustomer,
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
  return { label: `${days}d ago`, color: "gray" };
}

export function CustomersDirectoryView() {
  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id || "";
  const outletId = activeOutlet?.id || null;

  // Search & Sort state (No segments)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("recent");

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomerItem | null>(null);

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

  // Fetch customers
  const {
    data: directoryData,
    isLoading,
    refetch,
    isFetching,
  } = useCustomers(restaurantId, {
    search: searchQuery,
    sortBy,
    limit: 200,
  });

  const createCustomerMutation = useCreateCrmCustomer(restaurantId);
  const updateCustomerMutation = useUpdateCrmCustomer(restaurantId);
  const sendWaMutation = useSendCustomerWhatsApp(restaurantId, directWaCustomer?.phone || "");

  const customers = directoryData?.customers || [];
  const metrics = directoryData?.metrics || {
    totalGuests: 0,
    totalLifetimeSpendPaise: 0,
    avgGuestSpendPaise: 0,
  };

  // Compute total orders across listed customers
  const totalOrdersCount = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0);
  }, [customers]);

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
        message: `Customer ${custForm.name || custForm.phone} saved to directory.`,
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
      "Total Orders",
      "Lifetime Spend (INR)",
      "Avg Order (INR)",
      "Last Visit",
      "Dietary Preference",
      "Preferred Channel",
      "Tags",
      "Notes",
    ];

    const rows = customers.map((c) => [
      `"${(c.name || "Guest").replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${(c.email || "").replace(/"/g, '""')}"`,
      c.totalOrders,
      (c.totalSpendPaise / 100).toFixed(2),
      (c.avgOrderPaise / 100).toFixed(2),
      c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString("en-IN") : "Never",
      c.dietaryPreference,
      c.preferredChannel || "",
      `"${c.tags.join(", ")}"`,
      `"${(c.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customers_directory_${new Date().toISOString().slice(0, 10)}.csv`);
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
    <Box pt="sm" pb="xl" px={{ base: "xs", sm: "md" }}>
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
                    Customer Directory & CRM
                  </Title>
                  <Text size="xs" c="dimmed">
                    Unified guest database, dining visit history, customer lifetime value, and direct WhatsApp messaging.
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
                component={Link}
                href="/campaigns"
                color="green"
                size="sm"
                leftSection={<IconSpeakerphone size={16} />}
              >
                WhatsApp Campaigns
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

        {/* ─── Clean CRM Metrics (No Segments) ─── */}
        <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing="sm">
          <Card withBorder p="sm" radius="md" bg="#f8f9fa">
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Total Customers
              </Text>
              <ThemeIcon size={28} radius="md" color="blue" variant="light">
                <IconUsers size={16} />
              </ThemeIcon>
            </Group>
            <Title order={3} fw={700}>
              {metrics.totalGuests.toLocaleString("en-IN")}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Unique guest contacts
            </Text>
          </Card>

          <Card withBorder p="sm" radius="md" bg="#edf2ff">
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text size="xs" c="indigo.8" fw={600} tt="uppercase">
                Total Orders Placed
              </Text>
              <ThemeIcon size={28} radius="md" color="indigo" variant="light">
                <IconReceipt size={16} />
              </ThemeIcon>
            </Group>
            <Title order={3} fw={700} c="indigo.9">
              {totalOrdersCount}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Cumulative guest orders
            </Text>
          </Card>

          <Card withBorder p="sm" radius="md" bg="#ebfbee">
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text size="xs" c="green.8" fw={600} tt="uppercase">
                Customer Lifetime Spend
              </Text>
              <ThemeIcon size={28} radius="md" color="green" variant="light">
                <IconCash size={16} />
              </ThemeIcon>
            </Group>
            <Title order={3} fw={700} c="green.9">
              {formatRupees(metrics.totalLifetimeSpendPaise)}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Total revenue from database
            </Text>
          </Card>

          <Card withBorder p="sm" radius="md" bg="#fff9db">
            <Group justify="space-between" align="flex-start" mb={4}>
              <Text size="xs" c="#b45309" fw={600} tt="uppercase">
                Average Spend / Customer
              </Text>
              <ThemeIcon size={28} radius="md" color="yellow" variant="light">
                <IconCash size={16} />
              </ThemeIcon>
            </Group>
            <Title order={3} fw={700} c="#b45309">
              {formatRupees(metrics.avgGuestSpendPaise)}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Average customer value
            </Text>
          </Card>
        </SimpleGrid>

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
                  { value: "spend_desc", label: "Sort: Highest Spend" },
                  { value: "visits_desc", label: "Sort: Most Orders" },
                  { value: "name_asc", label: "Sort: Customer Name (A-Z)" },
                  { value: "oldest", label: "Sort: Oldest First Visit" },
                ]}
                style={{ width: 220 }}
              />

              <Badge size="lg" variant="light" color="gray">
                {customers.length} Customers
              </Badge>
            </Group>
          </Group>
        </Paper>

        {/* ─── Customer Directory Table (Clean, No Segments) ─── */}
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
                No customers found
              </Title>
              <Text size="sm" c="dimmed" mt={4} maw={420} mx="auto">
                {searchQuery
                  ? `No customer matches "${searchQuery}". Try adjusting your search keywords.`
                  : "When customers place orders at POS, digital QR menu, or delivery, they will appear here automatically."}
              </Text>
              {searchQuery && (
                <Button
                  variant="light"
                  color="dinePrimary"
                  size="xs"
                  mt="md"
                  onClick={() => setSearchQuery("")}
                >
                  Clear Search
                </Button>
              )}
            </Box>
          ) : (
            <Table.ScrollContainer minWidth={750}>
              <Table verticalSpacing="sm" horizontalSpacing="md" striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: "#f8f9fa" }}>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Tags / Dietary</Table.Th>
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
                            <Avatar color="dinePrimary" radius="xl" size="md">
                              {initials}
                            </Avatar>
                            <div>
                              <Text
                                component={Link}
                                href={`/customers/${cust.phone}`}
                                size="sm"
                                fw={700}
                                c="dark.9"
                                style={{ textDecoration: "none" }}
                              >
                                {cust.name || "Walk-in Guest"}
                              </Text>

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

                        {/* Dietary & Custom Tags */}
                        <Table.Td>
                          <Group gap={4} wrap="wrap">
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
                            {cust.preferredChannel && (
                              <Badge size="xs" color="gray" variant="light">
                                {cust.preferredChannel}
                              </Badge>
                            )}
                            {cust.tags.map((tag: string) => (
                              <Badge key={tag} size="xs" color="indigo" variant="subtle">
                                {tag}
                              </Badge>
                            ))}
                            {cust.tags.length === 0 && !cust.preferredChannel && cust.dietaryPreference === "UNKNOWN" && (
                              <Text size="xs" c="dimmed">
                                —
                              </Text>
                            )}
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
                                  Edit Customer Info
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
                Add New Customer
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
                  { value: "UNKNOWN", label: "No Preference" },
                  { value: "VEG", label: "Vegetarian" },
                  { value: "NON_VEG", label: "Non-Vegetarian" },
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
              placeholder="e.g. Family, Corporate, Regular"
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
              placeholder="Table preferences, spice tolerance, allergies..."
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
                  { value: "UNKNOWN", label: "No Preference" },
                  { value: "VEG", label: "Vegetarian" },
                  { value: "NON_VEG", label: "Non-Vegetarian" },
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
              placeholder="e.g. Family, Corporate, Regular"
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
              placeholder="Table preferences, spice tolerance, allergies..."
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
