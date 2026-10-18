import { FranchiseState, AuctionLot } from "../types/auction";
import { calculateDetailedValuation } from "./valuation";
import { evaluateRosterBalance } from "../services/rosterBalanceService";

export interface AIDecisionResult {
  shouldBid: boolean;
  bidderFranchiseCode?: string;
  valuationCeiling?: number;
  reason: string;
}

export interface FranchiseRetentionCandidate {
  id: string;
  name: string;
  role: "BATTER" | "BOWLER" | "ALL_ROUNDER" | "WICKETKEEPER";
  country: string;
  isOverseas: boolean;
  isCapped: boolean;
  officialPrice: number;
  matches: number;
  runs: number;
  battingAverage: number;
  strikeRate: number;
  wickets: number;
  economy: number;
  rating: number;
}

export interface FranchiseRetentionDecisionContext {
  franchise: {
    code: string;
    name: string;
    totalPurse: number;
    remainingPurse: number;
    maxSquad: number;
    minSquad: number;
    maxOverseas: number;
  };
  candidates: FranchiseRetentionCandidate[];
  ruleset?: "MEGA" | "CLASSIC" | "SPRINT_XI";
}

export interface FranchiseRetentionDecisionResult {
  retainedIds: string[];
  strategy: "core_retention" | "selective_retention" | "clean_slate";
  reason: string;
  source: "CLEF_FLASH" | "DETERMINISTIC_ENGINE";
}

interface CandidateBidder {
  code: string;
  ceiling: number;
  surplus: number;
  squadNeedFactor: number;
  roleNeedFactor: number;
  weight: number;
  team: FranchiseState;
}

export class FallbackAIEngine {
  /**
   * Evaluates all AI-controlled franchises and chooses the most motivated candidate.
   * Accurately factors in:
   * - Squad deficit vs room average (ensures all 10 franchises actively acquire players)
   * - Positional/role need
   * - Remaining purse capacity
   * - Realistic stochastic variation (jitter) so paddle raises are distributed dynamically
   */
  static evaluateBidding(
    lot: AuctionLot,
    teams: Record<string, FranchiseState>,
    nextLegalBid: number,
    difficulty: "easy" | "normal" | "hard" = "normal",
    lotsRemaining: number = 20,
    totalLots: number = 61,
    isHumanLeading: boolean = false
  ): AIDecisionResult {
    const candidates: CandidateBidder[] = [];

    for (const [code, team] of Object.entries(teams)) {
      if (team.controller !== "AI") continue;
      // Do not bid against oneself
      if (lot.highestBidderFranchise === code) continue;

      // Strict Roster balance and role reservation check
      const balanceCheck = evaluateRosterBalance(team, lot);
      if (!balanceCheck.allowed) continue;

      // Minimum squad completion reserve check
      const spotsRemaining = Math.max(0, team.minSquad - team.squadCount - 1);
      const minReserve = spotsRemaining * 3000000; // ₹30 Lakh base per remaining spot
      if (team.remainingPurse - nextLegalBid < minReserve) continue;

      // Detailed valuation check factoring in entire room state, scouting tier, and human rivalry
      const val = calculateDetailedValuation(lot, team, difficulty, lotsRemaining, totalLots, teams, isHumanLeading);
      if (!val.isDesirable || val.ceiling < nextLegalBid || val.roleNeedFactor <= 0.20) continue;

      const surplus = val.ceiling - nextLegalBid;
      const surplusRatio = Math.max(0.05, surplus / (val.ceiling + 1));

      // Weight calculation:
      // 1. Surplus ratio: how much headroom above the current price
      // 2. Squad Need Factor: quadratic scaling heavily elevates teams with fewer players!
      // 3. Purse Per Slot Factor: teams with healthy purse-to-slot ratio are confident
      const slotsRemaining = Math.max(1, team.maxSquad - team.squadCount);
      const pursePerSlot = team.remainingPurse / slotsRemaining;
      const purseFactor = Math.min(1.4, Math.max(0.7, pursePerSlot / 50000000));

      // Rivalry & Paddle war elasticity:
      // When a human participant holds the lead, teams targeting this player contest the human enthusiastically!
      let rivalryBoost = 1.0;
      if (isHumanLeading) {
        if (val.scoutingTier === "CORE_TARGET") {
          rivalryBoost = 1.85;
        } else if (val.scoutingTier === "SECONDARY_TARGET") {
          rivalryBoost = 1.40;
        } else {
          rivalryBoost = 0.85;
        }
      }

      // Stochastic jitter (0.80 to 1.20) represents varying paddle raise timing in an auction
      const jitter = 0.80 + Math.random() * 0.40;
      const weight = surplusRatio * Math.pow(val.squadNeedFactor, 2.0) * val.roleNeedFactor * purseFactor * jitter * rivalryBoost;

      candidates.push({
        code,
        ceiling: val.ceiling,
        surplus,
        squadNeedFactor: val.squadNeedFactor,
        roleNeedFactor: val.roleNeedFactor,
        weight,
        team,
      });
    }

    if (candidates.length === 0) {
      return {
        shouldBid: false,
        reason: "No eligible AI teams have a valuation ceiling above the next legal bid.",
      };
    }

    // Weighted roulette wheel selection among motivated candidates:
    // This creates authentic, unpredictable paddle wars where different teams react dynamically!
    let totalWeight = 0;
    for (const c of candidates) {
      totalWeight += c.weight;
    }
    let roll = Math.random() * totalWeight;
    let winner = candidates[0];
    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) {
        winner = c;
        break;
      }
    }

    return {
      shouldBid: true,
      bidderFranchiseCode: winner.code,
      valuationCeiling: winner.ceiling,
      reason: `AI franchise ${winner.code} placed bid (ceiling: ₹${winner.ceiling}, need: ${winner.squadNeedFactor.toFixed(2)}, next bid: ₹${nextLegalBid}).`,
    };
  }

  /**
   * Deterministically evaluates franchise candidates and selects optimal retentions.
   * Adheres strictly to official IPL Mega Auction rules:
   * - Max 6 retentions total
   * - Max 5 capped players
   * - Max 2 uncapped players
   * - Max 8 overseas players
   * - Slabs: 18 Cr, 14 Cr, 11 Cr, 18 Cr, 14 Cr capped; 4 Cr uncapped
   * - Solvency: Remaining purse must leave minimum ₹30L per remaining squad spot
   */
  static evaluateFranchiseRetentions(
    context: FranchiseRetentionDecisionContext
  ): FranchiseRetentionDecisionResult {
    const { franchise, candidates, ruleset = "MEGA" } = context;

    if (!candidates || candidates.length === 0) {
      return {
        retainedIds: [],
        strategy: "clean_slate",
        reason: `${franchise.code} has no previous squad candidates. 0 retentions, 6 RTM cards.`,
        source: "DETERMINISTIC_ENGINE",
      };
    }

    // Determine franchise philosophy based on last year's squad quality:
    // Elite squads (CSK, MI, KKR, SRH) tend towards core retention (locking top 4-5)
    // Squads needing rebuilding (PBKS, DC) lean towards clean slate or selective
    // RCB, RR, GT, LSG lean selective (locking 2-3 key pillars)
    let defaultStrategy: "core_retention" | "selective_retention" | "clean_slate" = "selective_retention";
    const eliteCount = candidates.filter((c) => c.rating >= 88).length;
    if (eliteCount >= 3) {
      defaultStrategy = "core_retention";
    } else if (eliteCount === 0 && candidates.filter((c) => c.rating >= 82).length <= 2) {
      defaultStrategy = "clean_slate";
    }

    const selected = this.selectCandidatesForStrategy(
      candidates,
      defaultStrategy,
      true,
      franchise.totalPurse,
      ruleset
    );

    const rtmCount = Math.max(0, 6 - selected.length);
    return {
      retainedIds: selected.map((s) => s.id),
      strategy: defaultStrategy,
      reason: selected.length === 0
        ? `${franchise.code} opted for a complete clean slate: 0 retentions, 6 RTM cards, entering auction with ₹${(franchise.totalPurse / 10000000).toFixed(1)} Cr purse.`
        : `${franchise.code} locked ${selected.length} retentions (${selected.map((s) => s.name).join(", ")}), keeping ${rtmCount} RTM cards.`,
      source: "DETERMINISTIC_ENGINE",
    };
  }

  static selectCandidatesForStrategy(
    candidates: FranchiseRetentionCandidate[],
    strategy: "core_retention" | "selective_retention" | "clean_slate",
    prioritizeUncapped: boolean,
    totalPurse: number,
    ruleset: "MEGA" | "CLASSIC" | "SPRINT_XI" = "MEGA"
  ): FranchiseRetentionCandidate[] {
    if (strategy === "clean_slate") return [];

    const maxTotal = ruleset === "MEGA" ? 6 : 11;
    const maxCapped = ruleset === "MEGA" ? 5 : 11;
    const maxUncapped = ruleset === "MEGA" ? 2 : 2;

    const maxRetainCount = strategy === "core_retention" ? maxTotal : Math.min(3, maxTotal);

    // Sort candidates:
    // For capped: rating >= 88 is elite must-retain, rating 84-87 is secondary
    // For uncapped: rating >= 74 is great value at ₹4 Cr
    const sortedCapped = [...candidates]
      .filter((c) => c.isCapped)
      .sort((a, b) => b.rating - a.rating);

    const sortedUncapped = [...candidates]
      .filter((c) => !c.isCapped)
      .sort((a, b) => b.rating - a.rating);

    const selected: FranchiseRetentionCandidate[] = [];
    let cappedCount = 0;
    let uncappedCount = 0;
    let overseasCount = 0;
    let currentDeduction = 0;

    // Minimum purse to retain for filling remaining spots (at least ₹30L per spot for 18 min squad)
    const minReserve = (18 - maxRetainCount) * 3000000;

    // 1. First pick elite capped superstars (rating >= 87)
    for (const cand of sortedCapped) {
      if (selected.length >= maxRetainCount || cappedCount >= maxCapped) break;
      if (cand.rating < 87 && strategy !== "core_retention") break;
      if (cand.rating < 83) break; // Don't retain mediocre capped players at 18/14 Cr!
      if (cand.isOverseas && overseasCount >= 8) continue;

      const cost = cand.officialPrice || (cappedCount === 0 || cappedCount === 3 ? 180000000 : cappedCount === 1 || cappedCount === 4 ? 140000000 : 110000000);
      if (totalPurse - (currentDeduction + cost) < minReserve) break;

      selected.push(cand);
      cappedCount++;
      if (cand.isOverseas) overseasCount++;
      currentDeduction += cost;
    }

    // 2. Pick top uncapped bargains (rating >= 74 at ₹4 Cr)
    if (prioritizeUncapped) {
      for (const cand of sortedUncapped) {
        if (selected.length >= maxRetainCount || uncappedCount >= maxUncapped) break;
        if (cand.rating < 74) break;
        const cost = cand.officialPrice || 40000000;
        if (totalPurse - (currentDeduction + cost) < minReserve) break;

        selected.push(cand);
        uncappedCount++;
        if (cand.isOverseas) overseasCount++;
        currentDeduction += cost;
      }
    }

    // 3. If core_retention and slots remain, fill with high quality capped (rating >= 84)
    if (strategy === "core_retention") {
      for (const cand of sortedCapped) {
        if (selected.length >= maxRetainCount || cappedCount >= maxCapped) break;
        if (selected.some((s) => s.id === cand.id)) continue;
        if (cand.rating < 84) break;
        if (cand.isOverseas && overseasCount >= 8) continue;

        const cost = cand.officialPrice || (cappedCount === 0 || cappedCount === 3 ? 180000000 : cappedCount === 1 || cappedCount === 4 ? 140000000 : 110000000);
        if (totalPurse - (currentDeduction + cost) < minReserve) break;

        selected.push(cand);
        cappedCount++;
        if (cand.isOverseas) overseasCount++;
        currentDeduction += cost;
      }
    }

    return selected;
  }
}
