/** Resolves to this when the player chose to skip the wait. */
export const SKIPPED: unique symbol = Symbol('skipped');

/**
 * One descent's "play a practice run now" switch. The chain job keeps running
 * in the queue, but once the gate is closed its late results are ignored and
 * it stops retrying, so they can never reach the practice run.
 */
export class SkipGate {
  private requested = false;
  private finished = false;
  private resolveSkip: (value: typeof SKIPPED) => void = () => undefined;
  readonly promise: Promise<typeof SKIPPED>;

  constructor() {
    this.promise = new Promise((resolve) => {
      this.resolveSkip = resolve;
    });
  }

  /** The player asked for a practice run now. */
  skip(): void {
    if (this.finished) return;
    this.requested = true;
    this.resolveSkip(SKIPPED);
  }

  /** The descent no longer depends on the chain job (opened, timed out or skipped). */
  close(): void {
    this.finished = true;
  }

  get skipped(): boolean {
    return this.requested;
  }

  /** True once the chain job's answer will be ignored, so it should stop touching shared state. */
  get closed(): boolean {
    return this.finished || this.requested;
  }
}

/** The job's result, or SKIPPED if the player skipped first. A later failure of the job is swallowed. */
export function raceSkip<T>(job: Promise<T>, gate: SkipGate): Promise<T | typeof SKIPPED> {
  return Promise.race([job, gate.promise]);
}
