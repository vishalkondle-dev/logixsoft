import { User, Alias, EmailMessage, Attachment } from "./types";

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
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await fetchAPI<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setSession(data.token, data.user);
    return data;
  },

  async getMe(): Promise<{ user: User }> {
    return fetchAPI<{ user: User }>("/api/auth/me");
  },

  // Aliases
  async getAliases(): Promise<{ aliases: Alias[]; domain: string }> {
    return fetchAPI<{ aliases: Alias[]; domain: string }>("/api/aliases");
  },

  // Messages
  async getMessages(folder: string, alias?: string, search?: string): Promise<{ messages: EmailMessage[] }> {
    const params = new URLSearchParams({ folder });
    if (alias && alias !== "all") params.append("alias", alias);
    if (search) params.append("search", search);
    return fetchAPI<{ messages: EmailMessage[] }>(`/api/messages?${params.toString()}`);
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

  async trashMessage(id: string): Promise<{ success: boolean }> {
    return fetchAPI<{ success: boolean }>(`/api/messages/${id}/trash`, {
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
  }): Promise<{ success: boolean; messageId: string }> {
    return fetchAPI<{ success: boolean; messageId: string }>("/api/messages/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });
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

  async draftAI(prompt: string, tone = "professional", recipient = ""): Promise<{ subject: string; body: string }> {
    return fetchAPI<{ subject: string; body: string }>("/api/ai/draft", {
      method: "POST",
      body: JSON.stringify({ prompt, tone, recipient }),
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
