import { ENEMIES } from '../game/enemies';
import { GRID_WIDTH, GRID_HEIGHT, TILE_SIZE, MAX_FLOOR } from '../game/floor';
import type { Progress } from '../game/progress';
import type { RelicKind } from '../game/floor';
import type { RunState } from '../game/state';
import { drawPopups, getShakeOffset } from './effects';

const COLOR_BG = '#0d1017';
const COLOR_WALL = '#242938';
const COLOR_FLOOR = '#1a1e29';
const COLOR_FLOOR_ALT = '#171b25';
const COLOR_PLAYER = '#4fc3f7';
const COLOR_STAIRS = '#66bb6a';
const COLOR_TEXT = '#e5e7eb';
const COLOR_MUTED = '#6b7280';
const COLOR_HPBACK = '#2a2f3a';
const COLOR_HP = '#66bb6a';
const COLOR_HP_LOW = '#ef5350';
const COLOR_PANEL = 'rgba(19, 22, 31, 0.72)';
const COLOR_PANEL_BORDER = 'rgba(255, 255, 255, 0.08)';

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

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string, strength = 0.55): void {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, withAlpha(color, strength));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = COLOR_PANEL;
  ctx.fill();
  ctx.strokeStyle = COLOR_PANEL_BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function fillVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, w, h);
  const gradient = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.max(w, h) * 0.7);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

interface Mote {
  x: number;
  baseY: number;
  speed: number;
  size: number;
  drift: number;
  phase: number;
}

let motes: Mote[] | null = null;

function ensureMotes(w: number, h: number): Mote[] {
  if (!motes) {
    motes = Array.from({ length: 36 }, () => ({
      x: Math.random() * w,
      baseY: Math.random() * h,
      speed: 5 + Math.random() * 12,
      size: 1 + Math.random() * 1.8,
      drift: (Math.random() - 0.5) * 10,
      phase: Math.random() * Math.PI * 2,
    }));
  }
  return motes;
}

function drawMotes(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const list = ensureMotes(w, h);
  const t = performance.now() / 1000;
  for (const mote of list) {
    const y = (((mote.baseY - t * mote.speed) % h) + h) % h;
    const x = mote.x + Math.sin(t * 0.6 + mote.phase) * mote.drift;
    const twinkle = 0.15 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2 + mote.phase));
    ctx.fillStyle = withAlpha(COLOR_PLAYER, twinkle);
    ctx.beginPath();
    ctx.arc(x, y, mote.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawTitle(ctx: CanvasRenderingContext2D, progress: Progress, onchainSummary: string): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  fillVignette(ctx, w, h);
  drawMotes(ctx, w, h);

  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 900);
  drawGlow(ctx, w / 2, h / 2 - 60, 170 + pulse * 25, COLOR_PLAYER, 0.22);

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

  ctx.font = '14px ui-monospace, monospace';
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText('[ L ] Leaderboard', w / 2, h / 2 + 58);

  if (progress.runsPlayed > 0) {
    ctx.font = '15px ui-monospace, monospace';
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText(
      `Best floor: ${progress.bestFloor} / ${MAX_FLOOR}    Best relics: ${progress.bestRelics}    Runs: ${progress.runsPlayed}`,
      w / 2,
      h / 2 + 90
    );
  }

  if (onchainSummary) {
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillStyle = COLOR_PLAYER;
    ctx.fillText(onchainSummary, w / 2, h / 2 + 115);
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
  roundRect(ctx, cx - width / 2, topY, width, height, 3);
  ctx.fillStyle = COLOR_HPBACK;
  ctx.fill();
  const fillWidth = width * Math.max(0, ratio);
  if (fillWidth > 0) {
    roundRect(ctx, cx - width / 2, topY, fillWidth, height, 3);
    ctx.fillStyle = ratio <= lowThreshold ? COLOR_HP_LOW : COLOR_HP;
    ctx.fill();
  }
}

export function drawRun(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  progress: Progress,
  chainStatus: string
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  fillVignette(ctx, w, h);

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px ui-monospace, monospace';
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(`Floor ${run.floorNumber} / ${MAX_FLOOR}`, w / 2, 24);

  const offsetX = gridOffsetX(w);
  const [shakeX, shakeY] = getShakeOffset();
  const t = performance.now() / 1000;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = run.layout.grid[y]?.[x];
      const checker = (x + y) % 2 === 0;
      ctx.fillStyle = tile === 'wall' ? COLOR_WALL : checker ? COLOR_FLOOR : COLOR_FLOOR_ALT;
      const tx = offsetX + x * TILE_SIZE;
      const ty = OFFSET_Y + y * TILE_SIZE;
      ctx.fillRect(tx, ty, TILE_SIZE - 2, TILE_SIZE - 2);
      if (tile === 'wall') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(tx, ty, TILE_SIZE - 2, 3);
      }
    }
  }

  const cellCenter = (x: number, y: number) => ({
    cx: offsetX + x * TILE_SIZE + TILE_SIZE / 2,
    cy: OFFSET_Y + y * TILE_SIZE + TILE_SIZE / 2,
  });

  const stairs = cellCenter(run.layout.stairsPos.x, run.layout.stairsPos.y);
  const stairsPulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  drawGlow(ctx, stairs.cx, stairs.cy, 40 + stairsPulse * 6, COLOR_STAIRS, 0.5);
  ctx.fillStyle = COLOR_STAIRS;
  ctx.fillRect(stairs.cx - 22, stairs.cy - 22, 44, 44);

  for (const relic of run.relics) {
    if (relic.collected) continue;
    const { cx, cy } = cellCenter(relic.x, relic.y);
    const bob = Math.sin(t * 3 + cx * 0.1) * 3;
    const color = RELIC_COLOR[relic.kind];
    const radius = RELIC_RADIUS[relic.kind];
    drawGlow(ctx, cx, cy + bob, radius * 2.4, color, 0.5);
    if (relic.kind === 'common') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy + bob, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawDiamond(ctx, cx, cy + bob, radius, color);
    }
  }

  for (const enemy of run.enemies) {
    if (!enemy.alive) continue;
    const archetype = ENEMIES[enemy.kind];
    const { cx, cy } = cellCenter(enemy.x, enemy.y);
    const pulse = 1 + 0.03 * Math.sin(t * 3 + cx * 0.2 + cy * 0.3);
    drawGlow(ctx, cx, cy, archetype.size * (archetype.isBoss ? 1.6 : 1.1), archetype.color, archetype.isBoss ? 0.5 : 0.32);
    if (archetype.shape === 'triangle') {
      drawTriangle(ctx, cx, cy, archetype.size * pulse, archetype.color);
    } else {
      ctx.fillStyle = archetype.color;
      const half = (archetype.size * pulse) / 2;
      ctx.fillRect(cx - half, cy - half, archetype.size * pulse, archetype.size * pulse);
      if (archetype.isBoss) {
        ctx.strokeStyle = withAlpha('#e1bee7', 0.7 + 0.3 * Math.sin(t * 4));
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - half - 4, cy - half - 4, archetype.size * pulse + 8, archetype.size * pulse + 8);
      }
    }
    drawBar(ctx, cx, cy - archetype.size / 2 - 14, archetype.size, enemy.hp / enemy.maxHp, 0.34);
  }

  const player = cellCenter(run.player.x, run.player.y);
  const playerPulse = 1 + 0.05 * Math.sin(t * 4);
  drawGlow(ctx, player.cx, player.cy, 30 * playerPulse, COLOR_PLAYER, 0.45);
  ctx.fillStyle = COLOR_PLAYER;
  ctx.beginPath();
  ctx.arc(player.cx, player.cy, 18, 0, Math.PI * 2);
  ctx.fill();
  drawBar(ctx, player.cx, player.cy - 32, 36, run.player.hp / run.player.maxHp, 0.3);

  drawPopups(ctx, cellCenter);

  ctx.restore();

  drawHud(ctx, run, OFFSET_Y + GRID_HEIGHT * TILE_SIZE + 16, offsetX);

  if (run.mode === 'combat') drawCombatPrompt(ctx, w, h, run);
  if (run.mode === 'choice') drawChoicePrompt(ctx, w, h, run);
  if (run.mode === 'result' && run.resultKind) drawResult(ctx, w, h, run, progress, chainStatus);
}

function drawHud(ctx: CanvasRenderingContext2D, run: RunState, y: number, offsetX: number): void {
  const panelW = GRID_WIDTH * TILE_SIZE - 4;
  drawPanel(ctx, offsetX, y, panelW, 58);

  ctx.textAlign = 'left';
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText(`HP ${run.player.hp}/${run.player.maxHp}`, offsetX + 20, y + 24);
  ctx.fillText(`Relics ${run.relicsThisRun}`, offsetX + 196, y + 24);
  ctx.fillText(`Score ${run.scoreThisRun}`, offsetX + 356, y + 24);

  ctx.fillStyle = COLOR_MUTED;
  const lastLine = run.log[run.log.length - 1];
  if (lastLine) ctx.fillText(lastLine, offsetX + 20, y + 46);
}

function drawPromptBox(ctx: CanvasRenderingContext2D, w: number, h: number, borderColor: string): void {
  roundRect(ctx, w / 2 - 240, h / 2 - 55, 480, 110, 12);
  ctx.fillStyle = 'rgba(11, 13, 18, 0.88)';
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCombatPrompt(ctx: CanvasRenderingContext2D, w: number, h: number, run: RunState): void {
  const enemy = run.activeEnemyIndex !== null ? run.enemies[run.activeEnemyIndex] : undefined;
  const name = enemy ? ENEMIES[enemy.kind].name : 'Something';
  drawPromptBox(ctx, w, h, 'rgba(239, 83, 80, 0.6)');
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = 'bold 18px ui-monospace, monospace';
  ctx.fillText(`A ${name} blocks the way.`, w / 2, h / 2 - 14);
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillText('[ Enter ] Attack    [ Esc ] Retreat', w / 2, h / 2 + 20);
}

function drawChoicePrompt(ctx: CanvasRenderingContext2D, w: number, h: number, run: RunState): void {
  drawPromptBox(ctx, w, h, 'rgba(102, 187, 106, 0.6)');
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
  progress: Progress,
  chainStatus: string
): void {
  ctx.fillStyle = 'rgba(11, 13, 18, 0.92)';
  ctx.fillRect(0, 0, w, h);

  const won = run.resultKind === 'extracted';
  const accent = won ? COLOR_STAIRS : '#ef5350';
  drawGlow(ctx, w / 2, h / 2 - 90, 140, accent, 0.28);

  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 40px ui-monospace, monospace';
  ctx.fillText(won ? 'EXTRACTED' : 'YOU DIED', w / 2, h / 2 - 90);

  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '18px ui-monospace, monospace';
  ctx.fillText(`Floor reached: ${run.floorNumber} / ${MAX_FLOOR}`, w / 2, h / 2 - 40);
  ctx.fillText(`Relics kept: ${run.relicsThisRun}    Score: ${won ? run.scoreThisRun : 0}`, w / 2, h / 2 - 10);
  if (won) ctx.fillText(`HP remaining: ${run.player.hp}`, w / 2, h / 2 + 20);

  if (run.newBest) {
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 200);
    ctx.fillStyle = withAlpha('#ffca28', pulse);
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

  if (chainStatus) {
    ctx.fillStyle = COLOR_PLAYER;
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillText(chainStatus, w / 2, h / 2 + 140);
  }
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export interface LeaderboardRow {
  address: string;
  bestFloor: number;
  bestRelics: number;
  totalRuns: number;
}

export function drawLeaderboard(
  ctx: CanvasRenderingContext2D,
  rows: LeaderboardRow[] | null,
  loading: boolean,
  playerAddress: string
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  fillVignette(ctx, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = 'bold 28px ui-monospace, monospace';
  ctx.fillText('LEADERBOARD', w / 2, 70);

  ctx.font = '13px ui-monospace, monospace';
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText('Stellar testnet, read live from the deployed contract', w / 2, 96);

  if (loading) {
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = '16px ui-monospace, monospace';
    ctx.fillText('Loading...', w / 2, h / 2);
  } else if (!rows || rows.length === 0) {
    ctx.fillStyle = COLOR_MUTED;
    ctx.font = '16px ui-monospace, monospace';
    ctx.fillText('No runs recorded on-chain yet.', w / 2, h / 2);
  } else {
    const startY = 150;
    const rowHeight = 36;
    drawPanel(ctx, w / 2 - 280, startY - 34, 560, rowHeight * (rows.length + 1) + 16);

    ctx.font = '15px ui-monospace, monospace';
    ctx.textAlign = 'left';

    const colRank = w / 2 - 260;
    const colAddress = w / 2 - 200;
    const colFloor = w / 2 + 40;
    const colRelics = w / 2 + 130;
    const colRuns = w / 2 + 220;

    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText('#', colRank, startY);
    ctx.fillText('player', colAddress, startY);
    ctx.fillText('floor', colFloor, startY);
    ctx.fillText('relics', colRelics, startY);
    ctx.fillText('runs', colRuns, startY);

    rows.forEach((row, index) => {
      const y = startY + rowHeight * (index + 1);
      const isYou = row.address === playerAddress;
      if (isYou) {
        roundRect(ctx, w / 2 - 270, y - 22, 540, 30, 6);
        ctx.fillStyle = withAlpha(COLOR_PLAYER, 0.12);
        ctx.fill();
      }
      ctx.fillStyle = isYou ? COLOR_PLAYER : COLOR_TEXT;
      ctx.fillText(`${index + 1}`, colRank, y);
      ctx.fillText(isYou ? `${shortenAddress(row.address)} (you)` : shortenAddress(row.address), colAddress, y);
      ctx.fillText(`${row.bestFloor} / ${MAX_FLOOR}`, colFloor, y);
      ctx.fillText(`${row.bestRelics}`, colRelics, y);
      ctx.fillText(`${row.totalRuns}`, colRuns, y);
    });
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR_MUTED;
  ctx.font = '14px ui-monospace, monospace';
  ctx.fillText('[ L ] or [ Esc ] Back', w / 2, h - 40);
}
