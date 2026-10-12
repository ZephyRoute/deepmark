import { RUN } from './footage-map';
import sealedMarks from './generated/sealed-marks.json';

/** Scene boundaries of the 30 second cut, in seconds. Overlaps are deliberate dissolves. */
export const T30 = {
  total: 30,
  hook: [0, 5.0],
  descent: [4.6, 8.4],
  fight1: [8.4, 11.2],
  fight2: [11.2, 14.0],
  bossBanner: [14.0, 15.7],
  bossFight: [15.7, 17.8],
  extract: [17.8, 20.8],
  sealed: [20.8, 25.0],
  vault: [25.0, 27.2],
  end: [27.2, 30],
} as const satisfies Record<string, number | readonly [number, number]>;

/** A shot of recorded footage: when it starts in the film and where in the recording it starts. */
export interface ShotAt {
  at: number;
  from: number;
}

/** Seconds into the recording that the sealed screen has been showing before its seal lands. */
const SEAL_LEAD = 1.5;

export const SHOT30 = {
  fight1: { at: T30.fight1[0], from: RUN.floor1Fight - 0.6 },
  fight2: { at: T30.fight2[0], from: RUN.floor2Fight - 0.5 },
  bossFight: { at: T30.bossFight[0], from: RUN.bossFight - 0.9 },
  extract: { at: T30.extract[0], from: RUN.floor3Relic - 0.8 },
  sealed: { at: T30.sealed[0], from: sealedMarks.sealed - SEAL_LEAD },
  vault: { at: T30.vault[0], from: 1.0 },
} as const satisfies Record<string, ShotAt>;

/** The moment in the film at which something that happened at `beat` in the recording is on screen. */
export const filmTime = (shot: ShotAt, beat: number): number => shot.at + (beat - shot.from);

/** The 90 second cut. The game comes first, the explanation after it, never before. */
export const T90 = {
  total: 90,
  hook: [0, 5.0],
  descent: [4.6, 8.2],
  fight1: [8.2, 11.4],
  fight2: [11.4, 14.0],
  choice: [14.0, 18.0],
  bossBanner: [18.0, 19.9],
  bossFight: [19.9, 23.9],
  extract: [23.9, 27.4],
  sealed: [27.4, 33.0],
  play: [33.0, 42.5],
  seed: [42.5, 52.0],
  replay: [52.0, 64.0],
  relics: [64.0, 74.0],
  verify: [74.0, 81.0],
  vault: [81.0, 85.0],
  end: [85.0, 90.0],
} as const satisfies Record<string, number | readonly [number, number]>;

export const SHOT90 = {
  fight1: { at: T90.fight1[0], from: RUN.floor1Fight - 0.6 },
  fight2: { at: T90.fight2[0], from: RUN.floor2Fight - 0.5 },
  choice: { at: T90.choice[0], from: RUN.floor2Cleared - 1.6 },
  bossFight: { at: T90.bossFight[0], from: RUN.bossFight - 0.9 },
  extract: { at: T90.extract[0], from: RUN.bossDown },
  sealed: { at: T90.sealed[0], from: sealedMarks.sealed - SEAL_LEAD },
  vault: { at: T90.vault[0], from: 1.0 },
  /** The clip that plays inside the first explainer chapter's browser window. */
  playWindow: { at: T90.play[0], from: RUN.floor1Fight - 1.5 },
} as const satisfies Record<string, ShotAt>;
