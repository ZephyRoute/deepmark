/**
 * Copies the painted art the trailer uses straight from the shipped client, so
 * the trailer can never show an outdated asset, and makes the film grain tile.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ART_FROM = new URL('../../client/public/art/', import.meta.url).pathname;
const ART_TO = new URL('../public/art/', import.meta.url).pathname;
const FX_TO = new URL('../public/fx/', import.meta.url).pathname;

const ART: readonly string[] = [
  'title-key-art.webp',
  'boss-intro.webp',
  'victory-bg.webp',
  'vault-bg.webp',
  'share-card-bg.webp',
  'logo-lockup.webp',
  'cinder.webp',
  'delver-cinder-veteran.webp',
  'relic-common.webp',
  'relic-rare.webp',
  'relic-core.webp',
  'reaver-hook.webp',
  'oil-flask.webp',
  'stone-heart.webp',
  'warden-prime.webp',
];

mkdirSync(ART_TO, { recursive: true });
mkdirSync(FX_TO, { recursive: true });
for (const file of ART) {
  if (!existsSync(`${ART_FROM}${file}`)) throw new Error(`missing art: ${file}`);
  copyFileSync(`${ART_FROM}${file}`, `${ART_TO}${file}`);
}

// Chrome decodes webp, but a flat PNG tile is what the grain overlay repeats.
const grain = spawnSync(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=512x512', '-vf', 'noise=alls=90:allf=t+u,format=gray', '-frames:v', '1', `${FX_TO}grain.png`],
  { stdio: 'inherit' },
);
if (grain.status !== 0) throw new Error('could not make the grain tile');
console.log(`synced ${ART.length} art files and the grain tile`);
