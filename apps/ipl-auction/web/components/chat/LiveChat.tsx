"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { TeamIdentity } from "../teams/TeamIdentity";
import {
  Box,
  Stack,
  Group,
  ScrollArea,
  TextInput,
  ActionIcon,
  Paper,
  Text,
  Badge,
  Avatar,
  Button,
} from "@mantine/core";
import {
  IconSend,
  IconArrowDown,
  IconWifi,
  IconWifiOff,
} from "@tabler/icons-react";

interface LiveChatProps {
  onSendMessage: (text: string) => void;
  isConnected: boolean;
  className?: string;
}

export const LiveChat: React.FC<LiveChatProps> = ({
  onSendMessage,
  isConnected,
  className,
}) => {
  const { snapshot, myFranchise, resetUnreadChat } = useAuctionStore();
  const [inputText, setInputText] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessagesAbove, setHasNewMessagesAbove] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const messages = snapshot?.recentChat || [];

  const handleScrollPosition = (position: { y: number }) => {
    if (!viewportRef.current) return;
    const { scrollHeight, clientHeight } = viewportRef.current;
    const atBottom = scrollHeight - position.y - clientHeight < 40;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasNewMessagesAbove(false);
      resetUnreadChat();
    }
  };

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setHasNewMessagesAbove(true);
    }
  }, [messages.length, isAtBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
    setHasNewMessagesAbove(false);
    resetUnreadChat();
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !isConnected) return;
    onSendMessage(inputText.trim());
    setInputText("");
    setIsAtBottom(true);
  };

  return (
    <Box
      h="100%"
      pos="relative"
      className={className}
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <ScrollArea
        style={{ flex: 1 }}
        p="xs"
        viewportRef={viewportRef}
        onScrollPositionChange={handleScrollPosition}
      >
        {messages.length === 0 ? (
          <Text size="xs" c="dimmed" fs="italic" ta="center" py="xl">
            No chat messages yet. Send a message to the room!
          </Text>
        ) : (
          <Stack gap="xs">
            {messages.map((msg) => (
              <Box key={msg.id}>
                <Group justify="space-between" mb={2}>
                  <Group gap={6}>
                    {msg.franchiseCode ? (
                      <TeamIdentity code={msg.franchiseCode} size="sm" />
                    ) : (
                      <Avatar size={18} radius="xl" color="gray">
                        {msg.displayName[0]?.toUpperCase() || "U"}
                      </Avatar>
                    )}
                    <Text size="xs" fw={700} c="white">
                      {msg.displayName}
                    </Text>
                  </Group>
                  <Text size="10px" c="dimmed" ff="monospace">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </Group>

                <Paper
                  withBorder
                  p="6px 10px"
                  radius="md"
                  bg="dark.7"
                  style={{
                    display: "inline-block",
                    maxWidth: "92%",
                    wordBreak: "break-word",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Text size="xs" c="white">
                    {msg.text}
                  </Text>
                </Paper>
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Stack>
        )}
      </ScrollArea>

      {/* Floating Pill */}
      {hasNewMessagesAbove && (
        <Box pos="absolute" bottom={58} left="50%" style={{ transform: "translateX(-50%)", zIndex: 10 }}>
          <Button
            size="compact-xs"
            radius="xl"
            color="blue"
            leftSection={<IconArrowDown size={12} />}
            onClick={scrollToBottom}
          >
            New messages
          </Button>
        </Box>
      )}

      {/* Input Footer */}
      <Box
        component="form"
        onSubmit={handleSend}
        p="xs"
        style={{
          borderTop: "1px solid rgba(79, 70, 229, 0.2)",
          backgroundColor: "#0d132a",
        }}
      >
        <TextInput
          value={inputText}
          onChange={(e) => setInputText(e.currentTarget.value)}
          placeholder={isConnected ? "Type message... (Enter to send)" : "Connecting to room..."}
          disabled={!isConnected}
          maxLength={300}
          size="xs"
          radius="md"
          leftSection={
            isConnected ? (
              <IconWifi size={14} color="#51cf66" />
            ) : (
              <IconWifiOff size={14} color="#f59f00" />
            )
          }
          rightSection={
            <ActionIcon
              type="submit"
              size="xs"
              color="blue"
              variant="filled"
              disabled={!inputText.trim() || !isConnected}
            >
              <IconSend size={12} />
            </ActionIcon>
          }
        />
      </Box>
    </Box>
  );
};
