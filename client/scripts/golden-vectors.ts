/**
 * Writes golden vectors: complete runs played by the real game code, with the
 * result the TypeScript simulation produced. The contract's Rust replay must
 * reproduce every line exactly (`cargo test` reads this file), which is how the
 * two implementations are kept from drifting.
 *
 *   bun run golden > ../contracts/deepmark-contract/tests/golden.txt
 *
 * Output is deterministic: it is generated from a fixed seed.
 */
import { buildFloor, isWalkable, type Point, type RelicKind } from '../src/game/floor';
import { mulberry32, randInt, type Rng } from '../src/game/rng';
import { ActionCode, applyAction, drainEvents, newRun, type RunState } from '../src/game/state';
import type { HeroId } from '../src/game/heroes';

const VECTOR_COUNT = 400;
const STEP_CAP = 1500;
const GENERATOR_SEED = 0xdee9_3a2c;
const HERO_CODE: Record<HeroId, number> = { lantern: 0, cinder: 1 };
const HEROES: HeroId[] = ['lantern', 'cinder'];
const MOVES: { code: ActionCode; dx: number; dy: number }[] = [
  { code: ActionCode.Up, dx: 0, dy: -1 },
  { code: ActionCode.Down, dx: 0, dy: 1 },
  { code: ActionCode.Left, dx: -1, dy: 0 },
  { code: ActionCode.Right, dx: 1, dy: 0 },
];

interface Habits {
  wantsRelic: boolean;
  avoidsFights: boolean;
  retreatChance: number;
  noiseChance: number;
  descendChance: number;
}

function chance(g: Rng, p: number): boolean {
  return g() < p;
}

function stepToward(state: RunState, goal: Point, avoidEnemies: boolean): ActionCode | null {
  const key = (p: Point): string => `${p.x},${p.y}`;
  const blocked = new Set<string>();
  if (avoidEnemies) {
    for (const e of state.enemies) if (e.alive) blocked.add(key(e));
  }
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
      if (seen.has(k) || !isWalkable(state.layout, next.x, next.y) || blocked.has(k)) continue;
      seen.add(k);
      first.set(k, first.get(key(at)) ?? m.code);
      queue.push(next);
    }
  }
  return null;
}

function relicKinds(state: RunState): RelicKind[] {
  return drainEvents(state).flatMap((e) => (e.type === 'relic' ? [e.kind] : []));
}

function playOne(g: Rng): { line: string } | null {
  const heroId = HEROES[randInt(g, 0, HEROES.length - 1)] as HeroId;
  const seed = Math.floor(g() * 0xffffffff);
  const habits: Habits = {
    wantsRelic: chance(g, 0.6),
    avoidsFights: chance(g, 0.3),
    retreatChance: g() * 0.3,
    noiseChance: g() * 0.12,
    descendChance: 0.45 + g() * 0.5,
  };
  const state = newRun(heroId, seed);
  const kinds: RelicKind[] = [];

  for (let step = 0; step < STEP_CAP && state.mode !== 'result'; step++) {
    if (chance(g, habits.noiseChance)) {
      applyAction(state, randInt(g, 0, 7) as ActionCode);
      kinds.push(...relicKinds(state));
      continue;
    }
    if (state.mode === 'combat') {
      const code = chance(g, habits.retreatChance) ? ActionCode.Retreat : ActionCode.Attack;
      applyAction(state, code);
    } else if (state.mode === 'choice') {
      applyAction(state, chance(g, habits.descendChance) ? ActionCode.Descend : ActionCode.Extract);
    } else {
      const relic = state.relics.find((r) => !r.collected);
      const goal: Point = habits.wantsRelic && relic ? relic : state.layout.stairsPos;
      const code =
        stepToward(state, goal, habits.avoidsFights) ??
        stepToward(state, goal, false) ??
        (randInt(g, 0, 3) as ActionCode);
      applyAction(state, code);
    }
    kinds.push(...relicKinds(state));
  }

  if (state.mode !== 'result' || state.exhausted) return null;

  const extracted = state.resultKind === 'extracted';
  const count = (kind: RelicKind): number => (extracted ? kinds.filter((k) => k === kind).length : 0);
  const common = count('common');
  const rare = count('rare');
  const core = count('core');
  if (common + rare + core !== state.relicsThisRun) {
    throw new Error('relic breakdown disagrees with relicsThisRun');
  }
  const fields = [
    HERO_CODE[heroId],
    seed,
    state.actions.join(''),
    extracted ? 'E' : 'D',
    state.floorNumber,
    common,
    rare,
    core,
    state.scoreThisRun,
    state.player.hp,
    state.actions.length,
  ];
  return { line: fields.join(' ') };
}

function main(): void {
  // The game persists progress through localStorage, which does not exist here.
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };

  // Touch the floors so a layout change fails loudly instead of silently.
  for (let n = 1; n <= 3; n++) buildFloor(n);

  const g = mulberry32(GENERATOR_SEED);
  const lines: string[] = [
    '# Golden vectors for the Deepmark replay. Generated by client/scripts/golden-vectors.ts.',
    '# hero seed actions ending(E|D) floor common rare core score hp action_count',
  ];
  let extracted = 0;
  let dead = 0;
  let deepest = 0;
  while (lines.length - 2 < VECTOR_COUNT) {
    const out = playOne(g);
    if (!out) continue;
    lines.push(out.line);
    const parts = out.line.split(' ');
    if (parts[3] === 'E') extracted++;
    else dead++;
    deepest = Math.max(deepest, Number(parts[4]));
  }
  console.log(lines.join('\n'));
  console.error(`vectors: ${VECTOR_COUNT}, extracted: ${extracted}, dead: ${dead}, deepest floor: ${deepest}`);
}

main();
