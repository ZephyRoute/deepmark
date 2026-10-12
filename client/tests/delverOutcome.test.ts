import { describe, expect, test } from 'bun:test';
import { delverGrewKicker, delverOutcome } from '../src/game/delverOutcome';

describe('delverOutcome', () => {
  test('no hero id means nothing happened to a delver', () => {
    expect(delverOutcome(null, false, null)).toEqual({ kind: 'none' });
    expect(delverOutcome(null, true, null)).toEqual({ kind: 'none' });
  });

  test('a fresh delver clearing all floors earns a new delver', () => {
    expect(delverOutcome(4, false, null)).toEqual({ kind: 'earned' });
  });

  test('a veteran clear never claims a new delver, only a grown record', () => {
    expect(delverOutcome(1, true, 2)).toEqual({ kind: 'grew', clears: 2 });
    expect(delverOutcome(1, true, null)).toEqual({ kind: 'grew', clears: null });
  });

  test('the veteran kicker is accurate and never says a new delver', () => {
    expect(delverGrewKicker(2)).toBe("Your delver's record grew: 2 clears");
    expect(delverGrewKicker(1)).toBe("Your delver's record grew: 1 clear");
    expect(delverGrewKicker(null)).toBe("Your delver's record grew");
    expect(delverGrewKicker(3).toLowerCase()).not.toContain('new delver');
  });
});
