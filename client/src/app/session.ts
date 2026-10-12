import { loadDraft, takeChallengeFromUrl, type Draft } from '../game/draft';
import { loadProgress, type Progress } from '../game/progress';
import type { RunState } from '../game/state';
import type { BoardTab, ChainRead, LeaderboardRow } from '../render/chromeTypes';
import type { BossIntroHandle } from '../render/bossIntro';
import type { DescentOptions, DescentStage } from '../render/descent';
import type { VerifyState } from '../render/result';
import type { Hero, PlayerRecord } from '../stellar/contract';
import type { RelicBalances } from '../stellar/relics';

export type RestoreStep = 'closed' | 'enter' | 'confirm';

/** Everything the app layer shares between frames. One object so each module reads and writes the same state. */
export interface Session {
  run: RunState | null;
  progress: Progress;
  /** A finished run whose log could not be sent, kept so the player can retry. */
  failedRun: RunState | null;
  practice: boolean;
  starting: boolean;
  startStage: DescentStage;
  descent: DescentOptions | null;
  runId: number;
  runWasVeteran: boolean;
  /** What the HUD counter actually shows: bumps when a relic's travelling point lands, not when it is picked up. */
  displayedRelics: number;
  bossIntro: BossIntroHandle | null;
  lastHeartbeat: number;
  resultShownRunId: number;
  resultShownAt: number;

  draft: Draft;
  challengeSeed: number | null;
  pendingChallengeDraft: boolean;
  showCreator: boolean;

  showVault: boolean;
  vaultHeroes: Hero[] | null;
  vaultLoading: boolean;

  showLeaderboard: boolean;
  boardTab: BoardTab;
  leaderboardLoading: boolean;
  leaderboardRows: LeaderboardRow[] | null;
  leaderboardFailed: boolean;

  showStats: boolean;
  recoveryNote: string;
  /** Where the restore-from-a-code flow is. The pasted code itself is never kept here. */
  restoreStep: RestoreStep;
  restoreError: string;
  /** The shortened public address of the account a pending restore would switch to. */
  restoreTarget: string;

  chainRead: ChainRead;
  chainStatus: string;
  chainTx: string;
  chainRank: number | null;
  chainHeroId: number | null;
  chainClears: number | null;
  canRetry: boolean;
  verifyState: VerifyState;
  /** Set only when a run verifies this session, so the leaderboard's own-row glow never shows on a cold load. */
  justVerifiedUntil: number;
  onchainRecord: PlayerRecord | null;
  relicBalances: RelicBalances | null;
  playerAddress: string;
  resumeChecked: boolean;
  /** The run whose log was last sent, so a later "no open run" answer can be checked against the record. */
  finishAttemptRunId: number;
  /** The player's run count read just before the first send, or null if it could not be read. */
  finishBaselineRuns: number | null;
}

function createSession(): Session {
  let draft = loadDraft();
  let challengeSeed: number | null = null;
  let pendingChallengeDraft = false;
  const challenge = takeChallengeFromUrl();
  if (challenge) {
    draft = { ...draft, base: challenge.base, weapon: challenge.weapon, charm: challenge.charm };
    challengeSeed = challenge.seed;
    pendingChallengeDraft = true;
  }
  return {
    run: null,
    progress: loadProgress(),
    failedRun: null,
    practice: false,
    starting: false,
    startStage: 'account',
    descent: null,
    runId: 0,
    runWasVeteran: false,
    displayedRelics: 0,
    bossIntro: null,
    lastHeartbeat: 0,
    resultShownRunId: -1,
    resultShownAt: 0,
    draft,
    challengeSeed,
    pendingChallengeDraft,
    showCreator: false,
    showVault: false,
    vaultHeroes: null,
    vaultLoading: false,
    showLeaderboard: false,
    boardTab: 'fresh',
    leaderboardLoading: false,
    leaderboardRows: null,
    leaderboardFailed: false,
    showStats: false,
    recoveryNote: '',
    restoreStep: 'closed',
    restoreError: '',
    restoreTarget: '',
    chainRead: 'loading',
    chainStatus: '',
    chainTx: '',
    chainRank: null,
    chainHeroId: null,
    chainClears: null,
    canRetry: false,
    verifyState: 'pending',
    justVerifiedUntil: 0,
    onchainRecord: null,
    relicBalances: null,
    playerAddress: '',
    resumeChecked: false,
    finishAttemptRunId: -1,
    finishBaselineRuns: null,
  };
}

export const session: Session = createSession();
