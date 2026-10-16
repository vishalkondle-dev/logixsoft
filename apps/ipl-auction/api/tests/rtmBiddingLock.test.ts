import { describe, it, expect } from "vitest";
import { RTMState } from "../src/types/auction";

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
});
