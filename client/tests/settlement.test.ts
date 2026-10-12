import { describe, expect, test } from 'bun:test';
import { checkSettlement } from '../src/app/settlement';
import type { PlayerRecord } from '../src/stellar/contract';

function record(totalRuns: number): PlayerRecord {
  return { total_runs: totalRuns } as PlayerRecord;
}

describe('checkSettlement', () => {
  test('a run count past the baseline proves the earlier send landed', async () => {
    expect(await checkSettlement(async () => record(4), 3)).toBe('recorded');
  });

  test('an unchanged count means nothing was recorded', async () => {
    expect(await checkSettlement(async () => record(3), 3)).toBe('notRecorded');
    expect(await checkSettlement(async () => null, 0)).toBe('notRecorded');
  });

  test('no baseline or an unreadable record cannot be confirmed', async () => {
    expect(await checkSettlement(async () => record(9), null)).toBe('unknown');
    expect(
      await checkSettlement(async () => {
        throw new Error('timeout');
      }, 3)
    ).toBe('unknown');
  });
});
