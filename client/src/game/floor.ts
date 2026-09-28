import type { EnemyKind } from './enemies';

export const GRID_WIDTH = 13;
export const GRID_HEIGHT = 9;
export const TILE_SIZE = 64;
export const MAX_FLOOR = 3;

export type Tile = 'wall' | 'floor';
export type Point = { x: number; y: number };
export type RelicKind = 'common' | 'rare' | 'core';

export interface EnemyPlacement extends Point {
  kind: EnemyKind;
}

export interface RelicPlacement extends Point {
  kind: RelicKind;
}

export interface FloorLayout {
  floorNumber: number;
  grid: Tile[][];
  playerStart: Point;
  enemies: EnemyPlacement[];
  relics: RelicPlacement[];
  stairsPos: Point;
  isFinalFloor: boolean;
}

function emptyGrid(): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      const isBorder = x === 0 || y === 0 || x === GRID_WIDTH - 1 || y === GRID_HEIGHT - 1;
      row.push(isBorder ? 'wall' : 'floor');
    }
    grid.push(row);
  }
  return grid;
}

function setWall(grid: Tile[][], x: number, y: number): void {
  const row = grid[y];
  if (row) row[x] = 'wall';
}

/**
 * Floor 1: an easy read. A guarded gap leads to a dead-end relic pocket
 * (optional risk vault), a longer unguarded detour reaches the stairs
 * directly. Nothing forces combat.
 */
function buildFloor1(): FloorLayout {
  const grid = emptyGrid();
  const dividerX = 6;
  const detourY = 1;
  const guardedY = 4;
  for (let y = 1; y < GRID_HEIGHT - 1; y++) {
    if (y === detourY || y === guardedY) continue;
    setWall(grid, dividerX, y);
  }
  const pocketX = dividerX + 1;
  setWall(grid, pocketX, guardedY - 1);
  setWall(grid, pocketX, guardedY + 1);
  setWall(grid, pocketX + 1, guardedY);

  return {
    floorNumber: 1,
    grid,
    playerStart: { x: 2, y: guardedY },
    enemies: [{ x: dividerX, y: guardedY, kind: 'warden' }],
    relics: [{ x: pocketX, y: guardedY, kind: 'common' }],
    stairsPos: { x: GRID_WIDTH - 3, y: guardedY },
    isFinalFloor: false,
  };
}

/**
 * Floor 2: both gaps are guarded now. The detour has a weaker Skitter (the
 * cheap way through), the direct gap has a tougher Adept guarding a rarer
 * relic pocket. There is no free path anymore, only a cheaper one.
 */
function buildFloor2(): FloorLayout {
  const grid = emptyGrid();
  const dividerX = 6;
  const detourY = 1;
  const guardedY = 4;
  for (let y = 1; y < GRID_HEIGHT - 1; y++) {
    if (y === detourY || y === guardedY) continue;
    setWall(grid, dividerX, y);
  }
  const pocketX = dividerX + 1;
  setWall(grid, pocketX, guardedY - 1);
  setWall(grid, pocketX, guardedY + 1);
  setWall(grid, pocketX + 1, guardedY);

  return {
    floorNumber: 2,
    grid,
    playerStart: { x: 2, y: guardedY },
    enemies: [
      { x: dividerX, y: detourY, kind: 'skitter' },
      { x: dividerX, y: guardedY, kind: 'adept' },
    ],
    relics: [{ x: pocketX, y: guardedY, kind: 'rare' }],
    stairsPos: { x: GRID_WIDTH - 3, y: guardedY },
    isFinalFloor: false,
  };
}

/**
 * Floor 3: the boss arena. One open room, one mandatory gap, no detour.
 * Warden Prime has to fall before the stairs are reachable at all.
 */
function buildFloor3(): FloorLayout {
  const grid = emptyGrid();
  const dividerX = 6;
  const bossY = 4;
  for (let y = 1; y < GRID_HEIGHT - 1; y++) {
    if (y === bossY) continue;
    setWall(grid, dividerX, y);
  }

  return {
    floorNumber: 3,
    grid,
    playerStart: { x: 2, y: bossY },
    enemies: [{ x: dividerX, y: bossY, kind: 'wardenPrime' }],
    relics: [{ x: dividerX + 3, y: bossY, kind: 'core' }],
    stairsPos: { x: GRID_WIDTH - 2, y: bossY },
    isFinalFloor: true,
  };
}

export function buildFloor(floorNumber: number): FloorLayout {
  if (floorNumber >= 3) return buildFloor3();
  if (floorNumber === 2) return buildFloor2();
  return buildFloor1();
}

export function isWalkable(layout: FloorLayout, x: number, y: number): boolean {
  const row = layout.grid[y];
  if (!row) return false;
  return row[x] === 'floor';
}
