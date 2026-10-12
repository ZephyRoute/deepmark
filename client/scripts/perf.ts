/**
 * Performance harness for the production build. Drives a real headless Chrome
 * over CDP, so the numbers come from a browser that paints, not from a tab in
 * the background.
 *
 *   bun run build && bun run preview --port 4173 &
 *   bun run perf [url] [--json] [--profile=laptop|ci]
 *
 * With --json the report goes to stdout as JSON and the human readable log to
 * stderr. The exit code is 1 when a budget in scripts/budgets.ts is exceeded,
 * which is what the perf workflow relies on.
 *
 * It measures a cold load (bytes, first paint, largest paint, long tasks, time
 * until the title is usable) and then plays a practice run with the Stellar
 * network blocked, sampling frame times at 1x and 4x CPU throttling.
 */
import type { Page } from 'puppeteer-core';
import { blockStellar, launchBrowser } from './browser';
import { BUDGETS, PROFILES, checkBudgets, isProfileName, type ProfileName, type Violation } from './budgets';

const ARGS = process.argv.slice(2);
const JSON_OUTPUT = ARGS.includes('--json');
const URL_UNDER_TEST = ARGS.find((a) => !a.startsWith('--')) ?? 'http://127.0.0.1:4173/';
const PROFILE_ARG = ARGS.find((a) => a.startsWith('--profile='))?.slice('--profile='.length) ?? 'laptop';
if (!isProfileName(PROFILE_ARG)) {
  console.error(`Unknown profile "${PROFILE_ARG}". Use one of: ${Object.keys(PROFILES).join(', ')}.`);
  process.exit(2);
}
const PROFILE: ProfileName = PROFILE_ARG;
const SAMPLE_MS = 12_000;

interface LoadReport {
  bytesKB: number;
  requests: number;
  byType: Record<string, number>;
  fcpMs: number | null;
  lcpMs: number | null;
  clsScore: number;
  longTasks: { count: number; totalMs: number; maxMs: number };
  titleReadyMs: number | null;
  jsHeapMB: number;
}

/** Human readable output. Goes to stderr in --json mode so stdout stays parseable. */
function log(...parts: unknown[]): void {
  (JSON_OUTPUT ? console.error : console.log)(...parts);
}

interface FrameReport {
  throttle: number;
  frames: number;
  avgFps: number;
  p50: number;
  p95: number;
  p99: number;
  over33: number;
  over50: number;
  worst: number;
}

async function coldLoad(page: Page): Promise<LoadReport> {
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  let bytes = 0;
  let requests = 0;
  const types = new Map<string, string>();
  const byType: Record<string, number> = {};
  cdp.on('Network.responseReceived', (e) => types.set(e.requestId, e.type ?? 'Other'));
  cdp.on('Network.loadingFinished', (e) => {
    bytes += e.encodedDataLength;
    requests += 1;
    const t = types.get(e.requestId) ?? 'Other';
    byType[t] = (byType[t] ?? 0) + e.encodedDataLength;
  });

  await page.evaluateOnNewDocument(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__perf = { cls: 0, lcp: null as number | null, fcp: null as number | null, longTasks: [] as number[] };
    const perf = w.__perf as { cls: number; lcp: number | null; fcp: number | null; longTasks: number[] };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') perf.fcp = e.startTime;
    }).observe({ type: 'paint', buffered: true });
    (w.__shifts as string[] | undefined) ?? (w.__shifts = []);
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Element }[] }[]) {
        if (e.hadRecentInput) continue;
        perf.cls += e.value;
        const names = (e.sources ?? []).map((src) => `${src.node?.nodeName ?? '?'}.${(src.node as HTMLElement | undefined)?.className ?? ''}#${(src.node as HTMLElement | undefined)?.id ?? ''}`);
        (w.__shifts as string[]).push(`${e.value.toFixed(3)} ${names.join(' | ')}`);
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => {
      const entries = l.getEntries();
      perf.lcp = entries[entries.length - 1]?.startTime ?? null;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) perf.longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  });

  const start = Date.now();
  await page.goto(URL_UNDER_TEST, { waitUntil: 'load' });
  await page.waitForSelector('.title-screen', { timeout: 30_000 });
  const titleReadyMs = Date.now() - start;
  await new Promise((r) => setTimeout(r, 800));

  const inPage = await page.evaluate(() => {
    const perf = (window as unknown as Record<string, { cls: number; lcp: number | null; fcp: number | null; longTasks: number[] }>).__perf;
    const fcp = perf?.fcp ?? null;
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    return {
      fcp,
      lcp: perf?.lcp ?? null,
      cls: perf?.cls ?? 0,
      long: perf?.longTasks ?? [],
      heap,
    };
  });

  const shifts = await page.evaluate(() => (window as unknown as { __shifts?: string[] }).__shifts ?? []);
  if (shifts.length > 0) log('LAYOUT SHIFTS', shifts);
  return {
    bytesKB: Math.round(bytes / 1024),
    requests,
    byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v / 1024)])),
    fcpMs: inPage.fcp === null ? null : Math.round(inPage.fcp),
    lcpMs: inPage.lcp === null ? null : Math.round(inPage.lcp),
    clsScore: Math.round(inPage.cls * 1000) / 1000,
    longTasks: {
      count: inPage.long.length,
      totalMs: Math.round(inPage.long.reduce((a, b) => a + b, 0)),
      maxMs: Math.round(Math.max(0, ...inPage.long)),
    },
    titleReadyMs,
    jsHeapMB: Math.round((inPage.heap / 1024 / 1024) * 10) / 10,
  };
}

async function sampleFrames(page: Page, throttle: number): Promise<FrameReport> {
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await blockStellar(page);

  await page.goto(URL_UNDER_TEST, { waitUntil: 'load' });
  await page.waitForSelector('.title-screen', { timeout: 30_000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.title-screen');

  // Forge a delver and descend. With Stellar blocked the game falls back to a practice run.
  await page.click('[data-action="confirm"]');
  await page.waitForSelector('form.creator');
  await page.evaluate(() => (document.querySelector('form.creator') as HTMLFormElement).requestSubmit());
  await page.waitForFunction(() => document.getElementById('hud') && !(document.getElementById('hud') as HTMLElement).hidden, {
    timeout: 90_000,
  });
  await new Promise((r) => setTimeout(r, 2500));

  await page.evaluate((ms) => {
    const w = window as unknown as { __frames?: number[]; __done?: boolean };
    w.__frames = [];
    w.__done = false;
    let last = performance.now();
    const t0 = last;
    const tick = (now: number): void => {
      w.__frames?.push(now - last);
      last = now;
      if (now - t0 < ms) requestAnimationFrame(tick);
      else w.__done = true;
    };
    requestAnimationFrame(tick);
  }, SAMPLE_MS);

  // Keep the game busy: walk into the guard, fight, and wander so particles, shake and popups all run.
  const keys = ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter', 'Enter', 'Enter', 'ArrowUp', 'ArrowLeft', 'ArrowDown'];
  const until = Date.now() + SAMPLE_MS - 300;
  let i = 0;
  while (Date.now() < until) {
    await page.keyboard.press(keys[i % keys.length] as string);
    i += 1;
    await new Promise((r) => setTimeout(r, 220));
  }
  await page.waitForFunction(() => (window as unknown as { __done?: boolean }).__done === true, { timeout: 20_000 });

  const frames = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames.slice(5));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  page.removeAllListeners('request');
  await page.setRequestInterception(false);
  const sorted = [...frames].sort((a, b) => a - b);
  const pick = (p: number): number => Math.round((sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0) * 10) / 10;
  const total = frames.reduce((a, b) => a + b, 0);
  return {
    throttle,
    frames: frames.length,
    avgFps: Math.round((frames.length / total) * 1000 * 10) / 10,
    p50: pick(0.5),
    p95: pick(0.95),
    p99: pick(0.99),
    over33: frames.filter((f) => f > 33.4).length,
    over50: frames.filter((f) => f > 50).length,
    worst: Math.round(Math.max(...frames) * 10) / 10,
  };
}

const browser = await launchBrowser();

let violations: Violation[] = [];
try {
  const page = await browser.newPage();
  const load = await coldLoad(page);
  log('COLD LOAD');
  log(JSON.stringify(load, null, 2));

  const frames: FrameReport[] = [];
  for (const throttle of new Set([1, PROFILES[PROFILE].throttle])) {
    const fresh = await browser.newPage();
    frames.push(await sampleFrames(fresh, throttle));
    await fresh.close();
  }
  log('FRAMES (practice run, Stellar blocked, 12 s of play)');
  log(JSON.stringify(frames, null, 2));

  violations = checkBudgets({ load, frames }, PROFILE);
  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ url: URL_UNDER_TEST, profile: PROFILE, budgets: { ...BUDGETS, ...PROFILES[PROFILE] }, load, frames, violations }, null, 2));
  }
  if (violations.length === 0) log('PERF BUDGETS: all within budget');
  else for (const v of violations) console.error(`PERF BUDGET EXCEEDED: ${v.message}`);
} finally {
  await browser.close();
}
process.exit(violations.length === 0 ? 0 : 1);
