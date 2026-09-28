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
  Select,
  Center,
  Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingStore,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

function OutletsContent() {
  const { restaurants, fetchGlobalMetadata } = useAdmin();
  const { getFilter, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const restaurantFilter = getFilter("restaurantId", "ALL");
  const statusFilter = getFilter("status", "ALL");

  const [outlets, setOutlets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [createOpened, setCreateOpened] = useState(false);
  const [editOpened, setEditOpened] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<any>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    restaurantId: "",
    name: "",
    address: "",
    phone: "",
    upiId: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    phone: "",
    upiId: "",
  });

  const loadData = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/outlets`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setOutlets(Array.isArray(d) ? d : d.outlets || []);
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
    if (!createForm.restaurantId || !createForm.name) {
      notifications.show({ title: "Validation Error", message: "Parent restaurant and outlet name are required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants/${createForm.restaurantId}/outlets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create outlet");
      notifications.show({ title: "Outlet Added", message: `Provisioned ${createForm.name}`, color: "teal" });
      setCreateOpened(false);
      setCreateForm({ restaurantId: "", name: "", address: "", phone: "", upiId: "" });
      loadData();
      fetchGlobalMetadata();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedOutlet) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/outlets/${selectedOutlet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update outlet");
      notifications.show({ title: "Outlet Updated", message: "Changes saved.", color: "teal" });
      setEditOpened(false);
      loadData();
      fetchGlobalMetadata();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (outletId: string) => {
    if (!confirm("Are you sure you want to delete this outlet?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/outlets/${outletId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete outlet");
      notifications.show({ title: "Outlet Deleted", message: "Outlet record removed.", color: "teal" });
      loadData();
      fetchGlobalMetadata();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const filtered = useMemo(() => {
    return outlets.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        o.name?.toLowerCase().includes(q) ||
        o.address?.toLowerCase().includes(q) ||
        o.phone?.includes(q) ||
        o.upiId?.toLowerCase().includes(q) ||
        o.restaurantName?.toLowerCase().includes(q);

      const matchesRest = restaurantFilter === "ALL" || o.restaurantId === restaurantFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && o.isActive !== false) ||
        (statusFilter === "INACTIVE" && o.isActive === false);

      return matchesSearch && matchesRest && matchesStatus;
    });
  }, [outlets, searchQuery, restaurantFilter, statusFilter]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            All Outlets Directory
          </Text>
          <Text size="sm" c="dimmed">
            Manage physical dining branches, cloud kitchen locations, and UPI routing IDs across all stores.
          </Text>
        </div>
        <Button
          color="dinePrimary"
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateOpened(true)}
        >
          Add Outlet
        </Button>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by outlet name, address, or UPI..."
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
            placeholder="Status"
            data={[
              { value: "ALL", label: "All Statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            value={statusFilter}
            onChange={(val) => setFilter("status", val || "ALL")}
            w={{ base: "100%", sm: 140 }}
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
            Showing {filtered.length} of {outlets.length} Outlets
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
                <Table.Th>Outlet Branch</Table.Th>
                <Table.Th>Parent Restaurant</Table.Th>
                <Table.Th>Address / Location</Table.Th>
                <Table.Th>Contact Phone</Table.Th>
                <Table.Th>UPI ID</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No outlets found matching criteria.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((o) => (
                  <Table.Tr key={o.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconBuildingStore size={18} color="#4c6ef5" />
                        <Text fw={700} size="sm">
                          {o.name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={500}>
                        {o.restaurantName || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {o.address || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{o.phone || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="indigo">
                        {o.upiId || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={o.isActive !== false ? "green" : "gray"}>
                        {o.isActive !== false ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap="xs" justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="dinePrimary"
                          size="sm"
                          onClick={() => {
                            setSelectedOutlet(o);
                            setEditForm({
                              name: o.name || "",
                              address: o.address || "",
                              phone: o.phone || "",
                              upiId: o.upiId || "",
                            });
                            setEditOpened(true);
                          }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDelete(o.id)}
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

      {/* Modal: Create Outlet */}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={<Text fw={700}>Add New Outlet Branch</Text>}
      >
        <Stack gap="sm">
          <Select
            label="Parent Restaurant"
            placeholder="Select Restaurant"
            required
            data={restaurants.map((r) => ({ value: r.id, label: r.name }))}
            value={createForm.restaurantId}
            onChange={(v) => setCreateForm((f) => ({ ...f, restaurantId: v || "" }))}
          />
          <TextInput
            label="Outlet Name"
            placeholder="e.g. Koramangala Hub"
            required
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Address"
            placeholder="e.g. 5th Block, Koramangala"
            value={createForm.address}
            onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))}
          />
          <TextInput
            label="Phone"
            placeholder="e.g. 9876543210"
            value={createForm.phone}
            onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <TextInput
            label="UPI ID for Direct Settlements"
            placeholder="e.g. merchant@icici"
            value={createForm.upiId}
            onChange={(e) => setCreateForm((f) => ({ ...f, upiId: e.target.value }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreate}>
              Add Branch
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit Outlet */}
      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title={<Text fw={700}>Edit Outlet Details</Text>}
      >
        <Stack gap="sm">
          <TextInput
            label="Outlet Name"
            required
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Address"
            value={editForm.address}
            onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
          />
          <TextInput
            label="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <TextInput
            label="UPI ID"
            value={editForm.upiId}
            onChange={(e) => setEditForm((f) => ({ ...f, upiId: e.target.value }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function OutletsPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <OutletsContent />
    </Suspense>
  );
}
