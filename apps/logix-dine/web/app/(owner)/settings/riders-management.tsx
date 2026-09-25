"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Paper,
  Stack,
  Text,
  Title,
  Group,
  Button,
  SimpleGrid,
  Card,
  ThemeIcon,
  Badge,
  Table,
  Modal,
  TextInput,
  Select,
  ActionIcon,
  Loader,
  Center,
  SegmentedControl,
} from "@mantine/core";
import {
  IconMotorbike,
  IconPlus,
  IconCheck,
  IconAlertCircle,
  IconExternalLink,
  IconPhone,
  IconUser,
  IconMapPin,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useDeliveryRiders,
  useCreateDeliveryRider,
  useUpdateDeliveryRiderStatus,
} from "@/lib/queries";

export function RidersManagement() {
  const { restaurant, outlets, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const currentOutlet = activeOutlet || outlets[0];
  const outletId = currentOutlet?.id || null;

  const { data: riders = [], isLoading } = useDeliveryRiders(restaurantId, outletId);
  const createRiderMut = useCreateDeliveryRider(restaurantId, outletId);
  const updateRiderStatusMut = useUpdateDeliveryRiderStatus(restaurantId, outletId);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    vehicleType: "BIKE",
    vehicleNumber: "",
  });

  const handleCreate = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      notifications.show({
        title: "Missing Information",
        message: "Rider name and phone number are required.",
        color: "orange",
      });
      return;
    }

    setSaving(true);
    try {
      await createRiderMut.mutateAsync({
        outletId: outletId!,
        name: form.name.trim(),
        phone: form.phone.trim(),
        vehicleType: form.vehicleType,
        vehicleNumber: form.vehicleNumber.trim() || undefined,
      });

      setModalOpen(false);
      setForm({ name: "", phone: "", vehicleType: "BIKE", vehicleNumber: "" });
      notifications.show({
        title: "Rider Added",
        message: `${form.name} has been added to your delivery fleet.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Failed to Add Rider",
        message: err.message || "Failed to create fleet rider",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDutyChange = async (riderId: string, status: "AVAILABLE" | "ON_DELIVERY" | "OFFLINE") => {
    try {
      await updateRiderStatusMut.mutateAsync({ riderId, status });
      notifications.show({
        title: "Rider Duty Updated",
        message: `Rider is now ${status.toLowerCase()}.`,
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({
        title: "Update Failed",
        message: err.message,
        color: "red",
      });
    }
  };

  const availableCount = riders.filter((r) => r.status === "AVAILABLE").length;
  const onDeliveryCount = riders.filter((r) => r.status === "ON_DELIVERY").length;
  const offlineCount = riders.filter((r) => r.status === "OFFLINE").length;

  return (
    <Stack gap="lg" w="100%">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3} fw={700}>Delivery Fleet & Dispatch</Title>
          <Text size="sm" c="dimmed">
            Manage your internal delivery riders, assign duty statuses, and launch dispatch console for {currentOutlet?.name || "your outlet"}.
          </Text>
        </div>
        <Group gap="xs">
          <Button
            component={Link}
            href="/rider"
            variant="light"
            color="orange"
            leftSection={<IconExternalLink size={16} />}
          >
            Live Rider Console
          </Button>
          <Button
            color="dinePrimary"
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpen(true)}
          >
            Add Fleet Rider
          </Button>
        </Group>
      </Group>

      {/* Metric Strip */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">Active & Available</Text>
            <ThemeIcon size={22} radius="xl" color="teal" variant="light">
              <IconCheck size={13} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} c="teal">{availableCount}</Text>
          <Text size="xs" c="dimmed" mt={4}>Ready for instant order assignment</Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">Out for Delivery</Text>
            <ThemeIcon size={22} radius="xl" color="orange" variant="light">
              <IconMotorbike size={13} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} c="orange">{onDeliveryCount}</Text>
          <Text size="xs" c="dimmed" mt={4}>Currently fulfilling doorstep drop-offs</Text>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">Offline / Off-Duty</Text>
            <ThemeIcon size={22} radius="xl" color="gray" variant="light">
              <IconUser size={13} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} c="gray.6">{offlineCount}</Text>
          <Text size="xs" c="dimmed" mt={4}>Not taking orders</Text>
        </Paper>
      </SimpleGrid>

      {/* Fleet Rider Roster Table */}
      <Paper withBorder radius="md">
        {isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : riders.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <ThemeIcon color="orange" variant="light" size={48} radius="xl">
                <IconMotorbike size={24} />
              </ThemeIcon>
              <Text fw={600}>No Delivery Riders Configured</Text>
              <Text size="xs" c="dimmed">
                Add internal delivery drivers to assign orders directly from the POS billing screen.
              </Text>
              <Button size="xs" variant="light" color="dinePrimary" onClick={() => setModalOpen(true)}>
                Add First Fleet Rider
              </Button>
            </Stack>
          </Center>
        ) : (
          <Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Rider Name</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th>Vehicle</Table.Th>
                <Table.Th>Duty Status</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Toggle Duty</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {riders.map((r) => {
                const statusColor =
                  r.status === "AVAILABLE" ? "teal" : r.status === "ON_DELIVERY" ? "orange" : "gray";

                return (
                  <Table.Tr key={r.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <ThemeIcon size={28} radius="xl" variant="light" color={statusColor}>
                          <IconUser size={16} />
                        </ThemeIcon>
                        <div>
                          <Text fw={600} size="sm">{r.name}</Text>
                          {r.activeOrderId && (
                            <Text size="xs" c="orange.7">
                              Fulfilling Order #{r.activeOrderId.slice(-4)}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <IconPhone size={13} color="gray" />
                        <Text size="xs">{r.phone}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="outline" color="dark" size="sm">
                        {r.vehicleType || "BIKE"} {r.vehicleNumber ? `· ${r.vehicleNumber}` : ""}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColor} variant="filled" size="sm">
                        {r.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <SegmentedControl
                        size="xs"
                        value={r.status}
                        onChange={(val: any) => handleDutyChange(r.id, val)}
                        data={[
                          { label: "Available", value: "AVAILABLE" },
                          { label: "Offline", value: "OFFLINE" },
                        ]}
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Add Rider Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={<Text fw={700}>Add Delivery Fleet Rider</Text>}
        size="sm"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Rider Full Name *"
            placeholder="e.g. Ramesh Kumar"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />

          <TextInput
            label="Phone Number *"
            placeholder="10-digit mobile"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
          />

          <Select
            label="Vehicle Type"
            data={[
              { value: "BIKE", label: "Motorcycle" },
              { value: "SCOOTER", label: "Scooter" },
              { value: "BICYCLE", label: "Bicycle" },
              { value: "EV", label: "Electric Scooter" },
            ]}
            value={form.vehicleType}
            onChange={(v) => setForm((p) => ({ ...p, vehicleType: v || "BIKE" }))}
          />

          <TextInput
            label="Vehicle Registration Number (optional)"
            placeholder="e.g. KA-01-AB-1234"
            value={form.vehicleNumber}
            onChange={(e) => setForm((p) => ({ ...p, vehicleNumber: e.target.value }))}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={saving} onClick={handleCreate}>
              Save Rider
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
