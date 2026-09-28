"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import {
  Stack,
  Group,
  Text,
  Card,
  Table,
  Badge,
  Button,
  ActionIcon,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Center,
  Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCalendarEvent,
  IconPlus,
  IconSearch,
  IconTrash,
  IconCheck,
  IconBan,
  IconX,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

const RESV_STATUSES = [
  { value: "ALL", label: "All Statuses" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "SEATED", label: "Seated" },
  { value: "CANCELLED", label: "Cancelled" },
];

function ReservationsContent() {
  const { restaurants, outlets } = useAdmin();
  const { getFilter, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const restaurantFilter = getFilter("restaurantId", "ALL");
  const statusFilter = getFilter("status", "ALL");

  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [createOpened, setCreateOpened] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({
    restaurantId: "",
    outletId: "",
    guestName: "",
    guestPhone: "",
    partySize: 2,
    reservationDate: new Date().toISOString().split("T")[0],
    startTime: "19:00",
    notes: "",
  });

  const loadData = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/reservations`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setReservations(Array.isArray(d) ? d : d.reservations || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!createForm.restaurantId || !createForm.outletId || !createForm.guestName || !createForm.guestPhone) {
      notifications.show({ title: "Validation Error", message: "Restaurant, outlet, guest name and phone required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create reservation");
      notifications.show({ title: "Reservation Booked", message: `Booked for ${createForm.guestName}`, color: "teal" });
      setCreateOpened(false);
      setCreateForm({
        restaurantId: "",
        outletId: "",
        guestName: "",
        guestPhone: "",
        partySize: 2,
        reservationDate: new Date().toISOString().split("T")[0],
        startTime: "19:00",
        notes: "",
      });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (resId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/reservations/${resId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      notifications.show({ title: "Reservation Updated", message: `Marked as ${status}`, color: "teal" });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleDelete = async (resId: string) => {
    if (!confirm("Are you sure you want to delete this reservation?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/reservations/${resId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      notifications.show({ title: "Deleted", message: "Reservation removed.", color: "teal" });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        r.guestName?.toLowerCase().includes(q) ||
        r.guestPhone?.includes(q) ||
        r.restaurantName?.toLowerCase().includes(q);

      const matchesRest = restaurantFilter === "ALL" || r.restaurantId === restaurantFilter;
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;

      return matchesSearch && matchesRest && matchesStatus;
    });
  }, [reservations, searchQuery, restaurantFilter, statusFilter]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Table Reservations Directory
          </Text>
          <Text size="sm" c="dimmed">
            Manage table bookings, guest party sizes, reservation schedules, and seating status.
          </Text>
        </div>
        <Button
          color="dinePrimary"
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateOpened(true)}
        >
          Add Reservation
        </Button>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by guest name, phone, or store..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setFilter("search", e.target.value)}
            w={{ base: "100%", sm: 280 }}
            size="xs"
          />
          <Select
            placeholder="Filter by Restaurant"
            data={[
              { value: "ALL", label: "🌐 All Restaurants" },
              ...restaurants.map((r) => ({ value: r.id, label: r.name })),
            ]}
            value={restaurantFilter}
            onChange={(val) => setFilter("restaurantId", val || "ALL")}
            w={{ base: "100%", sm: 200 }}
            size="xs"
          />
          <Select
            placeholder="Reservation Status"
            data={RESV_STATUSES}
            value={statusFilter}
            onChange={(val) => setFilter("status", val || "ALL")}
            w={{ base: "100%", sm: 160 }}
            size="xs"
          />
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconX size={14} />}
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          )}
          <Badge size="sm" variant="light" color="gray" ml="auto">
            Showing {filtered.length} of {reservations.length} Bookings
          </Badge>
        </Group>
      </Card>

      {/* Main Table */}
      <Card withBorder padding="0" radius="md">
        {loading ? (
          <Center py={60}>
            <Loader color="dinePrimary" />
          </Center>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Guest</Table.Th>
                <Table.Th>Restaurant</Table.Th>
                <Table.Th>Party Size</Table.Th>
                <Table.Th>Date & Time</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No reservations registered.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconCalendarEvent size={18} color="#7950f2" />
                        <div>
                          <Text size="sm" fw={600}>
                            {r.guestName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {r.guestPhone}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{r.restaurantName || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color="indigo">
                        {r.partySize} Guests
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">
                        {r.reservationDate} at {r.startTime}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={
                          r.status === "SEATED"
                            ? "green"
                            : r.status === "CONFIRMED"
                            ? "blue"
                            : "red"
                        }
                      >
                        {r.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap="xs" justify="flex-end">
                        {r.status !== "SEATED" && (
                          <Button
                            size="xs"
                            variant="light"
                            color="green"
                            leftSection={<IconCheck size={14} />}
                            onClick={() => handleUpdateStatus(r.id, "SEATED")}
                          >
                            Seat
                          </Button>
                        )}
                        {r.status !== "CANCELLED" && (
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            leftSection={<IconBan size={14} />}
                            onClick={() => handleUpdateStatus(r.id, "CANCELLED")}
                          >
                            Cancel
                          </Button>
                        )}
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDelete(r.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Modal: Create Reservation */}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={<Text fw={700}>Add Guest Reservation</Text>}
      >
        <Stack gap="sm">
          <Select
            label="Restaurant"
            placeholder="Select Restaurant"
            required
            data={restaurants.map((r) => ({ value: r.id, label: r.name }))}
            value={createForm.restaurantId}
            onChange={(v) => setCreateForm((f) => ({ ...f, restaurantId: v || "" }))}
          />
          <Select
            label="Outlet"
            placeholder="Select Outlet"
            required
            data={outlets
              .filter((o) => !createForm.restaurantId || o.restaurantId === createForm.restaurantId)
              .map((o) => ({ value: o.id, label: o.name }))}
            value={createForm.outletId}
            onChange={(v) => setCreateForm((f) => ({ ...f, outletId: v || "" }))}
          />
          <TextInput
            label="Guest Name"
            placeholder="Guest Name"
            required
            value={createForm.guestName}
            onChange={(e) => setCreateForm((f) => ({ ...f, guestName: e.target.value }))}
          />
          <TextInput
            label="Guest Mobile"
            placeholder="+91..."
            required
            value={createForm.guestPhone}
            onChange={(e) => setCreateForm((f) => ({ ...f, guestPhone: e.target.value }))}
          />
          <Group grow>
            <NumberInput
              label="Party Size"
              min={1}
              value={createForm.partySize}
              onChange={(v) => setCreateForm((f) => ({ ...f, partySize: Number(v || 2) }))}
            />
            <TextInput
              label="Date"
              placeholder="YYYY-MM-DD"
              value={createForm.reservationDate}
              onChange={(e) => setCreateForm((f) => ({ ...f, reservationDate: e.target.value }))}
            />
            <TextInput
              label="Time"
              placeholder="19:00"
              value={createForm.startTime}
              onChange={(e) => setCreateForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreate}>
              Book Table
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <ReservationsContent />
    </Suspense>
  );
}
