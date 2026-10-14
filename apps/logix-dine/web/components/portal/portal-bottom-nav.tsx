"use client";

import React from "react";
import { Box, Group, Text, UnstyledButton, Badge } from "@mantine/core";
import {
  IconSmartHome,
  IconReceipt2,
  IconFlame,
  IconUser,
} from "@tabler/icons-react";

export type PortalTab = "home" | "live" | "orders" | "profile";

interface PortalBottomNavProps {
  activeTab: PortalTab;
  onTabChange: (tab: PortalTab) => void;
  activeOrdersCount?: number;
  liveCount?: number;
  isLiveActive?: boolean;
}

export function PortalBottomNav({
  activeTab,
  onTabChange,
  activeOrdersCount = 0,
  liveCount = 0,
  isLiveActive = false,
}: PortalBottomNavProps) {
  const tabs = [
    {
      id: "home" as const,
      label: "Home",
      icon: IconSmartHome,
    },
    {
      id: "live" as const,
      label: "Live",
      icon: IconFlame,
      isLive: isLiveActive || liveCount > 0,
      badge: liveCount > 0 ? liveCount : undefined,
    },
    {
      id: "orders" as const,
      label: "Orders",
      icon: IconReceipt2,
    },
    {
      id: "profile" as const,
      label: "Profile",
      icon: IconUser,
    },
  ];

  return (
    <Box
      component="nav"
      aria-label="Customer Navigation"
      style={{
        position: "fixed",
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 24px)",
        maxWidth: 440,
        zIndex: 90,
        background: "rgba(255, 255, 255, 0.94)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(220, 215, 254, 0.6)",
        borderRadius: 9999,
        padding: "6px 8px",
        boxShadow: "0 12px 36px rgba(112, 72, 232, 0.16), 0 4px 12px rgba(0, 0, 0, 0.05)",
      }}
    >
      <Group justify="space-between" align="center" gap={4} wrap="nowrap">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const isLivePulse = tab.id === "live" && (tab.isLive || tab.badge);

          return (
            <UnstyledButton
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px 4px",
                borderRadius: 9999,
                background: isActive
                  ? tab.id === "live"
                    ? "linear-gradient(135deg, rgba(255, 107, 107, 0.16) 0%, rgba(255, 235, 235, 0.9) 100%)"
                    : "linear-gradient(135deg, rgba(121, 80, 242, 0.12) 0%, rgba(235, 230, 255, 0.9) 100%)"
                  : "transparent",
                color: isActive
                  ? tab.id === "live"
                    ? "#e03131"
                    : "#7950f2"
                  : "#868e96",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: isActive ? "scale(1.04)" : "scale(1)",
                cursor: "pointer",
                userSelect: "none",
                position: "relative",
              }}
            >
              <Box style={{ position: "relative", display: "inline-flex" }}>
                <Icon
                  size={20}
                  stroke={isActive ? 2.5 : 1.7}
                  color={
                    isActive
                      ? tab.id === "live"
                        ? "#e03131"
                        : "#7950f2"
                      : isLivePulse
                      ? "#fa5252"
                      : "#868e96"
                  }
                />
                {isLivePulse && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -3,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "#ff4d4f",
                      boxShadow: "0 0 0 2px #fff, 0 0 8px #ff4d4f",
                      animation: "pulse 1.8s infinite ease-in-out",
                    }}
                  />
                )}
                {tab.badge != null && (
                  <Badge
                    size="xs"
                    circle
                    color="red"
                    variant="filled"
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -10,
                      fontSize: 10,
                      height: 16,
                      minWidth: 16,
                      boxShadow: "0 0 0 2px #fff",
                    }}
                  >
                    {tab.badge}
                  </Badge>
                )}
              </Box>
              <Text
                size="11px"
                fw={isActive ? 700 : 500}
                style={{
                  color: isActive
                    ? tab.id === "live"
                      ? "#e03131"
                      : "#7950f2"
                    : isLivePulse
                    ? "#e03131"
                    : "#868e96",
                  lineHeight: 1.2,
                  marginTop: 2,
                  letterSpacing: "-0.2px",
                }}
              >
                {tab.label}
              </Text>
            </UnstyledButton>
          );
        })}
      </Group>
    </Box>
  );
}
