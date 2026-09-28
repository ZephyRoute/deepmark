import {
  attack,
  chooseDescend,
  chooseExtract,
  drainEvents,
  newRun,
  retreat,
  tryMove,
  type GameEvent,
  type RunState,
} from './game/state';
import { loadProgress, type Progress } from './game/progress';
import { onAction, type Action } from './input/keyboard';
import { drawRun, drawTitle } from './render/canvas';
import { spawnPopup, triggerShake } from './render/effects';
import {
  sfxDead,
  sfxDescend,
  sfxEnemyDied,
  sfxExtracted,
  sfxFloorCleared,
  sfxHitEnemy,
  sfxHitPlayer,
  sfxRelic,
} from './render/audio';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context unavailable');

let run: RunState | null = null;
let progress: Progress = loadProgress();

const DIRS: Partial<Record<Action, [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

function handleEvent(event: GameEvent): void {
  switch (event.type) {
    case 'enemyHit':
      spawnPopup(event.x, event.y, `-${event.amount}`, '#e5e7eb');
      sfxHitEnemy();
      triggerShake(100, 4);
      break;
    case 'playerHit':
      spawnPopup(event.x, event.y, `-${event.amount}`, '#ef5350');
      sfxHitPlayer();
      triggerShake(150, 7);
      break;
    case 'enemyDied':
      sfxEnemyDied();
      triggerShake(120, 5);
      break;
    case 'relic':
      spawnPopup(event.x, event.y, '+relic', '#ffca28');
      sfxRelic();
      break;
    case 'floorCleared':
      sfxFloorCleared();
      break;
    case 'descended':
      sfxDescend();
      break;
    case 'extracted':
      sfxExtracted();
      progress = loadProgress();
      break;
    case 'dead':
      sfxDead();
      triggerShake(250, 10);
      progress = loadProgress();
      break;
    case 'combatStart':
      break;
  }
}

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
  } else if (run.mode === 'choice') {
    if (action === 'confirm') chooseDescend(run);
    if (action === 'cancel') chooseExtract(run);
  } else {
    const dir = DIRS[action];
    if (dir) tryMove(run, dir[0], dir[1]);
  }

  for (const event of drainEvents(run)) handleEvent(event);
});

function frame(): void {
  if (!run) {
    drawTitle(ctx!, progress);
  } else {
    drawRun(ctx!, run, progress);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
