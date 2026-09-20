"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Container, Title, Tabs, Stack, Group, Text, Paper, Badge, ActionIcon,
  Button, Modal, TextInput, NumberInput, Switch, Select, SimpleGrid, Box,
  Divider, Anchor, Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus, IconEdit, IconTrash, IconCheck, IconPhoto, IconCamera, IconUpload,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCategories, useItems,
  useCreateCategory, useUpdateCategory, useDeleteCategory,
  useCreateItem, useUpdateItem, useDeleteItem, useToggleItem,
  useUploadItemImage,
  qk,
} from "@/lib/queries";
import { updateCategory, uploadItemImage } from "@/lib/api-client";

interface MenuItemCardProps {
  item: any;
  restaurantId: string;
  outletId: string | null;
  onToggle: (item: any) => void;
  onDelete: (item: any) => void;
}

function MenuItemCard({
  item,
  restaurantId,
  outletId,
  onToggle,
  onDelete,
}: MenuItemCardProps) {
  const uploadImageMutation = useUploadItemImage(restaurantId, outletId);
  const cardFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadImageMutation.mutateAsync({ id: item.id, file });
      notifications.show({
        title: "Photo Uploaded",
        message: `Photo updated for ${item.name}`,
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Upload Failed",
        message: err.message || "Failed to upload image",
        color: "red",
      });
    } finally {
      if (cardFileInputRef.current) cardFileInputRef.current.value = "";
    }
  };

  const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;
  const hasAddons = Array.isArray(item.addons) && item.addons.length > 0;
  const displayPrice = hasVariants
    ? `From ₹${(Math.min(...item.variants.map((v: any) => v.pricePaise)) / 100).toFixed(0)}`
    : `₹${(item.pricePaise / 100).toFixed(0)}`;

  return (
    <Paper
      p="sm"
      radius="md"
      style={{
        display: "flex",
        flexDirection: "row",
        gap: "12px",
        alignItems: "stretch",
        position: "relative",
      }}
    >
      <input
        type="file"
        ref={cardFileInputRef}
        accept="image/png,image/jpeg,image/webp,image/avif"
        style={{ display: "none" }}
        onChange={handleQuickUpload}
      />

      {/* Image Thumbnail */}
      <Box
        onClick={() => cardFileInputRef.current?.click()}
        title="Click to upload or change photo"
        style={{
          width: 88,
          height: 88,
          minWidth: 88,
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "#f1f3f5",
          cursor: "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <Stack align="center" justify="center" gap={2}>
            <IconPhoto size={26} color="var(--mantine-color-gray-5)" />
            <Text size="9px" c="dimmed" fw={600}>+ PHOTO</Text>
          </Stack>
        )}
        {uploadImageMutation.isPending && (
          <Box
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Loader size="xs" color="white" />
          </Box>
        )}
      </Box>

      {/* Info & Actions */}
      <Stack justify="space-between" style={{ flex: 1, minWidth: 0 }} gap={4}>
        <div>
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <Anchor
              component={Link}
              href={`/settings/menu/${item.id}`}
              fw={600}
              size="sm"
              c="inherit"
              underline="hover"
              lineClamp={1}
            >
              {item.name}
            </Anchor>
            {!item.available && (
              <Badge size="xs" color="red" variant="light" style={{ flexShrink: 0 }}>
                Unavailable
              </Badge>
            )}
          </Group>

          {item.description ? (
            <Text size="xs" c="dimmed" lineClamp={1} mt={1}>
              {item.description}
            </Text>
          ) : null}

          <Group gap={6} mt={4} wrap="wrap">
            {hasVariants && (
              <Badge size="xs" variant="light" color="blue">
                {item.variants.length} {item.variants.length === 1 ? "variant" : "variants"}
              </Badge>
            )}
            {hasAddons && (
              <Badge size="xs" variant="light" color="violet">
                {item.addons.length} {item.addons.length === 1 ? "addon" : "addons"}
              </Badge>
            )}
          </Group>
        </div>

        <Group justify="space-between" align="center" mt="xs">
          <Text fw={700} size="sm" c="dinePrimary">
            {displayPrice}
          </Text>

          <Group gap={6} align="center">
            <Switch
              size="xs"
              checked={item.available}
              onChange={() => onToggle(item)}
              title={item.available ? "Available in POS" : "Hidden in POS"}
            />
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => cardFileInputRef.current?.click()}
              title="Upload / Change Photo"
            >
              <IconCamera size={15} />
            </ActionIcon>
            <ActionIcon
              component={Link}
              href={`/settings/menu/${item.id}`}
              size="sm"
              variant="light"
              title="Edit item details"
            >
              <IconEdit size={14} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="light"
              color="red"
              onClick={() => onDelete(item)}
              title="Delete item"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
}

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
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

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

      let savedItemId = itemModal.editing?.id;

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
        const res = await createItm.mutateAsync({
          categoryId: itemForm.categoryId,
          name: itemForm.name,
          description: itemForm.description || undefined,
          pricePaise: itemForm.pricePaise,
          outletId,
          variants: cleanVariants,
          addons: cleanAddons,
        });
        savedItemId = res?.id;
      }

      if (savedItemId && itemImageFile) {
        try {
          await uploadItemImage(restaurantId, savedItemId, itemImageFile, outletId);
          queryClient.invalidateQueries({ queryKey: ["items", restaurantId] });
        } catch (imgErr) {
          console.error("Failed to upload image:", imgErr);
        }
      }

      setItemModal({ open: false, editing: null });
      setItemImageFile(null);
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

  if (!restaurant) return null;

  const content = (
    <>
      <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="xs">
        <Group gap="xs" align="center">
          {!embedded && <Title order={2}>Menu Catalog</Title>}
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
              setItemImageFile(null);
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
        <Tabs
          value={activeCatId}
          onChange={setActiveCatId}
          orientation="vertical"
          variant="pills"
          color="dinePrimary"
          styles={{
            root: {
              display: "flex",
              alignItems: "flex-start",
              gap: "20px",
              width: "100%",
            },
            list: {
              width: "230px",
              minWidth: "210px",
              flexShrink: 0,
              gap: "4px",
              paddingRight: "16px",
              borderRight: "1px solid var(--mantine-color-gray-2)",
            },
            tab: {
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "14px",
            },
            panel: {
              flex: 1,
              minWidth: 0,
            },
          }}
        >
          {/* Vertical Categories Sidebar */}
          <Tabs.List>
            <Group justify="space-between" align="center" mb="xs" px="xs">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.5px" }}>
                Categories ({categories.length})
              </Text>
              <ActionIcon
                size="xs"
                variant="light"
                color="dinePrimary"
                onClick={() => { setCatForm({ name: "", description: "" }); setCatModal({ open: true, editing: null }); }}
                title="Add Category"
              >
                <IconPlus size={12} />
              </ActionIcon>
            </Group>

            {categories.map((cat) => {
              const catCount = items.filter((i: any) => i.categoryId === cat.id).length;
              return (
                <Tabs.Tab key={cat.id} value={cat.id}>
                  <Group justify="space-between" w="100%" wrap="nowrap">
                    <Text size="sm" fw={activeCatId === cat.id ? 600 : 500} truncate>
                      {cat.name}
                    </Text>
                    <Group gap={4} wrap="nowrap">
                      {!cat.active && <Badge size="xs" color="gray" variant="subtle">Hidden</Badge>}
                      <Badge
                        size="xs"
                        variant={activeCatId === cat.id ? "filled" : "light"}
                        color={activeCatId === cat.id ? "dinePrimary" : "gray"}
                      >
                        {catCount}
                      </Badge>
                    </Group>
                  </Group>
                </Tabs.Tab>
              );
            })}

            <Button
              variant="subtle"
              color="dinePrimary"
              size="xs"
              fullWidth
              mt="xs"
              leftSection={<IconPlus size={13} />}
              onClick={() => { setCatForm({ name: "", description: "" }); setCatModal({ open: true, editing: null }); }}
              disabled={!outletId}
            >
              New Category
            </Button>
          </Tabs.List>

          {/* Tab Panels with Redesigned Cards */}
          {categories.map((cat) => {
            const catItems = items.filter((i: any) => i.categoryId === cat.id);
            return (
              <Tabs.Panel key={cat.id} value={cat.id}>
                {/* Category Header Bar */}
                <Paper p="sm" mb="md" radius="md">
                  <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                    <div>
                      <Group gap="xs" align="center">
                        <Text size="md" fw={700}>{cat.name}</Text>
                        <Badge size="xs" variant="light" color={cat.active ? "teal" : "gray"}>
                          {cat.active ? "Visible in POS" : "Hidden"}
                        </Badge>
                        <Badge size="xs" variant="outline" color="gray">
                          {catItems.length} {catItems.length === 1 ? "dish" : "dishes"}
                        </Badge>
                      </Group>
                      {cat.description && (
                        <Text size="xs" c="dimmed" mt={2}>
                          {cat.description}
                        </Text>
                      )}
                    </div>

                    <Group gap="xs">
                      <Switch
                        size="xs"
                        checked={cat.active}
                        onChange={() => handleToggleActive(cat)}
                        label={cat.active ? "Visible" : "Hidden"}
                      />
                      <ActionIcon
                        size="sm"
                        variant="light"
                        onClick={() => { setCatForm({ name: cat.name, description: cat.description ?? "" }); setCatModal({ open: true, editing: cat }); }}
                        title="Edit category"
                      >
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="red"
                        onClick={() => handleDeleteCat(cat)}
                        title="Delete category"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                      <Button
                        size="xs"
                        color="dinePrimary"
                        leftSection={<IconPlus size={13} />}
                        onClick={() => {
                          setItemForm({
                            categoryId: cat.id,
                            name: "",
                            description: "",
                            pricePaise: 0,
                            variants: [],
                            addons: [],
                          });
                          setItemImageFile(null);
                          setItemModal({ open: true, editing: null });
                        }}
                      >
                        Add Dish
                      </Button>
                    </Group>
                  </Group>
                </Paper>

                {/* Grid of Redesigned Dish Cards */}
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  {catItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      restaurantId={restaurantId}
                      outletId={outletId}
                      onToggle={handleToggle}
                      onDelete={handleDeleteItem}
                    />
                  ))}
                </SimpleGrid>

                {!catItems.length && (
                  <Paper p="xl" radius="md" ta="center" my="md">
                    <IconPhoto size={36} color="var(--mantine-color-gray-4)" style={{ margin: "0 auto 8px" }} />
                    <Text c="dimmed" size="sm">No dishes in {cat.name} yet.</Text>
                    <Button
                      size="xs"
                      variant="light"
                      color="dinePrimary"
                      mt="sm"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => {
                        setItemForm({
                          categoryId: cat.id,
                          name: "",
                          description: "",
                          pricePaise: 0,
                          variants: [],
                          addons: [],
                        });
                        setItemImageFile(null);
                        setItemModal({ open: true, editing: null });
                      }}
                    >
                      Add First Dish
                    </Button>
                  </Paper>
                )}
              </Tabs.Panel>
            );
          })}
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

          {/* Dish Image Upload */}
          <Divider label="Dish Photo (optional)" labelPosition="left" mt="xs" />
          <Group align="center" gap="sm">
            {itemImageFile ? (
              <Box
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 6,
                  overflow: "hidden",
                  backgroundColor: "#e9ecef",
                  flexShrink: 0,
                }}
              >
                <img
                  src={URL.createObjectURL(itemImageFile)}
                  alt="Preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </Box>
            ) : null}
            <Button
              size="xs"
              variant="light"
              color="dinePrimary"
              leftSection={<IconPhoto size={14} />}
              onClick={() => modalFileInputRef.current?.click()}
            >
              {itemImageFile ? "Change Photo" : "Select Photo"}
            </Button>
            {itemImageFile && (
              <Button size="xs" variant="subtle" color="red" onClick={() => setItemImageFile(null)}>
                Clear
              </Button>
            )}
            <input
              type="file"
              ref={modalFileInputRef}
              accept="image/png,image/jpeg,image/webp,image/avif"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setItemImageFile(file);
              }}
            />
          </Group>

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
