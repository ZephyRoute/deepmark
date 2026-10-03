/**
 * Procedural audio, all synthesised in the browser: no audio files, nothing to
 * download, nothing to license. A quiet ambience per floor, soft footsteps,
 * hits with a little variation each time, and bell tones for relics.
 */
const MUTE_KEY = 'deepmark:muted:v1';
const MASTER_LEVEL = 0.9;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    const compressor = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    master.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function out(): AudioNode | null {
  getContext();
  return master;
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // The choice still holds for this tab.
  }
  const audio = getContext();
  if (audio && master) master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, audio.currentTime, 0.05);
  return muted;
}

function noise(audio: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = audio.sampleRate;
    noiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** A little random drift so no two hits sound the same. */
function vary(value: number, amount: number): number {
  return value * (1 + (Math.random() * 2 - 1) * amount);
}

interface Burst {
  duration: number;
  type: BiquadFilterType;
  from: number;
  to: number;
  q?: number;
  gain: number;
  delay?: number;
}

function burst(b: Burst): void {
  const audio = getContext();
  const dest = out();
  if (!audio || !dest) return;
  const t = audio.currentTime + (b.delay ?? 0);
  const src = audio.createBufferSource();
  src.buffer = noise(audio);
  const filter = audio.createBiquadFilter();
  filter.type = b.type;
  filter.Q.value = b.q ?? 1;
  filter.frequency.setValueAtTime(b.from, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, b.to), t + b.duration);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(b.gain, t);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + b.duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + b.duration + 0.02);
}

interface Thump {
  from: number;
  to: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  delay?: number;
}

function thump(p: Thump): void {
  const audio = getContext();
  const dest = out();
  if (!audio || !dest) return;
  const t = audio.currentTime + (p.delay ?? 0);
  const osc = audio.createOscillator();
  osc.type = p.type ?? 'sine';
  osc.frequency.setValueAtTime(p.from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, p.to), t + p.duration);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(p.gain, t);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + p.duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + p.duration + 0.02);
}

/** A struck bell: a few inharmonic partials with a long decay. */
function bell(freq: number, gainLevel: number, delay = 0, decay = 1.1): void {
  const audio = getContext();
  const dest = out();
  if (!audio || !dest) return;
  const t = audio.currentTime + delay;
  for (const [ratio, level] of [[1, 1], [2.76, 0.45], [5.4, 0.2]] as const) {
    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * ratio, t);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(gainLevel * level, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + decay / ratio);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + decay / ratio + 0.05);
  }
}

export function sfxStep(): void {
  burst({ duration: 0.05, type: 'lowpass', from: vary(900, 0.25), to: 220, gain: 0.05 });
}

export function sfxUi(): void {
  thump({ from: 520, to: 380, duration: 0.05, gain: 0.03, type: 'triangle' });
}

export function sfxHitEnemy(): void {
  burst({ duration: 0.09, type: 'bandpass', from: vary(2200, 0.15), to: 700, q: 1.2, gain: 0.16 });
  thump({ from: vary(170, 0.12), to: 70, duration: 0.11, gain: 0.2 });
}

export function sfxHitPlayer(): void {
  burst({ duration: 0.16, type: 'lowpass', from: 1400, to: 200, gain: 0.2 });
  thump({ from: vary(110, 0.1), to: 42, duration: 0.2, gain: 0.3, type: 'triangle' });
}

export function sfxEnemyDied(): void {
  burst({ duration: 0.3, type: 'bandpass', from: 1500, to: 200, q: 0.8, gain: 0.14 });
  thump({ from: 130, to: 48, duration: 0.3, gain: 0.22 });
  bell(vary(392, 0.02), 0.05, 0.05, 0.6);
}

const RELIC_NOTES: Record<string, number> = { common: 1046.5, rare: 1318.5, core: 1568 };

export function sfxRelic(kind = 'common'): void {
  const note = RELIC_NOTES[kind] ?? 1046.5;
  bell(note, 0.08, 0, 1.4);
  bell(note * 1.5, 0.05, 0.09, 1.1);
  if (kind === 'core') bell(note * 2, 0.04, 0.2, 1.6);
}

export function sfxFloorCleared(): void {
  bell(523.3, 0.08, 0, 1.2);
  bell(659.3, 0.07, 0.12, 1.2);
}

export function sfxDescend(): void {
  burst({ duration: 0.6, type: 'lowpass', from: 900, to: 80, gain: 0.12 });
  thump({ from: 120, to: 40, duration: 0.6, gain: 0.18, type: 'triangle' });
}

export function sfxExtracted(): void {
  bell(523.3, 0.09, 0, 1.6);
  bell(659.3, 0.08, 0.14, 1.6);
  bell(784, 0.08, 0.28, 1.8);
  bell(1046.5, 0.07, 0.46, 2.2);
}

export function sfxDead(): void {
  burst({ duration: 0.8, type: 'lowpass', from: 700, to: 60, gain: 0.2 });
  thump({ from: 150, to: 32, duration: 0.9, gain: 0.34, type: 'sawtooth' });
}

export function sfxBossIntro(): void {
  const audio = getContext();
  const dest = out();
  if (!audio || !dest) return;
  const t = audio.currentTime;
  for (const freq of [55, 55.7, 82.4]) {
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, t);
    filter.frequency.exponentialRampToValueAtTime(700, t + 1.2);
    filter.frequency.exponentialRampToValueAtTime(90, t + 2.6);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0008, t);
    gain.gain.exponentialRampToValueAtTime(0.1, t + 1.1);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 2.8);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 2.9);
  }
}

// ---- ambience ----

interface Bed {
  stop: () => void;
}

let bed: Bed | null = null;

/** Per floor: root of the drone, a second pitch for tension, how much air moves. */
const FLOOR_BEDS: Record<number, { root: number; tension: number; air: number }> = {
  1: { root: 55, tension: 82.4, air: 0.018 },
  2: { root: 49, tension: 73.4, air: 0.024 },
  3: { root: 41.2, tension: 43.65, air: 0.03 },
};

function makeBed(floor: number): Bed | null {
  const audio = getContext();
  const dest = out();
  if (!audio || !dest) return null;
  const spec = FLOOR_BEDS[floor] ?? FLOOR_BEDS[1];
  if (!spec) return null;
  const t = audio.currentTime;
  const level = audio.createGain();
  level.gain.setValueAtTime(0.0001, t);
  level.gain.exponentialRampToValueAtTime(1, t + 2.5);
  level.connect(dest);

  const stoppers: (() => void)[] = [];

  for (const [freq, gainValue] of [[spec.root, 0.07], [spec.root * 1.003, 0.05], [spec.tension, 0.025]] as const) {
    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = audio.createGain();
    gain.gain.value = gainValue;
    const lfo = audio.createOscillator();
    lfo.frequency.value = 0.07 + Math.random() * 0.06;
    const lfoDepth = audio.createGain();
    lfoDepth.gain.value = gainValue * 0.6;
    lfo.connect(lfoDepth);
    lfoDepth.connect(gain.gain);
    osc.connect(gain);
    gain.connect(level);
    osc.start();
    lfo.start();
    stoppers.push(() => osc.stop(), () => lfo.stop());
  }

  const wind = audio.createBufferSource();
  wind.buffer = noise(audio);
  wind.loop = true;
  const windFilter = audio.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 380;
  windFilter.Q.value = 0.5;
  const windGain = audio.createGain();
  windGain.gain.value = spec.air;
  const sweep = audio.createOscillator();
  sweep.frequency.value = 0.05;
  const sweepDepth = audio.createGain();
  sweepDepth.gain.value = 140;
  sweep.connect(sweepDepth);
  sweepDepth.connect(windFilter.frequency);
  wind.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(level);
  wind.start();
  sweep.start();
  stoppers.push(() => wind.stop(), () => sweep.stop());

  return {
    stop: () => {
      const now = audio.currentTime;
      level.gain.cancelScheduledValues(now);
      level.gain.setTargetAtTime(0.0001, now, 0.6);
      setTimeout(() => {
        for (const stopIt of stoppers) {
          try {
            stopIt();
          } catch {
            // Already stopped.
          }
        }
        level.disconnect();
      }, 2500);
    },
  };
}

/** Starts, or crossfades to, the ambience for a floor. Safe to call every floor change. */
export function startAmbience(floor: number): void {
  bed?.stop();
  bed = makeBed(floor);
}

export function stopAmbience(): void {
  bed?.stop();
  bed = null;
}

// ---- ceremony and feedback sounds ----

/** A soft double thump, used while health is low. */
export function sfxHeartbeat(): void {
  thump({ from: 70, to: 40, duration: 0.14, gain: 0.22 });
  thump({ from: 62, to: 38, duration: 0.16, gain: 0.16, delay: 0.19 });
}

/** The wax seal pressed onto a verified run. */
export function sfxSeal(): void {
  thump({ from: 150, to: 50, duration: 0.22, gain: 0.3, type: 'triangle' });
  burst({ duration: 0.12, type: 'lowpass', from: 2400, to: 400, gain: 0.1 });
  bell(659.3, 0.06, 0.05, 1.4);
  bell(988, 0.05, 0.14, 1.6);
}

/** A delver becomes the player's own. Warmer and longer than any other cue. */
export function sfxHeroEarned(): void {
  bell(392, 0.1, 0, 2.6);
  bell(523.3, 0.09, 0.18, 2.6);
  bell(659.3, 0.09, 0.36, 2.8);
  bell(784, 0.09, 0.54, 3);
  bell(1046.5, 0.08, 0.78, 3.4);
  burst({ duration: 1.2, type: 'highpass', from: 3000, to: 8000, gain: 0.03, delay: 0.6 });
}

/** A low sweep as a floor title appears. */
export function sfxBanner(): void {
  burst({ duration: 0.9, type: 'bandpass', from: 220, to: 1100, q: 0.6, gain: 0.07 });
  thump({ from: 80, to: 55, duration: 0.5, gain: 0.1, type: 'triangle' });
}
