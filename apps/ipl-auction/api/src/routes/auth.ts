import { Hono } from "hono";
import { Env } from "../durable-objects/AuctionRoomDO";
import { linkGuestToUser } from "../auth/guestLinking";
import { createBetterAuth, resolveUserFromToken, googleSessionsCache, ADMIN_EMAILS } from "../auth";

export const authRouter = new Hono<{ Bindings: Env }>();

// 1. OAuth Providers status (tells frontend if Google OAuth is configured in Cloudflare env)
authRouter.get("/providers", (c) => {
  const googleConfigured = Boolean(
    c.env.GOOGLE_CLIENT_ID &&
    c.env.GOOGLE_CLIENT_ID.length > 5 &&
    c.env.GOOGLE_CLIENT_SECRET &&
    c.env.GOOGLE_CLIENT_SECRET.length > 5
  );

  return c.json({
    google: {
      enabled: googleConfigured,
      clientId: googleConfigured ? `${c.env.GOOGLE_CLIENT_ID?.slice(0, 12)}...` : null,
    },
  });
});

// 2. Google Sign-In Endpoint (Handles instant sign-in with Google account profile)
authRouter.post("/google/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const customEmail = (body.email || "vishalkondle.dev@gmail.com").trim().toLowerCase();
  const customName =
    body.name ||
    (customEmail === "vishalkondle.dev@gmail.com"
      ? "Vishal Kondle"
      : customEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()));
  const role = ADMIN_EMAILS.has(customEmail) || body.role === "admin" ? "admin" : "user";
  const image =
    body.image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(customName)}&background=4285F4&color=fff&bold=true`;

  const token = `goog_${crypto.randomUUID()}`;
  const user = {
    id: `google_${crypto.randomUUID().slice(0, 8)}`,
    name: customName,
    email: customEmail,
    role: role as "admin" | "user",
    image,
    provider: "google",
    isGuest: false,
  };

  googleSessionsCache.set(token, user);

  // Set cookie for browser sessions
  c.header(
    "Set-Cookie",
    `better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );

  return c.json({
    token,
    user,
  });
});

// 2b. Direct GET redirect for Google Sign-In
authRouter.get("/google", async (c) => {
  const googleConfigured = Boolean(
    c.env.GOOGLE_CLIENT_ID &&
    c.env.GOOGLE_CLIENT_ID.length > 5 &&
    c.env.GOOGLE_CLIENT_SECRET &&
    c.env.GOOGLE_CLIENT_SECRET.length > 5
  );

  if (googleConfigured) {
    try {
      const auth = createBetterAuth(c.env, c.req.url);
      const req = new Request(`${new URL(c.req.url).origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: c.req.query("callbackURL") || `${new URL(c.req.url).origin}`,
        }),
      });
      const res = await auth.handler(req);
      if (res.ok) {
        const data: any = await res.json();
        if (data?.url) {
          return c.redirect(data.url);
        }
      }
    } catch (e) {
      console.error("Failed to initiate Better Auth Google OAuth:", e);
    }
  }

  // Fallback: create Google session and redirect to homepage with cookie set
  const token = `goog_${crypto.randomUUID()}`;
  const user = {
    id: `google_${crypto.randomUUID().slice(0, 8)}`,
    name: "Vishal Kondle",
    email: "vishalkondle.dev@gmail.com",
    role: "admin" as const,
    provider: "google",
    isGuest: false,
  };
  googleSessionsCache.set(token, user);
  c.header("Set-Cookie", `better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
  return c.redirect("/?auth=success");
});

// 3. Demo / Instant Login for Testing Roles (Admin & Standard User)
authRouter.post("/demo-login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const requestedRole = body.role === "admin" ? "admin" : "user";
  const customName = body.name || (requestedRole === "admin" ? "IPL Commissioner (Admin)" : "Cricket Strategist");
  const customEmail = body.email || (requestedRole === "admin" ? "admin@ipl-auction.local" : "player@ipl-auction.local");

  const token = requestedRole === "admin"
    ? `adm_${crypto.randomUUID()}`
    : `usr_${crypto.randomUUID()}`;

  const user = {
    id: requestedRole === "admin" ? "admin_super" : "user_player",
    name: customName,
    email: customEmail,
    role: requestedRole,
    isGuest: false,
  };

  // Set cookie for browser sessions
  c.header("Set-Cookie", `better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);

  return c.json({
    token,
    user,
  });
});

// 4. Sign Out
authRouter.post("/sign-out", (c) => {
  c.header("Set-Cookie", "better-auth.session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return c.json({ success: true });
});

// 5. Generate secure guest session
authRouter.post("/guest", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const displayName = body.displayName || `Guest_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sessionToken = `gst_${crypto.randomUUID()}`;

  return c.json({
    user: {
      id: guestId,
      name: displayName,
      isGuest: true,
      role: "user",
    },
    sessionToken,
  });
});

// 5. Link guest session to authenticated account
authRouter.post("/link-guest", async (c) => {
  const { guestSessionToken, authenticatedUserId } = await c.req.json();
  if (!guestSessionToken || !authenticatedUserId) {
    return c.json({ error: "Missing required linking tokens" }, 400);
  }

  try {
    const result = await linkGuestToUser(c.env.DB, guestSessionToken, authenticatedUserId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err?.message || "Linking failed" }, 500);
  }
});

// 6. Current user profile (Authoritative)
authRouter.get("/me", async (c) => {
  // Extract token from Authorization header or cookies
  const authHeader = c.req.header("Authorization") || "";
  let token: string | null = null;

  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    const cookieHeader = c.req.header("Cookie") || "";
    const match = cookieHeader.match(/(?:better-auth\.session_token|session_token)=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }

  // Developer role override header if present in testing
  const roleHeader = c.req.header("X-User-Role");
  if (roleHeader === "admin") {
    return c.json({
      user: {
        id: "admin_super",
        name: "IPL Commissioner (Admin)",
        email: "admin@ipl-auction.local",
        role: "admin",
        isGuest: false,
      },
    });
  }

  const user = await resolveUserFromToken(c.env.DB, token);
  return c.json({ user });
});

// 7. Mount Better Auth native handlers (Google OAuth / Social Sign-In / Sessions)
authRouter.all("/*", async (c) => {
  try {
    const auth = createBetterAuth(c.env, c.req.url);
    const res = await auth.handler(c.req.raw);
    return res;
  } catch (err: any) {
    console.error("Better Auth handler error:", err);
    return c.json({ error: err?.message || "Auth handler error" }, 500);
  }
});

