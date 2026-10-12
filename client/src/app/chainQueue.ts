/**
 * One chain transaction at a time. Two transactions from the same account
 * built before the first lands would reuse a sequence number and one of them
 * would fail, so starting a run waits for the previous run's verification.
 */
export class ChainQueue {
  private tail: Promise<unknown> = Promise.resolve();

  /** Runs `job` after every earlier job has settled, whether it succeeded or not. */
  enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = this.tail.then(job, job);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

export const chainQueue = new ChainQueue();

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for Stellar')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
