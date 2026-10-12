/**
 * Small, dependency free helpers for talking to the contract. Kept apart from
 * `contract.ts` so the game can build choices and read error codes without
 * loading the Stellar SDK, which is the heaviest part of the bundle.
 */
import type { FreshHero } from './contract';

/** The delver a run is started with: one built just now, or a veteran the player owns. */
export type HeroChoice = { tag: 'Fresh'; values: readonly [FreshHero] } | { tag: 'Veteran'; values: readonly [number] };

export function freshChoice(hero: FreshHero): HeroChoice {
  return { tag: 'Fresh', values: [hero] };
}

export function veteranChoice(id: number): HeroChoice {
  return { tag: 'Veteran', values: [id] };
}

/** Contract error codes, matching `Error` in `contracts/deepmark-contract/src/lib.rs`. */
export const CONTRACT_ERROR = {
  InvalidHero: 1,
  RunNotStarted: 2,
  TooManyActions: 3,
  InvalidAction: 4,
  RunIncomplete: 5,
  TrailingActions: 6,
  TooFast: 7,
  StartCooldown: 8,
  InvalidName: 9,
  HeroNotFound: 10,
  NotHeroOwner: 11,
  Frozen: 12,
  NotInitialized: 13,
  MintFailed: 14,
} as const;

export function isContractError(err: unknown, code: number): boolean {
  return err instanceof Error && err.message.includes(`Error(Contract, #${code})`);
}
