import { instance } from '@viz-js/viz';
import { Resvg } from '@resvg/resvg-js';
import { escapeXml, type DiagramMeta } from './style';

let vizPromise: ReturnType<typeof instance> | null = null;

export async function dotToSvg(dot: string): Promise<string> {
  vizPromise ??= instance();
  const viz = await vizPromise;
  return viz.renderString(dot, { format: 'svg' });
}

/** Adds an accessible name and description to the root svg element. */
export function withAccessibility(svg: string, meta: DiagramMeta): string {
  const open = /<svg ([^>]*)>/;
  if (!open.test(svg)) throw new Error(`No svg element in ${meta.name}`);
  const idBase = `dm-${meta.name}`;
  return svg.replace(
    open,
    (_all, attrs: string) =>
      `<svg ${attrs} role="img" aria-labelledby="${idBase}-title ${idBase}-desc">` +
      `<title id="${idBase}-title">${escapeXml(meta.title)}</title>` +
      `<desc id="${idBase}-desc">${escapeXml(meta.description)}</desc>`,
  );
}

const PNG_WIDTH = 1800;

export function svgToPng(svg: string): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: PNG_WIDTH },
    font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica' },
  });
  return resvg.render().asPng();
}
