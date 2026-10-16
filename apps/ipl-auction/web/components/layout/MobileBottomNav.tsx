"use client";

import React from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { Paper, Group, UnstyledButton, Text, Indicator } from "@mantine/core";
import { IconUsers, IconGavel, IconActivity } from "@tabler/icons-react";

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
        backgroundColor: "rgba(7, 11, 26, 0.95)",
        borderTop: "1px solid rgba(79, 70, 229, 0.25)",
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
            color: activeMobileTab === "teams" ? "#91a7ff" : "#868e96",
            backgroundColor: activeMobileTab === "teams" ? "rgba(76, 110, 245, 0.15)" : "transparent",
            transition: "all 0.15s ease",
          }}
        >
          <IconUsers size={20} stroke={2} />
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
            color: activeMobileTab === "auction" ? "#91a7ff" : "#868e96",
            backgroundColor: activeMobileTab === "auction" ? "rgba(76, 110, 245, 0.2)" : "transparent",
            transition: "all 0.15s ease",
          }}
        >
          <IconGavel size={20} stroke={2} />
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
            color: activeMobileTab === "activity" ? "#91a7ff" : "#868e96",
            backgroundColor: activeMobileTab === "activity" ? "rgba(76, 110, 245, 0.15)" : "transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Indicator
            disabled={totalUnread === 0 || activeMobileTab === "activity"}
            color="red"
            size={8}
            offset={2}
          >
            <IconActivity size={20} stroke={2} />
          </Indicator>
          <Text size="9px" fw={800} tt="uppercase" style={{ letterSpacing: "0.06em" }}>
            Feed
          </Text>
        </UnstyledButton>
      </Group>
    </Paper>
  );
};
