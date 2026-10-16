"use client";

import React from "react";
import Link from "next/link";
import { useAuctionStore } from "../../stores/auctionStore";
import { useAuthStore } from "../../stores/authStore";
import { TeamIdentity } from "../teams/TeamIdentity";
import { UserMenu } from "../auth/UserMenu";
import { AuthModal } from "../auth/AuthModal";
import { ThemeToggle } from "./ThemeToggle";
import {
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  CopyButton,
  Button,
  Box,
  Divider,
} from "@mantine/core";
import {
  SpeakerSimpleHigh,
  SpeakerSimpleSlash,
  ShieldCheck,
  Users,
  Copy,
  Check,
} from "@phosphor-icons/react";

interface TopNavBarProps {
  roomId?: string;
  roomName?: string;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  roomId,
  roomName = "IPL 2026 Auction",
}) => {
  const { voiceEnabled, setVoiceEnabled, snapshot, myFranchise } = useAuctionStore();
  const { isAdmin } = useAuthStore();

  const isLive = snapshot?.status === "LIVE";
  const connectedHumans = snapshot?.connectedHumanCount || 1;

  return (
    <Box
      component="header"
      h={52}
      w="100%"
      px={{ base: "xs", sm: "md" }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(79, 70, 229, 0.2)",
        backgroundColor: "rgba(10, 14, 34, 0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        userSelect: "none",
      }}
    >
      {/* Brand & Room Info */}
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Box
            w={32}
            h={32}
            style={{
              borderRadius: 8,
              backgroundColor: "#141b3d",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: 12,
              letterSpacing: "0.05em",
            }}
          >
            IPL
          </Box>
        </Link>

        <Divider orientation="vertical" h={20} color="dark.5" />

        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Text
            size="xs"
            fw={800}
            c="white"
            truncate
            visibleFrom="md"
            style={{ maxWidth: 160 }}
          >
            {roomName || "IPL 2026 Mega Auction"}
          </Text>

          {roomId && (
            <CopyButton value={roomId} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied!" : `Copy Code: ${roomId}`} withArrow position="bottom">
                  <Badge
                    component="button"
                    onClick={copy}
                    variant="light"
                    color="indigo"
                    size="sm"
                    radius="xs"
                    px={{ base: 6, sm: 8 }}
                    style={{ cursor: "pointer", fontFamily: "monospace", fontWeight: 700 }}
                    rightSection={
                      copied ? <Check size={12} weight="bold" color="#51cf66" /> : <Copy size={12} weight="bold" />
                    }
                  >
                    {roomId}
                  </Badge>
                </Tooltip>
              )}
            </CopyButton>
          )}

          {isLive ? (
            <Badge
              color="teal"
              variant="filled"
              size="xs"
              radius="xl"
              style={{ fontWeight: 800 }}
            >
              LIVE
            </Badge>
          ) : (
            <Badge color="gray" variant="light" size="xs" radius="xs">
              {snapshot?.status || "LOBBY"}
            </Badge>
          )}
        </Group>

        {myFranchise && (
          <>
            <Divider orientation="vertical" h={20} color="dark.5" visibleFrom="xs" />
            <Group gap={6} visibleFrom="xs">
              <Text size="10px" fw={700} c="dimmed">
                TEAM:
              </Text>
              <TeamIdentity code={myFranchise} size="sm" />
            </Group>
          </>
        )}
      </Group>

      {/* Right Controls */}
      <Group gap="xs" wrap="nowrap">
        {/* Human Presence Counter */}
        <Tooltip label={`${connectedHumans} active participants`} withArrow position="bottom">
          <Badge
            variant="default"
            size="md"
            radius="md"
            leftSection={<Users size={14} weight="bold" color="#748ffc" />}
            style={{ fontFamily: "monospace", fontWeight: 700 }}
          >
            {connectedHumans}
          </Badge>
        </Tooltip>

        {/* Voice Toggle */}
        <Tooltip
          label={voiceEnabled ? "Mute Voice Announcements" : "Enable Voice Announcements"}
          withArrow
          position="bottom"
        >
          <ActionIcon
            variant="default"
            size="md"
            radius="md"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            aria-label="Toggle voice announcements"
          >
            {voiceEnabled ? (
              <SpeakerSimpleHigh size={18} weight="bold" color="#51cf66" />
            ) : (
              <SpeakerSimpleSlash size={18} weight="bold" color="#868e96" />
            )}
          </ActionIcon>
        </Tooltip>

        {/* Theme Mode Toggle */}
        <ThemeToggle />

        {/* Admin Link */}
        {isAdmin && (
          <Tooltip label="Admin Panel" withArrow position="bottom">
            <Box>
              <ActionIcon
                component={Link}
                href="/admin/dashboard"
                size="md"
                variant="light"
                color="yellow"
                radius="md"
                hiddenFrom="lg"
                aria-label="Admin Panel"
              >
                <ShieldCheck size={16} weight="bold" />
              </ActionIcon>
              <Button
                component={Link}
                href="/admin/dashboard"
                size="xs"
                variant="light"
                color="yellow"
                radius="md"
                visibleFrom="lg"
                leftSection={<ShieldCheck size={16} weight="bold" />}
                aria-label="Admin Panel"
              >
                Admin
              </Button>
            </Box>
          </Tooltip>
        )}

        {/* User Profile & Sign-In Menu */}
        <UserMenu />

        {/* Authentication Modal */}
        <AuthModal />
      </Group>
    </Box>
  );
};
