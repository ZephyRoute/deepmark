/**
 * WCAG contrast check for the colours the stylesheet actually uses. Token
 * values are read from src/styles.css, so the table cannot drift from the
 * design. Translucent surfaces are composited over the backdrop they really
 * sit on: panels sit on the opaque overlay, which is the page colour, and the
 * combat and choice prompts sit over the board, so they are checked against
 * the lightest board pixel under the dimming gradient.
 *
 *   bun run contrast [--markdown]
 *
 * Exits 1 when a pair is under its threshold: 4.5 for text, 3 for large text
 * and for the edges of controls (WCAG 1.4.3 and 1.4.11).
 */
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const MARKDOWN = process.argv.includes('--markdown');

const TEXT_MIN = 4.5;
const GRAPHIC_MIN = 3;
/** The lightest the board can be. Pure white is a bound, no floor tile is that bright. */
const LIGHTEST_BOARD = '#ffffff';
/**
 * Share of page colour the `.overlay-prompt` gradient lays over the board where
 * a prompt sits. The gradient runs from 0 at 20 percent of the height to 0.78 at
 * the bottom, and a prompt starts well below the middle. 0.4 is a safe floor.
 */
const PROMPT_DIM = 0.4;

type Rgba = { r: number; g: number; b: number; a: number };

function tokenValue(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(CSS);
  if (!match?.[1]) throw new Error(`Token --${name} not found in styles.css`);
  return match[1].trim();
}

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgba?.[1]) {
    const [r, g, b, a] = rgba[1].split(',').map((part) => Number(part.trim()));
    return { r: r ?? 0, g: g ?? 0, b: b ?? 0, a: a ?? 1 };
  }
  throw new Error(`Unsupported colour: ${value}`);
}

/** Resolves a token name or a literal colour. */
function color(ref: string): Rgba {
  return parseColor(ref.startsWith('--') ? tokenValue(ref.slice(2)) : ref);
}

function over(top: Rgba, under: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + under.r * (1 - a),
    g: top.g * a + under.g * (1 - a),
    b: top.b * a + under.b * (1 - a),
    a: 1,
  };
}

function luminance({ r, g, b }: Rgba): number {
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

interface Pair {
  use: string;
  fg: string;
  /** Surface the foreground sits on. */
  bg: string;
  /** What lies behind the surface: the opaque overlay, or the board under a prompt. */
  on?: 'prompt';
  min: number;
}

const PAGE = '--bg';
const PANEL = '--bg-raise';
const PAIRS: Pair[] = [
  { use: 'Body text on the page', fg: '--text', bg: PAGE, min: TEXT_MIN },
  { use: 'Body text on a panel', fg: '--text', bg: PANEL, min: TEXT_MIN },
  { use: 'Muted text on the page', fg: '--muted', bg: PAGE, min: TEXT_MIN },
  { use: 'Muted text on a panel', fg: '--muted', bg: PANEL, min: TEXT_MIN },
  { use: 'Cyan accent on the page', fg: '--cyan', bg: PAGE, min: TEXT_MIN },
  { use: 'Cyan accent on a panel', fg: '--cyan', bg: PANEL, min: TEXT_MIN },
  { use: 'Primary button label', fg: '--cyan', bg: '--cyan-deep', min: TEXT_MIN },
  { use: 'Gold accent on the page', fg: '--gold', bg: PAGE, min: TEXT_MIN },
  { use: 'Gold accent on a panel', fg: '--gold', bg: PANEL, min: TEXT_MIN },
  { use: 'Danger text on the page', fg: '--danger', bg: PAGE, min: TEXT_MIN },
  { use: 'Danger text on a panel', fg: '--danger', bg: PANEL, min: TEXT_MIN },
  { use: 'Body text on a prompt over the board', fg: '--text', bg: PANEL, on: 'prompt', min: TEXT_MIN },
  { use: 'Muted text on a prompt over the board', fg: '--muted', bg: PANEL, on: 'prompt', min: TEXT_MIN },
  { use: 'Cyan accent on a prompt over the board', fg: '--cyan', bg: PANEL, on: 'prompt', min: TEXT_MIN },
  { use: 'Danger text on a prompt over the board', fg: '--danger', bg: PANEL, on: 'prompt', min: TEXT_MIN },
  { use: 'Safe text on the page', fg: '--safe', bg: PAGE, min: TEXT_MIN },
  { use: 'Boss name', fg: '#d8c8ff', bg: PAGE, min: TEXT_MIN },
  { use: 'Cleared title', fg: '#f7e9c0', bg: PAGE, min: TEXT_MIN },
  { use: 'Lost title', fg: '#e9b9b3', bg: PAGE, min: TEXT_MIN },
  { use: 'Focus ring on the page', fg: '--cyan', bg: PAGE, min: GRAPHIC_MIN },
  { use: 'Focus ring on a panel', fg: '--cyan', bg: PANEL, min: GRAPHIC_MIN },
  { use: 'Control edge (input and button border)', fg: '--line-control', bg: PANEL, min: GRAPHIC_MIN },
];

interface Row {
  use: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
}

function evaluate(pair: Pair): Row {
  const page = color(PAGE);
  const fg = color(pair.fg);
  const surface = color(pair.bg);
  const backdrop = pair.on === 'prompt' ? over({ ...page, a: PROMPT_DIM }, parseColor(LIGHTEST_BOARD)) : page;
  const flatBg = over(surface, backdrop);
  const value = ratio(over(fg, flatBg), flatBg);
  return { use: pair.use, fg: pair.fg, bg: pair.bg, ratio: Math.round(value * 100) / 100, min: pair.min };
}

const rows = PAIRS.map(evaluate);
const failing = rows.filter((row) => row.ratio < row.min);

if (MARKDOWN) {
  console.log('| Use | Foreground | Surface | Ratio | Needs | Result |');
  console.log('|---|---|---|---|---|---|');
  for (const row of rows) {
    console.log(
      `| ${row.use} | \`${row.fg}\` | \`${row.bg}\` | ${row.ratio.toFixed(2)} | ${row.min} | ${row.ratio >= row.min ? 'pass' : 'fail'} |`
    );
  }
} else {
  for (const row of rows)
    console.log(`${row.ratio >= row.min ? 'ok  ' : 'FAIL'} ${row.ratio.toFixed(2).padStart(5)} (needs ${row.min})  ${row.use}`);
  console.log(failing.length === 0 ? 'CONTRAST: all pairs pass' : `CONTRAST: ${failing.length} pairs below threshold`);
}
process.exit(failing.length === 0 ? 0 : 1);
