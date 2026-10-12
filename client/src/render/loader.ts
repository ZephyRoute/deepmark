import '../loader.css';
import { sigilIcon } from './sigil';

const DEFAULT_ROWS = 3;

/**
 * The shared waiting state for anything that reads the chain: the Deepmark
 * sigil breathing above a few skeleton rows. It is announced once as a status
 * and marked busy, and the decorative parts are hidden from assistive tech.
 */
export function loadingBlock(message: string, rows = DEFAULT_ROWS): HTMLElement {
  const block = document.createElement('div');
  block.className = 'loader';
  block.setAttribute('role', 'status');
  block.setAttribute('aria-busy', 'true');

  const mark = document.createElement('span');
  mark.className = 'loader-mark';
  mark.append(sigilIcon());
  mark.setAttribute('aria-hidden', 'true');

  const text = document.createElement('p');
  text.className = 'loader-text';
  text.textContent = message;

  const lines = document.createElement('div');
  lines.className = 'loader-rows';
  lines.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < rows; i += 1) {
    const line = document.createElement('span');
    line.className = 'loader-row';
    lines.append(line);
  }

  block.append(mark, text, lines);
  return block;
}
