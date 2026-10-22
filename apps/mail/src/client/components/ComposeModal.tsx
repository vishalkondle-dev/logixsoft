import React, { useState, useEffect } from "react";
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
  IconPlus,
  IconAt,
  IconPaperclip,
  IconChevronDown,
  IconChevronUp,
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

  // AI Draft generator state
  const [aiOpened, { toggle: toggleAi }] = useDisclosure(false);
  const [aiPrompt, setAiPrompt] = useState("");
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
  }, [defaultTo, defaultSubject]);

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
      const res = await api.sendEmail({
        fromAddress: finalFrom,
        to: to.trim(),
        cc: cc.trim() ? cc.split(",").map((s) => s.trim()) : undefined,
        subject: subject.trim(),
        html,
        text: editor?.getText() || "",
        inReplyTo: defaultInReplyTo,
      });

      notifications.show({
        title: "Email Sent Successfully",
        message: `Dispatched as ${finalFrom} via Cloudflare edge`,
        color: "teal",
        icon: <IconSend size={18} />,
      });

      editor?.commands.setContent("<p></p>");
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

  const handleAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await api.draftAI(aiPrompt, "professional", to);
      if (res.subject && !subject) {
        setSubject(res.subject);
      }
      editor?.commands.setContent(
        res.body
          .split("\n\n")
          .map((p) => `<p>${p}</p>`)
          .join("")
      );
      notifications.show({
        title: "Draft Generated",
        message: "Workers AI drafted your email!",
        color: "teal",
      });
      toggleAi();
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
        {/* FROM ADDRESS SELECTOR */}
        <Group align="flex-end" gap="xs" wrap="wrap">
          {!isCustomFrom ? (
            <Select
              label="From"
              description="Send from any created alias or dynamic address"
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
              placeholder="e.g. vip-orders, hello, alex"
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
            {isCustomFrom ? "Pick Saved Alias" : "Type New Custom"}
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

        {/* SUBJECT */}
        <TextInput
          label="Subject"
          placeholder="Subject of your email"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          size="sm"
        />

        {/* AI PROMPT COLLAPSIBLE BAR */}
        <Group justify="space-between" mt={4}>
          <Button
            variant="light"
            color="teal"
            size="compact-sm"
            leftSection={<IconSparkles size={16} />}
            onClick={toggleAi}
          >
            {aiOpened ? "Hide AI Draft Assistant" : "✨ Draft with Workers AI"}
          </Button>
        </Group>

        <Collapse in={aiOpened}>
          <Paper p="sm" withBorder bg="teal.0" radius="md">
            <Stack gap="xs">
              <Text size="xs" fw={600} c="teal.9">
                Describe what you want to say, and Workers AI will draft the email:
              </Text>
              <TextInput
                placeholder="e.g. Accept invitation, confirm Monday 10am meeting, ask for zoom link"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.currentTarget.value)}
                size="sm"
              />
              <Group justify="flex-end">
                <Button
                  size="xs"
                  color="teal"
                  loading={aiLoading}
                  onClick={handleAiDraft}
                >
                  Generate Draft
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Collapse>

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
            <Tooltip label="Attach File (25MB limit)">
              <ActionIcon variant="light" color="gray" size="lg">
                <IconPaperclip size={18} />
              </ActionIcon>
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
