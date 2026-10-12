import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SourcePart } from './manifest';

/** The repository root, one level above the client. */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface ExtractedPart {
  markdown: string;
  /** Headings below the dropped section heading move up one level. */
  shiftDepth: boolean;
}

interface HeadingLine {
  index: number;
  depth: number;
  text: string;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

function headingLines(lines: string[]): HeadingLine[] {
  const found: HeadingLine[] = [];
  let inFence = false;
  lines.forEach((line, index) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = HEADING.exec(line);
    if (match?.[1] && match[2]) found.push({ index, depth: match[1].length, text: match[2] });
  });
  return found;
}

export function readRepoFile(file: string): string {
  return readFileSync(join(REPO_ROOT, file), 'utf8');
}

/** Cut the requested slice out of a source file. Throws when a heading is missing. */
export function extractPart(part: SourcePart): ExtractedPart {
  const lines = readRepoFile(part.file).split('\n');
  const headings = headingLines(lines);
  const h1 = headings.find((h) => h.depth === 1);
  const afterTitle = h1 ? h1.index + 1 : 0;

  if (part.heading) {
    const start = headings.find((h) => h.depth === 2 && h.text === part.heading);
    if (!start) throw new Error(`docs: heading "${part.heading}" not found in ${part.file}`);
    const next = headings.find((h) => h.index > start.index && h.depth <= 2);
    const end = next ? next.index : lines.length;
    const from = part.dropHeading ? start.index + 1 : start.index;
    return { markdown: lines.slice(from, end).join('\n'), shiftDepth: Boolean(part.dropHeading) };
  }

  const firstH2 = headings.find((h) => h.depth === 2);
  const end = part.intro && firstH2 ? firstH2.index : lines.length;
  return { markdown: lines.slice(afterTitle, end).join('\n'), shiftDepth: false };
}
