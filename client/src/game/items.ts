/**
 * The predefined items a delver can carry. Each item is a trade-off, never a
 * strict upgrade, and only changes hit points and the damage range, so the
 * contract's replay gains no new rules. Numbers are mirrored in
 * `contracts/deepmark-contract/src/world.rs` and checked by the golden
 * vectors, so change both together.
 */
export interface Modifier {
  hp: number;
  dmgMin: number;
  dmgMax: number;
}

export interface Item extends Modifier {
  id: number;
  name: string;
  /** One line on the trade-off, shown in the creator. */
  blurb: string;
  /** Painted icon under /art. */
  icon: string;
}

export const WEAPONS: readonly Item[] = [
  { id: 0, name: 'Plumb Blade', icon: 'plumb-blade.webp', blurb: 'A sharper floor on every strike, at the cost of a thinner coat.', hp: -2, dmgMin: 1, dmgMax: 0 },
  { id: 1, name: 'Reaver Hook', icon: 'reaver-hook.webp', blurb: 'Wild swings that can end a fight early.', hp: -2, dmgMin: 0, dmgMax: 2 },
  { id: 2, name: 'Bulwark Pike', icon: 'bulwark-pike.webp', blurb: 'A reach that keeps you standing, with softer blows.', hp: 1, dmgMin: 0, dmgMax: -1 },
];

export const CHARMS: readonly Item[] = [
  { id: 0, name: 'Oil Flask', icon: 'oil-flask.webp', blurb: 'Slick and unsteady: hits vary more and you are a little sturdier.', hp: 1, dmgMin: -1, dmgMax: 1 },
  { id: 1, name: 'Keen Eye', icon: 'keen-eye.webp', blurb: 'Hits land far harder. You feel every wound.', hp: -3, dmgMin: 1, dmgMax: 2 },
  { id: 2, name: 'Stone Heart', icon: 'stone-heart.webp', blurb: 'A small, dependable boost to endurance.', hp: 1, dmgMin: 0, dmgMax: 0 },
];

export function weaponAt(id: number): Item | null {
  return WEAPONS[id] ?? null;
}

export function charmAt(id: number): Item | null {
  return CHARMS[id] ?? null;
}
