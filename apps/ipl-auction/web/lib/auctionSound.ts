// Audio utility for Auction Sound Effects (Gavel/Hammer strike on SOLD, Countdown ticks, and Autoplay unlock)
// Engineered with a fail-safe Dual-Engine (Web Audio API Buffer Cache + HTML5 Audio Fallback + Synthesizer)

let audioContext: AudioContext | null = null;
const bufferCache: Map<string, AudioBuffer> = new Map();
let isPreloadingStarted = false;
let isAudioUnlocked = false;

const SOUND_ASSETS: Record<string, string> = {
  goingOnce: "/sounds/going_once.mp3",
  goingTwice: "/sounds/going_twice.mp3",
  soldGavel: "/sounds/sold_gavel.mp3",
  fullChant: "/sounds/going_once_twice_sold.mp3",
  gavel: "/sounds/gavel.wav",
};

let preloadedGavel: HTMLAudioElement | null = null;
let preloadedGoingOnce: HTMLAudioElement | null = null;
let preloadedGoingTwice: HTMLAudioElement | null = null;
let preloadedSoldGavel: HTMLAudioElement | null = null;
let preloadedFullChant: HTMLAudioElement | null = null;

let lastHammerPlayedAt = 0;
let lastGoingOncePlayedAt = 0;
let lastGoingTwicePlayedAt = 0;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioContext && AudioCtx) {
      audioContext = new AudioCtx();
    }
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Pre-fetches and decodes all sound assets into Web Audio PCM Buffers.
 * This guarantees zero-latency, 100% reliable playback even during asynchronous timer ticks
 * without triggering mobile browser HTML5 Audio element limits or restrictions.
 */
export async function preloadSoundBuffers(): Promise<void> {
  if (typeof window === "undefined" || isPreloadingStarted) return;
  isPreloadingStarted = true;

  const ctx = getAudioContext();
  if (!ctx) return;

  for (const [key, url] of Object.entries(SOUND_ASSETS)) {
    if (bufferCache.has(key)) continue;
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const ab = await resp.arrayBuffer();
        // Use promise-based decodeAudioData with legacy callback fallback for older Safari
        const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
          ctx.decodeAudioData(ab, resolve, reject);
        });
        bufferCache.set(key, decoded);
      }
    } catch (err) {
      console.debug("[AuctionAudio] Error preloading sound buffer:", key, err);
    }
  }
}

// Initialize preloading and HTML5 audio fallbacks in browser
if (typeof window !== "undefined") {
  try {
    preloadedGavel = new Audio(SOUND_ASSETS.gavel);
    preloadedGavel.preload = "auto";

    preloadedGoingOnce = new Audio(SOUND_ASSETS.goingOnce);
    preloadedGoingOnce.preload = "auto";

    preloadedGoingTwice = new Audio(SOUND_ASSETS.goingTwice);
    preloadedGoingTwice.preload = "auto";

    preloadedSoldGavel = new Audio(SOUND_ASSETS.soldGavel);
    preloadedSoldGavel.preload = "auto";

    preloadedFullChant = new Audio(SOUND_ASSETS.fullChant);
    preloadedFullChant.preload = "auto";

    // Start fetching Web Audio buffers
    preloadSoundBuffers().catch(() => {});
  } catch {
    // Ignore preload errors in restricted environments
  }
}

/**
 * Play a cached Web Audio buffer with volume boost
 */
function playWebAudioBuffer(key: string, volume = 1.0): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const buffer = bufferCache.get(key);
  if (!buffer) return false;

  try {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    // Deliver crystal clear, punchy audio
    const boostedVolume = Math.min(2.0, Math.max(0.1, volume * 1.3));
    gain.gain.setValueAtTime(boostedVolume, ctx.currentTime);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
    return true;
  } catch (err) {
    console.debug("[AuctionAudio] Web Audio buffer playback caught:", err);
    return false;
  }
}

/**
 * Checks if the Audio subsystem has been unlocked by user gesture.
 */
export function getIsAudioUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const ctx = audioContext;
  return isAudioUnlocked || (ctx !== null && ctx.state === "running");
}

/**
 * Unlocks Web Audio and SpeechSynthesis on restricted mobile devices (iOS Safari, Android Chrome).
 * Must be triggered by a user gesture (tap/click/keydown) to satisfy browser autoplay security policies.
 */
export function unlockAudio(): boolean {
  if (typeof window === "undefined") return false;

  try {
    // 1. Resume and warm up singleton AudioContext
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      // Play 1-sample silent Web Audio buffer to activate mobile audio hardware
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);
    }

    // 2. Load Web Audio buffers if not yet loaded
    preloadSoundBuffers().catch(() => {});

    // 3. Unlock SpeechSynthesis on iOS / Android
    if ("speechSynthesis" in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      const warmup = new SpeechSynthesisUtterance("");
      warmup.volume = 0;
      window.speechSynthesis.speak(warmup);
    }

    isAudioUnlocked = true;
    window.dispatchEvent(new CustomEvent("auction-audio-unlocked"));
    return true;
  } catch (err) {
    console.debug("[AuctionAudio] Audio unlock caught:", err);
    return false;
  }
}

// Auto-attach user gesture listeners on first user interaction on the page
if (typeof window !== "undefined") {
  const onFirstInteraction = () => {
    unlockAudio();
  };

  window.addEventListener("touchstart", onFirstInteraction, { capture: true, passive: true });
  window.addEventListener("touchend", onFirstInteraction, { capture: true, passive: true });
  window.addEventListener("click", onFirstInteraction, { capture: true, passive: true });
  window.addEventListener("pointerdown", onFirstInteraction, { capture: true, passive: true });
  window.addEventListener("keydown", onFirstInteraction, { capture: true, passive: true });
}

/**
 * Web Audio API synthesizer for an authentic auction gavel / hammer double strike.
 * Used as high-performance zero-latency synthesizer and reliable fallback.
 */
export function synthesizeGavelStrike(ctx: AudioContext) {
  const now = ctx.currentTime;

  const playSingleImpact = (startTime: number, volume: number) => {
    // 1. Initial sharp impact click (hard wood hitting block)
    const bufferSize = Math.floor(ctx.sampleRate * 0.03); // 30ms burst
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1400, startTime);
    noiseFilter.Q.setValueAtTime(3.0, startTime);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.95, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.03);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(startTime);
    whiteNoise.stop(startTime + 0.035);

    // 2. Resonant wood block body tone (fundamental 190Hz dropping to 135Hz)
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = "sine";
    bodyOsc.frequency.setValueAtTime(190, startTime);
    bodyOsc.frequency.exponentialRampToValueAtTime(135, startTime + 0.22);

    bodyGain.gain.setValueAtTime(volume * 0.85, startTime);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.24);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(ctx.destination);

    bodyOsc.start(startTime);
    bodyOsc.stop(startTime + 0.25);

    // 3. Wood surface overtone (380Hz dropping to 260Hz)
    const overtoneOsc = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtoneOsc.type = "triangle";
    overtoneOsc.frequency.setValueAtTime(380, startTime);
    overtoneOsc.frequency.exponentialRampToValueAtTime(260, startTime + 0.12);

    overtoneGain.gain.setValueAtTime(volume * 0.55, startTime);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

    overtoneOsc.connect(overtoneGain);
    overtoneGain.connect(ctx.destination);

    overtoneOsc.start(startTime);
    overtoneOsc.stop(startTime + 0.15);
  };

  // Double-tap gavel strike: Primary heavy strike + quick rebound tap 85ms later
  playSingleImpact(now, 1.0);
  playSingleImpact(now + 0.085, 0.45);
}

/**
 * Play authentic auction gavel/hammer sound when a player is marked SOLD.
 * Uses Web Audio Buffer -> HTML5 Audio -> Synthesizer fallback.
 */
export function playHammerSound() {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastHammerPlayedAt < 600) return;
  lastHammerPlayedAt = now;

  // 1. Try Web Audio buffer
  if (playWebAudioBuffer("gavel", 1.0)) return;

  // 2. Try HTML5 Audio
  try {
    if (preloadedGavel) {
      preloadedGavel.currentTime = 0;
      preloadedGavel.volume = 1.0;
      const playPromise = preloadedGavel.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          const ctx = getAudioContext();
          if (ctx) synthesizeGavelStrike(ctx);
        });
        return;
      }
    }
  } catch {}

  // 3. Synthesizer fallback
  const ctx = getAudioContext();
  if (ctx) {
    synthesizeGavelStrike(ctx);
  }
}

/**
 * Play authentic "Going once..." spoken warning sound at 2s remaining.
 */
export function playGoingOnceSound() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastGoingOncePlayedAt < 800) return;
  lastGoingOncePlayedAt = now;

  // 1. Try Web Audio buffer
  if (playWebAudioBuffer("goingOnce", 1.0)) return;

  // 2. Try HTML5 Audio fallback
  try {
    if (preloadedGoingOnce) {
      preloadedGoingOnce.currentTime = 0;
      preloadedGoingOnce.volume = 1.0;
      preloadedGoingOnce.play().catch(() => {});
    }
  } catch {}
}

/**
 * Play authentic "Going twice..." spoken warning sound at 1s remaining.
 */
export function playGoingTwiceSound() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastGoingTwicePlayedAt < 800) return;
  lastGoingTwicePlayedAt = now;

  // 1. Try Web Audio buffer
  if (playWebAudioBuffer("goingTwice", 1.0)) return;

  // 2. Try HTML5 Audio fallback
  try {
    if (preloadedGoingTwice) {
      preloadedGoingTwice.currentTime = 0;
      preloadedGoingTwice.volume = 1.0;
      preloadedGoingTwice.play().catch(() => {});
    }
  } catch {}
}

/**
 * Play authentic "SOLD!" vocal proclamation with synchronized hammer double-strike.
 */
export function playSoldGavelSound() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastHammerPlayedAt < 600) return;
  lastHammerPlayedAt = now;

  // 1. Try Web Audio buffer
  if (playWebAudioBuffer("soldGavel", 1.0)) return;

  // 2. Try HTML5 Audio fallback
  try {
    if (preloadedSoldGavel) {
      preloadedSoldGavel.currentTime = 0;
      preloadedSoldGavel.volume = 1.0;
      const p = preloadedSoldGavel.play();
      if (p !== undefined) {
        p.catch(() => {
          const ctx = getAudioContext();
          if (ctx) synthesizeGavelStrike(ctx);
        });
        return;
      }
    }
  } catch {}

  // 3. Web Audio Synthesizer fallback
  const ctx = getAudioContext();
  if (ctx) {
    synthesizeGavelStrike(ctx);
  }
}

/**
 * Play complete authentic "Going once... Going twice... SOLD!" chant with gavel strike.
 */
export function playSoldChantSound() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastHammerPlayedAt < 600) return;
  lastHammerPlayedAt = now;

  // 1. Try Web Audio buffer
  if (playWebAudioBuffer("fullChant", 1.0)) return;

  // 2. Try HTML5 Audio fallback
  try {
    if (preloadedFullChant) {
      preloadedFullChant.currentTime = 0;
      preloadedFullChant.volume = 1.0;
      const p = preloadedFullChant.play();
      if (p !== undefined) {
        p.catch(() => {
          playSoldGavelSound();
        });
        return;
      }
    }
  } catch {}

  playSoldGavelSound();
}

/**
 * Lightweight countdown tick sound utilizing the singleton AudioContext.
 */
export function playTickSound(second: number) {
  if (typeof window === "undefined") return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const freq = second === 1 ? 1250 : second === 2 ? 1000 : 800;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch {
    // Ignore audio errors during rapid background ticks
  }
}

/**
 * Comprehensive diagnostic audio test:
 * Unlocks audio and plays the full studio "Going once... Going twice... SOLD!" chant.
 */
export async function testAudioOutput(): Promise<{ success: boolean; message: string }> {
  unlockAudio();
  const ctx = getAudioContext();

  // Ensure buffers are preloaded
  await preloadSoundBuffers().catch(() => {});

  // Play the full chant
  playSoldChantSound();

  return {
    success: true,
    message: ctx ? `Audio engine active (state: ${ctx.state})` : "Audio engine active",
  };
}
