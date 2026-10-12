/**
 * What a verified full clear means for the delver, in words the result screen
 * can trust. The contract reports a `hero_id` for both kinds of clear: a fresh
 * delver is minted, while a veteran only gains a clear on the delver it
 * already owns.
 */
export type DelverOutcome = { kind: 'none' } | { kind: 'earned' } | { kind: 'grew'; clears: number | null };

export function delverOutcome(heroId: number | null, veteranRun: boolean, clears: number | null): DelverOutcome {
  if (heroId === null) return { kind: 'none' };
  if (!veteranRun) return { kind: 'earned' };
  return { kind: 'grew', clears };
}

export const DELVER_EARNED_KICKER = 'A new delver is yours';

/** The kicker for a veteran whose record grew, with the new clear count when it is known. */
export function delverGrewKicker(clears: number | null): string {
  if (clears === null) return "Your delver's record grew";
  return `Your delver's record grew: ${clears} ${clears === 1 ? 'clear' : 'clears'}`;
}
