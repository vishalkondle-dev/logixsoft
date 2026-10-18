import { describe, it, expect } from "vitest";
import { RTMState } from "../src/types/auction";
import { calculateRetentionDeduction } from "../src/db/seedData";
import { ClefFlashService, RTMDecisionContext } from "../src/ai/clefFlash";

describe("RTM Bidding Lock Tests", () => {
  it("validates RTMState structure and locking semantics", () => {
    const rtmState: RTMState = {
      active: true,
      lotId: "lot_1",
      lotNumber: 1,
      playerName: "Shreyas Iyer",
      playerRole: "BATTER",
      isOverseas: false,
      highestBidderFranchise: "PBKS",
      finalBidAmount: 140000000,
      eligibleFranchise: "KKR",
      isEligibleHuman: true,
      timerDeadline: Date.now() + 10000,
      status: "PENDING_DECISION",
    };

    expect(rtmState.active).toBe(true);
    expect(rtmState.finalBidAmount).toBe(140000000);
    expect(rtmState.highestBidderFranchise).toBe("PBKS");
    expect(rtmState.eligibleFranchise).toBe("KKR");
    expect(rtmState.status).toBe("PENDING_DECISION");

    // Guard test: simulating the handlePlaceBid check
    const canPlaceBid = (rtm: RTMState | null) => {
      if (rtm && rtm.active) {
        return { allowed: false, reason: "Right to Match (RTM) decision is in progress. The hammer has closed and no further bids can be placed." };
      }
      return { allowed: true };
    };

    const attemptDuringRtm = canPlaceBid(rtmState);
    expect(attemptDuringRtm.allowed).toBe(false);
    expect(attemptDuringRtm.reason).toContain("Right to Match (RTM) decision is in progress");

    // After resolution:
    rtmState.active = false;
    const attemptAfterRtm = canPlaceBid(rtmState);
    expect(attemptAfterRtm.allowed).toBe(true);
  });

  it("enforces 6 - x RTM cards rule based on retained player count x", () => {
    // 0 retentions -> 6 RTMs
    expect(calculateRetentionDeduction([]).rtmCards).toBe(6);

    // 1 retained player -> 5 RTMs
    expect(calculateRetentionDeduction([{ isCapped: true }]).rtmCards).toBe(5);

    // 2 retained players -> 4 RTMs
    expect(calculateRetentionDeduction([{ isCapped: true }, { isCapped: true }]).rtmCards).toBe(4);

    // 4 retained players -> 2 RTMs
    expect(
      calculateRetentionDeduction([
        { isCapped: true },
        { isCapped: true },
        { isCapped: true },
        { isCapped: false },
      ]).rtmCards
    ).toBe(2);

    // 5 retained players -> 1 RTM
    expect(
      calculateRetentionDeduction([
        { isCapped: true },
        { isCapped: true },
        { isCapped: true },
        { isCapped: true },
        { isCapped: false },
      ]).rtmCards
    ).toBe(1);

    // 6 retained players -> 0 RTMs
    expect(
      calculateRetentionDeduction([
        { isCapped: true },
        { isCapped: true },
        { isCapped: true },
        { isCapped: true },
        { isCapped: true },
        { isCapped: false },
      ]).rtmCards
    ).toBe(0);
  });

  describe("Laya / AI RTM Decision Engine", () => {
    const baseContext: RTMDecisionContext = {
      player: {
        name: "Phil Salt",
        role: "WICKETKEEPER",
        country: "England",
        isOverseas: true,
        isCapped: true,
        matches: 24,
        runs: 750,
        battingAverage: 35.5,
        strikeRate: 175.2,
        wickets: 0,
        economy: 0,
        rating: 83,
        basePrice: 20000000,
      },
      rtmValue: {
        finalBid: 115000000, // 11.5 Cr
        highestBidderCode: "RCB",
      },
      formerTeam: {
        code: "KKR",
        name: "Kolkata Knight Riders",
        totalPurse: 1200000000,
        remainingPurse: 450000000, // 45 Cr
        purseAfterMatch: 335000000, // 33.5 Cr
        squadCount: 8,
        minSquad: 18,
        maxSquad: 25,
        overseasCount: 3,
        maxOverseas: 8,
        rtmCardsRemaining: 2,
        currentSquad: {
          batters: ["Rinku Singh"],
          bowlers: ["Varun Chakaravarthy", "Harshit Rana"],
          allRounders: ["Andre Russell", "Sunil Narine", "Ramandeep Singh"],
          wicketkeepers: [],
        },
        roleCounts: {
          BATTER: 1,
          BOWLER: 2,
          ALL_ROUNDER: 3,
          WICKETKEEPER: 0,
        },
        neededRoles: ["WICKETKEEPER", "BATTER", "BOWLER"],
        fairValuationCeiling: 120000000, // 12 Cr
        budgetPerRemainingSlotAfterMatch: 37222222, // ~3.7 Cr per slot
      },
    };

    it("exercises RTM when role is desperately needed, budget is healthy, and price is fair", async () => {
      const decision = await ClefFlashService.decideRTM({}, baseContext);
      expect(decision.exercise).toBe(true);
      expect(decision.reason).toContain("Exercised RTM");
    });

    it("declines RTM when team already has enough wicketkeepers in squad", async () => {
      const overcrowdedContext: RTMDecisionContext = {
        ...baseContext,
        formerTeam: {
          ...baseContext.formerTeam,
          roleCounts: {
            ...baseContext.formerTeam.roleCounts,
            WICKETKEEPER: 2,
          },
          currentSquad: {
            ...baseContext.formerTeam.currentSquad,
            wicketkeepers: ["Rahmanullah Gurbaz", "KS Bharat"],
          },
        },
      };

      const decision = await ClefFlashService.decideRTM({}, overcrowdedContext);
      expect(decision.exercise).toBe(false);
      expect(decision.reason).toContain("wicketkeepers in squad");
    });

    it("declines RTM when winning bid is significantly overpriced compared to valuation ceiling", async () => {
      const overpricedContext: RTMDecisionContext = {
        ...baseContext,
        rtmValue: {
          finalBid: 185000000, // 18.5 Cr! Way above 12 Cr ceiling
          highestBidderCode: "RCB",
        },
      };

      const decision = await ClefFlashService.decideRTM({}, overpricedContext);
      expect(decision.exercise).toBe(false);
      expect(decision.reason).toContain("exceeds strategic valuation ceiling");
    });

    it("declines RTM when matching would breach squad solvency reserve", async () => {
      const insolventContext: RTMDecisionContext = {
        ...baseContext,
        formerTeam: {
          ...baseContext.formerTeam,
          remainingPurse: 130000000, // 13 Cr left
          // Needs 10 more spots -> 10 * 30L = 3 Cr minimum reserve needed
          // 13 Cr - 11.5 Cr = 1.5 Cr < 3 Cr!
        },
      };

      const decision = await ClefFlashService.decideRTM({}, insolventContext);
      expect(decision.exercise).toBe(false);
      expect(decision.reason).toContain("breach mandatory reserve");
    });

    it("consults Laya AI when env.AI is provided", async () => {
      const mockLayaAI = {
        run: async () => ({
          response: JSON.stringify({
            exercise: false,
            confidence: 0.92,
            reason: "Laya evaluated that spending 11.5 Cr on an overseas wicketkeeper restricts bowling budget.",
          }),
        }),
      };

      const decision = await ClefFlashService.decideRTM({ AI: mockLayaAI }, baseContext);
      expect(decision.exercise).toBe(false);
      expect(decision.source).toBe("LAYA_LLM");
      expect(decision.reason).toContain("restricts bowling budget");
    });
  });
});
