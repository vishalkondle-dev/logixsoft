"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
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
  Switch,
  Center,
  Loader,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconTableAlias,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";
import { useUrlFilters } from "../use-url-filters";
import { DependentOutletSelect } from "../dependent-outlet-select";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

function TablesContent() {
  const { restaurants } = useAdmin();
  const { getFilter, setFilter, setFilters, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const restaurantFilter = getFilter("restaurantId", "ALL");
  const outletFilter = getFilter("outletId", "ALL");
  const sectionFilter = getFilter("section", "ALL");

  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [createOpened, setCreateOpened] = useState(false);
  const [editOpened, setEditOpened] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    restaurantId: "",
    outletId: "",
    name: "",
    section: "Main Floor",
    capacity: 4,
  });
  const [editForm, setEditForm] = useState({
    name: "",
    section: "Main Floor",
    capacity: 4,
    active: true,
  });

  // Server-side filtering
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (restaurantFilter && restaurantFilter !== "ALL") params.set("restaurantId", restaurantFilter);
      if (outletFilter && outletFilter !== "ALL") params.set("outletId", outletFilter);
      if (sectionFilter && sectionFilter !== "ALL") params.set("section", sectionFilter);

      const res = await fetch(`${API_BASE}/admin/tables?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setTables(Array.isArray(d) ? d : d.tables || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, restaurantFilter, outletFilter, sectionFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!createForm.restaurantId || !createForm.outletId || !createForm.name) {
      notifications.show({ title: "Validation Error", message: "Restaurant, outlet and table name required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create table");
      notifications.show({ title: "Table Created", message: `Added ${createForm.name}`, color: "teal" });
      setCreateOpened(false);
      setCreateForm({ restaurantId: "", outletId: "", name: "", section: "Main Floor", capacity: 4 });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedTable) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tables/${selectedTable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update table");
      notifications.show({ title: "Table Updated", message: "Changes saved.", color: "teal" });
      setEditOpened(false);
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tableId: string) => {
    if (!confirm("Are you sure you want to delete this dining table?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/tables/${tableId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      notifications.show({ title: "Table Removed", message: "Dining table deleted.", color: "teal" });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const distinctSections = Array.from(new Set(tables.map((t) => t.section).filter(Boolean)));
  const filtered = tables;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Dining Tables Directory
          </Text>
          <Text size="sm" c="dimmed">
            Manage floor layouts, table numbers, sections, guest capacity, and QR codes across all branches.
          </Text>
        </div>
        <Button
          color="dinePrimary"
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateOpened(true)}
        >
          Add Table
        </Button>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by table name, section, or store..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setFilter("search", e.target.value)}
            w={{ base: "100%", sm: 260 }}
            size="xs"
          />
          <Select
            placeholder="Filter by Restaurant"
            data={[
              { value: "ALL", label: "🌐 All Restaurants" },
              ...restaurants.map((r) => ({ value: r.id, label: r.name })),
            ]}
            value={restaurantFilter}
            onChange={(val) => {
              setFilters({
                restaurantId: val || "ALL",
                outletId: "ALL",
              });
            }}
            w={{ base: "100%", sm: 190 }}
            size="xs"
          />
          <DependentOutletSelect
            restaurantId={restaurantFilter}
            value={outletFilter}
            onChange={(val) => setFilter("outletId", val)}
            isFilter
            filterAllLabel="All Outlets"
            size="xs"
            w={{ base: "100%", sm: 170 }}
          />
          {distinctSections.length > 0 && (
            <Select
              placeholder="Section"
              data={[
                { value: "ALL", label: "All Sections" },
                ...distinctSections.map((sec) => ({ value: sec, label: sec })),
              ]}
              value={sectionFilter}
              onChange={(val) => setFilter("section", val || "ALL")}
              w={{ base: "100%", sm: 150 }}
              size="xs"
            />
          )}
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
            Showing {filtered.length} of {tables.length} Tables
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
                <Table.Th>Table / Identifier</Table.Th>
                <Table.Th>Floor Section</Table.Th>
                <Table.Th>Outlet Branch</Table.Th>
                <Table.Th>Restaurant</Table.Th>
                <Table.Th>Guest Capacity</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No dining tables found matching criteria.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((tbl) => (
                  <Table.Tr key={tbl.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconTableAlias size={18} color="#7950f2" />
                        <Text fw={700} size="sm">
                          {tbl.name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" color="indigo">
                        {tbl.section || "Main Floor"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{tbl.outletName || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{tbl.restaurantName || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{tbl.capacity || 2} Guests</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={tbl.active !== false ? "green" : "gray"}>
                        {tbl.active !== false ? "AVAILABLE" : "INACTIVE"}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap="xs" justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="dinePrimary"
                          size="sm"
                          onClick={() => {
                            setSelectedTable(tbl);
                            setEditForm({
                              name: tbl.name || "",
                              section: tbl.section || "Main Floor",
                              capacity: tbl.capacity || 4,
                              active: tbl.active !== false,
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
                          onClick={() => handleDelete(tbl.id)}
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

      {/* Modal: Create Dining Table */}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={<Text fw={700}>Add Dining Table</Text>}
      >
        <Stack gap="sm">
          <Select
            label="Restaurant"
            placeholder="Select Restaurant"
            required
            data={restaurants.map((r) => ({ value: r.id, label: r.name }))}
            value={createForm.restaurantId}
            onChange={(v) => {
              setCreateForm((f) => ({ ...f, restaurantId: v || "", outletId: "" }));
            }}
          />
          <DependentOutletSelect
            label="Outlet Branch"
            placeholder="Select Outlet"
            required
            restaurantId={createForm.restaurantId}
            value={createForm.outletId}
            onChange={(v) => setCreateForm((f) => ({ ...f, outletId: v }))}
          />
          <TextInput
            label="Table Name / Number"
            placeholder="e.g. Table 12 / VIP-1"
            required
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Dining Section"
            placeholder="e.g. Terrace / AC Hall / Balcony"
            value={createForm.section}
            onChange={(e) => setCreateForm((f) => ({ ...f, section: e.target.value }))}
          />
          <NumberInput
            label="Guest Capacity"
            min={1}
            value={createForm.capacity}
            onChange={(v) => setCreateForm((f) => ({ ...f, capacity: Number(v || 2) }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreate}>
              Add Table
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit Dining Table */}
      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title={<Text fw={700}>Edit Dining Table</Text>}
      >
        <Stack gap="sm">
          <TextInput
            label="Table Name / Number"
            required
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Dining Section"
            value={editForm.section}
            onChange={(e) => setEditForm((f) => ({ ...f, section: e.target.value }))}
          />
          <NumberInput
            label="Guest Capacity"
            min={1}
            value={editForm.capacity}
            onChange={(v) => setEditForm((f) => ({ ...f, capacity: Number(v || 2) }))}
          />
          <Switch
            label="Active / Available"
            checked={editForm.active}
            onChange={(e) => setEditForm((f) => ({ ...f, active: e.currentTarget.checked }))}
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

export default function TablesPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <TablesContent />
    </Suspense>
  );
}
