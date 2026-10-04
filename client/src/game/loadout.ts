import { CHARMS, WEAPONS } from './items';
import { HEROES, HERO_ORDER } from './heroes';

/** Most victories that still add a hit point. Matches `MAX_RANK` in the contract. */
export const MAX_RANK = 3;

export interface Loadout {
  /** Index into `HERO_ORDER`: 0 Lantern, 1 Cinder. */
  base: number;
  weapon: number;
  charm: number;
  /** Victories earned by an owned delver, capped at `MAX_RANK`. Fresh delvers are rank 0. */
  rank: number;
}

export interface Stats {
  maxHp: number;
  dmgMin: number;
  dmgMax: number;
}

export function isValidLoadout(l: Loadout): boolean {
  return (
    Number.isInteger(l.base) &&
    l.base >= 0 &&
    l.base < HERO_ORDER.length &&
    Number.isInteger(l.weapon) &&
    l.weapon >= 0 &&
    l.weapon < WEAPONS.length &&
    Number.isInteger(l.charm) &&
    l.charm >= 0 &&
    l.charm < CHARMS.length &&
    Number.isInteger(l.rank) &&
    l.rank >= 0 &&
    l.rank <= MAX_RANK
  );
}

export function rankForClears(clears: number): number {
  return Math.min(Math.max(clears, 0), MAX_RANK);
}

/**
 * The single place a delver's numbers are computed. The contract has the same
 * function in Rust. Hit points and damage never drop below 1 and the maximum
 * never falls under the minimum.
 */
export function statsFor(l: Loadout): Stats {
  const id = HERO_ORDER[l.base];
  const base = id ? HEROES[id] : undefined;
  const weapon = WEAPONS[l.weapon];
  const charm = CHARMS[l.charm];
  if (!base || !weapon || !charm) throw new Error('Invalid loadout');
  const rank = Math.min(Math.max(l.rank, 0), MAX_RANK);
  const maxHp = Math.max(1, base.maxHp + weapon.hp + charm.hp + rank);
  const dmgMin = Math.max(1, base.dmgMin + weapon.dmgMin + charm.dmgMin);
  const dmgMax = Math.max(dmgMin, base.dmgMax + weapon.dmgMax + charm.dmgMax);
  return { maxHp, dmgMin, dmgMax };
}

export const NAME_MIN = 3;
export const NAME_MAX = 16;
export const EMBLEM_COUNT = 6;
export const CLOAK_COUNT = 6;

/** How a delver looks. Cosmetic only: it never changes the simulation. */
export interface Look {
  name: string;
  emblem: number;
  cloak: number;
}

const NAME_PATTERN = /^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/;

/** Letters, digits and single spaces only, 3 to 16 characters. The contract applies the same rule. */
export function isValidName(name: string): boolean {
  return name.length >= NAME_MIN && name.length <= NAME_MAX && NAME_PATTERN.test(name);
}

export function isValidLook(look: Look): boolean {
  return (
    isValidName(look.name) &&
    Number.isInteger(look.emblem) &&
    look.emblem >= 0 &&
    look.emblem < EMBLEM_COUNT &&
    Number.isInteger(look.cloak) &&
    look.cloak >= 0 &&
    look.cloak < CLOAK_COUNT
  );
}
