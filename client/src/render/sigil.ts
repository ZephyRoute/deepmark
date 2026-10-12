const SVG_NS = 'http://www.w3.org/2000/svg';

function path(d: string, className: string): SVGPathElement {
  const node = document.createElementNS(SVG_NS, 'path');
  node.setAttribute('d', d);
  node.setAttribute('class', className);
  return node;
}

/**
 * The Deepmark sigil: the carved triangle-and-eye mark from the stone logo
 * (`/art/logo-lockup.webp`), redrawn as an inline vector so the seal is the
 * game's own mark instead of a generic check-in-a-ring.
 */
export function sigilIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('class', 'seal-icon');
  svg.setAttribute('aria-hidden', 'true');
  const outer = path('M32 9 L53 51 L11 51 Z', 'seal-outer');
  const inner = path('M23 19 L41 19 L32 31 Z', 'seal-inner');
  const eye = path('M21 41 Q32 34 43 41 Q32 48 21 41 Z', 'seal-eye');
  const pupil = document.createElementNS(SVG_NS, 'circle');
  pupil.setAttribute('cx', '32');
  pupil.setAttribute('cy', '41');
  pupil.setAttribute('r', '2.4');
  pupil.setAttribute('class', 'seal-pupil');
  svg.append(outer, inner, eye, pupil);
  return svg;
}
