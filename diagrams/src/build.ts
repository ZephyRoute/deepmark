import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { svgToPng } from './render';
import { ALL_DIAGRAMS } from './registry';

/** Writes every diagram as svg and png into `<out>/svg` and `<out>/png`. */
export async function buildAll(outDir: string, withPng: boolean): Promise<void> {
  await mkdir(join(outDir, 'svg'), { recursive: true });
  if (withPng) await mkdir(join(outDir, 'png'), { recursive: true });
  for (const diagram of ALL_DIAGRAMS) {
    const svg = await diagram.svg();
    await Bun.write(join(outDir, 'svg', `${diagram.meta.name}.svg`), svg);
    if (withPng) await Bun.write(join(outDir, 'png', `${diagram.meta.name}.png`), svgToPng(svg));
  }
}

if (import.meta.main) {
  const out = join(import.meta.dir, '..', 'out');
  await buildAll(out, true);
  console.log(`Wrote ${ALL_DIAGRAMS.length} diagrams to ${out}`);
}
