export const GRID_WIDTH = 13;
export const GRID_HEIGHT = 9;
export const TILE_SIZE = 64;

export type Tile = 'wall' | 'floor';
export type Point = { x: number; y: number };

export interface FloorLayout {
  grid: Tile[][];
  playerStart: Point;
  enemyPos: Point;
  relicPos: Point;
  stairsPos: Point;
}

/**
 * The floor 1 layout is fixed for the graybox: a divider wall with one
 * guarded gap (leads straight to the relic, guaranteed combat) and one
 * open detour gap (longer, safe, no loot). The seed drives combat rolls,
 * not the layout, until Phase 2 adds procedural generation on top of a
 * committed on-chain seed.
 */
export function buildFloor(): FloorLayout {
  const grid: Tile[][] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      const isBorder = x === 0 || y === 0 || x === GRID_WIDTH - 1 || y === GRID_HEIGHT - 1;
      row.push(isBorder ? 'wall' : 'floor');
    }
    grid.push(row);
  }

  const dividerX = 6;
  const detourY = 1;
  const guardedY = 4;
  for (let y = 1; y < GRID_HEIGHT - 1; y++) {
    if (y === detourY || y === guardedY) continue;
    const row = grid[y];
    if (row) row[dividerX] = 'wall';
  }

  const relicPocketX = dividerX + 1;
  const setWall = (x: number, y: number) => {
    const row = grid[y];
    if (row) row[x] = 'wall';
  };
  setWall(relicPocketX, guardedY - 1);
  setWall(relicPocketX, guardedY + 1);
  setWall(relicPocketX + 1, guardedY);

  return {
    grid,
    playerStart: { x: 2, y: guardedY },
    enemyPos: { x: dividerX, y: guardedY },
    relicPos: { x: relicPocketX, y: guardedY },
    stairsPos: { x: GRID_WIDTH - 3, y: guardedY },
  };
}

export function isWalkable(layout: FloorLayout, x: number, y: number): boolean {
  const row = layout.grid[y];
  if (!row) return false;
  return row[x] === 'floor';
}
