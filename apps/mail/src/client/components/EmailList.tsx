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
  Tooltip,
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
  IconRefresh,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { EmailMessage } from "../types";
import { PullToRefresh } from "./PullToRefresh";

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
  onRefresh?: () => Promise<void> | void;
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
  onRefresh,
}) => {
  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Search Bar & Manual Refresh */}
      <Box p="md" style={{ borderBottom: "1px solid #e9ecef" }}>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            placeholder="Search subjects, senders, contents..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => onSearchChange(e.currentTarget.value)}
            size="sm"
            radius="md"
            style={{ flex: 1 }}
          />
          {onRefresh && (
            <Tooltip label="Refresh emails (or pull down to refresh)">
              <ActionIcon
                variant="light"
                color="teal"
                size={36}
                radius="md"
                onClick={() => onRefresh()}
                loading={loading}
                aria-label="Refresh messages"
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Box>

      {/* Message Cards Scroll List with Pull To Refresh */}
      <Box style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <PullToRefresh onRefresh={onRefresh || (() => {})}>
          <ScrollArea
            style={{ height: "100%" }}
            viewportProps={{
              style: {
                overscrollBehaviorY: "contain",
                WebkitOverflowScrolling: "touch",
              },
            }}
          >
            <Stack
              gap={6}
              px="xs"
              pt="xs"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 48px)",
              }}
            >
              {messages.length === 0 && !loading && (
                <Center py={60}>
                  <Stack align="center" gap="xs">
                    <IconInbox size={48} stroke={1.2} color="#adb5bd" />
                    <Text fw={600} size="sm" c="dimmed">
                      No emails in {activeFolder}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Pull down to check for new emails!
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

                    <Group gap={4} mt={6} wrap="wrap">
                      {/* LABELS */}
                      {msg.labels && msg.labels.length > 0 && (
                        <>
                          {msg.labels.map((lbl) => (
                            <Badge
                              key={lbl.id}
                              size="xs"
                              variant="filled"
                              style={{ backgroundColor: lbl.color, fontSize: 10, color: "#fff" }}
                            >
                              {lbl.name}
                            </Badge>
                          ))}
                        </>
                      )}

                      <Badge size="xs" variant="light" color="teal">
                        {msg.to_addr.split("@")[0]}
                      </Badge>
                      {isOutbound && (
                        <Badge size="xs" variant="outline" color="gray">
                          Sent
                        </Badge>
                      )}
                      {(() => {
                        let clef: any = null;
                        if (msg.clef_analysis) {
                          try {
                            clef = JSON.parse(msg.clef_analysis);
                          } catch {}
                        }
                        if (!clef) {
                          if (msg.spam_verdict && msg.spam_verdict !== "pass" && msg.spam_verdict !== "valid_human") {
                            return (
                              <Badge size="xs" color="orange">
                                {msg.spam_verdict}
                              </Badge>
                            );
                          }
                          return null;
                        }

                        return (
                          <>
                            {clef.validity?.category === "phishing_scam" && (
                              <Badge size="xs" color="red" variant="filled">
                                ⚠️ Phishing
                              </Badge>
                            )}
                            {clef.validity?.category === "junk_cold_outreach" && (
                              <Badge size="xs" color="orange" variant="light">
                                Junk
                              </Badge>
                            )}
                            {clef.urgency?.level === "critical_same_day" && (
                              <Badge size="xs" color="red" variant="light">
                                ⚡ Urgent
                              </Badge>
                            )}
                            {clef.tone?.primary === "angry_escalated" && (
                              <Badge size="xs" color="grape" variant="light">
                                😡 Escalated
                              </Badge>
                            )}
                          </>
                        );
                      })()}
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          </ScrollArea>
        </PullToRefresh>
      </Box>
    </Box>
  );
};
