"use client";

import React from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { Paper, Group, UnstyledButton, Text, Indicator } from "@mantine/core";
import { Users, Gavel, Broadcast } from "@phosphor-icons/react";

export const MobileBottomNav: React.FC = () => {
  const {
    activeMobileTab,
    setActiveMobileTab,
    unreadChatCount,
    unreadActivityCount,
  } = useAuctionStore();

  const totalUnread = unreadChatCount + unreadActivityCount;

  return (
    <Paper
      component="nav"
      hiddenFrom="lg"
      className="lg:hidden"
      pos="fixed"
      bottom={0}
      left={0}
      right={0}
      h={58}
      px="md"
      style={{
        zIndex: 100,
        backgroundColor: "var(--ipl-nav-bg)",
        borderTop: "1px solid var(--ipl-border)",
        backdropFilter: "blur(12px)",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Group justify="space-around" w="100%" gap={0}>
        {/* TEAMS */}
        <UnstyledButton
          onClick={() => setActiveMobileTab("teams")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            padding: "6px 16px",
            borderRadius: 8,
            color: activeMobileTab === "teams" ? "var(--mantine-color-blue-filled)" : "var(--mantine-color-dimmed)",
            backgroundColor: activeMobileTab === "teams" ? "rgba(76, 110, 245, 0.12)" : "transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Users size={20} weight={activeMobileTab === "teams" ? "fill" : "bold"} />
          <Text size="9px" fw={800} tt="uppercase" style={{ letterSpacing: "0.06em" }}>
            Teams
          </Text>
        </UnstyledButton>

        {/* AUCTION */}
        <UnstyledButton
          onClick={() => setActiveMobileTab("auction")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            padding: "6px 24px",
            borderRadius: 8,
            color: activeMobileTab === "auction" ? "var(--mantine-color-blue-filled)" : "var(--mantine-color-dimmed)",
            backgroundColor: activeMobileTab === "auction" ? "rgba(76, 110, 245, 0.16)" : "transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Gavel size={20} weight={activeMobileTab === "auction" ? "fill" : "bold"} />
          <Text size="9px" fw={800} tt="uppercase" style={{ letterSpacing: "0.06em" }}>
            Auction
          </Text>
        </UnstyledButton>

        {/* ACTIVITY & CHAT */}
        <UnstyledButton
          onClick={() => setActiveMobileTab("activity")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            padding: "6px 16px",
            borderRadius: 8,
            color: activeMobileTab === "activity" ? "var(--mantine-color-blue-filled)" : "var(--mantine-color-dimmed)",
            backgroundColor: activeMobileTab === "activity" ? "rgba(76, 110, 245, 0.12)" : "transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Indicator
            disabled={totalUnread === 0 || activeMobileTab === "activity"}
            color="red"
            size={8}
            offset={2}
          >
            <Broadcast size={20} weight={activeMobileTab === "activity" ? "fill" : "bold"} />
          </Indicator>
          <Text size="9px" fw={800} tt="uppercase" style={{ letterSpacing: "0.06em" }}>
            Feed
          </Text>
        </UnstyledButton>
      </Group>
    </Paper>
  );
};
