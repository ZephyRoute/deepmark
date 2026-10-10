import { describe, expect, test } from 'bun:test';
import { HERO_ORDER } from '../src/game/heroes';
import { CHARMS, WEAPONS } from '../src/game/items';
import { KIT_CLEAR_PERCENT } from '../src/game/kitDifficulty.generated';
import {
  clearPercent,
  difficultyOf,
  FORGIVING_FROM_PERCENT,
  isRecommended,
  RECOMMENDED_KIT,
  RISKY_BELOW_PERCENT,
  type Difficulty,
} from '../src/game/kitDifficulty';

/** The band every kit must stay inside at rank 0, so no first descent is hopeless or free. */
const MIN_CLEAR_PERCENT = 25;
const MAX_CLEAR_PERCENT = 60;

function allKits(): { base: number; weapon: number; charm: number; percent: number }[] {
  return HERO_ORDER.flatMap((_, base) =>
    WEAPONS.flatMap((_, weapon) => CHARMS.map((_, charm) => ({ base, weapon, charm, percent: clearPercent({ base, weapon, charm }) ?? NaN })))
  );
}

describe('kit difficulty table', () => {
  test('has a measurement for every kit and none for kits that do not exist', () => {
    expect(allKits().every((kit) => Number.isFinite(kit.percent))).toBe(true);
    expect(clearPercent({ base: HERO_ORDER.length, weapon: 0, charm: 0 })).toBeNull();
    expect(clearPercent({ base: 0, weapon: WEAPONS.length, charm: 0 })).toBeNull();
    expect(clearPercent({ base: 0, weapon: 0, charm: CHARMS.length })).toBeNull();
    expect(KIT_CLEAR_PERCENT.length).toBe(HERO_ORDER.length);
  });

  test('keeps every kit between 25 and 60 percent full clears at rank 0', () => {
    for (const kit of allKits()) {
      expect(kit.percent).toBeGreaterThanOrEqual(MIN_CLEAR_PERCENT);
      expect(kit.percent).toBeLessThanOrEqual(MAX_CLEAR_PERCENT);
    }
  });

  test('recommends the kit that clears most often', () => {
    const best = Math.max(...allKits().map((kit) => kit.percent));
    expect(clearPercent(RECOMMENDED_KIT)).toBe(best);
    expect(isRecommended(RECOMMENDED_KIT)).toBe(true);
  });

  test('uses all three labels, split at the documented thresholds', () => {
    const tiers = new Set<Difficulty>(allKits().map((kit) => difficultyOf(kit.percent)));
    expect(tiers).toEqual(new Set<Difficulty>(['forgiving', 'balanced', 'risky']));
    expect(difficultyOf(FORGIVING_FROM_PERCENT)).toBe('forgiving');
    expect(difficultyOf(FORGIVING_FROM_PERCENT - 1)).toBe('balanced');
    expect(difficultyOf(RISKY_BELOW_PERCENT)).toBe('balanced');
    expect(difficultyOf(RISKY_BELOW_PERCENT - 1)).toBe('risky');
  });
});
