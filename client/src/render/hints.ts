/**
 * First run guidance: three short hints, each tied to the moment it teaches,
 * shown once ever and remembered in local storage. A quiet card at the edge
 * of the board, never a modal, that steps out of the way the moment the
 * player answers it, so it never blocks input.
 */
import { readJson, writeJson } from '../storage';

export type HintId = 'move' | 'combat' | 'choice';

const STORAGE_KEY = 'deepmark:hints:v1';
const HOST_ID = 'hint';

const DISMISSED_BY: Record<HintId, readonly string[]> = {
  move: ['up', 'down', 'left', 'right'],
  combat: ['confirm', 'cancel'],
  choice: ['confirm', 'cancel'],
};

interface HintRecord {
  seen: Partial<Record<HintId, boolean>>;
}

function load(): HintRecord {
  const stored = readJson(STORAGE_KEY);
  // Missing or corrupt data just shows the hint again, which is harmless.
  if (stored && typeof stored === 'object' && 'seen' in stored) return stored as HintRecord;
  return { seen: {} };
}

function save(): void {
  writeJson(STORAGE_KEY, record);
}

let record = load();

function coarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

const COPY: Record<HintId, { title: string; body: string }> = {
  move: {
    title: 'Find your footing',
    body: coarsePointer() ? 'Move with the arrows below the board.' : 'Move with WASD or the arrow keys.',
  },
  combat: {
    title: 'A guardian blocks the way',
    body: 'Attack to strike first. Retreating is free, but a guardian keeps its wounds.',
  },
  choice: {
    title: 'The floor is clear',
    body: 'Descend to risk more for better relics, or extract to keep what you hold.',
  },
};

let activeId: HintId | null = null;

function host(): HTMLElement | null {
  return document.getElementById(HOST_ID);
}

/** Shows a hint if it has never been seen and no other hint is already showing. */
export function showHint(id: HintId): void {
  const node = host();
  if (!node || record.seen[id] || activeId) return;
  activeId = id;
  const copy = COPY[id];
  node.replaceChildren();
  const title = document.createElement('p');
  title.className = 'hint-title';
  title.textContent = copy.title;
  const body = document.createElement('p');
  body.className = 'hint-body';
  body.textContent = copy.body;
  node.append(title, body);
  node.hidden = false;
}

/** Call on every dispatched action. Dismisses the active hint if this input answers it. */
export function noteHintInput(action: string): void {
  if (!activeId) return;
  if (!DISMISSED_BY[activeId].includes(action)) return;
  record.seen[activeId] = true;
  save();
  const node = host();
  if (node) node.hidden = true;
  activeId = null;
}

/** The record screen's "Replay hints": every hint shows again at its next moment. */
export function resetHints(): void {
  record = { seen: {} };
  save();
}
