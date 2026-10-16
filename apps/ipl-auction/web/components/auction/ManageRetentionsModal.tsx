"use client";

import React, { useState, useEffect } from "react";
import {
  OFFICIAL_FRANCHISE_RETENTIONS,
  calculateRetentionDeduction,
  RetainedCandidate,
} from "../../lib/retentions";
import { formatRupees } from "../../lib/utils";
import { FranchiseState } from "../../lib/types";
import { CountryFlag } from "../common/CountryFlag";
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
  Alert,
  Checkbox,
  UnstyledButton,
} from "@mantine/core";
import {
  Shield,
  Warning,
  Airplane,
  Check,
} from "@phosphor-icons/react";
import { GiBilledCap } from "react-icons/gi";

interface ManageRetentionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  franchiseCode: string;
  franchiseState?: FranchiseState;
  onSaveRetentions: (franchiseCode: string, playerIds: string[]) => void;
  ruleset?: "MEGA" | "CLASSIC" | "SPRINT_XI";
}

export const ManageRetentionsModal: React.FC<ManageRetentionsModalProps> = ({
  isOpen,
  onClose,
  franchiseCode,
  franchiseState,
  onSaveRetentions,
  ruleset = "MEGA",
}) => {
  const isMega = ruleset === "MEGA";
  const config = OFFICIAL_FRANCHISE_RETENTIONS[franchiseCode];
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (franchiseState && Array.isArray(franchiseState.retainedPlayers)) {
      setSelectedIds(franchiseState.retainedPlayers.map((p) => p.id));
    } else if (config) {
      if (isMega) {
        let capped = 0;
        let uncapped = 0;
        const initial: string[] = [];
        for (const id of config.defaultRetainedIds) {
          if (initial.length >= 6) break;
          const cand = config.candidates.find((c) => c.id === id);
          if (!cand) continue;
          if (cand.isCapped && capped < 5) {
            capped++;
            initial.push(cand.id);
          } else if (!cand.isCapped && uncapped < 2) {
            uncapped++;
            initial.push(cand.id);
          }
        }
        setSelectedIds(initial);
      } else {
        setSelectedIds(config.defaultRetainedIds.slice(0, 11));
      }
    }
  }, [franchiseState, config, isOpen, isMega]);

  if (!isOpen || !config) return null;

  const candidates = config.candidates;
  const selectedCandidates = candidates.filter((c) => selectedIds.includes(c.id));
  const cappedSelected = selectedCandidates.filter((c) => c.isCapped);
  const uncappedSelected = selectedCandidates.filter((c) => !c.isCapped);

  const maxAllowed = isMega ? 6 : 11;
  const maxOverseas = franchiseState?.maxOverseas || 8;
  const overseasSelected = selectedCandidates.filter((c) => c.isOverseas);

  const { totalDeduction, rtmCards } = calculateRetentionDeduction(selectedCandidates, ruleset);
  const totalPurse = franchiseState?.totalPurse || 1200000000;
  const remainingPurse = Math.max(0, totalPurse - totalDeduction);

  const handleToggle = (candidate: RetainedCandidate) => {
    setErrorMsg(null);
    const isSelected = selectedIds.includes(candidate.id);

    if (isSelected) {
      setSelectedIds((prev) => prev.filter((id) => id !== candidate.id));
    } else {
      if (selectedIds.length >= maxAllowed) {
        setErrorMsg(isMega ? "Mega Auction allows a maximum of 6 retentions." : "Classic Auction allows a maximum of 11 retentions.");
        return;
      }
      if (isMega) {
        if (candidate.isCapped && cappedSelected.length >= 5) {
          setErrorMsg("Mega Auction allows a maximum of 5 capped retentions.");
          return;
        }
        if (!candidate.isCapped && uncappedSelected.length >= 2) {
          setErrorMsg("Mega Auction allows a maximum of 2 uncapped retentions.");
          return;
        }
      }
      if (candidate.isOverseas && overseasSelected.length >= maxOverseas) {
        setErrorMsg(`Maximum ${maxOverseas} overseas retentions allowed.`);
        return;
      }
      setSelectedIds((prev) => [...prev, candidate.id]);
    }
  };

  const handleSave = () => {
    if (selectedIds.length > maxAllowed) {
      setErrorMsg(`Cannot exceed ${maxAllowed} retentions.`);
      return;
    }
    if (isMega) {
      if (cappedSelected.length > 5) {
        setErrorMsg("Cannot exceed 5 capped retentions in Mega Auction.");
        return;
      }
      if (uncappedSelected.length > 2) {
        setErrorMsg("Cannot exceed 2 uncapped retentions in Mega Auction.");
        return;
      }
    }
    if (overseasSelected.length > maxOverseas) {
      setErrorMsg(`Cannot exceed ${maxOverseas} overseas retentions.`);
      return;
    }
    onSaveRetentions(franchiseCode, selectedIds);
    onClose();
  };

  const handleResetToDefault = () => {
    if (isMega) {
      let capped = 0;
      let uncapped = 0;
      const initial: string[] = [];
      for (const id of config.defaultRetainedIds) {
        if (initial.length >= 6) break;
        const cand = config.candidates.find((c) => c.id === id);
        if (!cand) continue;
        if (cand.isCapped && capped < 5) {
          capped++;
          initial.push(cand.id);
        } else if (!cand.isCapped && uncapped < 2) {
          uncapped++;
          initial.push(cand.id);
        }
      }
      setSelectedIds(initial);
    } else {
      setSelectedIds(config.defaultRetainedIds.slice(0, 11));
    }
    setErrorMsg(null);
  };

  const handleClearAll = () => {
    setSelectedIds([]);
    setErrorMsg(null);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      size="lg"
      radius="xl"
      title={
        <Group gap="xs">
          <Badge size="lg" color="yellow" variant="light">
            RTM
          </Badge>
          <Box>
            <Title order={4} fw={800} c="white">
              Manage {franchiseCode} Retentions & RTM
            </Title>
            <Text size="11px" c="dimmed">
              {isMega
                ? "Mega Auction: max 6 retentions (up to 5 capped, 2 uncapped) with ₹18, 14, 11, 18, 14 Cr slabs."
                : "Classic Auction: up to 11 squad retentions permitted using official contracts and ₹120 Cr purse."}
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
        {/* Top Summary Metrics */}
        <SimpleGrid cols={3} spacing="xs">
          <Paper withBorder p="xs" radius="md" bg="dark.7" style={{ textAlign: "center" }}>
            <Text size="10px" fw={700} tt="uppercase" c="dimmed">
              Retained Players
            </Text>
            <Text size="sm" fw={800} c="white" mt={2}>
              {selectedIds.length} / {maxAllowed}
            </Text>
            <Text size="10px" c="dimmed">
              ({cappedSelected.length} Capped, {uncappedSelected.length} Uncapped)
            </Text>
          </Paper>

          <Paper withBorder p="xs" radius="md" bg="dark.7" style={{ textAlign: "center" }}>
            <Text size="10px" fw={700} tt="uppercase" c="dimmed">
              Retention Cost
            </Text>
            <Text size="sm" fw={800} ff="monospace" c="yellow.4" mt={2}>
              {formatRupees(totalDeduction)}
            </Text>
            <Text size="10px" c="dimmed">
              From Purse
            </Text>
          </Paper>

          <Paper withBorder p="xs" radius="md" bg="dark.7" style={{ textAlign: "center" }}>
            <Text size="10px" fw={700} tt="uppercase" c="dimmed">
              RTM Cards
            </Text>
            <Text size="sm" fw={800} ff="monospace" c="teal.4" mt={2}>
              {rtmCards} Cards
            </Text>
            <Text size="10px" c="dimmed">
              Available
            </Text>
          </Paper>
        </SimpleGrid>

        {/* Quick actions notice */}
        <Paper withBorder p="xs" radius="md" bg="rgba(245, 159, 0, 0.08)" style={{ borderColor: "rgba(245, 159, 0, 0.3)" }}>
          <Group justify="space-between">
            <Text size="11px" c="yellow.4">
              {isMega
                ? "Slabs: 1st Capped ₹18 Cr • 2nd ₹14 Cr • 3rd ₹11 Cr • 4th ₹18 Cr • 5th ₹14 Cr • Uncapped ₹4 Cr"
                : "Official Contracts: Deducted from ₹120 Cr starting purse"}
            </Text>
            <Group gap="xs">
              <UnstyledButton onClick={handleResetToDefault} style={{ fontSize: 11, color: "#fcc419", fontWeight: 700 }}>
                Reset Official
              </UnstyledButton>
              <Text size="11px" c="dimmed">•</Text>
              <UnstyledButton onClick={handleClearAll} style={{ fontSize: 11, color: "#fcc419", fontWeight: 700 }}>
                Clear All
              </UnstyledButton>
            </Group>
          </Group>
        </Paper>

        {errorMsg && (
          <Alert color="red" variant="light" icon={<Warning size={16} weight="fill" />} title="Retention Restriction">
            {errorMsg}
          </Alert>
        )}

        {/* Candidates List */}
        <ScrollArea h={320} type="auto">
          <Stack gap="xs">
            {candidates.map((c) => {
              const isSelected = selectedIds.includes(c.id);

              return (
                <Paper
                  key={c.id}
                  withBorder
                  p="xs"
                  radius="md"
                  onClick={() => handleToggle(c)}
                  style={{
                    cursor: "pointer",
                    backgroundColor: isSelected ? "rgba(79, 70, 229, 0.15)" : "rgba(15, 23, 42, 0.6)",
                    borderColor: isSelected ? "rgba(99, 102, 241, 0.8)" : "rgba(79, 70, 229, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    userSelect: "none",
                  }}
                >
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => {}}
                      color="indigo"
                      styles={{ input: { cursor: "pointer" } }}
                    />
                    <Box style={{ minWidth: 0 }}>
                      <Group gap={6} wrap="nowrap">
                        <Text size="xs" fw={700} c="white" truncate>
                          {c.name}
                        </Text>
                        {c.isOverseas && <Airplane size={12} weight="fill" color="#f59f00" />}
                        <Badge
                          size="xs"
                          color={c.isCapped ? "blue" : "teal"}
                          variant="light"
                          leftSection={c.isCapped ? <GiBilledCap size={11} /> : undefined}
                        >
                          {c.isCapped ? "CAPPED" : "UNCAPPED"}
                        </Badge>
                      </Group>
                      <Group gap={4} wrap="nowrap" mt={2}>
                        <CountryFlag country={c.country} size="xs" />
                        <Text size="10px" c="dimmed">
                          {c.country} • {c.role.replace(/_/g, " ")} • {c.matches} IPL Matches ({c.runs} Runs, {c.wickets} Wkts)
                        </Text>
                      </Group>
                    </Box>
                  </Group>

                  <Box style={{ textAlign: "right", flexShrink: 0 }}>
                    <Text size="xs" fw={800} ff="monospace" c="white">
                      {formatRupees(c.officialPrice)}
                    </Text>
                    <Text size="9px" c="dimmed">
                      Official Slab
                    </Text>
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </ScrollArea>

        {/* Footer */}
        <Group justify="space-between" pt="xs" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <Text size="xs" c="dimmed">
            Remaining Purse: <strong style={{ color: "#51cf66", fontFamily: "monospace" }}>{formatRupees(remainingPurse)}</strong>
          </Text>
          <Group gap="xs">
            <Button variant="default" size="xs" onClick={onClose}>
              Cancel
            </Button>
            <Button color="blue" size="xs" onClick={handleSave}>
              Save Retentions
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};
