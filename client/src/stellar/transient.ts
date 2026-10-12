/**
 * Tells a passing network blip from a real refusal. Kept free of the Stellar
 * SDK so both the game and the account setup can share it.
 */
import { TRANSIENT_BACKOFF_MS, TRANSIENT_JITTER_MS, TRANSIENT_RETRIES } from '../constants';

/** HTTP statuses that mean "try again in a moment". */
const TRANSIENT_STATUSES: readonly number[] = [429, 500, 502, 503, 504];

const STATUS_IN_TEXT = /\b(429|500|502|503|504)\b/;
const NETWORK_TEXT =
  /failed to fetch|network ?error|network request failed|load failed|econnreset|econnrefused|etimedout|socket hang up|timed out|timeout|try_again_later|fetch failed/i;

/** A contract refusal is a real answer from the chain, never a blip. */
function isContractRefusal(message: string): boolean {
  return message.includes('Error(Contract, #');
}

function statusOf(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const shaped = err as { status?: unknown; response?: { status?: unknown } };
  if (typeof shaped.status === 'number') return shaped.status;
  if (typeof shaped.response?.status === 'number') return shaped.response.status;
  return null;
}

/** True for a send that failed on the way (HTTP 429/5xx, reset, timeout) and may well work if repeated. */
export function isTransientError(err: unknown): boolean {
  const status = statusOf(err);
  if (status !== null) return TRANSIENT_STATUSES.includes(status);
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!message || isContractRefusal(message)) return false;
  return STATUS_IN_TEXT.test(message) || NETWORK_TEXT.test(message);
}

export interface RetryOptions {
  retries?: number;
  backoffMs?: number;
  jitterMs?: number;
  /** Stops retrying (and returns the last error) once this says so, for example when the player skipped the wait. */
  cancelled?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `job`, repeating it after a jittered, growing wait while it fails with a transient error. */
export async function retryTransient<T>(job: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? TRANSIENT_RETRIES;
  const backoff = options.backoffMs ?? TRANSIENT_BACKOFF_MS;
  const jitter = options.jitterMs ?? TRANSIENT_JITTER_MS;
  const wait = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await job();
    } catch (err) {
      if (attempt >= retries || !isTransientError(err) || options.cancelled?.()) throw err;
      await wait(backoff * (attempt + 1) + random() * jitter);
    }
  }
}
