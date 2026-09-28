import { resolveExchange } from './combat';
import { buildFloor, isWalkable, type FloorLayout } from './floor';
import { mulberry32, freshSeed, type Rng } from './rng';

export type Mode = 'title' | 'explore' | 'combat' | 'result';
export type ResultKind = 'extracted' | 'dead';

export interface RunState {
  mode: Mode;
  seed: number;
  rng: Rng;
  layout: FloorLayout;
  player: { x: number; y: number; hp: number; maxHp: number };
  enemy: { x: number; y: number; hp: number; maxHp: number; alive: boolean };
  relic: { x: number; y: number; collected: boolean };
  relicsThisRun: number;
  resultKind: ResultKind | null;
  log: string[];
}

const PLAYER_MAX_HP = 10;
const ENEMY_MAX_HP = 6;
const MAX_LOG_LINES = 4;

export function newRun(seed: number = freshSeed()): RunState {
  const layout = buildFloor();
  return {
    mode: 'explore',
    seed,
    rng: mulberry32(seed),
    layout,
    player: { ...layout.playerStart, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP },
    enemy: { ...layout.enemyPos, hp: ENEMY_MAX_HP, maxHp: ENEMY_MAX_HP, alive: true },
    relic: { ...layout.relicPos, collected: false },
    relicsThisRun: 0,
    resultKind: null,
    log: ['You enter the dungeon. Find the stairs, or find your death.'],
  };
}

function pushLog(state: RunState, line: string): void {
  state.log.push(line);
  if (state.log.length > MAX_LOG_LINES) state.log.shift();
}

function atEnemy(state: RunState, x: number, y: number): boolean {
  return state.enemy.alive && state.enemy.x === x && state.enemy.y === y;
}

export function tryMove(state: RunState, dx: number, dy: number): void {
  if (state.mode !== 'explore') return;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;

  if (atEnemy(state, nx, ny)) {
    state.mode = 'combat';
    pushLog(state, 'A Warden blocks the way.');
    return;
  }

  if (!isWalkable(state.layout, nx, ny)) return;

  state.player.x = nx;
  state.player.y = ny;

  if (!state.relic.collected && state.relic.x === nx && state.relic.y === ny) {
    state.relic.collected = true;
    state.relicsThisRun += 1;
    pushLog(state, 'You pry a relic loose. It hums faintly.');
  }

  if (state.layout.stairsPos.x === nx && state.layout.stairsPos.y === ny) {
    state.mode = 'result';
    state.resultKind = 'extracted';
    pushLog(state, 'You reach the stairs and extract.');
  }
}

export function attack(state: RunState): void {
  if (state.mode !== 'combat') return;
  const result = resolveExchange(state.rng, state.player.hp, state.enemy.hp);

  state.enemy.hp = Math.max(0, state.enemy.hp - result.playerDamageDealt);
  pushLog(state, `You strike the Warden for ${result.playerDamageDealt}.`);

  if (result.enemyDied) {
    state.enemy.alive = false;
    state.mode = 'explore';
    pushLog(state, 'The Warden falls. The way is clear.');
    return;
  }

  state.player.hp = Math.max(0, state.player.hp - result.enemyDamageDealt);
  pushLog(state, `The Warden hits back for ${result.enemyDamageDealt}.`);

  if (result.playerDied) {
    state.mode = 'result';
    state.resultKind = 'dead';
    state.relicsThisRun = 0;
    pushLog(state, 'You collapse. Nothing extracted, nothing kept.');
  }
}

export function retreat(state: RunState): void {
  if (state.mode !== 'combat') return;
  state.mode = 'explore';
  pushLog(state, 'You back away from the Warden.');
}
