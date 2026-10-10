/**
 * Sample screens for design review and the accessibility check. Local machine
 * only (see main.ts): they need no wallet, no network and no run in progress.
 *
 *   ?preview=vault        a vault with two earned delvers
 *   ?preview=leaderboard  a leaderboard with the player in second place
 */
import { leaderboardCard, vaultCard, type LeaderboardRow } from '../render/chrome';
import type { Hero } from '../stellar/contract';

const SAMPLE_PLAYER = 'GCDEEPMARKSAMPLEPLAYERADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAB';

const SAMPLE_HEROES: Hero[] = [
  {
    id: 1,
    owner: SAMPLE_PLAYER,
    look: { name: 'Brannoch', emblem: 1, cloak: 2 },
    base: 1,
    weapon: 0,
    charm: 1,
    clears: 2,
    minted_ledger: 1,
    proof_score: 6,
    proof_hp_left: 3,
    proof_actions: 112,
  },
  {
    id: 2,
    owner: SAMPLE_PLAYER,
    look: { name: 'Isolde', emblem: 3, cloak: 0 },
    base: 0,
    weapon: 1,
    charm: 0,
    clears: 1,
    minted_ledger: 2,
    proof_score: 4,
    proof_hp_left: 1,
    proof_actions: 140,
  },
];

const SAMPLE_ROWS: LeaderboardRow[] = [
  { address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', name: 'Corvin', emblem: 0, score: 7, floor: 3, hpLeft: 4, actions: 98 },
  { address: SAMPLE_PLAYER, name: 'Brannoch', emblem: 1, score: 6, floor: 3, hpLeft: 3, actions: 112 },
  { address: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', name: 'Isolde', emblem: 3, score: 4, floor: 2, hpLeft: 0, actions: 131 },
];

export type ScreenPreview = 'vault' | 'leaderboard';

export function isScreenPreview(value: string | null): value is ScreenPreview {
  return value === 'vault' || value === 'leaderboard';
}

/** Mounts a sample card into the real shell's overlay so landmarks and styles match the game. */
export function mountScreenPreview(kind: ScreenPreview): void {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;
  overlay.hidden = false;
  overlay.replaceChildren(
    kind === 'vault'
      ? vaultCard({ vaultLoading: false, vaultHeroes: SAMPLE_HEROES, onVeteran: () => undefined })
      : leaderboardCard({
          boardTab: 'fresh',
          leaderboardLoading: false,
          leaderboardRows: SAMPLE_ROWS,
          playerAddress: SAMPLE_PLAYER,
          justVerified: false,
        })
  );
}
