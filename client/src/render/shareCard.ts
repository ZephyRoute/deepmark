/**
 * The shareable result card: a 1200 by 630 PNG built once per verified win,
 * so posting a run never means a raw screenshot of the result overlay.
 */
import { WEAPONS, CHARMS } from '../game/items';
import type { Loadout } from '../game/loadout';

const WIDTH = 1200;
const HEIGHT = 630;
const SERIF = 'Palatino, "Iowan Old Style", Georgia, serif';
const MONO = 'ui-monospace, monospace';

export interface ShareCardData {
  name: string;
  portraitArt: string;
  portraitFilter: string;
  weapon: number;
  charm: number;
  floorReached: number;
  maxFloor: number;
  score: number;
  relics: number;
  rank: number | null;
  txHash: string;
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  let cached = imageCache.get(src);
  if (!cached) {
    cached = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    imageCache.set(src, cached);
  }
  return cached;
}

/** Warms the image cache ahead of time, so the card itself is one paint, not a fetch. */
export function preloadShareAssets(portraitArt: string, loadout: Loadout): void {
  void loadImage('/art/share-card-bg.webp');
  void loadImage('/art/logo-lockup.webp');
  void loadImage(`/art/${portraitArt}`);
  const weapon = WEAPONS[loadout.weapon];
  const charm = CHARMS[loadout.charm];
  if (weapon) void loadImage(`/art/${weapon.icon}`);
  if (charm) void loadImage(`/art/${charm.icon}`);
}

/**
 * Rounds the backdrop's channels to 16-level steps before anything else is drawn
 * over it. A photo re-encoded losslessly as PNG keeps every bit of its grain,
 * which blows the card's size budget; a posterised backdrop compresses to a
 * fraction of that and reads as a deliberate, flatter art style, not a defect.
 */
function quantize(ctx: CanvasRenderingContext2D): void {
  const step = 16;
  const image = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round((d[i] as number) / step) * step;
    d[i + 1] = Math.round((d[i + 1] as number) / step) * step;
    d[i + 2] = Math.round((d[i + 2] as number) / step) * step;
  }
  ctx.putImageData(image, 0, 0);
}

function shortHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

function drawStat(ctx: CanvasRenderingContext2D, x: number, y: number, value: string, label: string): void {
  ctx.fillStyle = '#f4efe6';
  ctx.font = `600 32px ${SERIF}`;
  ctx.fillText(value, x, y);
  ctx.fillStyle = '#a3988c';
  ctx.font = `13px ${MONO}`;
  ctx.fillText(label.toUpperCase(), x, y + 24);
}

/** Renders the card. Assets are expected to already be warm via `preloadShareAssets`. */
export async function renderShareCard(data: ShareCardData): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const weapon = WEAPONS[data.weapon];
  const charm = CHARMS[data.charm];
  const [backdrop, logo, portrait, weaponIcon, charmIcon] = await Promise.all([
    loadImage('/art/share-card-bg.webp'),
    loadImage('/art/logo-lockup.webp'),
    loadImage(`/art/${data.portraitArt}`),
    weapon ? loadImage(`/art/${weapon.icon}`) : Promise.resolve(null),
    charm ? loadImage(`/art/${charm.icon}`) : Promise.resolve(null),
  ]);

  if (backdrop) {
    ctx.drawImage(backdrop, 0, 0, WIDTH, HEIGHT);
    quantize(ctx);
  }

  if (logo) {
    const w = 170;
    const h = (w * logo.height) / logo.width;
    ctx.drawImage(logo, 56, 46, w, h);
  }

  if (portrait) {
    const size = 360;
    ctx.save();
    ctx.filter = data.portraitFilter;
    ctx.drawImage(portrait, 90, 150, size, size);
    ctx.restore();
  }

  const textX = 500;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#a3988c';
  ctx.font = `600 15px ${MONO}`;
  ctx.fillText('EXTRACTED', textX, 186);

  ctx.fillStyle = '#f7e9c0';
  ctx.font = `500 58px ${SERIF}`;
  ctx.fillText(data.name, textX, 248);

  let kitX = textX;
  const kitY = 282;
  ctx.fillStyle = '#f4efe6';
  ctx.font = `16px ${MONO}`;
  if (weaponIcon) {
    ctx.drawImage(weaponIcon, kitX, kitY, 34, 34);
    kitX += 42;
  }
  if (weapon) {
    ctx.fillText(weapon.name, kitX, kitY + 23);
    kitX += ctx.measureText(weapon.name).width + 30;
  }
  if (charmIcon) {
    ctx.drawImage(charmIcon, kitX, kitY, 34, 34);
    kitX += 42;
  }
  if (charm) ctx.fillText(charm.name, kitX, kitY + 23);

  const statsY = 398;
  drawStat(ctx, textX, statsY, `${data.floorReached} / ${data.maxFloor}`, 'Floor');
  drawStat(ctx, textX + 150, statsY, String(data.score), 'Score');
  drawStat(ctx, textX + 280, statsY, String(data.relics), 'Relics');
  drawStat(ctx, textX + 410, statsY, data.rank !== null ? `#${data.rank}` : '...', 'Rank');

  ctx.fillStyle = '#7ef0e0';
  ctx.font = `15px ${MONO}`;
  ctx.fillText(`Verified on Stellar  ·  ${shortHash(data.txHash)}`, textX, 560);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

/** A link that opens the title with this run's kit pre-selected and its seed suggested. */
export function challengeUrl(seed: number, loadout: Loadout): string {
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set('seed', String(seed));
  url.searchParams.set('base', String(loadout.base));
  url.searchParams.set('weapon', String(loadout.weapon));
  url.searchParams.set('charm', String(loadout.charm));
  return url.toString();
}
