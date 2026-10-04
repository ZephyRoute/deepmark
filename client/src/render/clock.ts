/**
 * The game's visual clock. It follows real time except during a hit stop, when
 * it stands still for a few tens of milliseconds so an impact lands: actors,
 * particles and popups all hold their pose together. Everything that animates
 * the board reads `now()` instead of `performance.now()`.
 */
let virtual = 0;
let lastReal = typeof performance !== 'undefined' ? performance.now() : 0;
let freezeUntil = 0;
let punchAmount = 0;

/** Advances the clock. Call once at the start of each drawn frame. */
export function tick(): void {
  const real = performance.now();
  const dt = Math.min(100, real - lastReal);
  lastReal = real;
  if (real >= freezeUntil) {
    virtual += dt;
    // The camera settles back faster than it was struck.
    punchAmount *= Math.exp(-dt / 90);
    if (punchAmount < 0.001) punchAmount = 0;
  }
}

export function now(): number {
  return virtual;
}

/** Holds the visual clock for `ms`. A longer freeze already running wins. */
export function hitStop(ms: number): void {
  freezeUntil = Math.max(freezeUntil, performance.now() + ms);
}

/** A short push on the camera, 0 to 1. Drawn as a small scale that eases back. */
export function punch(strength: number): void {
  punchAmount = Math.min(1, Math.max(punchAmount, strength));
}

export function punchScale(): number {
  return 1 + punchAmount * 0.018;
}

export function isFrozen(): boolean {
  return performance.now() < freezeUntil;
}
