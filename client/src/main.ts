import { attack, newRun, retreat, tryMove, type RunState } from './game/state';
import { onAction, type Action } from './input/keyboard';
import { drawRun, drawTitle } from './render/canvas';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context unavailable');

let run: RunState | null = null;

const DIRS: Partial<Record<Action, [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

onAction((action) => {
  if (!run) {
    if (action === 'confirm') run = newRun();
    return;
  }

  if (run.mode === 'result') {
    if (action === 'confirm') run = newRun();
    return;
  }

  if (run.mode === 'combat') {
    if (action === 'confirm') attack(run);
    if (action === 'cancel') retreat(run);
    return;
  }

  const dir = DIRS[action];
  if (dir) tryMove(run, dir[0], dir[1]);
});

function frame(): void {
  if (!run) {
    drawTitle(ctx!);
  } else {
    drawRun(ctx!, run);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
