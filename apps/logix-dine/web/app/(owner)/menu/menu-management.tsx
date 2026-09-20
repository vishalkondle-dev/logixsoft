"use client";

import React, { useState, useEffect } from "react";
import {
  Container, Title, Tabs, Stack, Group, Text, Paper, Badge, ActionIcon,
  Button, Modal, TextInput, Textarea, NumberInput, Switch, Select, SimpleGrid, Box, ScrollArea, Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconEdit, IconTrash, IconCheck } from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCategories, useItems,
  useCreateCategory, useUpdateCategory, useDeleteCategory,
  useCreateItem, useUpdateItem, useDeleteItem, useToggleItem,
  qk,
} from "@/lib/queries";
import { updateCategory } from "@/lib/api-client";

export function MenuManagement({ embedded = false }: { embedded?: boolean }) {
  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;
  const queryClient = useQueryClient();

  const [activeCatId, setActiveCatId] = useState<string | null>(null);

  // Server data via React Query — shared cache with POS page
  const { data: categories = [] } = useCategories(restaurantId, outletId);
  const { data: items = [] } = useItems(restaurantId, outletId);

  // Auto-select first category when data loads
  useEffect(() => {
    setActiveCatId((prev) => (categories.some((c: any) => c.id === prev) ? prev : (categories[0] as any)?.id ?? null));
  }, [categories]);

  const [catModal, setCatModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [catForm, setCatForm] = useState({ name: "", description: "" });

  const [itemModal, setItemModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [itemForm, setItemForm] = useState<{
    categoryId: string;
    name: string;
    description: string;
    pricePaise: number;
    variants: { id?: string; name: string; pricePaise: number }[];
    addons: { id?: string; name: string; pricePaise: number }[];
  }>({
    categoryId: "",
    name: "",
    description: "",
    pricePaise: 0,
    variants: [],
    addons: [],
  });

  // Mutations
  const createCat = useCreateCategory(restaurantId, outletId);
  const updateCat = useUpdateCategory(restaurantId, outletId);
  const deleteCat = useDeleteCategory(restaurantId, outletId);
  const createItm = useCreateItem(restaurantId, outletId);
  const updateItm = useUpdateItem(restaurantId, outletId);
  const deleteItm = useDeleteItem(restaurantId, outletId);
  const toggleItm = useToggleItem(restaurantId, outletId);

  const catSaving = createCat.isPending || updateCat.isPending;
  const itemSaving = createItm.isPending || updateItm.isPending;

  const saveCategory = async () => {
    if (!outletId) return;
    try {
      if (catModal.editing) {
        await updateCat.mutateAsync({ id: catModal.editing.id, body: { name: catForm.name, description: catForm.description || null } });
      } else {
        await createCat.mutateAsync({ name: catForm.name, description: catForm.description || undefined, outletId });
      }
      setCatModal({ open: false, editing: null });
      notifications.show({ title: "Saved", message: "Category saved", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleDeleteCat = async (cat: any) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await deleteCat.mutateAsync(cat.id);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleToggleActive = async (cat: any) => {
    try {
      await updateCategory(restaurantId, cat.id, { active: !cat.active });
      queryClient.invalidateQueries({ queryKey: qk.categories(restaurantId, outletId) });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const saveItem = async () => {
    if (!outletId) return;
    try {
      const cleanVariants = itemForm.variants
        .filter((v) => v.name.trim().length > 0)
        .map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          name: v.name.trim(),
          pricePaise: Number(v.pricePaise) || 0,
        }));
      const cleanAddons = itemForm.addons
        .filter((a) => a.name.trim().length > 0)
        .map((a) => ({
          ...(a.id ? { id: a.id } : {}),
          name: a.name.trim(),
          pricePaise: Number(a.pricePaise) || 0,
        }));

      if (itemModal.editing) {
        await updateItm.mutateAsync({
          id: itemModal.editing.id,
          body: {
            categoryId: itemForm.categoryId,
            name: itemForm.name,
            description: itemForm.description || null,
            pricePaise: itemForm.pricePaise,
            variants: cleanVariants,
            addons: cleanAddons,
          },
        });
      } else {
        await createItm.mutateAsync({
          categoryId: itemForm.categoryId,
          name: itemForm.name,
          description: itemForm.description || undefined,
          pricePaise: itemForm.pricePaise,
          outletId,
          variants: cleanVariants,
          addons: cleanAddons,
        });
      }
      setItemModal({ open: false, editing: null });
      notifications.show({ title: "Saved", message: "Item saved", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!confirm(`Delete item "${item.name}"?`)) return;
    try {
      await deleteItm.mutateAsync(item.id);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleToggle = async (item: any) => {
    try {
      await toggleItm.mutateAsync(item.id);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const itemsForCat = activeCatId ? items.filter((i: any) => i.categoryId === activeCatId) : items;

  if (!restaurant) return null;

  const content = (
    <>
      <Group justify="space-between" align="center" mb="sm" wrap="wrap" gap="xs">
        <Group gap="xs" align="center">
          {!embedded && <Title order={2}>Menu</Title>}
          {activeOutlet && (
            <Badge variant="light" color="dinePrimary" size="md">
              {activeOutlet.name}
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          <Button
            variant="light"
            color="dinePrimary"
            size="sm"
            leftSection={<IconPlus size={14} />}
            onClick={() => { setCatForm({ name: "", description: "" }); setCatModal({ open: true, editing: null }); }}
            disabled={!outletId}
          >
            Category
          </Button>
          <Button
            color="dinePrimary"
            size="sm"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setItemForm({
                categoryId: activeCatId ?? "",
                name: "",
                description: "",
                pricePaise: 0,
                variants: [],
                addons: [],
              });
              setItemModal({ open: true, editing: null });
            }}
            disabled={!outletId || !categories.length}
          >
            Add Item
          </Button>
        </Group>
      </Group>

      {!categories.length ? (
        <Paper p="xl" radius="md" ta="center" my="md">
          <Text size="sm" c="dimmed">
            No menu categories yet for {activeOutlet?.name || "this outlet"}.
          </Text>
          <Button
            size="xs"
            variant="light"
            color="dinePrimary"
            mt="md"
            leftSection={<IconPlus size={14} />}
            onClick={() => { setCatForm({ name: "", description: "" }); setCatModal({ open: true, editing: null }); }}
            disabled={!outletId}
          >
            Create Category
          </Button>
        </Paper>
      ) : (
        <Tabs value={activeCatId} onChange={setActiveCatId}>
          <ScrollArea type="auto" offsetScrollbars={false} scrollbars="x" mb="xs">
            <Tabs.List style={{ flexWrap: "nowrap", width: "max-content", minWidth: "100%" }}>
              {categories.map((cat) => (
                <Tabs.Tab key={cat.id} value={cat.id} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <Group gap={6} wrap="nowrap">
                    {cat.name}
                    {!cat.active && <Badge size="xs" color="gray">Hidden</Badge>}
                  </Group>
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </ScrollArea>

        {categories.map((cat) => (
          <Tabs.Panel key={cat.id} value={cat.id}>
            <Paper p="xs" mb="xs" radius="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600}>{cat.name}</Text>
                <Group gap="xs">
                  <Switch size="xs" checked={cat.active} onChange={() => handleToggleActive(cat)}
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
                <Paper key={item.id} p="md" radius="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Group gap="xs">
                        <Text fw={500}>{item.name}</Text>
                        {!item.available && <Badge size="xs" color="red">Unavailable</Badge>}
                      </Group>
                      {item.description && <Text size="xs" c="dimmed">{item.description}</Text>}
                      <Group gap={6} mt={6} wrap="wrap">
                        {Array.isArray(item.variants) && item.variants.length > 0 && (
                          <Badge size="xs" variant="light" color="blue">
                            {item.variants.length} {item.variants.length === 1 ? "variant" : "variants"}
                          </Badge>
                        )}
                        {Array.isArray(item.addons) && item.addons.length > 0 && (
                          <Badge size="xs" variant="light" color="violet">
                            {item.addons.length} {item.addons.length === 1 ? "addon" : "addons"}
                          </Badge>
                        )}
                      </Group>
                    </div>
                    <Group gap="xs" align="center">
                      <Text fw={700} c="dinePrimary">
                        {Array.isArray(item.variants) && item.variants.length > 0
                          ? `From ₹${(Math.min(...item.variants.map((v: any) => v.pricePaise)) / 100).toFixed(0)}`
                          : `₹${(item.pricePaise / 100).toFixed(0)}`}
                      </Text>
                      <Switch size="xs" checked={item.available} onChange={() => handleToggle(item)} />
                      <ActionIcon size="sm" variant="light" onClick={() => {
                        setItemForm({
                          categoryId: item.categoryId,
                          name: item.name,
                          description: item.description ?? "",
                          pricePaise: item.pricePaise,
                          variants: Array.isArray(item.variants)
                            ? item.variants.map((v: any) => ({ id: v.id, name: v.name, pricePaise: v.pricePaise ?? 0 }))
                            : [],
                          addons: Array.isArray(item.addons)
                            ? item.addons.map((a: any) => ({ id: a.id, name: a.name, pricePaise: a.pricePaise ?? 0 }))
                            : [],
                        });
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
      )}

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
      <Modal opened={itemModal.open} onClose={() => setItemModal({ open: false, editing: null })} title={itemModal.editing ? "Edit Item" : "Add Item"} size="lg">
        <Stack gap="sm">
          <Select
            label="Category" required
            value={itemForm.categoryId}
            onChange={(v) => v && setItemForm((f) => ({ ...f, categoryId: v }))}
            data={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <TextInput label="Name" required value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Description" value={itemForm.description} onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))} />
          <NumberInput
            label="Base Price (₹)" required min={0}
            description="Default price or fallback when no variant is selected."
            value={itemForm.pricePaise / 100}
            onChange={(v) => setItemForm((f) => ({ ...f, pricePaise: Math.round(Number(v) * 100) }))}
          />

          <Divider label="Variants (Portions / Sizes)" labelPosition="left" mt="xs" />
          <Text size="xs" c="dimmed">
            Optional portions or sizes with specific prices (e.g. Half / Full, Regular / Large). When ordering, one variant must be selected.
          </Text>
          {itemForm.variants.map((variant, index) => (
            <Group key={index} align="flex-end" gap="xs">
              <TextInput
                style={{ flex: 1 }}
                placeholder="e.g. Half, Large"
                label={index === 0 ? "Variant Name" : undefined}
                value={variant.name}
                onChange={(e) => {
                  const next = [...itemForm.variants];
                  next[index] = { ...next[index], name: e.target.value };
                  setItemForm((f) => ({ ...f, variants: next }));
                }}
              />
              <NumberInput
                style={{ width: 140 }}
                placeholder="Price"
                label={index === 0 ? "Price (₹)" : undefined}
                min={0}
                value={variant.pricePaise / 100}
                onChange={(v) => {
                  const next = [...itemForm.variants];
                  next[index] = { ...next[index], pricePaise: Math.round(Number(v) * 100) };
                  setItemForm((f) => ({ ...f, variants: next }));
                }}
              />
              <ActionIcon
                color="red"
                variant="subtle"
                mb={4}
                onClick={() => {
                  setItemForm((f) => ({
                    ...f,
                    variants: f.variants.filter((_, i) => i !== index),
                  }));
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="light"
            size="xs"
            w="fit-content"
            leftSection={<IconPlus size={14} />}
            onClick={() =>
              setItemForm((f) => ({
                ...f,
                variants: [...f.variants, { name: "", pricePaise: f.pricePaise || 0 }],
              }))
            }
          >
            Add Variant
          </Button>

          <Divider label="Addons / Customizations" labelPosition="left" mt="xs" />
          <Text size="xs" c="dimmed">
            Optional customizations (e.g. Extra Cheese, Extra Sauce) with additional charges. Free addons can be set to ₹0.
          </Text>
          {itemForm.addons.map((addon, index) => (
            <Group key={index} align="flex-end" gap="xs">
              <TextInput
                style={{ flex: 1 }}
                placeholder="e.g. Extra Cheese"
                label={index === 0 ? "Addon Name" : undefined}
                value={addon.name}
                onChange={(e) => {
                  const next = [...itemForm.addons];
                  next[index] = { ...next[index], name: e.target.value };
                  setItemForm((f) => ({ ...f, addons: next }));
                }}
              />
              <NumberInput
                style={{ width: 140 }}
                placeholder="Price"
                label={index === 0 ? "Extra Price (₹)" : undefined}
                min={0}
                value={addon.pricePaise / 100}
                onChange={(v) => {
                  const next = [...itemForm.addons];
                  next[index] = { ...next[index], pricePaise: Math.round(Number(v) * 100) };
                  setItemForm((f) => ({ ...f, addons: next }));
                }}
              />
              <ActionIcon
                color="red"
                variant="subtle"
                mb={4}
                onClick={() => {
                  setItemForm((f) => ({
                    ...f,
                    addons: f.addons.filter((_, i) => i !== index),
                  }));
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="light"
            size="xs"
            w="fit-content"
            leftSection={<IconPlus size={14} />}
            onClick={() =>
              setItemForm((f) => ({
                ...f,
                addons: [...f.addons, { name: "", pricePaise: 0 }],
              }))
            }
          >
            Add Addon
          </Button>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setItemModal({ open: false, editing: null })}>Cancel</Button>
            <Button color="dinePrimary" onClick={saveItem} loading={itemSaving}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );

  if (embedded) {
    return <Box pt="xs">{content}</Box>;
  }

  return (
    <Container size="xl" pt="sm" pb={100} px={{ base: "sm", sm: "md" }}>
      {content}
    </Container>
  );
}
