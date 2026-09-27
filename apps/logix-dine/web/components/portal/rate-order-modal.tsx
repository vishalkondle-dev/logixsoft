"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Stack,
  Group,
  Text,
  Title,
  Rating,
  Button,
  Textarea,
  Switch,
  Chip,
  Paper,
  Box,
  Divider,
  Badge,
} from "@mantine/core";
import {
  IconStar,
  IconCheck,
  IconMessageCircle,
  IconShieldLock,
  IconChefHat,
  IconToolsKitchen2,
  IconMotorbike,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useSubmitOrderFeedback } from "@/lib/queries";
import type { CustomerPortalOrder, OrderFeedbackData } from "@/lib/api-client";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";

interface RateOrderModalProps {
  opened: boolean;
  onClose: () => void;
  order: CustomerPortalOrder | null;
  existingFeedback?: OrderFeedbackData | null;
  onSuccess?: () => void;
}

const PRESET_TAGS = [
  "Delicious Food 🍲",
  "Hot & Fresh ♨️",
  "Generous Portions 🍱",
  "Super Fast ⚡",
  "Neat Packaging 📦",
  "Friendly Service 🤝",
  "Great Value 💰",
  "Authentic Taste 🌶️",
  "Crispy & Tender 🍗",
  "Clean & Hygienic ✨",
];

const RATING_LABELS: Record<number, { text: string; color: string }> = {
  1: { text: "Terrible 😞", color: "red" },
  2: { text: "Could be better 😐", color: "orange" },
  3: { text: "Good 🙂", color: "yellow" },
  4: { text: "Very Good! 😊", color: "teal" },
  5: { text: "Excellent! 🌟", color: "green" },
};

export function RateOrderModal({
  opened,
  onClose,
  order,
  existingFeedback,
  onSuccess,
}: RateOrderModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [foodRating, setFoodRating] = useState<number>(5);
  const [serviceRating, setServiceRating] = useState<number>(5);
  const [deliveryRating, setDeliveryRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [itemRatings, setItemRatings] = useState<Record<string, { rating: number; comment?: string }>>({});

  const submitMutation = useSubmitOrderFeedback();

  const isDelivery =
    order?.orderType === "DELIVERY" ||
    (order?.tableNo || "").toLowerCase() === "delivery" ||
    Boolean(order?.delivery);

  // Sync state when opened or existingFeedback changes
  useEffect(() => {
    if (!opened) return;

    if (existingFeedback) {
      setRating(existingFeedback.rating || 5);
      setFoodRating(existingFeedback.foodRating || 5);
      setServiceRating(existingFeedback.serviceRating || 5);
      setDeliveryRating(existingFeedback.deliveryRating || 5);
      setSelectedTags(Array.isArray(existingFeedback.tags) ? existingFeedback.tags : []);
      setComment(existingFeedback.comment || "");
      setIsAnonymous(Boolean(existingFeedback.isAnonymous));

      const irMap: Record<string, { rating: number; comment?: string }> = {};
      const itemFbs = existingFeedback.itemRatings || existingFeedback.items || [];
      for (const ifb of itemFbs) {
        if (ifb.menuItemId) {
          irMap[ifb.menuItemId] = { rating: ifb.rating, comment: ifb.comment || "" };
        }
      }
      setItemRatings(irMap);
    } else {
      // Default new review values
      setRating(5);
      setFoodRating(5);
      setServiceRating(5);
      setDeliveryRating(5);
      setSelectedTags(["Delicious Food 🍲", "Hot & Fresh ♨️"]);
      setComment("");
      setIsAnonymous(false);

      // Pre-fill 5 stars for items
      const initialItemRatings: Record<string, { rating: number; comment?: string }> = {};
      if (order?.items) {
        for (const it of order.items) {
          const itemId = (it as any).itemId || (it as any).id;
          if (itemId) {
            initialItemRatings[itemId] = { rating: 5 };
          }
        }
      }
      setItemRatings(initialItemRatings);
    }
  }, [opened, existingFeedback, order]);

  if (!order) return null;

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleItemRatingChange = (itemId: string, itemRating: number) => {
    setItemRatings((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        rating: itemRating,
      },
    }));
  };

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      notifications.show({
        title: "Rating Required",
        message: "Please select an overall rating from 1 to 5 stars.",
        color: "red",
      });
      return;
    }

    try {
      const itemsPayload = Object.entries(itemRatings).map(([itemId, val]) => ({
        itemId,
        rating: val.rating,
        comment: val.comment?.trim() || undefined,
      }));

      await submitMutation.mutateAsync({
        orderId: order.id,
        rating,
        foodRating,
        serviceRating,
        deliveryRating: isDelivery ? deliveryRating : undefined,
        tags: selectedTags,
        comment: comment.trim() || undefined,
        isAnonymous,
        itemRatings: itemsPayload,
      });

      notifications.show({
        title: existingFeedback ? "Review Updated" : "Thank You!",
        message: existingFeedback
          ? "Your review has been successfully updated."
          : "Your rating & feedback have been shared with the restaurant!",
        color: "green",
        icon: <IconCheck size={16} />,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Could not submit review",
        message: err.message || "An error occurred while saving your feedback.",
        color: "red",
      });
    }
  };

  const currentLabel = RATING_LABELS[rating] || RATING_LABELS[5];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconStar size={20} color="#f59f00" fill="#f59f00" />
          <Text fw={700} size="md">
            {existingFeedback ? "Edit Your Review" : "Rate & Feedback"}
          </Text>
        </Group>
      }
      size="md"
      radius="md"
      centered
      padding="md"
      zIndex={1500}
    >
      <Stack gap="md">
        {/* Order Identity Banner */}
        <Paper
          p="xs"
          radius="sm"
          style={{
            backgroundColor: "rgba(175, 115, 215, 0.08)",
            border: "1px dashed #af73d7",
          }}
        >
          <Group justify="space-between" align="center">
            <div>
              <Text fw={700} size="xs" c="dark.4">
                {order.restaurantName || order.outlet?.restaurantName || "Restaurant"}
              </Text>
              <Text size="11px" c="dimmed">
                Token #{order.tokenNo || order.orderNo} • {isDelivery ? "Direct Delivery" : order.tableNo ? `Table ${order.tableNo}` : "Takeaway"}
              </Text>
            </div>
            {existingFeedback && (
              <Badge color="teal" size="xs" variant="light">
                Previously Rated
              </Badge>
            )}
          </Group>
        </Paper>

        {/* Previous Owner Reply Banner (if restaurant responded) */}
        {existingFeedback?.ownerReply && (
          <Paper p="sm" radius="sm" style={{ backgroundColor: "#e8f5e9", border: "1px solid #c8e6c9" }}>
            <Group gap="xs" mb={4}>
              <IconChefHat size={16} color="#2e7d32" />
              <Text size="xs" fw={700} c="green.9">
                Message from the Restaurant:
              </Text>
            </Group>
            <Text size="xs" c="dark.5" style={{ fontStyle: "italic" }}>
              "{existingFeedback.ownerReply}"
            </Text>
          </Paper>
        )}

        {/* 1. Overall Rating */}
        <Paper p="sm" radius="md" withBorder style={{ textAlign: "center", background: "#fdfcff" }}>
          <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Overall Experience
          </Text>
          <Group justify="center" mt="xs" mb={6}>
            <Rating
              value={rating}
              onChange={setRating}
              size="xl"
              color="yellow"
            />
          </Group>
          <Badge color={currentLabel.color} variant="light" size="sm">
            {currentLabel.text}
          </Badge>
        </Paper>

        {/* 2. Quick Compliments / Feedback Chips */}
        <div>
          <Text size="xs" fw={700} mb="xs" c="dark.4">
            What went well?
          </Text>
          <Group gap={6} wrap="wrap">
            {PRESET_TAGS.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <Chip
                  key={tag}
                  checked={selected}
                  onChange={() => handleTagToggle(tag)}
                  size="xs"
                  variant={selected ? "filled" : "outline"}
                  color="dinePrimary"
                >
                  {tag}
                </Chip>
              );
            })}
          </Group>
        </div>

        {/* 3. Category Breakdown */}
        <Paper p="sm" radius="md" withBorder>
          <Text size="xs" fw={700} mb="xs" c="dimmed" style={{ textTransform: "uppercase" }}>
            Specific Ratings
          </Text>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Group gap={6}>
                <IconChefHat size={15} color="#868e96" />
                <Text size="xs" fw={600}>Food Quality & Taste</Text>
              </Group>
              <Rating value={foodRating} onChange={setFoodRating} size="sm" color="yellow" />
            </Group>

            <Group justify="space-between" align="center">
              <Group gap={6}>
                <IconToolsKitchen2 size={15} color="#868e96" />
                <Text size="xs" fw={600}>Service & Staff</Text>
              </Group>
              <Rating value={serviceRating} onChange={setServiceRating} size="sm" color="yellow" />
            </Group>

            {isDelivery && (
              <Group justify="space-between" align="center">
                <Group gap={6}>
                  <IconMotorbike size={15} color="#868e96" />
                  <Text size="xs" fw={600}>Delivery Speed & Care</Text>
                </Group>
                <Rating value={deliveryRating} onChange={setDeliveryRating} size="sm" color="yellow" />
              </Group>
            )}
          </Stack>
        </Paper>

        {/* 4. Dish / Item-specific ratings */}
        {order.items && order.items.length > 0 && (
          <Paper p="sm" radius="md" withBorder>
            <Text size="xs" fw={700} mb="xs" c="dimmed" style={{ textTransform: "uppercase" }}>
              Rate Individual Dishes
            </Text>
            <Stack gap="xs">
              {order.items.map((it) => {
                const itemId = (it as any).itemId || (it as any).id;
                const currentVal = itemRatings[itemId]?.rating ?? 5;

                return (
                  <Group key={it.id} justify="space-between" align="center">
                    <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
                      <VegNonVegIcon isNonVeg={it.isNonVeg} size={13} />
                      <Text size="xs" fw={600} lineClamp={1}>
                        {it.name}
                      </Text>
                    </Group>
                    <Rating
                      value={currentVal}
                      onChange={(v) => handleItemRatingChange(itemId, v)}
                      size="xs"
                      color="yellow"
                    />
                  </Group>
                );
              })}
            </Stack>
          </Paper>
        )}

        {/* 5. Written Review */}
        <Textarea
          label="Detailed Review"
          description="Any suggestions, praises, or feedback for the chef and manager?"
          placeholder="e.g. The paneer was incredibly soft and fresh! Packaging was neat and warm."
          minRows={3}
          maxRows={6}
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
          size="xs"
        />

        {/* 6. Anonymous Review Toggle */}
        <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: "#fbfbfc" }}>
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
              <IconShieldLock size={18} color="#7950f2" style={{ flexShrink: 0 }} />
              <div>
                <Text size="xs" fw={600}>
                  Submit as Anonymous Review
                </Text>
                <Text size="10px" c="dimmed">
                  Your name & phone number won't be shown to the restaurant or on public reviews.
                </Text>
              </div>
            </Group>
            <Switch
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.currentTarget.checked)}
              color="violet"
              size="sm"
            />
          </Group>
        </Paper>

        <Divider my={4} />

        {/* Modal Action Buttons */}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" size="xs" onClick={onClose} disabled={submitMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="dinePrimary"
            size="xs"
            loading={submitMutation.isPending}
            onClick={handleSubmit}
            leftSection={<IconCheck size={14} />}
          >
            {existingFeedback ? "Update Review" : "Submit Rating"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
