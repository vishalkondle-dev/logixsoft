"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Container, Paper, Title, Text, Stack, TextInput, NumberInput,
  Select, Button, Group, Badge, ThemeIcon, Center, Loader, Alert
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconUsers, IconClock, IconBrandWhatsapp, IconCheck,
  IconAlertCircle, IconArmchair, IconSparkles, IconLock
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";

export default function JoinWaitlistPage() {
  const params = useParams();
  const router = useRouter();
  const outletId = (params?.outletId as string) || "";

  const { user, isAuthenticated, isLoading: authLoading, openLoginModal } = useAuth();

  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState<number>(2);
  const [seatingPreference, setSeatingPreference] = useState<string>("ANY");
  const [notes, setNotes] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

  // Auto-populate verified user credentials
  useEffect(() => {
    if (user?.phoneNumber) {
      const clean = user.phoneNumber.replace(/\D/g, "").slice(-10);
      setGuestPhone(clean);
    }
    if (user?.name && !guestName) {
      setGuestName(user.name);
    }
  }, [user]);

  useEffect(() => {
    if (!outletId) return;
    fetch(`${apiBase}/waitlist/public/info/${outletId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load outlet queue info");
        return r.json();
      })
      .then((data) => setInfo(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [outletId, apiBase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      notifications.show({ title: "Name Required", message: "Please enter your name", color: "red" });
      return;
    }
    const cleanPhone = guestPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      notifications.show({ title: "Invalid Phone", message: "Please enter a valid 10-digit WhatsApp number", color: "red" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/waitlist/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId,
          guestName: guestName.trim(),
          guestPhone: cleanPhone,
          partySize: Number(partySize) || 2,
          seatingPreference,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to join waitlist");
      }

      notifications.show({
        title: "Joined Waitlist!",
        message: `Token #${data.entry.tokenNumber} allocated. WhatsApp confirmation sent!`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      // Redirect to guest live queue tracker
      router.push(`/q/${outletId}/${data.entry.id}`);
    } catch (err: any) {
      notifications.show({
        title: "Registration Failed",
        message: err.message || "Could not register for queue",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <Center style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
        <Stack align="center" gap="sm">
          <Loader size="md" color="indigo" />
          <Text size="sm" c="dimmed">Loading table queue...</Text>
        </Stack>
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Center style={{ minHeight: "100vh", backgroundColor: "#f8f9fa", padding: 16 }}>
        <Paper p="xl" radius="lg" withBorder shadow="sm" style={{ textAlign: "center", background: "#fff", maxWidth: 440, width: "100%" }}>
          <ThemeIcon size={64} radius="xl" color="indigo" variant="light" mb="md" style={{ margin: "0 auto 16px" }}>
            <IconBrandWhatsapp size={32} />
          </ThemeIcon>
          <Badge size="md" variant="light" color="indigo" mb="xs">
            {info?.restaurantName || "Logix Dine"}
          </Badge>
          <Title order={2} fw={800}>Sign In to Join Waitlist</Title>
          <Text c="dimmed" size="sm" mt="xs" mb="lg">
            Please sign in with your WhatsApp number to join the queue, receive live table ready alerts, and pre-order food.
          </Text>
          <Button
            size="md"
            radius="md"
            color="indigo"
            fullWidth
            leftSection={<IconBrandWhatsapp size={20} />}
            onClick={openLoginModal}
          >
            Sign In with WhatsApp
          </Button>
        </Paper>
      </Center>
    );
  }

  if (error || !info) {
    return (
      <Center style={{ minHeight: "100vh", backgroundColor: "#f8f9fa", padding: 16 }}>
        <Alert icon={<IconAlertCircle size={20} />} title="Queue Unavailable" color="red" radius="md">
          {error || "Could not find restaurant waitlist for this outlet."}
        </Alert>
      </Center>
    );
  }

  return (
    <BoxWrapper>
      <Container size="xs" py="xl">
        <Stack gap="lg">
          {/* Header Card */}
          <Paper p="xl" radius="lg" withBorder style={{ textAlign: "center", background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", color: "#fff" }}>
            <Badge size="lg" variant="white" color="indigo" mb="xs" fw={700}>
              Live Table Waitlist
            </Badge>
            <Title order={2} style={{ color: "#fff" }}>{info.restaurantName}</Title>
            <Text size="sm" style={{ opacity: 0.9 }}>{info.outletName}</Text>
            {info.address && (
              <Text size="xs" style={{ opacity: 0.75 }} mt={4}>{info.address}</Text>
            )}

            <Group justify="center" gap="md" mt="md">
              <Badge size="md" variant="light" color="gray" leftSection={<IconUsers size={14} />}>
                {info.waitingCount} {info.waitingCount === 1 ? "party" : "parties"} waiting
              </Badge>
              <Badge size="md" variant="light" color="yellow" leftSection={<IconClock size={14} />}>
                ~{info.estimatedWaitMinutes} mins est. wait
              </Badge>
            </Group>
          </Paper>

          {/* Registration Form */}
          <Paper p="xl" radius="lg" withBorder shadow="sm">
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <Text fw={700} size="md">Enter Details to Join Queue</Text>

                <TextInput
                  label="Your Name"
                  placeholder="e.g. Rahul Sharma"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.currentTarget.value)}
                  size="md"
                />

                <TextInput
                  label="WhatsApp Number"
                  description={user?.phoneNumber ? "Verified WhatsApp number" : "We will send your digital token & table ready alert here"}
                  placeholder="10-digit mobile number"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.currentTarget.value)}
                  disabled={Boolean(user?.phoneNumber)}
                  rightSection={
                    user?.phoneNumber ? (
                      <Badge size="xs" color="teal" variant="light">
                        Verified
                      </Badge>
                    ) : undefined
                  }
                  leftSection={<IconBrandWhatsapp size={18} color="#25D366" />}
                  size="md"
                />

                <Group grow>
                  <NumberInput
                    label="Number of Guests"
                    description="Party size (including kids)"
                    min={1}
                    max={30}
                    value={partySize}
                    onChange={(val) => setPartySize(typeof val === "number" ? val : 2)}
                    size="md"
                    leftSection={<IconUsers size={18} />}
                  />

                  <Select
                    label="Seating Preference"
                    description="Floor or ambiance"
                    data={[
                      { label: "Any Available", value: "ANY" },
                      { label: "Indoor (AC)", value: "INDOOR" },
                      { label: "Outdoor / Rooftop", value: "OUTDOOR" },
                      { label: "Bar Counter", value: "BAR" },
                    ]}
                    value={seatingPreference}
                    onChange={(val) => setSeatingPreference(val || "ANY")}
                    size="md"
                    leftSection={<IconArmchair size={18} />}
                  />
                </Group>

                <TextInput
                  label="Special Requests (Optional)"
                  placeholder="e.g. Baby high-chair, quiet corner, birthday"
                  value={notes}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                />

                <Button
                  type="submit"
                  size="lg"
                  color="indigo"
                  loading={submitting}
                  fullWidth
                  mt="sm"
                  leftSection={<IconSparkles size={20} />}
                >
                  Join Waitlist Now
                </Button>

                <Text size="xs" c="dimmed" ta="center">
                  Instant token confirmation and live queue tracker link will be dispatched to your WhatsApp.
                </Text>
              </Stack>
            </form>
          </Paper>
        </Stack>
      </Container>
    </BoxWrapper>
  );
}

function BoxWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", paddingBottom: 40 }}>
      {children}
    </div>
  );
}
