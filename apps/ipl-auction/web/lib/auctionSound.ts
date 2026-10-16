// Audio utility for Auction Sound Effects (Gavel/Hammer strike on SOLD, etc.)

let audioContext: AudioContext | null = null;
let preloadedAudio: HTMLAudioElement | null = null;
let lastHammerPlayedAt = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

// Preload audio asset in browser
if (typeof window !== "undefined") {
  try {
    preloadedAudio = new Audio("/sounds/gavel.wav");
    preloadedAudio.preload = "auto";
    preloadedAudio.volume = 1.0;
  } catch {
    // Ignore preload error in SSR or restricted environments
  }
}

/**
 * Web Audio API synthesizer for an authentic auction gavel / hammer double strike.
 * Used as high-performance zero-latency synthesizer and reliable fallback.
 */
function synthesizeGavelStrike(ctx: AudioContext) {
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
    noiseGain.gain.setValueAtTime(volume * 0.85, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.03);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(startTime);
    whiteNoise.stop(startTime + 0.035);

    // 2. Resonant wood block body tone (fundamental 180Hz dropping to 135Hz)
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = "sine";
    bodyOsc.frequency.setValueAtTime(190, startTime);
    bodyOsc.frequency.exponentialRampToValueAtTime(135, startTime + 0.22);

    bodyGain.gain.setValueAtTime(volume * 0.75, startTime);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.24);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(ctx.destination);

    bodyOsc.start(startTime);
    bodyOsc.stop(startTime + 0.25);

    // 3. Wood surface overtone (380Hz dropping to 280Hz)
    const overtoneOsc = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtoneOsc.type = "triangle";
    overtoneOsc.frequency.setValueAtTime(380, startTime);
    overtoneOsc.frequency.exponentialRampToValueAtTime(260, startTime + 0.12);

    overtoneGain.gain.setValueAtTime(volume * 0.45, startTime);
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
 * Debounced to prevent accidental double-plays within 600ms.
 */
export function playHammerSound() {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastHammerPlayedAt < 600) {
    return;
  }
  lastHammerPlayedAt = now;

  let playedViaAudioElement = false;

  // 1. Try playing preloaded WAV audio element
  try {
    if (preloadedAudio) {
      preloadedAudio.currentTime = 0;
      const playPromise = preloadedAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            playedViaAudioElement = true;
          })
          .catch(() => {
            // If HTML5 Audio was blocked or failed, synthesize via Web Audio API
            const ctx = getAudioContext();
            if (ctx) {
              synthesizeGavelStrike(ctx);
            }
          });
      }
    }
  } catch {
    // Fall back to Web Audio API
  }

  // 2. Also ensure Web Audio API fallback triggers if audio element wasn't ready
  if (!preloadedAudio) {
    const ctx = getAudioContext();
    if (ctx) {
      synthesizeGavelStrike(ctx);
    }
  }
}
