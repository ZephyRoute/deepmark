import { contract, TransactionBuilder, type Keypair, type Transaction } from '@stellar/stellar-sdk';
import { STELLAR_CONFIG } from './config';

export interface PlayerRecord {
  best_floor: number;
  best_relics: number;
  total_runs: number;
}

interface DeepmarkContractApi {
  // record_run is declared `Result<PlayerRecord, Error>` in Rust, so the SDK
  // wraps it in contract.Result (Ok/Err with unwrap/isErr) instead of handing
  // back a plain value; confirmed against the live testnet contract.
  record_run: (
    args: { player: string; floor_reached: number; relics_kept: number },
    options?: contract.MethodOptions
  ) => Promise<contract.AssembledTransaction<contract.Result<PlayerRecord>>>;
  get_record: (
    args: { player: string },
    options?: contract.MethodOptions
  ) => Promise<contract.AssembledTransaction<PlayerRecord | undefined>>;
  leaderboard: (
    options?: contract.MethodOptions
  ) => Promise<contract.AssembledTransaction<string[]>>;
}

function makeSigner(keypair: Keypair): NonNullable<contract.ClientOptions['signTransaction']> {
  return async (xdr, opts) => {
    const passphrase = opts?.networkPassphrase ?? STELLAR_CONFIG.networkPassphrase;
    const tx = TransactionBuilder.fromXDR(xdr, passphrase) as Transaction;
    tx.sign(keypair);
    return { signedTxXdr: tx.toXDR() };
  };
}

const clients = new Map<string, Promise<contract.Client & DeepmarkContractApi>>();

/** A read-only client. It does not sign and does not create an account. */
export function readClient(): Promise<contract.Client & DeepmarkContractApi> {
  let existing = clients.get('');
  if (!existing) {
    existing = contract.Client.from<DeepmarkContractApi>({
      contractId: STELLAR_CONFIG.contractId,
      rpcUrl: STELLAR_CONFIG.rpcUrl,
      networkPassphrase: STELLAR_CONFIG.networkPassphrase,
    });
    clients.set('', existing);
  }
  return existing;
}

function getClient(keypair: Keypair) {
  const publicKey = keypair.publicKey();
  let existing = clients.get(publicKey);
  if (!existing) {
    existing = contract.Client.from<DeepmarkContractApi>({
      contractId: STELLAR_CONFIG.contractId,
      rpcUrl: STELLAR_CONFIG.rpcUrl,
      networkPassphrase: STELLAR_CONFIG.networkPassphrase,
      publicKey,
      signTransaction: makeSigner(keypair),
    });
    clients.set(publicKey, existing);
  }
  return existing;
}

export interface RecordRunResult {
  hash: string;
  record: PlayerRecord;
}

/**
 * The one on-chain transaction per run. Called after a run has already
 * ended client-side, never during play, so it cannot add latency to combat
 * or movement.
 */
export async function submitRunResult(
  keypair: Keypair,
  floorReached: number,
  relicsKept: number
): Promise<RecordRunResult> {
  const client = await getClient(keypair);
  const assembled = await client.record_run({
    player: keypair.publicKey(),
    floor_reached: floorReached,
    relics_kept: relicsKept,
  });
  const sent = await assembled.signAndSend();
  if (sent.result.isErr()) {
    throw new Error(`record_run rejected: ${sent.result.unwrapErr().message}`);
  }
  return {
    hash: sent.sendTransactionResponse?.hash ?? '',
    record: sent.result.unwrap(),
  };
}

/** A read-only simulation, no transaction submitted, no fee, near-instant. */
export async function fetchOnchainRecord(keypair: Keypair): Promise<PlayerRecord | null> {
  const client = await getClient(keypair);
  const assembled = await client.get_record({ player: keypair.publicKey() });
  return assembled.result ?? null;
}

export interface LeaderboardEntry {
  address: string;
  record: PlayerRecord;
}

const LEADERBOARD_FETCH_CAP = 100;

/**
 * Reads the on-chain address list, then each address's record, all as free
 * simulations. Sorted client-side (best floor, then best relics) so the
 * contract itself never needs to sort or paginate.
 */
export async function fetchLeaderboard(keypair: Keypair, limit = 10): Promise<LeaderboardEntry[]> {
  const client = await getClient(keypair);
  const boardTx = await client.leaderboard();
  const addresses = (boardTx.result ?? []).slice(0, LEADERBOARD_FETCH_CAP);

  const entries = await Promise.all(
    addresses.map(async (address): Promise<LeaderboardEntry | null> => {
      const recordTx = await client.get_record({ player: address });
      return recordTx.result ? { address, record: recordTx.result } : null;
    })
  );

  return entries
    .filter((entry): entry is LeaderboardEntry => entry !== null)
    .sort(
      (a, b) =>
        b.record.best_floor - a.record.best_floor || b.record.best_relics - a.record.best_relics
    )
    .slice(0, limit);
}
