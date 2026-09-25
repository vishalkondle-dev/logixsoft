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
  Select,
  Badge,
  Box,
  CopyButton,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconQrcode,
  IconCheck,
  IconAlertCircle,
  IconCopy,
  IconExternalLink,
  IconUserCheck,
  IconBellRinging,
  IconCurrencyRupee,
  IconNotes,
} from "@tabler/icons-react";
import { QRCode } from "@gfazioli/mantine-qr-code";
import { notifications } from "@mantine/notifications";
import { useRestaurant } from "@/lib/restaurant-context";
import { useUpdateOutlet, useTables } from "@/lib/queries";

export interface QrMenuConfig {
  allowCustomerOrdering: boolean;
  requireCustomerAuth: boolean;
  allowCallWaiter: boolean;
  allowPayAtTable: boolean;
  allowOrderNotes: boolean;
  welcomeMessage: string;
}

const DEFAULT_QR_CONFIG: QrMenuConfig = {
  allowCustomerOrdering: true,
  requireCustomerAuth: false,
  allowCallWaiter: true,
  allowPayAtTable: true,
  allowOrderNotes: true,
  welcomeMessage: "Welcome! Browse our fresh menu and place your order directly.",
};

export function QrMenuManagement() {
  const { restaurant, outlets, activeOutlet, refresh } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const currentOutlet = activeOutlet || outlets[0];
  const updateOutletMut = useUpdateOutlet(restaurantId);

  const { data: tables = [] } = useTables(restaurantId, currentOutlet?.id);
  const [selectedTable, setSelectedTable] = useState<string>("");

  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].name);
    }
  }, [tables, selectedTable]);

  const [config, setConfig] = useState<QrMenuConfig>(DEFAULT_QR_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOutlet?.qrMenuSettings) {
      try {
        const parsed =
          typeof currentOutlet.qrMenuSettings === "string"
            ? JSON.parse(currentOutlet.qrMenuSettings)
            : currentOutlet.qrMenuSettings;
        if (parsed && typeof parsed.allowCustomerOrdering === "boolean") {
          setConfig({ ...DEFAULT_QR_CONFIG, ...parsed });
          return;
        }
      } catch (err) {
        console.error("Failed to parse qrMenuSettings", err);
      }
    }
    setConfig(DEFAULT_QR_CONFIG);
  }, [currentOutlet]);

  const handleSave = async () => {
    if (!currentOutlet) return;
    setSaving(true);
    try {
      await updateOutletMut.mutateAsync({
        id: currentOutlet.id,
        body: { qrMenuSettings: config },
      });
      await refresh();
      notifications.show({
        title: "QR Menu Settings Saved",
        message: "Customer table ordering preferences have been updated.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Save Failed",
        message: err.message || "Failed to update QR menu settings",
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const previewTable = selectedTable || (tables[0]?.name ?? "T1");
  const tableQrUrl = typeof window !== "undefined"
    ? `${window.location.origin}/menu?outletId=${currentOutlet?.id || ""}&table=${encodeURIComponent(previewTable)}`
    : `https://dine.logixsoft.in/menu?outletId=${currentOutlet?.id || ""}&table=${encodeURIComponent(previewTable)}`;

  return (
    <Stack gap="lg" w="100%">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3} fw={700}>QR Menu & Table Ordering</Title>
          <Text size="sm" c="dimmed">
            Customise the contactless dining experience for guests scanning table QR codes at {currentOutlet?.name || "your outlet"}.
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

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {/* Settings Form Column */}
        <Box style={{ gridColumn: "span 2" }}>
          <Stack gap="md">
            {/* Features switches */}
            <Paper withBorder p="md" radius="md">
              <Stack gap="md">
                <Text fw={600}>Table Self-Ordering Features</Text>

                <Group justify="space-between" align="center">
                  <div>
                    <Text size="sm" fw={500}>Allow Guests to Place Orders</Text>
                    <Text size="xs" c="dimmed">
                      When disabled, the QR menu behaves as a view-only digital catalog.
                    </Text>
                  </div>
                  <Switch
                    checked={config.allowCustomerOrdering}
                    onChange={(e) => {
                      const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                      setConfig((p) => ({ ...p, allowCustomerOrdering: checked }));
                    }}
                    color="teal"
                  />
                </Group>

                <Group justify="space-between" align="center">
                  <div>
                    <Text size="sm" fw={500}>Require Phone OTP Sign-In</Text>
                    <Text size="xs" c="dimmed">
                      Guests must verify mobile number before submitting order tickets.
                    </Text>
                  </div>
                  <Switch
                    checked={config.requireCustomerAuth}
                    onChange={(e) => {
                      const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                      setConfig((p) => ({ ...p, requireCustomerAuth: checked }));
                    }}
                    color="teal"
                  />
                </Group>

                <Group justify="space-between" align="center">
                  <div>
                    <Text size="sm" fw={500}>Enable "Call Waiter" Button</Text>
                    <Text size="xs" c="dimmed">
                      Displays a floor service request button for water, cutlery, or bills.
                    </Text>
                  </div>
                  <Switch
                    checked={config.allowCallWaiter}
                    onChange={(e) => {
                      const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                      setConfig((p) => ({ ...p, allowCallWaiter: checked }));
                    }}
                    color="teal"
                  />
                </Group>

                <Group justify="space-between" align="center">
                  <div>
                    <Text size="sm" fw={500}>Enable "Pay at Table" via UPI</Text>
                    <Text size="xs" c="dimmed">
                      Allows guests to view bill breakdown and pay instantly via UPI QR code.
                    </Text>
                  </div>
                  <Switch
                    checked={config.allowPayAtTable}
                    onChange={(e) => {
                      const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                      setConfig((p) => ({ ...p, allowPayAtTable: checked }));
                    }}
                    color="teal"
                  />
                </Group>

                <Group justify="space-between" align="center">
                  <div>
                    <Text size="sm" fw={500}>Allow Special Instructions / Cooking Notes</Text>
                    <Text size="xs" c="dimmed">
                      Guests can specify customizations (e.g. less spicy, no onion) per item.
                    </Text>
                  </div>
                  <Switch
                    checked={config.allowOrderNotes}
                    onChange={(e) => {
                      const checked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                      setConfig((p) => ({ ...p, allowOrderNotes: checked }));
                    }}
                    color="teal"
                  />
                </Group>
              </Stack>
            </Paper>

            {/* Custom Welcome Message */}
            <Paper withBorder p="md" radius="md">
              <Stack gap="xs">
                <Text fw={600}>Customer Welcome Banner</Text>
                <Text size="xs" c="dimmed">
                  Displayed prominently at the top of the mobile menu when guests scan the QR code.
                </Text>
                <TextInput
                  placeholder="e.g. Welcome to Indiranagar Flagship! Order your favorites directly."
                  value={config.welcomeMessage}
                  onChange={(e) => setConfig((p) => ({ ...p, welcomeMessage: e.target.value }))}
                />
              </Stack>
            </Paper>
          </Stack>
        </Box>

        {/* QR Code Preview Column */}
        <Box>
          <Card withBorder radius="md" p="md" style={{ textAlign: "center" }}>
            <Text fw={600} mb="xs">Live Table QR Preview</Text>
            <Text size="xs" c="dimmed" mb="md">
              Select a table to test scanning and ordering.
            </Text>

            <Select
              data={tables.map((t) => ({ value: t.name, label: t.name }))}
              value={selectedTable}
              onChange={(val) => val && setSelectedTable(val)}
              placeholder="Select table"
              mb="md"
              size="xs"
            />

            <Box
              p="md"
              style={{
                backgroundColor: "#f8f9fa",
                borderRadius: 8,
                display: "inline-block",
                marginBottom: 12,
              }}
            >
              <QRCode value={tableQrUrl} size={150} />
            </Box>

            <Text size="xs" fw={600} c="dark.8">
              Table: {previewTable}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1} mb="md">
              {tableQrUrl}
            </Text>

            <Group justify="center" gap="xs">
              <CopyButton value={tableQrUrl}>
                {({ copied, copy }) => (
                  <Button
                    size="xs"
                    variant="light"
                    color={copied ? "teal" : "gray"}
                    onClick={copy}
                    leftSection={<IconCopy size={14} />}
                  >
                    {copied ? "Copied Link" : "Copy Link"}
                  </Button>
                )}
              </CopyButton>

              <Button
                component="a"
                href={tableQrUrl}
                target="_blank"
                size="xs"
                variant="default"
                leftSection={<IconExternalLink size={14} />}
              >
                Open Menu
              </Button>
            </Group>
          </Card>
        </Box>
      </SimpleGrid>

      <Group justify="flex-end">
        <Button
          color="dinePrimary"
          size="md"
          loading={saving}
          onClick={handleSave}
          leftSection={<IconCheck size={18} />}
        >
          Save QR Menu Settings
        </Button>
      </Group>
    </Stack>
  );
}
