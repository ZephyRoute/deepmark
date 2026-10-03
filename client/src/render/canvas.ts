import { GRID_WIDTH, GRID_HEIGHT, TILE_SIZE } from '../game/floor';
import { cloakFilter } from './emblems';
import type { HeroId } from '../game/heroes';
import type { RelicKind } from '../game/floor';
import type { RunState } from '../game/state';
import { drawPopups, getShakeOffset } from './effects';
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
  floor: loadArt('floor.jpg'),
  floor2: loadArt('floor-2.jpg'),
  floor3: loadArt('floor-3.jpg'),
  wall: loadArt('wall.jpg'),
  wall2: loadArt('wall-2.jpg'),
  wall3: loadArt('wall-3.jpg'),
  stairs: loadArt('stairs.jpg'),
  stairs2: loadArt('stairs-2.jpg'),
  stairs3: loadArt('stairs-3.jpg'),
  player: loadArt('player.png'),
  cinder: loadArt('cinder.png'),
  playerWalkA: loadArt('player-walk-a.png'),
  playerWalkB: loadArt('player-walk-b.png'),
  playerAttack: loadArt('player-attack.png'),
  warden: loadArt('warden.png'),
  wardenWalk: loadArt('warden-walk.png'),
  wardenAttack: loadArt('warden-attack.png'),
  skitter: loadArt('skitter.png'),
  skitterWalk: loadArt('skitter-walk.png'),
  skitterAttack: loadArt('skitter-attack.png'),
  adept: loadArt('adept.png'),
  adeptWalk: loadArt('adept-walk.png'),
  adeptAttack: loadArt('adept-attack.png'),
  wardenPrime: loadArt('warden-prime.png'),
  wardenPrimeWalk: loadArt('warden-prime-walk.png'),
  wardenPrimeAttack: loadArt('warden-prime-attack.png'),
  common: loadArt('relic-common.png'),
  rare: loadArt('relic-rare.png'),
  core: loadArt('relic-core.png'),
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

function playerFrames(heroId: HeroId): {
  idle: HTMLImageElement;
  walkA: HTMLImageElement;
  walkB: HTMLImageElement;
  attack: HTMLImageElement;
} {
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

  const theme = biome(run.floorNumber);
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = run.layout.grid[y]?.[x];
      const dx = offsetX + x * TILE_SIZE;
      const dy = y * TILE_SIZE;
      const wall = tile === 'wall';
      const texture = wall ? theme.wall : theme.floor;
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
  if (ready(theme.stairs)) {
    const image = theme.stairs;
    const crop = image.width * 0.48;
    const sx = (image.width - crop) / 2;
    const sy = (image.height - crop) / 2;
    ctx.drawImage(image, sx, sy, crop, crop, stairs.dx, stairs.dy, TILE_SIZE, TILE_SIZE);
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
    if (ready(image)) drawFooted(ctx, image, spot.cx + lunge, spot.cy, ACTOR_SIZE[enemy.kind], false);
    drawBar(ctx, spot.cx, spot.cy - ACTOR_SIZE[enemy.kind] * 0.42, 36, enemy.hp / enemy.maxHp, 0.34);
  }

  const playerPose = sampleActor('player', run.player.x, run.player.y);
  const player = cell(playerPose.x, playerPose.y);
  const sheet = playerFrames(run.heroId);
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
    ctx.filter = cloakFilter(run.look.cloak);
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

  drawPopups(ctx, (x, y) => cell(x, y));

  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.72);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(offsetX, 0, GRID_WIDTH * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);

  ctx.restore();
}
