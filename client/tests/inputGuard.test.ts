import { describe, expect, test } from 'bun:test';
import { RESULT_INPUT_GUARD_MS, resultGuardActive } from '../src/input/guard';

describe('result input guard', () => {
  test('ignores input right after the result appears', () => {
    expect(resultGuardActive(1000, 1000)).toBe(true);
    expect(resultGuardActive(1000, 1000 + RESULT_INPUT_GUARD_MS - 1)).toBe(true);
  });

  test('accepts input once the guard has elapsed', () => {
    expect(resultGuardActive(1000, 1000 + RESULT_INPUT_GUARD_MS)).toBe(false);
  });
});
