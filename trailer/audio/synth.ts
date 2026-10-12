/**
 * Deterministic score synthesiser. No samples and no licensed music: pads,
 * a heartbeat, impacts and bells are all computed from numbers, so the audio
 * renders identically on every machine and ships with nothing to attribute.
 *
 *   bun run audio
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SCORE_30, SCORE_90, type Chord, type Cue, type ScoreSpec } from '../src/score-spec';

const SR = 44_100;
const OUT = new URL('../public/audio/', import.meta.url).pathname;

type Channels = [Float32Array, Float32Array];

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const smooth = (x: number): number => x * x * (3 - 2 * x);

function level(points: [number, number][], t: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 0;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as [number, number];
    const b = points[i] as [number, number];
    if (t <= b[0]) return a[1] + (b[1] - a[1]) * smooth((t - a[0]) / (b[0] - a[0]));
  }
  return last[1];
}

function add(ch: Channels, start: number, length: number, fn: (t: number, i: number) => number, pan = 0): void {
  const i0 = Math.max(0, Math.floor(start * SR));
  const n = Math.min(Math.floor(length * SR), ch[0].length - i0);
  const l = Math.cos(((pan + 1) * Math.PI) / 4);
  const r = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n; i += 1) {
    const v = fn(i / SR, i);
    (ch[0] as Float32Array)[i0 + i] = (ch[0][i0 + i] as number) + v * l;
    (ch[1] as Float32Array)[i0 + i] = (ch[1][i0 + i] as number) + v * r;
  }
}

/** Sub drone and a dark noise bed that follow the spec's level curve. */
function bed(ch: Channels, spec: ScoreSpec): void {
  const rand = rng(11);
  let lpL = 0;
  let lpR = 0;
  for (let i = 0; i < ch[0].length; i += 1) {
    const t = i / SR;
    const lv = level(spec.bed, t);
    const sub = Math.sin(2 * Math.PI * 36.71 * t) * 0.26 + Math.sin(2 * Math.PI * 73.42 * t + Math.sin(t * 0.3)) * 0.07;
    lpL += (rand() * 2 - 1 - lpL) * 0.012;
    lpR += (rand() * 2 - 1 - lpR) * 0.012;
    const wash = 0.5 + 0.5 * Math.sin(t * 0.43);
    (ch[0] as Float32Array)[i] = (ch[0][i] as number) + lv * (sub + lpL * (2.2 + wash * 1.6));
    (ch[1] as Float32Array)[i] = (ch[1][i] as number) + lv * (sub + lpR * (2.2 + wash * 1.6));
  }
}

function pads(ch: Channels, chords: Chord[], seconds: number): void {
  chords.forEach((chord, ci) => {
    const end = chords[ci + 1]?.t ?? seconds;
    const length = end - chord.t + 2.4;
    chord.notes.forEach((note, ni) => {
      const f = midi(note);
      const pan = (ni - 1.5) * 0.4;
      for (const detune of [-0.18, 0.21]) {
        add(
          ch,
          chord.t - 0.8,
          length,
          (t) => {
            const attack = smooth(clamp01(t / 2.6));
            const release = 1 - smooth(clamp01((t - (end - chord.t + 0.8)) / 2.4));
            const trem = 0.82 + 0.18 * Math.sin(t * (0.35 + ni * 0.07));
            const w = 2 * Math.PI * f * (1 + detune * 0.003) * t;
            const tone = Math.sin(w) + 0.38 * Math.sin(2 * w) + 0.14 * Math.sin(3 * w + 1) + 0.05 * Math.sin(5 * w);
            return tone * attack * release * trem * chord.gain * 0.026;
          },
          pan,
        );
      }
    });
  });
}

function thump(ch: Channels, t: number, gain: number): void {
  add(ch, t, 0.5, (x) => Math.sin(2 * Math.PI * (38 + 36 * Math.exp(-x * 24)) * x) * Math.exp(-x * 10) * gain * 0.95);
}

function heartbeat(ch: Channels, spec: ScoreSpec): void {
  for (const hb of spec.heartbeats) {
    let t = hb.from;
    while (t < hb.to) {
      const p = clamp01((t - hb.from) / (hb.to - hb.from));
      const bpm = hb.bpmFrom + (hb.bpmTo - hb.bpmFrom) * p * p;
      const g = hb.gain * (0.5 + 0.5 * p) * smooth(clamp01((t - hb.from) / 1.2));
      thump(ch, t, g);
      thump(ch, t + 0.27 * (60 / bpm) / (60 / 70), g * 0.62);
      t += 60 / bpm;
    }
  }
}

function boom(ch: Channels, t: number, gain: number): void {
  const rand = rng(Math.floor(t * 1000));
  add(ch, t, 3.2, (x) => Math.sin(2 * Math.PI * (28 + 70 * Math.exp(-x * 5)) * x) * Math.exp(-x * 1.5) * gain * 0.9);
  let lp = 0;
  add(ch, t, 1.4, (x) => {
    lp += (rand() * 2 - 1 - lp) * 0.08;
    return lp * Math.exp(-x * 3.2) * gain * 1.8;
  });
}

function hit(ch: Channels, t: number, gain: number): void {
  const rand = rng(Math.floor(t * 977));
  let band = 0;
  let low = 0;
  add(ch, t, 0.35, (x) => {
    const n = rand() * 2 - 1;
    low += (n - low) * 0.5;
    band += (low - band) * 0.25;
    return (n - low) * 0.5 * Math.exp(-x * 26) * gain * 0.55 + band * Math.exp(-x * 14) * gain * 0.7;
  });
  thump(ch, t, gain * 0.8);
}

function bell(ch: Channels, t: number, f0: number, gain: number, pan: number): void {
  const partials: [number, number, number][] = [
    [1, 1, 1.9],
    [2.76, 0.5, 2.6],
    [5.4, 0.28, 3.8],
    [8.93, 0.14, 5.2],
  ];
  add(
    ch,
    t,
    4,
    (x) => {
      let v = 0;
      for (const [ratio, amp, decay] of partials) v += Math.sin(2 * Math.PI * f0 * ratio * x) * amp * Math.exp(-x * decay);
      return v * gain * 0.13 * smooth(clamp01(x / 0.004));
    },
    pan,
  );
}

function riser(ch: Channels, t: number, length: number): void {
  const rand = rng(Math.floor(t * 313));
  let lp = 0;
  add(ch, t, length, (x) => {
    const p = clamp01(x / length);
    lp += (rand() * 2 - 1 - lp) * (0.05 + 0.5 * p * p);
    const sweep = Math.sin(2 * Math.PI * (160 + 1500 * p * p) * x);
    return (lp * 0.9 + sweep * 0.12) * p * p * 0.55;
  });
}

/** A dry click, the sound of one byte being written or read. */
function tick(ch: Channels, t: number, gain: number): void {
  const rand = rng(Math.floor(t * 7919));
  let low = 0;
  add(ch, t, 0.06, (x) => {
    const n = rand() * 2 - 1;
    low += (n - low) * 0.35;
    return (n - low) * Math.exp(-x * 90) * gain * 0.16 + Math.sin(2 * Math.PI * 2600 * x) * Math.exp(-x * 120) * gain * 0.05;
  }, (rand() - 0.5) * 0.6);
}

function cue(ch: Channels, c: Cue): void {
  const gain = c.gain ?? 1;
  if (c.kind === 'tick') {
    tick(ch, c.t, gain);
    return;
  }
  if (c.kind === 'hit') hit(ch, c.t, gain);
  else if (c.kind === 'boom') boom(ch, c.t, gain);
  else if (c.kind === 'riser') riser(ch, c.t, c.value ?? 3);
  else if (c.kind === 'chime') bell(ch, c.t, c.value ?? 880, gain, 0.2);
  else {
    // The seal: a low struck bell and its fifth, the moment the contract agrees.
    const f = c.value ?? 587;
    boom(ch, c.t, 0.55 * gain);
    bell(ch, c.t, f, 1.1 * gain, -0.15);
    bell(ch, c.t + 0.09, f * 1.5, 0.8 * gain, 0.25);
    bell(ch, c.t + 0.2, f * 2, 0.6 * gain, 0);
  }
}

/** A few feedback combs, enough tail to make the bells and booms sit in a stone room. */
function room(ch: Channels): void {
  const taps: [number, number][] = [
    [0.0297, 0.52],
    [0.0371, 0.48],
    [0.0411, 0.46],
    [0.0437, 0.44],
    [0.131, 0.34],
  ];
  const dry: Channels = [Float32Array.from(ch[0]), Float32Array.from(ch[1])];
  for (let c = 0; c < 2; c += 1) {
    const out = ch[c] as Float32Array;
    const src = dry[c] as Float32Array;
    for (const [delay, feedback] of taps) {
      const d = Math.floor(delay * SR * (c === 0 ? 1 : 1.07));
      const line = new Float32Array(out.length);
      for (let i = d; i < out.length; i += 1) line[i] = (src[i - d] as number) * 0.5 + (line[i - d] as number) * feedback;
      for (let i = 0; i < out.length; i += 1) out[i] = (out[i] as number) + (line[i] as number) * 0.28;
    }
  }
}

function master(ch: Channels, spec: ScoreSpec): void {
  let peak = 0;
  for (let i = 0; i < ch[0].length; i += 1) {
    const t = i / SR;
    const fade = i < SR * 0.05 ? i / (SR * 0.05) : 1;
    const out = 1 - smooth(clamp01((t - (spec.seconds - spec.fadeOut)) / spec.fadeOut));
    for (const c of ch) {
      const v = Math.tanh((c[i] as number) * 1.15) * fade * out;
      (c as Float32Array)[i] = v;
      peak = Math.max(peak, Math.abs(v));
    }
  }
  const norm = peak > 0 ? 0.89 / peak : 1;
  for (const c of ch) for (let i = 0; i < c.length; i += 1) (c as Float32Array)[i] = (c[i] as number) * norm;
}

function wav(ch: Channels): Buffer {
  const n = ch[0].length;
  const data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + n * 4, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i += 1) {
    data.writeInt16LE(Math.round((ch[0][i] as number) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round((ch[1][i] as number) * 32767), 46 + i * 4);
  }
  return data;
}

export function renderScore(spec: ScoreSpec): void {
  const length = Math.floor(spec.seconds * SR);
  const ch: Channels = [new Float32Array(length), new Float32Array(length)];
  bed(ch, spec);
  pads(ch, spec.chords, spec.seconds);
  heartbeat(ch, spec);
  for (const c of spec.cues) cue(ch, c);
  room(ch);
  master(ch, spec);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}${spec.name}.wav`, wav(ch));
  console.log(`wrote ${OUT}${spec.name}.wav`);
}

if (import.meta.main) {
  renderScore(SCORE_30);
  renderScore(SCORE_90);
}
