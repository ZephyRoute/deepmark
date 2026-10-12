import { RUN_CUES, type RunCue } from './footage-map';
import type { Rect } from './components/Footage';

/** Where the game's board sits in the 1920 by 1080 layout: 13 by 9 tiles of about 103 px. */
const BOARD_X = 288;
const BOARD_Y = 77;
const TILE = 1344 / 13;
const BOARD_W = 1344;
const BOARD_H = 9 * TILE;

/** How far back, in seconds, the camera remembers where the action was. Larger is lazier. */
const MEMORY = 0.7;
const TAPS = 8;

const centerOf = (tx: number, ty: number): { x: number; y: number } => ({
  x: BOARD_X + (tx + 0.5) * TILE,
  y: BOARD_Y + (ty + 0.5) * TILE,
});

function focusAt(t: number): { x: number; y: number } {
  let latest: RunCue | undefined;
  for (const cue of RUN_CUES) {
    if (cue.t <= t) latest = cue;
    else break;
  }
  const cue = latest ?? RUN_CUES[0];
  if (!cue) return centerOf(6, 4);
  const player = centerOf(cue.player.x, cue.player.y);
  if (!cue.enemy) return player;
  const enemy = centerOf(cue.enemy.x, cue.enemy.y);
  return { x: (player.x * 2 + enemy.x) / 3, y: (player.y * 2 + enemy.y) / 3 };
}

/**
 * A camera that follows the delver and leans toward the guard in a fight. It is
 * a pure function of the recording's time, so any frame renders on its own:
 * the target is averaged over the last moments with a fading weight, which is
 * what a damped camera does, without needing the previous frame.
 */
export function followCamera(width: number): (t: number) => Rect {
  const height = (width * 9) / 16;
  return (t) => {
    let x = 0;
    let y = 0;
    let weight = 0;
    for (let i = 0; i < TAPS; i += 1) {
      const w = Math.exp(-(i / (TAPS - 1)) * 2.2);
      const f = focusAt(t - (i / (TAPS - 1)) * MEMORY);
      x += f.x * w;
      y += f.y * w;
      weight += w;
    }
    const cx = x / weight;
    const cy = y / weight;
    return {
      x: Math.min(Math.max(cx - width / 2, BOARD_X), BOARD_X + BOARD_W - width),
      y: Math.min(Math.max(cy - height / 2, BOARD_Y), BOARD_Y + BOARD_H - height),
      w: width,
      h: height,
    };
  };
}
