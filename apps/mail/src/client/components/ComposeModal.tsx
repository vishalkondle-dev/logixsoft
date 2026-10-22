import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Text,
  ActionIcon,
  Tooltip,
  Paper,
  Box,
  Collapse,
  Badge,
  SegmentedControl,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { RichTextEditor, Link } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import {
  IconSend,
  IconSparkles,
  IconAt,
  IconPaperclip,
  IconX,
  IconFile,
  IconWand,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { Alias } from "../types";
import { api } from "../api";

interface ComposeModalProps {
  opened: boolean;
  onClose: () => void;
  aliases: Alias[];
  domain: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultInReplyTo?: string;
}

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  base64: string;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  opened,
  onClose,
  aliases,
  domain,
  defaultTo = "",
  defaultSubject = "",
  defaultInReplyTo,
}) => {
  const [fromAddress, setFromAddress] = useState<string>("");
  const [customLocalPart, setCustomLocalPart] = useState<string>("");
  const [isCustomFrom, setIsCustomFrom] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [sending, setSending] = useState(false);
  const isMobile = useMediaQuery("(max-width: 700px)");

  // Attachments state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);

  // AI Draft generator state
  const [aiOpened, { toggle: toggleAi, open: openAi }] = useDisclosure(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState("professional");
  const [aiLoading, setAiLoading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "<p></p>",
    immediatelyRender: false,
  });

  useEffect(() => {
    if (aliases.length > 0 && !fromAddress) {
      setFromAddress(aliases[0].address);
    }
  }, [aliases]);

  useEffect(() => {
    setTo(defaultTo);
    setSubject(defaultSubject);
    setAttachments([]);
  }, [defaultTo, defaultSubject, opened]);

  // Handle File Attachments
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    let currentTotal = attachments.reduce((sum, a) => sum + a.size, 0);

    for (const file of fileList) {
      if (currentTotal + file.size > 25 * 1024 * 1024) {
        notifications.show({
          title: "Attachment Limit Exceeded",
          message: `Total attachments must be under 25MB. "${file.name}" was skipped.`,
          color: "red",
        });
        continue;
      }

      currentTotal += file.size;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string) || "";
        setAttachments((prev) => [
          ...prev,
          {
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }

    // Reset input so same file can be re-added if desired
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSend = async () => {
    const finalFrom = isCustomFrom
      ? `${customLocalPart.trim().toLowerCase()}@${domain}`
      : fromAddress;

    if (!finalFrom) {
      notifications.show({ title: "Validation Error", message: "Please specify a From address", color: "red" });
      return;
    }
    if (!to.trim()) {
      notifications.show({ title: "Validation Error", message: "Please specify a recipient email", color: "red" });
      return;
    }
    if (!subject.trim()) {
      notifications.show({ title: "Validation Error", message: "Please enter a subject", color: "red" });
      return;
    }

    const html = editor?.getHTML() || "";
    setSending(true);

    try {
      await api.sendEmail({
        fromAddress: finalFrom,
        to: to.trim(),
        cc: cc.trim() ? cc.split(",").map((s) => s.trim()) : undefined,
        subject: subject.trim(),
        html,
        text: editor?.getText() || "",
        inReplyTo: defaultInReplyTo,
        attachments: attachments.map((a) => ({
          name: a.name,
          type: a.type,
          size: a.size,
          base64: a.base64,
        })),
      });

      notifications.show({
        title: "Email Sent Successfully",
        message: `Dispatched as ${finalFrom} via Cloudflare edge`,
        color: "teal",
        icon: <IconSend size={18} />,
      });

      editor?.commands.setContent("<p></p>");
      setAttachments([]);
      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Failed to Send Email",
        message: err.message || "An error occurred",
        color: "red",
      });
    } finally {
      setSending(false);
    }
  };

  // AI Email Writing (Prompt OR Subject)
  const handleAiDraft = async (useSubjectDirectly = false) => {
    const targetPrompt = useSubjectDirectly ? "" : aiPrompt.trim();
    const targetSubject = subject.trim();

    if (!targetPrompt && !targetSubject) {
      notifications.show({
        title: "AI Assistant",
        message: "Please enter a prompt or subject for the AI to write about.",
        color: "blue",
      });
      return;
    }

    setAiLoading(true);
    try {
      const res = await api.draftAI(targetPrompt, aiTone, to, targetSubject);
      if (res.subject && !subject) {
        setSubject(res.subject);
      }
      if (res.body) {
        editor?.commands.setContent(
          res.body
            .split("\n\n")
            .map((p) => `<p>${p}</p>`)
            .join("")
        );
      }
      notifications.show({
        title: "Draft Generated with AI",
        message: `Written using Cloudflare Workers AI (${aiTone} tone)`,
        color: "teal",
      });
    } catch (err: any) {
      notifications.show({
        title: "AI Error",
        message: err.message,
        color: "red",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const aliasOptions = aliases.map((a) => ({
    value: a.address,
    label: `${a.displayName} (${a.address})`,
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen={isMobile}
      title={
        <Group gap="xs">
          <IconAt size={20} color="#0ca678" />
          <Text fw={700} size="md">
            New Message
          </Text>
        </Group>
      }
      size="xl"
      radius="lg"
    >
      <Stack gap="sm">
        {/* Hidden File Input for Attachments */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          multiple
          onChange={handleFileSelect}
        />

        {/* FROM ADDRESS SELECTOR (Select Box) */}
        <Group align="flex-end" gap="xs" wrap="wrap">
          {!isCustomFrom ? (
            <Select
              label="From (Mailbox)"
              description="Select which address to send from"
              data={aliasOptions}
              value={fromAddress}
              onChange={(val) => setFromAddress(val || "")}
              style={{ flex: 1, minWidth: 220 }}
              size="sm"
            />
          ) : (
            <TextInput
              label="Custom Dynamic From"
              description={`Type any address on @${domain}`}
              placeholder="e.g. billing, updates, notifications"
              rightSection={<Text size="xs" c="dimmed">@{domain}</Text>}
              rightSectionWidth={110}
              value={customLocalPart}
              onChange={(e) => setCustomLocalPart(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 220 }}
              size="sm"
            />
          )}

          <Button
            variant="light"
            color="teal"
            size="sm"
            onClick={() => setIsCustomFrom(!isCustomFrom)}
            style={{ marginBottom: 2 }}
          >
            {isCustomFrom ? "Pick Mailbox" : "+ Custom Alias"}
          </Button>
        </Group>

        {/* TO RECIPIENT */}
        <Group align="flex-start" gap="xs">
          <TextInput
            label="To"
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => setTo(e.currentTarget.value)}
            style={{ flex: 1 }}
            size="sm"
          />
          <Button
            variant="subtle"
            size="compact-sm"
            color="gray"
            mt={24}
            onClick={() => setShowCc(!showCc)}
          >
            {showCc ? "Hide CC" : "Cc / Bcc"}
          </Button>
        </Group>

        {showCc && (
          <TextInput
            label="Cc"
            placeholder="colleague@example.com, manager@example.com"
            value={cc}
            onChange={(e) => setCc(e.currentTarget.value)}
            size="sm"
          />
        )}

        {/* SUBJECT WITH 1-CLICK AI WRITING */}
        <TextInput
          label="Subject"
          placeholder="Subject of your email"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          size="sm"
          rightSectionWidth={160}
          rightSection={
            subject.trim() ? (
              <Tooltip label="Generate email body based on this subject">
                <Button
                  size="compact-xs"
                  variant="light"
                  color="teal"
                  loading={aiLoading}
                  leftSection={<IconWand size={12} />}
                  onClick={() => handleAiDraft(true)}
                  style={{ fontSize: 11 }}
                >
                  Write with AI
                </Button>
              </Tooltip>
            ) : null
          }
        />

        {/* AI PROMPT ASSISTANT BAR */}
        <Group justify="space-between" mt={2}>
          <Button
            variant="light"
            color="teal"
            size="compact-sm"
            leftSection={<IconSparkles size={16} />}
            onClick={toggleAi}
          >
            {aiOpened ? "Hide AI Prompt Assistant" : "✨ Write with AI (Prompt or Topic)"}
          </Button>

          <Text size="xs" c="dimmed">
            Powered by Workers AI Llama 3.1
          </Text>
        </Group>

        <Collapse in={aiOpened}>
          <Paper p="sm" withBorder bg="teal.0" radius="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" fw={700} c="teal.9">
                  Describe what you want to write, or pick a tone:
                </Text>
                <SegmentedControl
                  size="xs"
                  color="teal"
                  value={aiTone}
                  onChange={setAiTone}
                  data={[
                    { label: "Professional", value: "professional" },
                    { label: "Friendly", value: "friendly" },
                    { label: "Short & Direct", value: "concise" },
                    { label: "Persuasive", value: "persuasive" },
                  ]}
                />
              </Group>

              <TextInput
                placeholder="e.g. Thank client for partnership and share project update with launch next week"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.currentTarget.value)}
                size="sm"
                onKeyDown={(e) => e.key === "Enter" && handleAiDraft(false)}
              />

              <Group justify="flex-end" gap="xs">
                {subject.trim() && (
                  <Button
                    size="xs"
                    variant="default"
                    loading={aiLoading}
                    onClick={() => handleAiDraft(true)}
                  >
                    Draft from Subject: "{subject.slice(0, 25)}{subject.length > 25 ? '...' : ''}"
                  </Button>
                )}
                <Button
                  size="xs"
                  color="teal"
                  loading={aiLoading}
                  onClick={() => handleAiDraft(false)}
                >
                  Generate Email
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Collapse>

        {/* ATTACHMENTS LIST CHIPS */}
        {attachments.length > 0 && (
          <Paper p="xs" withBorder radius="md" bg="gray.0">
            <Group gap="xs" wrap="wrap">
              <Text size="xs" fw={700} c="dimmed">
                Attachments ({attachments.length}):
              </Text>
              {attachments.map((att) => (
                <Badge
                  key={att.id}
                  variant="outline"
                  color="teal"
                  size="md"
                  leftSection={<IconFile size={12} />}
                  rightSection={
                    <ActionIcon
                      size="xs"
                      color="gray"
                      variant="subtle"
                      onClick={() => handleRemoveAttachment(att.id)}
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  }
                  style={{ textTransform: "none" }}
                >
                  {att.name} ({formatFileSize(att.size)})
                </Badge>
              ))}
            </Group>
          </Paper>
        )}

        {/* MANTINE TIPTAP RICH TEXT EDITOR */}
        <Box mt="xs">
          <Text size="sm" fw={500} mb={4}>
            Message Body
          </Text>
          <RichTextEditor editor={editor} style={{ minHeight: 220 }}>
            <RichTextEditor.Toolbar sticky stickyOffset={60}>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Bold />
                <RichTextEditor.Italic />
                <RichTextEditor.Underline />
                <RichTextEditor.Strikethrough />
                <RichTextEditor.ClearFormatting />
              </RichTextEditor.ControlsGroup>

              <RichTextEditor.ControlsGroup>
                <RichTextEditor.H1 />
                <RichTextEditor.H2 />
                <RichTextEditor.H3 />
              </RichTextEditor.ControlsGroup>

              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Blockquote />
                <RichTextEditor.BulletList />
                <RichTextEditor.OrderedList />
              </RichTextEditor.ControlsGroup>

              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Link />
                <RichTextEditor.Unlink />
              </RichTextEditor.ControlsGroup>

              <RichTextEditor.ControlsGroup>
                <RichTextEditor.AlignLeft />
                <RichTextEditor.AlignCenter />
                <RichTextEditor.AlignRight />
              </RichTextEditor.ControlsGroup>
            </RichTextEditor.Toolbar>

            <RichTextEditor.Content style={{ minHeight: 180 }} />
          </RichTextEditor>
        </Box>

        {/* FOOTER ACTIONS */}
        <Group justify="space-between" mt="md">
          <Group gap="xs">
            <Tooltip label="Attach File (max 25MB total)">
              <Button
                variant="light"
                color="gray"
                size="sm"
                leftSection={<IconPaperclip size={16} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Attach Files {attachments.length > 0 && `(${attachments.length})`}
              </Button>
            </Tooltip>
          </Group>

          <Group gap="xs">
            <Button variant="default" onClick={onClose} disabled={sending}>
              Discard
            </Button>
            <Button
              color="teal"
              leftSection={<IconSend size={18} />}
              onClick={handleSend}
              loading={sending}
            >
              Send Email
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};
