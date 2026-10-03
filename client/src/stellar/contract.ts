import { contract, TransactionBuilder, type Keypair, type Transaction } from '@stellar/stellar-sdk';
import { STELLAR_CONFIG } from './config';

/** Hero ids as the contract knows them. */
export const HERO_CODE = { lantern: 0, cinder: 1 } as const;

export interface RunTicket {
  seed: number;
  hero: number;
  start_ledger: number;
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
}

export interface TopEntry {
  player: string;
  rank_key: bigint;
  floor: number;
  score: number;
  hp_left: number;
  actions: number;
}

export interface PlayerSummary {
  player: string;
  record: PlayerRecord;
}

type Call<T> = Promise<contract.AssembledTransaction<T>>;

// Methods that return `Result<_, Error>` in Rust come back wrapped in
// contract.Result (isErr, unwrap, unwrapErr), confirmed against the deployed
// contract.
interface DeepmarkContractApi {
  start_run: (args: { player: string; hero: number }, options?: contract.MethodOptions) => Call<contract.Result<RunTicket>>;
  finish_run: (
    args: { player: string; actions: Uint8Array },
    options?: contract.MethodOptions
  ) => Call<contract.Result<RunOutcome>>;
  get_record: (args: { player: string }, options?: contract.MethodOptions) => Call<PlayerRecord | undefined>;
  get_open_run: (args: { player: string }, options?: contract.MethodOptions) => Call<RunTicket | undefined>;
  top: (options?: contract.MethodOptions) => Call<TopEntry[]>;
  player_count: (options?: contract.MethodOptions) => Call<number>;
  players: (args: { start: number; limit: number }, options?: contract.MethodOptions) => Call<PlayerSummary[]>;
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

/** Contract error codes, matching `Error` in `contracts/deepmark-contract/src/lib.rs`. */
export const CONTRACT_ERROR = {
  InvalidHero: 1,
  RunNotStarted: 2,
  TooManyActions: 3,
  InvalidAction: 4,
  RunIncomplete: 5,
  TrailingActions: 6,
  TooFast: 7,
  StartCooldown: 8,
} as const;

export function isContractError(err: unknown, code: number): boolean {
  return err instanceof Error && err.message.includes(`Error(Contract, #${code})`);
}

/**
 * Opens a run on chain and returns the seed the contract issued. The run is
 * played with this seed, so the client cannot pick a favourable one.
 */
export async function startRun(keypair: Keypair, hero: number): Promise<RunTicket> {
  const client = await clientFor(keypair);
  const assembled = await client.start_run(
    { player: keypair.publicKey(), hero },
    { timeoutInSeconds: SEND_TIMEOUT_SECONDS }
  );
  const sent = await assembled.signAndSend();
  const result = sent.result;
  if (result.isErr()) throw new Error(`start_run rejected: ${result.unwrapErr().message}`);
  return result.unwrap();
}

export interface FinishedRun {
  hash: string;
  outcome: RunOutcome;
}

/**
 * Submits the action log. The contract replays it, derives the result, and
 * mints the banked relics. Called after the result screen is already showing.
 */
export async function finishRun(keypair: Keypair, actions: readonly number[]): Promise<FinishedRun> {
  const client = await clientFor(keypair);
  const assembled = await client.finish_run(
    { player: keypair.publicKey(), actions: Uint8Array.from(actions) },
    { timeoutInSeconds: SEND_TIMEOUT_SECONDS }
  );
  const sent = await assembled.signAndSend();
  const result = sent.result;
  if (result.isErr()) throw new Error(`finish_run rejected: ${result.unwrapErr().message}`);
  return { hash: sent.sendTransactionResponse?.hash ?? '', outcome: result.unwrap() };
}

/** Read-only simulations: no transaction, no fee, near-instant. */
export async function fetchRecord(address: string): Promise<PlayerRecord | null> {
  const client = await readClient();
  const assembled = await client.get_record({ player: address });
  return assembled.result ?? null;
}

export async function fetchTop(): Promise<TopEntry[]> {
  const client = await readClient();
  const assembled = await client.top();
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
