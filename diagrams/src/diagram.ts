import { dotToSvg, withAccessibility } from './render';
import type { DiagramMeta } from './style';

export interface Diagram {
  meta: DiagramMeta;
  /** Returns the finished svg, accessibility metadata included. */
  svg: () => Promise<string>;
}

export function dotDiagram(meta: DiagramMeta, dot: () => string): Diagram {
  return { meta, svg: async () => withAccessibility(await dotToSvg(dot()), meta) };
}
