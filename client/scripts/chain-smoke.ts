/**
 * End to end check of the client's Stellar layer against the deployed testnet
 * contract, with the same modules the game uses. Creates a throwaway funded
 * account, clears all three floors with a new delver until the contract earns
 * it, then descends again as a veteran.
 *
 *   bun run scripts/chain-smoke.ts
 */
import { getPlayerKeypair } from '../src/stellar/account';
import {
  fetchHeroes,
  fetchRecord,
  fetchTopFresh,
  fetchTopVeteran,
  finishRun,
  freshChoice,
  startRun,
  veteranChoice,
  type HeroChoice,
} from '../src/stellar/contract';
import { fetchRelicBalances } from '../src/stellar/relics';
import { newRun } from '../src/game/state';
import { playBalanced } from './policy';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

const t0 = Date.now();
const lap = (label: string): void => console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s ${label}`);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const keypair = await getPlayerKeypair();
const address = keypair.publicKey();
lap(`account ready ${address.slice(0, 6)}...`);

/** Opens runs until the scripted player clears all three floors, then finishes that run. */
async function clearOnce(choice: HeroChoice): Promise<{ heroId: number | undefined; score: number }> {
  for (let attempt = 1; attempt <= 12; attempt++) {
    let ticket: Awaited<ReturnType<typeof startRun>> | undefined;
    for (let retry = 0; retry < 4; retry++) {
      try {
        ticket = await startRun(keypair, choice);
        break;
      } catch (err) {
        if (!(err instanceof Error) || !err.message.includes('#8')) throw err;
        await sleep(7000);
      }
    }
    if (!ticket) throw new Error('could not open a run');
    const state = newRun({ base: ticket.base, weapon: ticket.weapon, charm: ticket.charm, rank: ticket.rank }, ticket.seed, ticket.look);
    playBalanced(state);
    const cleared = state.resultKind === 'extracted' && state.floorNumber === 3;
    lap(
      `attempt ${attempt} seed ${ticket.seed} rank ${ticket.rank}: ${cleared ? 'cleared' : state.resultKind} (${state.actions.length} actions)`
    );
    await sleep(Math.ceil(state.actions.length / 16) * 5000 + 6000);
    const { outcome, hash } = await finishRun(keypair, state.actions);
    lap(
      `finish_run ${hash} extracted=${outcome.extracted} floor=${outcome.floor_reached} score=${outcome.score} hero=${outcome.hero_id ?? 'none'}`
    );
    if (cleared) return { heroId: outcome.hero_id, score: outcome.score };
  }
  throw new Error('no clear in 12 attempts');
}

const first = await clearOnce(freshChoice({ look: { name: 'Smoke Test', emblem: 2, cloak: 3 }, base: 1, weapon: 1, charm: 2 }));
if (first.heroId === undefined) throw new Error('the cleared run did not earn a delver');
const heroes = await fetchHeroes(address);
console.log(
  'vault after the first clear:',
  heroes.map((h) => ({ id: h.id, name: h.look.name, clears: h.clears }))
);

const second = await clearOnce(veteranChoice(first.heroId));
const after = await fetchHeroes(address);
console.log(
  'vault after the veteran clear:',
  after.map((h) => ({ id: h.id, clears: h.clears })),
  'second hero id',
  second.heroId
);

const record = await fetchRecord(address);
console.log({
  runs: record?.total_runs,
  extractions: record?.extractions,
  veteranRuns: record?.veteran_runs,
  fresh: (await fetchTopFresh()).length,
  veteran: (await fetchTopVeteran()).length,
  relics: await fetchRelicBalances(address),
});
