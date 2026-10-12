/**
 * Enter presses left over from combat must not dismiss the result screen the
 * moment it appears, so confirm is ignored for this long after it shows.
 */
export const RESULT_INPUT_GUARD_MS = 700;

/** True while input aimed at a freshly shown result screen should still be ignored. */
export function resultGuardActive(shownAt: number, now: number): boolean {
  return now - shownAt < RESULT_INPUT_GUARD_MS;
}
