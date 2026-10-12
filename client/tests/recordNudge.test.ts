import { describe, expect, test } from 'bun:test';
import { shouldNudgeRecord } from '../src/game/recordNudge';

const FIRST_WIN = { practice: false, verified: true, won: true, verifiedRuns: 1 };

describe('keep your record nudge', () => {
  test('shows after a fresh account verified first win', () => {
    expect(shouldNudgeRecord(FIRST_WIN)).toBe(true);
  });

  test('stays away for a loss, a practice run, an unverified run or a returning account', () => {
    expect(shouldNudgeRecord({ ...FIRST_WIN, won: false })).toBe(false);
    expect(shouldNudgeRecord({ ...FIRST_WIN, practice: true })).toBe(false);
    expect(shouldNudgeRecord({ ...FIRST_WIN, verified: false })).toBe(false);
    expect(shouldNudgeRecord({ ...FIRST_WIN, verifiedRuns: 2 })).toBe(false);
    expect(shouldNudgeRecord({ ...FIRST_WIN, verifiedRuns: null })).toBe(false);
  });
});
