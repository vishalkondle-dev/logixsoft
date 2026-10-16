import { FranchiseState, AuctionLot } from "../types/auction";
import { AIDecisionResult, FallbackAIEngine } from "./fallbackEngine";
import { calculatePlayerValuation } from "./valuation";
import { evaluateRosterBalance } from "../services/rosterBalanceService";

export interface ClefFlashEnv {
  AI?: {
    run: (model: string, input: any) => Promise<any>;
  };
}

export class ClefFlashService {
  /**
   * Invokes Cloudflare @cf/cloudflare/clef-flash typed decision model.
   * If unavailable or fails, gracefully falls back to deterministic FallbackAIEngine.
   */
  static async decideNextBid(
    env: ClefFlashEnv,
    lot: AuctionLot,
    teams: Record<string, FranchiseState>,
    nextLegalBid: number,
    difficulty: "easy" | "normal" | "hard" = "normal",
    lotsRemaining: number = 20,
    totalLots: number = 61
  ): Promise<AIDecisionResult> {
    // 1. Identify eligible AI franchises
    const eligibleTeams: { code: string; team: FranchiseState; ceiling: number }[] = [];

    for (const [code, team] of Object.entries(teams)) {
      if (team.controller !== "AI") continue;
      if (lot.highestBidderFranchise === code) continue;

      // Strict Roster balance and role reservation check
      const balanceCheck = evaluateRosterBalance(team, lot);
      if (!balanceCheck.allowed) continue;

      const spotsRemaining = Math.max(0, team.minSquad - team.squadCount - 1);
      const minReserve = spotsRemaining * 3000000;
      if (team.remainingPurse - nextLegalBid < minReserve) continue;

      const ceiling = calculatePlayerValuation(lot, team, difficulty, lotsRemaining, totalLots, teams);
      if (ceiling >= nextLegalBid) {
        eligibleTeams.push({ code, team, ceiling });
      }
    }

    if (eligibleTeams.length === 0) {
      return {
        shouldBid: false,
        reason: "No AI franchise has legal capacity or budget ceiling to bid.",
      };
    }

    // 2. If Cloudflare Workers AI is available, run Clef-Flash
    if (env.AI && typeof env.AI.run === "function") {
      try {
        const compactState = {
          player: {
            name: lot.playerName,
            role: lot.role,
            isOverseas: lot.isOverseas,
            basePrice: lot.basePrice,
            rating: lot.hiddenRatingOverall,
          },
          currentBid: lot.currentBid,
          nextLegalBid,
          currentLeader: lot.highestBidderFranchise,
          difficulty,
          lotsRemaining,
          eligibleFranchises: eligibleTeams.map((e) => ({
            code: e.code,
            purse: e.team.remainingPurse,
            squad: e.team.squadCount,
            overseas: e.team.overseasCount,
            valuationCeiling: e.ceiling,
          })),
        };

        const criteria: Record<string, string> = {};
        for (const e of eligibleTeams) {
          criteria[e.code] = `Franchise ${e.code} with remaining purse ₹${e.team.remainingPurse} and valuation ceiling ₹${e.ceiling}`;
        }

        const modelResult = await Promise.race([
          env.AI.run("@cf/cloudflare/clef-flash", {
            model: "clef-flash",
            state: JSON.stringify(compactState),
            questions: {
              should_bid: {
                type: "noul",
                instructions: "Should an eligible AI franchise place the next legal bid for this player?",
              },
              bidder: {
                type: "choice",
                instructions: "Which eligible AI franchise has the strongest reason to bid?",
                criteria,
              },
            },
          }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Clef-Flash timeout")), 2000)
          ),
        ]);

        if (modelResult) {
          // Parse typed output
          const shouldBidValue = modelResult?.questions?.should_bid?.answer ?? modelResult?.should_bid;
          const chosenBidder = modelResult?.questions?.bidder?.answer ?? modelResult?.bidder;

          const wantsToBid = shouldBidValue === "yes" || shouldBidValue === true || shouldBidValue === "true";
          if (wantsToBid && chosenBidder && eligibleTeams.some((e) => e.code === chosenBidder)) {
            const matched = eligibleTeams.find((e) => e.code === chosenBidder)!;
            return {
              shouldBid: true,
              bidderFranchiseCode: chosenBidder,
              valuationCeiling: matched.ceiling,
              reason: `Clef-Flash selected ${chosenBidder} (probability: ${modelResult?.questions?.bidder?.confidence || "high"}).`,
            };
          }
        }
      } catch (aiErr) {
        // Fall through to deterministic fallback
      }
    }

    // 3. Deterministic rule-based fallback
    return FallbackAIEngine.evaluateBidding(lot, teams, nextLegalBid, difficulty, lotsRemaining, totalLots);
  }
}
