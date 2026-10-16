"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Container,
  Paper,
  Title,
  Text,
  Badge,
  Button,
  TextInput,
  Group,
  Stack,
  ThemeIcon,
  Center,
  Box,
} from "@mantine/core";
import {
  House,
  ArrowLeft,
  MagnifyingGlass,
  ShieldWarning,
  Cricket,
} from "@phosphor-icons/react";

interface InvalidRoomErrorProps {
  roomId: string;
  errorMessage?: string;
}

export function InvalidRoomError({ roomId, errorMessage }: InvalidRoomErrorProps) {
  const router = useRouter();
  const [newRoomId, setNewRoomId] = useState("");

  const handleJoinNew = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRoomId.trim().toUpperCase();
    if (clean) {
      router.push(`/lobby/${clean}`);
    }
  };

  return (
    <Box
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "1rem",
        overflowY: "auto",
        background: "radial-gradient(ellipse at top, #1e112a 0%, #090d16 60%, #000000 100%)",
      }}
    >
      <Container size="xs" w="100%" py={{ base: "xs", sm: "xl" }} my="auto">
        <Paper
          withBorder
          p={{ base: "md", sm: "xl" }}
          radius="xl"
          shadow="xl"
          style={{
            textAlign: "center",
            backdropFilter: "blur(16px)",
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            borderColor: "rgba(239, 68, 68, 0.35)",
          }}
        >
          <Stack gap="xs" align="center">
            {/* Third Umpire Graphic */}
            <Center>
              <ThemeIcon
                size={56}
                radius="xl"
                variant="gradient"
                gradient={{ from: "red.8", to: "orange.7", deg: 135 }}
                style={{
                  boxShadow: "0 0 25px rgba(239, 68, 68, 0.35)",
                  border: "2px solid rgba(239, 68, 68, 0.5)",
                }}
              >
                <Cricket size={30} weight="fill" color="#ffffff" />
              </ThemeIcon>
            </Center>

            {/* Decision Badge */}
            <Badge
              color="red"
              variant="light"
              size="sm"
              leftSection={<ShieldWarning size={14} weight="bold" />}
              style={{ fontWeight: 800, letterSpacing: "0.05em" }}
            >
              <Box component="span" visibleFrom="xs">DRS DECISION: </Box>CLEAN BOWLED!
            </Badge>

            {/* Headline */}
            <Box>
              <Title order={2} c="white" fw={900} fz={{ base: "h4", sm: "h2" }}>
                Pitch Not Found!
              </Title>
              <Text size="xs" c="dimmed" mt={4} lh={1.5}>
                The third umpire reviewed ultra-edge and ball tracking: room code{" "}
                <Badge color="red" variant="filled" size="xs" radius="xs" style={{ fontFamily: "monospace" }}>
                  {roomId || "UNKNOWN"}
                </Badge>{" "}
                does not exist on the pitch or has already been retired.
              </Text>
              {errorMessage && (
                <Text size="xs" c="red.4" fs="italic" mt="xs" p="xs" style={{ background: "rgba(153, 27, 27, 0.2)", borderRadius: 8 }}>
                  {errorMessage}
                </Text>
              )}
            </Box>

            {/* Match Review Card - visible on desktop */}
            <Paper withBorder p="sm" radius="md" w="100%" bg="dark.7" style={{ textAlign: "left" }} visibleFrom="lg">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Umpire Review</Text>
                  <Text size="xs" fw={700} c="red.4" ff="monospace">NO AUCTION LOTS</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Room Code Checked</Text>
                  <Text size="xs" fw={700} c="white" ff="monospace">{roomId}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Status</Text>
                  <Text size="xs" fw={600} c="yellow.5">Unregistered or Expired</Text>
                </Group>
              </Stack>
            </Paper>

            {/* Quick Join Another Code Form */}
            <Box component="form" onSubmit={handleJoinNew} w="100%">
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.currentTarget.value.toUpperCase())}
                  placeholder="e.g. A1C2E3 or K4K9S1"
                  maxLength={10}
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      fontFamily: "monospace",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                    },
                  }}
                />
                <Button
                  type="submit"
                  disabled={!newRoomId.trim()}
                  leftSection={<MagnifyingGlass size={16} weight="bold" />}
                  variant="filled"
                  color="blue"
                >
                  Join
                </Button>
              </Group>
            </Box>

            {/* Navigation Actions */}
            <Group gap="sm" w="100%">
              <Button
                variant="default"
                style={{ flex: 1 }}
                leftSection={<ArrowLeft size={16} weight="bold" />}
                onClick={() => {
                  if (typeof window !== "undefined" && window.history.length > 1) {
                    router.back();
                  } else {
                    router.push("/");
                  }
                }}
              >
                Go Back
              </Button>
              <Button
                component={Link}
                href="/"
                style={{ flex: 1 }}
                leftSection={<House size={16} weight="bold" />}
                variant="gradient"
                gradient={{ from: "red.7", to: "orange.6", deg: 90 }}
              >
                Pavilion
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
