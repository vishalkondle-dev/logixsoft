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
  Button,
  SimpleGrid,
  Card,
  ThemeIcon,
  Badge,
  Box,
  Divider,
  Alert,
} from "@mantine/core";
import {
  IconBrandWhatsapp,
  IconCheck,
  IconAlertCircle,
  IconReceipt,
  IconToolsKitchen2,
  IconMotorbike,
  IconSend,
  IconMessageCircle,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRestaurant } from "@/lib/restaurant-context";
import { useUpdateOutlet, useSendClosingReport } from "@/lib/queries";
import { sendCustomerWhatsApp } from "@/lib/api-client";

export interface WhatsappSettingsConfig {
  enabled: boolean;
  sendOnOrderCreated: boolean;
  sendOnKdsReady: boolean;
  sendOnBillSettled: boolean;
  sendOnDispatched: boolean;
  customFooterNote: string;
  // End of Day Closing Report to Owner
  sendDailyClosingReport: boolean;
  ownerClosingReportPhone: string;
}

const DEFAULT_WA_CONFIG: WhatsappSettingsConfig = {
  enabled: true,
  sendOnOrderCreated: true,
  sendOnKdsReady: true,
  sendOnBillSettled: true,
  sendOnDispatched: true,
  customFooterNote: "Thank you for dining with us! For feedback or queries, reply directly to this message.",
  sendDailyClosingReport: true,
  ownerClosingReportPhone: "",
};

export function WhatsappManagement() {
  const { restaurant, outlets, activeOutlet, refresh } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const currentOutlet = activeOutlet || outlets[0];
  const updateOutletMut = useUpdateOutlet(restaurantId);

  const [config, setConfig] = useState<WhatsappSettingsConfig>(DEFAULT_WA_CONFIG);
  const [saving, setSaving] = useState(false);

  // Test WhatsApp sending
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  // Closing Report testing
  const sendClosingReportMut = useSendClosingReport(restaurantId);
  const [testingClosing, setTestingClosing] = useState(false);

  const handleSendClosingTest = async () => {
    if (!currentOutlet) return;
    const rawPhone = config.ownerClosingReportPhone || currentOutlet?.phone || restaurant?.phone || "";
    const cleanDigits = rawPhone.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length < 10) {
      notifications.show({
        title: "Missing Owner Phone",
        message: "Please enter a valid 10-digit mobile number for the owner closing report.",
        color: "orange",
      });
      return;
    }

    setTestingClosing(true);
    try {
      await sendClosingReportMut.mutateAsync({
        outletId: currentOutlet.id,
        phone: cleanDigits,
      });

      notifications.show({
        title: "Closing Report Dispatched! 🌙",
        message: `Today's closing summary sent via WhatsApp to ${cleanDigits}.`,
        color: "teal",
        icon: <IconBrandWhatsapp size={18} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Dispatch Failed",
        message: err.message || "Failed to send closing report",
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setTestingClosing(false);
    }
  };

  useEffect(() => {
    if (currentOutlet?.whatsappSettings) {
      try {
        const parsed =
          typeof currentOutlet.whatsappSettings === "string"
            ? JSON.parse(currentOutlet.whatsappSettings)
            : currentOutlet.whatsappSettings;
        if (parsed && typeof parsed.enabled === "boolean") {
          setConfig({ ...DEFAULT_WA_CONFIG, ...parsed });
          return;
        }
      } catch (err) {
        console.error("Failed to parse whatsappSettings", err);
      }
    }
    setConfig(DEFAULT_WA_CONFIG);
  }, [currentOutlet]);

  const handleSave = async () => {
    if (!currentOutlet) return;
    setSaving(true);
    try {
      await updateOutletMut.mutateAsync({
        id: currentOutlet.id,
        body: { whatsappSettings: config },
      });
      await refresh();
      notifications.show({
        title: "WhatsApp Settings Saved",
        message: "Your automated notification rules have been updated.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Save Failed",
        message: err.message || "Failed to update WhatsApp settings",
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    const cleanPhone = testPhone.trim().replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      notifications.show({
        title: "Invalid Phone Number",
        message: "Please enter a valid 10-digit mobile number.",
        color: "orange",
      });
      return;
    }

    setTesting(true);
    try {
      const testMsg = `*${restaurant?.name || "Logix Dine"}* (${currentOutlet?.name || "Main"})\n\nThis is a test WhatsApp alert from your POS system.\n\nAutomated order updates and digital e-bills are active!\n\n_${config.customFooterNote}_`;
      await sendCustomerWhatsApp(restaurantId, cleanPhone, { message: testMsg }, currentOutlet?.id);
      notifications.show({
        title: "Test Message Dispatched",
        message: `Test notification sent successfully to +91 ${cleanPhone.slice(-10)}.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Dispatch Failed",
        message: err.message || "Failed to deliver WhatsApp test message.",
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Stack gap="lg" w="100%">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3} fw={700}>WhatsApp Alerts & Digital Receipts</Title>
          <Text size="sm" c="dimmed">
            Send instant order confirmations, food preparation alerts, and digital e-bill links directly to guest WhatsApp.
          </Text>
        </div>
        <Button
          color="dinePrimary"
          loading={saving}
          onClick={handleSave}
          leftSection={<IconCheck size={16} />}
        >
          Save Changes
        </Button>
      </Group>

      {/* Master Toggle */}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" align="center">
          <Group gap="md">
            <ThemeIcon color="green" size="lg" radius="md" variant="light">
              <IconBrandWhatsapp size={22} />
            </ThemeIcon>
            <div>
              <Text fw={600} size="md">Enable WhatsApp Notifications</Text>
              <Text size="xs" c="dimmed">
                Sends automated status updates and digital receipts via official WhatsApp Business API.
              </Text>
            </div>
          </Group>
          <Switch
            size="md"
            checked={config.enabled}
            onChange={(e) => {
              const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
              setConfig((p) => ({ ...p, enabled: checked }));
            }}
            color="green"
            aria-label="Toggle WhatsApp Notifications"
          />
        </Group>
      </Paper>

      {/* Notification Event Triggers */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Text fw={600}>Automated Notification Triggers</Text>

          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon color="teal" size="md" variant="light" radius="md">
                <IconReceipt size={16} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={500}>Digital E-Bill Link on Payment</Text>
                <Text size="xs" c="dimmed">
                  Sends customer their interactive itemized invoice link as soon as bill is settled.
                </Text>
              </div>
            </Group>
            <Switch
              disabled={!config.enabled}
              checked={config.sendOnBillSettled}
              onChange={(e) => {
                const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                setConfig((p) => ({ ...p, sendOnBillSettled: checked }));
              }}
              color="teal"
            />
          </Group>

          <Divider />

          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon color="blue" size="md" variant="light" radius="md">
                <IconMessageCircle size={16} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={500}>Order Placed / Confirmation</Text>
                <Text size="xs" c="dimmed">
                  Notifies customer with token number and estimated prep time when order is created.
                </Text>
              </div>
            </Group>
            <Switch
              disabled={!config.enabled}
              checked={config.sendOnOrderCreated}
              onChange={(e) => {
                const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                setConfig((p) => ({ ...p, sendOnOrderCreated: checked }));
              }}
              color="blue"
            />
          </Group>

          <Divider />

          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon color="orange" size="md" variant="light" radius="md">
                <IconToolsKitchen2 size={16} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={500}>Food Prepared / Pickup Ready</Text>
                <Text size="xs" c="dimmed">
                  Sends alert when kitchen marks ticket ready for dine-in serving or takeaway counter pickup.
                </Text>
              </div>
            </Group>
            <Switch
              disabled={!config.enabled}
              checked={config.sendOnKdsReady}
              onChange={(e) => {
                const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                setConfig((p) => ({ ...p, sendOnKdsReady: checked }));
              }}
              color="orange"
            />
          </Group>

          <Divider />

          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon color="violet" size="md" variant="light" radius="md">
                <IconMotorbike size={16} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={500}>Delivery Out for Drop-Off</Text>
                <Text size="xs" c="dimmed">
                  Dispatches rider contact details and live delivery tracking link to guest.
                </Text>
              </div>
            </Group>
            <Switch
              disabled={!config.enabled}
              checked={config.sendOnDispatched}
              onChange={(e) => {
                const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                setConfig((p) => ({ ...p, sendOnDispatched: checked }));
              }}
              color="violet"
            />
          </Group>
        </Stack>
      </Paper>

      {/* Custom Footer Message */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="xs">
          <Text fw={600}>Custom Message Footer Note</Text>
          <Text size="xs" c="dimmed">
            Appended at the bottom of all automated WhatsApp messages (e.g. feedback links, review requests).
          </Text>
          <TextInput
            value={config.customFooterNote}
            onChange={(e) => setConfig((p) => ({ ...p, customFooterNote: e.target.value }))}
            placeholder="e.g. Thank you for dining with us! Review us on Google."
          />
        </Stack>
      </Paper>

      {/* Owner End-of-Day Business Closing Report */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon color="teal" size="lg" variant="light" radius="md">
                <IconReceipt size={22} />
              </ThemeIcon>
              <div>
                <Group gap="xs">
                  <Text fw={700} size="md">Owner End-of-Day Business Closing Report</Text>
                  <Badge color="green" size="xs" variant="light">11:59 PM Daily</Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Sends an informative, simple-to-understand daily closing digest with total sales, cash vs UPI, expenses, net cash in drawer, and top 5 dishes directly to the owner.
                </Text>
              </div>
            </Group>
            <Switch
              disabled={!config.enabled}
              checked={config.sendDailyClosingReport}
              onChange={(e) => {
                const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                setConfig((p) => ({ ...p, sendDailyClosingReport: checked }));
              }}
              color="teal"
            />
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Owner WhatsApp Mobile Number"
              placeholder="e.g. 9876543210"
              description="10-digit mobile number for daily closing reports"
              value={config.ownerClosingReportPhone}
              onChange={(e) => setConfig((p) => ({ ...p, ownerClosingReportPhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
              leftSection={<IconBrandWhatsapp size={16} color="green" />}
            />

            <Box pt={{ base: 0, sm: "lg" }}>
              <Button
                color="teal"
                variant="light"
                loading={testingClosing}
                onClick={handleSendClosingTest}
                leftSection={<IconSend size={16} />}
                fullWidth
              >
                Send Today's Closing Report Now (Test)
              </Button>
            </Box>
          </SimpleGrid>
        </Stack>
      </Paper>

      {/* Interactive Test WhatsApp Messenger */}
      <Paper withBorder p="md" radius="md" style={{ backgroundColor: "#f9fcf9" }}>
        <Stack gap="sm">
          <Group gap="xs">
            <ThemeIcon color="green" size="md" variant="light" radius="md">
              <IconSend size={16} />
            </ThemeIcon>
            <Text fw={600}>Test WhatsApp Notification</Text>
          </Group>
          <Text size="xs" c="dimmed">
            Verify real-time delivery by dispatching a sample message to your phone number.
          </Text>

          <Group gap="sm">
            <TextInput
              placeholder="10-digit mobile number"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              maw={240}
              size="sm"
            />
            <Button
              color="green"
              size="sm"
              loading={testing}
              onClick={handleSendTest}
              leftSection={<IconBrandWhatsapp size={16} />}
            >
              Send Test Message
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Group justify="flex-end">
        <Button
          color="dinePrimary"
          size="md"
          loading={saving}
          onClick={handleSave}
          leftSection={<IconCheck size={18} />}
        >
          Save WhatsApp Settings
        </Button>
      </Group>
    </Stack>
  );
}
