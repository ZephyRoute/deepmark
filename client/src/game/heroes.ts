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
}

export const HEROES: Record<HeroId, Hero> = {
  lantern: {
    id: 'lantern',
    name: 'Lantern',
    blurb: '10 HP, strikes for 2-4. Lasts longer.',
    maxHp: 10,
    dmgMin: 2,
    dmgMax: 4,
    art: 'player.png',
  },
  cinder: {
    id: 'cinder',
    name: 'Cinder',
    blurb: '8 HP, strikes for 3-5. Hits harder.',
    maxHp: 8,
    dmgMin: 3,
    dmgMax: 5,
    art: 'cinder.png',
  },
};

const STORAGE_KEY = 'deepmark.hero';

export function isHeroId(value: string | null): value is HeroId {
  return value === 'lantern' || value === 'cinder';
}

export function loadHero(): HeroId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isHeroId(stored) ? stored : 'lantern';
  } catch {
    return 'lantern';
  }
}

export function saveHero(id: HeroId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // A private window can refuse storage. The choice still lasts for this tab.
  }
}
