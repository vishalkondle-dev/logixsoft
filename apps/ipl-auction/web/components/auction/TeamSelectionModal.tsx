"use client";

import React from "react";
import { FranchiseState } from "../../lib/types";
import { TeamIdentity } from "../teams/TeamIdentity";
import { formatRupees } from "../../lib/utils";
import {
  Modal,
  Box,
  Group,
  Stack,
  Text,
  Title,
  SimpleGrid,
  Paper,
  Badge,
  Button,
  ScrollArea,
} from "@mantine/core";
import {
  Shield,
  Robot,
  Lock,
  Check,
} from "@phosphor-icons/react";

interface TeamSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Record<string, FranchiseState>;
  onSelectTeam: (franchiseCode: string) => void;
  nextLegalBid?: number;
}

export const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({
  isOpen,
  onClose,
  teams,
  onSelectTeam,
  nextLegalBid,
}) => {
  const teamsList = Object.values(teams || {});

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      size="lg"
      radius="xl"
      title={
        <Group gap="xs">
          <Shield size={22} color="#748ffc" />
          <Box>
            <Title order={4} fw={800} c="white">
              Select Franchise to Bid
            </Title>
            <Text size="11px" c="dimmed">
              Choose an available AI bot team to take over and start placing bids.
            </Text>
          </Box>
        </Group>
      }
      styles={{
        content: {
          backgroundColor: "#0b1024",
          border: "1px solid rgba(79, 70, 229, 0.4)",
        },
      }}
    >
      <Stack gap="md">
        <ScrollArea h={420} type="auto">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {teamsList.map((team) => {
              const isAi = team.controller === "AI";

              return (
                <Paper
                  key={team.code}
                  withBorder
                  p="sm"
                  radius="md"
                  style={{
                    backgroundColor: isAi ? "rgba(15, 23, 42, 0.6)" : "rgba(15, 23, 42, 0.2)",
                    borderColor: isAi ? "rgba(79, 70, 229, 0.3)" : "rgba(255, 255, 255, 0.05)",
                    opacity: isAi ? 1 : 0.6,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                      <TeamIdentity code={team.code} size="md" />
                      <Box style={{ minWidth: 0 }}>
                        <Text size="xs" fw={800} c="white" truncate>
                          {team.name}
                        </Text>
                        <Text size="10px" c="dimmed" ff="monospace">
                          {team.squadCount}/{team.maxSquad} Squad •{" "}
                          <span style={{ color: "#51cf66", fontWeight: 700 }}>
                            {formatRupees(team.remainingPurse)}
                          </span>
                        </Text>
                      </Box>
                    </Group>

                    {isAi ? (
                      <Badge size="xs" color="teal" variant="light" leftSection={<Robot size={10} weight="bold" />}>
                        Bot Available
                      </Badge>
                    ) : (
                      <Badge size="xs" color="gray" variant="light" leftSection={<Lock size={10} weight="bold" />}>
                        Occupied
                      </Badge>
                    )}
                  </Group>

                  <Group justify="space-between" pt="xs" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <Text size="10px" c="dimmed" truncate style={{ maxWidth: 140 }}>
                      {isAi ? "Available to claim" : `Controlled by ${team.humanDisplayName || "Human"}`}
                    </Text>

                    {isAi ? (
                      <Button
                        size="xs"
                        color="blue"
                        leftSection={<Check size={14} weight="bold" />}
                        onClick={() => {
                          onSelectTeam(team.code);
                          onClose();
                        }}
                      >
                        Take Over
                      </Button>
                    ) : (
                      <Button size="xs" disabled variant="default">
                        Unavailable
                      </Button>
                    )}
                  </Group>
                </Paper>
              );
            })}
          </SimpleGrid>
        </ScrollArea>

        <Group justify="space-between" pt="xs" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <Text size="11px" c="dimmed">
            Only AI-controlled teams can be claimed.
          </Text>
          <Button variant="default" size="xs" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
