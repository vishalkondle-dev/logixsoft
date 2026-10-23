import React, { useState } from "react";
import {
  Modal,
  TextInput,
  Stack,
  Group,
  Text,
  Badge,
  Paper,
  Button,
  Box,
  Loader,
  Alert,
  Avatar,
  ScrollArea,
} from "@mantine/core";
import {
  IconSparkles,
  IconSearch,
  IconArrowRight,
  IconMail,
  IconBrain,
  IconCalendar,
  IconTag,
} from "@tabler/icons-react";
import { AiGlobalSearchResult, AiSearchMatch, EmailMessage } from "../types";
import { api } from "../api";
import dayjs from "dayjs";

interface AiSearchModalProps {
  opened: boolean;
  onClose: () => void;
  onSelectMessage: (id: string) => void;
  activeMailbox?: string;
}

const QUICK_PROMPTS = [
  "Invoices and payment receipts",
  "Urgent emails needing immediate reply",
  "Emails with attachments",
  "Cloudflare or Workers deployment updates",
  "Client feedback and escalated questions",
];

export const AiSearchModal: React.FC<AiSearchModalProps> = ({
  opened,
  onClose,
  onSelectMessage,
  activeMailbox,
}) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiGlobalSearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery !== undefined ? searchQuery : query).trim();
    if (!q) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await api.aiGlobalSearch(q, activeMailbox);
      setResult(res);
    } catch (err: any) {
      setResult({
        query: q,
        summary: `Search error: ${err.message || "Failed to complete AI search"}`,
        matches: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (msgId: string) => {
    onSelectMessage(msgId);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSparkles size={22} color="#0ca678" />
          <div>
            <Text fw={700} size="md">
              AI Global Search
            </Text>
            <Text size="10px" c="dimmed">
              Natural language & semantic inbox intelligence powered by Workers AI
            </Text>
          </div>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        {/* SEARCH INPUT */}
        <TextInput
          placeholder="Ask anything (e.g., 'Show receipts from last week', 'Who asked for deployment?')"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          leftSection={<IconSearch size={18} color="#0ca678" />}
          rightSection={
            <Button
              size="compact-xs"
              color="teal"
              loading={loading}
              onClick={() => handleSearch()}
              style={{ marginRight: 6 }}
            >
              Search
            </Button>
          }
          rightSectionWidth={75}
          size="md"
          radius="md"
          autoFocus
        />

        {/* QUICK PROMPT SUGGESTIONS */}
        <div>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            SUGGESTED QUERIES
          </Text>
          <Group gap={6} wrap="wrap">
            {QUICK_PROMPTS.map((prompt) => (
              <Badge
                key={prompt}
                variant="light"
                color="teal"
                size="sm"
                style={{ cursor: "pointer", textTransform: "none", fontWeight: 500 }}
                onClick={() => {
                  setQuery(prompt);
                  handleSearch(prompt);
                }}
              >
                {prompt}
              </Badge>
            ))}
          </Group>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <Paper p="xl" bg="teal.0" radius="md" style={{ border: "1px dashed #0ca678" }}>
            <Group justify="center" gap="md">
              <Loader color="teal" size="sm" type="dots" />
              <div>
                <Text size="sm" fw={600} c="teal.9">
                  Analyzing inbox semantics with Cloudflare Workers AI...
                </Text>
                <Text size="11px" c="teal.7">
                  Evaluating emotional tone, keywords, sender context and topics
                </Text>
              </div>
            </Group>
          </Paper>
        )}

        {/* RESULTS VIEW */}
        {!loading && hasSearched && result && (
          <Stack gap="sm">
            {/* AI EXECUTIVE SYNTHESIS */}
            <Alert
              icon={<IconBrain size={20} />}
              title="AI Inbox Synthesis"
              color="teal"
              radius="md"
              variant="light"
            >
              <Text size="xs" style={{ lineHeight: 1.5 }}>
                {result.summary}
              </Text>
            </Alert>

            {/* MATCHED EMAILS LIST */}
            <div>
              <Group justify="space-between" mb={6}>
                <Text size="xs" fw={700} c="dimmed">
                  MATCHED MESSAGES ({result.matches.length})
                </Text>
              </Group>

              {result.matches.length === 0 ? (
                <Paper p="lg" bg="gray.0" radius="md" style={{ textAlign: "center" }}>
                  <IconMail size={32} color="#adb5bd" style={{ margin: "0 auto 8px" }} />
                  <Text size="sm" fw={600} c="dimmed">
                    No relevant emails found
                  </Text>
                  <Text size="xs" c="dimmed">
                    Try rephrasing your search or using broader keywords
                  </Text>
                </Paper>
              ) : (
                <ScrollArea.Autosize mah={380} offsetScrollbars>
                  <Stack gap="xs">
                    {result.matches.map((match) => {
                      const msg = match.message;
                      return (
                        <Paper
                          key={match.id}
                          p="sm"
                          radius="md"
                          withBorder
                          style={{
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            borderColor: "#e9ecef",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "#0ca678";
                            e.currentTarget.style.backgroundColor = "#f8fdfa";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#e9ecef";
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                          onClick={() => handleSelect(match.id)}
                        >
                          <Group justify="space-between" wrap="nowrap" align="flex-start">
                            <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                              <Avatar color="teal" radius="xl" size="sm">
                                {(msg?.from_addr || "M").charAt(0).toUpperCase()}
                              </Avatar>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Group gap={6} wrap="nowrap">
                                  <Text size="xs" fw={700} lineClamp={1}>
                                    {msg?.from_addr || "Unknown Sender"}
                                  </Text>
                                  {msg?.created_at && (
                                    <Text size="10px" c="dimmed">
                                      • {dayjs(msg.created_at * 1000).format("MMM D, YYYY")}
                                    </Text>
                                  )}
                                </Group>
                                <Text size="sm" fw={600} c="dark.8" lineClamp={1}>
                                  {msg?.subject || "(No Subject)"}
                                </Text>
                                <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
                                  {msg?.snippet || msg?.text_body || "No snippet available"}
                                </Text>

                                {/* LABELS ON MATCHED MESSAGE */}
                                {msg?.labels && msg.labels.length > 0 && (
                                  <Group gap={4} mt={6} wrap="wrap">
                                    {msg.labels.map((lbl) => (
                                      <Badge
                                        key={lbl.id}
                                        size="xs"
                                        variant="filled"
                                        style={{ backgroundColor: lbl.color, fontSize: 10 }}
                                      >
                                        {lbl.name}
                                      </Badge>
                                    ))}
                                  </Group>
                                )}

                                {/* AI MATCH REASON */}
                                <Paper p={6} mt={6} bg="teal.0" radius="xs" style={{ borderLeft: "3px solid #0ca678" }}>
                                  <Text size="10px" c="teal.9" fw={500}>
                                    💡 {match.reason}
                                  </Text>
                                </Paper>
                              </div>
                            </Group>

                            {/* RELEVANCE BADGE & ARROW */}
                            <Stack align="flex-end" gap={4} style={{ flexShrink: 0 }}>
                              <Badge
                                size="xs"
                                color={
                                  match.relevanceScore >= 85
                                    ? "teal"
                                    : match.relevanceScore >= 65
                                    ? "blue"
                                    : "gray"
                                }
                                variant="light"
                              >
                                {match.relevanceScore}% Match
                              </Badge>
                              <IconArrowRight size={16} color="#0ca678" />
                            </Stack>
                          </Group>
                        </Paper>
                      );
                    })}
                  </Stack>
                </ScrollArea.Autosize>
              )}
            </div>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
};
