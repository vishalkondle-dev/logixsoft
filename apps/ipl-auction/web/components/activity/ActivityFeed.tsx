"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { formatRupees } from "../../lib/utils";
import {
  Box,
  Stack,
  Group,
  ScrollArea,
  Paper,
  Text,
  Badge,
  Button,
} from "@mantine/core";
import {
  Gavel,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  UserPlus,
  Info,
  ArrowUp,
} from "@phosphor-icons/react";

export const ActivityFeed: React.FC<{ className?: string }> = ({ className }) => {
  const { snapshot } = useAuctionStore();
  const events = snapshot?.recentEvents || [];

  const displayEvents = useMemo(() => {
    const list = [...events].reverse();
    const filtered: typeof list = [];
    let lastUserJoinedTitle: string | null = null;

    for (const evt of list) {
      if (evt.type === "USER_CONNECTED") {
        const title = (evt.title || "").trim();
        if (title && title === lastUserJoinedTitle) {
          continue;
        }
        lastUserJoinedTitle = title;
      } else {
        lastUserJoinedTitle = null;
      }
      filtered.push(evt);
    }
    return filtered;
  }, [events]);

  const [isAtTop, setIsAtTop] = useState(true);
  const [hasNewEventsAbove, setHasNewEventsAbove] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const handleScrollPosition = (position: { y: number }) => {
    const atTop = position.y < 30;
    setIsAtTop(atTop);
    if (atTop) {
      setHasNewEventsAbove(false);
    }
  };

  useEffect(() => {
    if (isAtTop) {
      viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setHasNewEventsAbove(true);
    }
  }, [events.length, isAtTop]);

  const scrollToTop = () => {
    viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setIsAtTop(true);
    setHasNewEventsAbove(false);
  };

  const getCompactEvent = (evt: any) => {
    switch (evt.type) {
      case "BID_ACCEPTED":
      case "BID_PLACED":
        return {
          icon: <Gavel size={14} weight="bold" color="#748ffc" />,
          label: evt.franchiseCode || "Bid",
          sub: "bid",
          amount: evt.amount ? formatRupees(evt.amount) : "",
        };
      case "PLAYER_SOLD":
        return {
          icon: <CheckCircle size={14} weight="fill" color="#51cf66" />,
          label: `SOLD • ${evt.franchiseCode || ""}`,
          sub: "",
          amount: evt.amount ? formatRupees(evt.amount) : "",
        };
      case "PLAYER_UNSOLD":
        return {
          icon: <XCircle size={14} weight="fill" color="#fa5252" />,
          label: "UNSOLD",
          sub: "",
          amount: evt.amount ? formatRupees(evt.amount) : "",
        };
      case "AUCTION_PAUSED":
        return {
          icon: <Pause size={14} weight="bold" color="#fcc419" />,
          label: "Paused",
          sub: "",
          amount: "",
        };
      case "AUCTION_RESUMED":
        return {
          icon: <Play size={14} weight="fill" color="#51cf66" />,
          label: "Resumed",
          sub: "",
          amount: "",
        };
      case "USER_CONNECTED": {
        let userName = "User";
        if (evt.description && evt.description.toLowerCase().includes(" joined")) {
          userName = evt.description.split(/ joined/i)[0].trim();
        } else if (evt.title && evt.title.toLowerCase().includes(" joined")) {
          userName = evt.title.replace(/ joined/i, "").trim();
        } else if (evt.title && !["User Connected", "User Joined", "Participant"].includes(evt.title)) {
          userName = evt.title.trim();
        }
        return {
          icon: <UserPlus size={14} weight="bold" color="#91a7ff" />,
          label: `${userName} Joined`,
          sub: "",
          amount: "",
        };
      }
      default: {
        let clean = evt.title || "Event";
        if (clean.includes("Bidding opened for")) {
          clean = clean.replace("Bidding opened for ", "Lot: ");
        }
        return {
          icon: <Info size={14} weight="bold" color="#868e96" />,
          label: clean,
          sub: "",
          amount: evt.amount ? formatRupees(evt.amount) : "",
        };
      }
    }
  };

  return (
    <Box
      h="100%"
      pos="relative"
      className={className}
      style={{ display: "flex", flexDirection: "column", overflow: "hidden", userSelect: "none" }}
    >
      {!isAtTop && hasNewEventsAbove && (
        <Box pos="absolute" top={8} left="50%" style={{ transform: "translateX(-50%)", zIndex: 10 }}>
          <Button
            size="compact-xs"
            radius="xl"
            color="blue"
            leftSection={<ArrowUp size={12} weight="bold" />}
            onClick={scrollToTop}
          >
            New activity
          </Button>
        </Box>
      )}

      <ScrollArea
        style={{ flex: 1 }}
        p="xs"
        viewportRef={viewportRef}
        onScrollPositionChange={handleScrollPosition}
      >
        {displayEvents.length === 0 ? (
          <Text size="xs" c="dimmed" fs="italic" ta="center" py="xl">
            No auction activity recorded yet.
          </Text>
        ) : (
          <Stack gap={6}>
            {displayEvents.map((evt, idx) => {
              const item = getCompactEvent(evt);
              return (
                <Paper
                  key={evt.id ? `${evt.id}_${idx}` : `seq_${evt.sequence}_${idx}`}
                  withBorder
                  p="6px 10px"
                  radius="md"
                  bg="var(--ipl-bg-card)"
                  style={{
                    borderColor: "var(--ipl-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                    {item.icon}
                    {evt.franchiseCode && (
                      <img
                        src={`/jerseys/${evt.franchiseCode.toLowerCase()}_logo.png`}
                        alt={evt.franchiseCode}
                        style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    )}
                    <Text size="xs" fw={700} c="var(--mantine-color-text)" truncate>
                      {item.label}
                    </Text>
                  </Group>

                  {item.amount && (
                    <Text size="xs" fw={800} ff="monospace" c="teal.4">
                      {item.amount}
                    </Text>
                  )}
                </Paper>
              );
            })}
          </Stack>
        )}
      </ScrollArea>
    </Box>
  );
};
