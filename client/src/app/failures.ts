import { CONTRACT_ERROR, isContractError } from '../stellar/choice';

/**
 * How a failed `finish_run` should be treated.
 * - wait: network trouble or TooFast, heals by itself, retried automatically.
 * - mint: the relics could not be delivered. The contract reverted and kept the run open, so it is safe to retry after the relic setup is redone.
 * - notReady: the contract is not set up yet. The run is kept, the player retries by hand.
 * - closed: the run is not open on chain (settled, expired or never started).
 * - permanent: the contract refused this log for good.
 */
export type FailureKind = 'wait' | 'mint' | 'notReady' | 'closed' | 'permanent';

/** Raised when a retry found no open run and the record could not prove the run was settled. */
export class SettlementUnconfirmed extends Error {
  constructor() {
    super('The run may already be recorded, but Stellar did not confirm it');
    this.name = 'SettlementUnconfirmed';
  }
}

function isContractRefusal(err: unknown): boolean {
  return err instanceof Error && err.message.includes('Error(Contract, #');
}

/** The one place that maps a contract refusal to how the client reacts. */
export function failureKind(err: unknown): FailureKind {
  if (!isContractRefusal(err)) return 'wait';
  if (isContractError(err, CONTRACT_ERROR.TooFast)) return 'wait';
  if (isContractError(err, CONTRACT_ERROR.MintFailed)) return 'mint';
  if (isContractError(err, CONTRACT_ERROR.NotInitialized)) return 'notReady';
  if (isContractError(err, CONTRACT_ERROR.RunNotStarted)) return 'closed';
  return 'permanent';
}

/** The contract's own refusals that waiting cannot fix and that leave no run to resume. */
export function isPermanentFailure(err: unknown): boolean {
  const kind = failureKind(err);
  return kind === 'permanent' || kind === 'closed';
}

/** Failures after which the open run and its action log must be kept so the player can try again. */
export function keepsRun(err: unknown): boolean {
  return !isPermanentFailure(err);
}

/** A player-facing sentence for why a run could not be settled. */
export function describeFailure(err: unknown): string {
  if (err instanceof SettlementUnconfirmed) {
    return 'This run may already be recorded on Stellar, but we could not confirm it yet. Check again in a moment.';
  }
  if (isContractError(err, CONTRACT_ERROR.MintFailed)) {
    return 'Your relics could not be delivered yet, usually because your relic setup is not finished. Your run is safe. Try again.';
  }
  if (isContractError(err, CONTRACT_ERROR.NotInitialized)) {
    return 'The game is not ready on Stellar yet. Your run is kept. Try again in a moment.';
  }
  if (isContractError(err, CONTRACT_ERROR.RunNotStarted)) {
    return 'This run is no longer open on Stellar. It was already settled or it expired.';
  }
  if (isContractError(err, CONTRACT_ERROR.NotHeroOwner)) return 'This delver changed hands during the run, so it cannot be settled.';
  if (
    isContractError(err, CONTRACT_ERROR.RunIncomplete) ||
    isContractError(err, CONTRACT_ERROR.TrailingActions) ||
    isContractError(err, CONTRACT_ERROR.InvalidAction)
  ) {
    return 'The contract could not reproduce this run, so it was not recorded.';
  }
  return 'Stellar could not be reached to settle this run.';
}
