import runCues from './generated/run-cues.json';

export interface RunCue {
  t: number;
  index: number;
  floor: number;
  mode: string;
  hp: number;
  relics: number;
  events: string[];
  player: { x: number; y: number };
  enemy: { x: number; y: number } | null;
}

export const RUN_CUES = runCues as RunCue[];
const CUES = RUN_CUES;

/** Seconds into run.mp4 of the first input that raised `event` on `floor`. */
function when(event: string, floor: number, nth = 0): number {
  const hits = CUES.filter((c) => c.floor === floor && c.events.includes(event));
  const hit = hits[nth];
  if (!hit) throw new Error(`run.mp4 has no "${event}" number ${nth} on floor ${floor}. Re-run capture/plan.ts and the recorder.`);
  return hit.t;
}

/**
 * The beats of the filmed run, read from the cue log the recorder wrote while it
 * played, so a re-recorded take moves the edit with it instead of breaking it.
 */
export const RUN = {
  floor1Fight: when('combatStart', 1),
  floor1Relic: when('relic', 1),
  floor1Cleared: when('floorCleared', 1),
  floor2Fight: when('combatStart', 2),
  floor2Cleared: when('floorCleared', 2),
  bossFight: when('combatStart', 3),
  bossHit: when('playerHit', 3),
  bossSecondHit: when('playerHit', 3, 1),
  bossDown: when('enemyDied', 3),
  floor3Relic: when('relic', 3),
  extracted: when('extracted', 3),
} as const;

/** Every time the guard on `floor` was struck or struck back, as seconds into run.mp4. */
export function blows(floor: number): number[] {
  return CUES.filter((c) => c.floor === floor && (c.events.includes('enemyHit') || c.events.includes('playerHit'))).map((c) => c.t);
}
