/**
 * What the score has to do, in seconds. The synthesiser in audio/ reads this and
 * the compositions never do, so retiming a scene means editing one timeline file
 * and one spec, then re-running `bun run audio`.
 */
import { RUN, blows } from './footage-map';
import plan from './generated/run-plan.json';
import { SHOT30, SHOT90, T30, T90, filmTime } from './timeline';

export type CueKind = 'hit' | 'boom' | 'chime' | 'seal' | 'riser' | 'tick';

export interface Cue {
  t: number;
  kind: CueKind;
  /** Hz for chime and seal, seconds for riser. */
  value?: number;
  gain?: number;
}

export interface Heartbeat {
  from: number;
  to: number;
  bpmFrom: number;
  bpmTo: number;
  gain: number;
}

export interface Chord {
  t: number;
  /** MIDI note numbers. */
  notes: number[];
  gain: number;
}

export interface ScoreSpec {
  name: string;
  seconds: number;
  chords: Chord[];
  /** Overall level of the sub drone and noise bed over time: [seconds, level] points. */
  bed: [number, number][];
  heartbeats: Heartbeat[];
  cues: Cue[];
  fadeOut: number;
}

const D2 = 38;
const DM: number[] = [D2 + 12, D2 + 19, D2 + 24, D2 + 27];
const BB: number[] = [D2 + 8, D2 + 15, D2 + 20, D2 + 24];
const GM: number[] = [D2 + 5, D2 + 12, D2 + 17, D2 + 22];
const A: number[] = [D2 + 11, D2 + 18, D2 + 23, D2 + 28];
const D_LIFT: number[] = [D2 + 12, D2 + 19, D2 + 26, D2 + 28];

export const SCORE_30: ScoreSpec = {
  name: 'score-30',
  seconds: 30,
  fadeOut: 1.4,
  bed: [
    [0, 0],
    [1.2, 0.55],
    [5, 0.7],
    [13.5, 1],
    [20, 0.6],
    [27.6, 1.1],
    [30, 0],
  ],
  chords: [
    { t: 0, notes: DM, gain: 0.5 },
    { t: 7.5, notes: BB, gain: 0.7 },
    { t: T30.bossBanner[0], notes: GM, gain: 0.9 },
    { t: T30.sealed[0] + 1.4, notes: D_LIFT, gain: 1 },
    { t: T30.end[0], notes: DM, gain: 1 },
  ],
  heartbeats: [
    { from: 2.2, to: 5.0, bpmFrom: 44, bpmTo: 50, gain: 0.5 },
    { from: T30.bossBanner[0] + 1.2, to: T30.sealed[0], bpmFrom: 60, bpmTo: 122, gain: 0.9 },
  ],
  cues: [
    { t: T30.descent[0] - 0.05, kind: 'riser', value: 4 },
    { t: T30.fight1[0], kind: 'boom', gain: 0.8 },
    ...blows(1).map((b): Cue => ({ t: filmTime(SHOT30.fight1, b), kind: 'hit' })),
    { t: filmTime(SHOT30.fight1, RUN.floor1Relic), kind: 'chime', value: 880 },
    ...blows(2).map((b): Cue => ({ t: filmTime(SHOT30.fight2, b), kind: 'hit', gain: 1.1 })),
    { t: T30.bossBanner[0], kind: 'boom', gain: 1 },
    ...blows(3).slice(0, 3).map((b, i): Cue => ({ t: filmTime(SHOT30.bossFight, b), kind: 'hit', gain: i === 2 ? 1.1 : 1.4 })),
    { t: filmTime(SHOT30.extract, RUN.floor3Relic), kind: 'chime', value: 1319, gain: 1.1 },
    { t: T30.sealed[0] - 0.35, kind: 'riser', value: 1.2 },
    { t: filmTime(SHOT30.sealed, SHOT30.sealed.from + 1.5), kind: 'seal', value: 587 },
    { t: T30.vault[0] + 0.2, kind: 'chime', value: 784, gain: 0.8 },
    { t: T30.end[0], kind: 'boom', gain: 1.2 },
  ],
};


/** Soft clicks for the action log filling in, then being read back. Same timing as the chapter graphics. */
function ticks(from: number, every: number, count: number): Cue[] {
  return Array.from({ length: count }, (_, i): Cue => ({ t: from + i * every, kind: 'tick', gain: 0.5 }));
}

export const SCORE_90: ScoreSpec = {
  name: 'score-90',
  seconds: 90,
  fadeOut: 2.2,
  bed: [
    [0, 0],
    [1.2, 0.55],
    [5, 0.7],
    [14, 0.95],
    [27.4, 0.7],
    [33, 0.5],
    [64, 0.55],
    [81, 0.95],
    [85, 1.1],
    [90, 0],
  ],
  chords: [
    { t: 0, notes: DM, gain: 0.5 },
    { t: T90.fight1[0], notes: BB, gain: 0.7 },
    { t: T90.bossBanner[0], notes: GM, gain: 0.9 },
    { t: T90.sealed[0] + 1.4, notes: D_LIFT, gain: 1 },
    { t: T90.play[0], notes: DM, gain: 0.55 },
    { t: T90.seed[0], notes: BB, gain: 0.6 },
    { t: T90.replay[0], notes: GM, gain: 0.7 },
    { t: T90.replay[0] + 9.4, notes: D_LIFT, gain: 0.9 },
    { t: T90.relics[0], notes: BB, gain: 0.7 },
    { t: T90.verify[0], notes: A, gain: 0.7 },
    { t: T90.vault[0], notes: D_LIFT, gain: 1 },
    { t: T90.end[0], notes: DM, gain: 1 },
  ],
  heartbeats: [
    { from: 2.2, to: 5.0, bpmFrom: 44, bpmTo: 50, gain: 0.5 },
    { from: T90.bossBanner[0] + 1.2, to: T90.sealed[0], bpmFrom: 60, bpmTo: 122, gain: 0.9 },
  ],
  cues: [
    { t: T90.descent[0] - 0.05, kind: 'riser', value: 4 },
    { t: T90.fight1[0], kind: 'boom', gain: 0.8 },
    ...blows(1).map((b): Cue => ({ t: filmTime(SHOT90.fight1, b), kind: 'hit' })),
    { t: filmTime(SHOT90.fight1, RUN.floor1Relic), kind: 'chime', value: 880 },
    ...blows(2).map((b): Cue => ({ t: filmTime(SHOT90.fight2, b), kind: 'hit', gain: 1.1 })),
    { t: T90.bossBanner[0], kind: 'boom', gain: 1 },
    ...blows(3).slice(0, 3).map((b, i): Cue => ({ t: filmTime(SHOT90.bossFight, b), kind: 'hit', gain: i === 2 ? 1.1 : 1.4 })),
    { t: filmTime(SHOT90.bossFight, RUN.floor3Relic), kind: 'chime', value: 1319, gain: 1.1 },
    { t: T90.sealed[0] - 0.35, kind: 'riser', value: 1.2 },
    { t: filmTime(SHOT90.sealed, SHOT90.sealed.from + 1.5), kind: 'seal', value: 587 },
    { t: T90.play[0], kind: 'chime', value: 659, gain: 0.6 },
    ...ticks(T90.play[0] + 1.2, 0.085, plan.actions.length),
    { t: T90.seed[0], kind: 'chime', value: 659, gain: 0.6 },
    { t: T90.seed[0] + 190 / 30, kind: 'chime', value: 988, gain: 0.7 },
    { t: T90.replay[0], kind: 'chime', value: 659, gain: 0.6 },
    ...ticks(T90.replay[0] + 3.0, 0.07, plan.actions.length),
    { t: T90.replay[0] + 9.3, kind: 'seal', value: 587, gain: 0.8 },
    { t: T90.relics[0], kind: 'chime', value: 659, gain: 0.6 },
    { t: T90.relics[0] + 1.0, kind: 'chime', value: 784, gain: 0.5 },
    { t: T90.relics[0] + 1.5, kind: 'chime', value: 988, gain: 0.5 },
    { t: T90.relics[0] + 2.0, kind: 'chime', value: 1319, gain: 0.5 },
    { t: T90.verify[0], kind: 'chime', value: 659, gain: 0.6 },
    { t: T90.vault[0] + 0.2, kind: 'chime', value: 784, gain: 0.8 },
    { t: T90.end[0], kind: 'boom', gain: 1.2 },
  ],
};
