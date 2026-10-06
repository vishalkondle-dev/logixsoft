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

      {/* Top Section: Customer Triggers & Service/Footer Settings side by side on large screens */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* Automated Notification Triggers */}
        <Paper withBorder p="md" radius="md" style={{ display: "flex", flexDirection: "column" }}>
          <Stack gap="md" justify="space-between" style={{ flex: 1 }}>
            <div>
              <Group justify="space-between" align="center" mb="xs">
                <Text fw={700} size="md">Automated Notification Triggers</Text>
                <Badge size="xs" variant="light" color={config.enabled ? "teal" : "gray"}>
                  {config.enabled ? "4 Triggers Active" : "Disabled"}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" mb="md">
                Choose which lifecycle milestones automatically send a WhatsApp alert to the guest.
              </Text>

              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color="teal" size="md" variant="light" radius="md">
                      <IconReceipt size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={500}>Digital E-Bill on Payment</Text>
                      <Text size="xs" c="dimmed">
                        Sends interactive invoice link when bill is settled.
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
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color="blue" size="md" variant="light" radius="md">
                      <IconMessageCircle size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={500}>Order Confirmation</Text>
                      <Text size="xs" c="dimmed">
                        Token number & prep time when order is punched.
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
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color="orange" size="md" variant="light" radius="md">
                      <IconToolsKitchen2 size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={500}>Food Prepared / Pickup Ready</Text>
                      <Text size="xs" c="dimmed">
                        Alerts guest when KDS marks dishes ready.
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
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color="violet" size="md" variant="light" radius="md">
                      <IconMotorbike size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={500}>Delivery Out for Drop-Off</Text>
                      <Text size="xs" c="dimmed">
                        Dispatches rider details & tracking link to guest.
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
            </div>
          </Stack>
        </Paper>

        {/* Master Service Status & Custom Footer Message */}
        <Paper withBorder p="md" radius="md" style={{ display: "flex", flexDirection: "column" }}>
          <Stack gap="md" justify="space-between" style={{ flex: 1 }}>
            <Stack gap="md">
              {/* Master Toggle */}
              <Group justify="space-between" align="center">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon color={config.enabled ? "green" : "gray"} size="lg" radius="md" variant="light">
                    <IconBrandWhatsapp size={22} />
                  </ThemeIcon>
                  <div>
                    <Group gap="xs">
                      <Text fw={700} size="md">Enable WhatsApp Service</Text>
                      <Badge color={config.enabled ? "green" : "gray"} size="xs" variant="light">
                        {config.enabled ? "ACTIVE" : "PAUSED"}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Toggle automated customer notifications on or off across this outlet.
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

              <Divider />

              {/* Custom Footer Message */}
              <div>
                <Text fw={600} size="sm">Custom Message Footer Note</Text>
                <Text size="xs" c="dimmed" mb="xs">
                  Appended at the bottom of all automated WhatsApp messages (e.g. feedback links, review requests).
                </Text>
                <TextInput
                  value={config.customFooterNote}
                  onChange={(e) => setConfig((p) => ({ ...p, customFooterNote: e.target.value }))}
                  placeholder="e.g. Thank you for dining with us! Review us on Google."
                  disabled={!config.enabled}
                />
              </div>

              {/* Message Footer Preview */}
              <Box
                p="xs"
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px dashed #86efac",
                  borderRadius: 8,
                }}
              >
                <Text size="11px" fw={600} c="teal.9" mb={2}>Message Preview Footer:</Text>
                <Text size="xs" c="dark.7" fs="italic">
                  "{config.customFooterNote || "Thank you for dining with us!"}"
                </Text>
              </Box>
            </Stack>
          </Stack>
        </Paper>
      </SimpleGrid>

      {/* Side-by-side cards for large screens */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* Owner End-of-Day Business Closing Report */}
        <Paper withBorder p="md" radius="md" style={{ display: "flex", flexDirection: "column" }}>
          <Stack gap="md" justify="space-between" style={{ flex: 1 }}>
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <ThemeIcon color="teal" size="lg" variant="light" radius="md">
                    <IconReceipt size={22} />
                  </ThemeIcon>
                  <div>
                    <Group gap="xs" wrap="wrap">
                      <Text fw={700} size="md">Owner End-of-Day Business Closing Report</Text>
                      <Badge color="green" size="xs" variant="light">11:59 PM Daily</Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mt={2}>
                      Sends an informative daily closing digest with total sales, cash vs UPI, expenses, net cash in drawer, and top dishes directly to the owner.
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

              <TextInput
                label="Owner WhatsApp Mobile Number"
                placeholder="e.g. 9876543210"
                description="10-digit mobile number for daily closing reports"
                value={config.ownerClosingReportPhone}
                onChange={(e) => setConfig((p) => ({ ...p, ownerClosingReportPhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                leftSection={<IconBrandWhatsapp size={16} color="green" />}
              />
            </Stack>

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
          </Stack>
        </Paper>

        {/* Interactive Test WhatsApp Messenger */}
        <Paper withBorder p="md" radius="md" style={{ backgroundColor: "#f9fcf9", display: "flex", flexDirection: "column" }}>
          <Stack gap="md" justify="space-between" style={{ flex: 1 }}>
            <Stack gap="sm">
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <ThemeIcon color="green" size="lg" variant="light" radius="md">
                  <IconSend size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={700} size="md">Test WhatsApp Notification</Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    Verify real-time delivery by dispatching a sample message to your phone number.
                  </Text>
                </div>
              </Group>

              <TextInput
                label="Recipient Mobile Number"
                description="10-digit mobile number to receive test message"
                placeholder="e.g. 9876543210"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                leftSection={<IconBrandWhatsapp size={16} color="green" />}
              />
            </Stack>

            <Button
              color="green"
              loading={testing}
              onClick={handleSendTest}
              leftSection={<IconBrandWhatsapp size={16} />}
              fullWidth
            >
              Send Test Message
            </Button>
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
