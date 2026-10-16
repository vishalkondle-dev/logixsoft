import { Hono } from "hono";
import { cors } from "hono/cors";
import { AuctionRoomDO, Env } from "./durable-objects/AuctionRoomDO";
import { roomsRouter } from "./routes/rooms";
import { playersRouter } from "./routes/players";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";

// Export Durable Object class so Cloudflare Workers runtime can instantiate it
export { AuctionRoomDO };

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for frontend interactions
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-Role", "Upgrade"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Health check endpoints
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    app: "IPL Auction Simulator API",
    time: Date.now(),
  });
});

app.get("/api", (c) => {
  return c.json({
    status: "healthy",
    service: "IPL Auction Simulator API",
    version: "2026.1",
    time: Date.now(),
  });
});

app.get("/api/health", (c) => {
  return c.json({
    status: "healthy",
    service: "IPL Auction Simulator API",
    time: Date.now(),
  });
});

app.get("/api/me", (c) => {
  const clientIp =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
    c.req.header("x-real-ip") ||
    "127.0.0.1";
  const sanitizedIp = clientIp.replace(/[^a-zA-Z0-9_-]/g, "_");
  return c.json({
    clientIp,
    userId: `ip_${sanitizedIp}`,
  });
});

// Mount modular sub-routers
app.route("/api/rooms", roomsRouter);
app.route("/api/players", playersRouter);
app.route("/api/admin", adminRouter);
app.route("/api/auth", authRouter);

export default app;
