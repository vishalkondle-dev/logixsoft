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
  IconBook,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconFolderPlus,
  IconX,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

function MenuContent() {
  const { restaurants } = useAdmin();
  const { getFilter, setFilter, setFilters, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const restaurantFilter = getFilter("restaurantId", "ALL");
  const categoryFilter = getFilter("categoryId", "ALL");
  const stockFilter = getFilter("stockStatus", "ALL");
  const sortBy = getFilter("sortBy", "name");

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [createItemOpened, setCreateItemOpened] = useState(false);
  const [editItemOpened, setEditItemOpened] = useState(false);
  const [createCatOpened, setCreateCatOpened] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Forms
  const [itemForm, setItemForm] = useState({
    restaurantId: "",
    categoryId: "",
    name: "",
    pricePaise: 25000,
    description: "",
    available: true,
  });
  const [editItemForm, setEditItemForm] = useState({
    name: "",
    pricePaise: 25000,
    description: "",
    categoryId: "",
    available: true,
  });
  const [catForm, setCatForm] = useState({
    restaurantId: "",
    name: "",
  });

  // Server-side filtering
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (restaurantFilter && restaurantFilter !== "ALL") params.set("restaurantId", restaurantFilter);
      if (categoryFilter && categoryFilter !== "ALL") params.set("categoryId", categoryFilter);
      if (stockFilter && stockFilter !== "ALL") {
        params.set("stockStatus", stockFilter === "AVAILABLE" ? "IN_STOCK" : "OUT_OF_STOCK");
      }
      if (sortBy) params.set("sortBy", sortBy);

      const [itemsRes, catsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/menu/items?${params.toString()}`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/menu/categories`, { credentials: "include" }),
      ]);
      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setMenuItems(Array.isArray(d) ? d : d.items || []);
      }
      if (catsRes.ok) {
        const d = await catsRes.json();
        setCategories(Array.isArray(d) ? d : d.categories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, restaurantFilter, categoryFilter, stockFilter, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateItem = async () => {
    if (!itemForm.restaurantId || !itemForm.name) {
      notifications.show({ title: "Validation Error", message: "Restaurant and dish name required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/menu/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(itemForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create menu item");
      notifications.show({ title: "Dish Added", message: `Added ${itemForm.name} to catalog.`, color: "teal" });
      setCreateItemOpened(false);
      setItemForm({ restaurantId: "", categoryId: "", name: "", pricePaise: 25000, description: "", available: true });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditMenuItem = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/menu/items/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editItemForm),
      });
      if (!res.ok) throw new Error("Failed to update item");
      notifications.show({ title: "Dish Updated", message: "Menu item saved.", color: "teal" });
      setEditItemOpened(false);
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStock = async (itemId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/menu/items/${itemId}/toggle-stock`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Toggle stock failed");
      const d = await res.json();
      notifications.show({
        title: "Stock Status Updated",
        message: d.isAvailable ? "Item marked available" : "Item marked 86 / Out of Stock",
        color: d.isAvailable ? "teal" : "orange",
      });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this menu dish?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/menu/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      notifications.show({ title: "Dish Deleted", message: "Item removed from catalog.", color: "teal" });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleCreateCategory = async () => {
    if (!catForm.restaurantId || !catForm.name) {
      notifications.show({ title: "Validation Error", message: "Restaurant and category name required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/menu/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(catForm),
      });
      if (!res.ok) throw new Error("Failed to create category");
      notifications.show({ title: "Category Created", message: `Added ${catForm.name}`, color: "teal" });
      setCreateCatOpened(false);
      setCatForm({ restaurantId: "", name: "" });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Server-side filtered and sorted
  const filtered = menuItems;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Menu Catalogs & Offerings
          </Text>
          <Text size="sm" c="dimmed">
            Manage multi-tenant dishes, categories, pricing, and 86 stock availability.
          </Text>
        </div>
        <Group>
          <Button
            variant="light"
            color="dinePrimary"
            leftSection={<IconFolderPlus size={16} />}
            onClick={() => {
              setCatForm({
                restaurantId: restaurantFilter !== "ALL" ? restaurantFilter : "",
                name: "",
              });
              setCreateCatOpened(true);
            }}
          >
            Add Category
          </Button>
          <Button
            color="dinePrimary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setItemForm({
                restaurantId: restaurantFilter !== "ALL" ? restaurantFilter : "",
                categoryId: (restaurantFilter !== "ALL" && categoryFilter !== "ALL") ? categoryFilter : "",
                name: "",
                pricePaise: 25000,
                description: "",
                available: true,
              });
              setCreateItemOpened(true);
            }}
          >
            Add Menu Item
          </Button>
        </Group>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by dish name, category, or store..."
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
                categoryId: "ALL",
              });
            }}
            w={{ base: "100%", sm: 190 }}
            size="xs"
          />
          <Select
            placeholder="Category"
            data={[
              { value: "ALL", label: "All Categories" },
              ...(restaurantFilter !== "ALL"
                ? categories.filter((c) => c.restaurantId === restaurantFilter)
                : categories
              ).map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={categoryFilter}
            onChange={(val) => setFilter("categoryId", val || "ALL")}
            w={{ base: "100%", sm: 150 }}
            size="xs"
          />
          <Select
            placeholder="Stock Status"
            data={[
              { value: "ALL", label: "All Stock Statuses" },
              { value: "AVAILABLE", label: "In Stock" },
              { value: "OUT_OF_STOCK", label: "86 (Out of Stock)" },
            ]}
            value={stockFilter}
            onChange={(val) => setFilter("stockStatus", val || "ALL")}
            w={{ base: "100%", sm: 150 }}
            size="xs"
          />
          <Select
            placeholder="Sort By"
            data={[
              { value: "name", label: "Name (A-Z)" },
              { value: "price_asc", label: "Price: Low to High" },
              { value: "price_desc", label: "Price: High to Low" },
              { value: "category", label: "Category" },
              { value: "newest", label: "Newest First" },
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
            Showing {filtered.length} of {menuItems.length} Dishes
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
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Dish Name</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Restaurant</Table.Th>
                <Table.Th>Price (₹)</Table.Th>
                <Table.Th>86 Stock Switch</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No menu items found matching criteria.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconBook size={16} color="#7950f2" />
                        <div>
                          <Text fw={700} size="sm">
                            {item.name}
                          </Text>
                          {item.description && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {item.description}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="outline" color="indigo">
                        {item.categoryName || "General"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{item.restaurantName || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={700}>
                        ₹{((item.pricePaise || 0) / 100).toLocaleString("en-IN")}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        size="xs"
                        color="teal"
                        checked={item.isAvailable !== false}
                        onChange={() => handleToggleStock(item.id)}
                        label={item.isAvailable !== false ? "In Stock" : "86 Out"}
                      />
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap="xs" justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="dinePrimary"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setEditItemForm({
                              name: item.name || "",
                              pricePaise: item.pricePaise || 0,
                              description: item.description || "",
                              categoryId: item.categoryId || "",
                              available: item.isAvailable !== false,
                            });
                            setEditItemOpened(true);
                          }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDeleteItem(item.id)}
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
          </Table.ScrollContainer>
        )}
      </Card>

      {/* Modal: Add Menu Item */}
      <Modal
        opened={createItemOpened}
        onClose={() => setCreateItemOpened(false)}
        title={<Text fw={700}>Add Menu Item to Catalog</Text>}
        centered
        size="md"
      >
        <Stack gap="sm">
          <Select
            label="Restaurant"
            placeholder="Select Restaurant"
            required
            data={restaurants.map((r) => ({ value: r.id, label: r.name }))}
            value={itemForm.restaurantId}
            onChange={(v) => setItemForm((f) => ({ ...f, restaurantId: v || "", categoryId: "" }))}
          />
          <Select
            label="Category"
            placeholder={itemForm.restaurantId ? "Select Category" : "Select Restaurant first..."}
            disabled={!itemForm.restaurantId}
            data={categories
              .filter((c) => c.restaurantId === itemForm.restaurantId)
              .map((c) => ({ value: c.id, label: c.name }))}
            value={itemForm.categoryId}
            onChange={(v) => setItemForm((f) => ({ ...f, categoryId: v || "" }))}
          />
          <TextInput
            label="Dish Name"
            placeholder="e.g. Truffle Butter Naan"
            required
            value={itemForm.name}
            onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
          />
          <NumberInput
            label="Price (₹)"
            min={0}
            value={itemForm.pricePaise / 100}
            onChange={(v) => setItemForm((f) => ({ ...f, pricePaise: Math.round(Number(v || 0) * 100) }))}
          />
          <TextInput
            label="Description"
            placeholder="Key ingredients, allergens..."
            value={itemForm.description}
            onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateItemOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateItem}>
              Add Dish
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit Menu Item */}
      <Modal
        opened={editItemOpened}
        onClose={() => setEditItemOpened(false)}
        title={<Text fw={700}>Edit Menu Item</Text>}
        centered
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Dish Name"
            required
            value={editItemForm.name}
            onChange={(e) => setEditItemForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            label="Category"
            placeholder="Select Category"
            data={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={editItemForm.categoryId}
            onChange={(v) => setEditItemForm((f) => ({ ...f, categoryId: v || "" }))}
          />
          <NumberInput
            label="Price (₹)"
            min={0}
            value={editItemForm.pricePaise / 100}
            onChange={(v) => setEditItemForm((f) => ({ ...f, pricePaise: Math.round(Number(v || 0) * 100) }))}
          />
          <TextInput
            label="Description"
            value={editItemForm.description}
            onChange={(e) => setEditItemForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Switch
            label="Item Available in Stock (86 Switch)"
            checked={editItemForm.available}
            onChange={(e) => setEditItemForm((f) => ({ ...f, available: e.currentTarget.checked }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditItemOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleSaveEditMenuItem}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Add Category */}
      <Modal
        opened={createCatOpened}
        onClose={() => setCreateCatOpened(false)}
        title={<Text fw={700}>Add Menu Category</Text>}
        centered
        size="md"
      >
        <Stack gap="sm">
          <Select
            label="Restaurant"
            placeholder="Select Restaurant"
            required
            data={restaurants.map((r) => ({ value: r.id, label: r.name }))}
            value={catForm.restaurantId}
            onChange={(v) => setCatForm((f) => ({ ...f, restaurantId: v || "" }))}
          />
          <TextInput
            label="Category Name"
            placeholder="e.g. Starters / Desserts / Beverages"
            required
            value={catForm.name}
            onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateCatOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateCategory}>
              Add Category
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
