import {
  User,
  Alias,
  EmailMessage,
  Attachment,
  Label,
  AiGlobalSearchResult,
  ClefAnalysisResult,
  ClefToneCheckResult,
} from "./types";
import { authClient } from "./auth";

const TOKEN_KEY = "logixmail_token";
const USER_KEY = "logixmail_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as any),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    credentials: "include",
    ...options,
    headers,
  });

  const data = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(data.error || data.message || "Request failed");
  }

  return data as T;
}

export const api = {
  // Auth via Better Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await authClient.signIn.email({
      email: email.toLowerCase().trim(),
      password,
    });

    if (res.error) {
      throw new Error(res.error.message || "Invalid email or password");
    }

    const rawUser = res.data?.user as any;
    const token = (res.data as any)?.token || (res.data as any)?.session?.token || "";

    const user: User = {
      id: rawUser?.id,
      email: rawUser?.email,
      name: rawUser?.name || rawUser?.email?.split("@")[0],
      role: rawUser?.role || "user",
      avatar_url: rawUser?.avatarUrl || rawUser?.image || null,
      status_message: rawUser?.statusMessage || null,
      bio: rawUser?.bio || null,
      signature: rawUser?.signature || null,
      sound_enabled: rawUser?.soundEnabled !== undefined ? rawUser?.soundEnabled : 1,
    };

    setSession(token, user);
    return { token, user };
  },

  async logout(): Promise<void> {
    try {
      await authClient.signOut();
    } catch {}
    clearSession();
  },

  async getMe(): Promise<{ user: User }> {
    return fetchAPI<{ user: User }>("/api/auth/me");
  },

  // User Profile & Settings
  async getUserProfile(): Promise<{ user: User }> {
    return fetchAPI<{ user: User }>("/api/user/profile");
  },

  async updateUserProfile(data: Partial<User>): Promise<{ user: User }> {
    const res = await fetchAPI<{ user: User }>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (res.user) {
      const stored = getStoredUser();
      if (stored) {
        setSession(getStoredToken() || "", { ...stored, ...res.user });
      }
    }
    return res;
  },

  async uploadUserAvatar(data: { imageBase64: string; mimeType?: string }): Promise<{ avatar_url: string }> {
    return fetchAPI<{ avatar_url: string }>("/api/user/avatar", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Labels
  async getLabels(): Promise<{ labels: Label[] }> {
    return fetchAPI<{ labels: Label[] }>("/api/labels");
  },

  async createLabel(name: string, color?: string): Promise<{ label: Label }> {
    return fetchAPI<{ label: Label }>("/api/labels", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    });
  },

  async deleteLabel(id: string): Promise<{ success: boolean; id: string }> {
    return fetchAPI<{ success: boolean; id: string }>(`/api/labels/${id}`, {
      method: "DELETE",
    });
  },

  async setMessageLabels(
    messageId: string,
    payload: { labelId?: string; labelIds?: string[]; action?: string }
  ): Promise<{ success: boolean; labels: Label[] }> {
    return fetchAPI<{ success: boolean; labels: Label[] }>(`/api/messages/${messageId}/labels`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // AI Global Search
  async aiGlobalSearch(query: string, mailbox?: string): Promise<AiGlobalSearchResult> {
    return fetchAPI<AiGlobalSearchResult>("/api/ai/global-search", {
      method: "POST",
      body: JSON.stringify({ query, mailbox }),
    });
  },

  // Aliases
  async getAliases(): Promise<{ aliases: Alias[]; domain: string }> {
    return fetchAPI<{ aliases: Alias[]; domain: string }>("/api/aliases");
  },

  // Messages
  async getMessages(folder: string, alias?: string, search?: string): Promise<{ messages: EmailMessage[]; ai_summary?: string; is_ai_search?: boolean }> {
    const params = new URLSearchParams({ folder });
    if (alias && alias !== "all") params.append("alias", alias);
    if (search) params.append("search", search);
    return fetchAPI<{ messages: EmailMessage[]; ai_summary?: string; is_ai_search?: boolean }>(`/api/messages?${params.toString()}`);
  },

  async getMessage(id: string): Promise<{ message: EmailMessage; attachments: Attachment[] }> {
    return fetchAPI<{ message: EmailMessage; attachments: Attachment[] }>(`/api/messages/${id}`);
  },

  async toggleStar(id: string, starred: boolean): Promise<{ success: boolean; starred: boolean }> {
    return fetchAPI<{ success: boolean; starred: boolean }>(`/api/messages/${id}/star`, {
      method: "POST",
      body: JSON.stringify({ starred }),
    });
  },

  async toggleRead(id: string, read: boolean): Promise<{ success: boolean; read: boolean }> {
    return fetchAPI<{ success: boolean; read: boolean }>(`/api/messages/${id}/read`, {
      method: "POST",
      body: JSON.stringify({ read }),
    });
  },

  async trashMessage(id: string): Promise<{ success: boolean }> {
    return fetchAPI<{ success: boolean }>(`/api/messages/${id}/trash`, {
      method: "POST",
    });
  },

  async restoreMessage(id: string): Promise<{ success: boolean }> {
    return fetchAPI<{ success: boolean }>(`/api/messages/${id}/restore`, {
      method: "POST",
    });
  },

  async deleteMessagePermanently(id: string): Promise<{ success: boolean; id: string }> {
    return fetchAPI<{ success: boolean; id: string }>(`/api/messages/${id}`, {
      method: "DELETE",
    });
  },

  async markJunk(id: string): Promise<{ success: boolean; status: string }> {
    return fetchAPI<{ success: boolean; status: string }>(`/api/messages/${id}/junk`, {
      method: "POST",
    });
  },

  async markNotJunk(id: string): Promise<{ success: boolean; status: string }> {
    return fetchAPI<{ success: boolean; status: string }>(`/api/messages/${id}/not-junk`, {
      method: "POST",
    });
  },

  async sweepJunk(): Promise<{ success: boolean; audited: number; movedToJunk: number }> {
    return fetchAPI<{ success: boolean; audited: number; movedToJunk: number }>(`/api/clef/sweep-junk`, {
      method: "POST",
    });
  },

  async sendEmail(payload: {
    fromAddress: string;
    fromName?: string;
    to: string;
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    text?: string;
    inReplyTo?: string;
    attachments?: Array<{ name: string; type: string; size: number; base64: string }>;
  }): Promise<{ success: boolean; messageId: string }> {
    return fetchAPI<{ success: boolean; messageId: string }>("/api/messages/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getAttachmentPreviewUrl(id: string): string {
    const token = getStoredToken();
    return `/api/attachments/${id}/preview${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  },

  async fetchAttachmentBlob(id: string): Promise<{ blob: Blob; contentType: string }> {
    const token = getStoredToken();
    const res = await fetch(`/api/attachments/${id}/preview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      // Fallback to download endpoint if needed
      const dlRes = await fetch(`/api/attachments/${id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!dlRes.ok) throw new Error("Failed to load attachment");
      const blob = await dlRes.blob();
      return {
        blob,
        contentType: dlRes.headers.get("content-type") || "application/octet-stream",
      };
    }
    const blob = await res.blob();
    return {
      blob,
      contentType: res.headers.get("content-type") || "application/octet-stream",
    };
  },

  async deleteAttachment(id: string): Promise<{ success: boolean; id: string; messageId: string }> {
    return fetchAPI<{ success: boolean; id: string; messageId: string }>(`/api/attachments/${id}`, {
      method: "DELETE",
    });
  },

  async downloadAttachment(id: string, filename: string): Promise<void> {
    const token = getStoredToken();
    const res = await fetch(`/api/attachments/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Failed to download attachment");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // AI Assistant
  async summarize(subject: string, body: string): Promise<{ summary: string }> {
    return fetchAPI<{ summary: string }>("/api/ai/summarize", {
      method: "POST",
      body: JSON.stringify({ subject, body }),
    });
  },

  async getQuickReplies(subject: string, body: string): Promise<{ replies: string[] }> {
    return fetchAPI<{ replies: string[] }>("/api/ai/quick-replies", {
      method: "POST",
      body: JSON.stringify({ subject, body }),
    });
  },

  async draftAI(
    prompt: string,
    tone = "professional",
    recipient = "",
    subject = "",
    from = "",
    senderName = ""
  ): Promise<{ subject: string; body: string }> {
    return fetchAPI<{ subject: string; body: string }>("/api/ai/draft", {
      method: "POST",
      body: JSON.stringify({ prompt, tone, recipient, subject, from, senderName }),
    });
  },

  // Clef-Flash Deep Intelligence
  async clefInspect(payload: {
    messageId?: string;
    from?: string;
    to?: string;
    subject?: string;
    body?: string;
    forceRefresh?: boolean;
  }): Promise<ClefAnalysisResult> {
    return fetchAPI<ClefAnalysisResult>("/api/ai/clef-inspect", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async clefToneCheck(payload: {
    subject: string;
    body: string;
    recipient?: string;
  }): Promise<ClefToneCheckResult> {
    return fetchAPI<ClefToneCheckResult>("/api/ai/clef-tone-check", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Admin Module
  async getAdminUsers(): Promise<{ users: any[] }> {
    return fetchAPI<{ users: any[] }>("/api/admin/users");
  },

  async createAdminUser(data: { email: string; name: string; password: string; role: string }): Promise<any> {
    return fetchAPI("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateAdminUser(id: string, data: any): Promise<any> {
    return fetchAPI(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async getAdminAliases(): Promise<any> {
    return fetchAPI("/api/admin/aliases");
  },

  async createAdminAlias(data: { localPart: string; displayName?: string; userId?: string }): Promise<any> {
    return fetchAPI("/api/admin/aliases", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getAdminStats(): Promise<any> {
    return fetchAPI("/api/admin/stats");
  },
};

// Realtime SSE Manager
export function connectRealtime(onNewEmail: (email: any) => void, onStatusChange: (status: "connected" | "disconnected") => void) {
  const token = getStoredToken();
  const url = token ? `/api/events?token=${token}` : "/api/events";
  const eventSource = new EventSource(url);

  eventSource.onopen = () => {
    onStatusChange("connected");
  };

  eventSource.onerror = () => {
    onStatusChange("disconnected");
  };

  eventSource.addEventListener("new_email", (e: MessageEvent) => {
    try {
      const email = JSON.parse(e.data);
      onNewEmail(email);
    } catch (err) {}
  });

  eventSource.addEventListener("message_sent", (e: MessageEvent) => {
    try {
      const email = JSON.parse(e.data);
      onNewEmail(email);
    } catch (err) {}
  });

  return () => {
    eventSource.close();
  };
}
