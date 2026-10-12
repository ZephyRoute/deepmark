/** One shared look for every diagram: deep blue black ground, warm gold accents. */

export const FONT = 'Helvetica';
export const MONO = 'Courier';

export const COLORS = {
  background: '#0a0d1a',
  panel: '#101528',
  text: '#eef0f8',
  muted: '#9aa3bd',
  edge: '#8c96b4',
  gold: '#e8b84a',
} as const;

/** Semantic zones. Fill is a dark card, line and ink carry the zone colour. */
export type Zone = 'client' | 'contract' | 'asset' | 'network' | 'danger' | 'ok' | 'warn' | 'plain';

export interface ZoneStyle {
  fill: string;
  line: string;
  ink: string;
}

export const ZONES: Record<Zone, ZoneStyle> = {
  client: { fill: '#14233f', line: '#5b9bf0', ink: '#cfe3ff' },
  contract: { fill: '#2b2110', line: '#e8b84a', ink: '#ffe9ad' },
  asset: { fill: '#241a3d', line: '#a785ee', ink: '#e3d6ff' },
  network: { fill: '#1b2133', line: '#7f8aa8', ink: '#dde2f0' },
  danger: { fill: '#34161c', line: '#ee6a63', ink: '#ffd3cf' },
  ok: { fill: '#10302a', line: '#4cc79a', ink: '#c8f5e3' },
  warn: { fill: '#33200f', line: '#f0913a', ink: '#ffdcb8' },
  plain: { fill: '#141a2e', line: '#56607f', ink: '#dde2f0' },
};

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function escapeXml(text: string): string {
  return escapeHtml(text).replace(/'/g, '&apos;');
}

/** Graphviz HTML label: a bold title plus smaller muted lines. */
export function label(title: string, lines: readonly string[] = [], zone: Zone = 'plain'): string {
  const style = ZONES[zone];
  const rows = [
    `<TR><TD ALIGN="CENTER"><FONT FACE="${FONT}" POINT-SIZE="15" COLOR="${style.ink}"><B>${escapeHtml(title)}</B></FONT></TD></TR>`,
    ...lines.map(
      (line) =>
        `<TR><TD ALIGN="CENTER"><FONT FACE="${FONT}" POINT-SIZE="12" COLOR="${COLORS.muted}">${escapeHtml(line)}</FONT></TD></TR>`,
    ),
  ];
  return `<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="1" CELLPADDING="1">${rows.join('')}</TABLE>>`;
}

/** Record style field list: a title row, then one left aligned row per field. */
export function recordLabel(title: string, fields: readonly string[], note: string, zone: Zone): string {
  const style = ZONES[zone];
  const rows = [
    `<TR><TD ALIGN="LEFT"><FONT FACE="${FONT}" POINT-SIZE="15" COLOR="${style.ink}"><B>${escapeHtml(title)}</B></FONT></TD></TR>`,
    `<TR><TD ALIGN="LEFT"><FONT FACE="${FONT}" POINT-SIZE="11" COLOR="${COLORS.gold}">${escapeHtml(note)}</FONT></TD></TR>`,
    ...fields.map(
      (field) =>
        `<TR><TD ALIGN="LEFT"><FONT FACE="${MONO}" POINT-SIZE="12" COLOR="${COLORS.text}">${escapeHtml(field)}</FONT></TD></TR>`,
    ),
  ];
  return `<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="1" CELLPADDING="2">${rows.join('')}</TABLE>>`;
}

export interface NodeSpec {
  id: string;
  title: string;
  lines?: readonly string[];
  zone?: Zone;
  shape?: string;
  style?: string;
}

export function node(spec: NodeSpec): string {
  const zone = spec.zone ?? 'plain';
  const style = ZONES[zone];
  const shape = spec.shape ?? 'box';
  return `${spec.id} [label=${label(spec.title, spec.lines ?? [], zone)}, shape=${shape}, style="${spec.style ?? 'rounded,filled'}", fillcolor="${style.fill}", color="${style.line}"];`;
}

export interface EdgeSpec {
  from: string;
  to: string;
  text?: string;
  zone?: Zone;
  dashed?: boolean;
  extra?: string;
}

export function edge(spec: EdgeSpec): string {
  const color = spec.zone ? ZONES[spec.zone].line : COLORS.edge;
  const attrs = [`color="${color}"`, `fontcolor="${spec.zone ? ZONES[spec.zone].ink : COLORS.text}"`];
  if (spec.text) attrs.push(`label=${labelText(spec.text)}`);
  if (spec.dashed) attrs.push('style=dashed');
  if (spec.extra) attrs.push(spec.extra);
  return `${spec.from} -> ${spec.to} [${attrs.join(', ')}];`;
}

/** Edge label as an HTML label so the font is set explicitly. */
function labelText(text: string): string {
  const rows = text.split('\n').map((line) => escapeHtml(line)).join('<BR/>');
  return `<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2" BGCOLOR="${COLORS.background}"><TR><TD><FONT FACE="${FONT}" POINT-SIZE="12">${rows}</FONT></TD></TR></TABLE>>`;
}

export function cluster(id: string, title: string, zone: Zone, body: readonly string[]): string {
  const style = ZONES[zone];
  return `subgraph cluster_${id} {
  label=<<FONT FACE="${FONT}" POINT-SIZE="14" COLOR="${style.line}"><B>${escapeHtml(title)}</B></FONT>>;
  labeljust=l; style="rounded,filled"; fillcolor="${COLORS.background}"; color="${style.line}"; penwidth=1.6; margin=18;
  ${body.join('\n  ')}
}`;
}

/** Wraps graph content with the shared graph, node and edge defaults. */
export function graph(direction: 'LR' | 'TB', body: readonly string[], extra = ''): string {
  return `digraph G {
  rankdir=${direction}; bgcolor="${COLORS.background}"; pad=0.4; nodesep=0.45; ranksep=0.75;
  fontname="${FONT}"; splines=true; ${extra}
  node [fontname="${FONT}", penwidth=1.8, margin="0.22,0.12"];
  edge [fontname="${FONT}", penwidth=1.5, arrowsize=0.9];
  ${body.join('\n  ')}
}`;
}

export interface DiagramMeta {
  /** File stem and also used for ids. */
  name: string;
  title: string;
  /** Accessible description, also the suggested README alt text. */
  description: string;
}
