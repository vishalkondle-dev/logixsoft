import React, { useState, useEffect } from "react";
import {
  Stack,
  Paper,
  Text,
  Group,
  Badge,
  Button,
  ActionIcon,
  Tooltip,
  Divider,
  ScrollArea,
  Avatar,
  Box,
  Textarea,
  Loader,
  Center,
  Chip,
} from "@mantine/core";
import {
  IconStar,
  IconStarFilled,
  IconTrash,
  IconArrowBackUp,
  IconSparkles,
  IconShieldCheck,
  IconPaperclip,
  IconSend,
  IconMailCheck,
  IconArrowLeft,
} from "@tabler/icons-react";
import DOMPurify from "dompurify";
import dayjs from "dayjs";
import { notifications } from "@mantine/notifications";
import { EmailMessage, Attachment, Alias } from "../types";
import { api } from "../api";

interface EmailDetailProps {
  message: EmailMessage | null;
  attachments: Attachment[];
  loading: boolean;
  onToggleStar: (id: string) => void;
  onTrash: (id: string) => void;
  onReply: (message: EmailMessage) => void;
  aliases: Alias[];
  onBack?: () => void;
}

export const EmailDetail: React.FC<EmailDetailProps> = ({
  message,
  attachments,
  loading,
  onToggleStar,
  onTrash,
  onReply,
  aliases,
  onBack,
}) => {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const [quickReplyText, setQuickReplyText] = useState("");
  const [sendingQuickReply, setSendingQuickReply] = useState(false);

  // Reset AI states when selected message changes
  useEffect(() => {
    setAiSummary(null);
    setQuickReplies([]);
    setQuickReplyText("");
  }, [message?.id]);

  if (loading) {
    return (
      <Center style={{ height: "100%" }}>
        <Loader color="teal" type="dots" />
      </Center>
    );
  }

  if (!message) {
    return (
      <Center style={{ height: "100%" }}>
        <Stack align="center" gap="xs">
          <IconMailCheck size={48} stroke={1.2} color="#adb5bd" />
          <Text fw={600} size="md" c="dimmed">
            Select an email to read
          </Text>
          <Text size="xs" c="dimmed">
            All custom aliases receive emails in realtime
          </Text>
        </Stack>
      </Center>
    );
  }

  const handleGetSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.summarize(message.subject, message.text_body || message.snippet || "");
      setAiSummary(res.summary);
    } catch (err: any) {
      notifications.show({ title: "AI Error", message: err.message, color: "red" });
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleGetQuickReplies = async () => {
    setLoadingReplies(true);
    try {
      const res = await api.getQuickReplies(message.subject, message.text_body || message.snippet || "");
      setQuickReplies(res.replies);
    } catch (err: any) {
      notifications.show({ title: "AI Error", message: err.message, color: "red" });
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleSendQuickReply = async () => {
    if (!quickReplyText.trim()) return;
    setSendingQuickReply(true);

    try {
      // Find matching alias or default to user address
      const senderAddress = message.to_addr.includes("@") ? message.to_addr : aliases[0]?.address || "admin@logixsoft.in";

      await api.sendEmail({
        fromAddress: senderAddress,
        to: message.from_addr,
        subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
        html: `<p>${quickReplyText.replace(/\n/g, "<br/>")}</p>`,
        text: quickReplyText,
        inReplyTo: message.in_reply_to || message.id,
      });

      notifications.show({
        title: "Reply Sent",
        message: "Quick reply dispatched via Cloudflare edge",
        color: "teal",
      });

      setQuickReplyText("");
    } catch (err: any) {
      notifications.show({ title: "Reply Failed", message: err.message, color: "red" });
    } finally {
      setSendingQuickReply(false);
    }
  };

  // Sanitize HTML body or fallback to text
  const cleanHtml = message.html_body
    ? DOMPurify.sanitize(message.html_body, {
        USE_PROFILES: { html: true },
      })
    : null;

  const dateStr = dayjs(message.created_at * 1000).format("MMMM D, YYYY [at] h:mm A");

  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
      {/* Top Header Actions */}
      <Box p={{ base: "xs", sm: "md" }} style={{ borderBottom: "1px solid #e9ecef" }}>
        {onBack && (
          <Button
            variant="subtle"
            size="xs"
            color="teal"
            leftSection={<IconArrowLeft size={16} />}
            onClick={onBack}
            mb="xs"
            p={0}
          >
            Back to inbox
          </Button>
        )}
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
          <Group gap="xs" style={{ flex: 1, minWidth: 200 }}>
            <Text fw={700} size="md" style={{ lineHeight: 1.3, wordBreak: "break-word" }}>
              {message.subject || "(no subject)"}
            </Text>
            <Badge size="xs" color="teal" variant="light">
              {message.direction === "inbound" ? "Received" : "Sent"}
            </Badge>
          </Group>

          <Group gap={6}>
            <Tooltip label={message.starred ? "Unstar" : "Star message"}>
              <ActionIcon
                variant="light"
                color={message.starred ? "yellow" : "gray"}
                size="md"
                onClick={() => onToggleStar(message.id)}
              >
                {message.starred ? <IconStarFilled size={16} /> : <IconStar size={16} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Reply">
              <ActionIcon variant="light" color="teal" size="md" onClick={() => onReply(message)}>
                <IconArrowBackUp size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Move to Trash">
              <ActionIcon variant="light" color="red" size="md" onClick={() => onTrash(message.id)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Sender & Recipient Bar */}
        <Group justify="space-between" mt="sm" align="flex-start" wrap="wrap" gap="xs">
          <Group gap="xs" style={{ flex: 1, minWidth: 220 }}>
            <Avatar color="teal" radius="xl" size="sm">
              {message.from_addr.charAt(0).toUpperCase()}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Group gap={6} wrap="wrap">
                <Text size="xs" fw={700} style={{ wordBreak: "break-word" }}>
                  {message.from_addr}
                </Text>
                <Badge size="xs" color="green" leftSection={<IconShieldCheck size={10} />}>
                  Verified
                </Badge>
              </Group>
              <Text size="11px" c="dimmed" style={{ wordBreak: "break-word" }}>
                To: <span style={{ color: "#0ca678", fontWeight: 600 }}>{message.to_addr}</span>
                {message.cc_addr && ` | Cc: ${message.cc_addr}`}
              </Text>
            </div>
          </Group>

          <Text size="11px" c="dimmed">
            {dateStr}
          </Text>
        </Group>
      </Box>

      {/* Main Email Reading Content */}
      <ScrollArea style={{ flex: 1 }} p="md">
        <Stack gap="md">
          {/* AI SUMMARY CARD */}
          <Paper p="sm" radius="md" withBorder bg="teal.0">
            <Group justify="space-between">
              <Group gap="xs">
                <IconSparkles size={18} color="#0ca678" />
                <Text size="sm" fw={700} c="teal.9">
                  Workers AI Assistant
                </Text>
              </Group>
              {!aiSummary && (
                <Button
                  size="compact-xs"
                  color="teal"
                  loading={loadingSummary}
                  onClick={handleGetSummary}
                >
                  Generate 1-Click Summary
                </Button>
              )}
            </Group>

            {aiSummary && (
              <Text size="sm" c="teal.9" mt={6} style={{ lineHeight: 1.5 }}>
                {aiSummary}
              </Text>
            )}
          </Paper>

          {/* EMAIL HTML OR TEXT BODY */}
          <Paper p="md" radius="md" withBorder style={{ minHeight: 180, backgroundColor: "#fafbfc" }}>
            {cleanHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: cleanHtml }}
                style={{
                  fontFamily: "inherit",
                  lineHeight: 1.6,
                  wordBreak: "break-word",
                }}
              />
            ) : (
              <Text style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }} size="sm">
                {message.text_body || message.snippet || "No body content."}
              </Text>
            )}
          </Paper>

          {/* ATTACHMENTS (IF ANY) */}
          {attachments.length > 0 && (
            <div>
              <Text size="xs" fw={700} c="dimmed" mb={6}>
                ATTACHMENTS ({attachments.length})
              </Text>
              <Group gap="xs">
                {attachments.map((att) => (
                  <Badge
                    key={att.id}
                    size="lg"
                    variant="outline"
                    color="teal"
                    leftSection={<IconPaperclip size={14} />}
                    style={{ textTransform: "none", cursor: "pointer" }}
                  >
                    {att.filename} ({Math.round(att.size_bytes / 1024)} KB)
                  </Badge>
                ))}
              </Group>
            </div>
          )}

          {/* QUICK REPLIES BAR */}
          <Box mt="xs">
            <Group justify="space-between" mb={6}>
              <Text size="xs" fw={700} c="dimmed">
                QUICK REPLIES
              </Text>
              {quickReplies.length === 0 && (
                <Button
                  variant="subtle"
                  size="compact-xs"
                  color="teal"
                  loading={loadingReplies}
                  leftSection={<IconSparkles size={14} />}
                  onClick={handleGetQuickReplies}
                >
                  Suggest Quick Replies
                </Button>
              )}
            </Group>

            {quickReplies.length > 0 && (
              <Group gap="xs" mb="sm">
                {quickReplies.map((reply, i) => (
                  <Button
                    key={i}
                    variant="light"
                    color="teal"
                    size="xs"
                    radius="xl"
                    onClick={() => setQuickReplyText(reply)}
                  >
                    "{reply}"
                  </Button>
                ))}
              </Group>
            )}

            {/* QUICK REPLY COMPOSER BOX */}
            <Paper p="sm" radius="md" withBorder>
              <Textarea
                placeholder="Write a quick reply..."
                minRows={2}
                autosize
                value={quickReplyText}
                onChange={(e) => setQuickReplyText(e.currentTarget.value)}
                variant="unstyled"
              />
              <Group justify="flex-end" mt="xs">
                <Button
                  size="xs"
                  color="teal"
                  rightSection={<IconSend size={14} />}
                  loading={sendingQuickReply}
                  onClick={handleSendQuickReply}
                >
                  Send Reply
                </Button>
              </Group>
            </Paper>
          </Box>
        </Stack>
      </ScrollArea>
    </Box>
  );
};
