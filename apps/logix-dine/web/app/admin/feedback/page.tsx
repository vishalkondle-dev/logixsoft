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
  Textarea,
  Select,
  Center,
  Loader,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import {
  IconStar,
  IconSearch,
  IconMessageCircle2,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

const RATING_OPTIONS = [
  { value: "ALL", label: "All Star Ratings" },
  { value: "5", label: "5 Stars (★★★★★)" },
  { value: "4", label: "4 Stars (★★★★☆)" },
  { value: "3", label: "3 Stars (★★★☆☆)" },
  { value: "2", label: "2 Stars (★★☆☆☆)" },
  { value: "1", label: "1 Star  (★☆☆☆☆)" },
];

function FeedbackContent() {
  const { restaurants } = useAdmin();
  const { getFilter, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const restaurantFilter = getFilter("restaurantId", "ALL");
  const ratingFilter = getFilter("rating", "ALL");
  const repliedFilter = getFilter("replied", "ALL");
  const sortBy = getFilter("sortBy", "newest");

  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [replyOpened, setReplyOpened] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (restaurantFilter && restaurantFilter !== "ALL") params.set("restaurantId", restaurantFilter);
      if (ratingFilter && ratingFilter !== "ALL") params.set("rating", ratingFilter);
      if (repliedFilter && repliedFilter !== "ALL") params.set("replied", repliedFilter);
      if (sortBy) params.set("sortBy", sortBy);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/admin/feedback${qs}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setFeedback(Array.isArray(d) ? d : d.feedback || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, restaurantFilter, ratingFilter, repliedFilter, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReply = async () => {
    if (!selectedFeedback || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/feedback/${selectedFeedback.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reply: replyText }),
      });
      if (!res.ok) throw new Error("Failed to submit reply");
      notifications.show({ title: "Reply Published", message: "Response published to diner.", color: "teal" });
      setReplyOpened(false);
      setReplyText("");
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (fbId: string) => {
    modals.openConfirmModal({
      title: "Delete Customer Review",
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete this customer review?
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/admin/feedback/${fbId}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (!res.ok) throw new Error("Delete failed");
          notifications.show({ title: "Deleted", message: "Review removed.", color: "teal" });
          loadData();
        } catch (err: any) {
          notifications.show({ title: "Error", message: err.message, color: "red" });
        }
      },
    });
  };

  // Server-side filtered
  const filtered = feedback;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Reviews & Customer Feedback
          </Text>
          <Text size="sm" c="dimmed">
            Cross-tenant guest ratings, qualitative feedback, and official management responses.
          </Text>
        </div>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search reviews, phone, or comment text..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setFilter("search", e.target.value)}
            w={{ base: "100%", sm: 280 }}
            size="xs"
          />
          <Select
            placeholder="Filter by Restaurant"
            data={[
              { value: "ALL", label: "🌐 All Restaurants" },
              ...restaurants.map((r) => ({ value: r.id, label: r.name })),
            ]}
            value={restaurantFilter}
            onChange={(val) => setFilter("restaurantId", val || "ALL")}
            w={{ base: "100%", sm: 200 }}
            size="xs"
          />
          <Select
            placeholder="Star Rating"
            data={RATING_OPTIONS}
            value={ratingFilter}
            onChange={(val) => setFilter("rating", val || "ALL")}
            w={{ base: "100%", sm: 160 }}
            size="xs"
          />
          <Select
            placeholder="Reply Status"
            data={[
              { value: "ALL", label: "All Feedback" },
              { value: "pending", label: "Awaiting Reply" },
              { value: "replied", label: "Replied" },
            ]}
            value={repliedFilter}
            onChange={(val) => setFilter("replied", val || "ALL")}
            w={{ base: "100%", sm: 140 }}
            size="xs"
          />
          <Select
            placeholder="Sort By"
            data={[
              { value: "newest", label: "Newest First" },
              { value: "oldest", label: "Oldest First" },
              { value: "rating_desc", label: "Highest Rating" },
              { value: "rating_asc", label: "Lowest Rating" },
            ]}
            value={sortBy}
            onChange={(val) => setFilter("sortBy", val || "newest")}
            w={{ base: "100%", sm: 140 }}
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
            Showing {filtered.length} of {feedback.length} Reviews
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
                <Table.Th>Customer</Table.Th>
                <Table.Th>Restaurant</Table.Th>
                <Table.Th>Rating</Table.Th>
                <Table.Th>Customer Comment</Table.Th>
                <Table.Th>Management Response</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No reviews found matching criteria.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((fb) => (
                  <Table.Tr key={fb.id}>
                    <Table.Td>
                      <Text size="xs" fw={600}>
                        {fb.customerPhone || "Anonymous Diner"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{fb.restaurantName || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={fb.rating >= 4 ? "green" : fb.rating === 3 ? "yellow" : "red"}
                        leftSection={<IconStar size={10} />}
                      >
                        {fb.rating} Stars
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" lineClamp={2}>
                        {fb.comment || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {fb.reply ? (
                        <Text size="xs" c="teal" lineClamp={2}>
                          "{fb.reply}"
                        </Text>
                      ) : (
                        <Badge size="xs" variant="outline" color="gray">
                          No reply yet
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{new Date(fb.createdAt).toLocaleDateString()}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap="xs" justify="flex-end">
                        <Button
                          size="xs"
                          variant="light"
                          color="dinePrimary"
                          leftSection={<IconMessageCircle2 size={14} />}
                          onClick={() => {
                            setSelectedFeedback(fb);
                            setReplyText(fb.reply || "");
                            setReplyOpened(true);
                          }}
                        >
                          {fb.reply ? "Edit Reply" : "Reply"}
                        </Button>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDelete(fb.id)}
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

      {/* Modal: Reply Feedback */}
      <Modal
        opened={replyOpened}
        onClose={() => setReplyOpened(false)}
        title={<Text fw={700}>Reply to Customer Review</Text>}
        centered
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm">
            Customer Comment: <em>"{selectedFeedback?.comment || "No comment"}"</em>
          </Text>
          <Textarea
            label="Management Response"
            placeholder="Thank you for dining with us..."
            required
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            minRows={3}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setReplyOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleReply}>
              Publish Reply
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <FeedbackContent />
    </Suspense>
  );
}
