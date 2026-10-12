import { KIT_CLEAR_PERCENT } from './kitDifficulty.generated';

export type Difficulty = 'forgiving' | 'balanced' | 'risky';

export interface Kit {
  base: number;
  weapon: number;
  charm: number;
}

/** A kit that clears at least this often (percent) reads as forgiving. */
export const FORGIVING_FROM_PERCENT = 45;
/** A kit that clears less often than this (percent) reads as risky. */
export const RISKY_BELOW_PERCENT = 36;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  forgiving: 'Forgiving',
  balanced: 'Balanced',
  risky: 'Risky',
};

/** How often a fresh delver with this kit clears all three floors, in percent, or null for an unknown kit. */
export function clearPercent(kit: Kit): number | null {
  return KIT_CLEAR_PERCENT[kit.base]?.[kit.weapon]?.[kit.charm] ?? null;
}

export function difficultyOf(percent: number): Difficulty {
  if (percent >= FORGIVING_FROM_PERCENT) return 'forgiving';
  if (percent < RISKY_BELOW_PERCENT) return 'risky';
  return 'balanced';
}

function bestKit(): Kit {
  let best: Kit = { base: 0, weapon: 0, charm: 0 };
  let bestPercent = -1;
  KIT_CLEAR_PERCENT.forEach((weapons, base) => {
    weapons.forEach((charms, weapon) => {
      charms.forEach((percent, charm) => {
        if (percent > bestPercent) {
          best = { base, weapon, charm };
          bestPercent = percent;
        }
      });
    });
  });
  return best;
}

/** The kit that clears most often, so a first descent is a fair one. The first of any tie wins. */
export const RECOMMENDED_KIT: Kit = bestKit();

export function isRecommended(kit: Kit): boolean {
  return kit.base === RECOMMENDED_KIT.base && kit.weapon === RECOMMENDED_KIT.weapon && kit.charm === RECOMMENDED_KIT.charm;
}
