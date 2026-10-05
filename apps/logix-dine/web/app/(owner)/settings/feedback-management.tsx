"use client";

import React, { useState } from "react";
import {
  Box,
  Stack,
  Group,
  Text,
  Title,
  Paper,
  Badge,
  Rating,
  Button,
  TextInput,
  SegmentedControl,
  Select,
  Progress,
  SimpleGrid,
  Card,
  Modal,
  Textarea,
  Divider,
  Center,
  Loader,
  ThemeIcon,
  Tooltip,
  Alert,
} from "@mantine/core";
import {
  IconStar,
  IconSearch,
  IconShieldLock,
  IconMessageCircle,
  IconChefHat,
  IconToolsKitchen2,
  IconMotorbike,
  IconBuildingStore,
  IconCheck,
  IconFilter,
  IconInfoCircle,
  IconThumbUp,
  IconAlertCircle,
  IconArrowBackUp,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRestaurant } from "@/lib/restaurant-context";
import { useOwnerFeedback, useReplyFeedback } from "@/lib/queries";
import type { OrderFeedbackData } from "@/lib/api-client";

export function FeedbackManagement() {
  const { restaurant, outlets, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id || "";

  const outletId = activeOutlet?.id || outlets[0]?.id || null;
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedOrderType, setSelectedOrderType] = useState<string | null>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Owner reply modal state
  const [replyingReview, setReplyingReview] = useState<OrderFeedbackData | null>(null);
  const [replyText, setReplyText] = useState("");

  const replyMutation = useReplyFeedback(restaurantId, outletId);

  const { data, isLoading, refetch } = useOwnerFeedback(
    restaurantId,
    {
      outletId: outletId,
      rating: selectedRating,
      orderType: selectedOrderType === "ALL" ? null : selectedOrderType,
      search: searchQuery || null,
    },
    Boolean(restaurantId)
  );

  const summary = data?.summary;
  const reviews = data?.reviews || [];
  const totalReviews = summary?.totalReviews || 0;
  const avgRating = summary?.averageRating || 0;
  const distribution = summary?.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const catAvgs = summary?.categoryAverages;
  const topTags = summary?.topTags || [];
  const topItems = summary?.topItems || [];
  const needsAttention = summary?.needsAttentionItems || [];

  const handleOpenReplyModal = (review: OrderFeedbackData) => {
    setReplyingReview(review);
    setReplyText(review.ownerReply || "");
  };

  const handleSendReply = async () => {
    if (!replyingReview || !replyText.trim()) {
      notifications.show({
        title: "Reply required",
        message: "Please enter your response message.",
        color: "red",
      });
      return;
    }

    try {
      await replyMutation.mutateAsync({
        reviewId: replyingReview.id,
        reply: replyText.trim(),
      });

      notifications.show({
        title: "Reply Saved",
        message: "Your official response has been added to this review.",
        color: "green",
        icon: <IconCheck size={16} />,
      });

      setReplyingReview(null);
      setReplyText("");
      refetch();
    } catch (err: any) {
      notifications.show({
        title: "Failed to reply",
        message: err.message || "An error occurred while saving reply.",
        color: "red",
      });
    }
  };

  const setQuickReply = (msg: string) => {
    setReplyText(msg);
  };

  return (
    <Stack gap="lg" pb={60}>
      {/* 1. Header & Outlet Filter */}
      <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm">
            <ThemeIcon size={42} radius="md" color="yellow" variant="light">
              <IconStar size={24} fill="currentColor" />
            </ThemeIcon>
            <div>
              <Title order={3}>Customer Reviews & Ratings</Title>
              <Text size="xs" c="dimmed">
                Live customer satisfaction, dish ratings, compliments & official responses
              </Text>
            </div>
          </Group>

          <Badge size="md" color="dinePrimary" variant="light" leftSection={<IconBuildingStore size={14} />}>
            {activeOutlet?.name || outlets[0]?.name || "Active Outlet"}
          </Badge>
        </Group>
      </Paper>

      {/* 2. Owner Security & Anti-Tamper Notice */}
      <Alert
        variant="light"
        color="violet"
        radius="md"
        icon={<IconShieldLock size={18} />}
        title="Verified Authenticity Guarantee"
        styles={{ title: { fontWeight: 700 } }}
      >
        <Text size="xs" c="dark.6">
          To preserve authentic dining standards and customer trust, reviews and star ratings{" "}
          <strong>cannot be modified or deleted by owners or staff</strong>. You can post an official
          restaurant reply to acknowledge, thank, or resolve issues with any guest review.
        </Text>
      </Alert>

      {/* 3. Top Metrics KPI Overview */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {/* Overall Score */}
        <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
          <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase" }}>
            Overall Rating
          </Text>
          <Group align="baseline" gap="xs" mt="xs">
            <Text fw={900} size="32px" style={{ lineHeight: 1, color: "#f59f00" }}>
              {totalReviews > 0 ? avgRating.toFixed(1) : "—"}
            </Text>
            <Text size="sm" c="dimmed" fw={600}>
              / 5.0
            </Text>
          </Group>
          <Group gap={4} mt={6}>
            <Rating value={avgRating} readOnly size="sm" color="yellow" />
            <Text size="xs" c="dimmed">
              ({totalReviews} {totalReviews === 1 ? "review" : "reviews"})
            </Text>
          </Group>
        </Paper>

        {/* Category Scores */}
        <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
          <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase" }} mb="xs">
            Experience Breakdown
          </Text>
          <Stack gap={6}>
            <Group justify="space-between" align="center">
              <Group gap={6}>
                <IconChefHat size={14} color="#868e96" />
                <Text size="xs">Food Quality</Text>
              </Group>
              <Text size="xs" fw={700} c={catAvgs?.food ? "dark.6" : "dimmed"}>
                {catAvgs?.food ? `★ ${catAvgs.food.toFixed(1)}` : "—"}
              </Text>
            </Group>

            <Group justify="space-between" align="center">
              <Group gap={6}>
                <IconToolsKitchen2 size={14} color="#868e96" />
                <Text size="xs">Service & Staff</Text>
              </Group>
              <Text size="xs" fw={700} c={catAvgs?.service ? "dark.6" : "dimmed"}>
                {catAvgs?.service ? `★ ${catAvgs.service.toFixed(1)}` : "—"}
              </Text>
            </Group>

            <Group justify="space-between" align="center">
              <Group gap={6}>
                <IconMotorbike size={14} color="#868e96" />
                <Text size="xs">Delivery Care</Text>
              </Group>
              <Text size="xs" fw={700} c={catAvgs?.delivery ? "dark.6" : "dimmed"}>
                {catAvgs?.delivery ? `★ ${catAvgs.delivery.toFixed(1)}` : "—"}
              </Text>
            </Group>
          </Stack>
        </Paper>

        {/* Star Distribution Breakdown */}
        <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
          <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase" }} mb="xs">
            Star Distribution
          </Text>
          <Stack gap={4}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distribution[stars] || 0;
              const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
              const isFilterActive = selectedRating === stars;

              return (
                <Group
                  key={stars}
                  justify="space-between"
                  align="center"
                  wrap="nowrap"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedRating(isFilterActive ? null : stars)}
                >
                  <Text size="11px" fw={600} style={{ width: 28, color: isFilterActive ? "#af73d7" : undefined }}>
                    {stars} ★
                  </Text>
                  <Progress
                    value={pct}
                    color={stars >= 4 ? "teal" : stars === 3 ? "yellow" : "red"}
                    size="sm"
                    style={{ flex: 1 }}
                  />
                  <Text size="11px" c="dimmed" style={{ width: 34, textAlign: "right" }}>
                    {count}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </Paper>

        {/* Praise Tags Cloud */}
        <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
          <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase" }} mb="xs">
            Most Praised Tags
          </Text>
          {topTags.length === 0 ? (
            <Text size="xs" c="dimmed">
              No tags recorded yet
            </Text>
          ) : (
            <Group gap={6} wrap="wrap">
              {topTags.slice(0, 6).map((t) => (
                <Badge key={t.tag} size="xs" variant="light" color="dinePrimary">
                  {t.tag} ({t.count})
                </Badge>
              ))}
            </Group>
          )}
        </Paper>
      </SimpleGrid>

      {/* 4. Dish Rating Performance (Top Rated & Needs Attention) */}
      {(topItems.length > 0 || needsAttention.length > 0) && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {/* Top Rated Dishes */}
          <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
            <Group gap="xs" mb="sm">
              <IconThumbUp size={16} color="#2b8a3e" />
              <Text size="sm" fw={700} c="green.9">
                Top Rated Dishes
              </Text>
            </Group>
            <Stack gap="xs">
              {topItems.map((item) => (
                <Group key={item.id} justify="space-between" align="center">
                  <Text size="xs" fw={600} lineClamp={1} style={{ flex: 1 }}>
                    {item.name}
                  </Text>
                  <Badge size="xs" color="yellow" variant="light" leftSection={<IconStar size={10} fill="currentColor" />}>
                    {(item.ratingAvg || 0).toFixed(1)} ({item.ratingCount})
                  </Badge>
                </Group>
              ))}
            </Stack>
          </Paper>

          {/* Dishes Needing Attention */}
          <Paper p="md" radius="md" withBorder style={{ background: "#fff" }}>
            <Group gap="xs" mb="sm">
              <IconAlertCircle size={16} color="#e03131" />
              <Text size="sm" fw={700} c="red.9">
                Dishes Needing Attention (Below 4.0 ★)
              </Text>
            </Group>
            {needsAttention.length === 0 ? (
              <Text size="xs" c="dimmed">
                All dishes are currently rated 4.0★ or higher! Great job!
              </Text>
            ) : (
              <Stack gap="xs">
                {needsAttention.map((item) => (
                  <Group key={item.id} justify="space-between" align="center">
                    <Text size="xs" fw={600} lineClamp={1} style={{ flex: 1 }}>
                      {item.name}
                    </Text>
                    <Badge size="xs" color="orange" variant="light" leftSection={<IconStar size={10} fill="currentColor" />}>
                      {(item.ratingAvg || 0).toFixed(1)} ({item.ratingCount})
                    </Badge>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>
        </SimpleGrid>
      )}

      {/* 5. Filter & Search Controls */}
      <Paper p="sm" radius="md" withBorder style={{ background: "#fff" }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          {/* Search box */}
          <TextInput
            size="xs"
            placeholder="Search reviews, comments, tags..."
            leftSection={<IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
          />

          {/* Star Filter */}
          <Group gap={4}>
            <Button
              size="xs"
              variant={selectedRating === null ? "filled" : "default"}
              color="dinePrimary"
              onClick={() => setSelectedRating(null)}
            >
              All Stars
            </Button>
            {[5, 4, 3, 2, 1].map((s) => (
              <Button
                key={s}
                size="xs"
                variant={selectedRating === s ? "filled" : "default"}
                color={s >= 4 ? "teal" : s === 3 ? "yellow" : "red"}
                onClick={() => setSelectedRating(selectedRating === s ? null : s)}
                leftSection={<IconStar size={12} fill="currentColor" />}
              >
                {s}★
              </Button>
            ))}
          </Group>

          {/* Order Type Filter */}
          <SegmentedControl
            size="xs"
            value={selectedOrderType || "ALL"}
            onChange={setSelectedOrderType}
            data={[
              { label: "All Types", value: "ALL" },
              { label: "Dine-in", value: "DINE_IN" },
              { label: "Takeaway", value: "TAKEAWAY" },
              { label: "Delivery", value: "DELIVERY" },
            ]}
          />
        </Group>
      </Paper>

      {/* 6. Reviews Feed */}
      {isLoading ? (
        <Center py={60}>
          <Loader size="md" color="dinePrimary" />
        </Center>
      ) : reviews.length === 0 ? (
        <Paper p="xl" radius="md" withBorder style={{ textAlign: "center", background: "#fff" }}>
          <Stack align="center" gap="xs">
            <IconStar size={40} color="#ced4da" />
            <Title order={4}>No Customer Reviews Found</Title>
            <Text size="sm" c="dimmed">
              {totalReviews === 0
                ? "Reviews will appear here as customers complete orders and rate their meals."
                : "No reviews match your current filters."}
            </Text>
            {(selectedRating !== null || searchQuery || selectedOrderType !== "ALL") && (
              <Button
                size="xs"
                variant="subtle"
                color="dinePrimary"
                onClick={() => {
                  setSelectedRating(null);
                  setSelectedOrderType("ALL");
                  setSearchQuery("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </Stack>
        </Paper>
      ) : (
        <Stack gap="sm">
          {reviews.map((rev) => {
            const isAnon = rev.isAnonymous;
            const items = rev.items || rev.itemRatings || [];

            return (
              <Card key={rev.id} radius="md" withBorder p="md" style={{ background: "#fff" }}>
                <Stack gap="xs">
                  {/* Review Top Header */}
                  <Group justify="space-between" align="flex-start" wrap="wrap">
                    <div>
                      <Group gap="xs" align="center" wrap="wrap">
                        <Rating value={rev.rating} readOnly size="sm" color="yellow" />
                        <Text fw={700} size="sm">
                          {rev.rating}.0 / 5.0
                        </Text>
                        <Badge size="xs" color="gray" variant="light">
                          Token #{rev.orderNo}
                        </Badge>
                        <Badge
                          size="xs"
                          variant="outline"
                          color={rev.orderType === "DELIVERY" ? "teal" : rev.orderType === "TAKEAWAY" ? "blue" : "gray"}
                        >
                          {rev.orderType === "DELIVERY"
                            ? "Delivery"
                            : rev.orderType === "TAKEAWAY"
                            ? "Takeaway"
                            : `Table ${rev.tableNo}`}
                        </Badge>
                      </Group>

                      {/* Customer Identity */}
                      <Group gap="xs" mt={4} align="center">
                        <Text fw={600} size="xs" c={isAnon ? "dimmed" : "dark.7"}>
                          {rev.customerName}
                        </Text>
                        {isAnon ? (
                          <Badge size="xs" color="violet" variant="light" leftSection={<IconShieldLock size={10} />}>
                            Anonymous Review
                          </Badge>
                        ) : (
                          rev.customerPhone && (
                            <Text size="11px" c="dimmed">
                              {rev.customerPhone}
                            </Text>
                          )
                        )}
                        <Text size="11px" c="dimmed">
                          • {new Date(rev.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </Group>
                    </div>

                    {/* Reply Action Button */}
                    <Button
                      size="xs"
                      variant={rev.ownerReply ? "light" : "outline"}
                      color={rev.ownerReply ? "teal" : "dinePrimary"}
                      leftSection={rev.ownerReply ? <IconCheck size={13} /> : <IconArrowBackUp size={13} />}
                      onClick={() => handleOpenReplyModal(rev)}
                    >
                      {rev.ownerReply ? "Edit Reply" : "Reply to Customer"}
                    </Button>
                  </Group>

                  {/* Sub-ratings chips */}
                  {(rev.foodRating || rev.serviceRating || rev.deliveryRating) && (
                    <Group gap="xs" mt={2}>
                      {rev.foodRating && (
                        <Badge size="xs" variant="light" color="gray" leftSection={<IconChefHat size={11} />}>
                          Food: {rev.foodRating}★
                        </Badge>
                      )}
                      {rev.serviceRating && (
                        <Badge size="xs" variant="light" color="gray" leftSection={<IconToolsKitchen2 size={11} />}>
                          Service: {rev.serviceRating}★
                        </Badge>
                      )}
                      {rev.deliveryRating && (
                        <Badge size="xs" variant="light" color="gray" leftSection={<IconMotorbike size={11} />}>
                          Delivery: {rev.deliveryRating}★
                        </Badge>
                      )}
                    </Group>
                  )}

                  {/* Praise Tags */}
                  {Array.isArray(rev.tags) && rev.tags.length > 0 && (
                    <Group gap={6} mt={2} wrap="wrap">
                      {rev.tags.map((tag: string) => (
                        <Badge key={tag} size="xs" color="dinePrimary" variant="light">
                          {tag}
                        </Badge>
                      ))}
                    </Group>
                  )}

                  {/* Customer Written Comment */}
                  {rev.comment && (
                    <Paper
                      p="xs"
                      radius="sm"
                      style={{
                        backgroundColor: "#f8f9fa",
                        borderLeft: "3px solid #f59f00",
                      }}
                    >
                      <Text size="xs" c="dark.6">
                        "{rev.comment}"
                      </Text>
                    </Paper>
                  )}

                  {/* Dish-specific ratings */}
                  {items.length > 0 && (
                    <Box pt={4}>
                      <Text size="11px" fw={700} c="dimmed" mb={4}>
                        DISH RATINGS:
                      </Text>
                      <Group gap="xs" wrap="wrap">
                        {items.map((it: any) => (
                          <Paper
                            key={it.id || it.menuItemId}
                            px="xs"
                            py={4}
                            radius="sm"
                            withBorder
                            style={{ background: "#fff" }}
                          >
                            <Group gap={6}>
                              <Text size="xs" fw={600}>
                                {it.itemName || "Item"}
                              </Text>
                              <Badge size="xs" color="yellow" variant="light" leftSection={<IconStar size={9} fill="currentColor" />}>
                                {it.rating}★
                              </Badge>
                            </Group>
                          </Paper>
                        ))}
                      </Group>
                    </Box>
                  )}

                  {/* Official Owner Reply Box */}
                  {rev.ownerReply && (
                    <Paper
                      p="xs"
                      radius="sm"
                      style={{
                        backgroundColor: "rgba(46, 125, 50, 0.06)",
                        borderLeft: "3px solid #2e7d32",
                      }}
                    >
                      <Group justify="space-between" align="center" mb={2}>
                        <Group gap={6}>
                          <IconChefHat size={14} color="#2e7d32" />
                          <Text size="11px" fw={700} c="green.9">
                            Official Restaurant Response
                          </Text>
                        </Group>
                        {rev.ownerRepliedAt && (
                          <Text size="10px" c="dimmed">
                            {new Date(rev.ownerRepliedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        )}
                      </Group>
                      <Text size="xs" c="dark.7" style={{ fontStyle: "italic" }}>
                        "{rev.ownerReply}"
                      </Text>
                    </Paper>
                  )}
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Owner Reply Modal */}
      <Modal
        opened={Boolean(replyingReview)}
        onClose={() => setReplyingReview(null)}
        title={
          <Group gap="xs">
            <IconMessageCircle size={18} color="#af73d7" />
            <Text fw={700} size="md">
              Official Restaurant Reply
            </Text>
          </Group>
        }
        radius="md"
        centered
        size="md"
      >
        {replyingReview && (
          <Stack gap="md">
            {/* Review Preview */}
            <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: "#f8f9fa" }}>
              <Group justify="space-between" align="center" mb={4}>
                <Text fw={600} size="xs">
                  {replyingReview.customerName} • Token #{replyingReview.orderNo}
                </Text>
                <Rating value={replyingReview.rating} readOnly size="xs" color="yellow" />
              </Group>
              {replyingReview.comment && (
                <Text size="xs" c="dimmed" lineClamp={2}>
                  "{replyingReview.comment}"
                </Text>
              )}
            </Paper>

            {/* Quick response templates */}
            <div>
              <Text size="11px" fw={700} c="dimmed" mb={6}>
                QUICK TEMPLATES:
              </Text>
              <Group gap={6} wrap="wrap">
                <Button
                  size="compact-xs"
                  variant="light"
                  color="gray"
                  onClick={() =>
                    setQuickReply("Thank you so much for the glowing review! We are delighted you enjoyed your meal and hope to serve you again soon.")
                  }
                >
                  Thank You Praise
                </Button>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="gray"
                  onClick={() =>
                    setQuickReply("Thank you for sharing your feedback. We apologize for not meeting expectations and will work with our kitchen team to improve right away.")
                  }
                >
                  Quality Apology
                </Button>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="gray"
                  onClick={() =>
                    setQuickReply("We appreciate your feedback regarding delivery. We are coordinating with our dispatch team to ensure prompt delivery next time.")
                  }
                >
                  Delivery Note
                </Button>
              </Group>
            </div>

            <Textarea
              label="Your Response"
              description="This message will be visible to the customer on their receipt/order page."
              placeholder="Write a warm, professional reply..."
              minRows={3}
              maxRows={6}
              value={replyText}
              onChange={(e) => setReplyText(e.currentTarget.value)}
              required
            />

            <Group justify="flex-end" gap="xs">
              <Button variant="default" size="xs" onClick={() => setReplyingReview(null)}>
                Cancel
              </Button>
              <Button
                color="dinePrimary"
                size="xs"
                loading={replyMutation.isPending}
                onClick={handleSendReply}
                leftSection={<IconCheck size={14} />}
              >
                Save & Post Reply
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
