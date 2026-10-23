import React, { useState, useEffect } from "react";
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
  Loader,
  ThemeIcon,
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
  IconSparkles,
  IconX,
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
  aiSummary?: string | null;
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
  aiSummary,
}) => {
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounced search trigger (450ms)
  useEffect(() => {
    if (localSearch === search) return;
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 450);
    return () => clearTimeout(timer);
  }, [localSearch, search, onSearchChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearchChange(localSearch);
    } else if (e.key === "Escape") {
      setLocalSearch("");
      onSearchChange("");
    }
  };

  const handleClear = () => {
    setLocalSearch("");
    onSearchChange("");
  };

  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* AI Semantic Search Bar & Manual Refresh */}
      <Box p="xs" px="md" style={{ borderBottom: "1px solid #e9ecef", backgroundColor: "#ffffff" }}>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            id="inpage-ai-search-input"
            placeholder="AI Search: ask anything (e.g. 'refunds', 'hosting bill')..."
            leftSection={
              <Tooltip label="Powered by Workers AI — semantic search finds emails even without exact keywords" withArrow>
                <Box style={{ display: "flex", alignItems: "center" }}>
                  <IconSparkles size={16} color="#0ca678" />
                </Box>
              </Tooltip>
            }
            value={localSearch}
            onChange={(e) => setLocalSearch(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            size="sm"
            radius="md"
            style={{ flex: 1 }}
            rightSection={
              loading ? (
                <Loader size={14} color="teal" />
              ) : localSearch ? (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={handleClear}
                  aria-label="Clear AI search"
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : (
                <Tooltip label="Semantic AI Search" withArrow>
                  <Badge
                    size="xs"
                    variant="light"
                    color="teal"
                    style={{ textTransform: "none", cursor: "default" }}
                  >
                    AI
                  </Badge>
                </Tooltip>
              )
            }
            styles={{
              input: {
                backgroundColor: localSearch ? "#f0fdf4" : "#f8fafc",
                borderColor: localSearch ? "#0ca678" : "#dee2e6",
                fontWeight: 500,
              },
            }}
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

        {/* AI Semantic Search Synthesis Banner */}
        {search.trim() && aiSummary && (
          <Paper
            p="xs"
            mt="xs"
            radius="md"
            withBorder
            bg="teal.0"
            style={{ border: "1px solid #a7f3d0" }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Group gap={6} align="flex-start" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                <ThemeIcon size="xs" color="teal" radius="xl" mt={2} style={{ flexShrink: 0 }}>
                  <IconSparkles size={12} />
                </ThemeIcon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="11px" fw={700} c="teal.9">
                    Workers AI Search Synthesis
                  </Text>
                  <Text size="11px" c="teal.8" lineClamp={2} style={{ lineHeight: 1.4 }}>
                    {aiSummary}
                  </Text>
                </div>
              </Group>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="teal"
                onClick={handleClear}
                title="Clear AI search"
              >
                <IconX size={12} />
              </ActionIcon>
            </Group>
          </Paper>
        )}
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
                      {/* AI SEMANTIC MATCH REASON */}
                      {msg.ai_reason && (
                        <Badge
                          size="xs"
                          color="teal"
                          variant="light"
                          leftSection={<IconSparkles size={11} />}
                          style={{ textTransform: "none", fontWeight: 600 }}
                        >
                          {msg.relevance_score ? `${msg.relevance_score}% • ` : ""}{msg.ai_reason}
                        </Badge>
                      )}

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
