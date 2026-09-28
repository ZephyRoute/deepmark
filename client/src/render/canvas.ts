import { GRID_WIDTH, GRID_HEIGHT, TILE_SIZE } from '../game/floor';
import type { RunState } from '../game/state';

const COLOR_BG = '#14171f';
const COLOR_WALL = '#2a2f3a';
const COLOR_FLOOR = '#1c2029';
const COLOR_PLAYER = '#4fc3f7';
const COLOR_ENEMY = '#ef5350';
const COLOR_RELIC = '#ffca28';
const COLOR_STAIRS = '#66bb6a';
const COLOR_TEXT = '#e5e7eb';
const COLOR_MUTED = '#6b7280';

export function drawTitle(ctx: CanvasRenderingContext2D): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = COLOR_TEXT;
  ctx.font = 'bold 48px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DEEPMARK', w / 2, h / 2 - 40);

  ctx.font = '18px ui-monospace, monospace';
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText('a mark left in the depths', w / 2, h / 2 - 4);

  ctx.fillStyle = COLOR_TEXT;
  ctx.font = 'bold 20px ui-monospace, monospace';
  ctx.fillText('[ Enter ] Descend', w / 2, h / 2 + 60);
}

export function drawRun(ctx: CanvasRenderingContext2D, run: RunState): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, w, h);

  const offsetX = (w - GRID_WIDTH * TILE_SIZE) / 2;
  const offsetY = 24;

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = run.layout.grid[y]?.[x];
      ctx.fillStyle = tile === 'wall' ? COLOR_WALL : COLOR_FLOOR;
      ctx.fillRect(offsetX + x * TILE_SIZE, offsetY + y * TILE_SIZE, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }

  const cellCenter = (x: number, y: number) => ({
    cx: offsetX + x * TILE_SIZE + TILE_SIZE / 2,
    cy: offsetY + y * TILE_SIZE + TILE_SIZE / 2,
  });

  const stairs = cellCenter(run.layout.stairsPos.x, run.layout.stairsPos.y);
  ctx.fillStyle = COLOR_STAIRS;
  ctx.fillRect(stairs.cx - 22, stairs.cy - 22, 44, 44);

  if (!run.relic.collected) {
    const relic = cellCenter(run.relic.x, run.relic.y);
    ctx.fillStyle = COLOR_RELIC;
    ctx.beginPath();
    ctx.arc(relic.cx, relic.cy, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  if (run.enemy.alive) {
    const enemy = cellCenter(run.enemy.x, run.enemy.y);
    ctx.fillStyle = COLOR_ENEMY;
    ctx.fillRect(enemy.cx - 20, enemy.cy - 20, 40, 40);
  }

  const player = cellCenter(run.player.x, run.player.y);
  ctx.fillStyle = COLOR_PLAYER;
  ctx.beginPath();
  ctx.arc(player.cx, player.cy, 18, 0, Math.PI * 2);
  ctx.fill();

  drawHud(ctx, run, offsetY + GRID_HEIGHT * TILE_SIZE + 16);

  if (run.mode === 'combat') {
    drawCombatPrompt(ctx, w, h);
  }

  if (run.mode === 'result' && run.resultKind) {
    drawResult(ctx, w, h, run);
  }
}

function drawHud(ctx: CanvasRenderingContext2D, run: RunState, y: number): void {
  ctx.textAlign = 'left';
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText(`HP ${run.player.hp}/${run.player.maxHp}`, 24, y);
  ctx.fillText(`Relics ${run.relicsThisRun}`, 200, y);

  ctx.fillStyle = COLOR_MUTED;
  const lastLine = run.log[run.log.length - 1];
  if (lastLine) ctx.fillText(lastLine, 24, y + 24);
}

function drawCombatPrompt(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
  ctx.fillRect(w / 2 - 220, h / 2 - 50, 440, 100);
  ctx.strokeStyle = COLOR_ENEMY;
  ctx.strokeRect(w / 2 - 220, h / 2 - 50, 440, 100);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = 'bold 18px ui-monospace, monospace';
  ctx.fillText('A Warden blocks the way.', w / 2, h / 2 - 12);
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillText('[ Enter ] Attack    [ Esc ] Retreat', w / 2, h / 2 + 20);
}

function drawResult(ctx: CanvasRenderingContext2D, w: number, h: number, run: RunState): void {
  ctx.fillStyle = 'rgba(11, 13, 18, 0.92)';
  ctx.fillRect(0, 0, w, h);

  const won = run.resultKind === 'extracted';
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? COLOR_STAIRS : COLOR_ENEMY;
  ctx.font = 'bold 40px ui-monospace, monospace';
  ctx.fillText(won ? 'EXTRACTED' : 'YOU DIED', w / 2, h / 2 - 60);

  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '18px ui-monospace, monospace';
  ctx.fillText('Floor 1', w / 2, h / 2 - 10);
  ctx.fillText(`Relics kept: ${run.relicsThisRun}`, w / 2, h / 2 + 20);
  if (won) ctx.fillText(`HP remaining: ${run.player.hp}`, w / 2, h / 2 + 50);

  ctx.fillStyle = COLOR_MUTED;
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillText('[ Enter ] Play again', w / 2, h / 2 + 90);
}
