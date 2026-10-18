import { FranchiseState, AuctionLot } from "../types/auction";
import {
  AIDecisionResult,
  FallbackAIEngine,
  FranchiseRetentionCandidate,
  FranchiseRetentionDecisionContext,
  FranchiseRetentionDecisionResult,
} from "./fallbackEngine";
import { calculatePlayerValuation, calculateDetailedValuation } from "./valuation";
import { evaluateRosterBalance } from "../services/rosterBalanceService";

export interface ClefFlashEnv {
  AI?: {
    run: (model: string, input: any) => Promise<any>;
  };
}

export interface RTMDecisionContext {
  player: {
    name: string;
    role: string;
    country: string;
    isOverseas: boolean;
    isCapped: boolean;
    battingStyle?: string;
    bowlingStyle?: string;
    matches: number;
    runs: number;
    battingAverage: number;
    strikeRate: number;
    wickets: number;
    economy: number;
    rating: number;
    basePrice: number;
  };
  rtmValue: {
    finalBid: number;
    highestBidderCode: string;
  };
  formerTeam: {
    code: string;
    name: string;
    totalPurse: number;
    remainingPurse: number;
    purseAfterMatch: number;
    squadCount: number;
    minSquad: number;
    maxSquad: number;
    overseasCount: number;
    maxOverseas: number;
    rtmCardsRemaining: number;
    currentSquad: {
      batters: string[];
      bowlers: string[];
      allRounders: string[];
      wicketkeepers: string[];
    };
    roleCounts: {
      BATTER: number;
      BOWLER: number;
      ALL_ROUNDER: number;
      WICKETKEEPER: number;
    };
    neededRoles: string[];
    fairValuationCeiling: number;
    budgetPerRemainingSlotAfterMatch: number;
  };
  difficulty?: "easy" | "normal" | "hard";
  lotsRemaining?: number;
  totalLots?: number;
}

export interface RTMDecisionResult {
  exercise: boolean;
  confidence?: number;
  reason: string;
  source: "CLEF_FLASH" | "DETERMINISTIC_ENGINE";
}

export class ClefFlashService {
  /**
   * Invokes Cloudflare Clef-Flash (@cf/cloudflare/clef-flash) typed decision engine
   * to evaluate Right to Match (RTM) card exercise with complete cricket stats,
   * roster balance, remaining purse, and financial discipline.
   *
   * Gracefully falls back to evaluateDeterministicRTM if unavailable.
   */
  static async decideRTM(
    env: ClefFlashEnv,
    context: RTMDecisionContext
  ): Promise<RTMDecisionResult> {
    const { player, rtmValue, formerTeam } = context;

    // Hard Solvency Pre-check: Never allow RTM if it violates minimum squad reserve
    const spotsRemaining = Math.max(0, formerTeam.minSquad - (formerTeam.squadCount + 1));
    const minReserveNeeded = spotsRemaining * 3000000;
    if (formerTeam.remainingPurse - rtmValue.finalBid < minReserveNeeded) {
      return {
        exercise: false,
        reason: `Declined RTM: Matching ₹${rtmValue.finalBid.toLocaleString("en-IN")} would breach mandatory reserve of ₹${(minReserveNeeded / 100000).toFixed(0)} Lakhs for remaining squad spots.`,
        source: "DETERMINISTIC_ENGINE",
      };
    }

    // 1. If Cloudflare Workers AI is available, ask Clef-Flash typed decision engine
    if (env.AI && typeof env.AI.run === "function") {
      try {
        const compactRTMState = {
          formerFranchise: formerTeam.code,
          player: {
            name: player.name,
            role: player.role,
            isOverseas: player.isOverseas,
            isCapped: player.isCapped,
            rating: player.rating,
            matches: player.matches,
            runs: player.runs,
            battingAverage: player.battingAverage,
            strikeRate: player.strikeRate,
            wickets: player.wickets,
            economy: player.economy,
            basePrice: player.basePrice,
          },
          winningBid: rtmValue.finalBid,
          winningBidder: rtmValue.highestBidderCode,
          fairCeiling: formerTeam.fairValuationCeiling,
          remainingPurse: formerTeam.remainingPurse,
          purseAfterMatch: formerTeam.purseAfterMatch,
          budgetPerSpotAfterMatch: Math.round(formerTeam.budgetPerRemainingSlotAfterMatch),
          squadCount: formerTeam.squadCount,
          minSquad: formerTeam.minSquad,
          maxSquad: formerTeam.maxSquad,
          overseasCount: formerTeam.overseasCount,
          maxOverseas: formerTeam.maxOverseas,
          roleCounts: formerTeam.roleCounts,
          neededRoles: formerTeam.neededRoles,
        };

        const modelResult = await Promise.race([
          env.AI.run("@cf/cloudflare/clef-flash", {
            model: "clef-flash",
            state: JSON.stringify(compactRTMState),
            questions: {
              exercise_rtm: {
                type: "bool",
                instructions: `Should former franchise ${formerTeam.code} match winning bid ₹${rtmValue.finalBid.toLocaleString("en-IN")} to retain ${player.name} (${player.role}, SR: ${player.strikeRate}, Econ: ${player.economy})? Answer 'no' if the price exceeds fair value of ₹${formerTeam.fairValuationCeiling.toLocaleString("en-IN")} or harms squad balance.`,
              },
              strategic_reason: {
                type: "choice",
                instructions: "Select the most accurate reason for this decision:",
                criteria: {
                  tactical_fit_fair_price: `Retain ${player.name}: critical squad need at acceptable market value`,
                  overpriced_bid: `Decline RTM: ₹${(rtmValue.finalBid / 10000000).toFixed(2)} Cr exceeds strategic valuation ceiling of ₹${(formerTeam.fairValuationCeiling / 10000000).toFixed(2)} Cr`,
                  budget_preservation: `Decline RTM: preserve remaining purse to fill remaining ${Math.max(1, formerTeam.minSquad - formerTeam.squadCount)} squad spots`,
                  role_depth_sufficient: `Decline RTM: franchise already has adequate depth in ${player.role}`,
                },
              },
            },
          }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Clef-Flash RTM timeout")), 2200)
          ),
        ]);

        if (modelResult) {
          const exerciseValue = modelResult?.questions?.exercise_rtm?.answer ?? modelResult?.exercise_rtm;
          const choiceReason = modelResult?.questions?.strategic_reason?.answer ?? modelResult?.strategic_reason;
          const exercise = exerciseValue === "yes" || exerciseValue === true || exerciseValue === "true";
          const confidence = modelResult?.questions?.exercise_rtm?.confidence || 0.90;

          let reasonText = "";
          if (exercise) {
            reasonText = `Clef-Flash exercised RTM: Matched ₹${rtmValue.finalBid.toLocaleString("en-IN")} for ${player.name} based on tactical squad need.`;
          } else {
            if (choiceReason === "overpriced_bid") {
              reasonText = `Clef-Flash declined RTM: Winning bid ₹${rtmValue.finalBid.toLocaleString("en-IN")} exceeds strategic valuation ceiling.`;
            } else if (choiceReason === "budget_preservation") {
              reasonText = `Clef-Flash declined RTM: Preserving purse to complete remaining squad spots.`;
            } else if (choiceReason === "role_depth_sufficient") {
              reasonText = `Clef-Flash declined RTM: Adequate depth in ${player.role} already secured.`;
            } else {
              reasonText = `Clef-Flash declined RTM: Passing on ₹${rtmValue.finalBid.toLocaleString("en-IN")} to preserve purse balance.`;
            }
          }

          return {
            exercise,
            confidence,
            reason: reasonText,
            source: "CLEF_FLASH",
          };
        }
      } catch (aiErr) {
        // Fall through to deterministic fallback
      }
    }

    // 2. Deterministic squad-aware fallback
    return this.evaluateDeterministicRTM(context);
  }

  /**
   * Deterministic squad-aware evaluation for RTM decisions.
   * Assesses role depth, squad saturation, valuation ceiling, and remaining budget per spot.
   */
  static evaluateDeterministicRTM(context: RTMDecisionContext): RTMDecisionResult {
    const { player, rtmValue, formerTeam } = context;

    // 1. Mandatory Solvency Gate: Reserve ₹30L per unfilled spot
    const spotsRemaining = Math.max(0, formerTeam.minSquad - (formerTeam.squadCount + 1));
    const minReserveNeeded = spotsRemaining * 3000000;
    if (formerTeam.remainingPurse - rtmValue.finalBid < minReserveNeeded) {
      return {
        exercise: false,
        reason: `Declined RTM: Matching ₹${rtmValue.finalBid.toLocaleString("en-IN")} would breach mandatory reserve of ₹${(minReserveNeeded / 100000).toFixed(0)} Lakhs for remaining squad spots.`,
        source: "DETERMINISTIC_ENGINE",
      };
    }

    // 2. Strict Role Overcrowding Check
    if (player.role === "WICKETKEEPER" && formerTeam.roleCounts.WICKETKEEPER >= 2) {
      return {
        exercise: false,
        reason: `Declined RTM: Franchise already has ${formerTeam.roleCounts.WICKETKEEPER} wicketkeepers in squad.`,
        source: "DETERMINISTIC_ENGINE",
      };
    }
    if (player.role === "BATTER" && formerTeam.roleCounts.BATTER >= 7 && player.rating < 86) {
      return {
        exercise: false,
        reason: `Declined RTM: Batting department has adequate depth (${formerTeam.roleCounts.BATTER} batters).`,
        source: "DETERMINISTIC_ENGINE",
      };
    }
    if (player.role === "BOWLER" && formerTeam.roleCounts.BOWLER >= 8 && player.rating < 86) {
      return {
        exercise: false,
        reason: `Declined RTM: Bowling quota well-filled (${formerTeam.roleCounts.BOWLER} bowlers).`,
        source: "DETERMINISTIC_ENGINE",
      };
    }
    if (player.role === "ALL_ROUNDER" && formerTeam.roleCounts.ALL_ROUNDER >= 6 && player.rating < 86) {
      return {
        exercise: false,
        reason: `Declined RTM: Roster already has ${formerTeam.roleCounts.ALL_ROUNDER} all-rounders.`,
        source: "DETERMINISTIC_ENGINE",
      };
    }

    // 3. Overseas Quota Discipline
    if (player.isOverseas) {
      if (formerTeam.overseasCount >= formerTeam.maxOverseas) {
        return {
          exercise: false,
          reason: `Declined RTM: Overseas quota full (${formerTeam.maxOverseas} players).`,
          source: "DETERMINISTIC_ENGINE",
        };
      }
      if (formerTeam.overseasCount >= 7 && player.rating < 84) {
        return {
          exercise: false,
          reason: `Declined RTM: Final overseas slot reserved for elite marquee players.`,
          source: "DETERMINISTIC_ENGINE",
        };
      }
    }

    // 4. Valuation Ceiling vs Bid Price
    const ceiling = formerTeam.fairValuationCeiling;
    const needsThisRole = formerTeam.neededRoles.includes(player.role);
    // Loyalty tolerance: +10% if deficient in role, +3% if normal
    const loyaltyMultiplier = needsThisRole ? 1.10 : 1.03;
    const maxWillingPrice = Math.round(ceiling * loyaltyMultiplier);

    if (rtmValue.finalBid > maxWillingPrice) {
      return {
        exercise: false,
        reason: `Declined RTM: Winning bid ₹${rtmValue.finalBid.toLocaleString("en-IN")} exceeds strategic valuation ceiling of ₹${maxWillingPrice.toLocaleString("en-IN")}.`,
        source: "DETERMINISTIC_ENGINE",
      };
    }

    // 5. Budget Health: Ensure healthy funds for remaining slots
    if (spotsRemaining > 2 && formerTeam.budgetPerRemainingSlotAfterMatch < 10000000 && player.rating < 86) {
      return {
        exercise: false,
        reason: `Declined RTM: Matching leaves only ₹${(formerTeam.budgetPerRemainingSlotAfterMatch / 100000).toFixed(0)}L per remaining spot, risking squad depth.`,
        source: "DETERMINISTIC_ENGINE",
      };
    }

    return {
      exercise: true,
      reason: `Exercised RTM: ${player.name} fits squad balance and role need at fair market value (₹${rtmValue.finalBid.toLocaleString("en-IN")}).`,
      source: "DETERMINISTIC_ENGINE",
    };
  }

  /**
   * Invokes Cloudflare Workers AI / Laya decision model for active lot bidding.
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
    const isHumanLeading = Boolean(
      lot.highestBidderFranchise &&
      teams[lot.highestBidderFranchise]?.controller === "HUMAN"
    );

    // 1. Identify eligible AI franchises
    const eligibleTeams: { code: string; team: FranchiseState; ceiling: number; scoutingTier: string }[] = [];

    for (const [code, team] of Object.entries(teams)) {
      if (team.controller !== "AI") continue;
      if (lot.highestBidderFranchise === code) continue;

      // Strict Roster balance and role reservation check
      const balanceCheck = evaluateRosterBalance(team, lot);
      if (!balanceCheck.allowed) continue;

      const spotsRemaining = Math.max(0, team.minSquad - team.squadCount - 1);
      const minReserve = spotsRemaining * 3000000;
      if (team.remainingPurse - nextLegalBid < minReserve) continue;

      const val = calculateDetailedValuation(lot, team, difficulty, lotsRemaining, totalLots, teams, isHumanLeading);
      if (val.isDesirable && val.ceiling >= nextLegalBid) {
        eligibleTeams.push({ code, team, ceiling: val.ceiling, scoutingTier: val.scoutingTier || "SECONDARY_TARGET" });
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
            country: lot.country,
            isOverseas: lot.isOverseas,
            isCapped: lot.isCapped,
            basePrice: lot.basePrice,
            lastYearPrice: lot.lastYearPrice || null,
            rating: lot.hiddenRatingOverall || 70,
            matches: lot.matches,
            runs: lot.runs,
            battingAverage: lot.battingAverage,
            strikeRate: lot.strikeRate,
            wickets: lot.wickets,
            economy: lot.economy,
            battingStyle: lot.battingStyle,
            bowlingStyle: lot.bowlingStyle,
          },
          currentBid: lot.currentBid,
          nextLegalBid,
          currentLeader: lot.highestBidderFranchise,
          isHumanLeading,
          humanLeaderName: isHumanLeading ? (teams[lot.highestBidderFranchise!]?.name || lot.highestBidderFranchise) : null,
          difficulty,
          lotsRemaining,
          totalLots,
          eligibleFranchises: eligibleTeams.map((e) => {
            const inRole = (e.team.purchasedPlayers || []).filter((p) => p.role === lot.role).length;
            const spotsLeft = Math.max(1, e.team.minSquad - e.team.squadCount);
            return {
              code: e.code,
              purse: e.team.remainingPurse,
              pursePerSlot: Math.round(e.team.remainingPurse / spotsLeft),
              squad: e.team.squadCount,
              inRoleCount: inRole,
              overseas: e.team.overseasCount,
              valuationCeiling: e.ceiling,
              scoutingTier: e.scoutingTier,
            };
          }),
        };

        const criteria: Record<string, string> = {};
        for (const e of eligibleTeams) {
          const inRole = (e.team.purchasedPlayers || []).filter((p) => p.role === lot.role).length;
          criteria[e.code] = `Franchise ${e.code} (${e.scoutingTier}): ₹${(e.team.remainingPurse / 10000000).toFixed(2)} Cr purse, ${inRole} current ${lot.role}s, valuation ceiling ₹${(e.ceiling / 10000000).toFixed(2)} Cr`;
        }

        const modelResult = await Promise.race([
          env.AI.run("@cf/cloudflare/clef-flash", {
            model: "clef-flash",
            state: JSON.stringify(compactState),
            questions: {
              should_bid: {
                type: "bool",
                instructions: isHumanLeading
                  ? `Human user (${teams[lot.highestBidderFranchise!]?.name || "Human User"}) currently holds the highest bid of ₹${lot.currentBid.toLocaleString("en-IN")} for ${lot.playerName}. Should an eligible AI franchise challenge the human with the next legal bid of ₹${nextLegalBid.toLocaleString("en-IN")}? Answer 'yes' if any AI team has budget headroom and targets this player.`
                  : `Should an eligible AI franchise place the next legal bid of ₹${nextLegalBid.toLocaleString("en-IN")} for ${lot.playerName} (${lot.role}, SR: ${lot.strikeRate}, Econ: ${lot.economy}, Base: ₹${lot.basePrice.toLocaleString("en-IN")})? Answer 'no' if the player has poor stats, is overpriced, or not needed.`,
              },
              bidder: {
                type: "choice",
                instructions: isHumanLeading
                  ? `Which eligible AI franchise should contest the human leader for ${lot.playerName}? Prioritize franchises with CORE_TARGET or SECONDARY_TARGET priority.`
                  : "Which eligible AI franchise has the strongest squad fit and financial reason to bid?",
                criteria,
              },
              valuation_assessment: {
                type: "choice",
                instructions: "Is this player good value or overpriced at this price point?",
                criteria: {
                  fair_value: "Bid is fair market value given player statistics and squad need",
                  overpriced: "Player statistics do not justify placing this bid amount",
                },
              },
            },
          }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Clef-Flash bidding timeout")), 2000)
          ),
        ]);

        if (modelResult) {
          // Parse typed output
          const shouldBidValue = modelResult?.questions?.should_bid?.answer ?? modelResult?.should_bid;
          const chosenBidder = modelResult?.questions?.bidder?.answer ?? modelResult?.bidder;
          const valuationCheck = modelResult?.questions?.valuation_assessment?.answer ?? modelResult?.valuation_assessment;

          const wantsToBid = shouldBidValue === "yes" || shouldBidValue === true || shouldBidValue === "true";
          const isOverpriced = valuationCheck === "overpriced";

          if (wantsToBid && !isOverpriced && chosenBidder && eligibleTeams.some((e) => e.code === chosenBidder)) {
            const matched = eligibleTeams.find((e) => e.code === chosenBidder)!;
            return {
              shouldBid: true,
              bidderFranchiseCode: chosenBidder,
              valuationCeiling: matched.ceiling,
              reason: `Clef-Flash selected ${chosenBidder} (probability: ${modelResult?.questions?.bidder?.confidence || "high"}).`,
            };
          } else if (isOverpriced || !wantsToBid) {
            return {
              shouldBid: false,
              reason: `Clef-Flash determined ${lot.playerName} is overpriced at ₹${nextLegalBid.toLocaleString("en-IN")}.`,
            };
          }
        }
      } catch (aiErr) {
        // Fall through to deterministic fallback
      }
    }

    // 3. Deterministic rule-based fallback
    return FallbackAIEngine.evaluateBidding(lot, teams, nextLegalBid, difficulty, lotsRemaining, totalLots, isHumanLeading);
  }

  /**
   * Invokes Cloudflare Clef-Flash (@cf/cloudflare/clef-flash) typed decision engine
   * to evaluate AI franchise retentions from their last year squad candidates.
   * Considers cricket statistics, capped/uncapped rules, retention cost slabs (18Cr, 14Cr, etc.),
   * and trade-off between retaining players vs keeping Right-To-Match (RTM) cards or clean slate.
   *
   * Gracefully falls back to FallbackAIEngine.evaluateFranchiseRetentions.
   */
  static async decideFranchiseRetentions(
    env: ClefFlashEnv,
    context: FranchiseRetentionDecisionContext
  ): Promise<FranchiseRetentionDecisionResult> {
    const { franchise, candidates, ruleset = "MEGA" } = context;

    if (!candidates || candidates.length === 0) {
      return {
        retainedIds: [],
        strategy: "clean_slate",
        reason: `${franchise.code} has no previous squad candidates. 0 retentions, 6 RTM cards available.`,
        source: "DETERMINISTIC_ENGINE",
      };
    }

    if (env.AI && typeof env.AI.run === "function") {
      try {
        const topCandidates = [...candidates]
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 8);

        const compactRetentionState = {
          franchise: franchise.code,
          franchiseName: franchise.name,
          totalPurse: franchise.totalPurse,
          ruleset,
          candidatePoolCount: candidates.length,
          topCandidates: topCandidates.map((c) => ({
            id: c.id,
            name: c.name,
            role: c.role,
            isOverseas: c.isOverseas,
            isCapped: c.isCapped,
            rating: c.rating,
            runs: c.runs,
            wickets: c.wickets,
            strikeRate: c.strikeRate,
            economy: c.economy,
            price: c.officialPrice,
          })),
        };

        const modelResult = await Promise.race([
          env.AI.run("@cf/cloudflare/clef-flash", {
            model: "clef-flash",
            state: JSON.stringify(compactRetentionState),
            questions: {
              retention_strategy: {
                type: "choice",
                instructions: `Choose the optimal retention strategy for ${franchise.name} in the IPL Mega Auction. Retaining top stars costs 18Cr, 14Cr, 11Cr, etc., reducing auction purse. Releasing players grants Right-to-Match (RTM) cards in open auction. Clean slate keeps maximum purse and 6 RTMs.`,
                criteria: {
                  core_retention: `Retain 4-6 marquee icons (accepting high purse deduction to lock down irreplaceable match-winners)`,
                  selective_retention: `Retain 1-3 critical players and uncapped bargains (preserving high purse and 3-5 RTM cards)`,
                  clean_slate: `Clean complete team with 0 retentions (maximize auction purse with 6 RTM cards to build fresh squad)`,
                },
              },
              prioritize_uncapped_value: {
                type: "bool",
                instructions: `Should ${franchise.code} prioritize retaining promising uncapped performers at the ₹4 Cr bargain rate?`,
              },
            },
          }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Clef-Flash retention decision timeout")), 2500)
          ),
        ]);

        if (modelResult) {
          const strategyChoice = modelResult?.questions?.retention_strategy?.answer ?? modelResult?.retention_strategy;
          const wantUncapped =
            modelResult?.questions?.prioritize_uncapped_value?.answer === true ||
            modelResult?.questions?.prioritize_uncapped_value?.answer === "yes" ||
            modelResult?.questions?.prioritize_uncapped_value?.answer === "true";

          const decidedStrategy: "core_retention" | "selective_retention" | "clean_slate" =
            strategyChoice === "clean_slate"
              ? "clean_slate"
              : strategyChoice === "selective_retention"
              ? "selective_retention"
              : "core_retention";

          if (decidedStrategy === "clean_slate") {
            return {
              retainedIds: [],
              strategy: "clean_slate",
              reason: `Clef-Flash selected clean slate strategy for ${franchise.code}: 0 retentions, 6 RTM cards, 100% auction purse available.`,
              source: "CLEF_FLASH",
            };
          }

          const selected = FallbackAIEngine.selectCandidatesForStrategy(
            candidates,
            decidedStrategy,
            wantUncapped,
            franchise.totalPurse,
            ruleset
          );

          return {
            retainedIds: selected.map((s) => s.id),
            strategy: decidedStrategy,
            reason: `Clef-Flash selected ${decidedStrategy} for ${franchise.code}: retained ${selected.length} players (${selected.map((s) => s.name).join(", ")}), keeping ${Math.max(0, 6 - selected.length)} RTM cards.`,
            source: "CLEF_FLASH",
          };
        }
      } catch (err) {
        // Fall through to deterministic fallback
      }
    }

    return FallbackAIEngine.evaluateFranchiseRetentions(context);
  }
}
