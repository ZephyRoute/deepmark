/**
 * README media: screenshots of the real game and a short GIF cut from the
 * trailer render. Everything is derived from the recordings and the render, so
 * it can be regenerated with one command after the game changes.
 *
 *   bun run media
 */
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { RUN } from '../src/footage-map';

const FOOTAGE = new URL('../public/footage/', import.meta.url).pathname;
/** Committed with the repository, so the README can show them. */
const OUT = new URL('../../docs/media/', import.meta.url).pathname;
const SCRATCH = new URL('../out/', import.meta.url).pathname;
const TRAILER = new URL('../out/deepmark-trailer-30s.mp4', import.meta.url).pathname;
const SHOT_WIDTH = 1920;

function ffmpeg(args: string[]): void {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg ${args.join(' ')} failed`);
}

/** A still from a recording at `at` seconds, scaled to a README friendly width. */
function still(name: string, source: string, at: number, filter = ''): void {
  const scale = `scale=${SHOT_WIDTH}:-1:flags=lanczos`;
  ffmpeg(['-ss', String(at), '-i', `${FOOTAGE}${source}`, '-frames:v', '1', '-vf', filter ? `${filter},${scale}` : scale, '-q:v', '2', `${OUT}${name}.jpg`]);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(SCRATCH, { recursive: true });

// The board, with the header and HUD cropped away, at the moments worth showing.
const BOARD_CROP = 'crop=2688:1512:576:292';
still('floor-1-fight', 'run.mp4', RUN.floor1Fight + 0.45, BOARD_CROP);
still('floor-2', 'run.mp4', RUN.floor2Fight + 0.2, BOARD_CROP);
still('floor-3-boss', 'run.mp4', RUN.bossHit + 0.1, BOARD_CROP);
still('title', 'title.mp4', 3.5);
still('descent', 'descent.mp4', 2.6);
still('delver-forged', 'run.mp4', 4.4);

// A looping GIF of the fight, small enough to sit in a README.
const palette = `${SCRATCH}palette.png`;
const gifFilter = 'fps=12,scale=640:-1:flags=lanczos';
const start = String(RUN.bossFight - 0.7);
ffmpeg(['-ss', start, '-t', '3.4', '-i', `${FOOTAGE}run.mp4`, '-vf', `crop=2688:1512:576:292,${gifFilter},palettegen=max_colors=80`, palette]);
ffmpeg(['-ss', start, '-t', '3.4', '-i', `${FOOTAGE}run.mp4`, '-i', palette, '-lavfi', `crop=2688:1512:576:292,${gifFilter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4`, `${OUT}boss-fight.gif`]);

// The poster frame for a video embed: the hook, which has no text on purpose.
ffmpeg(['-ss', '4.2', '-i', TRAILER, '-frames:v', '1', '-q:v', '2', `${OUT}poster.jpg`]);
console.log(`wrote README media to ${OUT}`);
