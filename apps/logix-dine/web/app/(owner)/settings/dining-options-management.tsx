"use client";

import React, { useState, useEffect } from "react";
import {
  Paper,
  Stack,
  Text,
  Title,
  Group,
  Switch,
  NumberInput,
  Select,
  Button,
  SimpleGrid,
  Card,
  ThemeIcon,
  Divider,
  Alert,
  Badge,
} from "@mantine/core";
import {
  IconCoffee,
  IconShoppingBag,
  IconMotorbike,
  IconCheck,
  IconAlertCircle,
  IconClock,
  IconCurrencyRupee,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRestaurant } from "@/lib/restaurant-context";
import { useUpdateOutlet } from "@/lib/queries";

export interface DiningOptionsConfig {
  dineInEnabled: boolean;
  takeawayEnabled: boolean;
  deliveryEnabled: boolean;
  defaultOrderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  packagingChargePaise: number;
  deliveryFeePaise: number;
  freeDeliveryThresholdPaise: number;
  minDeliveryOrderPaise: number;
  estimatedDeliveryMinutes: number;
  maxDeliveryRadiusKm: number;
}

const DEFAULT_DINING_CONFIG: DiningOptionsConfig = {
  dineInEnabled: true,
  takeawayEnabled: true,
  deliveryEnabled: true,
  defaultOrderType: "DINE_IN",
  packagingChargePaise: 1500, // ₹15
  deliveryFeePaise: 4000, // ₹40
  freeDeliveryThresholdPaise: 50000, // ₹500
  minDeliveryOrderPaise: 19900, // ₹199
  estimatedDeliveryMinutes: 35,
  maxDeliveryRadiusKm: 10,
};

export function DiningOptionsManagement() {
  const { restaurant, outlets, activeOutlet, refresh } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const currentOutlet = activeOutlet || outlets[0];
  const updateOutletMut = useUpdateOutlet(restaurantId);

  const [config, setConfig] = useState<DiningOptionsConfig>(DEFAULT_DINING_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOutlet?.diningSettings) {
      try {
        const parsed =
          typeof currentOutlet.diningSettings === "string"
            ? JSON.parse(currentOutlet.diningSettings)
            : currentOutlet.diningSettings;
        if (parsed && typeof parsed.dineInEnabled === "boolean") {
          setConfig({ ...DEFAULT_DINING_CONFIG, ...parsed });
          return;
        }
      } catch (err) {
        console.error("Failed to parse diningSettings", err);
      }
    }
    setConfig(DEFAULT_DINING_CONFIG);
  }, [currentOutlet]);

  const handleSave = async () => {
    if (!currentOutlet) return;
    setSaving(true);
    try {
      await updateOutletMut.mutateAsync({
        id: currentOutlet.id,
        body: { diningSettings: config },
      });
      await refresh();
      notifications.show({
        title: "Dining Options Saved",
        message: "Your dining channels and charge configurations have been updated.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Save Failed",
        message: err.message || "Failed to update dining settings",
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChannel = (channel: "dineIn" | "takeaway" | "delivery", enabled: boolean) => {
    if (!enabled) {
      const otherChannelsActive =
        (channel !== "dineIn" && config.dineInEnabled) ||
        (channel !== "takeaway" && config.takeawayEnabled) ||
        (channel !== "delivery" && config.deliveryEnabled);

      if (!otherChannelsActive) {
        notifications.show({
          title: "Action Not Allowed",
          message: "At least one dining channel must remain active for the outlet.",
          color: "red",
          icon: <IconAlertCircle size={16} />,
        });
        return;
      }
    }

    setConfig((prev) => {
      const nextDineIn = channel === "dineIn" ? enabled : prev.dineInEnabled;
      const nextTakeaway = channel === "takeaway" ? enabled : prev.takeawayEnabled;
      const nextDelivery = channel === "delivery" ? enabled : prev.deliveryEnabled;

      let nextDefault = prev.defaultOrderType;
      if (channel === "dineIn" && !enabled && nextDefault === "DINE_IN") {
        nextDefault = nextTakeaway ? "TAKEAWAY" : nextDelivery ? "DELIVERY" : "TAKEAWAY";
      } else if (channel === "takeaway" && !enabled && nextDefault === "TAKEAWAY") {
        nextDefault = nextDineIn ? "DINE_IN" : nextDelivery ? "DELIVERY" : "DINE_IN";
      } else if (channel === "delivery" && !enabled && nextDefault === "DELIVERY") {
        nextDefault = nextDineIn ? "DINE_IN" : nextTakeaway ? "TAKEAWAY" : "DINE_IN";
      }

      return {
        ...prev,
        dineInEnabled: nextDineIn,
        takeawayEnabled: nextTakeaway,
        deliveryEnabled: nextDelivery,
        defaultOrderType: nextDefault,
      };
    });
  };

  const defaultModeOptions = React.useMemo(() => {
    const list: { value: "DINE_IN" | "TAKEAWAY" | "DELIVERY"; label: string }[] = [];
    if (config.dineInEnabled) list.push({ value: "DINE_IN", label: "🍽️ Dine-In (Table Seated)" });
    if (config.takeawayEnabled) list.push({ value: "TAKEAWAY", label: "🛍️ Takeaway (Quick Counter)" });
    if (config.deliveryEnabled) list.push({ value: "DELIVERY", label: "🛵 Direct Delivery (Fleet)" });
    if (list.length === 0) list.push({ value: "TAKEAWAY", label: "🛍️ Takeaway (Quick Counter)" });
    return list;
  }, [config.dineInEnabled, config.takeawayEnabled, config.deliveryEnabled]);

  const selectedDefaultValue = defaultModeOptions.some((o) => o.value === config.defaultOrderType)
    ? config.defaultOrderType
    : defaultModeOptions[0]?.value || "TAKEAWAY";

  return (
    <Stack gap="lg" maw={900}>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3} fw={700}>Dining & Fulfillment Channels</Title>
          <Text size="sm" c="dimmed">
            Toggle available dining modes for {currentOutlet?.name || "your outlet"}, set default order types, and configure delivery charges.
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

      {/* Channel Toggles */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {/* Dine-In */}
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <ThemeIcon color="blue" variant="light" size="lg" radius="md">
              <IconCoffee size={20} />
            </ThemeIcon>
            <Switch
              checked={config.dineInEnabled}
              onChange={(e) => handleToggleChannel("dineIn", e.currentTarget.checked)}
              color="blue"
              aria-label="Toggle Dine-In"
            />
          </Group>
          <Text fw={600} size="md">Dine-In Tables</Text>
          <Text size="xs" c="dimmed" mt={4} mb="sm">
            Table management, seated orders, waiter call service, and KOT generation.
          </Text>
          <Badge color={config.dineInEnabled ? "blue" : "gray"} variant="light" size="sm">
            {config.dineInEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </Card>

        {/* Takeaway */}
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <ThemeIcon color="teal" variant="light" size="lg" radius="md">
              <IconShoppingBag size={20} />
            </ThemeIcon>
            <Switch
              checked={config.takeawayEnabled}
              onChange={(e) => handleToggleChannel("takeaway", e.currentTarget.checked)}
              color="teal"
              aria-label="Toggle Takeaway"
            />
          </Group>
          <Text fw={600} size="md">Takeaway / Parcel</Text>
          <Text size="xs" c="dimmed" mt={4} mb="sm">
            Counter pickup, instant parcel packaging, and takeaway tokens.
          </Text>
          <Badge color={config.takeawayEnabled ? "teal" : "gray"} variant="light" size="sm">
            {config.takeawayEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </Card>

        {/* Delivery */}
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <ThemeIcon color="orange" variant="light" size="lg" radius="md">
              <IconMotorbike size={20} />
            </ThemeIcon>
            <Switch
              checked={config.deliveryEnabled}
              onChange={(e) => handleToggleChannel("delivery", e.currentTarget.checked)}
              color="orange"
              aria-label="Toggle Delivery"
            />
          </Group>
          <Text fw={600} size="md">Direct Delivery</Text>
          <Text size="xs" c="dimmed" mt={4} mb="sm">
            Fleet rider dispatch, OTP verification, and doorstep delivery.
          </Text>
          <Badge color={config.deliveryEnabled ? "orange" : "gray"} variant="light" size="sm">
            {config.deliveryEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </Card>
      </SimpleGrid>

      {/* POS Default Channel */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Default POS Order Mode</Text>
          <Text size="xs" c="dimmed">
            The initial channel selected when cashiers open the POS billing screen.
          </Text>
          <Select
            data={defaultModeOptions}
            value={selectedDefaultValue}
            onChange={(val: any) => val && setConfig((p) => ({ ...p, defaultOrderType: val }))}
            maw={320}
          />
        </Stack>
      </Paper>

      {/* Packaging & Charges */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <div>
            <Text fw={600}>Parcel & Packaging Charges</Text>
            <Text size="xs" c="dimmed">Applied automatically to Takeaway and Delivery orders.</Text>
          </div>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <NumberInput
              label="Standard Packaging Fee (₹)"
              description="Default packaging charge per order"
              min={0}
              value={config.packagingChargePaise / 100}
              onChange={(v) => setConfig((p) => ({ ...p, packagingChargePaise: Math.round(Number(v || 0) * 100) }))}
              prefix="₹ "
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      {/* Delivery Rules */}
      {config.deliveryEnabled && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <div>
              <Text fw={600}>Delivery Configuration & Fees</Text>
              <Text size="xs" c="dimmed">Set minimum order limits, delivery fee thresholds, and estimated turnaround.</Text>
            </div>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <NumberInput
                label="Standard Delivery Fee (₹)"
                description="Flat delivery cost added to customer invoice"
                min={0}
                value={config.deliveryFeePaise / 100}
                onChange={(v) => setConfig((p) => ({ ...p, deliveryFeePaise: Math.round(Number(v || 0) * 100) }))}
                prefix="₹ "
              />

              <NumberInput
                label="Free Delivery Above (₹)"
                description="Orders exceeding this subtotal receive free delivery"
                min={0}
                value={config.freeDeliveryThresholdPaise / 100}
                onChange={(v) => setConfig((p) => ({ ...p, freeDeliveryThresholdPaise: Math.round(Number(v || 0) * 100) }))}
                prefix="₹ "
              />

              <NumberInput
                label="Minimum Delivery Order (₹)"
                description="Minimum cart value required to place a delivery order"
                min={0}
                value={config.minDeliveryOrderPaise / 100}
                onChange={(v) => setConfig((p) => ({ ...p, minDeliveryOrderPaise: Math.round(Number(v || 0) * 100) }))}
                prefix="₹ "
              />

              <NumberInput
                label="Estimated Delivery Time (Minutes)"
                description="Standard dispatch and drop-off timeframe shown to guests"
                min={10}
                max={180}
                value={config.estimatedDeliveryMinutes}
                onChange={(v) => setConfig((p) => ({ ...p, estimatedDeliveryMinutes: Number(v || 35) }))}
                suffix=" mins"
              />

              <NumberInput
                label="Maximum Delivery Radius (KM)"
                description="Max distance from outlet for direct doorstep orders"
                min={1}
                max={50}
                value={config.maxDeliveryRadiusKm}
                onChange={(v) => setConfig((p) => ({ ...p, maxDeliveryRadiusKm: Number(v || 10) }))}
                suffix=" km"
              />
            </SimpleGrid>
          </Stack>
        </Paper>
      )}

      <Group justify="flex-end">
        <Button
          color="dinePrimary"
          size="md"
          loading={saving}
          onClick={handleSave}
          leftSection={<IconCheck size={18} />}
        >
          Save Dining Options
        </Button>
      </Group>
    </Stack>
  );
}
