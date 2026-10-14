"use client";

import React, { useState, useMemo } from "react";
import {
  Paper, Title, Text, Stack, Group, SimpleGrid, Badge, Button,
  ActionIcon, TextInput, NumberInput, Select, Modal, Card,
  ThemeIcon, Alert, Menu, Tooltip, Box, Divider, SegmentedControl,
  Loader, Center
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import {
  IconUsers, IconClock, IconBellRinging, IconArmchair, IconCheck,
  IconPlus, IconQrcode, IconDotsVertical, IconX, IconPhone,
  IconSparkles, IconAlertCircle, IconPrinter, IconShare, IconChefHat
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWaitlist, joinWaitlist, callWaitlistGuest, seatWaitlistGuest,
  cancelWaitlistGuest, type WaitlistEntry
} from "@/lib/api-client";
import { QRCode } from "@gfazioli/mantine-qr-code";

interface WaitlistPanelProps {
  restaurantId: string;
  outletId: string;
  tables: any[];
  canManage: boolean;
}

export function WaitlistPanel({
  restaurantId,
  outletId,
  tables = [],
  canManage,
}: WaitlistPanelProps) {
  const queryClient = useQueryClient();

  // Local state
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [seatingEntry, setSeatingEntry] = useState<WaitlistEntry | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string>("");

  // Form state
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState<number>(2);
  const [seatingPreference, setSeatingPreference] = useState<string>("ANY");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch waitlist data
  const {
    data: waitlistData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["waitlist", restaurantId, outletId],
    queryFn: () => getWaitlist(restaurantId, outletId, "ALL"),
    enabled: Boolean(restaurantId && outletId),
    refetchInterval: 6000, // Live poll every 6s
  });

  const entries: WaitlistEntry[] = waitlistData?.entries || [];

  const activeEntries = useMemo(() => {
    return entries.filter((e) => e.status === "WAITING" || e.status === "CALLED");
  }, [entries]);

  const displayedEntries = activeTab === "ACTIVE" ? activeEntries : entries;

  const stats = waitlistData?.stats || {
    waitingCount: 0,
    calledCount: 0,
    seatedTodayCount: 0,
    totalTodayCount: 0,
    avgWaitMinutes: 15,
  };

  // 2. Identify Free Tables for smart auto-matching
  const freeTables = useMemo(() => {
    return tables.filter((t: any) => t.active && t.status !== "OCCUPIED");
  }, [tables]);

  // Find next party that matches any free table
  const smartMatch = useMemo(() => {
    if (freeTables.length === 0 || activeEntries.length === 0) return null;
    const waitingParties = activeEntries.filter((e) => e.status === "WAITING");
    if (waitingParties.length === 0) return null;

    // Check if any free table can accommodate the next waiting party
    for (const party of waitingParties) {
      const matchTable = freeTables.find((t: any) => (t.capacity || 4) >= party.partySize);
      if (matchTable) {
        return { party, table: matchTable };
      }
    }
    return { party: waitingParties[0], table: freeTables[0] };
  }, [freeTables, activeEntries]);

  // 3. Actions
  const handleOpenAddModal = () => {
    setGuestName("");
    setGuestPhone("");
    setPartySize(2);
    setSeatingPreference("ANY");
    setNotes("");
    setAddModalOpen(true);
  };

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      notifications.show({ title: "Name Required", message: "Please enter guest name", color: "red" });
      return;
    }
    const cleanPhone = guestPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      notifications.show({ title: "Valid Phone Required", message: "Please enter a valid 10-digit WhatsApp number", color: "red" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await joinWaitlist(restaurantId, outletId, {
        guestName: guestName.trim(),
        guestPhone: cleanPhone,
        partySize: Number(partySize) || 2,
        seatingPreference,
        notes: notes.trim() || undefined,
      });

      notifications.show({
        title: "Added to Waitlist",
        message: `Token #${res.entry.tokenNumber} allocated. WhatsApp confirmation sent!`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      setAddModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["waitlist", restaurantId] });
      refetch();
    } catch (err: any) {
      notifications.show({ title: "Failed to Add", message: err.message || "Error adding to waitlist", color: "red" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCallGuest = async (entry: WaitlistEntry) => {
    try {
      await callWaitlistGuest(restaurantId, outletId, entry.id, true);
      notifications.show({
        title: "Guest Notified!",
        message: `"Table Ready" WhatsApp alert dispatched to ${entry.guestName} (${entry.guestPhone}).`,
        color: "teal",
        icon: <IconBellRinging size={16} />,
      });
      queryClient.invalidateQueries({ queryKey: ["waitlist", restaurantId] });
      refetch();
    } catch (err: any) {
      notifications.show({ title: "Call Failed", message: err.message, color: "red" });
    }
  };

  const handleOpenSeatModal = (entry: WaitlistEntry) => {
    setSeatingEntry(entry);
    // Find best matching free table
    const matching = freeTables.find((t: any) => (t.capacity || 4) >= entry.partySize) || freeTables[0];
    setSelectedTableId(matching?.id || "");
  };

  const handleSeatGuest = async () => {
    if (!seatingEntry || !selectedTableId) return;
    try {
      const targetTable = tables.find((t: any) => t.id === selectedTableId);
      await seatWaitlistGuest(
        restaurantId,
        outletId,
        seatingEntry.id,
        selectedTableId,
        targetTable?.name || "Assigned Table"
      );

      notifications.show({
        title: "Guest Seated!",
        message: `${seatingEntry.guestName} (Party of ${seatingEntry.partySize}) seated at ${targetTable?.name || "Table"}.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      setSeatingEntry(null);
      queryClient.invalidateQueries({ queryKey: ["waitlist", restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
      refetch();
    } catch (err: any) {
      notifications.show({ title: "Seating Failed", message: err.message, color: "red" });
    }
  };

  const handleCancelEntry = (entry: WaitlistEntry, status: "CANCELLED" | "NO_SHOW" = "CANCELLED") => {
    modals.openConfirmModal({
      title: status === "NO_SHOW" ? "Mark as No-Show" : "Cancel Queue Entry",
      children: (
        <Text size="sm">
          Remove token <b>#{entry.tokenNumber}</b> ({entry.guestName}) from the active queue?
        </Text>
      ),
      labels: { confirm: "Confirm", cancel: "Keep" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await cancelWaitlistGuest(restaurantId, outletId, entry.id, undefined, status);
          notifications.show({
            title: status === "NO_SHOW" ? "Marked as No-Show" : "Queue Entry Cancelled",
            message: `Token #${entry.tokenNumber} removed from queue.`,
            color: "gray",
          });
          queryClient.invalidateQueries({ queryKey: ["waitlist", restaurantId] });
          refetch();
        } catch (err: any) {
          notifications.show({ title: "Action Failed", message: err.message, color: "red" });
        }
      },
    });
  };

  const publicJoinUrl = `https://dine.logixsoft.in/q/${outletId}/join`;

  return (
    <Stack gap="md">
      {/* ─── Top Stats & Action Bar ─────────────────────────────────────────── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {/* Waiting in Queue */}
        <Paper p="sm" radius="md" withBorder>
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="orange.8" fw={700} tt="uppercase">Waiting in Queue</Text>
              <Text size="xl" fw={800} c="orange.8">{stats.waitingCount}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="orange">
              <IconUsers size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        {/* Table Ready / Called */}
        <Paper p="sm" radius="md" withBorder>
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="blue.7" fw={700} tt="uppercase">Table Ready (Called)</Text>
              <Text size="xl" fw={800} c="blue.7">{stats.calledCount}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="blue">
              <IconBellRinging size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        {/* Seated Today */}
        <Paper p="sm" radius="md" withBorder>
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="teal.7" fw={700} tt="uppercase">Seated Today</Text>
              <Text size="xl" fw={800} c="teal.7">{stats.seatedTodayCount}</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="teal">
              <IconCheck size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        {/* Avg Wait Time */}
        <Paper p="sm" radius="md" withBorder>
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="indigo.8" fw={700} tt="uppercase">Avg Wait Time</Text>
              <Text size="xl" fw={800} c="indigo.8">~{stats.avgWaitMinutes}m</Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="indigo">
              <IconClock size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ─── Smart Table Match Banner ────────────────────────────────────────── */}
      {smartMatch && (
        <Alert
          icon={<IconSparkles size={20} />}
          title="Matching Vacant Table Available"
          color="indigo"
          radius="md"
          variant="light"
        >
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm">
              <b>{smartMatch.table.name}</b> ({smartMatch.table.capacity || 4}-seater) is free! Next in line:{" "}
              <b>{smartMatch.party.guestName}</b> (Token #{smartMatch.party.tokenNumber}, {smartMatch.party.partySize} Guests).
            </Text>
            <Group gap="xs">
              {smartMatch.party.status === "WAITING" && (
                <Button
                  size="xs"
                  variant="outline"
                  color="indigo"
                  leftSection={<IconBellRinging size={14} />}
                  onClick={() => handleCallGuest(smartMatch.party)}
                >
                  Notify Table Ready
                </Button>
              )}
              <Button
                size="xs"
                color="indigo"
                leftSection={<IconArmchair size={14} />}
                onClick={() => {
                  setSeatingEntry(smartMatch.party);
                  setSelectedTableId(smartMatch.table.id);
                }}
              >
                Seat at {smartMatch.table.name}
              </Button>
            </Group>
          </Group>
        </Alert>
      )}

      {/* ─── Queue Controls & Filter ─────────────────────────────────────────── */}
      <Paper p="sm" radius="md" withBorder>
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="xs">
            <SegmentedControl
              size="sm"
              value={activeTab}
              onChange={(val) => setActiveTab(val as any)}
              data={[
                { label: `Active Queue (${stats.waitingCount + stats.calledCount})`, value: "ACTIVE" },
                { label: `All Entries Today (${stats.totalTodayCount || entries.length})`, value: "ALL" },
              ]}
            />
          </Group>

          <Group gap="xs">
            <Button
              size="sm"
              variant="outline"
              color="gray"
              leftSection={<IconQrcode size={16} />}
              onClick={() => setQrModalOpen(true)}
            >
              Entrance QR Standee
            </Button>
            <Button
              size="sm"
              color="indigo"
              leftSection={<IconPlus size={16} />}
              onClick={handleOpenAddModal}
            >
              Add to Waitlist
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* ─── Queue List ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Center py="xl">
          <Loader size="md" color="indigo" />
        </Center>
      ) : displayedEntries.length === 0 ? (
        <Paper p="xl" radius="md" withBorder style={{ textAlign: "center" }}>
          <ThemeIcon size={48} radius="xl" color="gray" variant="light" style={{ margin: "0 auto 8px" }}>
            <IconUsers size={24} />
          </ThemeIcon>
          <Text fw={700} size="md">No Guests in Queue</Text>
          <Text size="xs" c="dimmed" mt={4}>
            {activeTab === "ACTIVE"
              ? "All guests are currently seated or waitlist is empty."
              : "No waitlist entries found for today."}
          </Text>
          <Button
            size="sm"
            color="indigo"
            mt="md"
            leftSection={<IconPlus size={16} />}
            onClick={handleOpenAddModal}
          >
            Add Walk-in Party
          </Button>
        </Paper>
      ) : (
        <Stack gap="xs">
          {displayedEntries.map((entry, idx) => {
            const isWaiting = entry.status === "WAITING";
            const isCalled = entry.status === "CALLED";
            const isSeated = entry.status === "SEATED";
            const isCancelled = entry.status === "CANCELLED" || entry.status === "NO_SHOW";

            const elapsedMins = entry.createdAt
              ? Math.max(0, Math.round((Date.now() - new Date(entry.createdAt).getTime()) / 60000))
              : 0;

            const preOrderCount = Array.isArray(entry.preOrderItems) ? entry.preOrderItems.length : 0;

            return (
              <Paper
                key={entry.id}
                p="md"
                radius="md"
                withBorder
                style={{
                  borderLeft: isCalled
                    ? "4px solid #3b82f6"
                    : isWaiting
                    ? "4px solid #f97316"
                    : isSeated
                    ? "4px solid #10b981"
                    : "4px solid #9ca3af",
                }}
              >
                <Group justify="space-between" align="center" wrap="wrap" gap="md">
                  {/* Left: Token & Guest Details */}
                  <Group gap="md" align="center">
                    <ThemeIcon
                      size={44}
                      radius="md"
                      color={isCalled ? "blue" : isWaiting ? "orange" : isSeated ? "teal" : "gray"}
                      variant="light"
                    >
                      <Text fw={800} size="md">#{entry.tokenNumber}</Text>
                    </ThemeIcon>

                    <div>
                      <Group gap="xs" align="center">
                        <Text fw={700} size="md">{entry.guestName}</Text>
                        <Badge
                          size="xs"
                          variant="light"
                          color={isCalled ? "blue" : isWaiting ? "orange" : isSeated ? "teal" : "gray"}
                        >
                          {entry.status}
                        </Badge>
                        {preOrderCount > 0 && (
                          <Badge size="xs" color="indigo" leftSection={<IconChefHat size={12} />}>
                            {preOrderCount} Pre-orders
                          </Badge>
                        )}
                      </Group>

                      <Group gap="md" mt={2} align="center">
                        <Text size="xs" c="dimmed">
                          📱 {entry.guestPhone}
                        </Text>
                        <Text size="xs" c="dimmed">
                          👥 <b>{entry.partySize} Guests</b>
                        </Text>
                        <Text size="xs" c="dimmed">
                          🪑 {entry.seatingPreference}
                        </Text>
                        <Text size="xs" c="dimmed">
                          ⏱️ Waiting {elapsedMins}m
                        </Text>
                      </Group>

                      {entry.notes && (
                        <Text size="xs" c="indigo.8" fs="italic" mt={2}>
                          Note: {entry.notes}
                        </Text>
                      )}

                      {entry.assignedTableName && (
                        <Text size="xs" c="teal.7" fw={600} mt={2}>
                          ✓ Seated at {entry.assignedTableName}
                        </Text>
                      )}
                    </div>
                  </Group>

                  {/* Right: Actions */}
                  <Group gap="xs" align="center">
                    {/* Call Guest button */}
                    {isWaiting && (
                      <Button
                        size="xs"
                        variant="light"
                        color="blue"
                        leftSection={<IconBellRinging size={14} />}
                        onClick={() => handleCallGuest(entry)}
                      >
                        Notify Table Ready
                      </Button>
                    )}

                    {/* Re-call button */}
                    {isCalled && (
                      <Button
                        size="xs"
                        variant="subtle"
                        color="blue"
                        leftSection={<IconBellRinging size={14} />}
                        onClick={() => handleCallGuest(entry)}
                      >
                        Ping Again
                      </Button>
                    )}

                    {/* Seat Guest Button */}
                    {(isWaiting || isCalled) && (
                      <Button
                        size="xs"
                        color="teal"
                        leftSection={<IconArmchair size={14} />}
                        onClick={() => handleOpenSeatModal(entry)}
                      >
                        Seat at Table
                      </Button>
                    )}

                    {/* More actions menu */}
                    {(isWaiting || isCalled) && (
                      <Menu position="bottom-end" shadow="md">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" size="sm">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            color="orange"
                            leftSection={<IconClock size={14} />}
                            onClick={() => handleCancelEntry(entry, "NO_SHOW")}
                          >
                            Mark No-Show
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={<IconX size={14} />}
                            onClick={() => handleCancelEntry(entry, "CANCELLED")}
                          >
                            Cancel Entry
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* ─── Add to Waitlist Modal ───────────────────────────────────────────── */}
      <Modal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={<Text fw={700} size="md">Add Walk-in Party to Waitlist</Text>}
        centered
        radius="md"
      >
        <form onSubmit={handleJoinWaitlist}>
          <Stack gap="sm">
            <TextInput
              label="Guest Name"
              placeholder="e.g. Rahul Sharma"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.currentTarget.value)}
            />

            <TextInput
              label="WhatsApp Mobile Number"
              placeholder="10-digit number"
              required
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.currentTarget.value)}
              leftSection={<IconPhone size={16} />}
              description="Guest will receive automated WhatsApp token & table ready alerts."
            />

            <Group grow>
              <NumberInput
                label="Party Size"
                min={1}
                max={30}
                required
                value={partySize}
                onChange={(val) => setPartySize(typeof val === "number" ? val : 2)}
                leftSection={<IconUsers size={16} />}
              />

              <Select
                label="Seating Preference"
                data={[
                  { label: "Any Available", value: "ANY" },
                  { label: "Indoor (AC)", value: "INDOOR" },
                  { label: "Outdoor / Rooftop", value: "OUTDOOR" },
                  { label: "Bar Counter", value: "BAR" },
                ]}
                value={seatingPreference}
                onChange={(val) => setSeatingPreference(val || "ANY")}
              />
            </Group>

            <TextInput
              label="Special Notes (Optional)"
              placeholder="e.g. Baby high chair, anniversary, quiet corner"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" color="indigo" loading={isSubmitting} leftSection={<IconPlus size={16} />}>
                Add to Waitlist
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* ─── Seat Guest at Table Modal ───────────────────────────────────────── */}
      <Modal
        opened={Boolean(seatingEntry)}
        onClose={() => setSeatingEntry(null)}
        title={
          <Text fw={700} size="md">
            Seat {seatingEntry?.guestName} (Party of {seatingEntry?.partySize})
          </Text>
        }
        centered
        radius="md"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Choose a dining table to seat this party. The table will be marked <b>OCCUPIED</b> and ready for orders.
          </Text>

          {freeTables.length === 0 ? (
            <Alert icon={<IconAlertCircle size={18} />} color="orange" title="No Free Tables">
              All tables are currently occupied. Please free a table first or wait for service to conclude.
            </Alert>
          ) : (
            <Stack gap="xs">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">Available Free Tables:</Text>
              <SimpleGrid cols={2} spacing="xs">
                {freeTables.map((t: any) => {
                  const isSelected = selectedTableId === t.id;
                  const capacityMatch = (t.capacity || 4) >= (seatingEntry?.partySize || 2);
                  return (
                    <Card
                      key={t.id}
                      p="xs"
                      radius="md"
                      withBorder
                      style={{
                        cursor: "pointer",
                        borderColor: isSelected ? "#10b981" : "#e5e7eb",
                        backgroundColor: isSelected ? "#ecfdf5" : "#fff",
                      }}
                      onClick={() => setSelectedTableId(t.id)}
                    >
                      <Group justify="space-between">
                        <div>
                          <Text fw={700} size="sm">{t.name}</Text>
                          <Text size="xs" c="dimmed">{t.capacity || 4} Seats • {t.section || "Main"}</Text>
                        </div>
                        {capacityMatch && (
                          <Badge size="xs" color="teal">Fit</Badge>
                        )}
                      </Group>
                    </Card>
                  );
                })}
              </SimpleGrid>
            </Stack>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setSeatingEntry(null)}>
              Cancel
            </Button>
            <Button
              color="teal"
              disabled={!selectedTableId}
              onClick={handleSeatGuest}
              leftSection={<IconArmchair size={16} />}
            >
              Confirm Seating
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── Entrance QR Standee Modal ───────────────────────────────────────── */}
      <Modal
        opened={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title={<Text fw={700} size="md">Print Entrance &quot;Join Waitlist&quot; Standee</Text>}
        centered
        radius="md"
        size="md"
      >
        <Stack gap="md" align="center" style={{ textAlign: "center" }}>
          <Text size="sm" c="dimmed">
            Print this poster for your restaurant entrance or door. Walk-in guests scan this QR code to join your live waitlist instantly!
          </Text>

          <Paper p="xl" radius="lg" withBorder shadow="sm" style={{ width: "100%", maxWidth: 340, background: "#fafafa" }}>
            <Badge size="md" color="indigo" mb="xs">Scan to Join Queue</Badge>
            <Title order={3} mb={4}>Welcome to our Restaurant</Title>
            <Text size="xs" c="dimmed" mb="md">Scan below with your phone camera</Text>

            <Center p="sm" bg="white" style={{ borderRadius: 8, display: "inline-block" }}>
              <QRCode value={publicJoinUrl} size={200} />
            </Center>

            <Text size="xs" c="dimmed" mt="sm">
              Takes ~15 seconds • Instant WhatsApp Token
            </Text>
          </Paper>

          <Group>
            <Button
              color="indigo"
              leftSection={<IconPrinter size={16} />}
              onClick={() => {
                window.print();
              }}
            >
              Print Standee
            </Button>
            <Button
              variant="default"
              leftSection={<IconShare size={16} />}
              onClick={() => {
                navigator.clipboard.writeText(publicJoinUrl);
                notifications.show({ title: "Link Copied", message: "Waitlist link copied to clipboard", color: "teal" });
              }}
            >
              Copy Link
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
