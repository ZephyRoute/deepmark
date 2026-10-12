import { contract, TransactionBuilder, type Keypair, type Transaction } from '@stellar/stellar-sdk';
import type { HeroChoice } from './choice';
import { readSentResult } from './txOutcome';
import { STELLAR_CONFIG } from './config';

export interface Look {
  name: string;
  emblem: number;
  cloak: number;
}

export interface FreshHero {
  look: Look;
  base: number;
  weapon: number;
  charm: number;
}

export type { HeroChoice } from './choice';

export interface RunTicket {
  seed: number;
  start_ledger: number;
  base: number;
  weapon: number;
  charm: number;
  rank: number;
  look: Look;
  veteran?: number;
}

export interface RunOutcome {
  extracted: boolean;
  floor_reached: number;
  relics_common: number;
  relics_rare: number;
  relics_core: number;
  score: number;
  hp_left: number;
  actions: number;
  rank_key: bigint;
  hero_id?: number;
}

export interface PlayerRecord {
  best_key: bigint;
  best_floor: number;
  best_score: number;
  best_hp_left: number;
  best_actions: number;
  total_runs: number;
  extractions: number;
  deaths: number;
  forfeits: number;
  relics_banked: number;
  last_start_ledger: number;
  vet_best_key: bigint;
  vet_best_floor: number;
  vet_best_score: number;
  veteran_runs: number;
}

export interface TopEntry {
  player: string;
  rank_key: bigint;
  floor: number;
  score: number;
  hp_left: number;
  actions: number;
  name: string;
  emblem: number;
}

export interface PlayerSummary {
  player: string;
  record: PlayerRecord;
}

/** A delver the player owns, earned by clearing all three floors. */
export interface Hero {
  id: number;
  owner: string;
  look: Look;
  base: number;
  weapon: number;
  charm: number;
  clears: number;
  minted_ledger: number;
  proof_score: number;
  proof_hp_left: number;
  proof_actions: number;
}

type Call<T> = Promise<contract.AssembledTransaction<T>>;

// Methods that return `Result<_, Error>` in Rust come back wrapped in
// contract.Result (isErr, unwrap, unwrapErr), confirmed against the deployed
// contract.
interface DeepmarkContractApi {
  start_run: (args: { player: string; choice: HeroChoice }, options?: contract.MethodOptions) => Call<contract.Result<RunTicket>>;
  finish_run: (args: { player: string; actions: Uint8Array }, options?: contract.MethodOptions) => Call<contract.Result<RunOutcome>>;
  get_record: (args: { player: string }, options?: contract.MethodOptions) => Call<PlayerRecord | undefined>;
  get_open_run: (args: { player: string }, options?: contract.MethodOptions) => Call<RunTicket | undefined>;
  top_fresh: (options?: contract.MethodOptions) => Call<TopEntry[]>;
  top_veteran: (options?: contract.MethodOptions) => Call<TopEntry[]>;
  player_count: (options?: contract.MethodOptions) => Call<number>;
  players: (args: { start: number; limit: number }, options?: contract.MethodOptions) => Call<PlayerSummary[]>;
  hero: (args: { id: number }, options?: contract.MethodOptions) => Call<Hero | undefined>;
  heroes_of: (args: { owner: string }, options?: contract.MethodOptions) => Call<number[]>;
}

type DeepmarkClient = contract.Client & DeepmarkContractApi;

/** Upper bound for a submitted transaction to settle, in seconds. */
const SEND_TIMEOUT_SECONDS = 45;

function makeSigner(keypair: Keypair): NonNullable<contract.ClientOptions['signTransaction']> {
  return async (xdr, opts) => {
    const passphrase = opts?.networkPassphrase ?? STELLAR_CONFIG.networkPassphrase;
    const tx = TransactionBuilder.fromXDR(xdr, passphrase) as Transaction;
    tx.sign(keypair);
    return { signedTxXdr: tx.toXDR() };
  };
}

const clients = new Map<string, Promise<DeepmarkClient>>();

function clientFor(keypair?: Keypair): Promise<DeepmarkClient> {
  const key = keypair ? keypair.publicKey() : '';
  let existing = clients.get(key);
  if (!existing) {
    existing = contract.Client.from<DeepmarkContractApi>({
      contractId: STELLAR_CONFIG.contractId,
      rpcUrl: STELLAR_CONFIG.rpcUrl,
      networkPassphrase: STELLAR_CONFIG.networkPassphrase,
      ...(keypair ? { publicKey: key, signTransaction: makeSigner(keypair) } : {}),
    });
    clients.set(key, existing);
  }
  return existing;
}

/** A read-only client. It does not sign and does not create an account. */
export function readClient(): Promise<DeepmarkClient> {
  return clientFor();
}

export { CONTRACT_ERROR, freshChoice, isContractError, veteranChoice } from './choice';

/**
 * Opens a run on chain and returns the seed the contract issued. The run is
 * played with this seed, so the client cannot pick a favourable one.
 */
export async function startRun(keypair: Keypair, choice: HeroChoice): Promise<RunTicket> {
  const client = await clientFor(keypair);
  const assembled = await client.start_run({ player: keypair.publicKey(), choice }, { timeoutInSeconds: SEND_TIMEOUT_SECONDS });
  const sent = await assembled.signAndSend();
  const result = readSentResult(sent);
  if (result.isErr()) throw new Error(`start_run rejected: ${result.unwrapErr().message}`);
  return result.unwrap();
}

export interface FinishedRun {
  hash: string;
  outcome: RunOutcome;
}

/**
 * Submits the action log. The contract replays it, derives the result, mints
 * the banked relics and, after a full clear, earns the delver. Called after
 * the result screen is already showing.
 */
export async function finishRun(keypair: Keypair, actions: readonly number[]): Promise<FinishedRun> {
  const client = await clientFor(keypair);
  const assembled = await client.finish_run(
    { player: keypair.publicKey(), actions: Uint8Array.from(actions) },
    { timeoutInSeconds: SEND_TIMEOUT_SECONDS }
  );
  const sent = await assembled.signAndSend();
  const result = readSentResult(sent);
  if (result.isErr()) throw new Error(`finish_run rejected: ${result.unwrapErr().message}`);
  return { hash: sent.sendTransactionResponse?.hash ?? '', outcome: result.unwrap() };
}

/** Read-only simulations: no transaction, no fee, near-instant. */
export async function fetchRecord(address: string): Promise<PlayerRecord | null> {
  const client = await readClient();
  const assembled = await client.get_record({ player: address });
  return assembled.result ?? null;
}

/** The run the contract still holds open for a player, if any. */
export async function fetchOpenRun(address: string): Promise<RunTicket | null> {
  const client = await readClient();
  const assembled = await client.get_open_run({ player: address });
  return assembled.result ?? null;
}

export async function fetchTopFresh(): Promise<TopEntry[]> {
  const client = await readClient();
  const assembled = await client.top_fresh();
  return assembled.result ?? [];
}

export async function fetchTopVeteran(): Promise<TopEntry[]> {
  const client = await readClient();
  const assembled = await client.top_veteran();
  return assembled.result ?? [];
}

export async function fetchPlayerCount(): Promise<number> {
  const client = await readClient();
  const assembled = await client.player_count();
  return assembled.result ?? 0;
}

export async function fetchPlayers(start: number, limit: number): Promise<PlayerSummary[]> {
  const client = await readClient();
  const assembled = await client.players({ start, limit });
  return assembled.result ?? [];
}

export async function fetchHero(id: number): Promise<Hero | null> {
  const client = await readClient();
  return (await client.hero({ id })).result ?? null;
}

/** Every delver an address owns. At most 64, so one call per delver is bounded. */
export async function fetchHeroes(owner: string): Promise<Hero[]> {
  const client = await readClient();
  const ids = (await client.heroes_of({ owner })).result ?? [];
  const heroes = await Promise.all(ids.map(async (id) => (await client.hero({ id })).result));
  return heroes.filter((hero): hero is Hero => hero !== undefined && hero !== null);
}
