"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Stack,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Button,
  Group,
  Text,
  Badge,
  SegmentedControl,
  SimpleGrid,
  Paper,
  ThemeIcon,
} from "@mantine/core";
import {
  IconCalendar,
  IconClock,
  IconUsers,
  IconCheck,
  IconBuildingStore,
  IconPhone,
  IconUser,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMarketplaceReservation,
  getMarketplaceExplore,
  type MarketplaceExploreResponse,
} from "@/lib/api-client";
import { qk } from "@/lib/queries";

interface ReservationModalProps {
  opened: boolean;
  onClose: () => void;
  restaurantId?: string;
  outletId?: string;
  outletName?: string;
  restaurantName?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  onSuccess?: () => void;
}

const TIME_SLOTS = [
  "12:30 PM",
  "01:00 PM",
  "01:30 PM",
  "02:00 PM",
  "07:00 PM",
  "07:30 PM",
  "08:00 PM",
  "08:30 PM",
  "09:00 PM",
  "09:30 PM",
];

export function ReservationModal({
  opened,
  onClose,
  outletId,
  outletName,
  restaurantName,
  customerName,
  customerPhone,
  onSuccess,
}: ReservationModalProps) {
  const queryClient = useQueryClient();
  const [selectedOutletId, setSelectedOutletId] = useState<string>(outletId || "");
  const [guestName, setGuestName] = useState<string>(customerName || "");
  const [guestPhone, setGuestPhone] = useState<string>(customerPhone || "");
  const [partySize, setPartySize] = useState<number>(2);
  const [timeSlot, setTimeSlot] = useState<string>("07:30 PM");
  const [seatingPref, setSeatingPref] = useState<string>("Indoor AC");
  const [specialNotes, setSpecialNotes] = useState<string>("");
  const [reservationDate, setReservationDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync props when modal opens or props change
  useEffect(() => {
    if (outletId) setSelectedOutletId(outletId);
    if (customerName) setGuestName(customerName);
    if (customerPhone) setGuestPhone(customerPhone);
  }, [outletId, customerName, customerPhone, opened]);

  // Fetch explore outlets list if no outletId was provided in props
  const { data: marketplaceData } = useQuery<MarketplaceExploreResponse>({
    queryKey: ["marketplaceExplore"],
    queryFn: () => getMarketplaceExplore({}),
    enabled: opened && !outletId,
    staleTime: 60_000,
  });

  const outletOptions = useMemo(() => {
    if (!marketplaceData?.outlets) return [];
    return marketplaceData.outlets.map((o) => ({
      value: o.id,
      label: `${o.restaurantName} - ${o.name}`,
    }));
  }, [marketplaceData]);

  const targetOutletId = outletId || selectedOutletId;
  const currentOutletItem = marketplaceData?.outlets?.find((o) => o.id === targetOutletId);
  const resolvedOutletName =
    outletName || currentOutletItem?.name || (targetOutletId ? "Restaurant Branch" : "");
  const resolvedRestaurantName =
    restaurantName || currentOutletItem?.restaurantName || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetOutletId) {
      notifications.show({
        title: "Outlet Required",
        message: "Please select a dining outlet to book your table.",
        color: "red",
      });
      return;
    }

    const cleanPhone = guestPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      notifications.show({
        title: "Phone Required",
        message: "Please enter a valid 10-digit mobile number.",
        color: "red",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createMarketplaceReservation({
        outletId: targetOutletId,
        guestName: guestName.trim() || customerName || "Valued Diner",
        guestPhone: cleanPhone,
        partySize: Number(partySize) || 2,
        reservationDate,
        startTime: timeSlot,
        notes: `${seatingPref}${specialNotes.trim() ? ` • ${specialNotes.trim()}` : ""}`,
      });

      // Invalidate customer portal queries so reservation appears immediately
      queryClient.invalidateQueries({ queryKey: qk.customerPortal() });
      if (onSuccess) onSuccess();

      notifications.show({
        title: "Table Reserved Successfully!",
        message:
          res?.message ||
          `Table for ${partySize} guests on ${reservationDate} at ${timeSlot} is confirmed.`,
        color: "teal",
        icon: <IconCheck size={16} />,
        autoClose: 5000,
      });

      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Reservation Failed",
        message: err?.message || "Failed to book table. Please check your details and try again.",
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
      title={
        <Group gap="xs">
          <ThemeIcon size={28} radius="md" color="dinePrimary" variant="light">
            <IconCalendar size={18} />
          </ThemeIcon>
          <Text fw={700}>Book a Dining Table</Text>
        </Group>
      }
      radius="md"
      centered
      zIndex={1500}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {/* Outlet Selection / Info */}
          {outletId || resolvedOutletName ? (
            <Paper p="xs" radius="md" bg="blue.0" withBorder>
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <ThemeIcon size={24} radius="xl" color="blue" variant="light">
                    <IconBuildingStore size={14} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" fw={700} c="blue.9">
                      {resolvedRestaurantName ? `${resolvedRestaurantName} • ` : ""}
                      {resolvedOutletName}
                    </Text>
                  </div>
                </Group>
                <Badge color="blue" variant="light" size="xs">
                  Instant Confirmation
                </Badge>
              </Group>
            </Paper>
          ) : (
            <Select
              label="Dining Restaurant & Branch"
              placeholder="Choose restaurant..."
              data={outletOptions}
              value={selectedOutletId}
              onChange={(val) => setSelectedOutletId(val || "")}
              searchable
              required
              leftSection={<IconBuildingStore size={16} />}
            />
          )}

          {/* Guest Details */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Guest Name"
              placeholder="e.g. Vishal Kondle"
              value={guestName}
              onChange={(e) => setGuestName(e.currentTarget.value)}
              leftSection={<IconUser size={16} />}
              required
            />
            <TextInput
              label="Phone Number"
              placeholder="10-digit mobile"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.currentTarget.value)}
              leftSection={<IconPhone size={16} />}
              required
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <NumberInput
              label="Party Size"
              description="Number of guests"
              min={1}
              max={20}
              value={partySize}
              onChange={(val) => setPartySize(Number(val) || 2)}
              leftSection={<IconUsers size={16} />}
              required
            />
            <Select
              label="Preferred Time"
              description="Dining slot"
              data={TIME_SLOTS}
              value={timeSlot}
              onChange={(val) => setTimeSlot(val || "07:30 PM")}
              leftSection={<IconClock size={16} />}
              required
            />
          </SimpleGrid>

          <TextInput
            label="Reservation Date"
            type="date"
            value={reservationDate}
            onChange={(e) => setReservationDate(e.currentTarget.value)}
            min={new Date().toISOString().split("T")[0]}
            required
          />

          <div>
            <Text size="xs" fw={600} mb={4}>
              Seating Preference
            </Text>
            <SegmentedControl
              value={seatingPref}
              onChange={setSeatingPref}
              size="xs"
              radius="md"
              fullWidth
              data={[
                { label: "Indoor AC", value: "Indoor AC" },
                { label: "Outdoor", value: "Outdoor Patio" },
                { label: "Quiet", value: "Quiet Corner" },
                { label: "Window", value: "Window View" },
              ]}
            />
          </div>

          <Textarea
            label="Occasion or Special Requests (Optional)"
            placeholder="e.g. Birthday anniversary celebration, high chair needed..."
            minRows={2}
            value={specialNotes}
            onChange={(e) => setSpecialNotes(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="md" gap="xs">
            <Button variant="default" size="xs" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              color="dinePrimary"
              size="xs"
              type="submit"
              loading={isSubmitting}
              leftSection={<IconCheck size={14} />}
            >
              Confirm Reservation
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
