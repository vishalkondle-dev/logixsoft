/**
 * Client for IPL Auction Simulator Authentication & Better Auth
 */

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: "admin" | "user";
  isGuest?: boolean;
  image?: string;
}

export interface ProvidersStatus {
  google: {
    enabled: boolean;
    clientId: string | null;
  };
}

const TOKEN_KEY = "ipl_auction_auth_token";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem("token") ||
    localStorage.getItem("ipl_auction_token")
  );
}

export function setStoredAuthToken(token: string, user?: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem("token", token);
  localStorage.setItem("ipl_auction_token", token);

  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("ipl_auction_user", JSON.stringify(user));
  }

  try {
    document.cookie = `better-auth.session_token=${token}; Path=/; SameSite=Lax; Max-Age=2592000`;
    document.cookie = `session_token=${token}; Path=/; SameSite=Lax; Max-Age=2592000`;
  } catch {}
}

export function clearStoredAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("token");
  localStorage.removeItem("ipl_auction_token");
  localStorage.removeItem("user");
  localStorage.removeItem("ipl_auction_user");

  try {
    document.cookie = "better-auth.session_token=; Path=/; Max-Age=0";
    document.cookie = "session_token=; Path=/; Max-Age=0";
  } catch {}
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch("/api/auth/me", {
      headers,
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch (err) {
    console.error("Failed to fetch current user:", err);
    return null;
  }
}

export async function fetchProvidersStatus(): Promise<ProvidersStatus> {
  try {
    const res = await fetch("/api/auth/providers");
    if (!res.ok) return { google: { enabled: false, clientId: null } };
    return await res.json();
  } catch {
    return { google: { enabled: false, clientId: null } };
  }
}

export async function demoLogin(role: "admin" | "user", name?: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch("/api/auth/demo-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, name }),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Demo login failed");
  }
  const data = await res.json();
  setStoredAuthToken(data.token, data.user);
  return data;
}

export async function logoutUser(): Promise<void> {
  clearStoredAuthToken();
  try {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("Error signing out:", err);
  }
}

export async function loginWithGoogle(email?: string, name?: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch("/api/auth/google/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Google login failed");
  }
  const data = await res.json();
  setStoredAuthToken(data.token, data.user);
  return data;
}

export async function initiateGoogleSignIn(email?: string, name?: string): Promise<{ url?: string; user?: AuthUser }> {
  const providers = await fetchProvidersStatus();

  if (providers.google.enabled) {
    // Real Google OAuth is configured in Cloudflare environment
    try {
      const res = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: window.location.origin,
        }),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          window.location.href = data.url;
          return { url: data.url };
        }
      }
    } catch (e) {
      console.warn("Failed to initiate Better Auth OAuth redirect:", e);
    }
  }

  // Instant seamless Google login (when credentials pending in Cloudflare env)
  const result = await loginWithGoogle(email, name);
  return { user: result.user };
}
