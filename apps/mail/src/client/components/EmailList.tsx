import React from "react";
import {
  Stack,
  Paper,
  Text,
  Group,
  Badge,
  ActionIcon,
  TextInput,
  ScrollArea,
  Box,
  Center,
} from "@mantine/core";
import {
  IconSearch,
  IconStar,
  IconStarFilled,
  IconMailOpened,
  IconMail,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconInbox,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { EmailMessage } from "../types";

dayjs.extend(relativeTime);

interface EmailListProps {
  messages: EmailMessage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  search: string;
  onSearchChange: (val: string) => void;
  loading: boolean;
  activeFolder: string;
}

export const EmailList: React.FC<EmailListProps> = ({
  messages,
  selectedId,
  onSelect,
  onToggleStar,
  search,
  onSearchChange,
  loading,
  activeFolder,
}) => {
  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Search Bar */}
      <Box p="md" style={{ borderBottom: "1px solid #e9ecef" }}>
        <TextInput
          placeholder="Search subjects, senders, contents..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          size="sm"
          radius="md"
        />
      </Box>

      {/* Message Cards Scroll List */}
      <ScrollArea style={{ flex: 1 }}>
        <Stack gap={6} p="xs">
          {messages.length === 0 && !loading && (
            <Center py={60}>
              <Stack align="center" gap="xs">
                <IconInbox size={48} stroke={1.2} color="#adb5bd" />
                <Text fw={600} size="sm" c="dimmed">
                  No emails in {activeFolder}
                </Text>
                <Text size="xs" c="dimmed">
                  New incoming messages will arrive in real time!
                </Text>
              </Stack>
            </Center>
          )}

          {messages.map((msg) => {
            const isSelected = selectedId === msg.id;
            const isUnread = !msg.read;
            const isOutbound = msg.direction === "outbound";
            const displayAddress = isOutbound ? `To: ${msg.to_addr}` : msg.from_addr;
            const dateStr = dayjs(msg.created_at * 1000).fromNow();

            return (
              <Paper
                key={msg.id}
                p="sm"
                radius="md"
                withBorder
                onClick={() => onSelect(msg.id)}
                style={{
                  cursor: "pointer",
                  backgroundColor: isSelected ? "#e6fcf5" : isUnread ? "#ffffff" : "#f8fafc",
                  borderColor: isSelected ? "#20c997" : isUnread ? "#c3fae8" : "#e9ecef",
                  transition: "all 0.15s ease",
                  borderLeft: isUnread ? "4px solid #0ca678" : undefined,
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap" mb={4}>
                  <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
                    {isOutbound ? (
                      <IconArrowUpRight size={15} color="#20c997" />
                    ) : (
                      <IconArrowDownLeft size={15} color="#0ca678" />
                    )}

                    <Text
                      size="sm"
                      fw={isUnread ? 700 : 500}
                      truncate
                      style={{ flex: 1 }}
                    >
                      {displayAddress}
                    </Text>
                  </Group>

                  <Group gap={4}>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                      {dateStr}
                    </Text>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color={msg.starred ? "yellow" : "gray"}
                      onClick={(e) => onToggleStar(msg.id, e)}
                    >
                      {msg.starred ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                    </ActionIcon>
                  </Group>
                </Group>

                <Text size="sm" fw={isUnread ? 700 : 600} c="dark.8" truncate mb={2}>
                  {msg.subject || "(no subject)"}
                </Text>

                <Text size="xs" c="dimmed" lineClamp={2}>
                  {msg.snippet || "No preview available"}
                </Text>

                <Group gap={4} mt={6}>
                  <Badge size="xs" variant="light" color="teal">
                    {msg.to_addr.split("@")[0]}
                  </Badge>
                  {isOutbound && (
                    <Badge size="xs" variant="outline" color="gray">
                      Sent
                    </Badge>
                  )}
                  {msg.spam_verdict && msg.spam_verdict !== "pass" && (
                    <Badge size="xs" color="orange">
                      Spam Warning
                    </Badge>
                  )}
                </Group>
              </Paper>
            );
          })}
        </Stack>
      </ScrollArea>
    </Box>
  );
};
