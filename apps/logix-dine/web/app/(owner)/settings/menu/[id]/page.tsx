"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Title, Text, Button, Paper, Group, Stack, TextInput,
  Textarea, NumberInput, Switch, Select, Badge, ActionIcon, Modal,
  Loader, Center, Divider, SimpleGrid, Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft, IconTrash, IconCheck, IconPlus,
  IconAlertCircle, IconPhoto, IconUpload,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useItem, useCategories, useUpdateItem, useDeleteItem,
  useUploadItemImage, useDeleteItemImage,
} from "@/lib/queries";

export default function MenuItemPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const router = useRouter();

  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;

  const { data: item, isLoading: itemLoading, error: itemError } = useItem(restaurantId, id, outletId);
  const { data: categories = [] } = useCategories(restaurantId, outletId);

  const updateMutation = useUpdateItem(restaurantId, outletId);
  const deleteMutation = useDeleteItem(restaurantId, outletId);
  const uploadImageMutation = useUploadItemImage(restaurantId, outletId);
  const deleteImageMutation = useDeleteItemImage(restaurantId, outletId);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadImageMutation.mutateAsync({ id, file });
      notifications.show({
        title: "Image Uploaded",
        message: "Dish image successfully updated",
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteImage = async () => {
    if (!confirm("Are you sure you want to remove the image for this item?")) return;
    try {
      await deleteImageMutation.mutateAsync(id);
      notifications.show({
        title: "Image Removed",
        message: "Dish image removed",
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Remove Failed",
        message: err.message || "Failed to remove image",
        color: "red",
      });
    }
  };

  const [form, setForm] = useState<{
    name: string;
    categoryId: string;
    description: string;
    imageUrl: string;
    pricePaise: number;
    available: boolean;
    variants: { id?: string; name: string; pricePaise: number }[];
    addons: { id?: string; name: string; pricePaise: number }[];
  }>({
    name: "",
    categoryId: "",
    description: "",
    imageUrl: "",
    pricePaise: 0,
    available: true,
    variants: [],
    addons: [],
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || "",
        categoryId: item.categoryId || "",
        description: item.description || "",
        imageUrl: item.imageUrl || "",
        pricePaise: item.pricePaise || 0,
        available: item.available !== undefined ? item.available : true,
        variants: Array.isArray(item.variants)
          ? item.variants.map((v: any) => ({ id: v.id, name: v.name, pricePaise: v.pricePaise ?? 0 }))
          : [],
        addons: Array.isArray(item.addons)
          ? item.addons.map((a: any) => ({ id: a.id, name: a.name, pricePaise: a.pricePaise ?? 0 }))
          : [],
      });
    }
  }, [item]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      notifications.show({ title: "Validation", message: "Item name is required", color: "red" });
      return;
    }
    if (!form.categoryId) {
      notifications.show({ title: "Validation", message: "Category is required", color: "red" });
      return;
    }

    const cleanVariants = form.variants
      .filter((v) => v.name.trim().length > 0)
      .map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        name: v.name.trim(),
        pricePaise: Number(v.pricePaise) || 0,
      }));

    const cleanAddons = form.addons
      .filter((a) => a.name.trim().length > 0)
      .map((a) => ({
        ...(a.id ? { id: a.id } : {}),
        name: a.name.trim(),
        pricePaise: Number(a.pricePaise) || 0,
      }));

    try {
      await updateMutation.mutateAsync({
        id,
        body: {
          name: form.name.trim(),
          categoryId: form.categoryId,
          description: form.description.trim() || null,
          imageUrl: form.imageUrl?.trim() || null,
          pricePaise: form.pricePaise,
          available: form.available,
          variants: cleanVariants,
          addons: cleanAddons,
        },
      });
      notifications.show({
        title: "Saved",
        message: "Menu item updated successfully",
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Error saving item",
        message: err.message || "Failed to update item",
        color: "red",
      });
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(id);
      notifications.show({
        title: "Item Deleted",
        message: `"${form.name || "Item"}" was removed from the menu`,
        color: "green",
        icon: <IconCheck size={16} />,
      });
      setDeleteModalOpen(false);
      router.push("/settings/menu");
    } catch (err: any) {
      notifications.show({
        title: "Error deleting item",
        message: err.message || "Failed to delete item",
        color: "red",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (itemLoading) {
    return (
      <Center py={100}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  if (itemError || (!itemLoading && !item)) {
    return (
      <Box py="xl" px={{ base: "xs", sm: "md" }} maw={560} mx="auto">
        <Paper p="xl" radius="md" ta="center">
          <IconAlertCircle size={40} color="#e03131" style={{ margin: "0 auto 12px" }} />
          <Title order={3} mb="xs">Item Not Found</Title>
          <Text c="dimmed" size="sm" mb="lg">
            This menu item may have been removed or does not exist for the current restaurant context.
          </Text>
          <Button
            component={Link}
            href="/settings/menu"
            variant="light"
            color="dinePrimary"
            leftSection={<IconArrowLeft size={16} />}
          >
            Back to Menu
          </Button>
        </Paper>
      </Box>
    );
  }

  const categoryName = categories.find((c) => c.id === form.categoryId)?.name;

  return (
    <Box py="lg" pb={100} px={{ base: "xs", sm: "md" }}>
      {/* Top Navigation & Actions Bar */}
      <Group justify="space-between" align="center" mb="lg" wrap="wrap" gap="xs">
        <Group gap="xs" align="center">
          <Button
            component={Link}
            href="/settings/menu"
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<IconArrowLeft size={16} />}
          >
            Menu
          </Button>
          <Text c="dimmed">/</Text>
          <Text fw={600} size="sm" lineClamp={1} style={{ maxWidth: 220 }}>
            {form.name || "Menu Item"}
          </Text>
        </Group>

        <Group gap="xs">
          <Button
            color="red"
            variant="light"
            size="sm"
            leftSection={<IconTrash size={15} />}
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete
          </Button>
          <Button
            color="dinePrimary"
            size="sm"
            leftSection={<IconCheck size={15} />}
            loading={updateMutation.isPending}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </Group>
      </Group>

      {/* Main Item Card */}
      <Stack gap="md">
        <Paper p="md" radius="md">
          <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
            <div>
              <Group gap="xs" align="center">
                <Title order={3}>{form.name || "Untitled Item"}</Title>
                <Badge color={form.available ? "teal" : "red"} variant="light" size="sm">
                  {form.available ? "Available" : "Unavailable"}
                </Badge>
                {categoryName && (
                  <Badge color="gray" variant="outline" size="sm">
                    {categoryName}
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" mt={2} ff="monospace">
                ID: {id}
              </Text>
            </div>

            <Switch
              label={form.available ? "Available in POS & Online" : "Hidden from POS"}
              checked={form.available}
              onChange={(e) => setForm((f) => ({ ...f, available: e.currentTarget.checked }))}
              color="teal"
            />
          </Group>

          <Divider mb="md" />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Item Name"
              placeholder="e.g. Butter Chicken, Cold Coffee"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />

            <Select
              label="Category"
              placeholder="Select Category"
              required
              value={form.categoryId}
              onChange={(v) => v && setForm((f) => ({ ...f, categoryId: v }))}
              data={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </SimpleGrid>

          <NumberInput
            label="Base Price (₹)"
            description="Base price or default amount when no variant is selected."
            required
            min={0}
            mt="md"
            value={form.pricePaise / 100}
            onChange={(v) => setForm((f) => ({ ...f, pricePaise: Math.round(Number(v) * 100) }))}
          />

          <Textarea
            label="Description (optional)"
            placeholder="Brief details or ingredients shown to customers and staff"
            mt="md"
            minRows={2}
            autosize
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Paper>

        {/* Dish Photo Section */}
        <Paper p="md" radius="md">
          <Group justify="space-between" align="center" mb="xs">
            <div>
              <Text fw={600} size="md">Dish Photo</Text>
              <Text size="xs" c="dimmed">
                Stored in MinIO bucket <Text span ff="monospace">logix-dine</Text>
              </Text>
            </div>
          </Group>

          <Group align="center" gap="lg" mt="sm" wrap="wrap">
            {item?.imageUrl ? (
              <Box
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: "#e9ecef",
                  flexShrink: 0,
                }}
              >
                <img
                  src={item.imageUrl}
                  alt={form.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </Box>
            ) : (
              <Box
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: 10,
                  border: "2px dashed var(--mantine-color-gray-3)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  backgroundColor: "#f8f9fa",
                  flexShrink: 0,
                }}
              >
                <IconPhoto size={36} color="var(--mantine-color-gray-5)" />
                <Text size="xs" c="dimmed" mt={4} ta="center" px="xs">No Photo</Text>
              </Box>
            )}

            <Stack gap="xs" style={{ flex: 1, minWidth: 200 }}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/avif"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <Group gap="xs">
                <Button
                  size="sm"
                  variant="light"
                  color="dinePrimary"
                  leftSection={<IconUpload size={16} />}
                  loading={uploadImageMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {item?.imageUrl ? "Change Photo" : "Upload Photo"}
                </Button>
                {item?.imageUrl && (
                  <Button
                    size="sm"
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    loading={deleteImageMutation.isPending}
                    onClick={handleDeleteImage}
                  >
                    Remove Photo
                  </Button>
                )}
              </Group>
              <TextInput
                size="xs"
                placeholder="Or enter direct image URL (https://...)"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                rightSection={
                  form.imageUrl !== (item?.imageUrl || "") ? (
                    <Button
                      size="compact-xs"
                      color="dinePrimary"
                      onClick={async () => {
                        try {
                          await updateMutation.mutateAsync({
                            id,
                            body: { imageUrl: form.imageUrl.trim() || null },
                          });
                          notifications.show({ title: "Saved", message: "Dish photo URL updated", color: "green", icon: <IconCheck size={16} /> });
                        } catch (err: any) {
                          notifications.show({ title: "Error", message: err.message, color: "red" });
                        }
                      }}
                    >
                      Save URL
                    </Button>
                  ) : null
                }
              />
              <Text size="xs" c="dimmed">
                Upload JPG/PNG dish photos to storage, or paste any direct web image URL.
              </Text>
            </Stack>
          </Group>
        </Paper>

        {/* Variants Section */}
        <Paper p="md" radius="md">
          <Group justify="space-between" align="center" mb="xs">
            <div>
              <Group gap="xs" align="center">
                <Text fw={600} size="md">Variants (Portions & Sizes)</Text>
                {form.variants.length > 0 && (
                  <Badge size="xs" color="blue" variant="light">
                    {form.variants.length}
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                Configure portions like Half / Full or Small / Large. Customers must select one variant when ordering.
              </Text>
            </div>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  variants: [...f.variants, { name: "", pricePaise: f.pricePaise || 0 }],
                }))
              }
            >
              Add Variant
            </Button>
          </Group>

          {form.variants.length === 0 ? (
            <Box py="sm">
              <Text size="sm" c="dimmed" ta="center">
                No variants configured. This item uses the Base Price (₹{(form.pricePaise / 100).toFixed(0)}).
              </Text>
            </Box>
          ) : (
            <Stack gap="xs" mt="sm">
              {form.variants.map((v, index) => (
                <Group key={index} align="flex-end" gap="xs">
                  <TextInput
                    style={{ flex: 1 }}
                    placeholder="e.g. Half, Large"
                    label={index === 0 ? "Variant Name" : undefined}
                    value={v.name}
                    onChange={(e) => {
                      const next = [...form.variants];
                      next[index] = { ...next[index], name: e.target.value };
                      setForm((f) => ({ ...f, variants: next }));
                    }}
                  />
                  <NumberInput
                    style={{ width: 140 }}
                    placeholder="Price"
                    label={index === 0 ? "Price (₹)" : undefined}
                    min={0}
                    value={v.pricePaise / 100}
                    onChange={(val) => {
                      const next = [...form.variants];
                      next[index] = { ...next[index], pricePaise: Math.round(Number(val) * 100) };
                      setForm((f) => ({ ...f, variants: next }));
                    }}
                  />
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    mb={4}
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        variants: f.variants.filter((_, i) => i !== index),
                      }));
                    }}
                    title="Remove variant"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>

        {/* Addons Section */}
        <Paper p="md" radius="md">
          <Group justify="space-between" align="center" mb="xs">
            <div>
              <Group gap="xs" align="center">
                <Text fw={600} size="md">Addons & Extras</Text>
                {form.addons.length > 0 && (
                  <Badge size="xs" color="violet" variant="light">
                    {form.addons.length}
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                Optional customizations like Extra Cheese, Toppings, etc. with optional extra charge (set ₹0 for free).
              </Text>
            </div>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  addons: [...f.addons, { name: "", pricePaise: 0 }],
                }))
              }
            >
              Add Addon
            </Button>
          </Group>

          {form.addons.length === 0 ? (
            <Box py="sm">
              <Text size="sm" c="dimmed" ta="center">
                No addons configured for this item.
              </Text>
            </Box>
          ) : (
            <Stack gap="xs" mt="sm">
              {form.addons.map((a, index) => (
                <Group key={index} align="flex-end" gap="xs">
                  <TextInput
                    style={{ flex: 1 }}
                    placeholder="e.g. Extra Cheese"
                    label={index === 0 ? "Addon Name" : undefined}
                    value={a.name}
                    onChange={(e) => {
                      const next = [...form.addons];
                      next[index] = { ...next[index], name: e.target.value };
                      setForm((f) => ({ ...f, addons: next }));
                    }}
                  />
                  <NumberInput
                    style={{ width: 140 }}
                    placeholder="Price"
                    label={index === 0 ? "Extra Price (₹)" : undefined}
                    min={0}
                    value={a.pricePaise / 100}
                    onChange={(val) => {
                      const next = [...form.addons];
                      next[index] = { ...next[index], pricePaise: Math.round(Number(val) * 100) };
                      setForm((f) => ({ ...f, addons: next }));
                    }}
                  />
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    mb={4}
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        addons: f.addons.filter((_, i) => i !== index),
                      }));
                    }}
                    title="Remove addon"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>

        {/* Bottom Save & Delete Actions */}
        <Paper p="md" radius="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <div>
              <Text fw={600} size="sm">Manage Menu Item</Text>
              <Text size="xs" c="dimmed">
                Save your changes or permanently delete this item from the catalog.
              </Text>
            </div>
            <Group gap="xs">
              <Button
                color="red"
                variant="light"
                leftSection={<IconTrash size={16} />}
                onClick={() => setDeleteModalOpen(true)}
              >
                Delete Item
              </Button>
              <Button
                color="dinePrimary"
                leftSection={<IconCheck size={16} />}
                loading={updateMutation.isPending}
                onClick={handleSave}
              >
                Save Changes
              </Button>
            </Group>
          </Group>
        </Paper>
      </Stack>

      {/* Confirmation Modal for Delete */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Item Deletion"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete <Text span fw={700}>"{form.name || "this item"}"</Text>?
          </Text>
          <Text size="xs" c="dimmed">
            This action is permanent. The item will be immediately removed from POS menus, ordering terminals, and reports. Past orders referencing this item will retain their historical sales snapshot.
          </Text>
          <Group justify="flex-end" gap="xs" mt="xs">
            <Button variant="default" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} loading={deleting} leftSection={<IconTrash size={14} />}>
              Delete Permanently
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
