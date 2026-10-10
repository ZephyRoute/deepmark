/**
 * A fixed player policy used by the tools: take the floor 1 relic, then only
 * the fights that block the way, and always descend. It is not a person, it
 * is a reproducible yardstick.
 */
import { isWalkable, type Point } from '../src/game/floor';
import { ActionCode, applyAction, type RunState } from '../src/game/state';

const MOVES = [
  { code: ActionCode.Up, dx: 0, dy: -1 },
  { code: ActionCode.Down, dx: 0, dy: 1 },
  { code: ActionCode.Left, dx: -1, dy: 0 },
  { code: ActionCode.Right, dx: 1, dy: 0 },
];

function stepToward(state: RunState, goal: Point, avoid: boolean): ActionCode | null {
  const key = (p: Point): string => `${p.x},${p.y}`;
  const blocked = new Set<string>();
  if (avoid) for (const e of state.enemies) if (e.alive) blocked.add(key(e));
  const start = { x: state.player.x, y: state.player.y };
  const first = new Map<string, ActionCode>();
  const seen = new Set<string>([key(start)]);
  const queue: Point[] = [start];
  while (queue.length) {
    const at = queue.shift() as Point;
    if (at.x === goal.x && at.y === goal.y) return first.get(key(at)) ?? null;
    for (const m of MOVES) {
      const n = { x: at.x + m.dx, y: at.y + m.dy };
      const k = key(n);
      if (seen.has(k) || !isWalkable(state.layout, n.x, n.y) || blocked.has(k)) continue;
      seen.add(k);
      first.set(k, first.get(key(at)) ?? m.code);
      queue.push(n);
    }
  }
  return null;
}

/** Plays a run with the balanced policy until it ends, or until it holds `maxActions` actions, and returns the state. */
export function playBalanced(state: RunState, maxActions: number = Infinity): RunState {
  for (let step = 0; step < 800 && state.mode !== 'result' && state.actions.length < maxActions; step++) {
    if (state.mode === 'combat') applyAction(state, ActionCode.Attack);
    else if (state.mode === 'choice') applyAction(state, ActionCode.Descend);
    else {
      const relic = state.relics.find((r) => !r.collected);
      const wants = state.floorNumber === 1;
      const goal: Point = wants && relic ? relic : state.layout.stairsPos;
      const code = stepToward(state, goal, !wants) ?? stepToward(state, goal, false);
      if (code === null) break;
      applyAction(state, code);
    }
  }
  return state;
}
