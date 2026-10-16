import { Hono } from "hono";
import { SEED_PLAYERS, SEED_SETS } from "../db/seedData";
import { Env } from "../durable-objects/AuctionRoomDO";

export const playersRouter = new Hono<{ Bindings: Env }>();

// List all players with search & filters (Strictly sanitizes hidden ratings)
playersRouter.get("/", (c) => {
  const query = c.req.query("q")?.toLowerCase() || "";
  const role = c.req.query("role");
  const setId = c.req.query("setId");
  const overseasOnly = c.req.query("overseas") === "true";

  let filtered = SEED_PLAYERS.map((p) => {
    // Sanitize hidden ratings!
    const { hiddenRatingOverall, hiddenRatingBatting, hiddenRatingBowling, hiddenRatingKeeping, ...safe } = p;
    return safe;
  });

  if (query) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.country.toLowerCase().includes(query) ||
        p.role.toLowerCase().includes(query)
    );
  }

  if (role) {
    filtered = filtered.filter((p) => p.role === role);
  }

  if (setId) {
    filtered = filtered.filter((p) => p.setId === setId);
  }

  if (overseasOnly) {
    filtered = filtered.filter((p) => p.isOverseas);
  }

  return c.json({
    total: filtered.length,
    players: filtered,
  });
});

// List all sets and their metadata
playersRouter.get("/sets", (c) => {
  const setsWithCount = SEED_SETS.map((s) => {
    const count = SEED_PLAYERS.filter((p) => p.setId === s.id).length;
    return {
      ...s,
      playerCount: count,
    };
  });

  return c.json({
    sets: setsWithCount,
  });
});

// Get players in a specific set in source order
playersRouter.get("/sets/:setId", (c) => {
  const setId = c.req.param("setId");
  const setInfo = SEED_SETS.find((s) => s.id === setId || s.setCode === setId);
  if (!setInfo) {
    return c.json({ error: "Set not found" }, 404);
  }

  const setPlayers = SEED_PLAYERS.filter((p) => p.setId === setInfo.id)
    .sort((a, b) => a.orderInSet - b.orderInSet)
    .map((p) => {
      const { hiddenRatingOverall, hiddenRatingBatting, hiddenRatingBowling, hiddenRatingKeeping, ...safe } = p;
      return safe;
    });

  return c.json({
    set: setInfo,
    players: setPlayers,
  });
});
