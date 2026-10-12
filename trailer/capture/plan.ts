/**
 * Finds a run worth filming. The footage must be real gameplay, so instead of
 * animating a fake one this searches seeds with the game's own simulation for a
 * winning extraction with a dramatic arc, and prints the action log to replay.
 *
 *   bun run capture/plan.ts [--base=1] [--weapon=1] [--charm=0] [--rank=0]
 */
import { isWalkable, type Point } from '../../client/src/game/floor';
import { ActionCode, applyAction, drainEvents, newRun, type RunState } from '../../client/src/game/state';
import type { Loadout } from '../../client/src/game/loadout';

const MOVES: { code: ActionCode; dx: number; dy: number }[] = [
  { code: ActionCode.Up, dx: 0, dy: -1 },
  { code: ActionCode.Down, dx: 0, dy: 1 },
  { code: ActionCode.Left, dx: -1, dy: 0 },
  { code: ActionCode.Right, dx: 1, dy: 0 },
];
const SEED_COUNT = 40_000;
const STEP_CAP = 600;

export interface Plan {
  seed: number;
  score: number;
  skipped: number[];
  loadout: Loadout;
  actions: number[];
  hpLeft: number;
  maxHp: number;
  relics: number;
  fights: number;
}

function stepToward(state: RunState, goal: Point): ActionCode | null {
  const key = (p: Point): string => `${p.x},${p.y}`;
  const start: Point = { x: state.player.x, y: state.player.y };
  const first = new Map<string, ActionCode>();
  const seen = new Set<string>([key(start)]);
  const queue: Point[] = [start];
  while (queue.length > 0) {
    const at = queue.shift() as Point;
    if (at.x === goal.x && at.y === goal.y) return first.get(key(at)) ?? null;
    for (const m of MOVES) {
      const next = { x: at.x + m.dx, y: at.y + m.dy };
      const k = key(next);
      if (seen.has(k) || !isWalkable(state.layout, next.x, next.y)) continue;
      seen.add(k);
      first.set(k, first.get(key(at)) ?? m.code);
      queue.push(next);
    }
  }
  return null;
}

/** Plays greedily: every relic, every guard, down to floor 3, then extract. */
/** `skipFloors` lists floors whose relic the delver leaves behind, which is how a run ends with fewer relics. */
export function play(loadout: Loadout, seed: number, skipFloors: number[] = []): Plan | null {
  const state = newRun(loadout, seed);
  let fights = 0;
  for (let step = 0; step < STEP_CAP && state.mode !== 'result'; step += 1) {
    if (state.mode === 'combat') {
      applyAction(state, ActionCode.Attack);
      fights += 1;
    } else if (state.mode === 'choice') {
      applyAction(state, state.floorNumber < 3 ? ActionCode.Descend : ActionCode.Extract);
    } else {
      const relic = skipFloors.includes(state.floorNumber) ? undefined : state.relics.find((r) => !r.collected);
      const goal: Point = relic ?? state.layout.stairsPos;
      const code = stepToward(state, goal);
      if (code === null) return null;
      applyAction(state, code);
    }
    drainEvents(state);
  }
  if (state.mode !== 'result' || state.resultKind !== 'extracted' || state.floorNumber < 3) return null;
  return {
    seed,
    score: state.scoreThisRun,
    skipped: skipFloors,
    loadout,
    actions: state.actions,
    hpLeft: state.player.hp,
    maxHp: state.player.maxHp,
    relics: state.relicsThisRun,
    fights,
  };
}

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
}

/** What the sealed result card in the game's preview shows, so the film agrees with itself. */
const CARD = { relics: 2, score: 4, hpLeft: 1 } as const;

if (import.meta.main) {
  const loadout: Loadout = { base: arg('base', 1), weapon: arg('weapon', 1), charm: arg('charm', 2), rank: arg('rank', 0) };
  const found: Plan[] = [];
  const masks: number[][] = [[], [1], [2], [3], [1, 2], [1, 3], [2, 3]];
  for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
    for (const mask of masks) {
      const plan = play(loadout, seed, mask);
      if (plan && plan.relics === CARD.relics && plan.score === CARD.score && plan.hpLeft === CARD.hpLeft) found.push(plan);
    }
  }
  found.sort((a, b) => a.actions.length - b.actions.length);
  console.log(`${found.length} runs match the result card, loadout ${JSON.stringify(loadout)}`);
  for (const p of found.slice(0, 8)) {
    console.log(`seed ${p.seed} skip [${p.skipped}]  relics ${p.relics}  score ${p.score}  hp ${p.hpLeft}/${p.maxHp}  fights ${p.fights}  actions ${p.actions.length}`);
  }
}
