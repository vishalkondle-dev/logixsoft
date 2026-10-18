import { Hono } from "hono";
import { Env } from "../durable-objects/AuctionRoomDO";
import { SEED_FRANCHISES } from "../db/seedData";

export const roomsRouter = new Hono<{ Bindings: Env }>();

export interface RoomRegistryItem {
  id: string;
  name: string;
  creatorId: string;
  creatorTeam?: string;
  status: string;
  ruleset: string;
  aiDifficulty: string;
  isPublic: boolean;
  createdAt: number;
}

/**
 * Generates a clean 6-character room code with alternating letters and digits (e.g. A1C2E3, K4K9S1)
 */
export function generateRoomId(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 24 uppercase letters (excluding ambiguous I, O)
  const digits = "123456789"; // 9 digits
  let code = "";
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return code;
}

export const publicRoomsRegistry = new Map<string, RoomRegistryItem>([
  [
    "A1C2E3",
    {
      id: "A1C2E3",
      name: "Official IPL 2026 Mega Auction",
      creatorId: "official_host",
      creatorTeam: "CSK",
      status: "LIVE",
      ruleset: "MEGA",
      aiDifficulty: "normal",
      isPublic: true,
      createdAt: Date.now() - 3600000,
    },
  ],
  [
    "K4K9S1",
    {
      id: "K4K9S1",
      name: "IPL 2026 Accelerated Mini Auction",
      creatorId: "official_host",
      creatorTeam: "MI",
      status: "LOBBY",
      ruleset: "MINI",
      aiDifficulty: "hard",
      isPublic: true,
      createdAt: Date.now() - 1800000,
    },
  ],
]);

// List active public rooms
roomsRouter.get("/", async (c) => {
  const roomsList = Array.from(publicRoomsRegistry.values());
  const enrichedRooms = await Promise.all(
    roomsList.map(async (r) => {
      try {
        const id = c.env.AUCTION_ROOM.idFromName(r.id);
        const stub = c.env.AUCTION_ROOM.get(id);
        let snap = await stub.getSnapshot();
        if (!snap.roomId) {
          const ruleset = (r.ruleset === "MINI" ? "MEGA" : r.ruleset) as any;
          await stub.initRoom(r.id, r.name, r.creatorId, r.aiDifficulty as any, r.creatorTeam, r.isPublic, true, ruleset);
          if (r.status === "LIVE") {
            await stub.startAuction();
          }
          snap = await stub.getSnapshot();
        }
        const teams = Object.values(snap.teams || {});
        const botTeamsCount = teams.filter((t) => t.controller === "AI").length;
        const humanTeamsCount = teams.filter((t) => t.controller === "HUMAN").length;

        return {
          id: r.id,
          name: snap.name || r.name,
          status: snap.status,
          ruleset: r.ruleset,
          aiDifficulty: r.aiDifficulty,
          creatorId: snap.creatorId || r.creatorId,
          creatorTeam: snap.creatorTeam || r.creatorTeam,
          connectedCount: snap.connectedHumanCount,
          botTeamsCount,
          humanTeamsCount,
          totalLots: snap.totalLots,
          completedLots: snap.completedLots,
          createdAt: r.createdAt,
        };
      } catch {
        return {
          ...r,
          connectedCount: 0,
          botTeamsCount: 10,
          humanTeamsCount: 0,
        };
      }
    })
  );

  // Order: LOBBY (open for joining), then LIVE, then ENDED
  const statusWeight: Record<string, number> = { LOBBY: 1, LIVE: 2, PAUSED: 3, ENDED: 4, COMPLETED: 5 };
  enrichedRooms.sort((a, b) => {
    const wA = statusWeight[a.status] || 99;
    const wB = statusWeight[b.status] || 99;
    if (wA !== wB) return wA - wB;
    return b.createdAt - a.createdAt;
  });

  return c.json({ rooms: enrichedRooms });
});

// Create a new room
roomsRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    let roomId = generateRoomId();
    while (publicRoomsRegistry.has(roomId)) {
      roomId = generateRoomId();
    }
    const roomName = body.name || "IPL 2026 Live Auction";
    const clientIp =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
      c.req.header("x-real-ip") ||
      "127.0.0.1";
    const ipUserId = `ip_${clientIp.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const creatorId =
      body.creatorId && body.creatorId.startsWith("ip_")
        ? body.creatorId
        : (body.creatorId && body.creatorId !== "guest_creator" && body.creatorId !== "creator" ? body.creatorId : ipUserId);
    const aiDifficulty = body.aiDifficulty || "normal";
    const creatorTeam = body.creatorTeam || undefined; // e.g. "CSK"
    const isPublic = body.isPublic !== undefined ? Boolean(body.isPublic) : true;
    const ruleset: "MEGA" | "CLASSIC" | "SPRINT_XI" = body.ruleset === "CLASSIC" ? "CLASSIC" : (body.ruleset === "SPRINT_XI" ? "SPRINT_XI" : "MEGA");
    const enableRetentions = ruleset === "SPRINT_XI" ? false : (body.enableRetentions !== undefined ? Boolean(body.enableRetentions) : true);

    // Bind to Durable Object instance
    const id = c.env.AUCTION_ROOM.idFromName(roomId);
    const stub = c.env.AUCTION_ROOM.get(id);

    // Initialize DO state with creator team, public flag, retentions, and ruleset
    await stub.initRoom(roomId, roomName, creatorId, aiDifficulty, creatorTeam, isPublic, enableRetentions, ruleset);

    // Register in public directory if public
    if (isPublic) {
      publicRoomsRegistry.set(roomId, {
        id: roomId,
        name: roomName,
        creatorId,
        creatorTeam,
        status: "LOBBY",
        ruleset,
        aiDifficulty,
        isPublic: true,
        createdAt: Date.now(),
      });
    }

    return c.json({
      success: true,
      roomId,
      name: roomName,
      creatorId,
      creatorTeam,
      isPublic,
      status: "LOBBY",
      wsUrl: `/api/rooms/${roomId}/ws`,
    });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to create room" }, 500);
  }
});

// Get room snapshot
roomsRouter.get("/:roomId", async (c) => {
  const rawRoomId = c.req.param("roomId");
  const roomId = rawRoomId.startsWith("room_") ? rawRoomId : rawRoomId.toUpperCase();
  try {
    const id = c.env.AUCTION_ROOM.idFromName(roomId);
    const stub = c.env.AUCTION_ROOM.get(id);
    const franchiseCode = c.req.query("franchiseCode") || undefined;
    let snapshot = await stub.getSnapshot(franchiseCode);

    if (!snapshot.roomId && publicRoomsRegistry.has(roomId)) {
      const r = publicRoomsRegistry.get(roomId)!;
      const ruleset = (r.ruleset === "MINI" ? "MEGA" : r.ruleset) as any;
      await stub.initRoom(r.id, r.name, r.creatorId, r.aiDifficulty as any, r.creatorTeam, r.isPublic, true, ruleset);
      if (r.status === "LIVE") {
        await stub.startAuction();
      }
      snapshot = await stub.getSnapshot(franchiseCode);
    }

    if (!snapshot.roomId) {
      return c.json({ error: "Room not found", valid: false }, 404);
    }

    return c.json({ snapshot, valid: true });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to fetch room snapshot", valid: false }, 500);
  }
});

// Get room lots with player order
roomsRouter.get("/:roomId/lots", async (c) => {
  const rawRoomId = c.req.param("roomId");
  const roomId = rawRoomId.startsWith("room_") ? rawRoomId : rawRoomId.toUpperCase();
  try {
    const id = c.env.AUCTION_ROOM.idFromName(roomId);
    const stub = c.env.AUCTION_ROOM.get(id);
    const snap = await stub.getSnapshot();
    if (!snap.roomId) {
      return c.json({ error: "Room not found", lots: [] }, 404);
    }
    const lots = await stub.getLots();
    return c.json({ lots });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to fetch room lots" }, 500);
  }
});

// WebSocket Upgrade route
roomsRouter.get("/:roomId/ws", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  const rawRoomId = c.req.param("roomId");
  const roomId = rawRoomId.startsWith("room_") ? rawRoomId : rawRoomId.toUpperCase();
  const id = c.env.AUCTION_ROOM.idFromName(roomId);
  const stub = c.env.AUCTION_ROOM.get(id);

  let snap = await stub.getSnapshot();
  if (!snap.roomId && publicRoomsRegistry.has(roomId)) {
    const r = publicRoomsRegistry.get(roomId)!;
    const ruleset = (r.ruleset === "MINI" ? "MEGA" : r.ruleset) as any;
    await stub.initRoom(r.id, r.name, r.creatorId, r.aiDifficulty as any, r.creatorTeam, r.isPublic, true, ruleset);
    if (r.status === "LIVE") {
      await stub.startAuction();
    }
    snap = await stub.getSnapshot();
  }

  if (!snap.roomId) {
    return c.text("Room does not exist", 404);
  }

  const clientIp =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
    c.req.header("x-real-ip") ||
    "127.0.0.1";

  const headers = new Headers(c.req.raw.headers);
  headers.set("x-client-ip", clientIp);
  const forwardReq = new Request(c.req.raw, { headers });

  // Forward request directly to Durable Object with client IP header
  return stub.fetch(forwardReq);
});
