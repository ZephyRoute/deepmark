import { COLORS, FONT, ZONES, escapeXml, type Zone } from './style';

/** A tiny sequence diagram renderer: lifelines, labelled arrows, notes, phase bands. */

export interface Lifeline {
  id: string;
  title: string;
  subtitle: string;
  zone: Zone;
}

export type Step =
  | { kind: 'phase'; text: string }
  | { kind: 'arrow'; from: string; to: string; lines: readonly string[]; zone?: Zone; dashed?: boolean }
  | { kind: 'note'; over: readonly string[]; lines: readonly string[]; zone: Zone };

const GAP = 330;
const MARGIN = 70;
const HEADER_HEIGHT = 70;
const LINE_HEIGHT = 18;
const STEP_PAD = 26;
const CHAR_WIDTH = 7.2;

function text(x: number, y: number, content: string, size: number, fill: string, anchor: string, weight = 'normal', family = FONT): string {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(content)}</text>`;
}

export function renderSequence(lifelines: readonly Lifeline[], steps: readonly Step[]): string {
  const xOf = new Map<string, number>();
  lifelines.forEach((life, i) => xOf.set(life.id, MARGIN + GAP / 2 + i * GAP));
  const column = (id: string): number => {
    const x = xOf.get(id);
    if (x === undefined) throw new Error(`Unknown lifeline ${id}`);
    return x;
  };
  const width = MARGIN * 2 + GAP * lifelines.length;

  // First pass: vertical positions.
  let y = HEADER_HEIGHT + 20;
  const body: string[] = [];
  for (const step of steps) {
    if (step.kind === 'phase') {
      y += 14;
      body.push(`<rect x="12" y="${y - 16}" width="${width - 24}" height="26" rx="6" fill="${COLORS.panel}" stroke="${COLORS.gold}" stroke-opacity="0.45"/>`);
      body.push(text(26, y + 2, step.text, 14, COLORS.gold, 'start', 'bold'));
      y += 34;
    } else if (step.kind === 'arrow') {
      const x1 = column(step.from);
      const x2 = column(step.to);
      const color = step.zone ? ZONES[step.zone].line : COLORS.edge;
      const ink = step.zone ? ZONES[step.zone].ink : COLORS.text;
      const mid = (x1 + x2) / 2;
      const labelBottom = y + step.lines.length * LINE_HEIGHT;
      step.lines.forEach((line, i) => body.push(text(mid, y + i * LINE_HEIGHT, line, 13, ink, 'middle')));
      const ay = labelBottom - 4;
      const dir = x2 > x1 ? -1 : 1;
      const dash = step.dashed ? ' stroke-dasharray="7 5"' : '';
      body.push(`<line x1="${x1}" y1="${ay}" x2="${x2}" y2="${ay}" stroke="${color}" stroke-width="2"${dash}/>`);
      body.push(`<polygon points="${x2},${ay} ${x2 + dir * 10},${ay - 5} ${x2 + dir * 10},${ay + 5}" fill="${color}"/>`);
      y = ay + STEP_PAD;
    } else {
      const xs = step.over.map(column);
      const left = Math.min(...xs) - GAP / 2 + 22;
      const right = Math.max(...xs) + GAP / 2 - 22;
      const style = ZONES[step.zone];
      const height = step.lines.length * LINE_HEIGHT + 16;
      body.push(`<rect x="${left}" y="${y - 14}" width="${right - left}" height="${height}" rx="8" fill="${style.fill}" stroke="${style.line}" stroke-width="1.6"/>`);
      const maxChars = Math.floor((right - left - 24) / CHAR_WIDTH);
      step.lines.forEach((line, i) => {
        if (line.length > maxChars) throw new Error(`Note line too long (${line.length} > ${maxChars}): ${line}`);
        body.push(text(left + 14, y + 3 + i * LINE_HEIGHT, line, 13, style.ink, 'start'));
      });
      y += height + 4;
    }
  }
  const height = y + 30;

  const lifelinesSvg = lifelines.map((life) => {
    const x = column(life.id);
    const style = ZONES[life.zone];
    return [
      `<line x1="${x}" y1="${HEADER_HEIGHT}" x2="${x}" y2="${height - 14}" stroke="${style.line}" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="3 6"/>`,
      `<rect x="${x - 135}" y="14" width="270" height="${HEADER_HEIGHT - 20}" rx="10" fill="${style.fill}" stroke="${style.line}" stroke-width="2"/>`,
      text(x, 40, life.title, 16, style.ink, 'middle', 'bold'),
      text(x, 60, life.subtitle, 12, COLORS.muted, 'middle'),
    ].join('');
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${COLORS.background}"/>`,
    ...lifelinesSvg,
    ...body,
    '</svg>',
  ].join('\n');
}
