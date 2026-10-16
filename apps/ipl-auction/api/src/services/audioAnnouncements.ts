import { VoiceAnnouncementPayload } from "../types/auction";

export function formatRupeesForSpeech(amount: number): string {
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    const formatted = parseFloat(cr.toFixed(2));
    return `${formatted} Crore rupees`;
  }
  if (amount >= 100000) {
    const lk = amount / 100000;
    const formatted = parseFloat(lk.toFixed(2));
    return `${formatted} Lakh rupees`;
  }
  return `${amount} rupees`;
}

export class AudioAnnouncementService {
  private static sequenceCounter = 0;

  static getNextSequence(): number {
    return ++this.sequenceCounter;
  }

  static createLotStartAnnouncement(lotNumber: number, playerName: string, country: string, role: string, basePrice: number): VoiceAnnouncementPayload {
    const formattedPrice = formatRupeesForSpeech(basePrice);
    const friendlyRole = role.replace(/_/g, " ").toLowerCase();
    const text = `Lot ${lotNumber}. ${playerName} from ${country}. Playing role: ${friendlyRole}. Base price is ${formattedPrice}. Opening for bids.`;

    return {
      sequence: this.getNextSequence(),
      timestamp: Date.now(),
      eventType: "PLAYER_ANNOUNCED",
      text,
      playerName,
      amount: basePrice,
    };
  }

  static createBidAnnouncement(amount: number, franchiseName: string, playerName?: string): VoiceAnnouncementPayload {
    const formattedPrice = formatRupeesForSpeech(amount);
    const text = `${formattedPrice} from ${franchiseName}!`;

    return {
      sequence: this.getNextSequence(),
      timestamp: Date.now(),
      eventType: "NEW_BID",
      text,
      amount,
      franchiseName,
      playerName,
    };
  }

  static createSoldAnnouncement(playerName: string, franchiseName: string, amount: number): VoiceAnnouncementPayload {
    const formattedPrice = formatRupeesForSpeech(amount);
    const text = `Sold! ${playerName} sold to ${franchiseName} for ${formattedPrice}!`;

    return {
      sequence: this.getNextSequence(),
      timestamp: Date.now(),
      eventType: "SOLD",
      text,
      playerName,
      franchiseName,
      amount,
    };
  }

  static createUnsoldAnnouncement(playerName: string): VoiceAnnouncementPayload {
    const text = `No bids. ${playerName} is unsold.`;

    return {
      sequence: this.getNextSequence(),
      timestamp: Date.now(),
      eventType: "UNSOLD",
      text,
      playerName,
    };
  }

  static createPauseAnnouncement(reason: string): VoiceAnnouncementPayload {
    const text = `Auction is paused. ${reason === "NO_HUMANS_CONNECTED" ? "Waiting for participants to connect." : ""}`;
    return {
      sequence: this.getNextSequence(),
      timestamp: Date.now(),
      eventType: "PAUSED",
      text,
    };
  }

  static createResumeAnnouncement(): VoiceAnnouncementPayload {
    return {
      sequence: this.getNextSequence(),
      timestamp: Date.now(),
      eventType: "RESUMED",
      text: "Auction resumed. Countdown is live.",
    };
  }

  static createRtmPromptAnnouncement(franchiseName: string, playerName: string, amount: number): VoiceAnnouncementPayload {
    const formattedPrice = formatRupeesForSpeech(amount);
    return {
      sequence: this.getNextSequence(),
      timestamp: Date.now(),
      eventType: "NEW_BID",
      text: `${franchiseName} has the Right to Match for ${playerName} at ${formattedPrice}!`,
      playerName,
      franchiseName,
      amount,
    };
  }

  static createRtmExercisedAnnouncement(franchiseName: string, playerName: string, amount: number): VoiceAnnouncementPayload {
    const formattedPrice = formatRupeesForSpeech(amount);
    return {
      sequence: this.getNextSequence(),
      timestamp: Date.now(),
      eventType: "SOLD",
      text: `${franchiseName} exercised Right to Match! ${playerName} retained for ${formattedPrice}!`,
      playerName,
      franchiseName,
      amount,
    };
  }

  static createRtmDeclinedAnnouncement(formerFranchiseName: string, winningFranchiseName: string, playerName: string): VoiceAnnouncementPayload {
    return {
      sequence: this.getNextSequence(),
      timestamp: Date.now(),
      eventType: "SOLD",
      text: `${formerFranchiseName} declined Right to Match. ${playerName} sold to ${winningFranchiseName}!`,
      playerName,
      franchiseName: winningFranchiseName,
    };
  }
}
