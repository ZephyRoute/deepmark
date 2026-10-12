/**
 * Records the real game, from the production build, into trailer/public/footage.
 * Stellar hosts are blocked, so the run is a practice run whose seed comes from
 * the challenge link: the footage is deterministic and the same on every take.
 *
 *   bun run build && bun run preview --port 4173   (in client/)
 *   bun run capture/record.ts [run|title|...]      (in trailer/)
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import puppeteer, { type KeyInput, type Page } from 'puppeteer-core';
import { ActionCode, applyAction, drainEvents, newRun, type RunState } from '../../client/src/game/state';
import { play } from './plan';

const PREVIEW_PORT = 4173;
const BASE_URL = process.env.GAME_URL ?? `http://127.0.0.1:${PREVIEW_PORT}/`;
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = new URL('../public/footage/', import.meta.url).pathname;
const CUES_OUT = new URL('../src/generated/', import.meta.url).pathname;
/** Filmed at twice the layout size so the edit can zoom into the interface without softening it. */
const VIEWPORT = { width: 1920, height: 1080, deviceScaleFactor: 2 } as const;
/**
 * The filmed run. It was chosen because it ends on exactly what the game's sealed
 * result card shows in preview (floor 3, 2 relics, score 4, 1 HP left), so the
 * played footage and the card are one story. See `bun run capture/plan.ts`.
 */
const FILM = { seed: 67, base: 1, weapon: 1, charm: 2, rank: 0, skipFloors: [2], name: 'Brannoch' } as const;

/** Pause after each input so the camera can read the move, the strike and the pickup. */
const PAUSE_MS = { move: 330, attack: 720, choice: 1500, descend: 3600 } as const;
const KEY_FOR_ACTION: Record<number, string> = {
  0: 'ArrowUp',
  1: 'ArrowDown',
  2: 'ArrowLeft',
  3: 'ArrowRight',
  4: 'Enter',
  5: 'Escape',
  6: 'Enter',
  7: 'Escape',
};

export interface Cue {
  /** Epoch seconds while recording, rebased to seconds from the first frame when written. */
  t: number;
  index: number;
  action: number;
  floor: number;
  mode: string;
  hp: number;
  relics: number;
  events: string[];
  /** Tile of the delver and of the guard being fought, if any, so the edit can frame them. */
  player: { x: number; y: number };
  enemy: { x: number; y: number } | null;
}
const cues: Cue[] = [];
/** Named instants inside a take, in epoch seconds until written. */
const marks: Record<string, number> = {};
const mark = (name: string): void => {
  marks[name] = Date.now() / 1000;
};

/** Hosts the game talks to. Blocking them forces the offline practice run, so every take is identical. */
const STELLAR_HOSTS: readonly string[] = ['soroban-testnet.stellar.org', 'horizon-testnet.stellar.org', 'friendbot.stellar.org'];

async function blockStellar(page: Page): Promise<void> {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (STELLAR_HOSTS.includes(new URL(req.url()).host)) void req.abort();
    else void req.continue();
  });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function open(path: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
    defaultViewport: VIEWPORT,
  });
  const page = await browser.newPage();
  await blockStellar(page);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'load' });
  return { page, close: () => browser.close() };
}

interface Frame {
  file: string;
  at: number;
}

/**
 * Chrome's own screencast, one JPEG per repaint with its timestamp, then ffmpeg
 * lays them on a constant 30 fps timeline. Puppeteer's recorder was avoided: it
 * never returned from `stop()` against this ffmpeg.
 */
async function record(name: string, path: string, scene: (page: Page) => Promise<void>): Promise<void> {
  const { page, close } = await open(path);
  const dir = `${OUT}.frames-${name}/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames: Frame[] = [];
  const cdp = await page.createCDPSession();
  cdp.on('Page.screencastFrame', (event: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    const file = `${dir}${String(frames.length).padStart(6, '0')}.jpg`;
    writeFileSync(file, Buffer.from(event.data, 'base64'));
    frames.push({ file, at: event.metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 100, everyNthFrame: 1, maxWidth: 3840, maxHeight: 2160 });
  try {
    await scene(page);
  } finally {
    await cdp.send('Page.stopScreencast');
    await close();
  }
  encode(name, dir, frames);
  const origin0 = frames[0]?.at ?? 0;
  if (Object.keys(marks).length > 0) {
    const rebased = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, Math.round((v - origin0) * 1000) / 1000]));
    mkdirSync(CUES_OUT, { recursive: true });
    writeFileSync(`${CUES_OUT}${name}-marks.json`, JSON.stringify(rebased, null, 1));
    for (const k of Object.keys(marks)) delete marks[k];
  }
  if (cues.length > 0) {
    const origin = frames[0]?.at ?? 0;
    for (const c of cues) c.t = Math.round((c.t - origin) * 1000) / 1000;
    mkdirSync(CUES_OUT, { recursive: true });
    writeFileSync(`${CUES_OUT}${name}-cues.json`, JSON.stringify(cues, null, 1));
    cues.length = 0;
  }
}

function encode(name: string, dir: string, frames: Frame[]): void {
  if (frames.length < 2) throw new Error(`no frames captured for ${name}`);
  const lines: string[] = [];
  frames.forEach((frame, i) => {
    const next = frames[i + 1];
    const seconds = next ? Math.max(next.at - frame.at, 0.001) : 0.5;
    lines.push(`file '${frame.file}'`, `duration ${seconds.toFixed(4)}`);
  });
  lines.push(`file '${frames[frames.length - 1]?.file}'`);
  const list = `${dir}list.txt`;
  writeFileSync(list, lines.join('\n'));
  const file = `${OUT}${name}.mp4`;
  const result = spawnSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,scale=3840:2160:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', file],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
  rmSync(dir, { recursive: true, force: true });
  console.log(`recorded ${file} (${frames.length} frames)`);
}

async function forgeAndDescend(page: Page): Promise<void> {
  await page.waitForSelector('.title-screen');
  await sleep(1800);
  await page.click('[data-action="confirm"]');
  await page.waitForSelector('form.creator');
  await sleep(900);
  await page.click('form.creator input.input', { count: 3 });
  await page.keyboard.type(FILM.name, { delay: 85 });
  await sleep(900);
  await page.evaluate(() => (document.querySelector('form.creator') as HTMLFormElement).requestSubmit());
  await page.waitForFunction(
    () => document.getElementById('hud') && !(document.getElementById('hud') as HTMLElement).hidden,
    { timeout: 90_000 },
  );
  await sleep(2600);
}

function activeEnemy(state: RunState): { x: number; y: number } | null {
  const enemy = state.activeEnemyIndex === null ? undefined : state.enemies[state.activeEnemyIndex];
  return enemy ? { x: enemy.x, y: enemy.y } : null;
}

async function playRun(page: Page): Promise<void> {
  const loadout = { base: FILM.base, weapon: FILM.weapon, charm: FILM.charm, rank: FILM.rank };
  const plan = play(loadout, FILM.seed, [...FILM.skipFloors]);
  if (!plan) throw new Error('the filmed seed no longer produces a winning run');
  console.log(`replaying ${plan.actions.length} actions, expecting hp ${plan.hpLeft}/${plan.maxHp}`);
  // The explainer graphics draw this very log, so what they show is the run on screen, not an illustration.
  mkdirSync(CUES_OUT, { recursive: true });
  writeFileSync(
    `${CUES_OUT}run-plan.json`,
    JSON.stringify({ seed: plan.seed, actions: plan.actions, floor: 3, relics: plan.relics, score: plan.score, hpLeft: plan.hpLeft, maxHp: plan.maxHp, name: FILM.name }, null, 1),
  );
  // A shadow simulation labels each input with what it did, so the edit can cut on real events.
  const shadow = newRun(loadout, FILM.seed);
  for (const [index, action] of plan.actions.entries()) {
    applyAction(shadow, action as ActionCode);
    cues.push({
      t: Date.now() / 1000,
      index,
      action,
      floor: shadow.floorNumber,
      mode: shadow.mode,
      hp: shadow.player.hp,
      relics: shadow.relicsThisRun,
      events: drainEvents(shadow).map((e) => e.type),
      player: { x: shadow.player.x, y: shadow.player.y },
      enemy: activeEnemy(shadow),
    });
    await page.keyboard.press(KEY_FOR_ACTION[action] as KeyInput);
    if (action === 6) await sleep(PAUSE_MS.descend);
    else if (action === 7) await sleep(PAUSE_MS.choice);
    else await sleep(action === 4 || action === 5 ? PAUSE_MS.attack : PAUSE_MS.move);
  }
  await sleep(3500);
}

/** Design previews built into the game for localhost, so every screen can be filmed without a chain. */
function still(name: string, path: string, selector: string, seconds: number): () => Promise<void> {
  return () =>
    record(name, path, async (page) => {
      await page.waitForSelector(selector, { timeout: 30_000 });
      await sleep(seconds * 1000);
    });
}

const scenes: Record<string, () => Promise<void>> = {
  run: () =>
    record('run', `?seed=${FILM.seed}&base=${FILM.base}&weapon=${FILM.weapon}&charm=${FILM.charm}`, async (page) => {
      await forgeAndDescend(page);
      await playRun(page);
    }),
  title: still('title', '', '.title-screen', 7),
  descent: still('descent', '?preview=descent&dive=1', '#overlay *', 11),
  sealed: () =>
    record('sealed', '?preview=result&hero=1', async (page) => {
      await page.waitForSelector('#overlay *', { timeout: 30_000 });
      await page.waitForFunction(() => document.body.innerText.includes('Sealed on Stellar'), { timeout: 30_000 });
      mark('sealed');
      await sleep(5500);
    }),
  vault: still('vault', '?preview=vault', '#overlay *', 6),
};

/** Builds the production client and serves it, unless GAME_URL points at a build that is already up. */
async function startPreview(): Promise<(() => void) | null> {
  if (process.env.GAME_URL) return null;
  const client = new URL('../../client/', import.meta.url).pathname;
  const built = spawnSync('bun', ['run', 'build'], { cwd: client, stdio: 'inherit' });
  if (built.status !== 0) throw new Error('the client build failed');
  // Detached, so the whole process group (bun and the vite it starts) can be stopped together.
  const server = spawn('bun', ['run', 'preview', '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: client,
    stdio: 'ignore',
    detached: true,
  });
  const stop = (): void => {
    if (server.pid) process.kill(-server.pid);
  };
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(BASE_URL)).ok) return stop;
    } catch {
      // Not listening yet.
    }
    await sleep(500);
  }
  stop();
  throw new Error('the preview server did not start');
}

const wanted = process.argv.slice(2);
const stopPreview = await startPreview();
try {
  for (const [name, fn] of Object.entries(scenes)) {
    if (wanted.length === 0 || wanted.includes(name)) await fn();
  }
} finally {
  stopPreview?.();
}
