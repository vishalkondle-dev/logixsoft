"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Container, Title, Tabs, Stack, Group, Text, Paper, Badge, ActionIcon,
  Button, Modal, TextInput, Textarea, NumberInput, Switch, Select, SimpleGrid,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconEdit, IconTrash, IconCheck, IconGripVertical } from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  getItems, createItem, updateItem, deleteItem, toggleItem,
} from "@/lib/api-client";

export default function MenuPage() {
  const { restaurant } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";

  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);

  const [catModal, setCatModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [catForm, setCatForm] = useState({ name: "", description: "" });
  const [catSaving, setCatSaving] = useState(false);

  const [itemModal, setItemModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [itemForm, setItemForm] = useState({ categoryId: "", name: "", description: "", pricePaise: 0 });
  const [itemSaving, setItemSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!restaurantId) return;
    const cats = await getCategories(restaurantId);
    setCategories(cats);
    if (cats.length && !activeCatId) setActiveCatId(cats[0].id);
  }, [restaurantId, activeCatId]);

  const loadItems = useCallback(async () => {
    if (!restaurantId) return;
    const all = await getItems(restaurantId);
    setItems(all);
  }, [restaurantId]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const saveCategory = async () => {
    setCatSaving(true);
    try {
      if (catModal.editing) {
        await updateCategory(restaurantId, catModal.editing.id, { name: catForm.name, description: catForm.description || null });
      } else {
        await createCategory(restaurantId, { name: catForm.name, description: catForm.description || undefined });
      }
      await loadCategories();
      setCatModal({ open: false, editing: null });
      notifications.show({ title: "Saved", message: "Category saved", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCat = async (cat: any) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await deleteCategory(restaurantId, cat.id);
      await loadCategories();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const saveItem = async () => {
    setItemSaving(true);
    try {
      if (itemModal.editing) {
        await updateItem(restaurantId, itemModal.editing.id, {
          categoryId: itemForm.categoryId,
          name: itemForm.name,
          description: itemForm.description || null,
          pricePaise: itemForm.pricePaise,
        });
      } else {
        await createItem(restaurantId, {
          categoryId: itemForm.categoryId,
          name: itemForm.name,
          description: itemForm.description || undefined,
          pricePaise: itemForm.pricePaise,
        });
      }
      await loadItems();
      setItemModal({ open: false, editing: null });
      notifications.show({ title: "Saved", message: "Item saved", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setItemSaving(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!confirm(`Delete item "${item.name}"?`)) return;
    try {
      await deleteItem(restaurantId, item.id);
      await loadItems();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleToggle = async (item: any) => {
    try {
      await toggleItem(restaurantId, item.id);
      await loadItems();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const itemsForCat = activeCatId ? items.filter((i) => i.categoryId === activeCatId) : items;

  if (!restaurant) return null;

  return (
    <Container size="xl" pt="md" pb={100} px={0}>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Menu</Title>
        <Button color="dinePrimary" leftSection={<IconPlus size={16} />}
          onClick={() => { setItemForm({ categoryId: activeCatId ?? "", name: "", description: "", pricePaise: 0 }); setItemModal({ open: true, editing: null }); }}>
          Add Item
        </Button>
      </Group>

      <Tabs value={activeCatId} onChange={setActiveCatId}>
        <Group mb="xs" align="flex-end">
          <Tabs.List>
            {categories.map((cat) => (
              <Tabs.Tab key={cat.id} value={cat.id}>
                <Group gap={6}>
                  {cat.name}
                  {!cat.active && <Badge size="xs" color="gray">Hidden</Badge>}
                </Group>
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <Button size="xs" variant="light" leftSection={<IconPlus size={12} />}
            onClick={() => { setCatForm({ name: "", description: "" }); setCatModal({ open: true, editing: null }); }}>
            Category
          </Button>
        </Group>

        {categories.map((cat) => (
          <Tabs.Panel key={cat.id} value={cat.id}>
            <Paper withBorder p="xs" mb="xs" radius="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600}>{cat.name}</Text>
                <Group gap="xs">
                  <Switch size="xs" checked={cat.active} onChange={() => updateCategory(restaurantId, cat.id, { active: !cat.active }).then(loadCategories)}
                    label={cat.active ? "Visible" : "Hidden"} />
                  <ActionIcon size="sm" variant="light" onClick={() => { setCatForm({ name: cat.name, description: cat.description ?? "" }); setCatModal({ open: true, editing: cat }); }}>
                    <IconEdit size={14} />
                  </ActionIcon>
                  <ActionIcon size="sm" variant="light" color="red" onClick={() => handleDeleteCat(cat)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
              {itemsForCat.map((item) => (
                <Paper key={item.id} withBorder p="md" radius="md">
                  <Group justify="space-between">
                    <div>
                      <Group gap="xs">
                        <Text fw={500}>{item.name}</Text>
                        {!item.available && <Badge size="xs" color="red">Unavailable</Badge>}
                      </Group>
                      {item.description && <Text size="xs" c="dimmed">{item.description}</Text>}
                    </div>
                    <Group gap="xs">
                      <Text fw={700} c="dinePrimary">₹{(item.pricePaise / 100).toFixed(0)}</Text>
                      <Switch size="xs" checked={item.available} onChange={() => handleToggle(item)} />
                      <ActionIcon size="sm" variant="light" onClick={() => {
                        setItemForm({ categoryId: item.categoryId, name: item.name, description: item.description ?? "", pricePaise: item.pricePaise });
                        setItemModal({ open: true, editing: item });
                      }}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon size="sm" variant="light" color="red" onClick={() => handleDeleteItem(item)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              ))}
              {!itemsForCat.length && (
                <Text c="dimmed" size="sm" ta="center" py="xl">No items in this category yet.</Text>
              )}
            </SimpleGrid>
          </Tabs.Panel>
        ))}
      </Tabs>

      {/* Category Modal */}
      <Modal opened={catModal.open} onClose={() => setCatModal({ open: false, editing: null })} title={catModal.editing ? "Edit Category" : "Add Category"}>
        <Stack>
          <TextInput label="Name" required value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Description" value={catForm.description} onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCatModal({ open: false, editing: null })}>Cancel</Button>
            <Button color="dinePrimary" onClick={saveCategory} loading={catSaving}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Item Modal */}
      <Modal opened={itemModal.open} onClose={() => setItemModal({ open: false, editing: null })} title={itemModal.editing ? "Edit Item" : "Add Item"}>
        <Stack>
          <Select
            label="Category" required
            value={itemForm.categoryId}
            onChange={(v) => v && setItemForm((f) => ({ ...f, categoryId: v }))}
            data={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <TextInput label="Name" required value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Description" value={itemForm.description} onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))} />
          <NumberInput
            label="Price (₹)" required min={0}
            value={itemForm.pricePaise / 100}
            onChange={(v) => setItemForm((f) => ({ ...f, pricePaise: Math.round(Number(v) * 100) }))}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setItemModal({ open: false, editing: null })}>Cancel</Button>
            <Button color="dinePrimary" onClick={saveItem} loading={itemSaving}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
