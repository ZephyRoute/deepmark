import { resolveExchange } from './combat';
import { ENEMIES, type EnemyKind } from './enemies';
import { buildFloor, isWalkable, MAX_FLOOR, type FloorLayout, type RelicKind } from './floor';
import { HERO_ORDER, HEROES, type HeroId } from './heroes';
import { statsFor, type Look, type Loadout, type Stats } from './loadout';
import { recordRun } from './progress';
import { mulberry32, freshSeed, type Rng } from './rng';

export type Mode = 'title' | 'explore' | 'combat' | 'choice' | 'result';

/**
 * One byte per input, the exact encoding the contract replays. Changing a
 * value here changes what the contract accepts, so it must match
 * `contracts/deepmark-contract/src/sim.rs`.
 */
export const ActionCode = {
  Up: 0,
  Down: 1,
  Left: 2,
  Right: 3,
  Attack: 4,
  Retreat: 5,
  Descend: 6,
  Extract: 7,
} as const;
export type ActionCode = (typeof ActionCode)[keyof typeof ActionCode];

/** Most actions one run may hold. Matches `MAX_ACTIONS` in the contract. */
export const MAX_ACTIONS = 2048;
export type ResultKind = 'extracted' | 'dead';

export interface EnemyState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  kind: EnemyKind;
}

export interface RelicState {
  x: number;
  y: number;
  kind: RelicKind;
  collected: boolean;
}

export type GameEvent =
  | { type: 'combatStart' }
  | { type: 'playerHit'; amount: number; x: number; y: number }
  | { type: 'enemyHit'; amount: number; x: number; y: number }
  | { type: 'enemyDied'; x: number; y: number }
  | { type: 'relic'; kind: RelicKind; x: number; y: number }
  | { type: 'floorCleared' }
  | { type: 'descended'; floor: number }
  | { type: 'extracted' }
  | { type: 'dead' };

export interface RunState {
  mode: Mode;
  heroId: HeroId;
  loadout: Loadout;
  stats: Stats;
  look: Look;
  seed: number;
  rng: Rng;
  floorNumber: number;
  layout: FloorLayout;
  player: { x: number; y: number; hp: number; maxHp: number };
  enemies: EnemyState[];
  activeEnemyIndex: number | null;
  relics: RelicState[];
  relicsThisRun: number;
  scoreThisRun: number;
  resultKind: ResultKind | null;
  /** Every input that changed the game, in order. This is what the contract replays. */
  actions: number[];
  /** True when the run hit `MAX_ACTIONS` and can no longer be verified on chain. */
  exhausted: boolean;
  newBest: boolean;
  log: string[];
  events: GameEvent[];
}

const MAX_LOG_LINES = 4;
const RELIC_VALUE: Record<RelicKind, number> = { common: 1, rare: 2, core: 3 };

function fromLayout(layout: FloorLayout): { enemies: EnemyState[]; relics: RelicState[] } {
  return {
    enemies: layout.enemies.map((e) => ({
      x: e.x,
      y: e.y,
      hp: ENEMIES[e.kind].maxHp,
      maxHp: ENEMIES[e.kind].maxHp,
      alive: true,
      kind: e.kind,
    })),
    relics: layout.relics.map((r) => ({ x: r.x, y: r.y, kind: r.kind, collected: false })),
  };
}

export const DEFAULT_LOOK: Look = { name: 'Delver', emblem: 0, cloak: 0 };

export function newRun(loadout: Loadout, seed: number = freshSeed(), look: Look = DEFAULT_LOOK): RunState {
  const heroId = HERO_ORDER[loadout.base] ?? 'lantern';
  const hero = HEROES[heroId];
  const stats = statsFor(loadout);
  const layout = buildFloor(1);
  const { enemies, relics } = fromLayout(layout);
  return {
    mode: 'explore',
    heroId,
    loadout,
    stats,
    look,
    seed,
    rng: mulberry32(seed),
    floorNumber: 1,
    layout,
    player: { ...layout.playerStart, hp: stats.maxHp, maxHp: stats.maxHp },
    enemies,
    activeEnemyIndex: null,
    relics,
    relicsThisRun: 0,
    scoreThisRun: 0,
    resultKind: null,
    actions: [],
    exhausted: false,
    newBest: false,
    log: [`${hero.name} enters the dungeon. Find the stairs, or find your death.`],
    events: [],
  };
}

function pushLog(state: RunState, line: string): void {
  state.log.push(line);
  if (state.log.length > MAX_LOG_LINES) state.log.shift();
}

function pushEvent(state: RunState, event: GameEvent): void {
  state.events.push(event);
}

export function drainEvents(state: RunState): GameEvent[] {
  return state.events.splice(0, state.events.length);
}

function aliveEnemyIndexAt(state: RunState, x: number, y: number): number {
  return state.enemies.findIndex((e) => e.alive && e.x === x && e.y === y);
}

function finishRun(state: RunState, kind: ResultKind): void {
  state.mode = 'result';
  state.resultKind = kind;
  const relicsKept = kind === 'dead' ? 0 : state.relicsThisRun;
  if (kind === 'dead') {
    state.relicsThisRun = 0;
    state.scoreThisRun = 0;
  }
  const { isNewBest } = recordRun({
    floorReached: state.floorNumber,
    relicsKept,
    score: state.scoreThisRun,
    extracted: kind === 'extracted',
    heroId: state.heroId,
  });
  state.newBest = isNewBest && kind === 'extracted';
  pushEvent(state, kind === 'extracted' ? { type: 'extracted' } : { type: 'dead' });
}

function tryMove(state: RunState, dx: number, dy: number): boolean {
  if (state.mode !== 'explore') return false;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;

  const enemyIdx = aliveEnemyIndexAt(state, nx, ny);
  if (enemyIdx >= 0) {
    state.mode = 'combat';
    state.activeEnemyIndex = enemyIdx;
    const enemy = state.enemies[enemyIdx];
    if (enemy) pushLog(state, `${ENEMIES[enemy.kind].name} blocks the way.`);
    pushEvent(state, { type: 'combatStart' });
    return true;
  }

  if (!isWalkable(state.layout, nx, ny)) return false;

  state.player.x = nx;
  state.player.y = ny;

  const relic = state.relics.find((r) => !r.collected && r.x === nx && r.y === ny);
  if (relic) {
    relic.collected = true;
    state.relicsThisRun += 1;
    state.scoreThisRun += RELIC_VALUE[relic.kind];
    pushLog(state, `You pry loose a ${relic.kind} relic. It hums faintly.`);
    pushEvent(state, { type: 'relic', kind: relic.kind, x: relic.x, y: relic.y });
  }

  if (state.layout.stairsPos.x === nx && state.layout.stairsPos.y === ny) {
    if (state.layout.isFinalFloor) {
      pushLog(state, 'You climb into daylight. The depths let you go.');
      finishRun(state, 'extracted');
    } else {
      state.mode = 'choice';
      pushLog(state, 'Floor cleared. Descend or extract?');
      pushEvent(state, { type: 'floorCleared' });
    }
  }
  return true;
}

function attack(state: RunState): boolean {
  if (state.mode !== 'combat' || state.activeEnemyIndex === null) return false;
  const enemy = state.enemies[state.activeEnemyIndex];
  if (!enemy) return false;
  const archetype = ENEMIES[enemy.kind];
  const result = resolveExchange(
    state.rng,
    state.player.hp,
    enemy.hp,
    archetype.dmgMin,
    archetype.dmgMax,
    state.stats.dmgMin,
    state.stats.dmgMax
  );

  enemy.hp = Math.max(0, enemy.hp - result.playerDamageDealt);
  pushLog(state, `You strike the ${archetype.name} for ${result.playerDamageDealt}.`);
  pushEvent(state, { type: 'enemyHit', amount: result.playerDamageDealt, x: enemy.x, y: enemy.y });

  if (result.enemyDied) {
    enemy.alive = false;
    state.mode = 'explore';
    state.activeEnemyIndex = null;
    pushLog(state, `The ${archetype.name} falls.`);
    pushEvent(state, { type: 'enemyDied', x: enemy.x, y: enemy.y });
    return true;
  }

  state.player.hp = Math.max(0, state.player.hp - result.enemyDamageDealt);
  pushLog(state, `The ${archetype.name} hits back for ${result.enemyDamageDealt}.`);
  pushEvent(state, { type: 'playerHit', amount: result.enemyDamageDealt, x: state.player.x, y: state.player.y });

  if (result.playerDied) {
    pushLog(state, 'You collapse. Nothing extracted, nothing kept.');
    finishRun(state, 'dead');
  }
  return true;
}

function retreat(state: RunState): boolean {
  if (state.mode !== 'combat') return false;
  state.mode = 'explore';
  state.activeEnemyIndex = null;
  pushLog(state, 'You back away.');
  return true;
}

function chooseDescend(state: RunState): boolean {
  if (state.mode !== 'choice') return false;
  if (state.floorNumber >= MAX_FLOOR) return false;
  state.floorNumber += 1;
  const layout = buildFloor(state.floorNumber);
  const { enemies, relics } = fromLayout(layout);
  state.layout = layout;
  state.enemies = enemies;
  state.relics = relics;
  state.player.x = layout.playerStart.x;
  state.player.y = layout.playerStart.y;
  state.mode = 'explore';
  pushLog(state, `You descend to floor ${state.floorNumber}.`);
  pushEvent(state, { type: 'descended', floor: state.floorNumber });
  return true;
}

function chooseExtract(state: RunState): boolean {
  if (state.mode !== 'choice') return false;
  pushLog(state, "You extract with what you've gathered.");
  finishRun(state, 'extracted');
  return true;
}

/**
 * The only way input changes a run. Applies one action and, when it had an
 * effect, appends its code to `state.actions`. Inputs that do nothing (a bump
 * into a wall, a key that is illegal in the current mode) are not recorded,
 * which keeps the log short without changing what the contract replays.
 */
export function applyAction(state: RunState, code: ActionCode): boolean {
  if (state.mode === 'result') return false;
  if (state.actions.length >= MAX_ACTIONS) {
    state.exhausted = true;
    return false;
  }
  let applied = false;
  switch (code) {
    case ActionCode.Up:
      applied = tryMove(state, 0, -1);
      break;
    case ActionCode.Down:
      applied = tryMove(state, 0, 1);
      break;
    case ActionCode.Left:
      applied = tryMove(state, -1, 0);
      break;
    case ActionCode.Right:
      applied = tryMove(state, 1, 0);
      break;
    case ActionCode.Attack:
      applied = attack(state);
      break;
    case ActionCode.Retreat:
      applied = retreat(state);
      break;
    case ActionCode.Descend:
      applied = chooseDescend(state);
      break;
    case ActionCode.Extract:
      applied = chooseExtract(state);
      break;
  }
  if (applied) state.actions.push(code);
  return applied;
}
