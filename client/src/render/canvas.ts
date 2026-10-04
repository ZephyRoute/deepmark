import { GRID_WIDTH, GRID_HEIGHT, TILE_SIZE } from '../game/floor';
import { cloakFilter } from './emblems';
import type { HeroId } from '../game/heroes';
import type { RelicKind } from '../game/floor';
import type { RunState } from '../game/state';
import { punchScale, tick } from './clock';
import { drawLowHealth, drawParticles, drawPopups, getShakeOffset, isFlashing } from './effects';
import { sampleActor, type Clip } from './motion';

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
  floor: loadArt('floor.webp'),
  floor2: loadArt('floor-2.webp'),
  floor3: loadArt('floor-3.webp'),
  wall: loadArt('wall.webp'),
  wall2: loadArt('wall-2.webp'),
  wall3: loadArt('wall-3.webp'),
  stairs: loadArt('stairs.webp'),
  stairs2: loadArt('stairs-2.webp'),
  stairs3: loadArt('stairs-3.webp'),
  player: loadArt('player.webp'),
  lanternVeteran: loadArt('delver-lantern-veteran.webp'),
  cinderVeteran: loadArt('delver-cinder-veteran.webp'),
  cinder: loadArt('cinder.webp'),
  playerWalkA: loadArt('player-walk-a.webp'),
  playerWalkB: loadArt('player-walk-b.webp'),
  playerAttack: loadArt('player-attack.webp'),
  warden: loadArt('warden.webp'),
  wardenWalk: loadArt('warden-walk.webp'),
  wardenAttack: loadArt('warden-attack.webp'),
  skitter: loadArt('skitter.webp'),
  skitterWalk: loadArt('skitter-walk.webp'),
  skitterAttack: loadArt('skitter-attack.webp'),
  adept: loadArt('adept.webp'),
  adeptWalk: loadArt('adept-walk.webp'),
  adeptAttack: loadArt('adept-attack.webp'),
  wardenPrime: loadArt('warden-prime.webp'),
  wardenPrimeWalk: loadArt('warden-prime-walk.webp'),
  wardenPrimeAttack: loadArt('warden-prime-attack.webp'),
  common: loadArt('relic-common.webp'),
  rare: loadArt('relic-rare.webp'),
  core: loadArt('relic-core.webp'),
};

function biome(floor: number): { floor: HTMLImageElement; wall: HTMLImageElement; stairs: HTMLImageElement } {
  if (floor >= 3) return { floor: art.floor3, wall: art.wall3, stairs: art.stairs3 };
  if (floor === 2) return { floor: art.floor2, wall: art.wall2, stairs: art.stairs2 };
  return { floor: art.floor, wall: art.wall, stairs: art.stairs };
}

function pickFrame(idle: HTMLImageElement, walkA: HTMLImageElement, walkB: HTMLImageElement, attack: HTMLImageElement, clip: Clip, phase: number, shift: boolean): HTMLImageElement {
  if (clip === 'attack') {
    if (ready(attack)) return attack;
    if (ready(walkA)) return walkA;
  }
  const stepping = clip === 'walk' || (shift && Math.floor(performance.now() / 420) % 2 === 1);
  if (stepping) {
    const index = clip === 'walk' ? Math.floor(phase * 4) : 1;
    if (index === 3 && ready(walkB)) return walkB;
    if (index !== 0 && index !== 2 && ready(walkA)) return walkA;
  }
  return idle;
}

function enemySheet(kind: 'warden' | 'skitter' | 'adept' | 'wardenPrime'): {
  idle: HTMLImageElement;
  walkA: HTMLImageElement;
  walkB: HTMLImageElement;
  attack: HTMLImageElement;
} {
  if (kind === 'skitter') {
    return { idle: art.skitter, walkA: art.skitterWalk, walkB: art.skitterWalk, attack: art.skitterAttack };
  }
  if (kind === 'adept') {
    return { idle: art.adept, walkA: art.adeptWalk, walkB: art.adeptWalk, attack: art.adeptAttack };
  }
  if (kind === 'wardenPrime') {
    return {
      idle: art.wardenPrime,
      walkA: art.wardenPrimeWalk,
      walkB: art.wardenPrimeWalk,
      attack: art.wardenPrimeAttack,
    };
  }
  return { idle: art.warden, walkA: art.wardenWalk, walkB: art.wardenWalk, attack: art.wardenAttack };
}

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

function playerFrames(heroId: HeroId, veteran: boolean): {
  idle: HTMLImageElement;
  walkA: HTMLImageElement;
  walkB: HTMLImageElement;
  attack: HTMLImageElement;
} {
  if (veteran) {
    const image = heroId === 'cinder' ? art.cinderVeteran : art.lanternVeteran;
    return { idle: image, walkA: image, walkB: image, attack: image };
  }
  if (heroId === 'cinder') {
    return { idle: art.cinder, walkA: art.cinder, walkB: art.cinder, attack: art.cinder };
  }
  return {
    idle: art.player,
    walkA: art.playerWalkA,
    walkB: art.playerWalkB,
    attack: art.playerAttack,
  };
}

function drawFooted(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  cy: number,
  size: number,
  flip: boolean,
  squat = 1
): void {
  const feet = cy + TILE_SIZE * 0.3;
  ctx.save();
  ctx.translate(cx, feet);
  ctx.scale(flip ? -1 : 1, squat);
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
  ctx.fillStyle = wall ? '#10131c' : (x + y) % 2 === 0 ? '#3a4558' : '#323c4e';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
}

/** A cell outside the grid counts as solid, so the room edge gets the same seam. */
function solidAt(run: RunState, x: number, y: number): boolean {
  return run.layout.grid[y]?.[x] !== 'floor';
}

function livingEnemyAt(run: RunState, x: number, y: number): boolean {
  return run.enemies.some((enemy) => enemy.alive && enemy.x === x && enemy.y === y);
}

/**
 * Walls and floors share one dark stone palette, so the crop of a cell
 * does not say which is blocked. Crush the walls, lift the floor, and
 * draw a cyan seam plus a cast shadow on every edge a step can meet.
 */
function paintBoard(ctx: CanvasRenderingContext2D, run: RunState, offsetX: number): void {
  const theme = biome(run.floorNumber);
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const dx = offsetX + x * TILE_SIZE;
      const dy = y * TILE_SIZE;
      const wall = solidAt(run, x, y);
      const texture = wall ? theme.wall : theme.floor;
      if (ready(texture)) blitCell(ctx, texture, x, y, dx, dy);
      else fillFallback(ctx, dx, dy, wall);

      if (wall) {
        ctx.fillStyle = 'rgba(4, 5, 10, 0.62)';
        ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = 'rgba(244, 239, 230, 0.14)';
        ctx.fillRect(dx, dy, TILE_SIZE, 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(dx, dy + TILE_SIZE - 4, TILE_SIZE, 4);
      } else {
        ctx.fillStyle = 'rgba(196, 214, 224, 0.11)';
        ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (solidAt(run, x, y)) continue;
      const dx = offsetX + x * TILE_SIZE;
      const dy = y * TILE_SIZE;
      shadeOpenEdge(ctx, dx, dy, 'n', solidAt(run, x, y - 1));
      shadeOpenEdge(ctx, dx, dy, 's', solidAt(run, x, y + 1));
      shadeOpenEdge(ctx, dx, dy, 'w', solidAt(run, x - 1, y));
      shadeOpenEdge(ctx, dx, dy, 'e', solidAt(run, x + 1, y));
    }
  }
}

function shadeOpenEdge(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  side: 'n' | 's' | 'e' | 'w',
  blocked: boolean
): void {
  if (!blocked) return;
  const depth = 16;
  let gradient: CanvasGradient;
  let sx = dx;
  let sy = dy;
  let sw = TILE_SIZE;
  let sh = depth;
  if (side === 'n') {
    gradient = ctx.createLinearGradient(0, dy, 0, dy + depth);
  } else if (side === 's') {
    gradient = ctx.createLinearGradient(0, dy + TILE_SIZE, 0, dy + TILE_SIZE - depth);
    sy = dy + TILE_SIZE - depth;
  } else if (side === 'w') {
    gradient = ctx.createLinearGradient(dx, 0, dx + depth, 0);
    sw = depth;
    sh = TILE_SIZE;
  } else {
    gradient = ctx.createLinearGradient(dx + TILE_SIZE, 0, dx + TILE_SIZE - depth, 0);
    sx = dx + TILE_SIZE - depth;
    sw = depth;
    sh = TILE_SIZE;
  }
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(sx, sy, sw, sh);

  ctx.fillStyle = 'rgba(126, 240, 224, 0.78)';
  if (side === 'n') ctx.fillRect(dx, dy, TILE_SIZE, 2);
  else if (side === 's') ctx.fillRect(dx, dy + TILE_SIZE - 2, TILE_SIZE, 2);
  else if (side === 'w') ctx.fillRect(dx, dy, 2, TILE_SIZE);
  else ctx.fillRect(dx + TILE_SIZE - 2, dy, 2, TILE_SIZE);
}

/** A quiet mark on each legal step, and a danger frame on a foe in reach. */
function paintReach(ctx: CanvasRenderingContext2D, run: RunState, offsetX: number): void {
  if (run.mode !== 'explore') return;
  const steps: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  for (const [dx, dy] of steps) {
    const x = run.player.x + dx;
    const y = run.player.y + dy;
    const left = offsetX + x * TILE_SIZE;
    const top = y * TILE_SIZE;
    if (livingEnemyAt(run, x, y)) {
      ctx.strokeStyle = 'rgba(255, 107, 90, 0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(left + 5, top + 5, TILE_SIZE - 10, TILE_SIZE - 10);
      continue;
    }
    if (solidAt(run, x, y)) continue;
    const cx = left + TILE_SIZE / 2;
    const cy = top + TILE_SIZE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(126, 240, 224, 0.72)';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
}

function paintExit(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
  const inset = 5;
  const arm = 12;
  ctx.strokeStyle = 'rgba(231, 195, 106, 0.92)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const x0 = dx + inset;
  const y0 = dy + inset;
  const x1 = dx + TILE_SIZE - inset;
  const y1 = dy + TILE_SIZE - inset;
  ctx.moveTo(x0, y0 + arm);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x0 + arm, y0);
  ctx.moveTo(x1 - arm, y0);
  ctx.lineTo(x1, y0);
  ctx.lineTo(x1, y0 + arm);
  ctx.moveTo(x0, y1 - arm);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x0 + arm, y1);
  ctx.moveTo(x1 - arm, y1);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1, y1 - arm);
  ctx.stroke();
}

export function drawWorld(ctx: CanvasRenderingContext2D, run: RunState): void {
  tick();
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, w, h);

  const offsetX = (w - GRID_WIDTH * TILE_SIZE) / 2;
  const [shakeX, shakeY] = getShakeOffset();
  const t = performance.now() / 1000;

  ctx.save();
  const zoom = punchScale();
  ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);

  const theme = biome(run.floorNumber);
  paintBoard(ctx, run, offsetX);
  paintReach(ctx, run, offsetX);

  const cell = (x: number, y: number) => ({
    cx: offsetX + x * TILE_SIZE + TILE_SIZE / 2,
    cy: y * TILE_SIZE + TILE_SIZE / 2,
    dx: offsetX + x * TILE_SIZE,
    dy: y * TILE_SIZE,
  });

  const stairs = cell(run.layout.stairsPos.x, run.layout.stairsPos.y);
  if (ready(theme.stairs)) {
    const image = theme.stairs;
    const crop = image.width * 0.48;
    const sx = (image.width - crop) / 2;
    const sy = (image.height - crop) / 2;
    ctx.drawImage(image, sx, sy, crop, crop, stairs.dx, stairs.dy, TILE_SIZE, TILE_SIZE);
    paintExit(ctx, stairs.dx, stairs.dy);
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

  for (const [index, enemy] of run.enemies.entries()) {
    if (!enemy.alive) continue;
    const pose = sampleActor(`enemy-${index}`, enemy.x, enemy.y);
    const spot = cell(pose.x, pose.y);
    const sheet = enemySheet(enemy.kind);
    const image = pickFrame(sheet.idle, sheet.walkA, sheet.walkB, sheet.attack, pose.clip, pose.phase, true);
    const lunge = pose.clip === 'attack' ? Math.sin(pose.phase * Math.PI) * 10 : 0;
    if (ready(image)) {
      ctx.filter = isFlashing(`enemy-${index}`) ? 'brightness(2.6) saturate(0.25)' : 'none';
      drawFooted(ctx, image, spot.cx + lunge, spot.cy, ACTOR_SIZE[enemy.kind], false);
      ctx.filter = 'none';
    }
    drawBar(ctx, spot.cx, spot.cy - ACTOR_SIZE[enemy.kind] * 0.42, 36, enemy.hp / enemy.maxHp, 0.34);
  }

  const playerPose = sampleActor('player', run.player.x, run.player.y);
  const player = cell(playerPose.x, playerPose.y);
  const sheet = playerFrames(run.heroId, run.loadout.rank > 0);
  const playerImage = pickFrame(
    sheet.idle,
    sheet.walkA,
    sheet.walkB,
    sheet.attack,
    playerPose.clip,
    playerPose.phase,
    false
  );
  const playerLunge = playerPose.clip === 'attack' ? Math.sin(playerPose.phase * Math.PI) * 12 * facing : 0;
  const squat = run.heroId === 'cinder' && playerPose.clip === 'walk'
    ? 1 - Math.sin(playerPose.phase * Math.PI) * 0.08
    : 1;
  if (ready(playerImage)) {
    // The cloak colour recolours the delver. Browsers without canvas filters just draw the base art.
    const cloak = cloakFilter(run.look.cloak, run.loadout.base);
    const flash = isFlashing('player') ? ' brightness(2.4) saturate(0.3)' : '';
    ctx.filter = cloak === 'none' ? flash.trim() || 'none' : `${cloak}${flash}`;
    drawFooted(ctx, playerImage, player.cx + playerLunge, player.cy, ACTOR_SIZE.player, facing < 0, squat);
    ctx.filter = 'none';
  }
  else {
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.arc(player.cx, player.cy, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  drawBar(ctx, player.cx, player.cy - 40, 36, run.player.hp / run.player.maxHp, 0.3);

  drawParticles(ctx, (x, y) => cell(x, y));
  drawPopups(ctx, (x, y) => cell(x, y));

  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.72);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(offsetX, 0, GRID_WIDTH * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);

  ctx.restore();
  drawLowHealth(ctx, run.player.hp / run.player.maxHp);
}
