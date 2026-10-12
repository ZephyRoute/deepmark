import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIAGRAMS_DIR } from './manifest';
import { REPO_ROOT } from './sources';

export interface Diagram {
  /** File name without extension, also the anchor on the diagrams page. */
  stem: string;
  file: string;
  title: string;
  description: string;
  bytes: Uint8Array;
}

function tagText(svg: string, tag: 'title' | 'desc'): string {
  const match = new RegExp(`<${tag}\\s+id="[^"]*">([\\s\\S]*?)</${tag}>`).exec(svg);
  return match?.[1]?.trim() ?? '';
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Read every diagram. Fails when one has no title or description for its alt text. */
export function loadDiagrams(): Diagram[] {
  const dir = join(REPO_ROOT, DIAGRAMS_DIR);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.svg'))
    .sort()
    .map((name) => {
      const bytes = readFileSync(join(dir, name));
      const svg = bytes.toString('utf8');
      const title = decodeEntities(tagText(svg, 'title'));
      const description = decodeEntities(tagText(svg, 'desc'));
      if (!title || !description) throw new Error(`docs: ${DIAGRAMS_DIR}/${name} has no title or desc for alt text`);
      return { stem: name.replace(/\.svg$/, ''), file: `${DIAGRAMS_DIR}/${name}`, title, description, bytes };
    });
}
