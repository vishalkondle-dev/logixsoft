"use client";

import React, { useState } from "react";
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
  NumberInput,
  Select,
  ActionIcon,
  Menu,
  SegmentedControl,
  Loader,
  Center,
  Divider,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconPlus,
  IconCheck,
  IconX,
  IconUserCheck,
  IconUsers,
  IconTableAlias,
  IconClock,
  IconPhone,
  IconDotsVertical,
  IconTrash,
  IconSearch,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useReservations,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
  useTables,
} from "@/lib/queries";

export function ReservationsManagement() {
  const { restaurant, outlets, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const currentOutlet = activeOutlet || outlets[0];
  const outletId = currentOutlet?.id || null;

  const [dateFilter, setDateFilter] = useState<string>("today"); // today | tomorrow | all
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

  const resolvedDate = dateFilter === "today" ? todayStr : dateFilter === "tomorrow" ? tomorrowStr : undefined;
  const resolvedStatus = statusFilter === "all" ? undefined : statusFilter;

  const { data: reservations = [], isLoading } = useReservations(restaurantId, outletId, {
    date: resolvedDate,
    status: resolvedStatus,
  });

  const { data: tables = [] } = useTables(restaurantId, outletId);

  const createResMut = useCreateReservation(restaurantId, outletId);
  const updateResMut = useUpdateReservation(restaurantId, outletId);
  const deleteResMut = useDeleteReservation(restaurantId, outletId);

  // New Reservation Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    partySize: 2,
    reservationDate: todayStr,
    startTime: "19:30",
    endTime: "21:00",
    tableId: "",
    notes: "",
  });

  const handleOpenModal = () => {
    setForm({
      guestName: "",
      guestPhone: "",
      guestEmail: "",
      partySize: 2,
      reservationDate: todayStr,
      startTime: "19:30",
      endTime: "21:00",
      tableId: tables[0]?.id || "",
      notes: "",
    });
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.guestName.trim() || !form.guestPhone.trim() || !form.reservationDate || !form.startTime) {
      notifications.show({
        title: "Missing Information",
        message: "Guest name, phone, date, and start time are required.",
        color: "orange",
      });
      return;
    }

    setSubmitting(true);
    try {
      const selectedTableObj = tables.find((t) => t.id === form.tableId);
      await createResMut.mutateAsync({
        outletId: outletId!,
        guestName: form.guestName.trim(),
        guestPhone: form.guestPhone.trim(),
        guestEmail: form.guestEmail.trim() || null,
        partySize: form.partySize || 2,
        reservationDate: form.reservationDate,
        startTime: form.startTime,
        endTime: form.endTime || null,
        tableId: form.tableId || null,
        tableName: selectedTableObj?.name || null,
        notes: form.notes.trim() || null,
      });

      setModalOpen(false);
      notifications.show({
        title: "Reservation Created",
        message: `Booking confirmed for ${form.guestName} (${form.partySize} guests).`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Booking Failed",
        message: err.message || "Failed to create reservation",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: "CONFIRMED" | "SEATED" | "CANCELLED" | "COMPLETED") => {
    try {
      await updateResMut.mutateAsync({ id, body: { status: newStatus } });
      notifications.show({
        title: "Reservation Updated",
        message: `Status updated to ${newStatus}.`,
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({ title: "Update Failed", message: err.message, color: "red" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteResMut.mutateAsync(id);
      notifications.show({ title: "Reservation Removed", message: "Booking has been deleted.", color: "gray" });
    } catch (err: any) {
      notifications.show({ title: "Delete Failed", message: err.message, color: "red" });
    }
  };

  const filteredReservations = reservations.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.guestName.toLowerCase().includes(q) ||
      r.guestPhone.includes(q) ||
      (r.tableName && r.tableName.toLowerCase().includes(q))
    );
  });

  const confirmedCount = reservations.filter((r) => r.status === "CONFIRMED").length;
  const seatedCount = reservations.filter((r) => r.status === "SEATED").length;
  const completedCount = reservations.filter((r) => r.status === "COMPLETED").length;
  const cancelledCount = reservations.filter((r) => r.status === "CANCELLED").length;

  return (
    <Stack gap="lg" w="100%">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3} fw={700}>Table Reservations</Title>
          <Text size="sm" c="dimmed">
            Manage advance table bookings, party sizes, and guest arrivals for {currentOutlet?.name || "your outlet"}.
          </Text>
        </div>
        <Button
          color="dinePrimary"
          leftSection={<IconPlus size={16} />}
          onClick={handleOpenModal}
        >
          New Reservation
        </Button>
      </Group>

      {/* Metrics Strip */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Confirmed</Text>
          <Text size="xl" fw={700} c="blue">{confirmedCount}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Seated</Text>
          <Text size="xl" fw={700} c="teal">{seatedCount}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Completed</Text>
          <Text size="xl" fw={700} c="gray.7">{completedCount}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">Cancelled</Text>
          <Text size="xl" fw={700} c="red">{cancelledCount}</Text>
        </Paper>
      </SimpleGrid>

      {/* Filters Bar */}
      <Paper withBorder p="sm" radius="md">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="xs" wrap="wrap">
            <SegmentedControl
              size="xs"
              value={dateFilter}
              onChange={setDateFilter}
              data={[
                { label: "Today", value: "today" },
                { label: "Tomorrow", value: "tomorrow" },
                { label: "All Dates", value: "all" },
              ]}
            />
            <SegmentedControl
              size="xs"
              value={statusFilter}
              onChange={setStatusFilter}
              data={[
                { label: "All Status", value: "all" },
                { label: "Confirmed", value: "CONFIRMED" },
                { label: "Seated", value: "SEATED" },
                { label: "Completed", value: "COMPLETED" },
              ]}
            />
          </Group>

          <TextInput
            placeholder="Search guest or phone..."
            size="xs"
            leftSection={<IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            w={220}
          />
        </Group>
      </Paper>

      {/* Reservation List */}
      <Paper withBorder radius="md">
        {isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : filteredReservations.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <ThemeIcon color="pink" variant="light" size={48} radius="xl">
                <IconCalendarEvent size={24} />
              </ThemeIcon>
              <Text fw={600}>No Reservations Found</Text>
              <Text size="xs" c="dimmed">
                No bookings match the selected date and status filters.
              </Text>
              <Button size="xs" variant="light" color="dinePrimary" onClick={handleOpenModal}>
                Create First Reservation
              </Button>
            </Stack>
          </Center>
        ) : (
          <Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Guest</Table.Th>
                <Table.Th>Date & Time</Table.Th>
                <Table.Th>Party Size</Table.Th>
                <Table.Th>Table</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredReservations.map((res) => {
                const statusColor =
                  res.status === "SEATED"
                    ? "teal"
                    : res.status === "CONFIRMED"
                    ? "blue"
                    : res.status === "COMPLETED"
                    ? "gray"
                    : "red";

                return (
                  <Table.Tr key={res.id}>
                    <Table.Td>
                      <div>
                        <Text fw={600} size="sm">{res.guestName}</Text>
                        <Text size="xs" c="dimmed">{res.guestPhone}</Text>
                        {res.notes && (
                          <Text size="xs" c="orange.7" lineClamp={1}>
                            Note: {res.notes}
                          </Text>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <IconClock size={13} color="gray" />
                        <Text size="xs" fw={500}>{res.startTime} - {res.endTime || "Open"}</Text>
                      </Group>
                      <Text size="xs" c="dimmed">{res.reservationDate}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="indigo" size="sm" leftSection={<IconUsers size={12} />}>
                        {res.partySize} Guests
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {res.tableName ? (
                        <Badge variant="outline" color="dark" size="sm" leftSection={<IconTableAlias size={12} />}>
                          {res.tableName}
                        </Badge>
                      ) : (
                        <Text size="xs" c="dimmed">Unassigned</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColor} variant="filled" size="sm">
                        {res.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap={4} justify="flex-end">
                        {res.status === "CONFIRMED" && (
                          <Button
                            size="xs"
                            color="teal"
                            variant="light"
                            onClick={() => handleStatusChange(res.id, "SEATED")}
                          >
                            Seat Guest
                          </Button>
                        )}
                        {res.status === "SEATED" && (
                          <Button
                            size="xs"
                            color="gray"
                            variant="light"
                            onClick={() => handleStatusChange(res.id, "COMPLETED")}
                          >
                            Complete
                          </Button>
                        )}

                        <Menu position="bottom-end" shadow="md">
                          <Menu.Target>
                            <ActionIcon variant="subtle" size="sm" color="gray">
                              <IconDotsVertical size={14} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item onClick={() => handleStatusChange(res.id, "CONFIRMED")}>
                              Mark Confirmed
                            </Menu.Item>
                            <Menu.Item onClick={() => handleStatusChange(res.id, "SEATED")}>
                              Mark Seated
                            </Menu.Item>
                            <Menu.Item onClick={() => handleStatusChange(res.id, "COMPLETED")}>
                              Mark Completed
                            </Menu.Item>
                            <Menu.Item color="orange" onClick={() => handleStatusChange(res.id, "CANCELLED")}>
                              Cancel Reservation
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => handleDelete(res.id)}>
                              Delete
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
        )}
      </Paper>

      {/* New Reservation Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={<Text fw={700}>Add Table Reservation</Text>}
        size="md"
        centered
      >
        <Stack gap="sm">
          <SimpleGrid cols={2}>
            <TextInput
              label="Guest Name *"
              placeholder="e.g. Rahul Sharma"
              value={form.guestName}
              onChange={(e) => setForm((p) => ({ ...p, guestName: e.target.value }))}
              required
            />
            <TextInput
              label="Phone Number *"
              placeholder="10-digit mobile"
              value={form.guestPhone}
              onChange={(e) => setForm((p) => ({ ...p, guestPhone: e.target.value }))}
              required
            />
          </SimpleGrid>

          <SimpleGrid cols={3}>
            <TextInput
              label="Date *"
              type="date"
              value={form.reservationDate}
              onChange={(e) => setForm((p) => ({ ...p, reservationDate: e.target.value }))}
              required
            />
            <TextInput
              label="Start Time *"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
              required
            />
            <TextInput
              label="End Time"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
            />
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <NumberInput
              label="Party Size (Guests)"
              min={1}
              max={50}
              value={form.partySize}
              onChange={(v) => setForm((p) => ({ ...p, partySize: Number(v || 2) }))}
              required
            />
            <Select
              label="Assigned Table (optional)"
              placeholder="Choose table"
              data={tables.map((t) => ({ value: t.id, label: t.name }))}
              value={form.tableId}
              onChange={(v) => setForm((p) => ({ ...p, tableId: v || "" }))}
              clearable
            />
          </SimpleGrid>

          <TextInput
            label="Guest Email (optional)"
            placeholder="guest@example.com"
            value={form.guestEmail}
            onChange={(e) => setForm((p) => ({ ...p, guestEmail: e.target.value }))}
          />

          <TextInput
            label="Special Requests / Notes"
            placeholder="e.g. Birthday anniversary, high chair, window seat"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreate}>
              Confirm Reservation
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
