import { GRID_WIDTH, GRID_HEIGHT, TILE_SIZE } from '../game/floor';
import type { RelicKind } from '../game/floor';
import type { RunState } from '../game/state';
import { drawPopups, getShakeOffset } from './effects';

const COLOR_BG = '#07080e';
const COLOR_HPBACK = '#1c2230';
const COLOR_HP = '#7dffb3';
const COLOR_HP_LOW = '#ff6b5a';

const RELIC_SIZE: Record<RelicKind, number> = { common: 34, rare: 42, core: 52 };
const ACTOR_SIZE = {
  player: 74,
  warden: 78,
  skitter: 50,
  adept: 76,
  wardenPrime: 96,
} as const;

let facing: 1 | -1 = 1;

export function face(direction: 1 | -1): void {
  facing = direction;
}

function loadArt(file: string): HTMLImageElement {
  const image = new Image();
  image.decoding = 'async';
  image.src = `/art/${file}`;
  return image;
}

const art = {
  floor: loadArt('floor.jpg'),
  wall: loadArt('wall.jpg'),
  stairs: loadArt('stairs.jpg'),
  player: loadArt('player.png'),
  warden: loadArt('warden.png'),
  skitter: loadArt('skitter.png'),
  adept: loadArt('adept.png'),
  wardenPrime: loadArt('warden-prime.png'),
  common: loadArt('relic-common.png'),
  rare: loadArt('relic-rare.png'),
  core: loadArt('relic-core.png'),
};

function ready(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
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

function drawBar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  width: number,
  ratio: number,
  lowThreshold: number
): void {
  const height = 5;
  roundRect(ctx, cx - width / 2, topY, width, height, 2);
  ctx.fillStyle = COLOR_HPBACK;
  ctx.fill();
  const fillWidth = width * Math.max(0, ratio);
  if (fillWidth <= 0) return;
  roundRect(ctx, cx - width / 2, topY, fillWidth, height, 2);
  ctx.fillStyle = ratio <= lowThreshold ? COLOR_HP_LOW : COLOR_HP;
  ctx.fill();
}

function blitCell(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  dx: number,
  dy: number
): void {
  const sx = (x / GRID_WIDTH) * image.width;
  const sy = (y / GRID_HEIGHT) * image.height;
  ctx.drawImage(
    image,
    sx,
    sy,
    image.width / GRID_WIDTH,
    image.height / GRID_HEIGHT,
    dx,
    dy,
    TILE_SIZE,
    TILE_SIZE
  );
}

function drawFooted(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  cy: number,
  size: number,
  flip: boolean
): void {
  const feet = cy + TILE_SIZE * 0.3;
  ctx.save();
  ctx.translate(cx, feet);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(0, -2, size * 0.2, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(image, -size / 2, -size, size, size);
  ctx.restore();
}

function drawCentered(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  cy: number,
  size: number
): void {
  ctx.drawImage(image, cx - size / 2, cy - size / 2, size, size);
}

function fillFallback(ctx: CanvasRenderingContext2D, x: number, y: number, wall: boolean): void {
  ctx.fillStyle = wall ? '#242938' : (x + y) % 2 === 0 ? '#1a1e29' : '#171b25';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
}

export function drawWorld(ctx: CanvasRenderingContext2D, run: RunState): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, w, h);

  const offsetX = (w - GRID_WIDTH * TILE_SIZE) / 2;
  const [shakeX, shakeY] = getShakeOffset();
  const t = performance.now() / 1000;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = run.layout.grid[y]?.[x];
      const dx = offsetX + x * TILE_SIZE;
      const dy = y * TILE_SIZE;
      const wall = tile === 'wall';
      const texture = wall ? art.wall : art.floor;
      if (ready(texture)) blitCell(ctx, texture, x, y, dx, dy);
      else fillFallback(ctx, dx, dy, wall);
    }
  }

  const cell = (x: number, y: number) => ({
    cx: offsetX + x * TILE_SIZE + TILE_SIZE / 2,
    cy: y * TILE_SIZE + TILE_SIZE / 2,
    dx: offsetX + x * TILE_SIZE,
    dy: y * TILE_SIZE,
  });

  const stairs = cell(run.layout.stairsPos.x, run.layout.stairsPos.y);
  if (ready(art.stairs)) {
    ctx.drawImage(art.stairs, stairs.dx, stairs.dy, TILE_SIZE, TILE_SIZE);
  } else {
    ctx.fillStyle = '#66bb6a';
    ctx.fillRect(stairs.cx - 18, stairs.cy - 18, 36, 36);
  }

  for (const relic of run.relics) {
    if (relic.collected) continue;
    const { cx, cy } = cell(relic.x, relic.y);
    const bob = Math.sin(t * 2.4 + cx * 0.05) * 3;
    const image = art[relic.kind];
    if (ready(image)) drawCentered(ctx, image, cx, cy + bob, RELIC_SIZE[relic.kind]);
  }

  for (const enemy of run.enemies) {
    if (!enemy.alive) continue;
    const { cx, cy } = cell(enemy.x, enemy.y);
    const image = art[enemy.kind];
    if (ready(image)) drawFooted(ctx, image, cx, cy, ACTOR_SIZE[enemy.kind], false);
    drawBar(ctx, cx, cy - ACTOR_SIZE[enemy.kind] * 0.42, 36, enemy.hp / enemy.maxHp, 0.34);
  }

  const player = cell(run.player.x, run.player.y);
  if (ready(art.player)) drawFooted(ctx, art.player, player.cx, player.cy, ACTOR_SIZE.player, facing < 0);
  else {
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.arc(player.cx, player.cy, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  drawBar(ctx, player.cx, player.cy - 40, 36, run.player.hp / run.player.maxHp, 0.3);

  drawPopups(ctx, (x, y) => cell(x, y));

  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.72);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(offsetX, 0, GRID_WIDTH * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);

  ctx.restore();
}
