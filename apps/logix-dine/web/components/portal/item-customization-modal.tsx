"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Text,
  Title,
  Button,
  Group,
  Stack,
  Radio,
  Checkbox,
  TextInput,
  Badge,
  ActionIcon,
  Divider,
  Paper,
} from "@mantine/core";
import {
  IconPlus,
  IconMinus,
} from "@tabler/icons-react";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import type { CustomerMenuItem } from "@/lib/api-client";

export interface SelectedCartItem {
  cartId: string;
  item: CustomerMenuItem;
  qty: number;
  variantId?: string;
  variantName?: string;
  variantPricePaise?: number;
  addonIds: string[];
  addonNames: string[];
  addonsPricePaise: number;
  unitPricePaise: number;
  totalPricePaise: number;
  note?: string;
}

interface ItemCustomizationModalProps {
  opened: boolean;
  onClose: () => void;
  item: CustomerMenuItem | null;
  onAddToCart: (cartItem: SelectedCartItem) => void;
}

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ItemCustomizationModal({
  opened,
  onClose,
  item,
  onAddToCart,
}: ItemCustomizationModalProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [note, setNote] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  // Initialize selections when item changes
  useEffect(() => {
    if (item) {
      if (item.variants && item.variants.length > 0) {
        setSelectedVariantId(item.variants[0].id);
      } else {
        setSelectedVariantId("");
      }
      setSelectedAddonIds([]);
      setNote("");
      setQty(1);
    }
  }, [item]);

  if (!item) return null;

  const variants = item.variants || [];
  const addons = item.addons || [];

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const basePricePaise = selectedVariant ? selectedVariant.pricePaise : item.pricePaise;

  const selectedAddons = addons.filter((a) => selectedAddonIds.includes(a.id));
  const addonsTotalPaise = selectedAddons.reduce((sum, a) => sum + a.pricePaise, 0);

  const unitPricePaise = basePricePaise + addonsTotalPaise;
  const totalPricePaise = unitPricePaise * qty;

  const handleConfirm = () => {
    const cartItem: SelectedCartItem = {
      cartId: `${item.id}-${selectedVariantId}-${selectedAddonIds.sort().join(",")}-${Date.now()}`,
      item,
      qty,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      variantPricePaise: selectedVariant?.pricePaise,
      addonIds: selectedAddons.map((a) => a.id),
      addonNames: selectedAddons.map((a) => a.name),
      addonsPricePaise: addonsTotalPaise,
      unitPricePaise,
      totalPricePaise,
      note: note.trim() || undefined,
    };
    onAddToCart(cartItem);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs" align="center">
          <VegNonVegIcon isNonVeg={item.isNonVeg} size={16} />
          <div>
            <Title order={4} style={{ fontSize: 16, fontWeight: 700 }}>
              {item.name}
            </Title>
            <Text size="xs" c="dimmed">
              Customize your dish
            </Text>
          </div>
        </Group>
      }
      centered
      radius="md"
      padding="md"
      size="md"
    >
      <Stack gap="md">
        {item.description && (
          <Text size="xs" c="dimmed">
            {item.description}
          </Text>
        )}

        {/* Variants Selector */}
        {variants.length > 0 && (
          <Paper p="sm" radius="md" withBorder>
            <Text size="xs" fw={700} mb="xs" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              Choose Portion / Size <Badge size="xs" color="red">Required</Badge>
            </Text>
            <Radio.Group
              value={selectedVariantId}
              onChange={(val) => setSelectedVariantId(val)}
            >
              <Stack gap="xs">
                {variants.map((v) => (
                  <Radio
                    key={v.id}
                    value={v.id}
                    label={
                      <Group justify="space-between" style={{ width: "100%" }}>
                        <Text size="sm">{v.name}</Text>
                        <Text size="sm" fw={600} c="dimmed">
                          {formatINR(v.pricePaise)}
                        </Text>
                      </Group>
                    }
                  />
                ))}
              </Stack>
            </Radio.Group>
          </Paper>
        )}

        {/* Addons Selector */}
        {addons.length > 0 && (
          <Paper p="sm" radius="md" withBorder>
            <Text size="xs" fw={700} mb="xs" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              Optional Add-ons
            </Text>
            <Checkbox.Group
              value={selectedAddonIds}
              onChange={(vals) => setSelectedAddonIds(vals)}
            >
              <Stack gap="xs">
                {addons.map((a) => (
                  <Checkbox
                    key={a.id}
                    value={a.id}
                    label={
                      <Group justify="space-between" style={{ width: "100%" }}>
                        <Text size="sm">{a.name}</Text>
                        <Text size="sm" fw={600} c="dimmed">
                          +{formatINR(a.pricePaise)}
                        </Text>
                      </Group>
                    }
                  />
                ))}
              </Stack>
            </Checkbox.Group>
          </Paper>
        )}

        {/* Cooking Note */}
        <TextInput
          label="Cooking Instructions / Note"
          placeholder="e.g. Less oil, extra spicy, no onion"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          size="sm"
          maxLength={100}
        />

        <Divider />

        {/* Quantity and Add Button */}
        <Group justify="space-between" align="center">
          <Group gap="xs" align="center">
            <ActionIcon
              variant="default"
              size="md"
              radius="md"
              disabled={qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <IconMinus size={14} />
            </ActionIcon>
            <Text fw={700} size="sm" style={{ width: 24, textAlign: "center" }}>
              {qty}
            </Text>
            <ActionIcon
              variant="default"
              size="md"
              radius="md"
              onClick={() => setQty((q) => q + 1)}
            >
              <IconPlus size={14} />
            </ActionIcon>
          </Group>

          <Button
            color="dinePrimary"
            size="sm"
            radius="md"
            onClick={handleConfirm}
          >
            Add to Round • {formatINR(totalPricePaise)}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
