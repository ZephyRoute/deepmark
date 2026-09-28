import { ENEMIES } from '../game/enemies';
import { GRID_WIDTH, GRID_HEIGHT, TILE_SIZE, MAX_FLOOR } from '../game/floor';
import type { Progress } from '../game/progress';
import type { RelicKind } from '../game/floor';
import type { RunState } from '../game/state';
import { drawPopups, getShakeOffset } from './effects';

const COLOR_BG = '#14171f';
const COLOR_WALL = '#2a2f3a';
const COLOR_FLOOR = '#1c2029';
const COLOR_PLAYER = '#4fc3f7';
const COLOR_STAIRS = '#66bb6a';
const COLOR_TEXT = '#e5e7eb';
const COLOR_MUTED = '#6b7280';
const COLOR_HPBACK = '#2a2f3a';
const COLOR_HP = '#66bb6a';
const COLOR_HP_LOW = '#ef5350';

const RELIC_COLOR: Record<RelicKind, string> = {
  common: '#ffca28',
  rare: '#26c6da',
  core: '#ff7043',
};
const RELIC_RADIUS: Record<RelicKind, number> = { common: 12, rare: 16, core: 20 };

const OFFSET_Y = 40;

function gridOffsetX(canvasWidth: number): number {
  return (canvasWidth - GRID_WIDTH * TILE_SIZE) / 2;
}

export function drawTitle(ctx: CanvasRenderingContext2D, progress: Progress): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = COLOR_TEXT;
  ctx.font = 'bold 48px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DEEPMARK', w / 2, h / 2 - 60);

  ctx.font = '18px ui-monospace, monospace';
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText('a mark left in the depths', w / 2, h / 2 - 24);

  ctx.fillStyle = COLOR_TEXT;
  ctx.font = 'bold 20px ui-monospace, monospace';
  ctx.fillText('[ Enter ] Descend', w / 2, h / 2 + 30);

  if (progress.runsPlayed > 0) {
    ctx.font = '15px ui-monospace, monospace';
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText(
      `Best floor: ${progress.bestFloor} / ${MAX_FLOOR}    Best relics: ${progress.bestRelics}    Runs: ${progress.runsPlayed}`,
      w / 2,
      h / 2 + 70
    );
  }
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}

function drawTriangle(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size / 2);
  ctx.lineTo(cx + size / 2, cy + size / 2);
  ctx.lineTo(cx - size / 2, cy + size / 2);
  ctx.closePath();
  ctx.fill();
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  width: number,
  ratio: number,
  lowThreshold: number
): void {
  const height = 6;
  ctx.fillStyle = COLOR_HPBACK;
  ctx.fillRect(cx - width / 2, topY, width, height);
  ctx.fillStyle = ratio <= lowThreshold ? COLOR_HP_LOW : COLOR_HP;
  ctx.fillRect(cx - width / 2, topY, width * Math.max(0, ratio), height);
}

export function drawRun(ctx: CanvasRenderingContext2D, run: RunState, progress: Progress): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px ui-monospace, monospace';
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(`Floor ${run.floorNumber} / ${MAX_FLOOR}`, w / 2, 24);

  const offsetX = gridOffsetX(w);
  const [shakeX, shakeY] = getShakeOffset();

  ctx.save();
  ctx.translate(shakeX, shakeY);

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = run.layout.grid[y]?.[x];
      ctx.fillStyle = tile === 'wall' ? COLOR_WALL : COLOR_FLOOR;
      ctx.fillRect(offsetX + x * TILE_SIZE, OFFSET_Y + y * TILE_SIZE, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }

  const cellCenter = (x: number, y: number) => ({
    cx: offsetX + x * TILE_SIZE + TILE_SIZE / 2,
    cy: OFFSET_Y + y * TILE_SIZE + TILE_SIZE / 2,
  });

  const stairs = cellCenter(run.layout.stairsPos.x, run.layout.stairsPos.y);
  ctx.fillStyle = COLOR_STAIRS;
  ctx.fillRect(stairs.cx - 22, stairs.cy - 22, 44, 44);

  for (const relic of run.relics) {
    if (relic.collected) continue;
    const { cx, cy } = cellCenter(relic.x, relic.y);
    const color = RELIC_COLOR[relic.kind];
    const radius = RELIC_RADIUS[relic.kind];
    if (relic.kind === 'common') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawDiamond(ctx, cx, cy, radius, color);
    }
  }

  for (const enemy of run.enemies) {
    if (!enemy.alive) continue;
    const archetype = ENEMIES[enemy.kind];
    const { cx, cy } = cellCenter(enemy.x, enemy.y);
    if (archetype.shape === 'triangle') {
      drawTriangle(ctx, cx, cy, archetype.size, archetype.color);
    } else {
      ctx.fillStyle = archetype.color;
      const half = archetype.size / 2;
      ctx.fillRect(cx - half, cy - half, archetype.size, archetype.size);
      if (archetype.isBoss) {
        ctx.strokeStyle = '#e1bee7';
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - half - 4, cy - half - 4, archetype.size + 8, archetype.size + 8);
      }
    }
    drawBar(ctx, cx, cy - archetype.size / 2 - 14, archetype.size, enemy.hp / enemy.maxHp, 0.34);
  }

  const player = cellCenter(run.player.x, run.player.y);
  ctx.fillStyle = COLOR_PLAYER;
  ctx.beginPath();
  ctx.arc(player.cx, player.cy, 18, 0, Math.PI * 2);
  ctx.fill();
  drawBar(ctx, player.cx, player.cy - 32, 36, run.player.hp / run.player.maxHp, 0.3);

  drawPopups(ctx, cellCenter);

  ctx.restore();

  drawHud(ctx, run, OFFSET_Y + GRID_HEIGHT * TILE_SIZE + 20);

  if (run.mode === 'combat') drawCombatPrompt(ctx, w, h, run);
  if (run.mode === 'choice') drawChoicePrompt(ctx, w, h, run);
  if (run.mode === 'result' && run.resultKind) drawResult(ctx, w, h, run, progress);
}

function drawHud(ctx: CanvasRenderingContext2D, run: RunState, y: number): void {
  ctx.textAlign = 'left';
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText(`HP ${run.player.hp}/${run.player.maxHp}`, 24, y);
  ctx.fillText(`Relics ${run.relicsThisRun}`, 200, y);
  ctx.fillText(`Score ${run.scoreThisRun}`, 360, y);

  ctx.fillStyle = COLOR_MUTED;
  const lastLine = run.log[run.log.length - 1];
  if (lastLine) ctx.fillText(lastLine, 24, y + 24);
}

function drawPromptBox(ctx: CanvasRenderingContext2D, w: number, h: number, borderColor: string): void {
  ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
  ctx.fillRect(w / 2 - 240, h / 2 - 55, 480, 110);
  ctx.strokeStyle = borderColor;
  ctx.strokeRect(w / 2 - 240, h / 2 - 55, 480, 110);
}

function drawCombatPrompt(ctx: CanvasRenderingContext2D, w: number, h: number, run: RunState): void {
  const enemy = run.activeEnemyIndex !== null ? run.enemies[run.activeEnemyIndex] : undefined;
  const name = enemy ? ENEMIES[enemy.kind].name : 'Something';
  drawPromptBox(ctx, w, h, '#ef5350');
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = 'bold 18px ui-monospace, monospace';
  ctx.fillText(`A ${name} blocks the way.`, w / 2, h / 2 - 14);
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillText('[ Enter ] Attack    [ Esc ] Retreat', w / 2, h / 2 + 20);
}

function drawChoicePrompt(ctx: CanvasRenderingContext2D, w: number, h: number, run: RunState): void {
  drawPromptBox(ctx, w, h, '#66bb6a');
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = 'bold 18px ui-monospace, monospace';
  ctx.fillText(`Floor ${run.floorNumber} cleared. ${run.relicsThisRun} relics banked.`, w / 2, h / 2 - 14);
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillText('[ Enter ] Descend, harder    [ Esc ] Extract, safe', w / 2, h / 2 + 20);
}

function drawResult(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  run: RunState,
  progress: Progress
): void {
  ctx.fillStyle = 'rgba(11, 13, 18, 0.92)';
  ctx.fillRect(0, 0, w, h);

  const won = run.resultKind === 'extracted';
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? COLOR_STAIRS : '#ef5350';
  ctx.font = 'bold 40px ui-monospace, monospace';
  ctx.fillText(won ? 'EXTRACTED' : 'YOU DIED', w / 2, h / 2 - 90);

  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '18px ui-monospace, monospace';
  ctx.fillText(`Floor reached: ${run.floorNumber} / ${MAX_FLOOR}`, w / 2, h / 2 - 40);
  ctx.fillText(`Relics kept: ${run.relicsThisRun}    Score: ${won ? run.scoreThisRun : 0}`, w / 2, h / 2 - 10);
  if (won) ctx.fillText(`HP remaining: ${run.player.hp}`, w / 2, h / 2 + 20);

  if (run.newBest) {
    ctx.fillStyle = '#ffca28';
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.fillText('NEW BEST!', w / 2, h / 2 + 50);
  }

  ctx.fillStyle = COLOR_MUTED;
  ctx.font = '14px ui-monospace, monospace';
  ctx.fillText(
    `Best floor: ${progress.bestFloor} / ${MAX_FLOOR}    Best relics: ${progress.bestRelics}`,
    w / 2,
    h / 2 + 80
  );

  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillText('[ Enter ] Play again', w / 2, h / 2 + 115);
}
