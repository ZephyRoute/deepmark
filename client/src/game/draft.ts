import { CHARMS, WEAPONS } from './items';
import { HERO_ORDER } from './heroes';
import { RECOMMENDED_KIT } from './kitDifficulty';
import { CLOAK_COUNT, EMBLEM_COUNT, isValidName, type Loadout, type Look } from './loadout';
import { readJson, writeJson } from '../storage';

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
  return { look: { name: randomName(), emblem: 0, cloak: 0 }, ...RECOMMENDED_KIT };
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
  // Missing or corrupt data falls through to a fresh draft.
  return sanitize(readJson(STORAGE_KEY)) ?? defaultDraft();
}

export function saveDraft(draft: Draft): void {
  writeJson(STORAGE_KEY, draft);
}

export function loadoutOf(draft: Draft): Loadout {
  return { base: draft.base, weapon: draft.weapon, charm: draft.charm, rank: 0 };
}

export interface Challenge {
  base: number;
  weapon: number;
  charm: number;
  seed: number;
}

/**
 * Reads a shared challenge link's kit and seed from the URL, once. The seed only
 * ever suggests a practice descent, since a verified run's seed always comes from
 * the contract, never the client.
 */
export function takeChallengeFromUrl(): Challenge | null {
  const params = new URLSearchParams(location.search);
  if (!params.has('seed')) return null;
  const seed = Number(params.get('seed'));
  const base = Number(params.get('base'));
  const weapon = Number(params.get('weapon'));
  const charm = Number(params.get('charm'));
  history.replaceState(null, '', location.pathname);
  if (!Number.isFinite(seed) || !inRange(base, HERO_ORDER.length) || !inRange(weapon, WEAPONS.length) || !inRange(charm, CHARMS.length)) {
    return null;
  }
  return { base, weapon, charm, seed };
}
