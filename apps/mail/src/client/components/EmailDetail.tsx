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
  Menu,
  ColorSwatch,
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
  IconDownload,
  IconEye,
  IconRefresh,
  IconTag,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import DOMPurify from "dompurify";
import dayjs from "dayjs";
import { notifications } from "@mantine/notifications";
import { EmailMessage, Attachment, Alias, Label } from "../types";
import { api } from "../api";
import { playPopSound, playSentSound } from "../utils/sound";
import {
  AttachmentPreviewModal,
  AttachmentPreviewTarget,
  getFileIcon,
  getFileCategory,
  formatBytes,
} from "./AttachmentPreviewModal";
import { PullToRefresh } from "./PullToRefresh";
import { ClefInspectionCard } from "./ClefInspectionCard";

interface EmailDetailProps {
  message: EmailMessage | null;
  attachments: Attachment[];
  loading: boolean;
  onToggleStar: (id: string) => void;
  onTrash: (id: string) => void;
  onReply: (message: EmailMessage, suggestedTone?: string, advice?: string) => void;
  aliases: Alias[];
  availableLabels?: Label[];
  onLabelsChanged?: (messageId: string, updatedLabels: Label[]) => void;
  onBack?: () => void;
  onAttachmentRemoved?: (attachmentId: string) => void;
  onRefresh?: () => Promise<void> | void;
}

export const EmailDetail: React.FC<EmailDetailProps> = ({
  message,
  attachments,
  loading,
  onToggleStar,
  onTrash,
  onReply,
  aliases,
  availableLabels = [],
  onLabelsChanged,
  onBack,
  onAttachmentRemoved,
  onRefresh,
}) => {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const [quickReplyText, setQuickReplyText] = useState("");
  const [sendingQuickReply, setSendingQuickReply] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<AttachmentPreviewTarget | null>(null);
  const [previewOpened, setPreviewOpened] = useState(false);

  const handleOpenPreview = (att: Attachment) => {
    const size = (att as any).size || att.size_bytes || 0;
    setPreviewTarget({
      id: att.id,
      name: att.filename,
      size,
      type: att.mime_type || att.content_type,
      attachmentId: att.id,
    });
    setPreviewOpened(true);
  };

  const handleRemoveAttachment = async (id: string) => {
    setDeletingAttachmentId(id);
    try {
      await api.deleteAttachment(id);
      notifications.show({
        title: "Attachment Removed",
        message: "The attachment has been permanently removed from this message",
        color: "teal",
      });
      if (previewTarget?.id === id) {
        setPreviewOpened(false);
        setPreviewTarget(null);
      }
      if (onAttachmentRemoved) {
        onAttachmentRemoved(id);
      }
    } catch (err: any) {
      notifications.show({
        title: "Removal Failed",
        message: err.message || "Failed to remove attachment",
        color: "red",
      });
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const handleDownload = async (att: Attachment) => {
    setDownloadingId(att.id);
    try {
      await api.downloadAttachment(att.id, att.filename);
      notifications.show({
        title: "Download Started",
        message: `Downloading ${att.filename}`,
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({
        title: "Download Failed",
        message: err.message || "Failed to download attachment",
        color: "red",
      });
    } finally {
      setDownloadingId(null);
    }
  };

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

      playSentSound();
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

  const handleToggleLabel = async (labelId: string) => {
    if (!message) return;
    try {
      const res = await api.setMessageLabels(message.id, { labelId, action: "toggle" });
      playPopSound();
      if (onLabelsChanged) {
        onLabelsChanged(message.id, res.labels);
      }
    } catch (err: any) {
      notifications.show({ title: "Label Error", message: err.message, color: "red" });
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

            {/* ASSIGN LABELS MENU */}
            {availableLabels.length > 0 && (
              <Menu shadow="md" width={200} position="bottom-end">
                <Menu.Target>
                  <Tooltip label="Assign Labels">
                    <ActionIcon variant="light" color="blue" size="md">
                      <IconTag size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Assign Labels</Menu.Label>
                  {availableLabels.map((lbl) => {
                    const isTagged = message.labels?.some((l) => l.id === lbl.id);
                    return (
                      <Menu.Item
                        key={lbl.id}
                        leftSection={<ColorSwatch color={lbl.color} size={14} />}
                        rightSection={isTagged ? <IconCheck size={14} color="#0ca678" /> : null}
                        onClick={() => handleToggleLabel(lbl.id)}
                      >
                        {lbl.name}
                      </Menu.Item>
                    );
                  })}
                </Menu.Dropdown>
              </Menu>
            )}

            <Tooltip label="Move to Trash">
              <ActionIcon variant="light" color="red" size="md" onClick={() => onTrash(message.id)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>

            {onRefresh && (
              <Tooltip label="Refresh email (or pull down to refresh)">
                <ActionIcon
                  variant="light"
                  color="teal"
                  size="md"
                  onClick={() => onRefresh()}
                  loading={loading}
                  aria-label="Refresh email"
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
            )}
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

        {/* ACTIVE LABELS DISPLAY */}
        {message.labels && message.labels.length > 0 && (
          <Group gap={6} mt="xs" wrap="wrap">
            {message.labels.map((lbl) => (
              <Badge
                key={lbl.id}
                size="sm"
                variant="filled"
                style={{ backgroundColor: lbl.color, color: "#fff" }}
                rightSection={
                  <ActionIcon
                    size="xs"
                    color="transparent"
                    variant="transparent"
                    onClick={() => handleToggleLabel(lbl.id)}
                    title="Remove label"
                  >
                    <IconX size={10} color="#fff" />
                  </ActionIcon>
                }
              >
                {lbl.name}
              </Badge>
            ))}
          </Group>
        )}
      </Box>

      {/* Main Email Reading Content with Pull to Refresh */}
      <Box style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <PullToRefresh onRefresh={onRefresh || (() => {})}>
          <ScrollArea
            style={{ height: "100%" }}
            px="md"
            pt="md"
            viewportProps={{
              style: {
                overscrollBehaviorY: "contain",
                WebkitOverflowScrolling: "touch",
              },
            }}
          >
            <Stack
              gap="md"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 60px)",
              }}
            >
          {/* CLEF-FLASH DEEP INTELLIGENCE (Tone, Spam, Validity, Urgency) */}
          <ClefInspectionCard
            message={message}
            onApplyStrategy={(suggestedTone, advice) => onReply(message, suggestedTone, advice)}
          />

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
            <Paper p="sm" withBorder radius="md" bg="gray.0">
              <Group justify="space-between" mb={8}>
                <Group gap={6}>
                  <IconPaperclip size={16} color="#0ca678" />
                  <Text size="xs" fw={700} c="teal.9">
                    ATTACHMENTS ({attachments.length})
                  </Text>
                </Group>
                <Text size="11px" c="dimmed">
                  Total: {formatBytes(attachments.reduce((sum, a) => sum + ((a as any).size || a.size_bytes || 0), 0))}
                </Text>
              </Group>

              <Group gap="xs" wrap="wrap">
                {attachments.map((att) => {
                  const fileSize = (att as any).size || att.size_bytes || 0;
                  const category = getFileCategory(att.filename, att.mime_type || att.content_type);
                  const isDeleting = deletingAttachmentId === att.id;

                  return (
                    <Paper
                      key={att.id}
                      withBorder
                      radius="md"
                      p="xs"
                      bg="white"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        border: "1px solid #ced4da",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <Box style={{ display: "flex", alignItems: "center" }}>
                        {getFileIcon(category, 20)}
                      </Box>

                      <Box
                        style={{ cursor: "pointer", maxWidth: 190 }}
                        onClick={() => handleOpenPreview(att)}
                        title={`Click to preview "${att.filename}"`}
                      >
                        <Text size="xs" fw={600} truncate>
                          {att.filename}
                        </Text>
                        <Text size="11px" c="dimmed">
                          {formatBytes(fileSize)}
                        </Text>
                      </Box>

                      <Group gap={4} ml="xs">
                        <Tooltip label="Preview attachment">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="teal"
                            aria-label="Preview attachment"
                            onClick={() => handleOpenPreview(att)}
                          >
                            <IconEye size={14} />
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Download file">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="gray"
                            aria-label="Download file"
                            loading={downloadingId === att.id}
                            onClick={() => handleDownload(att)}
                          >
                            <IconDownload size={14} />
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Remove attachment from message">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            aria-label="Remove attachment from message"
                            loading={isDeleting}
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to remove "${att.filename}" from this email?`)) {
                                handleRemoveAttachment(att.id);
                              }
                            }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Paper>
                  );
                })}
              </Group>
            </Paper>
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
    </PullToRefresh>
  </Box>

      {/* ATTACHMENT PREVIEW MODAL */}
      <AttachmentPreviewModal
        opened={previewOpened}
        onClose={() => setPreviewOpened(false)}
        target={previewTarget}
        onRemove={handleRemoveAttachment}
        canRemove={true}
      />
    </Box>
  );
};
