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
  Center,
  Loader,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPackages,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconAlertTriangle,
  IconX,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";
import { useUrlFilters } from "../use-url-filters";
import { DependentOutletSelect } from "../dependent-outlet-select";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

function InventoryContent() {
  const { restaurants } = useAdmin();
  const { getFilter, setFilter, setFilters, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const restaurantFilter = getFilter("restaurantId", "ALL");
  const outletFilter = getFilter("outletId", "ALL");
  const alertFilter = getFilter("stockAlert", "ALL");
  const sortBy = getFilter("sortBy", "name");

  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [createOpened, setCreateOpened] = useState(false);
  const [editOpened, setEditOpened] = useState(false);
  const [selectedInv, setSelectedInv] = useState<any>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    restaurantId: "",
    outletId: "",
    name: "",
    sku: "",
    category: "GENERAL",
    baseUom: "kg",
    currentStock: 10,
    lowStockThreshold: 5,
    costPerBaseUnitPaise: 5000,
  });
  const [editForm, setEditForm] = useState({
    name: "",
    currentStock: 10,
    lowStockThreshold: 5,
    costPerBaseUnitPaise: 5000,
  });

  // Server-side filtering
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (restaurantFilter && restaurantFilter !== "ALL") params.set("restaurantId", restaurantFilter);
      if (outletFilter && outletFilter !== "ALL") params.set("outletId", outletFilter);
      if (alertFilter && alertFilter !== "ALL") params.set("stockAlert", alertFilter);
      if (sortBy) params.set("sortBy", sortBy);

      const res = await fetch(`${API_BASE}/admin/inventory?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setInventory(Array.isArray(d) ? d : d.inventory || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, restaurantFilter, outletFilter, alertFilter, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!createForm.restaurantId || !createForm.outletId || !createForm.name) {
      notifications.show({ title: "Validation Error", message: "Restaurant, outlet and item name required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create inventory item");
      notifications.show({ title: "Inventory Added", message: `Added ${createForm.name}`, color: "teal" });
      setCreateOpened(false);
      setCreateForm({
        restaurantId: "",
        outletId: "",
        name: "",
        sku: "",
        category: "GENERAL",
        baseUom: "kg",
        currentStock: 10,
        lowStockThreshold: 5,
        costPerBaseUnitPaise: 5000,
      });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedInv) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/inventory/${selectedInv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update stock");
      notifications.show({ title: "Stock Updated", message: "Inventory adjusted.", color: "teal" });
      setEditOpened(false);
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (invId: string) => {
    if (!confirm("Are you sure you want to delete this inventory item?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/inventory/${invId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      notifications.show({ title: "Deleted", message: "Stock item removed.", color: "teal" });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const filtered = inventory;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Inventory & Stock BOM Directory
          </Text>
          <Text size="sm" c="dimmed">
            Cross-tenant ingredient tracking, stock levels, recipe costs, and low-inventory alert thresholds.
          </Text>
        </div>
        <Button
          color="dinePrimary"
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            setCreateForm((f) => ({
              ...f,
              restaurantId: restaurantFilter !== "ALL" ? restaurantFilter : "",
              outletId: (restaurantFilter !== "ALL" && outletFilter !== "ALL") ? outletFilter : "",
            }));
            setCreateOpened(true);
          }}
        >
          Add Inventory Item
        </Button>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by ingredient, SKU, or outlet..."
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
          <Select
            placeholder="Stock Status"
            data={[
              { value: "ALL", label: "All Stock Levels" },
              { value: "LOW_STOCK", label: "⚠️ Low Stock Alert" },
              { value: "IN_STOCK", label: "Normal Stock" },
            ]}
            value={alertFilter}
            onChange={(val) => setFilter("stockAlert", val || "ALL")}
            w={{ base: "100%", sm: 160 }}
            size="xs"
          />
          <Select
            placeholder="Sort By"
            data={[
              { value: "name", label: "Item Name (A-Z)" },
              { value: "stock_asc", label: "Stock: Low to High" },
              { value: "stock_desc", label: "Stock: High to Low" },
              { value: "cost_desc", label: "Unit Cost" },
            ]}
            value={sortBy}
            onChange={(val) => setFilter("sortBy", val || "name")}
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
            Showing {filtered.length} of {inventory.length} Items
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
          <Table.ScrollContainer minWidth={750}>
            <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ingredient / Item</Table.Th>
                <Table.Th>Outlet Branch</Table.Th>
                <Table.Th>Restaurant</Table.Th>
                <Table.Th>Current Stock</Table.Th>
                <Table.Th>Reorder Threshold</Table.Th>
                <Table.Th>Unit Cost</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No inventory records found matching criteria.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((inv) => {
                  const isLow = Number(inv.currentStock || 0) <= Number(inv.lowStockThreshold || 0);
                  return (
                    <Table.Tr key={inv.id}>
                      <Table.Td>
                        <Group gap="xs">
                          <IconPackages size={18} color="#7950f2" />
                          <div>
                            <Text fw={700} size="sm">
                              {inv.name}
                            </Text>
                            {inv.sku && (
                              <Text size="xs" c="dimmed">
                                SKU: {inv.sku}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{inv.outletName || "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{inv.restaurantName || "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={700}>
                          {inv.currentStock} {inv.baseUom || "units"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {inv.lowStockThreshold} {inv.baseUom || "units"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          ₹{((inv.costPerBaseUnitPaise || 0) / 100).toFixed(2)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          color={isLow ? "red" : "green"}
                          leftSection={isLow ? <IconAlertTriangle size={10} /> : undefined}
                        >
                          {isLow ? "LOW STOCK" : "NORMAL"}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        <Group gap="xs" justify="flex-end">
                          <ActionIcon
                            variant="subtle"
                            color="dinePrimary"
                            size="sm"
                            onClick={() => {
                              setSelectedInv(inv);
                              setEditForm({
                                name: inv.name || "",
                                currentStock: inv.currentStock || 0,
                                lowStockThreshold: inv.lowStockThreshold || 5,
                                costPerBaseUnitPaise: inv.costPerBaseUnitPaise || 5000,
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
                            onClick={() => handleDelete(inv.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      {/* Modal: Create Inventory Item */}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={<Text fw={700}>Add Inventory Item</Text>}
        centered
        size="md"
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
            label="Outlet"
            placeholder="Select Outlet"
            required
            restaurantId={createForm.restaurantId}
            value={createForm.outletId}
            onChange={(v) => setCreateForm((f) => ({ ...f, outletId: v }))}
          />
          <TextInput
            label="Item Name"
            placeholder="e.g. Basmati Rice / Mozzarella Cheese"
            required
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Group grow>
            <TextInput
              label="Unit of Measure (UOM)"
              placeholder="kg / liters / pcs"
              required
              value={createForm.baseUom}
              onChange={(e) => setCreateForm((f) => ({ ...f, baseUom: e.target.value }))}
            />
            <NumberInput
              label="Current Stock"
              min={0}
              value={createForm.currentStock}
              onChange={(v) => setCreateForm((f) => ({ ...f, currentStock: Number(v || 0) }))}
            />
          </Group>
          <Group grow>
            <NumberInput
              label="Low Stock Alert Threshold"
              min={0}
              value={createForm.lowStockThreshold}
              onChange={(v) => setCreateForm((f) => ({ ...f, lowStockThreshold: Number(v || 0) }))}
            />
            <NumberInput
              label="Cost Per Base Unit (₹)"
              min={0}
              value={createForm.costPerBaseUnitPaise / 100}
              onChange={(v) => setCreateForm((f) => ({ ...f, costPerBaseUnitPaise: Math.round(Number(v || 0) * 100) }))}
            />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreate}>
              Add Stock Item
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit Inventory Item */}
      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title={<Text fw={700}>Edit Inventory Stock</Text>}
        centered
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Item Name"
            required
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Group grow>
            <NumberInput
              label="Current Stock"
              min={0}
              value={editForm.currentStock}
              onChange={(v) => setEditForm((f) => ({ ...f, currentStock: Number(v || 0) }))}
            />
            <NumberInput
              label="Low Stock Alert Threshold"
              min={0}
              value={editForm.lowStockThreshold}
              onChange={(v) => setEditForm((f) => ({ ...f, lowStockThreshold: Number(v || 0) }))}
            />
          </Group>
          <NumberInput
            label="Cost Per Base Unit (₹)"
            min={0}
            value={editForm.costPerBaseUnitPaise / 100}
            onChange={(v) => setEditForm((f) => ({ ...f, costPerBaseUnitPaise: Math.round(Number(v || 0) * 100) }))}
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

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <InventoryContent />
    </Suspense>
  );
}
