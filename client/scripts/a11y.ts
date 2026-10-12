/**
 * Accessibility check. Runs axe-core in a real headless Chrome against every
 * screen a player can reach, in three passes:
 *
 *   desktop   1280 by 800, normal motion
 *   phone     390 by 844 with touch, where the touch controls show
 *   reduced   desktop with prefers-reduced-motion: reduce
 *
 * It fails on any serious or critical axe violation, on a control smaller than
 * 44 by 44 CSS pixels, and (in the reduced pass) on any animation still
 * looping. A last pass drives the game with the keyboard only and checks that
 * Tab reaches the menu, Enter activates the focused control, focus moves into
 * a screen when it opens and back when it closes, and play events are
 * announced.
 *
 *   bun run build && bun run preview --port 4173 &
 *   bun run a11y [url] [--json]
 *
 * Title, creator, the offline vault, leaderboard and record, and the board in
 * play come from the real game with Stellar blocked. The populated vault and
 * leaderboard and the result screens come from the local preview routes, which
 * need no wallet or network. With --json the report goes to stdout and the
 * readable log to stderr.
 */
import axe from 'axe-core';
import type { Page } from 'puppeteer-core';
import { blockStellar, launchBrowser } from './browser';

const ARGS = process.argv.slice(2);
const JSON_OUTPUT = ARGS.includes('--json');
const BASE = (ARGS.find((a) => !a.startsWith('--')) ?? 'http://localhost:4173/').replace(/\/?$/, '/');
const BLOCKING_IMPACTS: readonly string[] = ['serious', 'critical'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
/** Entrance animations settle well inside this. */
const SETTLE_MS = 3500;
const SHORT_SETTLE_MS = 1500;
const PLAY_TIMEOUT_MS = 90_000;
/** Smallest touch target the project allows, in CSS pixels. */
const MIN_TARGET_PX = 44;

interface Pass {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  reducedMotion: boolean;
}

const PASSES: Pass[] = [
  { name: 'desktop', width: 1280, height: 800, touch: false, reducedMotion: false },
  { name: 'phone', width: 390, height: 844, touch: true, reducedMotion: false },
  { name: 'reduced motion', width: 1280, height: 800, touch: false, reducedMotion: true },
];

interface Scenario {
  name: string;
  open: (page: Page) => Promise<void>;
}

interface Finding {
  kind: 'axe' | 'target' | 'motion' | 'keyboard';
  rule: string;
  impact: string;
  detail: string;
  nodes: string[];
}

interface ScreenReport {
  pass: string;
  screen: string;
  findings: Finding[];
  blocking: number;
}

function log(...parts: unknown[]): void {
  (JSON_OUTPUT ? console.error : console.log)(...parts);
}

const settle = (ms = SETTLE_MS): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function freshTitle(page: Page): Promise<void> {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.title-screen');
  await settle();
}

async function openByKey(page: Page, key: string, selector: string): Promise<void> {
  await freshTitle(page);
  await page.keyboard.press(key);
  await page.waitForSelector(selector);
  await settle(SHORT_SETTLE_MS);
}

async function preview(page: Page, query: string, selector: string): Promise<void> {
  await page.goto(`${BASE}?preview=${query}`, { waitUntil: 'load' });
  await page.waitForSelector(selector);
  await settle();
}

const SCENARIOS: Scenario[] = [
  { name: 'title', open: freshTitle },
  {
    name: 'creator',
    open: async (page) => {
      await freshTitle(page);
      await page.click('[data-action="confirm"]');
      await page.waitForSelector('form.creator');
      await settle(SHORT_SETTLE_MS);
    },
  },
  { name: 'vault (offline)', open: (page) => openByKey(page, 'KeyV', '.panel') },
  { name: 'vault (two delvers)', open: (page) => preview(page, 'vault', '.vault-card') },
  { name: 'leaderboard (offline)', open: (page) => openByKey(page, 'KeyL', '.panel') },
  { name: 'leaderboard (ranked)', open: (page) => preview(page, 'leaderboard', '.board-row') },
  { name: 'record', open: (page) => openByKey(page, 'KeyM', '.panel') },
  {
    name: 'board in play',
    open: async (page) => {
      await freshTitle(page);
      await page.click('[data-action="confirm"]');
      await page.waitForSelector('form.creator');
      await page.evaluate(() => (document.querySelector('form.creator') as HTMLFormElement).requestSubmit());
      await page.waitForFunction(() => !(document.getElementById('hud') as HTMLElement | null)?.hidden, { timeout: PLAY_TIMEOUT_MS });
      await settle();
    },
  },
  { name: 'descent scene', open: (page) => preview(page, 'descent', '.descent') },
  { name: 'result (cleared)', open: (page) => preview(page, 'result&hero=1', '.result') },
  { name: 'result (lost)', open: (page) => preview(page, 'result&loss=1', '.result') },
];

interface AxeNode {
  target: unknown[];
}
interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: AxeNode[];
}

async function axeFindings(page: Page): Promise<Finding[]> {
  await page.evaluate(axe.source);
  const results = await page.evaluate(
    (tags) =>
      (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: unknown[] }> } }).axe.run(document, {
        runOnly: { type: 'tag', values: tags },
      }),
    AXE_TAGS
  );
  return (results.violations as AxeViolation[]).map(
    (v): Finding => ({
      kind: 'axe',
      rule: v.id,
      impact: v.impact ?? 'minor',
      detail: v.help,
      nodes: v.nodes.map((n) => n.target.join(' ')),
    })
  );
}

/** Visible controls whose box is under the minimum in either direction. */
async function targetFindings(page: Page): Promise<Finding[]> {
  const small = await page.evaluate((min) => {
    const out: string[] = [];
    const controls = document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [role="button"]');
    for (const node of controls) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const hidden = rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || node.closest('[hidden]') !== null;
      if (hidden || node.classList.contains('sr-only')) continue;
      if (Math.round(rect.width) < min || Math.round(rect.height) < min) {
        const label = node.getAttribute('aria-label') ?? node.textContent?.trim().slice(0, 30) ?? '';
        out.push(
          `${node.tagName.toLowerCase()}.${node.className.toString().split(' ')[0]} "${label}" ${Math.round(rect.width)}x${Math.round(rect.height)}`
        );
      }
    }
    return out;
  }, MIN_TARGET_PX);
  return small.length === 0
    ? []
    : [
        {
          kind: 'target',
          rule: 'target-size-44',
          impact: 'serious',
          detail: `Controls under ${MIN_TARGET_PX} by ${MIN_TARGET_PX} px`,
          nodes: small,
        },
      ];
}

/** Animations still looping once the screen has settled. */
async function motionFindings(page: Page): Promise<Finding[]> {
  const looping = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity)
      .map((a) => `${(a as CSSAnimation).animationName ?? 'animation'} on ${(a.effect as KeyframeEffect | null)?.target?.className ?? '?'}`)
  );
  return looping.length === 0
    ? []
    : [
        {
          kind: 'motion',
          rule: 'reduced-motion-loop',
          impact: 'serious',
          detail: 'Animation still looping with reduced motion on',
          nodes: looping,
        },
      ];
}

async function auditScreen(pass: Pass, scenario: Scenario, browser: Awaited<ReturnType<typeof launchBrowser>>): Promise<ScreenReport> {
  const page = await browser.newPage();
  await page.setViewport({ width: pass.width, height: pass.height, deviceScaleFactor: 1, hasTouch: pass.touch, isMobile: pass.touch });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: pass.reducedMotion ? 'reduce' : 'no-preference' }]);
  await blockStellar(page);
  await scenario.open(page);
  const findings = [
    ...(await axeFindings(page)),
    ...(await targetFindings(page)),
    ...(pass.reducedMotion ? await motionFindings(page) : []),
  ];
  await page.close();
  return { pass: pass.name, screen: scenario.name, findings, blocking: findings.filter((f) => BLOCKING_IMPACTS.includes(f.impact)).length };
}

const MAX_TABS = 12;
const MAX_PLAY_KEYS = 40;
const PLAY_KEYS = ['ArrowRight', 'ArrowRight', 'Enter', 'ArrowUp', 'ArrowLeft', 'Enter'] as const;
const KEY_SETTLE_MS = 250;

const describeFocus = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const a = document.activeElement;
    return a
      ? `${a.tagName.toLowerCase()}.${a.className.toString().split(' ')[0]} "${(a.textContent ?? '').trim().slice(0, 24)}"`
      : 'nothing';
  });

/** Tabs until a control matching the selector has focus. Returns false when it never does. */
async function tabTo(page: Page, selector: string): Promise<boolean> {
  for (let i = 0; i < MAX_TABS; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, selector)) return true;
  }
  return false;
}

/** Drives the game with the keyboard alone and reports what a keyboard or screen reader player would hit. */
async function keyboardFindings(browser: Awaited<ReturnType<typeof launchBrowser>>): Promise<ScreenReport> {
  const page = await browser.newPage();
  await blockStellar(page);
  const problems: string[] = [];
  const check = (ok: boolean, message: string): void => {
    if (!ok) problems.push(message);
  };
  await freshTitle(page);

  const reached = await tabTo(page, '.menu-item[data-action="vault"]');
  check(reached, `Tab never reached the Vault menu item within ${MAX_TABS} presses`);
  if (reached) {
    await page.keyboard.press('Enter');
    await page.waitForSelector('.panel-title', { timeout: SETTLE_MS }).catch(() => undefined);
    const opened = await page.evaluate(() => document.querySelector('.panel-title')?.textContent ?? '');
    check(opened === 'Your vault', `Enter on the focused Vault item opened "${opened || 'nothing'}" instead of the vault`);
    check(
      await page.evaluate(() => document.activeElement?.classList.contains('panel-title') ?? false),
      `Focus did not move into the vault screen (on ${await describeFocus(page)})`
    );
    await page.keyboard.press('Escape');
    await settle(SHORT_SETTLE_MS);
    check(
      await page.evaluate(() => document.activeElement?.matches('.menu-item.is-primary') ?? false),
      `Focus did not return to the menu after Escape (on ${await describeFocus(page)})`
    );
  }

  // Forge and descend without touching the pointer: Enter on the menu, Enter inside the name field.
  await page.keyboard.press('Enter');
  await page.waitForSelector('form.creator', { timeout: SETTLE_MS }).catch(() => undefined);
  check(await page.evaluate(() => document.activeElement?.matches('input.input') ?? false), 'The creator did not focus the name field');
  await page.keyboard.press('Enter');
  await page
    .waitForFunction(() => !(document.getElementById('hud') as HTMLElement | null)?.hidden, { timeout: PLAY_TIMEOUT_MS })
    .catch(() => check(false, 'Enter in the name field did not start the descent'));
  await settle(SHORT_SETTLE_MS);

  const logRole = await page.evaluate(() => document.getElementById('hud-log')?.getAttribute('role') ?? '');
  check(logRole === 'log', `The play log is not a live region (role is "${logRole}")`);
  let announced = '';
  for (let i = 0; i < MAX_PLAY_KEYS && announced === ''; i += 1) {
    await page.keyboard.press(PLAY_KEYS[i % PLAY_KEYS.length] as string);
    await settle(KEY_SETTLE_MS);
    announced = await page.evaluate(() => document.getElementById('hud-log')?.textContent?.trim() ?? '');
  }
  check(announced !== '', `Playing with the keyboard produced no log line in ${MAX_PLAY_KEYS} key presses`);
  const healthLabel = await page.evaluate(() => document.getElementById('hud-hp')?.getAttribute('aria-label') ?? '');
  check(/^Health \d+ of \d+/.test(healthLabel), `The health bar has no spoken value (label is "${healthLabel}")`);
  await page.close();

  const findings: Finding[] =
    problems.length === 0
      ? []
      : [{ kind: 'keyboard', rule: 'keyboard-flow', impact: 'serious', detail: 'Keyboard only flow', nodes: problems }];
  return { pass: 'keyboard', screen: 'title to first move', findings, blocking: findings.length };
}

const browser = await launchBrowser();
const reports: ScreenReport[] = [];
try {
  for (const pass of PASSES) {
    log(`\n${pass.name.toUpperCase()}`);
    for (const scenario of SCENARIOS) {
      const report = await auditScreen(pass, scenario, browser);
      reports.push(report);
      log(`${report.blocking === 0 ? 'ok  ' : 'FAIL'} ${scenario.name} (${report.findings.length} findings, ${report.blocking} blocking)`);
      for (const f of report.findings) {
        log(`       [${f.impact}] ${f.rule}: ${f.detail}`);
        for (const node of f.nodes.slice(0, 4)) log(`         ${node}`);
      }
    }
  }
  log('\nKEYBOARD');
  const keyboard = await keyboardFindings(browser);
  reports.push(keyboard);
  log(`${keyboard.blocking === 0 ? 'ok  ' : 'FAIL'} ${keyboard.screen}`);
  for (const f of keyboard.findings) for (const node of f.nodes) log(`         ${node}`);
} finally {
  await browser.close();
}

const blocking = reports.reduce((sum, r) => sum + r.blocking, 0);
if (JSON_OUTPUT) console.log(JSON.stringify({ url: BASE, axe: axe.version, reports }, null, 2));
if (blocking > 0) console.error(`A11Y: ${blocking} serious or critical findings`);
else log('A11Y: no serious or critical findings');
process.exit(blocking === 0 ? 0 : 1);
