import { CHARMS, WEAPONS } from './items';
import { HERO_ORDER } from './heroes';
import { CLOAK_COUNT, EMBLEM_COUNT, isValidName, type Loadout, type Look } from './loadout';

/** A delver being built in the creator, kept in this browser until a run starts. */
export interface Draft {
  look: Look;
  base: number;
  weapon: number;
  charm: number;
}

const STORAGE_KEY = 'deepmark:creator:v1';

const NAME_POOL = ['Ash', 'Mara Voss', 'Corin', 'Wick', 'Ilse', 'Tamsin', 'Brannoch', 'Sera Vale', 'Orrin', 'Nell'];

export function randomName(): string {
  return NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)] ?? 'Ash';
}

export function defaultDraft(): Draft {
  // The kit that clears most often in the balance simulator, so a first descent is a fair one.
  return { look: { name: randomName(), emblem: 0, cloak: 0 }, base: 1, weapon: 1, charm: 2 };
}

function inRange(value: unknown, count: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < count;
}

function sanitize(raw: unknown): Draft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const look = r.look as Record<string, unknown> | undefined;
  if (!look || typeof look.name !== 'string' || !isValidName(look.name)) return null;
  if (!inRange(look.emblem, EMBLEM_COUNT) || !inRange(look.cloak, CLOAK_COUNT)) return null;
  if (!inRange(r.base, HERO_ORDER.length) || !inRange(r.weapon, WEAPONS.length) || !inRange(r.charm, CHARMS.length)) {
    return null;
  }
  return { look: { name: look.name, emblem: look.emblem, cloak: look.cloak }, base: r.base, weapon: r.weapon, charm: r.charm };
}

export function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const draft = sanitize(JSON.parse(raw));
      if (draft) return draft;
    }
  } catch {
    // Private mode or corrupt data: fall through to a fresh draft.
  }
  return defaultDraft();
}

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // The draft still lasts for this tab.
  }
}

export function loadoutOf(draft: Draft): Loadout {
  return { base: draft.base, weapon: draft.weapon, charm: draft.charm, rank: 0 };
}
