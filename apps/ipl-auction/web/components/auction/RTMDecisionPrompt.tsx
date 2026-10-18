"use client";

import React, { useEffect, useState } from "react";
import { RTMState, FranchiseState } from "../../lib/types";
import { formatRupees } from "../../lib/utils";
import {
  Modal,
  Paper,
  Box,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  Progress,
  Button,
  SimpleGrid,
  ThemeIcon,
  Alert,
} from "@mantine/core";
import {
  Lightning,
  Clock,
  Airplane,
} from "@phosphor-icons/react";

interface RTMDecisionPromptProps {
  rtmState: RTMState;
  myFranchise: string | null;
  myFranchiseState?: FranchiseState;
  onDecideRtm: (exercise: boolean) => void;
}

export const RTMDecisionPrompt: React.FC<RTMDecisionPromptProps> = ({
  rtmState,
  myFranchise,
  myFranchiseState,
  onDecideRtm,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(10);
  const isMyDecision = myFranchise === rtmState.eligibleFranchise;
  const hasAutoDeclinedRef = React.useRef(false);

  useEffect(() => {
    hasAutoDeclinedRef.current = false;
  }, [rtmState.lotId]);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((rtmState.timerDeadline - now) / 1000));
      setSecondsRemaining(diff);
      if (diff === 0 && isMyDecision && !hasAutoDeclinedRef.current) {
        hasAutoDeclinedRef.current = true;
        onDecideRtm(false);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 250);
    return () => clearInterval(timer);
  }, [rtmState.timerDeadline, isMyDecision, onDecideRtm]);

  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / 10) * 100));

  if (isMyDecision) {
    return (
      <Modal
        opened={true}
        onClose={() => {}}
        withCloseButton={false}
        centered
        radius="xl"
        padding={0}
        overlayProps={{ backgroundOpacity: 0.8, blur: 8 }}
        styles={{
          content: {
            backgroundColor: "var(--ipl-modal-bg)",
            border: "2px solid rgba(245, 159, 0, 0.7)",
            overflow: "hidden",
          },
        }}
      >
        {/* Top Header Banner */}
        <Box
          p="sm"
          style={{
            background: "linear-gradient(90deg, #d97706 0%, #ea580c 50%, #b45309 100%)",
            color: "#ffffff",
          }}
        >
          <Group justify="space-between">
            <Group gap={6}>
              <Lightning size={20} weight="fill" color="#fef08a" />
              <Text size="xs" fw={900} tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                Right to Match (RTM) Opportunity
              </Text>
            </Group>
            <Badge color="dark" variant="filled" size="sm" leftSection={<Clock size={12} weight="bold" />}>
              {secondsRemaining}s
            </Badge>
          </Group>
        </Box>

        <Progress value={progressPercent} color="yellow" size={4} radius={0} />

        <Box p="lg">
          <Stack gap="md" align="center" style={{ textAlign: "center" }}>
            <Box>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Your Former Player
              </Text>
              <Group gap="xs" justify="center" mt={4}>
                <Title order={3} c="var(--mantine-color-text)" fw={900}>
                  {rtmState.playerName}
                </Title>
                {rtmState.isOverseas && <Airplane size={18} weight="fill" color="#f59f00" />}
              </Group>
              <Text size="xs" c="dimmed" mt={2}>
                Role: <strong style={{ color: "var(--mantine-color-text)" }}>{rtmState.playerRole.replace(/_/g, " ")}</strong>
              </Text>
            </Box>

            {/* Price Box */}
            <Paper withBorder p="md" radius="md" w="100%" bg="rgba(245, 159, 0, 0.1)" style={{ borderColor: "rgba(245, 159, 0, 0.3)" }}>
              <Text size="xs" c="dimmed">
                Hammer closed with highest bid by <strong style={{ color: "var(--mantine-color-text)" }}>{rtmState.highestBidderFranchise}</strong>
              </Text>
              <Text size="xl" fw={900} ff="monospace" c="yellow.5" my={4}>
                {formatRupees(rtmState.finalBidAmount)}
              </Text>
              <Text size="11px" c="dimmed">
                Match this exact amount to immediately retain {rtmState.playerName} for your franchise!
              </Text>
            </Paper>

            {/* Purse & cards remaining */}
            <SimpleGrid cols={2} w="100%" spacing="xs">
              <Paper withBorder p="xs" radius="md" bg="var(--ipl-bg-card-subtle)" style={{ textAlign: "left", borderColor: "var(--ipl-border)" }}>
                <Text size="10px" c="dimmed">Your Remaining Purse</Text>
                <Text size="xs" fw={800} ff="monospace" c="teal.5">
                  {formatRupees(myFranchiseState?.remainingPurse || 0)}
                </Text>
              </Paper>
              <Paper withBorder p="xs" radius="md" bg="var(--ipl-bg-card-subtle)" style={{ textAlign: "left", borderColor: "var(--ipl-border)" }}>
                <Text size="10px" c="dimmed">RTM Cards Remaining</Text>
                <Text size="xs" fw={800} ff="monospace" c="yellow.5">
                  {myFranchiseState?.rtmCardsRemaining || 1} Cards
                </Text>
              </Paper>
            </SimpleGrid>

            {/* Action Buttons */}
            <SimpleGrid cols={2} w="100%" spacing="sm" pt="xs">
              <Button
                variant="default"
                size="md"
                radius="md"
                onClick={() => onDecideRtm(false)}
              >
                Decline RTM
              </Button>
              <Button
                variant="gradient"
                gradient={{ from: "yellow.6", to: "orange.6", deg: 90 }}
                size="md"
                radius="md"
                leftSection={<Lightning size={18} weight="fill" />}
                onClick={() => onDecideRtm(true)}
              >
                Match & Retain
              </Button>
            </SimpleGrid>
          </Stack>
        </Box>
      </Modal>
    );
  }

  // Spectator / Other team view: Notification banner
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      bg="rgba(245, 159, 0, 0.12)"
      style={{
        borderColor: "rgba(245, 159, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
        <ThemeIcon size="md" radius="sm" color="yellow" variant="light">
          <Lightning size={16} weight="fill" />
        </ThemeIcon>
        <Box style={{ minWidth: 0 }}>
          <Text size="xs" fw={700} c="var(--mantine-color-text)">
            <span style={{ color: "#f59f00" }}>{rtmState.eligibleFranchise}</span> evaluating Right to Match (RTM) for{" "}
            <strong>{rtmState.playerName}</strong>
          </Text>
          <Text size="11px" c="dimmed">
            Matching price: <strong style={{ color: "#51cf66", fontFamily: "monospace" }}>{formatRupees(rtmState.finalBidAmount)}</strong> (bid by {rtmState.highestBidderFranchise})
          </Text>
        </Box>
      </Group>

      <Badge color="yellow" variant="filled" size="sm" leftSection={<Clock size={12} weight="bold" />}>
        {secondsRemaining > 0 ? `${secondsRemaining}s` : "Resolving..."}
      </Badge>
    </Paper>
  );
};
