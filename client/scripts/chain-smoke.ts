/**
 * End to end check of the client's Stellar layer against the deployed testnet
 * contract, using the same modules the game uses. Creates a throwaway
 * funded account, plays one verified run with a relic, and prints the result.
 *
 *   bun run scripts/chain-smoke.ts
 */
import { getPlayerKeypair } from '../src/stellar/account';
import { fetchPlayerCount, fetchRecord, fetchTop, finishRun, startRun, HERO_CODE } from '../src/stellar/contract';
import { fetchRelicBalances } from '../src/stellar/relics';
import { ActionCode } from '../src/game/state';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

function repeat(code: number, times: number): number[] {
  return Array.from({ length: times }, () => code);
}

// Beat the floor 1 Warden, take the common relic, leave over the detour.
const LOG = [
  ...repeat(ActionCode.Right, 4),
  ...repeat(ActionCode.Attack, 3),
  ...repeat(ActionCode.Right, 2),
  ...repeat(ActionCode.Left, 2),
  ...repeat(ActionCode.Up, 3),
  ...repeat(ActionCode.Right, 4),
  ...repeat(ActionCode.Down, 3),
  ActionCode.Right,
  ActionCode.Extract,
];

const t0 = Date.now();
const lap = (label: string): void => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${label}`);

const keypair = await getPlayerKeypair();
const address = keypair.publicKey();
lap(`account ready ${address.slice(0, 6)}...`);

const ticket = await startRun(keypair, HERO_CODE.lantern);
lap(`start_run seed=${ticket.seed} ledger=${ticket.start_ledger}`);

await new Promise((r) => setTimeout(r, 12_000));
const { hash, outcome } = await finishRun(keypair, LOG);
lap(`finish_run tx=${hash.slice(0, 10)} extracted=${outcome.extracted} floor=${outcome.floor_reached} score=${outcome.score} hp=${outcome.hp_left}`);

const record = await fetchRecord(address);
const top = await fetchTop();
const balances = await fetchRelicBalances(address);
const count = await fetchPlayerCount();
console.log({ record: record && { runs: record.total_runs, extractions: record.extractions, bestKey: String(record.best_key) }, topSize: top.length, balances, players: count });
