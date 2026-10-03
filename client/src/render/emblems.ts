import { CLOAK_COUNT, EMBLEM_COUNT } from '../game/loadout';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Six original emblems, one stroke weight, drawn on a 24 by 24 grid. */
const EMBLEM_PATHS: readonly string[] = [
  'M15 3a9 9 0 1 0 6 12 7 7 0 0 1-6-12z',
  'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4 0-6 1-9z',
  'M9 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12.5 12 21 20.5M17 17l2-2',
  'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'M6 21V9l2-2V4h2v2h4V4h2v3l2 2v12zM10 21v-5h4v5',
  'M2 9c3-3 5 3 8 0s5 3 8 0 3 0 4-1M2 16c3-3 5 3 8 0s5 3 8 0 3 0 4-1',
];

export const EMBLEM_NAMES: readonly string[] = ['Crescent', 'Ember', 'Key', 'Watcher', 'Tower', 'Tide'];

export function emblemIcon(index: number, className = 'emblem'): SVGSVGElement {
  const safe = index >= 0 && index < EMBLEM_COUNT ? index : 0;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', EMBLEM_PATHS[safe] ?? '');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

interface Cloak {
  name: string;
  /** A swatch close to the tint the portrait takes. */
  swatch: string;
  /** CSS filter that recolours the delver art. */
  filter: string;
}

const CLOAKS: readonly Cloak[] = [
  { name: 'Slate', swatch: '#5f7a8c', filter: 'none' },
  { name: 'Ember', swatch: '#c2603a', filter: 'hue-rotate(150deg) saturate(1.25)' },
  { name: 'Moss', swatch: '#6f9a55', filter: 'hue-rotate(260deg) saturate(1.15)' },
  { name: 'Dusk', swatch: '#8a64c6', filter: 'hue-rotate(50deg) saturate(1.2)' },
  { name: 'Brine', swatch: '#3d9aa8', filter: 'hue-rotate(320deg) saturate(1.1)' },
  { name: 'Ash', swatch: '#8c8c88', filter: 'grayscale(0.85) brightness(1.05)' },
];

export function cloakCount(): number {
  return Math.min(CLOAK_COUNT, CLOAKS.length);
}

export function cloakName(index: number): string {
  return CLOAKS[index]?.name ?? CLOAKS[0]?.name ?? '';
}

export function cloakSwatch(index: number): string {
  return CLOAKS[index]?.swatch ?? '#5f7a8c';
}

export function cloakFilter(index: number): string {
  return CLOAKS[index]?.filter ?? 'none';
}
