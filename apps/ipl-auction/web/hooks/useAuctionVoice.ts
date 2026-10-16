"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuctionStore } from "../stores/auctionStore";

/**
 * Intelligent voice selector prioritizing smooth, articulate, natural voices
 * (such as Google UK/US, Apple Samantha/Daniel/Serena, Microsoft Online, and natural en-IN/en-GB)
 */
function pickSmoothestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // 1. High-tier natural / neural voices known for smoothness
  const preferredVoiceNames = [
    "Google UK English Female",
    "Google UK English Male",
    "Google US English",
    "Samantha",
    "Daniel",
    "Serena",
    "Karen",
    "Moira",
    "Tessa",
    "Microsoft Libby Online",
    "Microsoft Sonia Online",
    "Microsoft Ryan Online",
    "Microsoft Jenny Online",
    "Microsoft Guy Online",
    "Microsoft Aria Online",
    "Neerja",
    "Prabhat",
    "Rishi",
    "Raveena",
  ];

  for (const preferred of preferredVoiceNames) {
    const match = voices.find(
      (v) => v.name.toLowerCase().includes(preferred.toLowerCase())
    );
    if (match) return match;
  }

  // 2. Any voice explicitly tagged 'Natural' or 'Neural'
  const neuralMatch = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.toLowerCase().includes("natural") ||
        v.name.toLowerCase().includes("neural") ||
        v.name.toLowerCase().includes("premium"))
  );
  if (neuralMatch) return neuralMatch;

  // 3. Indian English voices (authentic IPL cricket commentary)
  const enIn = voices.find((v) => v.lang.replace(/_/g, "-").toLowerCase().startsWith("en-in"));
  if (enIn) return enIn;

  // 4. British English voices (crisp, articulate broadcast tone)
  const enGb = voices.find((v) => v.lang.replace(/_/g, "-").toLowerCase().startsWith("en-gb"));
  if (enGb) return enGb;

  // 5. Any English voice
  const anyEnglish = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  if (anyEnglish) return anyEnglish;

  return voices[0] || null;
}

export function useAuctionVoice() {
  const { lastVoiceAnnouncement, voiceEnabled, voiceVolume } = useAuctionStore();
  const currentSequenceRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Cache voices and handle asynchronous voice loading in browsers
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        setAvailableVoices(v);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!voiceEnabled || !lastVoiceAnnouncement) return;

    // Validate monotonic sequence (discard stale announcements)
    if (lastVoiceAnnouncement.sequence <= currentSequenceRef.current) {
      return;
    }

    currentSequenceRef.current = lastVoiceAnnouncement.sequence;

    // 1. Abort any previous pending synthesis or audio fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // 2. Cancel currently playing speech immediately
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(lastVoiceAnnouncement.text);
      utterance.volume = Math.max(0, Math.min(1, voiceVolume));
      utterance.rate = 1.0; // Calm, smooth, natural delivery
      utterance.pitch = 1.02; // Warm clarity

      // Select smoothest, most natural voice available
      const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
      const bestVoice = pickSmoothestVoice(voices);
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      if (lastVoiceAnnouncement.text.toLowerCase().includes("sold to")) {
        setTimeout(() => {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.speak(utterance);
          }
        }, 260);
      } else {
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [lastVoiceAnnouncement, voiceEnabled, voiceVolume, availableVoices]);

  const muteVoice = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { muteVoice };
}
