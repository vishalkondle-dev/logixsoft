"use client";

import React, { useState } from "react";
import {
  Modal,
  Stack,
  TextInput,
  SegmentedControl,
  Button,
  Group,
  Text,
  Badge,
  Paper,
} from "@mantine/core";
import { IconUsers, IconCheck, IconFlame, IconClock } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { joinWaitlist } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface WaitlistQuickJoinModalProps {
  opened: boolean;
  onClose: () => void;
  outletId: string | null;
  restaurantId: string | null;
  outletName?: string;
  restaurantName?: string;
  avgWaitMinutes?: number;
  currentQueueCount?: number;
}

export function WaitlistQuickJoinModal({
  opened,
  onClose,
  outletId,
  restaurantId,
  outletName,
  restaurantName,
  avgWaitMinutes = 10,
  currentQueueCount = 0,
}: WaitlistQuickJoinModalProps) {
  const router = useRouter();
  const { user, isAuthenticated, openLoginModal } = useAuth();
  const [guestName, setGuestName] = useState(user?.name || "");
  const [guestPhone, setGuestPhone] = useState(user?.phoneNumber || "");
  const [partySize, setPartySize] = useState<string>("2");
  const [seatingPref, setSeatingPref] = useState<string>("ANY");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    if (!restaurantId || !outletId) return;

    const rawPhone = (guestPhone || user?.phoneNumber || "").replace(/\D/g, "");
    if (rawPhone.length < 10) {
      notifications.show({
        title: "Phone Required",
        message: "Please enter a valid 10-digit WhatsApp number to receive your queue alert.",
        color: "red",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await joinWaitlist(restaurantId, outletId, {
        guestName: guestName.trim() || user?.name || "Guest Diner",
        guestPhone: rawPhone,
        partySize: Number(partySize) || 2,
        seatingPreference: seatingPref as any,
        notes: notes.trim() || undefined,
      });

      notifications.show({
        title: `Queue Ticket Allocated!`,
        message: `Token #${res.entry.tokenNumber} confirmed. Real-time queue tracker is live.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      onClose();
      router.push("/live");
    } catch (err: any) {
      notifications.show({
        title: "Could Not Join Queue",
        message: err?.message || "Please try again shortly.",
        color: "red",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="sm"
      padding="md"
      title={
        <Group gap="xs" align="center" wrap="nowrap">
          <Badge color="orange" variant="light" size="sm" style={{ flexShrink: 0 }}>
            Live Waitlist
          </Badge>
          <Text fw={700} size="sm" lineClamp={1}>
            {restaurantName || outletName || "Restaurant"}
          </Text>
        </Group>
      }
      radius="lg"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* Estimated Wait Indicator */}
          <Paper p="xs" radius="md" withBorder style={{ background: "#fff9db", borderColor: "#ffe066" }}>
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <IconClock size={18} color="#f08c00" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <Text size="xs" fw={700} c="yellow.9" lineClamp={1}>
                    Estimated Wait: ~{avgWaitMinutes} mins
                  </Text>
                  <Text size="11px" c="dimmed">
                    {currentQueueCount} {currentQueueCount === 1 ? "party" : "parties"} ahead of you
                  </Text>
                </div>
              </Group>
              <Badge color="orange" size="sm" style={{ flexShrink: 0 }}>
                Fast Seating
              </Badge>
            </Group>
          </Paper>

          {/* Guest Name */}
          <TextInput
            label="Guest Name"
            placeholder="Your name"
            required
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
          />

          {/* Guest Phone */}
          <TextInput
            label="WhatsApp Mobile Number"
            placeholder="10-digit number for SMS / WhatsApp alerts"
            required
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
          />

          {/* Party Size */}
          <div>
            <Text size="xs" fw={700} mb={4}>
              PARTY SIZE (NUMBER OF GUESTS)
            </Text>
            <SegmentedControl
              fullWidth
              size="xs"
              value={partySize}
              onChange={setPartySize}
              data={["1", "2", "3", "4", "5", "6+"]}
              color="orange"
            />
          </div>

          {/* Seating Preference */}
          <div>
            <Text size="xs" fw={700} mb={4}>
              SEATING PREFERENCE
            </Text>
            <SegmentedControl
              fullWidth
              size="xs"
              value={seatingPref}
              onChange={setSeatingPref}
              data={[
                { label: "Any Table", value: "ANY" },
                { label: "Indoor AC", value: "INDOOR" },
                { label: "Outdoor", value: "OUTDOOR" },
              ]}
              color="orange"
            />
          </div>

          <TextInput
            label="Special Requests / Dietary Notes"
            placeholder="e.g. High chair needed, celebrating birthday"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Button
            type="submit"
            color="orange"
            size="md"
            radius="md"
            fullWidth
            loading={isSubmitting}
            leftSection={<IconFlame size={18} />}
          >
            Join Live Queue Now
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
