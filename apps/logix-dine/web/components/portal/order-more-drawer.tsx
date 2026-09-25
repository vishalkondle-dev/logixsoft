"use client";

import React, { useState, useMemo } from "react";
import {
  Drawer,
  Text,
  Title,
  Button,
  Group,
  Stack,
  TextInput,
  Badge,
  ActionIcon,
  Card,
  SimpleGrid,
  SegmentedControl,
  Tabs,
  Paper,
  Box,
  Divider,
  Loader,
  Center,
  ScrollArea,
  Modal,
} from "@mantine/core";
import {
  IconSearch,
  IconPlus,
  IconMinus,
  IconTrash,
  IconToolsKitchen2,
  IconShoppingBag,
  IconCheck,
  IconX,
  IconNotes,
} from "@tabler/icons-react";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import { notifications } from "@mantine/notifications";
import { useCustomerOutletMenu, useAddCustomerOrderItems } from "@/lib/queries";
import type { CustomerPortalOrder, CustomerMenuItem } from "@/lib/api-client";
import { ItemCustomizationModal, type SelectedCartItem } from "./item-customization-modal";

interface OrderMoreDrawerProps {
  opened: boolean;
  onClose: () => void;
  order: CustomerPortalOrder | null;
  onSuccess?: () => void;
}

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function OrderMoreDrawer({
  opened,
  onClose,
  order,
  onSuccess,
}: OrderMoreDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | "veg" | "nonveg">("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  // Round Cart State
  const [cartItems, setCartItems] = useState<SelectedCartItem[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [roundNote, setRoundNote] = useState("");

  // Customization modal state
  const [customizingItem, setCustomizingItem] = useState<CustomerMenuItem | null>(null);

  const qrSettings = order?.outlet?.qrMenuSettings || (order as any)?.qrMenuSettings;
  const allowOrderNotes = qrSettings?.allowOrderNotes !== false;

  const { data: menuData, isLoading: menuLoading } = useCustomerOutletMenu(order?.outletId);
  const addItemsMutation = useAddCustomerOrderItems();

  const categories = menuData?.categories || [];
  const allItems = menuData?.items || [];

  // Filter items
  const filteredItems = useMemo(() => {
    let result = allItems;

    if (selectedCategoryId !== "all") {
      result = result.filter((it) => it.categoryId === selectedCategoryId);
    }

    if (dietaryFilter === "veg") {
      result = result.filter((it) => !it.isNonVeg);
    } else if (dietaryFilter === "nonveg") {
      result = result.filter((it) => it.isNonVeg);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.description && it.description.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allItems, selectedCategoryId, dietaryFilter, searchQuery]);

  // Handle Quick Add or Customization
  const handleItemClick = (item: CustomerMenuItem) => {
    const hasVariants = item.variants && item.variants.length > 0;
    const hasAddons = item.addons && item.addons.length > 0;

    if (hasVariants || hasAddons) {
      setCustomizingItem(item);
    } else {
      // Direct add
      const existingIdx = cartItems.findIndex(
        (ci) => ci.item.id === item.id && !ci.variantId && ci.addonIds.length === 0
      );

      if (existingIdx >= 0) {
        const updated = [...cartItems];
        updated[existingIdx].qty += 1;
        updated[existingIdx].totalPricePaise = updated[existingIdx].qty * updated[existingIdx].unitPricePaise;
        setCartItems(updated);
      } else {
        const newItem: SelectedCartItem = {
          cartId: `${item.id}-${Date.now()}`,
          item,
          qty: 1,
          addonIds: [],
          addonNames: [],
          addonsPricePaise: 0,
          unitPricePaise: item.pricePaise,
          totalPricePaise: item.pricePaise,
        };
        setCartItems((prev) => [...prev, newItem]);
      }
    }
  };

  const handleAddToCart = (item: SelectedCartItem) => {
    setCartItems((prev) => [...prev, item]);
  };

  const handleUpdateQty = (cartId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((ci) => {
          if (ci.cartId === cartId) {
            const newQty = ci.qty + delta;
            if (newQty <= 0) return null;
            return {
              ...ci,
              qty: newQty,
              totalPricePaise: newQty * ci.unitPricePaise,
            };
          }
          return ci;
        })
        .filter(Boolean) as SelectedCartItem[]
    );
  };

  const handleRemoveFromCart = (cartId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.cartId !== cartId));
  };

  const handleUpdateNote = (cartId: string, note: string) => {
    setCartItems((prev) =>
      prev.map((ci) => (ci.cartId === cartId ? { ...ci, note: note || undefined } : ci))
    );
  };

  const totalCartPaise = useMemo(() => {
    return cartItems.reduce((sum, ci) => sum + ci.totalPricePaise, 0);
  }, [cartItems]);

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((sum, ci) => sum + ci.qty, 0);
  }, [cartItems]);

  const nextRoundNumber = (order?.maxRound || 1) + 1;

  const handleSendToKitchen = async () => {
    if (!order || cartItems.length === 0) return;

    try {
      const payloadItems = cartItems.map((ci) => ({
        itemId: ci.item.id,
        qty: ci.qty,
        variantId: ci.variantId,
        addonIds: ci.addonIds.length > 0 ? ci.addonIds : undefined,
        note: ci.note,
      }));

      const res = await addItemsMutation.mutateAsync({
        orderId: order.id,
        body: {
          items: payloadItems,
          roundNote: roundNote.trim() || undefined,
        },
      });

      notifications.show({
        title: "🍳 Round Placed!",
        message: `${res.message || `Round ${res.round} has been sent to the kitchen!`}`,
        color: "teal",
        icon: <IconCheck size={18} />,
        autoClose: 6000,
      });

      setCartItems([]);
      setRoundNote("");
      setIsReviewOpen(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      notifications.show({
        title: "Failed to place items",
        message: err.message || "An error occurred while sending items to kitchen",
        color: "red",
      });
    }
  };

  if (!order) return null;

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size="lg"
        title={
          <Group justify="space-between" style={{ width: "100%" }} pr="xs">
            <div>
              <Title order={4} style={{ fontSize: 16, fontWeight: 700 }}>
                Order More Items
              </Title>
              <Text size="xs" c="dimmed">
                Table: {order.tableNo} • Round {nextRoundNumber}
              </Text>
            </div>
            {(order.outletName || order.outlet?.name) && (
              <Badge color="violet" variant="light" size="sm">
                {order.outletName || order.outlet?.name}
              </Badge>
            )}
          </Group>
        }
        styles={{
          body: {
            padding: 0,
            display: "flex",
            flexDirection: "column",
            height: "calc(100% - 60px)",
          },
        }}
      >
        <Stack gap="xs" p="md" style={{ borderBottom: "1px solid #f1f3f5" }}>
          {/* Search Bar */}
          <TextInput
            placeholder="Search food, beverages, desserts..."
            leftSection={<IconSearch size={16} />}
            rightSection={
              searchQuery ? (
                <ActionIcon size="xs" variant="subtle" onClick={() => setSearchQuery("")}>
                  <IconX size={12} />
                </ActionIcon>
              ) : null
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            size="sm"
          />

          {/* Veg / Non-Veg filter toggle */}
          <SegmentedControl
            value={dietaryFilter}
            onChange={(v) => setDietaryFilter(v as any)}
            size="xs"
            fullWidth
            data={[
              { label: "All Items", value: "all" },
              {
                label: (
                  <Group gap={4} justify="center">
                    <VegNonVegIcon isNonVeg={false} size={13} />
                    <span>Veg Only</span>
                  </Group>
                ),
                value: "veg",
              },
              {
                label: (
                  <Group gap={4} justify="center">
                    <VegNonVegIcon isNonVeg={true} size={13} />
                    <span>Non-Veg</span>
                  </Group>
                ),
                value: "nonveg",
              },
            ]}
          />

          {/* Category Tabs */}
          {categories.length > 0 && (
            <ScrollArea scrollbarSize={4} offsetScrollbars={false}>
              <Group gap={6} wrap="nowrap" py={2} style={{ display: "flex", flexWrap: "nowrap" }}>
                <Button
                  size="xs"
                  variant={selectedCategoryId === "all" ? "filled" : "light"}
                  color="dinePrimary"
                  radius="xl"
                  style={{ flexShrink: 0 }}
                  onClick={() => setSelectedCategoryId("all")}
                >
                  All ({allItems.length})
                </Button>
                {categories.map((cat) => {
                  const catCount = allItems.filter((i) => i.categoryId === cat.id).length;
                  return (
                    <Button
                      key={cat.id}
                      size="xs"
                      variant={selectedCategoryId === cat.id ? "filled" : "default"}
                      color="dinePrimary"
                      radius="xl"
                      style={{ flexShrink: 0 }}
                      onClick={() => setSelectedCategoryId(cat.id)}
                    >
                      {cat.name} ({catCount})
                    </Button>
                  );
                })}
              </Group>
            </ScrollArea>
          )}
        </Stack>

        {/* Menu Items List */}
        <Box style={{ flex: 1, overflowY: "auto" }} p="md">
          {menuLoading ? (
            <Center py={60}>
              <Loader size="md" color="dinePrimary" />
            </Center>
          ) : filteredItems.length === 0 ? (
            <Center py={60}>
              <Stack align="center" gap="xs">
                <IconToolsKitchen2 size={36} color="#adb5bd" />
                <Text size="sm" c="dimmed">
                  No items match your criteria
                </Text>
              </Stack>
            </Center>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {filteredItems.map((item) => {
                const hasCustomizations =
                  (item.variants && item.variants.length > 0) ||
                  (item.addons && item.addons.length > 0);

                // Check how many of this item is in cart
                const inCartQty = cartItems
                  .filter((ci) => ci.item.id === item.id)
                  .reduce((sum, ci) => sum + ci.qty, 0);

                return (
                  <Card
                    key={item.id}
                    radius="md"
                    withBorder
                    p="sm"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                      borderColor: inCartQty > 0 ? "#af73d7" : "#e9ecef",
                      backgroundColor: inCartQty > 0 ? "rgba(175, 115, 215, 0.03)" : "#fff",
                    }}
                  >
                    <div>
                      <Group justify="space-between" align="flex-start" wrap="nowrap" mb={4}>
                        <Text fw={600} size="sm" lineClamp={1} style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              verticalAlign: "text-top",
                              marginRight: 6,
                            }}
                          >
                            <VegNonVegIcon isNonVeg={item.isNonVeg} size={14} />
                          </span>
                          {item.name}
                        </Text>
                        {inCartQty > 0 && (
                          <Badge size="xs" circle color="dinePrimary">
                            {inCartQty}
                          </Badge>
                        )}
                      </Group>

                      {item.description && (
                        <Text size="xs" c="dimmed" lineClamp={2} mb="xs">
                          {item.description}
                        </Text>
                      )}
                    </div>

                    <Group justify="space-between" align="center" mt="xs">
                      <Text fw={700} size="sm">
                        {formatINR(item.pricePaise)}
                      </Text>

                      <Button
                        size="xs"
                        variant={inCartQty > 0 ? "light" : "outline"}
                        color="dinePrimary"
                        radius="md"
                        leftSection={<IconPlus size={13} />}
                        onClick={() => handleItemClick(item)}
                      >
                        {hasCustomizations ? "Customize" : "Add"}
                      </Button>
                    </Group>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}
        </Box>

        {/* Floating Cart Bar at Bottom of Drawer */}
        {cartItems.length > 0 && (
          <Paper
            p="sm"
            style={{
              boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
              borderTop: "1px solid #dee2e6",
              backgroundColor: "#fff",
            }}
          >
            <Group justify="space-between" align="center">
              <div>
                <Group gap={6}>
                  <IconShoppingBag size={18} color="#af73d7" />
                  <Text fw={700} size="sm">
                    {totalCartCount} {totalCartCount === 1 ? "Item" : "Items"}
                  </Text>
                  <Text size="sm" c="dimmed">•</Text>
                  <Text fw={800} size="md" style={{ color: "#af73d7" }}>
                    {formatINR(totalCartPaise)}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  Will be placed as Round {nextRoundNumber}
                </Text>
              </div>

              <Button
                color="dinePrimary"
                size="sm"
                radius="md"
                onClick={() => setIsReviewOpen(true)}
              >
                Review Round
              </Button>
            </Group>
          </Paper>
        )}
      </Drawer>

      {/* Review & Send Round Modal */}
      <Modal
        opened={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        title={
          <Group gap="xs">
            <IconToolsKitchen2 size={20} color="#af73d7" />
            <Title order={4} style={{ fontSize: 16, fontWeight: 700 }}>
              Review Round {nextRoundNumber}
            </Title>
          </Group>
        }
        centered
        radius="md"
        padding="md"
        size="md"
      >
        <Stack gap="md">
          <Paper p="xs" radius="md" withBorder style={{ backgroundColor: "#f8f9fa" }}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Ordering for Table: <strong>{order.tableNo}</strong>
              </Text>
              <Badge color="orange" size="xs">
                Round {nextRoundNumber}
              </Badge>
            </Group>
          </Paper>

          <Box style={{ maxHeight: 250, overflowY: "auto" }}>
            <Stack gap="xs">
              {cartItems.map((ci) => (
                <Paper key={ci.cartId} p="xs" radius="md" withBorder>
                  <Group justify="space-between" align="center">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={600} size="sm" lineClamp={2} style={{ lineHeight: 1.35 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            verticalAlign: "text-top",
                            marginRight: 6,
                          }}
                        >
                          <VegNonVegIcon isNonVeg={ci.item.isNonVeg} size={13} />
                        </span>
                        {ci.item.name}
                      </Text>
                      {ci.variantName && (
                        <Badge size="xs" variant="light" color="gray" mt={2}>
                          {ci.variantName}
                        </Badge>
                      )}
                      {ci.addonNames.length > 0 && (
                        <Text size="xs" c="dimmed">
                          +{ci.addonNames.join(", ")}
                        </Text>
                      )}
                      {allowOrderNotes && (
                        ci.note ? (
                          <Paper
                            mt={4}
                            p="2px 6px"
                            radius="xs"
                            withBorder
                            style={{
                              backgroundColor: "#fff9db",
                              borderColor: "#ffe066",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <IconNotes size={11} color="#f59f00" />
                            <Text size="10px" fw={600} c="yellow.9">
                              Note: {ci.note}
                            </Text>
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="gray"
                              onClick={() => handleUpdateNote(ci.cartId, "")}
                              title="Remove note"
                            >
                              <IconX size={10} />
                            </ActionIcon>
                          </Paper>
                        ) : (
                          <Button
                            variant="subtle"
                            color="gray"
                            size="compact-xs"
                            leftSection={<IconNotes size={10} />}
                            mt={2}
                            style={{ fontSize: "10px", height: "18px", padding: "0 4px" }}
                            onClick={() => {
                              const input = window.prompt(`Special instructions for ${ci.item.name}:`);
                              if (input !== null) {
                                handleUpdateNote(ci.cartId, input.trim());
                              }
                            }}
                          >
                            + Add instruction note
                          </Button>
                        )
                      )}
                    </div>

                    <Group gap="xs" align="center">
                      <ActionIcon
                        size="sm"
                        variant="default"
                        radius="md"
                        onClick={() => handleUpdateQty(ci.cartId, -1)}
                      >
                        <IconMinus size={12} />
                      </ActionIcon>
                      <Text fw={700} size="sm" style={{ width: 18, textAlign: "center" }}>
                        {ci.qty}
                      </Text>
                      <ActionIcon
                        size="sm"
                        variant="default"
                        radius="md"
                        onClick={() => handleUpdateQty(ci.cartId, 1)}
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                      <Text fw={700} size="sm" style={{ width: 60, textAlign: "right" }}>
                        {formatINR(ci.totalPricePaise)}
                      </Text>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemoveFromCart(ci.cartId)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Box>

          {allowOrderNotes && (
            <TextInput
              label="Special Cooking Instruction for this Round"
              placeholder="e.g. Please serve all breads hot together"
              value={roundNote}
              onChange={(e) => setRoundNote(e.currentTarget.value)}
              size="sm"
              maxLength={150}
            />
          )}

          <Divider />

          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed">
                Round Total
              </Text>
              <Text fw={800} size="lg" style={{ color: "#af73d7" }}>
                {formatINR(totalCartPaise)}
              </Text>
            </div>

            <Group gap="xs">
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsReviewOpen(false)}
                disabled={addItemsMutation.isPending}
              >
                Back to Menu
              </Button>
              <Button
                color="dinePrimary"
                size="sm"
                leftSection={<IconToolsKitchen2 size={16} />}
                loading={addItemsMutation.isPending}
                onClick={handleSendToKitchen}
              >
                Send to Kitchen
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Item Customization Modal */}
      <ItemCustomizationModal
        opened={Boolean(customizingItem)}
        onClose={() => setCustomizingItem(null)}
        item={customizingItem}
        onAddToCart={handleAddToCart}
      />
    </>
  );
}
