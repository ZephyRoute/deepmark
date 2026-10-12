import type { PlayerRecord } from '../stellar/contract';

/** What the contract's record says about a run whose finish response was lost. */
export type SettlementCheck = 'recorded' | 'notRecorded' | 'unknown';

/**
 * `finish_run` bumps `total_runs` exactly once when it lands. A retry that finds
 * no open run is only proof of settlement if the count moved past what it was
 * before the first attempt. Without a baseline or a readable record we cannot say.
 */
export async function checkSettlement(
  readRecord: () => Promise<PlayerRecord | null>,
  baselineRuns: number | null
): Promise<SettlementCheck> {
  if (baselineRuns === null) return 'unknown';
  try {
    const record = await readRecord();
    return (record?.total_runs ?? 0) > baselineRuns ? 'recorded' : 'notRecorded';
  } catch {
    return 'unknown';
  }
}
