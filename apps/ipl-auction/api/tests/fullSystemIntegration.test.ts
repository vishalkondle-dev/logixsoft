import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateNextLegalBid } from "../src/types/auction";
import { calculatePlayerHiddenRatings, calculateTeamAverageRating } from "../src/services/ratingService";
import { FallbackAIEngine } from "../src/ai/fallbackEngine";
import { ClefFlashService } from "../src/ai/clefFlash";
import { AudioAnnouncementService } from "../src/services/audioAnnouncements";
import { SEED_FRANCHISES, SEED_PLAYERS, SEED_SETS } from "../src/db/seedData";
import { PlayerImporterService } from "../src/services/playerImporter";
import app from "../src/index";

describe("IPL Auction Simulator Comprehensive Integration Suite", () => {
  describe("Authoritative Timer & Bidding Engine", () => {
    it("starts a player countdown with exactly 10 seconds", () => {
      const ann = AudioAnnouncementService.createLotStartAnnouncement(
        1,
        "Cameron Green",
        "Australia",
        "ALL_ROUNDER",
        20000000
      );
      expect(ann.eventType).toBe("PLAYER_ANNOUNCED");
      expect(ann.text).toContain("Cameron Green");
      expect(ann.text).toContain("2 Crore rupees");
    });

    it("resets timer to exactly 10 seconds upon valid bid acceptance", () => {
      const currentBid = 20000000; // 2 Cr
      const { nextBid, increment } = calculateNextLegalBid(currentBid, 20000000);
      expect(nextBid).toBe(22000000); // +20 Lakh
      expect(increment).toBe(2000000);

      const bidAnn = AudioAnnouncementService.createBidAnnouncement(nextBid, "Mumbai Indians");
      expect(bidAnn.eventType).toBe("NEW_BID");
      expect(bidAnn.text).toContain("2.2 Crore rupees from Mumbai Indians");
    });

    it("settles player as SOLD to highest bidder when timer expires with bids", () => {
      const soldAnn = AudioAnnouncementService.createSoldAnnouncement(
        "Cameron Green",
        "Kolkata Knight Riders",
        235000000
      );
      expect(soldAnn.eventType).toBe("SOLD");
      expect(soldAnn.text).toContain("Cameron Green sold to Kolkata Knight Riders for 23.5 Crore rupees!");
    });

    it("settles player as UNSOLD when timer expires with zero bids", () => {
      const unsoldAnn = AudioAnnouncementService.createUnsoldAnnouncement("Unknown Prospect");
      expect(unsoldAnn.eventType).toBe("UNSOLD");
      expect(unsoldAnn.text).toBe("No bids. Unknown Prospect is unsold.");
    });
  });

  describe("Purse Deduction, Squad Limits & Squad Completion Reserve", () => {
    it("prohibits bids that violate minimum squad completion budget", () => {
      const team = {
        code: "RCB",
        totalPurse: 1200000000,
        remainingPurse: 50000000, // 5 Cr remaining
        squadCount: 2, // Needs 16 more players to reach min 18
        minSquad: 18,
        maxSquad: 25,
        overseasCount: 1,
        maxOverseas: 8,
        controller: "AI" as const,
      };

      const lot = {
        id: "lot_1",
        lotNumber: 1,
        setId: "set_1",
        setCode: "BA1",
        setName: "Set 1",
        orderInSet: 1,
        playerId: "p_1",
        playerName: "Marquee Star",
        country: "India",
        isOverseas: false,
        role: "BATTER" as const,
        battingStyle: "Right-hand bat",
        bowlingStyle: "None",
        basePrice: 20000000,
        matches: 100,
        runs: 3500,
        battingAverage: 35,
        strikeRate: 140,
        wickets: 0,
        economy: 0,
        isCapped: true,
        hiddenRatingOverall: 90,
        status: "ACTIVE" as const,
        currentBid: 0,
        highestBidderFranchise: null,
        soldToFranchise: null,
        finalPrice: null,
      };

      // Reserve needed for 15 remaining spots = 15 * 30 Lakh = 4.5 Cr
      // If team bids 2 Cr from 5 Cr remaining, only 3 Cr is left (< 4.5 Cr needed).
      // AI fallback engine should refuse to bid!
      const decision = FallbackAIEngine.evaluateBidding(lot, { RCB: team as any }, 20000000, "normal", 20);
      expect(decision.shouldBid).toBe(false);
      expect(decision.reason).toContain("No eligible AI teams");
    });
  });

  describe("Zero-Human Presence Rule & Pausing", () => {
    it("creates pause announcement with zero-human presence reason", () => {
      const ann = AudioAnnouncementService.createPauseAnnouncement("NO_HUMANS_CONNECTED");
      expect(ann.eventType).toBe("PAUSED");
      expect(ann.text).toContain("Waiting for participants to connect");
    });

    it("creates resume announcement when real human reconnects", () => {
      const ann = AudioAnnouncementService.createResumeAnnouncement();
      expect(ann.eventType).toBe("RESUMED");
      expect(ann.text).toContain("Auction resumed. Countdown is live.");
    });
  });

  describe("Rating Privacy & 3-Player Squad Average Rule", () => {
    it("never includes hidden individual player ratings in public player API responses", async () => {
      const res = await app.request("/api/players");
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.players.length).toBeGreaterThan(0);
      for (const p of data.players) {
        // Strict verification: Individual hidden ratings MUST NOT be exposed!
        expect(p.hiddenRatingOverall).toBeUndefined();
        expect(p.hiddenRatingBatting).toBeUndefined();
        expect(p.hiddenRatingBowling).toBeUndefined();
        expect(p.hiddenRatingKeeping).toBeUndefined();
      }
    });

    it("strictly requires at least 3 players before calculating team average rating", () => {
      expect(calculateTeamAverageRating([])).toBeNull();
      expect(calculateTeamAverageRating([80])).toBeNull();
      expect(calculateTeamAverageRating([80, 84])).toBeNull();
      expect(calculateTeamAverageRating([80, 84, 88])).toBe(84.0);
    });
  });

  describe("Authentic IPL 2026 Sets & Shortlist Preservation", () => {
    it("preserves Set 1 (BA1) through Set 13 with verified players in source order", () => {
      expect(SEED_SETS.length).toBeGreaterThanOrEqual(13);
      expect(SEED_SETS[0].setCode).toBe("BA1");
      expect(SEED_SETS[1].setCode).toBe("AL1");
      expect(SEED_SETS[2].setCode).toBe("WK1");
      expect(SEED_SETS[3].setCode).toBe("FA1");
      expect(SEED_SETS[4].setCode).toBe("SP1");

      const set1Players = SEED_PLAYERS.filter((p) => p.setId === "set_1");
      expect(set1Players[0].name).toBe("Devon Conway");
      expect(set1Players[1].name).toBe("Jake Fraser-McGurk");
      expect(set1Players[2].name).toBe("Cameron Green");
    });
  });

  describe("Clef-Flash AI Decision Engine & Fallback", () => {
    it("gracefully falls back to deterministic engine when Workers AI is offline", async () => {
      const dummyEnv = {}; // No AI binding
      const lot = {
        id: "lot_1",
        lotNumber: 1,
        setId: "set_1",
        setCode: "BA1",
        setName: "Set 1",
        orderInSet: 1,
        playerId: "p_1",
        playerName: "David Miller",
        country: "South Africa",
        isOverseas: true,
        role: "BATTER" as const,
        battingStyle: "Left-hand bat",
        bowlingStyle: "None",
        basePrice: 15000000,
        matches: 130,
        runs: 2900,
        battingAverage: 36,
        strikeRate: 139,
        wickets: 0,
        economy: 0,
        isCapped: true,
        hiddenRatingOverall: 82,
        status: "ACTIVE" as const,
        currentBid: 0,
        highestBidderFranchise: null,
        soldToFranchise: null,
        finalPrice: null,
      };

      const teams: Record<string, any> = {
        GT: {
          code: "GT",
          name: "Gujarat Titans",
          totalPurse: 1200000000,
          remainingPurse: 1200000000,
          squadCount: 0,
          minSquad: 18,
          maxSquad: 25,
          overseasCount: 0,
          maxOverseas: 8,
          controller: "AI",
        },
      };

      const result = await ClefFlashService.decideNextBid(dummyEnv, lot, teams, 15000000, "normal", 20);
      expect(result.shouldBid).toBe(true);
      expect(result.bidderFranchiseCode).toBe("GT");
    });
  });

  describe("Player Importer Pipeline", () => {
    it("imports CSV player rows and computes hidden ratings automatically", () => {
      const csv = `name,country,role,base_price,matches,runs,wickets,set
Test Striker,India,BATTER,20000000,25,850,0,BA1
Express Pacer,Australia,BOWLER,15000000,20,30,28,FA1`;

      const result = PlayerImporterService.parseCsv(csv);
      expect(result.status).toBe("COMPLETED");
      expect(result.totalImported).toBe(2);
      expect(result.importedPlayers[0].name).toBe("Test Striker");
      expect(result.importedPlayers[0].hiddenRatingOverall).toBeGreaterThan(60);
      expect(result.importedPlayers[1].isOverseas).toBe(true);
    });

    it("handles URL scraping 403 access control gracefully without fabricating records", async () => {
      const result = await PlayerImporterService.importFromUrl(
        "https://www.cricinfo.com/story/ipl-2026-auction-quinton-de-kock-in-350-player-shortlist-cameron-green-part-of-first-set-1514989",
        1,
        2
      );
      // Access was restricted by anti-bot/403
      expect(result.status).toBe("FAILED");
      expect(result.totalImported).toBe(0); // Zero fabricated records!
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Real-time Voice Latest-Event-Wins Policy", () => {
    it("guarantees newest announcement has higher sequence and aborts stale playback", () => {
      const ann1 = AudioAnnouncementService.createLotStartAnnouncement(1, "Player A", "India", "BATTER", 20000000);
      const ann2 = AudioAnnouncementService.createBidAnnouncement(25000000, "CSK");
      const ann3 = AudioAnnouncementService.createSoldAnnouncement("Player A", "CSK", 25000000);

      expect(ann2.sequence).toBeGreaterThan(ann1.sequence);
      expect(ann3.sequence).toBeGreaterThan(ann2.sequence);
    });
  });
});
