import { describe, it, expect } from "vitest";
import { calculateNextLegalBid } from "../src/types/auction";
import { calculatePlayerHiddenRatings, calculateTeamAverageRating } from "../src/services/ratingService";
import { FallbackAIEngine } from "../src/ai/fallbackEngine";
import { calculatePlayerValuation } from "../src/ai/valuation";
import { AudioAnnouncementService, formatRupeesForSpeech } from "../src/services/audioAnnouncements";
import { SEED_FRANCHISES } from "../src/db/seedData";

describe("Auction Engine & Domain Logic Unit Tests", () => {
  it("computes legal bid increments correctly across IPL value tiers", () => {
    // Under 1 Cr: + 5 Lakh
    expect(calculateNextLegalBid(2000000, 2000000)).toEqual({ nextBid: 2500000, increment: 500000 });
    // Between 1 Cr and 2 Cr: + 10 Lakh
    expect(calculateNextLegalBid(15000000, 2000000)).toEqual({ nextBid: 16000000, increment: 1000000 });
    // Between 2 Cr and 5 Cr: + 20 Lakh
    expect(calculateNextLegalBid(30000000, 2000000)).toEqual({ nextBid: 32000000, increment: 2000000 });
    // 5 Cr and above: + 50 Lakh
    expect(calculateNextLegalBid(80000000, 2000000)).toEqual({ nextBid: 85000000, increment: 5000000 });
  });

  it("calculates role-normalized ratings without penalizing bowlers for batting stats", () => {
    const bowlerStats = {
      role: "BOWLER" as const,
      matches: 25,
      runs: 10,
      battingAverage: 2.5,
      strikeRate: 50,
      wickets: 35,
      economy: 7.2,
      isCapped: true,
    };
    const ratings = calculatePlayerHiddenRatings(bowlerStats);
    expect(ratings.bowling).toBeGreaterThan(80);
    expect(ratings.overall).toBeGreaterThan(70); // Specialist bowler maintains high overall rating!
  });

  it("enforces team average threshold of AT LEAST 3 purchased players", () => {
    // With 1 player: null
    expect(calculateTeamAverageRating([85])).toBeNull();
    // With 2 players: null
    expect(calculateTeamAverageRating([85, 78])).toBeNull();
    // With 3 players: computes valid average
    expect(calculateTeamAverageRating([85, 78, 80])).toBe(81.0);
    // With 4 players: computes accurate average
    expect(calculateTeamAverageRating([85, 78, 80, 90])).toBe(83.3);
  });

  it("AI Fallback Engine evaluates eligible AI franchises and enforces squad & budget rules", () => {
    const lot = {
      id: "lot_1",
      lotNumber: 1,
      setId: "set_1",
      setCode: "BA1",
      setName: "Set 1",
      orderInSet: 1,
      playerId: "p_1",
      playerName: "Cameron Green",
      country: "Australia",
      isOverseas: true,
      role: "ALL_ROUNDER" as const,
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm fast",
      basePrice: 20000000,
      matches: 25,
      runs: 700,
      battingAverage: 35,
      strikeRate: 150,
      wickets: 15,
      economy: 8.5,
      isCapped: true,
      hiddenRatingOverall: 88,
      status: "ACTIVE" as const,
      currentBid: 0,
      highestBidderFranchise: null,
      soldToFranchise: null,
      finalPrice: null,
    };

    const teams: Record<string, any> = {
      CSK: {
        code: "CSK",
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

    const decision = FallbackAIEngine.evaluateBidding(lot, teams, 20000000, "normal", 20);
    expect(decision.shouldBid).toBe(true);
    expect(decision.bidderFranchiseCode).toBe("CSK");
  });

  it("formats Indian rupees correctly for speech synthesis", () => {
    expect(formatRupeesForSpeech(20000000)).toBe("2 Crore rupees");
    expect(formatRupeesForSpeech(15000000)).toBe("1.5 Crore rupees");
    expect(formatRupeesForSpeech(7500000)).toBe("75 Lakh rupees");
    expect(formatRupeesForSpeech(3000000)).toBe("30 Lakh rupees");
  });

  it("monotonically increases audio announcement sequence numbers", () => {
    const a1 = AudioAnnouncementService.createLotStartAnnouncement(1, "Cameron Green", "Australia", "ALL_ROUNDER", 20000000);
    const a2 = AudioAnnouncementService.createBidAnnouncement(22000000, "Mumbai Indians");
    expect(a2.sequence).toBeGreaterThan(a1.sequence);
  });

  it("distributes distinct scouting tiers and staggered ceilings across franchises", () => {
    const lot = {
      id: "lot_kl",
      lotNumber: 1,
      setId: "set_1",
      setCode: "BA1",
      setName: "Set 1",
      orderInSet: 1,
      playerId: "p_kl",
      playerName: "KL Rahul",
      country: "India",
      isOverseas: false,
      role: "WICKETKEEPER" as const,
      basePrice: 20000000,
      matches: 120,
      runs: 4200,
      battingAverage: 45,
      strikeRate: 135,
      wickets: 0,
      economy: 0,
      isCapped: true,
      hiddenRatingOverall: 89,
      status: "ACTIVE" as const,
      currentBid: 0,
      highestBidderFranchise: null,
      soldToFranchise: null,
      finalPrice: null,
    };

    const valuations = SEED_FRANCHISES.map((f) => {
      const franchiseState = {
        code: f.code,
        name: f.name,
        totalPurse: 1200000000,
        remainingPurse: 1200000000,
        squadCount: 0,
        minSquad: 18,
        maxSquad: 25,
        overseasCount: 0,
        maxOverseas: 8,
        rtmCardsRemaining: 1,
        purchasedPlayers: [],
        controller: "AI" as const,
      };
      return calculatePlayerValuation(lot, franchiseState, "normal", 20, 61);
    });

    // Ceilings must not all be identical across the 10 franchises
    const uniqueValuations = new Set(valuations);
    expect(uniqueValuations.size).toBeGreaterThan(3);
  });

  it("applies paddle tenacity and counter-bids when a human user takes the lead", () => {
    const lot = {
      id: "lot_shami",
      lotNumber: 2,
      setId: "set_1",
      setCode: "BO1",
      setName: "Set 1",
      orderInSet: 2,
      playerId: "p_shami",
      playerName: "Mohammed Shami",
      country: "India",
      isOverseas: false,
      role: "BOWLER" as const,
      basePrice: 20000000,
      matches: 110,
      runs: 100,
      battingAverage: 8,
      strikeRate: 90,
      wickets: 130,
      economy: 8.2,
      isCapped: true,
      hiddenRatingOverall: 88,
      status: "ACTIVE" as const,
      currentBid: 50000000, // ₹5.0 Cr
      highestBidderFranchise: "CSK", // CSK is human-controlled
      soldToFranchise: null,
      finalPrice: null,
    };

    const teams: Record<string, any> = {
      CSK: {
        code: "CSK",
        totalPurse: 1200000000,
        remainingPurse: 1150000000,
        squadCount: 0,
        minSquad: 18,
        maxSquad: 25,
        overseasCount: 0,
        maxOverseas: 8,
        controller: "HUMAN", // Human is leading
      },
      GT: {
        code: "GT",
        totalPurse: 1200000000,
        remainingPurse: 1200000000,
        squadCount: 0,
        minSquad: 18,
        maxSquad: 25,
        overseasCount: 0,
        maxOverseas: 8,
        controller: "AI",
      },
      MI: {
        code: "MI",
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

    // Human leading with ₹5.0 Cr, next legal bid is ₹5.5 Cr
    const decision = FallbackAIEngine.evaluateBidding(lot, teams, 55000000, "normal", 20, 61, true);
    expect(decision.shouldBid).toBe(true);
    expect(["GT", "MI"]).toContain(decision.bidderFranchiseCode);
  });
});
