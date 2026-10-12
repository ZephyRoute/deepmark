export interface NudgeFacts {
  practice: boolean;
  verified: boolean;
  won: boolean;
  /** The account's verified run count on chain, or null while it is unknown. */
  verifiedRuns: number | null;
}

/** The calm "keep your record" line: only after a fresh account's first run is verified, and only if it was a win. */
export function shouldNudgeRecord(facts: NudgeFacts): boolean {
  return !facts.practice && facts.verified && facts.won && facts.verifiedRuns === 1;
}
