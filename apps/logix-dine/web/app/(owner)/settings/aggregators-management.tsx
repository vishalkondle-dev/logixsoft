"use client";

import React, { useState, useEffect } from "react";
import {
  Paper,
  Stack,
  Text,
  Title,
  Group,
  Switch,
  TextInput,
  PasswordInput,
  NumberInput,
  Button,
  SimpleGrid,
  Card,
  ThemeIcon,
  Badge,
  Box,
  Divider,
  Alert,
  Tabs,
  CopyButton,
  ActionIcon,
  Tooltip,
  Loader,
  Center,
} from "@mantine/core";
import {
  IconCheck,
  IconCopy,
  IconAlertCircle,
  IconTruckDelivery,
  IconShieldLock,
  IconClock,
  IconPercentage,
  IconBuildingStore,
  IconBrandShopee,
  IconWorld,
  IconSparkles,
  IconRefresh,
  IconDeviceGamepad2,
  IconLink,
  IconInfoCircle,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  fetchOutletIntegrations,
  saveOutletIntegration,
  fetchOutletWebhookUrls,
  ChannelIntegration,
  WebhookUrlsResponse,
} from "@/lib/api-client";

interface ChannelConfigForm {
  merchantStoreId: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  bppId?: string;
  isOnline: boolean;
  autoAcceptOrders: boolean;
  defaultPrepMinutes: number;
  channelPriceMarkupPercent: number;
}

const DEFAULT_CONFIGS: Record<string, ChannelConfigForm> = {
  SWIGGY: {
    merchantStoreId: "",
    apiKey: "",
    apiSecret: "",
    webhookSecret: "",
    isOnline: true,
    autoAcceptOrders: false,
    defaultPrepMinutes: 20,
    channelPriceMarkupPercent: 15.0,
  },
  ZOMATO: {
    merchantStoreId: "",
    apiKey: "",
    apiSecret: "",
    webhookSecret: "",
    isOnline: true,
    autoAcceptOrders: false,
    defaultPrepMinutes: 25,
    channelPriceMarkupPercent: 15.0,
  },
  ONDC: {
    merchantStoreId: "",
    apiKey: "",
    apiSecret: "",
    webhookSecret: "",
    bppId: "",
    isOnline: true,
    autoAcceptOrders: true,
    defaultPrepMinutes: 20,
    channelPriceMarkupPercent: 5.0,
  },
  MAGICPIN: {
    merchantStoreId: "",
    apiKey: "",
    apiSecret: "",
    webhookSecret: "",
    isOnline: true,
    autoAcceptOrders: false,
    defaultPrepMinutes: 20,
    channelPriceMarkupPercent: 10.0,
  },
};

const CHANNEL_METADATA: Record<
  string,
  { name: string; color: string; storeIdLabel: string; storeIdPlaceholder: string; docsLabel: string }
> = {
  SWIGGY: {
    name: "Swiggy Food",
    color: "orange",
    storeIdLabel: "Swiggy Outlet / Store ID",
    storeIdPlaceholder: "e.g. SWIGGY_10293 or Outlet ID from Swiggy Partner",
    docsLabel: "Swiggy POS Integration Portal",
  },
  ZOMATO: {
    name: "Zomato Food",
    color: "red",
    storeIdLabel: "Zomato Res ID",
    storeIdPlaceholder: "e.g. 18492049 or Res ID from Zomato Merchant Dashboard",
    docsLabel: "Zomato Food Partner API",
  },
  ONDC: {
    name: "ONDC (Open Network)",
    color: "blue",
    storeIdLabel: "ONDC Provider / BPP Store ID",
    storeIdPlaceholder: "e.g. store_bangalore_01 or BPP Provider ID",
    docsLabel: "Beckn Protocol v1.2.0 Gateway",
  },
  MAGICPIN: {
    name: "Magicpin",
    color: "grape",
    storeIdLabel: "Magicpin Merchant Store ID",
    storeIdPlaceholder: "e.g. MP_88492 or Outlet ID from Magicpin Console",
    docsLabel: "Magicpin Order Push API",
  },
};

export function AggregatorsManagement() {
  const { restaurant, outlets, activeOutlet } = useRestaurant();
  const currentOutlet = activeOutlet || outlets[0];
  const outletId = currentOutlet?.id;

  const [loading, setLoading] = useState(true);
  const [savingChannel, setSavingChannel] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<ChannelIntegration[]>([]);
  const [webhookData, setWebhookData] = useState<WebhookUrlsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("SWIGGY");

  // Form states per channel
  const [forms, setForms] = useState<Record<string, ChannelConfigForm>>(DEFAULT_CONFIGS);

  const loadData = async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const [intRes, hookRes] = await Promise.all([
        fetchOutletIntegrations(outletId).catch(() => ({ outletId, integrations: [] })),
        fetchOutletWebhookUrls(outletId).catch(() => null),
      ]);

      setIntegrations(intRes.integrations || []);
      setWebhookData(hookRes);

      // Merge backend integration settings into local form state
      setForms((prev) => {
        const next = { ...prev };
        for (const item of intRes.integrations || []) {
          const code = item.channelCode;
          next[code] = {
            merchantStoreId: item.merchantStoreId || "",
            apiKey: item.credentials?.apiKey || "",
            apiSecret: item.credentials?.apiSecret || "",
            webhookSecret: item.credentials?.webhookSecret || "",
            bppId: item.credentials?.bppId || "",
            isOnline: Boolean(item.isOnline),
            autoAcceptOrders: Boolean(item.autoAcceptOrders),
            defaultPrepMinutes: item.defaultPrepMinutes ?? 20,
            channelPriceMarkupPercent: item.channelPriceMarkupPercent ?? 0.0,
          };
        }
        return next;
      });
    } catch (err: any) {
      notifications.show({
        title: "Failed to load aggregators",
        message: err.message || "Please check connection to Relay Gateway.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [outletId]);

  const handleFieldChange = (channel: string, field: keyof ChannelConfigForm, val: any) => {
    setForms((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [field]: val,
      },
    }));
  };

  const handleSave = async (channel: string) => {
    if (!outletId) {
      notifications.show({ title: "Error", message: "No active outlet found.", color: "red" });
      return;
    }
    const form = forms[channel] || DEFAULT_CONFIGS[channel];
    if (!form.merchantStoreId.trim()) {
      notifications.show({
        title: "Validation Error",
        message: `Please enter the ${CHANNEL_METADATA[channel]?.storeIdLabel || "Store ID"}.`,
        color: "orange",
      });
      return;
    }

    setSavingChannel(channel);
    try {
      await saveOutletIntegration(outletId, {
        channelCode: channel,
        merchantStoreId: form.merchantStoreId.trim(),
        credentials: {
          apiKey: form.apiKey.trim(),
          apiSecret: form.apiSecret.trim(),
          webhookSecret: form.webhookSecret.trim(),
          ...(form.bppId ? { bppId: form.bppId.trim() } : {}),
        },
        isOnline: form.isOnline,
        autoAcceptOrders: form.autoAcceptOrders,
        defaultPrepMinutes: Number(form.defaultPrepMinutes) || 20,
        channelPriceMarkupPercent: Number(form.channelPriceMarkupPercent) || 0.0,
      });

      notifications.show({
        title: "Credentials Saved",
        message: `${CHANNEL_METADATA[channel]?.name || channel} keys and operational rules updated securely.`,
        color: "green",
        icon: <IconCheck size={16} />,
      });

      await loadData();
    } catch (err: any) {
      notifications.show({
        title: "Save Failed",
        message: err.message || "Could not save credentials to Relay Gateway.",
        color: "red",
      });
    } finally {
      setSavingChannel(null);
    }
  };

  if (loading && !integrations.length) {
    return (
      <Center py={80}>
        <Loader color="dinePrimary" />
      </Center>
    );
  }

  const configuredCount = integrations.filter((i) => i.isConfigured).length;
  const onlineCount = integrations.filter((i) => i.isOnline && i.isConfigured).length;

  return (
    <Box>
      {/* Header Info Banner */}
      <Paper p="md" radius="md" mb="lg" style={{ border: "1px solid #e9ecef" }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <div>
            <Group gap="xs">
              <ThemeIcon size={36} radius="md" color="dinePrimary" variant="light">
                <IconTruckDelivery size={20} />
              </ThemeIcon>
              <div>
                <Group gap="xs">
                  <Text fw={700} size="md">
                    Aggregator Integration Gateway (Relay)
                  </Text>
                  {currentOutlet && (
                    <Badge variant="dot" color="teal" size="sm">
                      Outlet: {currentOutlet.name}
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  Manage API keys, Webhook secrets, store identifiers, auto-accept rules, and markups for online food delivery platforms.
                </Text>
              </div>
            </Group>
          </div>

          <Group gap="xs">
            <Badge color={onlineCount > 0 ? "teal" : "gray"} variant="light" size="md">
              {onlineCount} Channels Online
            </Badge>
            <Badge color="blue" variant="subtle" size="md">
              {configuredCount} / 4 Configured
            </Badge>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={loadData}
              title="Refresh status from Relay"
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Paper>

      {/* Main Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} radius="md" variant="outline">
        <Tabs.List mb="md">
          <Tabs.Tab
            value="SWIGGY"
            leftSection={<Badge size="xs" circle color="orange">S</Badge>}
            rightSection={
              forms.SWIGGY?.merchantStoreId ? (
                <Badge size="xs" color={forms.SWIGGY.isOnline ? "teal" : "yellow"} variant="dot">
                  {forms.SWIGGY.isOnline ? "Live" : "Paused"}
                </Badge>
              ) : undefined
            }
          >
            Swiggy
          </Tabs.Tab>

          <Tabs.Tab
            value="ZOMATO"
            leftSection={<Badge size="xs" circle color="red">Z</Badge>}
            rightSection={
              forms.ZOMATO?.merchantStoreId ? (
                <Badge size="xs" color={forms.ZOMATO.isOnline ? "teal" : "yellow"} variant="dot">
                  {forms.ZOMATO.isOnline ? "Live" : "Paused"}
                </Badge>
              ) : undefined
            }
          >
            Zomato
          </Tabs.Tab>

          <Tabs.Tab
            value="ONDC"
            leftSection={<Badge size="xs" circle color="blue">O</Badge>}
            rightSection={
              forms.ONDC?.merchantStoreId ? (
                <Badge size="xs" color={forms.ONDC.isOnline ? "teal" : "yellow"} variant="dot">
                  {forms.ONDC.isOnline ? "Live" : "Paused"}
                </Badge>
              ) : undefined
            }
          >
            ONDC (Beckn)
          </Tabs.Tab>

          <Tabs.Tab
            value="MAGICPIN"
            leftSection={<Badge size="xs" circle color="grape">M</Badge>}
            rightSection={
              forms.MAGICPIN?.merchantStoreId ? (
                <Badge size="xs" color={forms.MAGICPIN.isOnline ? "teal" : "yellow"} variant="dot">
                  {forms.MAGICPIN.isOnline ? "Live" : "Paused"}
                </Badge>
              ) : undefined
            }
          >
            Magicpin
          </Tabs.Tab>

          <Tabs.Tab
            value="WEBHOOKS"
            leftSection={<IconLink size={14} />}
          >
            Webhook URLs & Setup Guide
          </Tabs.Tab>
        </Tabs.List>

        {/* ─── Render Each Channel Panel (Swiggy, Zomato, ONDC, Magicpin) ─── */}
        {["SWIGGY", "ZOMATO", "ONDC", "MAGICPIN"].map((code) => {
          const meta = CHANNEL_METADATA[code];
          const form = forms[code] || DEFAULT_CONFIGS[code];
          const isSaving = savingChannel === code;
          const currentIntegration = integrations.find((i) => i.channelCode === code);

          return (
            <Tabs.Panel key={code} value={code}>
              <Paper p="lg" radius="md" style={{ border: "1px solid #e9ecef" }}>
                <Stack gap="lg">
                  {/* Top Bar for Channel */}
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Group gap="sm">
                      <ThemeIcon size={40} radius="md" color={meta.color} variant="light">
                        <IconBrandShopee size={22} />
                      </ThemeIcon>
                      <div>
                        <Group gap="xs">
                          <Title order={4}>{meta.name}</Title>
                          {currentIntegration?.isConfigured ? (
                            <Badge color="teal" size="sm" variant="light">
                              Configured & Encrypted
                            </Badge>
                          ) : (
                            <Badge color="gray" size="sm" variant="subtle">
                              Not Configured
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {meta.docsLabel} • Credentials are protected with AES-256-GCM hardware encryption at the edge.
                        </Text>
                      </div>
                    </Group>

                    {/* Channel Toggles */}
                    <Group gap="lg">
                      <Switch
                        label="Store Online"
                        description="Receive incoming orders"
                        checked={form.isOnline}
                        color="teal"
                        onChange={(e) => handleFieldChange(code, "isOnline", e.currentTarget.checked)}
                      />
                      <Switch
                        label="Auto-accept Orders"
                        description="Instant push to KDS & POS"
                        checked={form.autoAcceptOrders}
                        color="dinePrimary"
                        onChange={(e) => handleFieldChange(code, "autoAcceptOrders", e.currentTarget.checked)}
                      />
                    </Group>
                  </Group>

                  <Divider />

                  {/* Channel Credentials Section */}
                  <div>
                    <Text fw={600} size="sm" mb="xs" c="dark.8">
                      1. Partner Credentials & Identifiers
                    </Text>
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                      <TextInput
                        label={meta.storeIdLabel}
                        placeholder={meta.storeIdPlaceholder}
                        required
                        value={form.merchantStoreId}
                        onChange={(e) => handleFieldChange(code, "merchantStoreId", e.target.value)}
                        description="Unique restaurant branch code assigned by the partner platform"
                      />

                      <TextInput
                        label="API Key / Client ID"
                        placeholder="e.g. partner_api_key_..."
                        value={form.apiKey}
                        onChange={(e) => handleFieldChange(code, "apiKey", e.target.value)}
                        description="Provided in your Partner Integration Dashboard"
                      />

                      <PasswordInput
                        label="API Secret"
                        placeholder={
                          currentIntegration?.credentials?.apiSecret
                            ? "•••••••• (Masked, leave unchanged to preserve)"
                            : "Enter API secret"
                        }
                        value={form.apiSecret}
                        onChange={(e) => handleFieldChange(code, "apiSecret", e.target.value)}
                        description="Confidential partner key used to authenticate catalog sync & status updates"
                      />

                      <PasswordInput
                        label="Webhook Secret / Signature Token"
                        placeholder={
                          currentIntegration?.credentials?.webhookSecret
                            ? "•••••••• (Masked, leave unchanged to preserve)"
                            : "Enter webhook verification secret"
                        }
                        value={form.webhookSecret}
                        onChange={(e) => handleFieldChange(code, "webhookSecret", e.target.value)}
                        description="Used by Logix Relay to verify HMAC-SHA256 signature on incoming order payloads"
                      />

                      {code === "ONDC" && (
                        <TextInput
                          label="BPP Network ID / Subscriber ID"
                          placeholder="e.g. logixsoft-bpp.in"
                          value={form.bppId || ""}
                          onChange={(e) => handleFieldChange(code, "bppId", e.target.value)}
                          description="Your ONDC registry registered BPP ID"
                        />
                      )}
                    </SimpleGrid>
                  </div>

                  <Divider />

                  {/* Operational Settings Section */}
                  <div>
                    <Text fw={600} size="sm" mb="xs" c="dark.8">
                      2. Kitchen & Pricing Automation
                    </Text>
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                      <NumberInput
                        label="Default Kitchen Preparation Time (Minutes)"
                        description="Sent to the partner when orders are accepted for dispatch time estimation"
                        value={form.defaultPrepMinutes}
                        min={5}
                        max={90}
                        step={5}
                        leftSection={<IconClock size={16} />}
                        onChange={(val) => handleFieldChange(code, "defaultPrepMinutes", Number(val) || 20)}
                      />

                      <NumberInput
                        label="Channel Price Markup (%)"
                        description="Percentage automatically added to dine-in base prices when publishing catalog to this channel"
                        value={form.channelPriceMarkupPercent}
                        min={0}
                        max={100}
                        step={1}
                        leftSection={<IconPercentage size={16} />}
                        onChange={(val) => handleFieldChange(code, "channelPriceMarkupPercent", Number(val) || 0)}
                      />
                    </SimpleGrid>
                  </div>

                  {/* Notice about real-time routing */}
                  <Alert
                    icon={<IconSparkles size={16} />}
                    color="dinePrimary"
                    variant="light"
                    title="Real-time Sub-5ms Relay Routing"
                  >
                    When an order is placed on {meta.name}, Logix Relay normalizes the payload into Logix Dine schema, verifies signature authenticity, routes the order directly to the POS and active Kitchen Display Stations (KDS), and sends an automated WhatsApp confirmation if enabled.
                  </Alert>

                  {/* Actions */}
                  <Group justify="flex-end" gap="sm">
                    <Button
                      color="dinePrimary"
                      onClick={() => handleSave(code)}
                      loading={isSaving}
                      leftSection={<IconCheck size={16} />}
                    >
                      Save & Sync {meta.name} Settings
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Tabs.Panel>
          );
        })}

        {/* ─── Webhook URLs & Setup Guide Panel ─── */}
        <Tabs.Panel value="WEBHOOKS">
          <Stack gap="md">
            <Paper p="lg" radius="md" style={{ border: "1px solid #e9ecef" }}>
              <Title order={4} mb="xs">
                Partner Webhook Endpoints
              </Title>
              <Text size="sm" c="dimmed" mb="lg">
                Copy and paste these exact webhook URLs into your respective Partner Integration Portals. Logix Relay listens to these endpoints 24/7 with zero cold starts.
              </Text>

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                {/* Swiggy Webhook Card */}
                <Card withBorder radius="md" p="md">
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Badge color="orange">Swiggy</Badge>
                      <Text fw={600} size="sm">Swiggy POS Webhooks</Text>
                    </Group>
                  </Group>
                  <Text size="xs" c="dimmed" mb="sm">
                    Configure in: <b>Swiggy Partner Portal → Developer / POS Integration → Webhooks</b>
                  </Text>

                  <Stack gap="xs">
                    <div>
                      <Text size="xs" fw={500} c="dimmed">Order Push URL:</Text>
                      <Group gap="xs" mt={2}>
                        <TextInput
                          size="xs"
                          readOnly
                          value={webhookData?.webhooks.SWIGGY?.orderWebhookUrl || "https://relay.logixsoft.in/webhooks/swiggy/order"}
                          style={{ flex: 1 }}
                        />
                        <CopyButton value={webhookData?.webhooks.SWIGGY?.orderWebhookUrl || "https://relay.logixsoft.in/webhooks/swiggy/order"}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? "Copied" : "Copy URL"}>
                              <ActionIcon color={copied ? "teal" : "gray"} variant="light" onClick={copy}>
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </div>

                    <div>
                      <Text size="xs" fw={500} c="dimmed">Rider & Delivery Status URL:</Text>
                      <Group gap="xs" mt={2}>
                        <TextInput
                          size="xs"
                          readOnly
                          value={webhookData?.webhooks.SWIGGY?.riderStatusWebhookUrl || "https://relay.logixsoft.in/webhooks/swiggy/status"}
                          style={{ flex: 1 }}
                        />
                        <CopyButton value={webhookData?.webhooks.SWIGGY?.riderStatusWebhookUrl || "https://relay.logixsoft.in/webhooks/swiggy/status"}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? "Copied" : "Copy URL"}>
                              <ActionIcon color={copied ? "teal" : "gray"} variant="light" onClick={copy}>
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </div>

                    <Text size="xs" c="dimmed" mt={4}>
                      Header verification: <Badge size="xs" variant="outline">x-swiggy-signature</Badge>
                    </Text>
                  </Stack>
                </Card>

                {/* Zomato Webhook Card */}
                <Card withBorder radius="md" p="md">
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Badge color="red">Zomato</Badge>
                      <Text fw={600} size="sm">Zomato Food Partner Webhooks</Text>
                    </Group>
                  </Group>
                  <Text size="xs" c="dimmed" mb="sm">
                    Configure in: <b>Zomato Restaurant Partner Dashboard → API & Webhook Settings</b>
                  </Text>

                  <Stack gap="xs">
                    <div>
                      <Text size="xs" fw={500} c="dimmed">Order Push URL:</Text>
                      <Group gap="xs" mt={2}>
                        <TextInput
                          size="xs"
                          readOnly
                          value={webhookData?.webhooks.ZOMATO?.orderWebhookUrl || "https://relay.logixsoft.in/webhooks/zomato/order"}
                          style={{ flex: 1 }}
                        />
                        <CopyButton value={webhookData?.webhooks.ZOMATO?.orderWebhookUrl || "https://relay.logixsoft.in/webhooks/zomato/order"}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? "Copied" : "Copy URL"}>
                              <ActionIcon color={copied ? "teal" : "gray"} variant="light" onClick={copy}>
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </div>

                    <div>
                      <Text size="xs" fw={500} c="dimmed">Rider & Delivery Status URL:</Text>
                      <Group gap="xs" mt={2}>
                        <TextInput
                          size="xs"
                          readOnly
                          value={webhookData?.webhooks.ZOMATO?.riderStatusWebhookUrl || "https://relay.logixsoft.in/webhooks/zomato/status"}
                          style={{ flex: 1 }}
                        />
                        <CopyButton value={webhookData?.webhooks.ZOMATO?.riderStatusWebhookUrl || "https://relay.logixsoft.in/webhooks/zomato/status"}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? "Copied" : "Copy URL"}>
                              <ActionIcon color={copied ? "teal" : "gray"} variant="light" onClick={copy}>
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </div>

                    <Text size="xs" c="dimmed" mt={4}>
                      Header verification: <Badge size="xs" variant="outline">x-zomato-signature</Badge>
                    </Text>
                  </Stack>
                </Card>

                {/* ONDC Beckn Protocol Card */}
                <Card withBorder radius="md" p="md">
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Badge color="blue">ONDC</Badge>
                      <Text fw={600} size="sm">ONDC Beckn Protocol Endpoint</Text>
                    </Group>
                  </Group>
                  <Text size="xs" c="dimmed" mb="sm">
                    Configure in: <b>ONDC Registry / Beckn Network Participant Console</b>
                  </Text>

                  <Stack gap="xs">
                    <div>
                      <Text size="xs" fw={500} c="dimmed">BPP URI (Seller Endpoint):</Text>
                      <Group gap="xs" mt={2}>
                        <TextInput
                          size="xs"
                          readOnly
                          value={webhookData?.webhooks.ONDC?.bppUri || "https://relay.logixsoft.in/onboard/beckn/bpp"}
                          style={{ flex: 1 }}
                        />
                        <CopyButton value={webhookData?.webhooks.ONDC?.bppUri || "https://relay.logixsoft.in/onboard/beckn/bpp"}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? "Copied" : "Copy URL"}>
                              <ActionIcon color={copied ? "teal" : "gray"} variant="light" onClick={copy}>
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </div>

                    <Text size="xs" c="dimmed" mt={4}>
                      Protocol: Beckn v1.2.0 (Supports search, select, init, confirm, status, cancel)
                    </Text>
                  </Stack>
                </Card>

                {/* Magicpin Webhook Card */}
                <Card withBorder radius="md" p="md">
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Badge color="grape">Magicpin</Badge>
                      <Text fw={600} size="sm">Magicpin Order Push</Text>
                    </Group>
                  </Group>
                  <Text size="xs" c="dimmed" mb="sm">
                    Configure in: <b>Magicpin Merchant Console → API Integrations</b>
                  </Text>

                  <Stack gap="xs">
                    <div>
                      <Text size="xs" fw={500} c="dimmed">Order Webhook URL:</Text>
                      <Group gap="xs" mt={2}>
                        <TextInput
                          size="xs"
                          readOnly
                          value={webhookData?.webhooks.MAGICPIN?.orderWebhookUrl || "https://relay.logixsoft.in/webhooks/magicpin/order"}
                          style={{ flex: 1 }}
                        />
                        <CopyButton value={webhookData?.webhooks.MAGICPIN?.orderWebhookUrl || "https://relay.logixsoft.in/webhooks/magicpin/order"}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? "Copied" : "Copy URL"}>
                              <ActionIcon color={copied ? "teal" : "gray"} variant="light" onClick={copy}>
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </div>

                    <Text size="xs" c="dimmed" mt={4}>
                      Supports real-time voucher & food delivery order ingestion.
                    </Text>
                  </Stack>
                </Card>
              </SimpleGrid>
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
