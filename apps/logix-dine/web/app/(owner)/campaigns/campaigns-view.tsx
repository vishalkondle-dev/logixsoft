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
  Card,
  Badge,
  ThemeIcon,
  TextInput,
  Select,
  Textarea,
  Modal,
  Table,
  Tooltip,
  Progress,
  Radio,
  Divider,
  Alert,
  Center,
  Loader,
  SegmentedControl,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import {
  IconSpeakerphone,
  IconBrandWhatsapp,
  IconSend,
  IconCalendar,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconClock,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconEye,
  IconUsers,
  IconPhoto,
  IconTag,
  IconBuildingStore,
  IconDeviceMobile,
  IconArrowLeft,
  IconSearch,
  IconPercentage,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useCampaigns,
  useCampaign,
  useCreateCampaign,
  useTestCampaign,
  useSendCampaignNow,
  useCancelCampaign,
  useDeleteCampaign,
  useCustomers,
} from "@/lib/queries";
import type { MarketingCampaign } from "@/lib/api-client";

// Starter templates for 1-click campaign generation
const STARTER_TEMPLATES = [
  {
    name: "Weekend Special",
    code: "WEEKEND20",
    text: "Hi {name}! 🍕 Enjoy a delightful weekend treat at {restaurant_name}! Get flat 20% OFF on all orders with offer code *{offer_code}*. Valid this Saturday & Sunday. Come dine with family and friends!",
  },
  {
    name: "Festive Discount",
    code: "FESTIVE150",
    text: "Greetings {name} from {restaurant_name}! ✨ Celebrate this festive season with delicious treats and chef specials. Enjoy flat ₹150 OFF on orders above ₹699 with code *{offer_code}*. Valid this week only!",
  },
  {
    name: "Weekday Treat",
    code: "TASTY15",
    text: "Hey {name}! Beat the weekday routine with delicious food at {restaurant_name}! 🍜 Show this code *{offer_code}* during billing to get 15% OFF on your entire order. See you today!",
  },
  {
    name: "Chef's Special",
    code: "CHEFGIFT",
    text: "Hello {name}! 🌟 Our head chef at {restaurant_name} has crafted brand-new specialty recipes just for our valued guests. Visit us this week and show code *{offer_code}* for a complimentary dessert with your meal!",
  },
];

export function CampaignsView() {
  const { restaurant, outlets, activeOutlet, setActiveOutlet, role, isLoading: restLoading } = useRestaurant();
  const restaurantId = restaurant?.id || "";
  const outletId = activeOutlet?.id || null;

  // Campaigns query
  const {
    data: campaignsData,
    isLoading,
    refetch,
    isFetching,
    error: campaignsError,
  } = useCampaigns(restaurantId);

  // Safely extract campaigns array no matter what shape is returned
  const campaigns: MarketingCampaign[] = useMemo(() => {
    if (!campaignsData) return [];
    if (Array.isArray(campaignsData)) return campaignsData;
    if (Array.isArray((campaignsData as any).campaigns)) return (campaignsData as any).campaigns;
    return [];
  }, [campaignsData]);

  const apiSummary = (campaignsData as any)?.summary;

  // Total customer count query (strictly directory count, no segments)
  const { data: customerData } = useCustomers(restaurantId, { limit: 1 });
  const totalAudienceCount = customerData?.totalCount || 0;

  // Mutations
  const createMutation = useCreateCampaign(restaurantId);
  const testMutation = useTestCampaign(restaurantId);
  const sendNowMutation = useSendCampaignNow(restaurantId);
  const cancelMutation = useCancelCampaign(restaurantId);
  const deleteMutation = useDeleteCampaign(restaurantId);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create Campaign Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignMessage, setCampaignMessage] = useState(STARTER_TEMPLATES[0].text);
  const [campaignMediaUrl, setCampaignMediaUrl] = useState("");
  const [campaignOfferCode, setCampaignOfferCode] = useState(STARTER_TEMPLATES[0].code);
  const [targetAudience, setTargetAudience] = useState<"ALL" | "OUTLET">("ALL");
  const [sendMode, setSendMode] = useState<"immediately" | "schedule">("immediately");
  const [scheduledAt, setScheduledAt] = useState("");

  // Test send state inside Create Modal
  const [testPhone, setTestPhone] = useState(restaurant?.phone || "");
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Delivery Logs / Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const { data: selectedCampaignDetail, isLoading: isLoadingDetail } = useCampaign(
    restaurantId,
    selectedCampaignId || "",
    Boolean(selectedCampaignId)
  );

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    if (!Array.isArray(campaigns)) return [];
    return campaigns.filter((c) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        (c.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.offerCode && c.offerCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.message || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || (c.status || "").toUpperCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [campaigns, searchQuery, statusFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    if (apiSummary) {
      return {
        totalCampaigns: apiSummary.totalCampaigns || 0,
        totalMessagesDelivered: apiSummary.totalMessagesSent || 0,
        scheduledCount: apiSummary.scheduledCount || 0,
        successRate: apiSummary.successRate ?? 100,
      };
    }

    let totalMessagesDelivered = 0;
    let scheduledCount = 0;
    let totalSent = 0;
    let totalFailed = 0;

    for (const c of campaigns) {
      totalMessagesDelivered += c.sentCount || 0;
      totalSent += c.sentCount || 0;
      totalFailed += c.failedCount || 0;
      if (c.status === "SCHEDULED") scheduledCount++;
    }

    const totalAttempts = totalSent + totalFailed;
    const successRate = totalAttempts > 0 ? Math.round((totalSent / totalAttempts) * 100) : 100;

    return {
      totalCampaigns: campaigns.length,
      totalMessagesDelivered,
      scheduledCount,
      successRate,
    };
  }, [campaigns, apiSummary]);

  // Handle inserting tag into message textarea
  const insertTag = (tag: string) => {
    setCampaignMessage((prev) => `${prev} ${tag}`);
  };

  // Handle applying a starter template
  const applyTemplate = (tpl: typeof STARTER_TEMPLATES[0]) => {
    setCampaignTitle(tpl.name);
    setCampaignOfferCode(tpl.code);
    setCampaignMessage(tpl.text);
  };

  // Handle Send Test Message
  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      notifications.show({
        title: "Test Phone Required",
        message: "Please enter your WhatsApp mobile number to receive the test broadcast.",
        color: "orange",
      });
      return;
    }

    if (!campaignMessage.trim()) {
      notifications.show({
        title: "Message Required",
        message: "Please draft your campaign message first.",
        color: "orange",
      });
      return;
    }

    setIsSendingTest(true);
    try {
      await testMutation.mutateAsync({
        data: {
          testPhone,
          message: campaignMessage,
          mediaUrl: campaignMediaUrl.trim() || undefined,
          offerCode: campaignOfferCode.trim() || undefined,
        },
        outletId,
      });

      notifications.show({
        title: "Test Message Sent!",
        message: `Sample campaign broadcast successfully delivered to ${testPhone} on WhatsApp.`,
        color: "teal",
        icon: <IconCheck size={18} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Test Send Failed",
        message: err?.message || "Failed to deliver test message. Check your WhatsApp gateway setup.",
        color: "red",
        icon: <IconX size={18} />,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Handle Launch Campaign
  const handleLaunchCampaign = async () => {
    if (!campaignTitle.trim()) {
      notifications.show({
        title: "Campaign Title Required",
        message: "Give your campaign an identifiable internal title.",
        color: "orange",
      });
      return;
    }

    if (!campaignMessage.trim()) {
      notifications.show({
        title: "Campaign Message Required",
        message: "Compose the WhatsApp promotional message for your customers.",
        color: "orange",
      });
      return;
    }

    if (sendMode === "schedule" && !scheduledAt) {
      notifications.show({
        title: "Schedule Date & Time Required",
        message: "Select when this promotional campaign should be automatically dispatched.",
        color: "orange",
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        data: {
          title: campaignTitle.trim(),
          message: campaignMessage.trim(),
          mediaUrl: campaignMediaUrl.trim() || undefined,
          offerCode: campaignOfferCode.trim() || undefined,
          targetAudience,
          outletId: targetAudience === "OUTLET" && outletId ? outletId : undefined,
          sendImmediately: sendMode === "immediately",
          scheduledAt: sendMode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        },
        outletId,
      });

      notifications.show({
        title: sendMode === "immediately" ? "Campaign Dispatched!" : "Campaign Scheduled!",
        message:
          sendMode === "immediately"
            ? "Your promotional broadcast has been dispatched to all customer contacts."
            : `Your campaign has been scheduled for ${new Date(scheduledAt).toLocaleString()}.`,
        color: "teal",
        icon: <IconCheck size={18} />,
      });

      setCreateModalOpen(false);
      // Reset form
      setCampaignTitle("");
      setCampaignMessage(STARTER_TEMPLATES[0].text);
      setCampaignMediaUrl("");
      setCampaignOfferCode(STARTER_TEMPLATES[0].code);
      setSendMode("immediately");
      setScheduledAt("");
    } catch (err: any) {
      notifications.show({
        title: "Failed to Create Campaign",
        message: err?.message || "An unexpected error occurred while launching campaign.",
        color: "red",
        icon: <IconX size={18} />,
      });
    }
  };

  // Live preview message formatter
  const formattedPreviewText = useMemo(() => {
    const custName = "Rahul Verma";
    const restName = restaurant?.name || "Our Restaurant";
    const code = campaignOfferCode || "SPECIAL";

    let text = campaignMessage
      .replace(/\{name\}/gi, custName)
      .replace(/\{restaurant_name\}/gi, restName)
      .replace(/\{offer_code\}/gi, code);

    return text;
  }, [campaignMessage, campaignOfferCode, restaurant?.name]);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "COMPLETED":
        return <Badge color="teal" variant="light">Delivered</Badge>;
      case "SCHEDULED":
        return <Badge color="blue" variant="light">Scheduled</Badge>;
      case "SENDING":
        return <Badge color="indigo" variant="filled">Sending...</Badge>;
      case "DRAFT":
        return <Badge color="gray" variant="light">Draft</Badge>;
      case "CANCELLED":
        return <Badge color="orange" variant="light">Cancelled</Badge>;
      case "FAILED":
        return <Badge color="red" variant="light">Failed</Badge>;
      default:
        return <Badge color="dark" variant="light">{status}</Badge>;
    }
  };

  if (restLoading && !restaurantId) {
    return (
      <Center py={100}>
        <Stack align="center" gap="sm">
          <Loader size="lg" color="green" />
          <Text size="sm" c="dimmed">
            Loading restaurant profile...
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box pt="md" pb="xl" px={{ base: "md", sm: "xl" }}>
      <Stack gap="lg" w="100%">
        {campaignsError && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Unable to load campaigns"
            color="red"
            variant="light"
          >
            <Group justify="space-between" align="center">
              <Text size="xs">
                {(campaignsError as any)?.message || "Failed to fetch campaigns ledger."}
              </Text>
              <Button size="xs" variant="outline" color="red" onClick={() => refetch()}>
                Retry
              </Button>
            </Group>
          </Alert>
        )}

        {/* ─── Top Header & Controls ─── */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <div>
              <Group gap="xs">
                <ThemeIcon color="green" size="lg" radius="md" variant="light">
                  <IconSpeakerphone size={24} />
                </ThemeIcon>
                <div>
                  <Group gap="xs" align="center">
                    <Title order={3} fw={700}>
                      WhatsApp Promotional Broadcasts
                    </Title>
                    <Badge color="green" variant="light" size="sm">
                      Targeting All Customers
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Broadcast promotional flyers, discount codes, and festive announcements directly to your customers' WhatsApp.
                  </Text>
                </div>
              </Group>
            </div>

            <Group gap="sm" wrap="wrap">
              <Button
                component={Link}
                href="/customers"
                variant="subtle"
                color="gray"
                size="sm"
                leftSection={<IconUsers size={16} />}
              >
                Customer Directory ({totalAudienceCount})
              </Button>

              {outlets.length > 1 && (
                <Select
                  size="sm"
                  data={outlets.map((o) => ({ value: o.id, label: o.name }))}
                  value={outletId}
                  onChange={(val) => {
                    if (val) setActiveOutlet(val);
                  }}
                  leftSection={<IconBuildingStore size={15} />}
                  allowDeselect={false}
                  w={170}
                />
              )}

              <Tooltip label="Refresh Campaign Ledger">
                <ActionIcon
                  variant="default"
                  size="input-sm"
                  onClick={() => refetch()}
                  loading={isFetching}
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>

              <Button
                color="green"
                leftSection={<IconPlus size={16} />}
                onClick={() => setCreateModalOpen(true)}
              >
                Create Campaign
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* ─── KPI Metrics Grid ─── */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          {/* Card 1: Total Campaigns */}
          <Card withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                Total Campaigns
              </Text>
              <ThemeIcon color="indigo" variant="light" size="md" radius="md">
                <IconSpeakerphone size={18} />
              </ThemeIcon>
            </Group>
            <Group align="baseline" gap="xs" mt="xs">
              <Text size="xl" fw={800}>
                {metrics.totalCampaigns}
              </Text>
              <Badge color="indigo" size="xs" variant="light">
                Created
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Direct customer promotions
            </Text>
          </Card>

          {/* Card 2: Total Messages Delivered */}
          <Card withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                Delivered WhatsApps
              </Text>
              <ThemeIcon color="green" variant="light" size="md" radius="md">
                <IconBrandWhatsapp size={18} />
              </ThemeIcon>
            </Group>
            <Group align="baseline" gap="xs" mt="xs">
              <Text size="xl" fw={800} c="green.7">
                {metrics.totalMessagesDelivered.toLocaleString()}
              </Text>
              <Badge color="green" size="xs" variant="light">
                Direct to Handset
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Across all promotional runs
            </Text>
          </Card>

          {/* Card 3: Scheduled Active */}
          <Card withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                Scheduled Broadcasts
              </Text>
              <ThemeIcon color="blue" variant="light" size="md" radius="md">
                <IconClock size={18} />
              </ThemeIcon>
            </Group>
            <Group align="baseline" gap="xs" mt="xs">
              <Text size="xl" fw={800} c="blue.7">
                {metrics.scheduledCount}
              </Text>
              <Badge color="blue" size="xs" variant="light">
                Auto Dispatch
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Upcoming automated blasts
            </Text>
          </Card>

          {/* Card 4: Success Delivery Rate */}
          <Card withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                Delivery Success
              </Text>
              <ThemeIcon color="teal" variant="light" size="md" radius="md">
                <IconPercentage size={18} />
              </ThemeIcon>
            </Group>
            <Group align="baseline" gap="xs" mt="xs">
              <Text size="xl" fw={800} c="teal.7">
                {metrics.successRate}%
              </Text>
              <Badge color="teal" size="xs" variant="light">
                Verified
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Healthy WhatsApp delivery
            </Text>
          </Card>
        </SimpleGrid>

        {/* ─── Search & Status Filters ─── */}
        <Paper withBorder p="sm" radius="md">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <TextInput
              placeholder="Search campaigns by title, offer code, or text..."
              size="sm"
              w={{ base: "100%", sm: 360 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              leftSection={<IconSearch size={15} />}
              rightSection={
                searchQuery && (
                  <ActionIcon size="xs" variant="subtle" onClick={() => setSearchQuery("")}>
                    <IconX size={12} />
                  </ActionIcon>
                )
              }
            />

            <SegmentedControl
              size="sm"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              data={[
                { label: "All", value: "ALL" },
                { label: "Delivered", value: "COMPLETED" },
                { label: "Scheduled", value: "SCHEDULED" },
                { label: "Sending", value: "SENDING" },
                { label: "Cancelled", value: "CANCELLED" },
              ]}
            />
          </Group>
        </Paper>

        {/* ─── Campaigns Ledger Table ─── */}
        <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
          {isLoading ? (
            <Center p={60}>
              <Stack align="center" gap="sm">
                <Loader size="md" color="green" />
                <Text size="sm" c="dimmed">
                  Loading WhatsApp promotional campaigns...
                </Text>
              </Stack>
            </Center>
          ) : filteredCampaigns.length === 0 ? (
            <Center p={60}>
              <Stack align="center" gap="sm">
                <ThemeIcon size={56} radius="xl" color="green" variant="light">
                  <IconSpeakerphone size={28} />
                </ThemeIcon>
                <Title order={4} fw={600}>
                  No WhatsApp Campaigns Found
                </Title>
                <Text size="sm" c="dimmed" maw={440} ta="center">
                  Broadcast attractive festive discounts, happy hour announcements, and weekend offers to all {totalAudienceCount} customers on WhatsApp.
                </Text>
                <Button
                  color="green"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setCreateModalOpen(true)}
                  mt="xs"
                >
                  Create Your First Campaign
                </Button>
              </Stack>
            </Center>
          ) : (
            <Table.ScrollContainer minWidth={850}>
              <Table verticalSpacing="sm" horizontalSpacing="md" striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr style={{ background: "var(--mantine-color-gray-0)" }}>
                    <Table.Th>Campaign Title & Offer</Table.Th>
                    <Table.Th>Audience</Table.Th>
                    <Table.Th>Dispatched / Scheduled</Table.Th>
                    <Table.Th>Progress & Delivery</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredCampaigns.map((camp) => {
                    const total = camp.totalRecipients || 1;
                    const sent = camp.sentCount || 0;
                    const failed = camp.failedCount || 0;
                    const progressPercent = Math.min(100, Math.round(((sent + failed) / total) * 100));

                    return (
                      <Table.Tr key={camp.id}>
                        {/* Title & Offer */}
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <ThemeIcon
                              size="md"
                              radius="md"
                              color={camp.mediaUrl ? "cyan" : "green"}
                              variant="light"
                            >
                              {camp.mediaUrl ? <IconPhoto size={16} /> : <IconBrandWhatsapp size={16} />}
                            </ThemeIcon>
                            <div>
                              <Text size="sm" fw={600}>
                                {camp.title}
                              </Text>
                              <Group gap={6} mt={2}>
                                {camp.offerCode && (
                                  <Badge color="violet" size="xs" variant="light" leftSection={<IconTag size={10} />}>
                                    {camp.offerCode}
                                  </Badge>
                                )}
                                <Text size="xs" c="dimmed" lineClamp={1} maw={260}>
                                  {camp.message}
                                </Text>
                              </Group>
                            </div>
                          </Group>
                        </Table.Td>

                        {/* Audience */}
                        <Table.Td>
                          <div>
                            <Text size="xs" fw={600}>
                              {camp.targetAudience === "OUTLET" ? "Current Outlet" : "All Customers"}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {camp.totalRecipients} Contacts
                            </Text>
                          </div>
                        </Table.Td>

                        {/* Date */}
                        <Table.Td>
                          <div>
                            <Text size="xs" fw={600}>
                              {camp.scheduledAt
                                ? `Scheduled: ${new Date(camp.scheduledAt).toLocaleDateString([], { month: "short", day: "numeric" })}`
                                : camp.sentAt
                                ? `Sent: ${new Date(camp.sentAt).toLocaleDateString([], { month: "short", day: "numeric" })}`
                                : new Date(camp.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {camp.scheduledAt
                                ? new Date(camp.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : camp.sentAt
                                ? new Date(camp.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : new Date(camp.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                          </div>
                        </Table.Td>

                        {/* Progress */}
                        <Table.Td style={{ minWidth: 160 }}>
                          <Group justify="space-between" mb={4}>
                            <Text size="xs" fw={600} c="green.7">
                              {sent} Sent
                            </Text>
                            {failed > 0 && (
                              <Text size="xs" fw={600} c="red.7">
                                {failed} Failed
                              </Text>
                            )}
                            <Text size="xs" c="dimmed">
                              / {total}
                            </Text>
                          </Group>
                          <Progress
                            value={progressPercent}
                            color={camp.status === "FAILED" ? "red" : "green"}
                            size="sm"
                            radius="xl"
                          />
                        </Table.Td>

                        {/* Status */}
                        <Table.Td>{getStatusBadge(camp.status)}</Table.Td>

                        {/* Actions */}
                        <Table.Td style={{ textAlign: "right" }}>
                          <Group gap="xs" justify="flex-end">
                            <Tooltip label="View Recipient Logs">
                              <ActionIcon
                                variant="light"
                                color="blue"
                                size="sm"
                                onClick={() => {
                                  setSelectedCampaignId(camp.id);
                                  setDetailsModalOpen(true);
                                }}
                              >
                                <IconEye size={15} />
                              </ActionIcon>
                            </Tooltip>

                            {camp.status === "SCHEDULED" && (
                              <Tooltip label="Send Immediately Now">
                                <ActionIcon
                                  variant="light"
                                  color="green"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await sendNowMutation.mutateAsync({
                                        campaignId: camp.id,
                                        outletId,
                                      });
                                      notifications.show({
                                        title: "Broadcast Dispatched",
                                        message: "Campaign is now broadcasting to customers.",
                                        color: "teal",
                                      });
                                    } catch (err: any) {
                                      notifications.show({
                                        title: "Dispatch Failed",
                                        message: err?.message || "Failed to trigger broadcast.",
                                        color: "red",
                                      });
                                    }
                                  }}
                                >
                                  <IconSend size={15} />
                                </ActionIcon>
                              </Tooltip>
                            )}

                            {camp.status === "SCHEDULED" && (
                              <Tooltip label="Cancel Scheduled Run">
                                <ActionIcon
                                  variant="light"
                                  color="orange"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await cancelMutation.mutateAsync({
                                        campaignId: camp.id,
                                        outletId,
                                      });
                                      notifications.show({
                                        title: "Campaign Cancelled",
                                        message: "Scheduled broadcast has been cancelled.",
                                        color: "orange",
                                      });
                                    } catch (err: any) {
                                      notifications.show({
                                        title: "Cancel Failed",
                                        message: err?.message || "Failed to cancel campaign.",
                                        color: "red",
                                      });
                                    }
                                  }}
                                >
                                  <IconX size={15} />
                                </ActionIcon>
                              </Tooltip>
                            )}

                            <Tooltip label="Delete Campaign">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() => {
                                  modals.openConfirmModal({
                                    title: "Delete Campaign",
                                    centered: true,
                                    children: (
                                      <Text size="sm">
                                        Are you sure you want to delete campaign &quot;{camp.title}&quot;? This action cannot be undone.
                                      </Text>
                                    ),
                                    labels: { confirm: "Delete Campaign", cancel: "Keep Campaign" },
                                    confirmProps: { color: "red" },
                                    onConfirm: async () => {
                                      try {
                                        await deleteMutation.mutateAsync({
                                          campaignId: camp.id,
                                          outletId,
                                        });
                                        notifications.show({
                                          title: "Campaign Deleted",
                                          message: "Campaign record removed.",
                                          color: "gray",
                                        });
                                      } catch (err: any) {
                                        notifications.show({
                                          title: "Delete Failed",
                                          message: err?.message || "Could not delete campaign.",
                                          color: "red",
                                        });
                                      }
                                    },
                                  });
                                }}
                              >
                                <IconTrash size={15} />
                              </ActionIcon>
                            </Tooltip>
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
      </Stack>

      {/* ─── Create Campaign Modal (with Live WhatsApp Phone Preview) ─── */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="green" size="md" radius="md" variant="light">
              <IconSpeakerphone size={18} />
            </ThemeIcon>
            <Text fw={700} size="md">
              Create WhatsApp Promotional Broadcast
            </Text>
          </Group>
        }
        size="85%"
        radius="md"
        centered
        padding="lg"
      >
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          {/* Left Column: Form Controls */}
          <Stack gap="md">
            <Box>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6}>
                Quick Starter Templates (1-Click)
              </Text>
              <Group gap={6} wrap="wrap">
                {STARTER_TEMPLATES.map((tpl) => (
                  <Button
                    key={tpl.name}
                    size="xs"
                    variant="light"
                    color="gray"
                    radius="xl"
                    onClick={() => applyTemplate(tpl)}
                  >
                    {tpl.name}
                  </Button>
                ))}
              </Group>
            </Box>

            <TextInput
              label="Campaign Title"
              placeholder="e.g. Weekend Biryani Carnival 20% OFF"
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.currentTarget.value)}
              required
            />

            <Group grow>
              <TextInput
                label="Offer / Promo Code (Optional)"
                placeholder="e.g. WEEKEND20"
                value={campaignOfferCode}
                onChange={(e) => setCampaignOfferCode(e.currentTarget.value.toUpperCase())}
                leftSection={<IconTag size={16} />}
              />

              <Select
                label="Audience Scope"
                data={[
                  { value: "ALL", label: `All Customers (${totalAudienceCount} Contacts)` },
                  { value: "OUTLET", label: `Current Outlet (${activeOutlet?.name || "Active"})` },
                ]}
                value={targetAudience}
                onChange={(val) => setTargetAudience((val as any) || "ALL")}
                allowDeselect={false}
              />
            </Group>

            <TextInput
              label="Promotional Poster / Flyer Image URL (Optional)"
              placeholder="https://your-domain.com/promo-banner.jpg"
              value={campaignMediaUrl}
              onChange={(e) => setCampaignMediaUrl(e.currentTarget.value)}
              leftSection={<IconPhoto size={16} />}
              description="Direct JPEG or PNG link. Will be sent as an eye-catching WhatsApp image banner."
            />

            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>
                  Promotional Message *
                </Text>
                <Group gap={4}>
                  <Text size="xs" c="dimmed">
                    Insert tags:
                  </Text>
                  <Badge
                    size="xs"
                    variant="outline"
                    style={{ cursor: "pointer" }}
                    onClick={() => insertTag("{name}")}
                  >
                    + {"{name}"}
                  </Badge>
                  <Badge
                    size="xs"
                    variant="outline"
                    style={{ cursor: "pointer" }}
                    onClick={() => insertTag("{restaurant_name}")}
                  >
                    + {"{restaurant_name}"}
                  </Badge>
                  <Badge
                    size="xs"
                    variant="outline"
                    style={{ cursor: "pointer" }}
                    onClick={() => insertTag("{offer_code}")}
                  >
                    + {"{offer_code}"}
                  </Badge>
                </Group>
              </Group>
              <Textarea
                placeholder="Type your WhatsApp message..."
                rows={5}
                value={campaignMessage}
                onChange={(e) => setCampaignMessage(e.currentTarget.value)}
                description="Tip: Use *bold* for emphasis. Personalized tags will dynamically fill for each customer."
                required
              />
            </Box>

            <Divider label="Dispatch Schedule" labelPosition="left" />

            <Radio.Group
              value={sendMode}
              onChange={(val) => setSendMode(val as any)}
            >
              <Group gap="lg">
                <Radio value="immediately" label="Send Immediately Now" />
                <Radio value="schedule" label="Schedule for Later" />
              </Group>
            </Radio.Group>

            {sendMode === "schedule" && (
              <TextInput
                type="datetime-local"
                label="Scheduled Date & Time"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.currentTarget.value)}
                required
              />
            )}

            <Divider label="Verify Before Sending" labelPosition="left" />

            {/* Test Send Row */}
            <Box p="sm" style={{ background: "var(--mantine-color-gray-0)", borderRadius: 8 }}>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6}>
                Send Test to Your Phone First
              </Text>
              <Group gap="xs">
                <TextInput
                  placeholder="Enter 10-digit mobile number"
                  size="sm"
                  style={{ flex: 1 }}
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.currentTarget.value)}
                  leftSection={<IconDeviceMobile size={16} />}
                />
                <Button
                  size="sm"
                  color="green"
                  variant="light"
                  onClick={handleSendTest}
                  loading={isSendingTest}
                  leftSection={<IconSend size={15} />}
                >
                  Send Test
                </Button>
              </Group>
            </Box>

            {/* Submit Action Buttons */}
            <Group justify="flex-end" gap="sm" mt="md">
              <Button variant="default" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                color="green"
                leftSection={sendMode === "immediately" ? <IconSend size={16} /> : <IconCalendar size={16} />}
                onClick={handleLaunchCampaign}
                loading={createMutation.isPending}
              >
                {sendMode === "immediately"
                  ? `Launch Broadcast to ${totalAudienceCount} Customers`
                  : "Save & Schedule Broadcast"}
              </Button>
            </Group>
          </Stack>

          {/* Right Column: Interactive Live WhatsApp Smartphone Preview */}
          <Stack align="center" justify="center">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Live WhatsApp Smartphone Preview
            </Text>

            {/* Phone Mockup Frame */}
            <Box
              style={{
                width: 320,
                height: 520,
                borderRadius: 36,
                border: "10px solid #222",
                boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
                background: "#075e54",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {/* WhatsApp Chat Header */}
              <Box p="xs" style={{ background: "#075e54", color: "#fff" }}>
                <Group gap={8} wrap="nowrap">
                  <ActionIcon size="xs" variant="transparent" c="white">
                    <IconArrowLeft size={16} />
                  </ActionIcon>
                  <ThemeIcon size={30} radius="xl" color="green.9">
                    <IconBrandWhatsapp size={18} />
                  </ThemeIcon>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="xs" fw={700} c="white" lineClamp={1}>
                      {restaurant?.name || "Logix Dine"}
                    </Text>
                    <Text size="xs" style={{ fontSize: 10 }} c="green.2">
                      Official WhatsApp
                    </Text>
                  </div>
                </Group>
              </Box>

              {/* Chat Message Stream */}
              <Box
                p="xs"
                style={{
                  flex: 1,
                  background: "#efeae2",
                  backgroundImage: "radial-gradient(#d4ccc1 1px, transparent 0)",
                  backgroundSize: "16px 16px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                }}
              >
                {/* Date Stamp Pill */}
                <Center mb="xs">
                  <Badge size="xs" color="gray" variant="filled" style={{ opacity: 0.85, fontSize: 9 }}>
                    TODAY
                  </Badge>
                </Center>

                {/* WhatsApp Chat Bubble */}
                <Box
                  p={10}
                  style={{
                    maxWidth: "88%",
                    borderRadius: 10,
                    borderTopLeftRadius: 0,
                    background: "#dcf8c6",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    position: "relative",
                    alignSelf: "flex-start",
                  }}
                >
                  {/* Optional Image Banner Preview */}
                  {campaignMediaUrl && (
                    <Box
                      mb={8}
                      style={{
                        borderRadius: 6,
                        overflow: "hidden",
                        maxHeight: 140,
                        background: "#ddd",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={campaignMediaUrl}
                        alt="Promo Banner"
                        style={{ width: "100%", height: 140, objectFit: "cover" }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </Box>
                  )}

                  {/* Formatted Text */}
                  <Text
                    size="xs"
                    c="dark.8"
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: 1.4,
                      fontSize: 12,
                    }}
                  >
                    {formattedPreviewText}
                  </Text>

                  {/* Bubble Timestamp & Double Blue Ticks */}
                  <Group justify="flex-end" gap={4} mt={4}>
                    <Text size="xs" style={{ fontSize: 10 }} c="dimmed">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    <IconCheck size={12} color="#34B7F1" />
                  </Group>
                </Box>
              </Box>
            </Box>
            <Text size="xs" c="dimmed" ta="center">
              Sample preview showing tags filled for guest "Rahul Verma"
            </Text>
          </Stack>
        </SimpleGrid>
      </Modal>

      {/* ─── Campaign Recipient Logs Modal ─── */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedCampaignId(null);
        }}
        title={
          <Group gap="xs">
            <ThemeIcon color="blue" size="md" radius="md" variant="light">
              <IconEye size={18} />
            </ThemeIcon>
            <Text fw={700} size="md">
              Broadcast Delivery Report & Recipient Logs
            </Text>
          </Group>
        }
        size="70%"
        radius="md"
        centered
        padding="md"
      >
        {isLoadingDetail ? (
          <Center p={40}>
            <Loader size="md" color="blue" />
          </Center>
        ) : !selectedCampaignDetail ? (
          <Text size="sm" c="dimmed">
            No campaign logs available.
          </Text>
        ) : (() => {
          const detailCampaign = (selectedCampaignDetail as any)?.campaign || (selectedCampaignDetail as any);
          const detailRecipients = (selectedCampaignDetail as any)?.recipients || [];

          return (
            <Stack gap="md">
              {/* Summary Banner */}
              <Paper withBorder p="sm" radius="md" style={{ background: "var(--mantine-color-gray-0)" }}>
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                  <div>
                    <Text size="xs" c="dimmed">Campaign Title</Text>
                    <Text size="sm" fw={700}>{detailCampaign?.title || "Campaign"}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Status</Text>
                    <Box mt={2}>{getStatusBadge(detailCampaign?.status || "UNKNOWN")}</Box>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Delivered / Total</Text>
                    <Text size="sm" fw={700} c="green.7">
                      {detailCampaign?.sentCount || 0} / {detailCampaign?.totalRecipients || 0}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Offer Code</Text>
                    <Text size="sm" fw={700}>{detailCampaign?.offerCode || "None"}</Text>
                  </div>
                </SimpleGrid>
              </Paper>

              {/* Recipient Breakdown */}
              <Table.ScrollContainer minWidth={600}>
                <Table verticalSpacing="xs" striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>WhatsApp Phone</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Sent Timestamp</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {!detailRecipients || detailRecipients.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={4} style={{ textAlign: "center" }}>
                          <Text size="xs" c="dimmed" p="sm">
                            No recipient records logged yet.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      detailRecipients.map((rec: any) => (
                      <Table.Tr key={rec.id}>
                        <Table.Td>
                          <Text size="xs" fw={600}>
                            {rec.customerName || "Customer"}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">{rec.phone}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            color={
                              rec.status === "SENT" || rec.status === "DELIVERED"
                                ? "teal"
                                : rec.status === "FAILED"
                                ? "red"
                                : "gray"
                            }
                            variant="light"
                          >
                            {rec.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {rec.sentAt ? new Date(rec.sentAt).toLocaleString() : "—"}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        );
      })()}
    </Modal>
    </Box>
  );
}
