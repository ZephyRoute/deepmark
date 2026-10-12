import { afterEach, describe, expect, test } from 'bun:test';
import { RELIC_ASSETS, RELIC_ISSUER } from '../src/stellar/config';
import { CONTRACT_ERROR, freshChoice, isContractError, veteranChoice } from '../src/stellar/choice';
import { fetchRelicBalances } from '../src/stellar/relics';
import { count, isAddress, isTxHash, summarize, utcDays, type PlayerMark } from '../src/stats/summary';

const ADDRESS = `G${'A'.repeat(55)}`;
const realFetch = globalThis.fetch;

function respondWith(status: number, body: unknown): void {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('fetchRelicBalances', () => {
  const held = (code: string, balance: unknown, issuer: unknown = RELIC_ISSUER) => ({ asset_code: code, asset_issuer: issuer, balance });

  test('reads whole relics of each kind from our issuer', async () => {
    respondWith(200, {
      balances: [
        held('DMCOMMON', '3.0000000'),
        held('DMRARE', '1.0000000'),
        held('DMCORE', '12.0000000'),
        { asset_type: 'native', balance: '9.0000000' },
      ],
    });
    expect(await fetchRelicBalances(ADDRESS)).toEqual({ common: 3, rare: 1, core: 12 });
  });

  test('ignores a look alike asset from another issuer', async () => {
    respondWith(200, { balances: [held('DMCORE', '500.0000000', `G${'B'.repeat(55)}`)] });
    expect(await fetchRelicBalances(ADDRESS)).toEqual({ common: 0, rare: 0, core: 0 });
  });

  test('ignores malformed amounts and non string balances', async () => {
    respondWith(200, {
      balances: [held('DMCOMMON', '3'), held('DMRARE', 7), held('DMCORE', '1e9'), held('DMCOMMON', '99999999999999999.0000000')],
    });
    expect(await fetchRelicBalances(ADDRESS)).toEqual({ common: 0, rare: 0, core: 0 });
  });

  test('rounds a fractional balance down to whole relics', async () => {
    respondWith(200, { balances: [held('DMRARE', '2.5000000')] });
    expect((await fetchRelicBalances(ADDRESS)).rare).toBe(2);
  });

  test('an unfunded account (404) holds nothing, other failures throw', async () => {
    respondWith(404, {});
    expect(await fetchRelicBalances(ADDRESS)).toEqual({ common: 0, rare: 0, core: 0 });
    respondWith(500, {});
    await expect(fetchRelicBalances(ADDRESS)).rejects.toThrow('500');
  });

  test('a body without a balances list is treated as empty', async () => {
    respondWith(200, { balances: 'nope' });
    expect(await fetchRelicBalances(ADDRESS)).toEqual({ common: 0, rare: 0, core: 0 });
  });

  test('a malformed address never reaches the network', async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;
    expect(await fetchRelicBalances('../etc/passwd')).toEqual({ common: 0, rare: 0, core: 0 });
    expect(called).toBe(false);
  });
});

describe('contract helpers', () => {
  test('recognises a contract error by its code only', () => {
    const err = new Error('HostError: Error(Contract, #7)');
    expect(isContractError(err, CONTRACT_ERROR.TooFast)).toBe(true);
    expect(isContractError(err, CONTRACT_ERROR.StartCooldown)).toBe(false);
    expect(isContractError('Error(Contract, #7)', CONTRACT_ERROR.TooFast)).toBe(false);
  });

  test('builds tagged hero choices', () => {
    const look = { name: 'Ash', emblem: 0, cloak: 0 };
    expect(freshChoice({ look, base: 0, weapon: 1, charm: 2 }).tag).toBe('Fresh');
    expect(veteranChoice(4)).toEqual({ tag: 'Veteran', values: [4] });
  });

  test('the three relic assets are distinct classic assets with their own wrappers', () => {
    const codes = Object.values(RELIC_ASSETS).map((asset) => asset.code);
    const wrappers = Object.values(RELIC_ASSETS).map((asset) => asset.contractId);
    expect(new Set(codes).size).toBe(3);
    expect(new Set(wrappers).size).toBe(3);
    expect(isAddress(RELIC_ISSUER)).toBe(true);
  });
});

describe('response validators', () => {
  test('addresses and transaction hashes must match their exact shape', () => {
    expect(isAddress(ADDRESS)).toBe(true);
    expect(isAddress(`${ADDRESS}A`)).toBe(false);
    expect(isAddress(`g${'a'.repeat(55)}`)).toBe(false);
    expect(isAddress(42)).toBe(false);
    expect(isTxHash('a'.repeat(64))).toBe(true);
    expect(isTxHash('A'.repeat(64))).toBe(false);
    expect(isTxHash('a'.repeat(63))).toBe(false);
  });

  test('count accepts small whole non negative numbers and bigints only', () => {
    expect(count(5)).toBe(5);
    expect(count(5n)).toBe(5);
    expect(count(-1)).toBeNull();
    expect(count(1.5)).toBeNull();
    expect(count('5')).toBeNull();
    expect(count(4, 3)).toBeNull();
    expect(count(4n, 3)).toBeNull();
    expect(count(Number.NaN)).toBeNull();
  });
});

describe('traction summary', () => {
  const mark = (address: string, bestScore: number, bestFloor: number, relicsBanked = 0): PlayerMark => ({
    address,
    bestScore,
    bestFloor,
    extractions: 1,
    deaths: 1,
    forfeits: 0,
    relicsBanked,
    finishedRuns: 2,
  });

  test('ranks players by score, then floor, and tallies floors and banked relics', () => {
    const summary = summarize([mark('B', 10, 3, 2), mark('A', 10, 2), mark('C', 99, 1)], [], null, false, 5, false);
    expect(summary.players.map((p) => p.address)).toEqual(['C', 'B', 'A']);
    expect(summary.recordedRuns).toBe(6);
    expect(summary.bestFloorThree).toBe(1);
    expect(summary.bankedRelic).toBe(1);
    expect(summary.floorCounts).toEqual([0, 1, 1, 1]);
    expect(summary.openedCount).toBe(5);
  });

  test('counts recorded runs per day inside the window, newest runs first', () => {
    const runs = [
      { at: '2026-10-01T10:00:00.000Z', address: 'A', floorReached: 3, score: 1, extracted: true, txHash: '' },
      { at: '2026-10-02T10:00:00.000Z', address: 'A', floorReached: 3, score: 1, extracted: true, txHash: '' },
      { at: '2026-10-02T11:00:00.000Z', address: 'B', floorReached: 1, score: 0, extracted: false, txHash: '' },
    ];
    const summary = summarize([], runs, { from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T23:00:00.000Z' }, false, 0, false);
    expect(summary.days).toEqual([
      { day: '2026-10-01', runs: 1 },
      { day: '2026-10-02', runs: 2 },
    ]);
    expect(summary.recentRuns[0]?.at).toBe('2026-10-02T11:00:00.000Z');
  });

  test('utcDays is inclusive, empty on a backwards window and capped to the latest days', () => {
    expect(utcDays('2026-10-01T05:00:00Z', '2026-10-03T01:00:00Z')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(utcDays('2026-10-03T00:00:00Z', '2026-10-01T00:00:00Z')).toEqual([]);
    expect(utcDays('nonsense', '2026-10-01T00:00:00Z')).toEqual([]);
    const capped = utcDays('2026-01-01T00:00:00Z', '2026-10-01T00:00:00Z', 5);
    expect(capped).toHaveLength(5);
    expect(capped[4]).toBe('2026-10-01');
  });
});
