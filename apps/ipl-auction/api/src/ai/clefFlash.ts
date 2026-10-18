import { FranchiseState, AuctionLot } from "../types/auction";
import { AIDecisionResult, FallbackAIEngine } from "./fallbackEngine";
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
  source: "LAYA_LLM" | "CLEF_FLASH" | "DETERMINISTIC_ENGINE";
}

function extractJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export class ClefFlashService {
  /**
   * Invokes "Laya" (Meta LLaMA 3.1 8B Instruct on Cloudflare Workers AI) to make an informed,
   * comprehensive RTM decision based on complete player details, squad composition, role deficits,
   * remaining purse, and the exact winning bid to match.
   *
   * If Workers AI is unavailable or times out, gracefully falls back to evaluateDeterministicRTM.
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

    // 1. If Cloudflare Workers AI is available, ask Laya (LLaMA)
    if (env.AI && typeof env.AI.run === "function") {
      try {
        const systemPrompt = `You are "Laya", the Lead IPL Auction Strategist and Chief Decision Engine for franchise ${formerTeam.name} (${formerTeam.code}).
You must decide whether to EXERCISE the Right to Match (RTM) card or DECLINE it for your former player.

CRITICAL INSTRUCTIONS:
- You must NOT blindly exercise RTM for every former player.
- DECLINE if the winning bid of ₹${rtmValue.finalBid.toLocaleString("en-IN")} is significantly above your realistic valuation of ₹${formerTeam.fairValuationCeiling.toLocaleString("en-IN")} (overpriced/inflated bid).
- DECLINE if your franchise already has strong depth in this role (${player.role}) and needs funds for deficient roles (${formerTeam.neededRoles.join(", ") || "none"}).
- DECLINE if matching starves your budget, leaving inadequate funds (only ₹${Math.round(formerTeam.budgetPerRemainingSlotAfterMatch).toLocaleString("en-IN")} per spot) to complete the required ${formerTeam.minSquad} squad members.
- DECLINE if overseas quota is constrained (${formerTeam.overseasCount}/${formerTeam.maxOverseas}) and the player is not a top-tier marquee player.
- EXERCISE only if the player represents genuine tactical value, fills a crucial team need, and fits comfortably within your remaining budget.

Respond ONLY with a valid JSON object in this format:
{"exercise": boolean, "confidence": number, "reason": "concise explanation"}`;

        const userPrompt = `PLAYER PROFILE:
- Name: ${player.name}
- Role: ${player.role} (${player.isOverseas ? "Overseas" : "Indian"}, ${player.isCapped ? "Capped" : "Uncapped"})
- Base Price: ₹${player.basePrice.toLocaleString("en-IN")} | Hidden Quality Rating: ${player.rating}/100
- Career Stats: ${player.matches} Matches, ${player.runs} Runs (Avg ${player.battingAverage}, SR ${player.strikeRate}), ${player.wickets} Wkts (Econ ${player.economy})

RTM SITUATION:
- Winning Bid (Match Price): ₹${rtmValue.finalBid.toLocaleString("en-IN")} (won by ${rtmValue.highestBidderCode})
- RTM Cards Remaining: ${formerTeam.rtmCardsRemaining}

FRANCHISE SQUAD & PURSE CONTEXT:
- Total Purse: ₹${formerTeam.totalPurse.toLocaleString("en-IN")}
- Current Remaining Purse: ₹${formerTeam.remainingPurse.toLocaleString("en-IN")}
- Purse Left If You Match: ₹${formerTeam.purseAfterMatch.toLocaleString("en-IN")}
- Squad Count: ${formerTeam.squadCount}/${formerTeam.maxSquad} (Mandatory Min: ${formerTeam.minSquad})
- Overseas Quota: ${formerTeam.overseasCount}/${formerTeam.maxOverseas}
- Current Squad Roster:
  * Batters (${formerTeam.roleCounts.BATTER}): [${formerTeam.currentSquad.batters.join(", ") || "None"}]
  * Bowlers (${formerTeam.roleCounts.BOWLER}): [${formerTeam.currentSquad.bowlers.join(", ") || "None"}]
  * All-Rounders (${formerTeam.roleCounts.ALL_ROUNDER}): [${formerTeam.currentSquad.allRounders.join(", ") || "None"}]
  * Wicketkeepers (${formerTeam.roleCounts.WICKETKEEPER}): [${formerTeam.currentSquad.wicketkeepers.join(", ") || "None"}]
- Deficient Roles Still Urgently Needed: [${formerTeam.neededRoles.join(", ") || "None"}]
- Strategic Fair Valuation Ceiling: ₹${formerTeam.fairValuationCeiling.toLocaleString("en-IN")}
- Average Budget Left Per Remaining Empty Spot: ₹${Math.round(formerTeam.budgetPerRemainingSlotAfterMatch).toLocaleString("en-IN")}

Should ${formerTeam.code} EXERCISE the RTM or DECLINE?`;

        const aiPromise = env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 180,
          temperature: 0.1,
        });

        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Laya AI timeout")), 2200)
        );

        const aiResponse: any = await Promise.race([aiPromise, timeoutPromise]);
        if (aiResponse) {
          const rawText = aiResponse.response || aiResponse.text || JSON.stringify(aiResponse);
          const parsed = extractJson(rawText);
          if (parsed && typeof parsed.exercise === "boolean") {
            return {
              exercise: parsed.exercise,
              confidence: parsed.confidence || 0.85,
              reason: parsed.reason || (parsed.exercise ? `Laya recommended matching ₹${rtmValue.finalBid.toLocaleString("en-IN")}.` : `Laya recommended declining to preserve purse and squad balance.`),
              source: "LAYA_LLM",
            };
          }
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

      const val = calculateDetailedValuation(lot, team, difficulty, lotsRemaining, totalLots, teams);
      if (val.isDesirable && val.ceiling >= nextLegalBid) {
        eligibleTeams.push({ code, team, ceiling: val.ceiling });
      }
    }

    if (eligibleTeams.length === 0) {
      return {
        shouldBid: false,
        reason: "No AI franchise has legal capacity or budget ceiling to bid.",
      };
    }

    // 2. If Cloudflare Workers AI is available, run Laya / Clef-Flash
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
          eligibleFranchises: eligibleTeams.map((e) => {
            const inRole = (e.team.purchasedPlayers || []).filter((p) => p.role === lot.role).length;
            const spotsLeft = Math.max(1, e.team.maxSquad - e.team.squadCount);
            return {
              code: e.code,
              purse: e.team.remainingPurse,
              pursePerSlot: Math.round(e.team.remainingPurse / spotsLeft),
              squad: e.team.squadCount,
              inRoleCount: inRole,
              overseas: e.team.overseasCount,
              valuationCeiling: e.ceiling,
            };
          }),
        };

        const criteria: Record<string, string> = {};
        for (const e of eligibleTeams) {
          const inRole = (e.team.purchasedPlayers || []).filter((p) => p.role === lot.role).length;
          criteria[e.code] = `Franchise ${e.code} with ₹${(e.team.remainingPurse / 10000000).toFixed(2)} Cr purse, ${inRole} current ${lot.role}s, valuation ceiling ₹${(e.ceiling / 10000000).toFixed(2)} Cr`;
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
                instructions: "Which eligible AI franchise has the strongest squad fit and financial reason to bid?",
                criteria,
              },
            },
          }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("AI bidding timeout")), 2000)
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
              reason: `Laya AI selected ${chosenBidder} (probability: ${modelResult?.questions?.bidder?.confidence || "high"}).`,
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
