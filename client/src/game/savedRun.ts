import { isValidLoadout, type Loadout, type Look } from './loadout';
import { ActionCode, applyAction, drainEvents, MAX_ACTIONS, newRun, type RunState } from './state';

/**
 * A run the contract has opened but not yet settled, kept in this browser so a
 * reload or a closed tab cannot lose a genuine result. It holds exactly what
 * the contract needs to replay the run: the seed it issued, the delver and the
 * action log. Everything else (board, hit points, relics) is rebuilt by
 * replaying the log through the same simulation the contract mirrors.
 */
export interface SavedRun {
  seed: number;
  loadout: Loadout;
  actions: number[];
}

/** The part of the contract's open run that a saved run must agree with. */
export interface OpenTicket {
  seed: number;
  base: number;
  weapon: number;
  charm: number;
  rank: number;
  look: Look;
}

export type ResumePlan =
  | { kind: 'discard' }
  /** The run is still being played: carry on from the rebuilt board. */
  | { kind: 'continue'; run: RunState }
  /** The run had already ended: its log still has to reach the contract. */
  | { kind: 'submit'; run: RunState };

const STORAGE_KEY = 'deepmark:open-run:v1';
const FORMAT_VERSION = 1;
const SEED_LIMIT = 0x1_0000_0000;
/** Room for the 2,048 action digits plus the delver, with margin. Anything larger is not ours. */
export const MAX_SAVED_BYTES = 4096;
const ACTION_CODES = Object.values(ActionCode);

interface StoredRun {
  v: number;
  seed: number;
  base: number;
  weapon: number;
  charm: number;
  rank: number;
  /** One digit per action, the same encoding the golden vectors use. */
  actions: string;
}

function encodeActions(actions: readonly number[]): string {
  return actions.join('');
}

function decodeActions(text: string): number[] | null {
  if (text.length > MAX_ACTIONS) return null;
  const actions: number[] = [];
  for (const char of text) {
    const code = Number(char);
    if (!ACTION_CODES.some((valid) => valid === code)) return null;
    actions.push(code);
  }
  return actions;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Parses saved text into a run, or null when it is malformed, oversized or from another format. */
export function parseSavedRun(raw: string): SavedRun | null {
  if (raw.length > MAX_SAVED_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const stored = value as Partial<Record<keyof StoredRun, unknown>>;
  if (stored.v !== FORMAT_VERSION || typeof stored.actions !== 'string') return null;
  const { seed, base, weapon, charm, rank } = stored;
  if (!isCount(seed) || seed >= SEED_LIMIT) return null;
  if (!isCount(base) || !isCount(weapon) || !isCount(charm) || !isCount(rank)) return null;
  const loadout: Loadout = { base, weapon, charm, rank };
  if (!isValidLoadout(loadout)) return null;
  const actions = decodeActions(stored.actions);
  if (!actions) return null;
  return { seed, loadout, actions };
}

export function serializeSavedRun(run: RunState): string {
  const { base, weapon, charm, rank } = run.loadout;
  const stored: StoredRun = { v: FORMAT_VERSION, seed: run.seed, base, weapon, charm, rank, actions: encodeActions(run.actions) };
  return JSON.stringify(stored);
}

export function saveRun(run: RunState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeSavedRun(run));
  } catch {
    // Storage is unavailable (private mode, quota): the run still plays, it just cannot resume after a reload.
  }
}

export function loadSavedRun(): SavedRun | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseSavedRun(raw) : null;
  } catch {
    return null;
  }
}

export function clearSavedRun(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored, or storage is unavailable. Either way there is nothing to clear.
  }
}

/**
 * Rebuilds a run by replaying its log from the start, exactly as the contract
 * will. Returns null if any action does not apply, which means the saved data
 * is not a log this simulation could have produced.
 */
export function replayRun(loadout: Loadout, seed: number, look: Look, actions: readonly number[]): RunState | null {
  const state = newRun(loadout, seed, look);
  for (const code of actions) {
    if (!applyAction(state, code as ActionCode)) return null;
  }
  // Replaying raises the same events as live play. They describe moments that already
  // happened, so they must not reach the sounds, particles or the leaderboard.
  drainEvents(state);
  return state;
}

function matchesTicket(saved: SavedRun, ticket: OpenTicket): boolean {
  const { loadout } = saved;
  return (
    saved.seed === ticket.seed &&
    loadout.base === ticket.base &&
    loadout.weapon === ticket.weapon &&
    loadout.charm === ticket.charm &&
    loadout.rank === ticket.rank
  );
}

/**
 * Decides what a saved run means now that the contract has been asked which
 * run it still holds open. The contract is the authority: a saved run is only
 * ever resumed when it describes that very run.
 */
export function planResume(saved: SavedRun | null, ticket: OpenTicket | null): ResumePlan {
  if (!saved || !ticket || !matchesTicket(saved, ticket)) return { kind: 'discard' };
  const run = replayRun(saved.loadout, saved.seed, ticket.look, saved.actions);
  if (!run) return { kind: 'discard' };
  return { kind: run.mode === 'result' ? 'submit' : 'continue', run };
}
