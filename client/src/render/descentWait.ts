import { SKIP_OFFER_AFTER_MS, SLOW_NOTE_AFTER_MS } from '../constants';
import type { DescentStage } from './descent';

export interface WaitState {
  /** Say, calmly, that Stellar is taking a little longer. */
  slow: boolean;
  /** Offer the "Play a practice run now" button. */
  canSkip: boolean;
}

/** What the descent scene shows after waiting `elapsedMs` in `stage`. Only the real waiting stages ever show either. */
export function waitState(elapsedMs: number, stage: DescentStage): WaitState {
  const waiting = stage === 'account' || stage === 'opening';
  return {
    slow: waiting && elapsedMs >= SLOW_NOTE_AFTER_MS,
    canSkip: waiting && elapsedMs >= SKIP_OFFER_AFTER_MS,
  };
}
