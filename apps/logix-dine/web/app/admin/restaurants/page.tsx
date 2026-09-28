"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import {
  Stack,
  Group,
  Text,
  Card,
  Table,
  Badge,
  Button,
  ActionIcon,
  Menu,
  Modal,
  TextInput,
  Select,
  Center,
  Loader,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingStore,
  IconPlus,
  IconSearch,
  IconDotsVertical,
  IconLogin,
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconX,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

function RestaurantsContent() {
  const { handleEnterStore, fetchGlobalMetadata } = useAdmin();
  const { getFilter, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const statusFilter = getFilter("status", "ALL");
  const sortBy = getFilter("sortBy", "recent");

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [createOpened, setCreateOpened] = useState(false);
  const [editOpened, setEditOpened] = useState(false);
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [selectedRest, setSelectedRest] = useState<any>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: "",
    address: "",
    phone: "",
    currency: "INR",
    status: "ACTIVE",
    ownerPhone: "",
    ownerName: "",
    outletName: "Main Branch",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    phone: "",
    currency: "INR",
    status: "ACTIVE",
    ownerPhone: "",
  });

  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);

  // Server-side filtering
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (sortBy) params.set("sortBy", sortBy);

      const res = await fetch(`${API_BASE}/admin/restaurants?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setRestaurants(Array.isArray(d) ? d : d.restaurants || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.ownerPhone) {
      notifications.show({ title: "Validation Error", message: "Store name and owner phone are required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create store");
      notifications.show({ title: "Store Created", message: `Provisioned ${createForm.name}`, color: "teal" });
      setCreateOpened(false);
      setCreateForm({
        name: "",
        address: "",
        phone: "",
        currency: "INR",
        status: "ACTIVE",
        ownerPhone: "",
        ownerName: "",
        outletName: "Main Branch",
      });
      loadData();
      fetchGlobalMetadata();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedRest) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants/${selectedRest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update store");
      notifications.show({ title: "Store Updated", message: "Changes saved.", color: "teal" });
      setEditOpened(false);
      loadData();
      fetchGlobalMetadata();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRest) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants/${selectedRest.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete store");
      notifications.show({ title: "Store Deleted", message: `${selectedRest.name} was removed.`, color: "teal" });
      setDeleteOpened(false);
      loadData();
      fetchGlobalMetadata();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = restaurants;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Restaurants & Stores Governance
          </Text>
          <Text size="sm" c="dimmed">
            Manage multi-tenant restaurant profiles, branding configurations, and primary outlets.
          </Text>
        </div>
        <Button
          color="dinePrimary"
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateOpened(true)}
        >
          Add Restaurant
        </Button>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by store name, slug, or owner phone..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setFilter("search", e.target.value)}
            w={{ base: "100%", sm: 300 }}
            size="xs"
          />
          <Select
            placeholder="Status"
            data={[
              { value: "ALL", label: "All Statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "TRIAL", label: "Trial" },
              { value: "SUSPENDED", label: "Suspended" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            value={statusFilter}
            onChange={(val) => setFilter("status", val || "ALL")}
            w={{ base: "100%", sm: 140 }}
            size="xs"
          />
          <Select
            placeholder="Sort By"
            data={[
              { value: "recent", label: "Most Recent" },
              { value: "name", label: "Name (A-Z)" },
              { value: "outlets", label: "Outlets Count" },
            ]}
            value={sortBy}
            onChange={(val) => setFilter("sortBy", val || "recent")}
            w={{ base: "100%", sm: 150 }}
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
            Showing {filtered.length} of {restaurants.length} Stores
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
                <Table.Th>Store Name</Table.Th>
                <Table.Th>Owner Mobile</Table.Th>
                <Table.Th>Outlets</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created Date</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No restaurants found matching criteria.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconBuildingStore size={18} color="#7950f2" />
                        <div>
                          <Text fw={700} size="sm">
                            {r.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            /{r.slug || r.id?.slice(0, 8)}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{r.ownerPhone || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color="indigo">
                        {r.outletsCount || 1} Outlets
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={r.status === "ACTIVE" ? "green" : "gray"}>
                        {r.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{new Date(r.createdAt).toLocaleDateString()}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap="xs" justify="flex-end">
                        <Button
                          size="xs"
                          variant="light"
                          color="indigo"
                          leftSection={<IconLogin size={14} />}
                          onClick={() => handleEnterStore(r)}
                        >
                          Enter POS
                        </Button>
                        <Menu position="bottom-end" shadow="md">
                          <Menu.Target>
                            <ActionIcon variant="subtle" size="sm">
                              <IconDotsVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEdit size={16} />}
                              onClick={() => {
                                setSelectedRest(r);
                                setEditForm({
                                  name: r.name || "",
                                  address: r.address || "",
                                  phone: r.phone || "",
                                  currency: r.currency || "INR",
                                  status: r.status || "ACTIVE",
                                  ownerPhone: r.ownerPhone || "",
                                });
                                setEditOpened(true);
                              }}
                            >
                              Edit Store
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              leftSection={<IconTrash size={16} />}
                              color="red"
                              onClick={() => {
                                setSelectedRest(r);
                                setDeleteOpened(true);
                              }}
                            >
                              Delete Store
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Modal: Create Restaurant */}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={<Text fw={700}>Add New Restaurant Store</Text>}
      >
        <Stack gap="sm">
          <TextInput
            label="Restaurant Name"
            placeholder="e.g. Spice Symphony Urban Diner"
            required
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Address"
            placeholder="e.g. 100 Feet Road, Indiranagar"
            value={createForm.address}
            onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))}
          />
          <TextInput
            label="Store Contact Phone"
            placeholder="e.g. 9876543210"
            value={createForm.phone}
            onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <TextInput
            label="Owner Mobile Number"
            placeholder="+91..."
            required
            value={createForm.ownerPhone}
            onChange={(e) => setCreateForm((f) => ({ ...f, ownerPhone: e.target.value }))}
          />
          <TextInput
            label="Owner Name"
            placeholder="e.g. Ramesh Kumar"
            value={createForm.ownerName}
            onChange={(e) => setCreateForm((f) => ({ ...f, ownerName: e.target.value }))}
          />
          <TextInput
            label="Initial Branch / Outlet Name"
            value={createForm.outletName}
            onChange={(e) => setCreateForm((f) => ({ ...f, outletName: e.target.value }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreate}>
              Create & Provision Store
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit Restaurant */}
      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title={<Text fw={700}>Edit Restaurant Details</Text>}
      >
        <Stack gap="sm">
          <TextInput
            label="Restaurant Name"
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
            label="Store Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <TextInput
            label="Owner Phone"
            value={editForm.ownerPhone}
            onChange={(e) => setEditForm((f) => ({ ...f, ownerPhone: e.target.value }))}
          />
          <Select
            label="Store Status"
            data={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            value={editForm.status}
            onChange={(v) => setEditForm((f) => ({ ...f, status: v || "ACTIVE" }))}
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

      {/* Modal: Delete Restaurant */}
      <Modal
        opened={deleteOpened}
        onClose={() => setDeleteOpened(false)}
        title={
          <Text fw={700} c="red">
            Confirm Store Deletion
          </Text>
        }
      >
        <Stack gap="sm">
          <Text size="sm">
            Are you sure you want to permanently delete <strong>{selectedRest?.name}</strong>?
          </Text>
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            This action cascades and deletes all associated outlets, orders, and menu catalogs.
          </Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setDeleteOpened(false)}>
              Cancel
            </Button>
            <Button color="red" loading={submitting} onClick={handleDelete}>
              Permanently Delete Store
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function RestaurantsPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <RestaurantsContent />
    </Suspense>
  );
}
