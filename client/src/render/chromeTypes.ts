import type { Draft } from '../game/draft';
import type { Progress } from '../game/progress';
import type { RunState } from '../game/state';
import type { Hero } from '../stellar/contract';
import type { RelicBalances } from '../stellar/relics';
import type { CreatorHooks } from './creator';
import type { DescentOptions, DescentStage } from './descent';
import type { VerifyState } from './result';

export interface LeaderboardRow {
  address: string;
  name: string;
  emblem: number;
  score: number;
  floor: number;
  hpLeft: number;
  actions: number;
}

export type ChainRead = 'loading' | 'ready' | 'unavailable';

export interface OnchainSnapshot {
  bestFloor: number;
  bestScore: number;
  runs: number;
  extractions: number;
  deaths: number;
  forfeits: number;
  relicsBanked: number;
}

export type BoardTab = 'fresh' | 'veteran';

export interface ChromeView {
  showCreator: boolean;
  showVault: boolean;
  draft: Draft;
  creatorHooks: CreatorHooks;
  vaultHeroes: Hero[] | null;
  vaultLoading: boolean;
  onVeteran: (id: number) => void;
  boardTab: BoardTab;
  chainHeroId: number | null;
  /** The veteran's clear count after a verified clear, when known. */
  chainClears: number | null;
  runWasVeteran: boolean;
  canRetry: boolean;
  verifyState: VerifyState;
  runId: number;
  showLeaderboard: boolean;
  showStats: boolean;
  leaderboardLoading: boolean;
  leaderboardRows: LeaderboardRow[] | null;
  leaderboardFailed: boolean;
  recoveryNote: string;
  restoreStep: 'closed' | 'enter' | 'confirm';
  restoreError: string;
  restoreTarget: string;
  displayRelics: number;
  justVerified: boolean;
  playerAddress: string;
  run: RunState | null;
  progress: Progress;
  onchain: OnchainSnapshot | null;
  relics: RelicBalances | null;
  chainRead: ChainRead;
  chainStatus: string;
  chainTx: string;
  chainRank: number | null;
  starting: boolean;
  startStage: DescentStage;
  descent: DescentOptions | null;
  practice: boolean;
  onDescendHover: (hovering: boolean) => void;
  /** Fired once, synchronously with the seal's strike animation, when a run is verified. */
  onSeal: () => void;
}

/** The slice of the view each card reads, so a card can be mounted on its own for previews and checks. */
export type VaultView = Pick<ChromeView, 'vaultLoading' | 'vaultHeroes' | 'onVeteran'>;
export type LeaderboardView = Pick<
  ChromeView,
  'boardTab' | 'leaderboardLoading' | 'leaderboardRows' | 'leaderboardFailed' | 'playerAddress' | 'justVerified'
>;
