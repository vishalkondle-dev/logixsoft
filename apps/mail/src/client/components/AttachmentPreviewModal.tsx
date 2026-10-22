import React, { useState, useEffect } from "react";
import {
  Modal,
  Box,
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  Tooltip,
  Paper,
  Loader,
  Center,
  ScrollArea,
  Code,
  Popover,
  Stack,
} from "@mantine/core";
import {
  IconPhoto,
  IconPdf,
  IconFileText,
  IconFileZip,
  IconCode,
  IconFileSpreadsheet,
  IconMovie,
  IconMusic,
  IconFile,
  IconDownload,
  IconTrash,
  IconZoomIn,
  IconZoomOut,
  IconRotateClockwise,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconAlertCircle,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api } from "../api";

export interface AttachmentPreviewTarget {
  id: string;
  name: string;
  size: number;
  type?: string;
  // If in-memory (e.g. from ComposeModal)
  dataUrl?: string;
  // If stored in database/R2 (e.g. from EmailDetail)
  attachmentId?: string;
}

interface AttachmentPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  target: AttachmentPreviewTarget | null;
  onRemove?: (id: string) => void | Promise<void>;
  canRemove?: boolean;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileCategory(
  filename: string,
  mimeType?: string
): "image" | "pdf" | "text" | "code" | "video" | "audio" | "archive" | "spreadsheet" | "document" | "generic" {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
    return "image";
  }
  if (mime === "application/pdf" || ext === "pdf") {
    return "pdf";
  }
  if (
    ["js", "ts", "jsx", "tsx", "py", "html", "css", "scss", "json", "xml", "sql", "sh", "yml", "yaml", "env"].includes(ext) ||
    mime.includes("json") ||
    mime.includes("javascript")
  ) {
    return "code";
  }
  if (
    mime.startsWith("text/") ||
    ["txt", "md", "log", "csv", "rtf"].includes(ext)
  ) {
    if (ext === "csv") return "spreadsheet";
    return "text";
  }
  if (["xls", "xlsx", "ods"].includes(ext)) {
    return "spreadsheet";
  }
  if (["doc", "docx", "odt"].includes(ext)) {
    return "document";
  }
  if (
    mime.startsWith("video/") ||
    ["mp4", "webm", "mkv", "mov", "avi"].includes(ext)
  ) {
    return "video";
  }
  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)
  ) {
    return "audio";
  }
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) {
    return "archive";
  }

  return "generic";
}

export function getFileIcon(category: string, size = 16) {
  switch (category) {
    case "image":
      return <IconPhoto size={size} color="#2b8a3e" />;
    case "pdf":
      return <IconPdf size={size} color="#e03131" />;
    case "code":
      return <IconCode size={size} color="#1971c2" />;
    case "text":
      return <IconFileText size={size} color="#495057" />;
    case "spreadsheet":
      return <IconFileSpreadsheet size={size} color="#2f9e44" />;
    case "video":
      return <IconMovie size={size} color="#9c36b5" />;
    case "audio":
      return <IconMusic size={size} color="#f59f00" />;
    case "archive":
      return <IconFileZip size={size} color="#d9480f" />;
    default:
      return <IconFile size={size} color="#868e96" />;
  }
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  opened,
  onClose,
  target,
  onRemove,
  canRemove = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [copied, setCopied] = useState(false);
  const [confirmRemoveOpened, setConfirmRemoveOpened] = useState(false);
  const [removing, setRemoving] = useState(false);

  const category = target ? getFileCategory(target.name, target.type) : "generic";

  useEffect(() => {
    if (!opened || !target) {
      setContentUrl(null);
      setTextContent(null);
      setZoom(1);
      setRotation(0);
      setConfirmRemoveOpened(false);
      return;
    }

    setZoom(1);
    setRotation(0);
    setConfirmRemoveOpened(false);

    let active = true;
    let createdBlobUrl: string | null = null;

    if (target.dataUrl) {
      // In-memory dataUrl (from ComposeModal)
      setContentUrl(target.dataUrl);

      if (category === "text" || category === "code" || category === "spreadsheet") {
        try {
          const parts = target.dataUrl.split(",");
          if (parts[1]) {
            const raw = atob(parts[1]);
            // Decode utf-8 safely
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) {
              bytes[i] = raw.charCodeAt(i);
            }
            const decoded = new TextDecoder("utf-8").decode(bytes);
            setTextContent(decoded);
          }
        } catch (e) {
          console.error("Failed to decode text attachment base64:", e);
        }
      }
    } else if (target.attachmentId) {
      // Stored attachment, fetch via API
      setLoading(true);
      api
        .fetchAttachmentBlob(target.attachmentId)
        .then(async ({ blob }) => {
          if (!active) return;
          const url = URL.createObjectURL(blob);
          createdBlobUrl = url;
          setContentUrl(url);

          if (category === "text" || category === "code" || category === "spreadsheet") {
            const text = await blob.text();
            if (active) setTextContent(text);
          }
        })
        .catch((err) => {
          if (!active) return;
          notifications.show({
            title: "Preview Error",
            message: err.message || "Failed to load attachment content",
            color: "red",
          });
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [opened, target?.id, target?.attachmentId, target?.dataUrl]);

  if (!target) return null;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notifications.show({
        title: "Copied",
        message: "File contents copied to clipboard",
        color: "teal",
      });
    } catch {
      notifications.show({
        title: "Copy Failed",
        message: "Clipboard access was denied",
        color: "red",
      });
    }
  };

  const handleDownload = () => {
    if (target.dataUrl) {
      const a = document.createElement("a");
      a.href = target.dataUrl;
      a.download = target.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (target.attachmentId) {
      api.downloadAttachment(target.attachmentId, target.name);
    }
  };

  const handleExecuteRemove = async () => {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove(target.id);
      setConfirmRemoveOpened(false);
      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Remove Failed",
        message: err.message || "Could not remove attachment",
        color: "red",
      });
    } finally {
      setRemoving(false);
    }
  };

  const directPreviewUrl = target.attachmentId
    ? api.getAttachmentPreviewUrl(target.attachmentId)
    : contentUrl;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      padding="md"
      radius="md"
      withCloseButton={false}
      centered
      styles={{
        body: { padding: 0 },
        content: { overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" },
      }}
    >
      {/* HEADER BAR */}
      <Box
        p="sm"
        style={{
          borderBottom: "1px solid #e9ecef",
          backgroundColor: "#f8f9fa",
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" style={{ minWidth: 0, flex: 1 }}>
            <Box style={{ flexShrink: 0 }}>{getFileIcon(category, 22)}</Box>
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Text fw={700} size="sm" lineClamp={1} title={target.name}>
                {target.name}
              </Text>
              <Group gap={6} mt={2}>
                <Badge size="xs" variant="light" color="teal">
                  {formatBytes(target.size)}
                </Badge>
                <Badge size="xs" variant="outline" color="gray">
                  {category.toUpperCase()}
                </Badge>
              </Group>
            </Box>
          </Group>

          {/* Quick Actions in Header */}
          <Group gap={6} wrap="nowrap">
            {category === "image" && contentUrl && (
              <Group gap={4}>
                <Tooltip label="Zoom In">
                  <ActionIcon size="sm" variant="default" onClick={handleZoomIn}>
                    <IconZoomIn size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Zoom Out">
                  <ActionIcon size="sm" variant="default" onClick={handleZoomOut}>
                    <IconZoomOut size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Rotate 90°">
                  <ActionIcon size="sm" variant="default" onClick={handleRotate}>
                    <IconRotateClockwise size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Reset Zoom">
                  <ActionIcon size="sm" variant="default" onClick={handleResetZoom}>
                    <Text size="10px" fw={700}>
                      1:1
                    </Text>
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}

            {(category === "text" || category === "code" || category === "spreadsheet") && textContent && (
              <Tooltip label={copied ? "Copied!" : "Copy Content"}>
                <ActionIcon
                  size="sm"
                  variant="default"
                  color={copied ? "teal" : "gray"}
                  onClick={handleCopyText}
                >
                  {copied ? <IconCheck size={14} color="#0ca678" /> : <IconCopy size={14} />}
                </ActionIcon>
              </Tooltip>
            )}

            {directPreviewUrl && (
              <Tooltip label="Open in New Tab">
                <ActionIcon
                  size="sm"
                  variant="default"
                  component="a"
                  href={directPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconExternalLink size={14} />
                </ActionIcon>
              </Tooltip>
            )}

            <Button
              size="compact-xs"
              variant="default"
              onClick={onClose}
              style={{ fontWeight: 600 }}
            >
              Close
            </Button>
          </Group>
        </Group>
      </Box>

      {/* MODAL MAIN CONTENT AREA */}
      <Box
        style={{
          flex: 1,
          minHeight: 320,
          maxHeight: "calc(85vh - 120px)",
          overflow: "auto",
          backgroundColor: category === "image" ? "#1a1b1e" : "#ffffff",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {loading ? (
          <Center style={{ height: 350, width: "100%" }}>
            <Stack align="center" gap="xs">
              <Loader color="teal" size="md" />
              <Text size="xs" c="dimmed">
                Loading attachment preview...
              </Text>
            </Stack>
          </Center>
        ) : category === "image" && contentUrl ? (
          <Center
            style={{
              minHeight: 360,
              padding: 16,
              overflow: "auto",
              width: "100%",
            }}
          >
            <img
              src={contentUrl}
              alt={target.name}
              style={{
                maxWidth: "100%",
                maxHeight: "65vh",
                objectFit: "contain",
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: "transform 0.15s ease-out",
                borderRadius: 4,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            />
          </Center>
        ) : category === "pdf" && contentUrl ? (
          <Box style={{ height: "65vh", width: "100%" }}>
            <iframe
              src={contentUrl}
              title={target.name}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
            />
          </Box>
        ) : (category === "text" || category === "code" || category === "spreadsheet") && textContent !== null ? (
          <ScrollArea style={{ height: "65vh" }} p="md">
            <Paper p="sm" withBorder bg="gray.0" radius="sm">
              <Code
                block
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "monospace",
                  fontSize: 12,
                  lineHeight: 1.5,
                  backgroundColor: "transparent",
                }}
              >
                {textContent || "(Empty file)"}
              </Code>
            </Paper>
          </ScrollArea>
        ) : category === "video" && contentUrl ? (
          <Center style={{ minHeight: 360, padding: 16, width: "100%" }}>
            <video
              controls
              src={contentUrl}
              style={{
                maxWidth: "100%",
                maxHeight: "65vh",
                borderRadius: 8,
                backgroundColor: "#000",
              }}
            >
              Your browser does not support HTML5 video preview.
            </video>
          </Center>
        ) : category === "audio" && contentUrl ? (
          <Center style={{ minHeight: 250, padding: 24, width: "100%" }}>
            <Stack align="center" gap="md">
              <IconMusic size={48} color="#0ca678" />
              <Text fw={600} size="sm">
                {target.name}
              </Text>
              <audio controls src={contentUrl} style={{ width: "100%", maxWidth: 400 }}>
                Your browser does not support HTML5 audio playback.
              </audio>
            </Stack>
          </Center>
        ) : (
          /* GENERIC / BINARY FALLBACK VIEW */
          <Center style={{ height: 360, width: "100%" }}>
            <Stack align="center" gap="sm" p="xl" style={{ maxWidth: 400, textAlign: "center" }}>
              {getFileIcon(category, 54)}
              <Text fw={700} size="md">
                {target.name}
              </Text>
              <Text size="xs" c="dimmed">
                In-browser preview is not available for this format ({category.toUpperCase()}). You can download this file to view it with your local software.
              </Text>
              <Button
                color="teal"
                variant="light"
                leftSection={<IconDownload size={16} />}
                onClick={handleDownload}
                mt="xs"
              >
                Download File ({formatBytes(target.size)})
              </Button>
            </Stack>
          </Center>
        )}
      </Box>

      {/* FOOTER ACTIONS BAR */}
      <Box
        p="sm"
        style={{
          borderTop: "1px solid #e9ecef",
          backgroundColor: "#f8f9fa",
        }}
      >
        <Group justify="space-between">
          {/* REMOVE BUTTON & CONFIRMATION */}
          {canRemove && onRemove ? (
            <Popover
              opened={confirmRemoveOpened}
              onChange={setConfirmRemoveOpened}
              position="top-start"
              withArrow
              shadow="md"
            >
              <Popover.Target>
                <Button
                  color="red"
                  variant="subtle"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => setConfirmRemoveOpened((o) => !o)}
                  loading={removing}
                >
                  Remove Attachment
                </Button>
              </Popover.Target>
              <Popover.Dropdown p="sm">
                <Stack gap="xs" style={{ maxWidth: 240 }}>
                  <Group gap={6} wrap="nowrap">
                    <IconAlertCircle size={16} color="#e03131" />
                    <Text size="xs" fw={700}>
                      Remove this attachment?
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Are you sure you want to remove "{target.name}"?
                  </Text>
                  <Group justify="flex-end" gap="xs" mt={4}>
                    <Button
                      size="compact-xs"
                      variant="default"
                      onClick={() => setConfirmRemoveOpened(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="compact-xs"
                      color="red"
                      onClick={handleExecuteRemove}
                      loading={removing}
                    >
                      Confirm Remove
                    </Button>
                  </Group>
                </Stack>
              </Popover.Dropdown>
            </Popover>
          ) : (
            <div />
          )}

          {/* DOWNLOAD & CLOSE BUTTONS */}
          <Group gap="xs">
            <Button
              size="xs"
              color="teal"
              leftSection={<IconDownload size={14} />}
              onClick={handleDownload}
            >
              Download ({formatBytes(target.size)})
            </Button>
            <Button size="xs" variant="default" onClick={onClose}>
              Done
            </Button>
          </Group>
        </Group>
      </Box>
    </Modal>
  );
};
