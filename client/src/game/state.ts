import { resolveExchange } from './combat';
import { ENEMIES, type EnemyKind } from './enemies';
import { buildFloor, isWalkable, MAX_FLOOR, type FloorLayout, type RelicKind } from './floor';
import { HEROES, type HeroId } from './heroes';
import { recordRun } from './progress';
import { mulberry32, freshSeed, type Rng } from './rng';

export type Mode = 'title' | 'explore' | 'combat' | 'choice' | 'result';
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

export function newRun(heroId: HeroId = 'lantern', seed: number = freshSeed()): RunState {
  const hero = HEROES[heroId];
  const layout = buildFloor(1);
  const { enemies, relics } = fromLayout(layout);
  return {
    mode: 'explore',
    heroId,
    seed,
    rng: mulberry32(seed),
    floorNumber: 1,
    layout,
    player: { ...layout.playerStart, hp: hero.maxHp, maxHp: hero.maxHp },
    enemies,
    activeEnemyIndex: null,
    relics,
    relicsThisRun: 0,
    scoreThisRun: 0,
    resultKind: null,
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
  const { isNewBest } = recordRun(state.floorNumber, relicsKept);
  state.newBest = isNewBest && kind === 'extracted';
  pushEvent(state, kind === 'extracted' ? { type: 'extracted' } : { type: 'dead' });
}

export function tryMove(state: RunState, dx: number, dy: number): void {
  if (state.mode !== 'explore') return;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;

  const enemyIdx = aliveEnemyIndexAt(state, nx, ny);
  if (enemyIdx >= 0) {
    state.mode = 'combat';
    state.activeEnemyIndex = enemyIdx;
    const enemy = state.enemies[enemyIdx];
    if (enemy) pushLog(state, `${ENEMIES[enemy.kind].name} blocks the way.`);
    pushEvent(state, { type: 'combatStart' });
    return;
  }

  if (!isWalkable(state.layout, nx, ny)) return;

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
}

export function attack(state: RunState): void {
  if (state.mode !== 'combat' || state.activeEnemyIndex === null) return;
  const enemy = state.enemies[state.activeEnemyIndex];
  if (!enemy) return;
  const archetype = ENEMIES[enemy.kind];
  const hero = HEROES[state.heroId];
  const result = resolveExchange(
    state.rng,
    state.player.hp,
    enemy.hp,
    archetype.dmgMin,
    archetype.dmgMax,
    hero.dmgMin,
    hero.dmgMax
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
    return;
  }

  state.player.hp = Math.max(0, state.player.hp - result.enemyDamageDealt);
  pushLog(state, `The ${archetype.name} hits back for ${result.enemyDamageDealt}.`);
  pushEvent(state, { type: 'playerHit', amount: result.enemyDamageDealt, x: state.player.x, y: state.player.y });

  if (result.playerDied) {
    pushLog(state, 'You collapse. Nothing extracted, nothing kept.');
    finishRun(state, 'dead');
  }
}

export function retreat(state: RunState): void {
  if (state.mode !== 'combat') return;
  state.mode = 'explore';
  state.activeEnemyIndex = null;
  pushLog(state, 'You back away.');
}

export function chooseDescend(state: RunState): void {
  if (state.mode !== 'choice') return;
  if (state.floorNumber >= MAX_FLOOR) return;
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
}

export function chooseExtract(state: RunState): void {
  if (state.mode !== 'choice') return;
  pushLog(state, "You extract with what you've gathered.");
  finishRun(state, 'extracted');
}
