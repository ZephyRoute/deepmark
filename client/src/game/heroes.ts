export type HeroId = 'lantern' | 'cinder';

/** Order matches the base codes the contract uses: 0 Lantern, 1 Cinder. */
export const HERO_ORDER: readonly HeroId[] = ['lantern', 'cinder'];

export interface Hero {
  id: HeroId;
  name: string;
  blurb: string;
  maxHp: number;
  dmgMin: number;
  dmgMax: number;
  art: string;
  /** The seasoned look an owned delver takes on. */
  veteranArt: string;
}

export const HEROES: Record<HeroId, Hero> = {
  lantern: {
    id: 'lantern',
    name: 'Lantern',
    blurb: '10 HP, strikes for 2-5. Steady and wide.',
    maxHp: 10,
    dmgMin: 2,
    dmgMax: 5,
    art: 'player.webp',
    veteranArt: 'delver-lantern-veteran.webp',
  },
  cinder: {
    id: 'cinder',
    name: 'Cinder',
    blurb: '9 HP, strikes for 3-5. Hits harder.',
    maxHp: 9,
    dmgMin: 3,
    dmgMax: 5,
    art: 'cinder.webp',
    veteranArt: 'delver-cinder-veteran.webp',
  },
};
