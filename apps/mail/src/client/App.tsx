import React, { useState, useEffect } from "react";
import { Box, Group } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconMailFilled, IconSend } from "@tabler/icons-react";
import { Layout } from "./components/Layout";
import { EmailList } from "./components/EmailList";
import { EmailDetail } from "./components/EmailDetail";
import { ComposeModal } from "./components/ComposeModal";
import { AdminConsole } from "./components/AdminConsole";
import { LoginModal } from "./components/LoginModal";
import { User, Alias, EmailMessage, Attachment } from "./types";
import { api, getStoredUser, clearSession, connectRealtime } from "./api";

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [domain, setDomain] = useState("logixsoft.in");

  // Mail navigation
  const [activeFolder, setActiveFolder] = useState<string>("inbox");
  const [activeAlias, setActiveAlias] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Messages state
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<Attachment[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Compose Modal state
  const [composeOpened, setComposeOpened] = useState<boolean>(false);
  const [replyToMessage, setReplyToMessage] = useState<EmailMessage | null>(null);

  // Admin View state
  const [currentView, setCurrentView] = useState<"mailbox" | "admin">("mailbox");

  // Realtime Status
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "disconnected">("disconnected");

  // Load Aliases & Initial User Check
  useEffect(() => {
    if (user) {
      api.getMe()
        .then((res) => setUser(res.user))
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
    }
  }, [user?.id]);

  // Connect Realtime SSE
  useEffect(() => {
    if (!user) return;

    const disconnect = connectRealtime(
      (email) => {
        // Realtime notification
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

  // Fetch Messages when folder, alias or search changes
  useEffect(() => {
    if (!user || currentView === "admin") return;

    setLoadingMessages(true);
    api.getMessages(activeFolder, activeAlias, search)
      .then((res) => {
        setMessages(res.messages);
        if (res.messages.length > 0 && !selectedId) {
          setSelectedId(res.messages[0].id);
        } else if (res.messages.length === 0) {
          setSelectedId(null);
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
      setSelectedId(null);
      setSelectedMessage(null);
    }
    await api.trashMessage(id).catch(() => {});
    notifications.show({ title: "Moved to Trash", message: "Message moved to trash", color: "teal" });
  };

  const handleReply = (message: EmailMessage) => {
    setReplyToMessage(message);
    setComposeOpened(true);
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setMessages([]);
    setSelectedId(null);
    setSelectedMessage(null);
  };

  return (
    <>
      <LoginModal opened={!user} onSuccess={(loggedInUser) => setUser(loggedInUser)} />

      {user && (
        <Layout
          user={user}
          aliases={aliases}
          activeFolder={activeFolder}
          onSelectFolder={(folder) => {
            setActiveFolder(folder);
            setCurrentView("mailbox");
          }}
          activeAlias={activeAlias}
          onSelectAlias={(alias) => {
            setActiveAlias(alias);
            setCurrentView("mailbox");
          }}
          onOpenCompose={() => {
            setReplyToMessage(null);
            setComposeOpened(true);
          }}
          onLogout={handleLogout}
          currentView={currentView}
          onToggleView={setCurrentView}
          realtimeStatus={realtimeStatus}
        >
          {currentView === "admin" ? (
            <AdminConsole />
          ) : (
            <Box style={{ height: "100%", display: "flex" }}>
              {/* Split Pane: Left (Messages List) */}
              <Box
                style={{
                  width: 380,
                  height: "100%",
                  borderRight: "1px solid #e9ecef",
                  backgroundColor: "#ffffff",
                }}
              >
                <EmailList
                  messages={messages}
                  selectedId={selectedId}
                  onSelect={(id) => setSelectedId(id)}
                  onToggleStar={handleToggleStar}
                  search={search}
                  onSearchChange={setSearch}
                  loading={loadingMessages}
                  activeFolder={activeFolder}
                />
              </Box>

              {/* Split Pane: Right (Email Reading Pane) */}
              <Box style={{ flex: 1, height: "100%" }}>
                <EmailDetail
                  message={selectedMessage}
                  attachments={selectedAttachments}
                  loading={loadingDetail}
                  onToggleStar={(id) => handleToggleStar(id)}
                  onTrash={handleTrashMessage}
                  onReply={handleReply}
                  aliases={aliases}
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
          />
        </Layout>
      )}
    </>
  );
};
