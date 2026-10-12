import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAll } from './build';

/**
 * Regenerates the svg files into a temp dir and fails when they differ from the
 * committed ones. PNGs are not compared: font rasterisation varies by machine.
 */
const committed = join(import.meta.dir, '..', 'out');
const temp = await mkdtemp(join(tmpdir(), 'deepmark-diagrams-'));
let failed = false;
try {
  await buildAll(temp, false);
  const fresh = (await readdir(join(temp, 'svg'))).sort();
  const existing = (await readdir(join(committed, 'svg')).catch(() => [] as string[])).sort();
  if (fresh.join() !== existing.join()) {
    console.error(`Diagram set differs. Generated: ${fresh.join(', ')}. Committed: ${existing.join(', ')}.`);
    failed = true;
  }
  for (const name of fresh) {
    const next = await Bun.file(join(temp, 'svg', name)).text();
    const old = await Bun.file(join(committed, 'svg', name)).text().catch(() => '');
    if (next !== old) {
      console.error(`Out of date: out/svg/${name}`);
      failed = true;
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
if (failed) {
  console.error('Run `bun run build` in diagrams/ and commit the result.');
  process.exit(1);
}
console.log('Diagrams are up to date.');
