"use client";

import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { formatRupees } from "../../lib/utils";
import {
  Box,
  Paper,
  Text,
  Title,
  Group,
  Stack,
  Badge,
  Transition,
  ActionIcon,
} from "@mantine/core";
import { X, CheckCircle, Gavel, Airplane } from "@phosphor-icons/react";

interface PlayerSoldCelebrationProps {
  opened: boolean;
  onClose: () => void;
  playerName: string;
  playerRole?: string;
  isOverseas?: boolean;
  franchiseCode: string;
  franchiseName?: string;
  amount: number;
}

const FRANCHISE_CONFETTI_COLORS: Record<string, string[]> = {
  CSK: ["#FDB913", "#0081E9", "#FFFFFF", "#FFA000"],
  MI: ["#004BA0", "#D1AB3E", "#FFFFFF", "#002B66"],
  RCB: ["#EC1C24", "#000000", "#D1AB3E", "#FFFFFF"],
  KKR: ["#3A225D", "#F2CA47", "#FFFFFF", "#592E83"],
  SRH: ["#F26522", "#000000", "#FFD700", "#FFFFFF"],
  DC: ["#004C97", "#EF3B24", "#FFFFFF", "#1E3A8A"],
  RR: ["#EA1A85", "#254AA5", "#FFD700", "#FFFFFF"],
  GT: ["#0B4973", "#C29F54", "#FFFFFF", "#1B2A4A"],
  LSG: ["#00ADEF", "#FB6435", "#FFFFFF", "#0284C7"],
  PBKS: ["#DD1F2D", "#A5A9AC", "#FFD700", "#FFFFFF"],
};

const FRANCHISE_NAMES: Record<string, string> = {
  CSK: "Chennai Super Kings",
  MI: "Mumbai Indians",
  RCB: "Royal Challengers Bengaluru",
  KKR: "Kolkata Knight Riders",
  SRH: "Sunrisers Hyderabad",
  DC: "Delhi Capitals",
  RR: "Rajasthan Royals",
  GT: "Gujarat Titans",
  LSG: "Lucknow Super Giants",
  PBKS: "Punjab Kings",
};

export const PlayerSoldCelebration: React.FC<PlayerSoldCelebrationProps> = ({
  opened,
  onClose,
  playerName,
  playerRole,
  isOverseas,
  franchiseCode,
  franchiseName,
  amount,
}) => {
  const code = (franchiseCode || "IPL").toUpperCase();
  const colors = FRANCHISE_CONFETTI_COLORS[code] || ["#FFD700", "#4F46E5", "#10B981", "#EF4444", "#FFFFFF"];
  const displayTeamName = franchiseName || FRANCHISE_NAMES[code] || code;
  const jerseyUrl = `/jerseys/${code.toLowerCase()}_miniature.png`;

  useEffect(() => {
    if (!opened) return;

    // Multi-burst paper blast celebration using canvas-confetti
    const firePaperBlast = () => {
      // 1. Center burst
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.6 },
        colors,
        shapes: ["square", "circle"],
        scalar: 1.2,
        ticks: 250,
      });

      // 2. Left cannon
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 70,
          origin: { x: 0.05, y: 0.75 },
          colors,
          scalar: 1.1,
          ticks: 250,
        });
      }, 150);

      // 3. Right cannon
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 70,
          origin: { x: 0.95, y: 0.75 },
          colors,
          scalar: 1.1,
          ticks: 250,
        });
      }, 300);

      // 4. Final shower
      setTimeout(() => {
        confetti({
          particleCount: 50,
          spread: 120,
          origin: { y: 0.4 },
          colors,
          scalar: 1.3,
          ticks: 250,
        });
      }, 500);
    };

    firePaperBlast();

    // Auto-dismiss after 4.2 seconds (matches lot advance transition)
    const timer = setTimeout(() => {
      onClose();
    }, 4200);

    return () => clearTimeout(timer);
  }, [opened, code]);

  if (!opened) return null;

  return (
    <Transition mounted={opened} transition="pop" duration={350} timingFunction="cubic-bezier(0.34, 1.56, 0.64, 1)">
      {(styles) => (
        <Box
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.72)",
            backdropFilter: "blur(6px)",
            padding: 16,
            pointerEvents: "auto",
          }}
          onClick={onClose}
        >
          <Paper
            style={{
              ...styles,
              position: "relative",
              maxWidth: 480,
              width: "100%",
              overflow: "hidden",
              borderRadius: 24,
              backgroundColor: "var(--ipl-modal-bg, #1a1b1e)",
              border: `2px solid ${colors[0] || "#748ffc"}`,
              boxShadow: `0 20px 50px -10px ${colors[0]}40, 0 0 30px ${colors[1] || colors[0]}30`,
              textAlign: "center",
              padding: "28px 24px 24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              radius="xl"
              style={{ position: "absolute", top: 12, right: 12 }}
              onClick={onClose}
              aria-label="Close celebration"
            >
              <X size={16} weight="bold" />
            </ActionIcon>

            {/* Glowing Accent Ring Behind Logo */}
            <Box
              style={{
                position: "absolute",
                top: -60,
                left: "50%",
                transform: "translateX(-50%)",
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${colors[0]}35 0%, transparent 70%)`,
                pointerEvents: "none",
              }}
            />

            <Stack gap="md" align="center">
              {/* Top Banner */}
              <Badge
                size="lg"
                variant="gradient"
                gradient={{ from: colors[0], to: colors[1] || colors[0], deg: 90 }}
                leftSection={<Gavel size={14} weight="fill" />}
                styles={{
                  root: {
                    padding: "6px 16px",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    boxShadow: `0 4px 14px ${colors[0]}50`,
                  },
                }}
              >
                HAMMER DOWN • SOLD!
              </Badge>

              {/* 2026 Team Kit Showcase */}
              <Box
                style={{
                  position: "relative",
                  width: 140,
                  height: 140,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "8px 0",
                }}
              >
                <img
                  src={jerseyUrl}
                  alt={`${displayTeamName} 2026 Kit`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    filter: `drop-shadow(0 10px 20px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 16px ${colors[0]}70)`,
                  }}
                />
              </Box>

              {/* Franchise Badge Pill */}
              <Badge
                size="md"
                variant="filled"
                style={{
                  backgroundColor: colors[0],
                  color: code === "CSK" || code === "GT" || code === "KKR" ? "#000000" : "#ffffff",
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "4px 14px",
                  boxShadow: `0 2px 10px ${colors[0]}40`,
                }}
              >
                {displayTeamName}
              </Badge>

              {/* Player Name and Role */}
              <Box>
                <Title order={2} fw={900} c="var(--mantine-color-text, #ffffff)" style={{ letterSpacing: "-0.01em" }}>
                  {playerName}
                </Title>
                <Group gap={6} justify="center" mt={4}>
                  {playerRole && (
                    <Badge size="sm" variant="outline" color="gray">
                      {playerRole}
                    </Badge>
                  )}
                  {isOverseas && (
                    <Badge size="sm" color="blue" variant="light" leftSection={<Airplane size={12} weight="bold" />}>
                      Overseas
                    </Badge>
                  )}
                </Group>
              </Box>

              {/* Winning Amount Card */}
              <Paper
                radius="lg"
                p="xs"
                w="100%"
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid var(--ipl-border, rgba(255, 255, 255, 0.1))",
                }}
              >
                <Text size="10px" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                  Winning Bid
                </Text>
                <Text
                  size="xl"
                  fw={900}
                  ff="monospace"
                  style={{
                    color: colors[0] || "#51cf66",
                    fontSize: 28,
                    lineHeight: 1.2,
                  }}
                >
                  {formatRupees(amount)}
                </Text>
              </Paper>

              {/* Winning Franchise Text */}
              <Group gap={6} justify="center" align="center">
                <CheckCircle size={18} weight="fill" color={colors[0]} />
                <Text size="sm" fw={800} c="var(--mantine-color-text, #ffffff)">
                  Sold to{" "}
                  <span style={{ color: colors[0], fontWeight: 900 }}>
                    {displayTeamName} ({code})
                  </span>
                </Text>
              </Group>
            </Stack>
          </Paper>
        </Box>
      )}
    </Transition>
  );
};
