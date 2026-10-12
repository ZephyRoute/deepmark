import { ActionCode, applyAction, drainEvents, type RunState } from '../game/state';
import { saveRun } from '../game/savedRun';
import { resultGuardActive } from '../input/guard';
import { onAction, type Action } from '../input/keyboard';
import { face } from '../render/canvas';
import { isMuted, sfxStep, sfxUi, toggleMuted } from '../render/audio';
import { noteHintInput, resetHints } from '../render/hints';
import {
  copyRecoveryCode,
  loadBoard,
  openLeaderboard,
  openVault,
  checkRestoreCode,
  confirmRestore,
  cancelRestore,
  startRestore,
  verifyOnChain,
} from './onchain';
import { endExhaustedRun, leaveResult, openCreator } from './run';
import { copyChallengeLink, shareResult } from './share';
import { handleEvent } from './events';
import { session } from './session';

const DIRS: Partial<Record<Action, [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const MOVE_CODES = {
  up: ActionCode.Up,
  down: ActionCode.Down,
  left: ActionCode.Left,
  right: ActionCode.Right,
} as const;

export function syncMuteButton(): void {
  const button = document.getElementById('mute');
  if (!button) return;
  const muted = isMuted();
  button.textContent = muted ? 'Sound off' : 'Sound on';
  button.setAttribute('aria-pressed', muted ? 'true' : 'false');
}

function handleStatsAction(action: Action): void {
  if (action === 'cancel' && session.restoreStep !== 'closed') {
    // Escape backs out of the restore step first, the card stays open.
    cancelRestore();
    return;
  }
  if (action === 'stats' || action === 'cancel') {
    session.showStats = false;
    session.recoveryNote = '';
    cancelRestore();
  }
  if (action === 'copyRecovery') void copyRecoveryCode();
  if (action === 'restoreRecovery') startRestore();
  if (action === 'restoreCheck') void checkRestoreCode();
  if (action === 'restoreConfirm') void confirmRestore();
  if (action === 'restoreCancel') cancelRestore();
  if (action === 'replayHints') resetHints();
}

function handleLeaderboardAction(action: Action): void {
  if (action === 'leaderboard' || action === 'cancel') session.showLeaderboard = false;
  if (action === 'retryBoard') void loadBoard();
  if (action === 'tabFresh' || action === 'tabVeteran') {
    session.boardTab = action === 'tabVeteran' ? 'veteran' : 'fresh';
    void loadBoard();
  }
}

function handleVaultAction(action: Action): void {
  if (action === 'vault' || action === 'cancel') session.showVault = false;
  if (action === 'retryVault') void openVault();
}

function handleTitleAction(action: Action): void {
  if (action === 'confirm') openCreator();
  if (action === 'vault') void openVault();
  if (action === 'stats') session.showStats = true;
  if (action === 'leaderboard') void openLeaderboard();
}

function handleResultAction(action: Action, resultRun: RunState): void {
  if (action === 'confirm' && !resultGuardActive(session.resultShownAt, performance.now())) leaveResult();
  if (action === 'again') {
    leaveResult();
    openCreator();
  }
  if (action === 'retryVerify' && session.failedRun) void verifyOnChain(session.failedRun);
  if (action === 'shareSave' || action === 'shareCopy') void shareResult(resultRun, action === 'shareCopy' ? 'copy' : 'save');
  if (action === 'shareChallenge') void copyChallengeLink(resultRun);
  if (action === 'stats') session.showStats = true;
  if (action === 'vault') {
    leaveResult();
    void openVault();
  }
}

/** Applies one input to a live run, then settles the consequences (save, exhaustion, events). */
function handlePlayAction(run: RunState, action: Action): void {
  const actionsBefore = run.actions.length;
  if (run.mode === 'combat') {
    if (action === 'confirm') applyAction(run, ActionCode.Attack);
    if (action === 'cancel') applyAction(run, ActionCode.Retreat);
    noteHintInput(action);
  } else if (run.mode === 'choice') {
    if (action === 'confirm') applyAction(run, ActionCode.Descend);
    if (action === 'cancel') applyAction(run, ActionCode.Extract);
    noteHintInput(action);
  } else {
    const dir = DIRS[action];
    if (dir) {
      if (dir[0] !== 0) face(dir[0] < 0 ? -1 : 1);
      const moved = applyAction(run, MOVE_CODES[action as keyof typeof MOVE_CODES]);
      if (moved && run.mode === 'explore') sfxStep();
      noteHintInput(action);
    }
  }

  if (run.exhausted) endExhaustedRun(run);
  if (!session.practice && run.actions.length !== actionsBefore) saveRun(run);
  for (const event of drainEvents(run)) handleEvent(event);
}

/** Routes an input to the screen that owns it, topmost screen first. */
function dispatch(action: Action): void {
  if (action === 'mute') {
    toggleMuted();
    syncMuteButton();
    return;
  }
  if (!session.run) sfxUi();
  if (session.showStats) {
    handleStatsAction(action);
  } else if (session.showLeaderboard) {
    handleLeaderboardAction(action);
  } else if (session.starting) {
    // The descent scene owns the screen until the run opens.
  } else if (session.bossIntro) {
    session.bossIntro.skip();
  } else if (session.showCreator) {
    if (action === 'cancel') session.showCreator = false;
  } else if (session.showVault) {
    handleVaultAction(action);
  } else if (!session.run) {
    handleTitleAction(action);
  } else if (session.run.mode === 'result') {
    handleResultAction(action, session.run);
  } else {
    handlePlayAction(session.run, action);
  }
}

export function installInput(): void {
  syncMuteButton();
  onAction(dispatch);
}
