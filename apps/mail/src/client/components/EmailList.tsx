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
  Menu,
  ColorSwatch,
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
  IconDotsVertical,
  IconArrowBackUp,
  IconArrowBackUpDouble,
  IconArrowForwardUp,
  IconTrash,
  IconTag,
  IconCheck,
  IconCopy,
  IconLink,
  IconEye,
  IconAlertOctagon,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { EmailMessage, Label } from "../types";
import { PullToRefresh } from "./PullToRefresh";

dayjs.extend(relativeTime);

interface EmailListProps {
  messages: EmailMessage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleStar: (id: string, e?: React.MouseEvent) => void;
  onToggleRead?: (id: string, read: boolean) => void;
  onTrash?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDeletePermanently?: (id: string) => void;
  onMoveToJunk?: (id: string) => void;
  onMarkNotJunk?: (id: string) => void;
  onReply?: (message: EmailMessage) => void;
  onReplyAll?: (message: EmailMessage) => void;
  onForward?: (message: EmailMessage) => void;
  availableLabels?: Label[];
  onToggleLabel?: (messageId: string, labelId: string) => void;
  onOpenLabelsManager?: () => void;
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
  onToggleRead,
  onTrash,
  onRestore,
  onDeletePermanently,
  onMoveToJunk,
  onMarkNotJunk,
  onReply,
  onReplyAll,
  onForward,
  availableLabels = [],
  onToggleLabel,
  onOpenLabelsManager,
  search,
  onSearchChange,
  loading,
  activeFolder,
  onRefresh,
  aiSummary,
}) => {
  const [localSearch, setLocalSearch] = useState(search);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    message: EmailMessage;
  } | null>(null);

  const activeContextMenuMessage = contextMenu
    ? messages.find((m) => m.id === contextMenu.message.id) || contextMenu.message
    : null;

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
                      {activeFolder === "junk" ? "No emails in Junk" : `No emails in ${activeFolder}`}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {activeFolder === "junk"
                        ? "Emails with over 75% risk score will automatically appear here."
                        : "Pull down to check for new emails!"}
                    </Text>
                  </Stack>
                </Center>
              )}

              {messages.map((msg) => {
                const isSelected = selectedId === msg.id;
                const isContextMenuOpen = contextMenu?.message.id === msg.id;
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
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        message: msg,
                      });
                    }}
                    style={{
                      cursor: "pointer",
                      backgroundColor: isContextMenuOpen
                        ? "#f0fdf4"
                        : isSelected
                        ? "#e6fcf5"
                        : isUnread
                        ? "#ffffff"
                        : "#f8fafc",
                      borderColor: isContextMenuOpen
                        ? "#0ca678"
                        : isSelected
                        ? "#20c997"
                        : isUnread
                        ? "#c3fae8"
                        : "#e9ecef",
                      boxShadow: isContextMenuOpen
                        ? "0 0 0 1.5px #0ca678, 0 2px 8px rgba(12, 166, 120, 0.15)"
                        : undefined,
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
                        <Tooltip label={msg.starred ? "Unstar" : "Star"}>
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            color={msg.starred ? "yellow" : "gray"}
                            onClick={(e) => onToggleStar(msg.id, e)}
                          >
                            {msg.starred ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="More actions">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            color="gray"
                            aria-label="More actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setContextMenu({
                                x: Math.max(10, rect.left - 180),
                                y: rect.bottom + 4,
                                message: msg,
                              });
                            }}
                          >
                            <IconDotsVertical size={14} />
                          </ActionIcon>
                        </Tooltip>
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
                      {msg.status === "junk" && (
                        <Badge size="xs" color="orange" variant="light">
                          Junk
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

      {/* RIGHT-CLICK / CONTEXT MENU */}
      <Menu
        opened={!!contextMenu}
        onClose={() => setContextMenu(null)}
        shadow="md"
        radius="md"
        width={230}
        position="bottom-start"
        withinPortal
        zIndex={1000}
      >
        <Menu.Target>
          <div
            style={{
              position: "fixed",
              top: contextMenu?.y ?? 0,
              left: contextMenu?.x ?? 0,
              width: 1,
              height: 1,
              pointerEvents: "none",
              visibility: "hidden",
            }}
          />
        </Menu.Target>
        {activeContextMenuMessage && (
          <Menu.Dropdown>
            <Box px="xs" py={6} style={{ borderBottom: "1px solid #f1f3f5", maxWidth: 220 }}>
              <Text size="xs" fw={700} truncate c="dark.8">
                {activeContextMenuMessage.subject || "(no subject)"}
              </Text>
              <Text size="11px" c="dimmed" truncate>
                {activeContextMenuMessage.direction === "outbound"
                  ? `To: ${activeContextMenuMessage.to_addr}`
                  : activeContextMenuMessage.from_addr}
              </Text>
            </Box>

            <Menu.Label>Navigation</Menu.Label>
            <Menu.Item
              leftSection={<IconEye size={15} color="#0ca678" />}
              onClick={() => {
                onSelect(activeContextMenuMessage.id);
                setContextMenu(null);
              }}
            >
              Open Email
            </Menu.Item>

            <Menu.Divider />
            <Menu.Label>Respond</Menu.Label>
            <Menu.Item
              leftSection={<IconArrowBackUp size={15} color="#228be6" />}
              onClick={() => {
                onReply?.(activeContextMenuMessage);
                setContextMenu(null);
              }}
            >
              Reply
            </Menu.Item>
            <Menu.Item
              leftSection={<IconArrowBackUpDouble size={15} color="#1c7ed6" />}
              onClick={() => {
                onReplyAll?.(activeContextMenuMessage);
                setContextMenu(null);
              }}
            >
              Reply All
            </Menu.Item>
            <Menu.Item
              leftSection={<IconArrowForwardUp size={15} color="#4c6ef5" />}
              onClick={() => {
                onForward?.(activeContextMenuMessage);
                setContextMenu(null);
              }}
            >
              Forward
            </Menu.Item>

            <Menu.Divider />
            <Menu.Label>Status & Labels</Menu.Label>
            <Menu.Item
              leftSection={
                activeContextMenuMessage.read ? (
                  <IconMail size={15} color="#0ca678" />
                ) : (
                  <IconMailOpened size={15} color="#0ca678" />
                )
              }
              onClick={() => {
                onToggleRead?.(activeContextMenuMessage.id, !activeContextMenuMessage.read);
                setContextMenu(null);
              }}
            >
              {activeContextMenuMessage.read ? "Mark as Unread" : "Mark as Read"}
            </Menu.Item>

            <Menu.Item
              leftSection={
                activeContextMenuMessage.starred ? (
                  <IconStarFilled size={15} color="#fab005" />
                ) : (
                  <IconStar size={15} color="#fab005" />
                )
              }
              onClick={() => {
                onToggleStar(activeContextMenuMessage.id);
                setContextMenu(null);
              }}
            >
              {activeContextMenuMessage.starred ? "Remove Star" : "Add Star"}
            </Menu.Item>

            {/* LABELS SUBMENU */}
            {availableLabels && availableLabels.length > 0 && (
              <Menu.Sub>
                <Menu.Sub.Target>
                  <Menu.Item leftSection={<IconTag size={15} color="#7950f2" />}>
                    Labels
                  </Menu.Item>
                </Menu.Sub.Target>
                <Menu.Sub.Dropdown>
                  <Menu.Label>Assign Labels</Menu.Label>
                  {availableLabels.map((lbl) => {
                    const isTagged = activeContextMenuMessage.labels?.some((l) => l.id === lbl.id);
                    return (
                      <Menu.Item
                        key={lbl.id}
                        leftSection={<ColorSwatch color={lbl.color} size={14} />}
                        rightSection={isTagged ? <IconCheck size={14} color="#0ca678" /> : null}
                        closeMenuOnClick={false}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLabel?.(activeContextMenuMessage.id, lbl.id);
                        }}
                      >
                        {lbl.name}
                      </Menu.Item>
                    );
                  })}
                  {onOpenLabelsManager && (
                    <>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconTag size={13} />}
                        onClick={() => {
                          onOpenLabelsManager();
                          setContextMenu(null);
                        }}
                      >
                        Manage Labels...
                      </Menu.Item>
                    </>
                  )}
                </Menu.Sub.Dropdown>
              </Menu.Sub>
            )}

            <Menu.Divider />
            <Menu.Label>Share & Copy</Menu.Label>
            <Menu.Item
              leftSection={<IconCopy size={15} color="#868e96" />}
              onClick={() => {
                const addr =
                  activeContextMenuMessage.direction === "outbound"
                    ? activeContextMenuMessage.to_addr
                    : activeContextMenuMessage.from_addr;
                navigator.clipboard.writeText(addr);
                notifications.show({
                  title: "Address Copied",
                  message: `"${addr}" copied to clipboard`,
                  color: "teal",
                });
                setContextMenu(null);
              }}
            >
              Copy Address
            </Menu.Item>
            <Menu.Item
              leftSection={<IconCopy size={15} color="#868e96" />}
              onClick={() => {
                navigator.clipboard.writeText(activeContextMenuMessage.subject || "");
                notifications.show({
                  title: "Subject Copied",
                  message: "Subject copied to clipboard",
                  color: "teal",
                });
                setContextMenu(null);
              }}
            >
              Copy Subject
            </Menu.Item>
            <Menu.Item
              leftSection={<IconLink size={15} color="#868e96" />}
              onClick={() => {
                const link = `${window.location.origin}${window.location.pathname}#${activeFolder}/${activeContextMenuMessage.id}`;
                navigator.clipboard.writeText(link);
                notifications.show({
                  title: "Link Copied",
                  message: "Direct link to email copied",
                  color: "teal",
                });
                setContextMenu(null);
              }}
            >
              Copy Deep Link
            </Menu.Item>

            <Menu.Divider />
            {activeFolder === "junk" ? (
              <>
                <Menu.Item
                  leftSection={<IconInbox size={15} color="#0ca678" />}
                  color="teal"
                  onClick={() => {
                    onMarkNotJunk?.(activeContextMenuMessage.id);
                    setContextMenu(null);
                  }}
                >
                  Move to Inbox (Not Junk)
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrash size={15} color="#e03131" />}
                  color="red"
                  onClick={() => {
                    onTrash?.(activeContextMenuMessage.id);
                    setContextMenu(null);
                  }}
                >
                  Move to Trash
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrash size={15} color="#e03131" />}
                  color="red"
                  onClick={() => {
                    onDeletePermanently?.(activeContextMenuMessage.id);
                    setContextMenu(null);
                  }}
                >
                  Delete Permanently
                </Menu.Item>
              </>
            ) : activeFolder === "trash" ? (
              <>
                <Menu.Item
                  leftSection={<IconArrowBackUp size={15} color="#0ca678" />}
                  color="teal"
                  onClick={() => {
                    onRestore?.(activeContextMenuMessage.id);
                    setContextMenu(null);
                  }}
                >
                  Restore to Inbox
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrash size={15} color="#e03131" />}
                  color="red"
                  onClick={() => {
                    onDeletePermanently?.(activeContextMenuMessage.id);
                    setContextMenu(null);
                  }}
                >
                  Delete Permanently
                </Menu.Item>
              </>
            ) : (
              <>
                <Menu.Item
                  leftSection={<IconAlertOctagon size={15} color="#fd7e14" />}
                  color="orange"
                  onClick={() => {
                    onMoveToJunk?.(activeContextMenuMessage.id);
                    setContextMenu(null);
                  }}
                >
                  Move to Junk
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrash size={15} color="#e03131" />}
                  color="red"
                  onClick={() => {
                    onTrash?.(activeContextMenuMessage.id);
                    setContextMenu(null);
                  }}
                >
                  Move to Trash
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        )}
      </Menu>
    </Box>
  );
};
