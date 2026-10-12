/**
 * Reads the outcome of a submitted transaction without trusting its shape.
 * Kept free of the Stellar SDK so the game can classify failures without
 * loading the heavy chunk.
 */

/** The part of a settled transaction response this module relies on. */
export interface SettledResponse {
  status?: string;
  returnValue?: unknown;
}

/** The part of the SDK's `SentTransaction` this module relies on. */
export interface SentLike<T> {
  getTransactionResponse?: SettledResponse | null;
  readonly result: T;
}

const STATUS_SUCCESS = 'SUCCESS';
const STATUS_FAILED = 'FAILED';

/**
 * A transaction that was submitted but did not produce a usable result.
 * `retryable` is true only when the transaction is known to have failed on
 * chain, which leaves no effect behind, so submitting a fresh one is safe.
 */
export class TxOutcomeError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'TxOutcomeError';
    this.retryable = retryable;
  }
}

/**
 * Returns the parsed result of a sent transaction, or throws a `TxOutcomeError`.
 * The SDK parses `returnValue` blindly, so a failed transaction (for example a
 * footprint clash when several players start in the same ledger) would
 * otherwise surface as "Cannot read properties of undefined".
 */
export function readSentResult<T>(sent: SentLike<T>): T {
  const response = sent.getTransactionResponse;
  if (response) {
    if (response.status === STATUS_FAILED) {
      throw new TxOutcomeError('The transaction failed on the network and had no effect', true);
    }
    if (response.status !== STATUS_SUCCESS || response.returnValue === undefined || response.returnValue === null) {
      throw new TxOutcomeError('The network did not return a result for the transaction', false);
    }
  }
  return sent.result;
}

/** True when the error is a failed transaction that is safe to submit again. */
export function isRetryableTxFailure(err: unknown): boolean {
  return err instanceof TxOutcomeError && err.retryable;
}
