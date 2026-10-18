"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuctionStore } from "../stores/auctionStore";
import { unlockAudio, playHammerSound } from "../lib/auctionSound";

// CRITICAL FIX: Retain active utterance references globally to prevent JavaScript Garbage Collection
// from prematurely killing speech in Chromium and WebKit (iOS/Safari/Chrome bug)
const activeUtterances = new Set<SpeechSynthesisUtterance>();

/**
 * Intelligent voice selector prioritizing smooth, articulate, natural voices
 * (such as Google UK/US, Apple Samantha/Daniel/Serena, Microsoft Online, and natural en-IN/en-GB)
 */
function pickSmoothestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // Filter for local voices when available to ensure reliable, zero-latency playback
  // without relying on remote network connections (prevents Chrome/Android silent network drops)
  const localVoices = voices.filter((v) => v.localService);
  const pool = localVoices.length > 0 ? localVoices : voices;

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
    const match = pool.find(
      (v) => v.name.toLowerCase().includes(preferred.toLowerCase())
    );
    if (match) return match;
  }

  // 2. Any voice explicitly tagged 'Natural', 'Neural', or 'Premium'
  const neuralMatch = pool.find(
    (v) =>
      v.lang.toLowerCase().startsWith("en") &&
      (v.name.toLowerCase().includes("natural") ||
        v.name.toLowerCase().includes("neural") ||
        v.name.toLowerCase().includes("premium"))
  );
  if (neuralMatch) return neuralMatch;

  // 3. Indian English voices (authentic IPL cricket commentary)
  const enIn = pool.find((v) => v.lang.replace(/_/g, "-").toLowerCase().startsWith("en-in"));
  if (enIn) return enIn;

  // 4. British English voices (crisp, articulate broadcast tone)
  const enGb = pool.find((v) => v.lang.replace(/_/g, "-").toLowerCase().startsWith("en-gb"));
  if (enGb) return enGb;

  // 5. Any English voice
  const anyEnglish = pool.find((v) => v.lang.toLowerCase().startsWith("en"));
  if (anyEnglish) return anyEnglish;

  return pool[0] || voices[0] || null;
}

export function useAuctionVoice() {
  const { lastVoiceAnnouncement, voiceEnabled, voiceVolume } = useAuctionStore();
  const currentSequenceRef = useRef<number>(0);
  const speakTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Cache voices and handle asynchronous voice loading across various browser engines
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      try {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          setAvailableVoices(v);
        }
      } catch {
        // Safe ignore
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Mobile fallback: Many Android and iOS devices do not trigger onvoiceschanged reliably
    const t1 = setTimeout(loadVoices, 250);
    const t2 = setTimeout(loadVoices, 800);
    const t3 = setTimeout(loadVoices, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
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

    let textToSpeak = lastVoiceAnnouncement.text;
    if (!textToSpeak || textToSpeak.trim().length === 0) return;

    const isSoldAnnouncement =
      textToSpeak.toLowerCase().includes("sold to") ||
      textToSpeak.toLowerCase().includes("sold!");

    // If announcement text includes the "Going once... Going twice... SOLD!" chant,
    // strip the chant prefix for SpeechSynthesis because the high-fidelity preloaded audio
    // engine in AuctionWorkspace already plays the chant and gavel strike in real-time!
    if (textToSpeak.startsWith("Going once... Going twice... SOLD!")) {
      textToSpeak = textToSpeak.replace("Going once... Going twice... SOLD!", "").trim();
    }

    const delayMs = isSoldAnnouncement ? 1200 : 60;

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }

    // 1. Cancel currently playing speech and resume paused state (iOS/Android unlock)
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // Safe ignore
    }

    speakTimeoutRef.current = setTimeout(() => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      try {
        // Unlock engine if paused
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.volume = Math.max(0, Math.min(1, voiceVolume));
        utterance.rate = 1.0; // Calm, broadcast delivery
        utterance.pitch = 1.02; // Warm clarity

        // Voice and language assignment
        const allVoices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
        const bestVoice = pickSmoothestVoice(allVoices);
        if (bestVoice) {
          utterance.voice = bestVoice;
          utterance.lang = bestVoice.lang || "en-US";
        } else {
          // Mandatory for Android / Samsung TTS to prevent silent dropped synthesis
          utterance.lang = "en-US";
        }

        // Prevent GC bug: register in persistent Set
        activeUtterances.add(utterance);

        let cleanupTimer: NodeJS.Timeout | null = null;
        let hammerFired = false;
        const triggerHammerAtSold = () => {
          if (!hammerFired) {
            hammerFired = true;
            playHammerSound();
          }
        };

        const cleanup = () => {
          activeUtterances.delete(utterance);
          if (cleanupTimer) {
            clearTimeout(cleanupTimer);
            cleanupTimer = null;
          }
        };

        utterance.onend = cleanup;
        utterance.onerror = () => {
          cleanup();
          if (isSoldAnnouncement) {
            triggerHammerAtSold();
          }
          // Resume if interrupted
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        };

        // Gavel strike timing:
        // When speech includes "Going once... Going twice... SOLD!", synchronize the hammer strike
        // right when "SOLD" is spoken using word boundary detection or reliable 1.55s fallback timer.
        if (textToSpeak.includes("Going once... Going twice... SOLD!")) {
          utterance.onboundary = (e: SpeechSynthesisEvent) => {
            if (e.name === "word") {
              const charIndex = e.charIndex;
              const word = textToSpeak.substring(charIndex, charIndex + 4).toUpperCase();
              if (word === "SOLD" || charIndex >= 28) {
                triggerHammerAtSold();
              }
            }
          };

          const fallbackTimer = setTimeout(triggerHammerAtSold, 1550);
          utterance.addEventListener("end", () => clearTimeout(fallbackTimer));
          utterance.addEventListener("error", () => {
            clearTimeout(fallbackTimer);
            triggerHammerAtSold();
          });
        } else if (isSoldAnnouncement) {
          // Immediate strike for other sold formats
          triggerHammerAtSold();
        }

        // Safety watchdog: Safari sometimes drops onend events
        cleanupTimer = setTimeout(cleanup, 12000);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("[useAuctionVoice] speak error:", err);
        if (isSoldAnnouncement) {
          playHammerSound();
        }
      }
    }, delayMs);

    return () => {
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
    };
  }, [lastVoiceAnnouncement, voiceEnabled, voiceVolume, availableVoices]);

  const muteVoice = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }, []);

  const enableAndUnlock = useCallback(() => {
    unlockAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
  }, []);

  return { muteVoice, enableAndUnlock };
}
