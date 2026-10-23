import React, { useState, useEffect, useCallback } from "react";
import { Box } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconMailFilled } from "@tabler/icons-react";
import { Layout } from "./components/Layout";
import { EmailList } from "./components/EmailList";
import { EmailDetail } from "./components/EmailDetail";
import { ComposeModal } from "./components/ComposeModal";
import { AdminConsole } from "./components/AdminConsole";
import { LoginModal } from "./components/LoginModal";
import { UserProfileModal } from "./components/UserProfileModal";
import { LabelsManagerModal } from "./components/LabelsManagerModal";
import { User, Alias, EmailMessage, Attachment, Label } from "./types";
import { api, getStoredUser, clearSession, connectRealtime } from "./api";
import { playNotificationSound, isSoundEnabled, setSoundEnabled } from "./utils/sound";

interface HashRoute {
  view: "mailbox" | "admin";
  folder: string;
  alias: string;
  selectedId: string | null;
  adminTab: string;
}

function parseHash(hashStr: string): HashRoute {
  const raw = (hashStr || "").replace(/^#\/?/, "");
  if (!raw) {
    return { view: "mailbox", folder: "inbox", alias: "all", selectedId: null, adminTab: "users" };
  }

  const parts = raw.split("/").map(decodeURIComponent);
  const main = parts[0];

  if (main === "admin") {
    return {
      view: "admin",
      folder: "inbox",
      alias: "all",
      selectedId: null,
      adminTab: parts[1] || "users",
    };
  }

  if (main === "alias") {
    return {
      view: "mailbox",
      folder: "inbox",
      alias: parts[1] || "all",
      selectedId: parts[2] || null,
      adminTab: "users",
    };
  }

  if (main === "label") {
    return {
      view: "mailbox",
      folder: `label:${parts[1] || ""}`,
      alias: "all",
      selectedId: parts[2] || null,
      adminTab: "users",
    };
  }

  if (["inbox", "sent", "starred", "trash"].includes(main) || main.startsWith("label:")) {
    return {
      view: "mailbox",
      folder: main,
      alias: "all",
      selectedId: parts[1] || null,
      adminTab: "users",
    };
  }

  return { view: "mailbox", folder: "inbox", alias: "all", selectedId: null, adminTab: "users" };
}

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [domain, setDomain] = useState("logixsoft.in");

  const isMobile = useMediaQuery("(max-width: 850px)");

  // Initial Route parsed from window.location.hash
  const initialRoute = parseHash(typeof window !== "undefined" ? window.location.hash : "");

  // Mail & Route state
  const [currentView, setCurrentView] = useState<"mailbox" | "admin">(initialRoute.view);
  const [activeFolder, setActiveFolder] = useState<string>(initialRoute.folder);
  const [activeAlias, setActiveAlias] = useState<string>(initialRoute.alias);
  const [selectedId, setSelectedId] = useState<string | null>(initialRoute.selectedId);
  const [adminTab, setAdminTab] = useState<string>(initialRoute.adminTab);
  const [search, setSearch] = useState<string>("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<Attachment[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Modals state
  const [composeOpened, setComposeOpened] = useState<boolean>(false);
  const [replyToMessage, setReplyToMessage] = useState<EmailMessage | null>(null);
  const [replyTone, setReplyTone] = useState<string | undefined>(undefined);
  const [labelsManagerOpened, setLabelsManagerOpened] = useState<boolean>(false);
  const [profileOpened, setProfileOpened] = useState<boolean>(false);

  // Sound Notifications state
  const [soundActive, setSoundActive] = useState<boolean>(isSoundEnabled(user?.sound_enabled));

  // Realtime Status
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "disconnected">("disconnected");

  // Hash router sync handler
  const handleHashSync = useCallback(() => {
    const route = parseHash(window.location.hash);
    setCurrentView(route.view);
    setActiveFolder(route.folder);
    setActiveAlias(route.alias);
    setSelectedId(route.selectedId);
    setAdminTab(route.adminTab);
  }, []);

  // Listen for hashchange (Back / Forward / Direct URL edit)
  useEffect(() => {
    window.addEventListener("hashchange", handleHashSync);
    // Ensure initial hash exists
    if (!window.location.hash || window.location.hash === "#") {
      window.location.hash = "#inbox";
    }
    return () => {
      window.removeEventListener("hashchange", handleHashSync);
    };
  }, [handleHashSync]);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K focuses AI Search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.getElementById("inpage-ai-search-input") as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Navigation action helpers (update window.location.hash directly)
  const navigateTo = (newHash: string) => {
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  };

  const handleSelectFolder = (folder: string) => {
    if (folder.startsWith("label:")) {
      const lblId = folder.replace("label:", "");
      navigateTo(`#label/${encodeURIComponent(lblId)}`);
    } else {
      navigateTo(`#${folder}`);
    }
  };

  const handleSelectAlias = (alias: string) => {
    if (alias === "all") {
      navigateTo(`#${activeFolder || "inbox"}`);
    } else {
      navigateTo(`#alias/${encodeURIComponent(alias)}`);
    }
  };

  const handleSelectMessage = (id: string) => {
    if (activeFolder.startsWith("label:")) {
      const lblId = activeFolder.replace("label:", "");
      navigateTo(`#label/${encodeURIComponent(lblId)}/${id}`);
    } else if (activeAlias !== "all") {
      navigateTo(`#alias/${encodeURIComponent(activeAlias)}/${id}`);
    } else {
      navigateTo(`#${activeFolder}/${id}`);
    }
  };

  const handleDeselectMessage = () => {
    if (activeFolder.startsWith("label:")) {
      const lblId = activeFolder.replace("label:", "");
      navigateTo(`#label/${encodeURIComponent(lblId)}`);
    } else if (activeAlias !== "all") {
      navigateTo(`#alias/${encodeURIComponent(activeAlias)}`);
    } else {
      navigateTo(`#${activeFolder}`);
    }
  };

  const handleToggleView = (view: "mailbox" | "admin") => {
    if (view === "admin") {
      navigateTo(`#admin/${adminTab || "users"}`);
    } else {
      navigateTo(`#${activeFolder || "inbox"}`);
    }
  };

  const handleAdminTabChange = (tab: string) => {
    navigateTo(`#admin/${tab}`);
  };

  const handleRefreshLabels = () => {
    api.getLabels()
      .then((res) => setLabels(res.labels || []))
      .catch(() => {});
  };

  const handleLabelsChanged = (messageId: string, updatedLabels: Label[]) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, labels: updatedLabels } : m))
    );
    if (selectedMessage?.id === messageId) {
      setSelectedMessage((prev) => (prev ? { ...prev, labels: updatedLabels } : null));
    }
    handleRefreshLabels();
  };

  const handleToggleSound = () => {
    const next = !soundActive;
    setSoundEnabled(next);
    setSoundActive(next);
    notifications.show({
      title: next ? "Sound Enabled" : "Sound Muted",
      message: next ? "Notification sounds are turned ON" : "Notification sounds are MUTED",
      color: next ? "teal" : "gray",
    });
    if (next) playNotificationSound();
  };

  // Load Aliases, Labels & Initial User Check
  useEffect(() => {
    if (user) {
      api.getMe()
        .then((res) => {
          setUser(res.user);
          setSoundActive(isSoundEnabled(res.user.sound_enabled));
        })
        .catch(() => {
          clearSession();
          setUser(null);
        });

      api.getAliases()
        .then((res) => {
          setAliases(res.aliases);
          setDomain(res.domain);
        })
        .catch(() => {});

      handleRefreshLabels();
    }
  }, [user?.id]);

  // Connect Realtime SSE
  useEffect(() => {
    if (!user) return;

    const disconnect = connectRealtime(
      (email) => {
        // Play notification chime
        playNotificationSound();

        // Realtime notification toast
        notifications.show({
          title: "New Email Received",
          message: `${email.from_addr}: "${email.subject}"`,
          color: "teal",
          icon: <IconMailFilled size={18} />,
        });

        // Add to active messages list immediately
        setMessages((prev) => [email, ...prev.filter((m) => m.id !== email.id)]);
      },
      (status) => {
        setRealtimeStatus(status);
      }
    );

    return () => {
      disconnect();
    };
  }, [user?.id]);

  // Global Keyboard Shortcuts (Cmd+K to focus AI Search, C to Compose)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="AI Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (
        e.key.toLowerCase() === "c" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !["input", "textarea"].includes((document.activeElement?.tagName || "").toLowerCase()) &&
        !document.querySelector(".mantine-Modal-root")
      ) {
        e.preventDefault();
        setReplyToMessage(null);
        setReplyTone(undefined);
        setComposeOpened(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Fetch Messages when folder, alias or search changes
  useEffect(() => {
    if (!user || currentView === "admin") return;

    setLoadingMessages(true);
    api.getMessages(activeFolder, activeAlias, search)
      .then((res) => {
        setMessages(res.messages);
        setAiSummary(res.ai_summary || null);
        if (res.messages.length === 0) {
          setSelectedMessage(null);
        }
      })
      .catch((err) => {
        notifications.show({ title: "Fetch Error", message: err.message, color: "red" });
      })
      .finally(() => {
        setLoadingMessages(false);
      });
  }, [user, activeFolder, activeAlias, search, currentView]);

  // Pull-down and manual refresh handler for messages and aliases
  const handleRefreshMessages = async () => {
    if (!user || currentView === "admin") return;
    try {
      const [msgRes, aliasRes] = await Promise.all([
        api.getMessages(activeFolder, activeAlias, search),
        api.getAliases().catch(() => ({ aliases: [], domain: "" })),
      ]);
      setMessages(msgRes.messages);
      setAiSummary(msgRes.ai_summary || null);
      if (aliasRes.aliases && aliasRes.aliases.length > 0) {
        setAliases(aliasRes.aliases);
      }
    } catch (err: any) {
      notifications.show({ title: "Refresh Error", message: err.message, color: "red" });
    }
  };

  const handleRefreshDetail = async () => {
    if (!selectedId) return;
    try {
      const res = await api.getMessage(selectedId);
      setSelectedMessage(res.message);
      setSelectedAttachments(res.attachments || []);
    } catch (err: any) {
      notifications.show({ title: "Detail Refresh Error", message: err.message, color: "red" });
    }
  };

  // Fetch Message Details when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedMessage(null);
      setSelectedAttachments([]);
      return;
    }

    setLoadingDetail(true);
    api.getMessage(selectedId)
      .then((res) => {
        setSelectedMessage(res.message);
        setSelectedAttachments(res.attachments || []);
      })
      .catch((err) => {
        notifications.show({ title: "Detail Error", message: err.message, color: "red" });
      })
      .finally(() => {
        setLoadingDetail(false);
      });
  }, [selectedId]);

  const handleToggleStar = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;

    const newStar = !msg.starred;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, starred: newStar ? 1 : 0 } : m))
    );
    if (selectedMessage?.id === id) {
      setSelectedMessage((prev) => (prev ? { ...prev, starred: newStar ? 1 : 0 } : null));
    }

    await api.toggleStar(id, newStar).catch(() => {});
  };

  const handleTrashMessage = async (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) {
      handleDeselectMessage();
    }
    await api.trashMessage(id).catch(() => {});
    notifications.show({ title: "Moved to Trash", message: "Message moved to trash", color: "teal" });
  };

  const handleReply = (message: EmailMessage, suggestedTone?: string) => {
    setReplyToMessage(message);
    setReplyTone(suggestedTone);
    setComposeOpened(true);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setMessages([]);
    setSelectedId(null);
    setSelectedMessage(null);
    window.location.hash = "#inbox";
  };

  return (
    <>
      <LoginModal opened={!user} onSuccess={(loggedInUser) => setUser(loggedInUser)} />

      {user && (
        <Layout
          user={user}
          aliases={aliases}
          labels={labels}
          activeFolder={activeFolder}
          onSelectFolder={handleSelectFolder}
          activeAlias={activeAlias}
          onSelectAlias={handleSelectAlias}
          onOpenCompose={() => {
            setReplyToMessage(null);
            setComposeOpened(true);
          }}
          onLogout={handleLogout}
          currentView={currentView}
          onToggleView={handleToggleView}
          realtimeStatus={realtimeStatus}
          soundEnabled={soundActive}
          onToggleSound={handleToggleSound}
          onOpenProfile={() => setProfileOpened(true)}
          onOpenLabelsManager={() => setLabelsManagerOpened(true)}
        >
          {currentView === "admin" ? (
            <AdminConsole activeTab={adminTab} onTabChange={handleAdminTabChange} />
          ) : isMobile ? (
            /* MOBILE SINGLE PANE VIEW */
            <Box style={{ height: "100%", width: "100%" }}>
              {!selectedId ? (
                <EmailList
                  messages={messages}
                  selectedId={selectedId}
                  onSelect={handleSelectMessage}
                  onToggleStar={handleToggleStar}
                  search={search}
                  onSearchChange={setSearch}
                  loading={loadingMessages}
                  activeFolder={activeFolder}
                  onRefresh={handleRefreshMessages}
                  aiSummary={aiSummary}
                />
              ) : (
                <EmailDetail
                  message={selectedMessage}
                  attachments={selectedAttachments}
                  loading={loadingDetail}
                  onToggleStar={(id) => handleToggleStar(id)}
                  onTrash={handleTrashMessage}
                  onReply={handleReply}
                  aliases={aliases}
                  availableLabels={labels}
                  onLabelsChanged={handleLabelsChanged}
                  onBack={handleDeselectMessage}
                  onAttachmentRemoved={(attId) =>
                    setSelectedAttachments((prev) => prev.filter((a) => a.id !== attId))
                  }
                  onRefresh={handleRefreshDetail}
                />
              )}
            </Box>
          ) : (
            /* DESKTOP SPLIT PANE VIEW */
            <Box style={{ height: "100%", display: "flex", width: "100%" }}>
              {/* Left Pane (List) */}
              <Box
                style={{
                  width: 360,
                  minWidth: 320,
                  maxWidth: 420,
                  height: "100%",
                  borderRight: "1px solid #e9ecef",
                  backgroundColor: "#ffffff",
                }}
              >
                <EmailList
                  messages={messages}
                  selectedId={selectedId}
                  onSelect={handleSelectMessage}
                  onToggleStar={handleToggleStar}
                  search={search}
                  onSearchChange={setSearch}
                  loading={loadingMessages}
                  activeFolder={activeFolder}
                  onRefresh={handleRefreshMessages}
                  aiSummary={aiSummary}
                />
              </Box>

              {/* Right Pane (Detail) */}
              <Box style={{ flex: 1, height: "100%", overflow: "hidden" }}>
                <EmailDetail
                  message={selectedMessage}
                  attachments={selectedAttachments}
                  loading={loadingDetail}
                  onToggleStar={(id) => handleToggleStar(id)}
                  onTrash={handleTrashMessage}
                  onReply={handleReply}
                  aliases={aliases}
                  availableLabels={labels}
                  onLabelsChanged={handleLabelsChanged}
                  onAttachmentRemoved={(attId) =>
                    setSelectedAttachments((prev) => prev.filter((a) => a.id !== attId))
                  }
                  onRefresh={handleRefreshDetail}
                />
              </Box>
            </Box>
          )}

          {/* COMPOSE MODAL */}
          <ComposeModal
            opened={composeOpened}
            onClose={() => setComposeOpened(false)}
            aliases={aliases}
            domain={domain}
            defaultTo={replyToMessage ? replyToMessage.from_addr : ""}
            defaultSubject={
              replyToMessage
                ? replyToMessage.subject.startsWith("Re:")
                  ? replyToMessage.subject
                  : `Re: ${replyToMessage.subject}`
                : ""
            }
            defaultInReplyTo={replyToMessage?.id}
            defaultTone={replyTone}
            user={user}
          />

          {/* USER PROFILE MODAL */}
          <UserProfileModal
            opened={profileOpened}
            onClose={() => setProfileOpened(false)}
            user={user}
            onUserUpdated={(updated) => {
              setUser(updated);
              setSoundActive(isSoundEnabled(updated.sound_enabled));
            }}
          />

          {/* LABELS MANAGER MODAL */}
          <LabelsManagerModal
            opened={labelsManagerOpened}
            onClose={() => setLabelsManagerOpened(false)}
            labels={labels}
            onLabelsUpdated={handleRefreshLabels}
          />
        </Layout>
      )}
    </>
  );
};
