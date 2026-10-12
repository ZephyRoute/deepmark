import { drainArrivedRelics } from './render/effects';
import { syncChrome } from './render/chrome';
import { drawWorld } from './render/canvas';
import { sfxHeartbeat, sfxRelicArrive, sfxSeal } from './render/audio';
import { warmChain } from './stellar/lazy';
import { BACKDROP_COLOR, CORE_BUMP_DELAY_MS, HEARTBEAT_MS, LOW_HEALTH_RATIO } from './constants';
import { installInput } from './app/actions';
import { ctx } from './app/canvas';
import { isDescendHovering, onDescendHover } from './app/descendHeartbeat';
import { onchainSnapshot, refreshOnchain } from './app/onchain';
import { beginRun, planFresh, planVeteran, resumeOpenRun } from './app/run';
import { session } from './app/session';

/** Composition root: wires input, the chain warm-up and the frame loop. The rules live in `app/`. */

// Load the Stellar chunk when idle, then read the player's record. The title never waits for either.
warmChain(() => void refreshOnchain().then(resumeOpenRun));
installInput();

function isLowHealth(): boolean {
  const run = session.run;
  if (!run || run.mode === 'result' || session.showLeaderboard || session.showStats) return false;
  return run.player.hp / run.player.maxHp <= LOW_HEALTH_RATIO;
}

function pulseHeartbeatWhenLow(): void {
  if (!isLowHealth()) return;
  const now = performance.now();
  if (now - session.lastHeartbeat <= HEARTBEAT_MS) return;
  session.lastHeartbeat = now;
  sfxHeartbeat();
}

function paintBoard(): void {
  const { run, showLeaderboard, showStats } = session;
  const covered = showLeaderboard || showStats;
  const sunkDefeat = run && run.mode === 'result' && run.resultKind !== 'extracted' && !covered;
  if (run && !covered && run.mode !== 'result') drawWorld(ctx, run);
  else if (!sunkDefeat) {
    ctx.fillStyle = BACKDROP_COLOR;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}

/** Lets each relic's travelling point land on the counter, then bumps the counter for a core relic. */
function landArrivedRelics(): void {
  for (const kind of drainArrivedRelics()) {
    session.displayedRelics += 1;
    sfxRelicArrive(kind);
    if (kind !== 'core') continue;
    window.setTimeout(() => {
      const node = document.getElementById('hud-relics');
      if (!node) return;
      node.classList.remove('bump');
      void node.offsetWidth;
      node.classList.add('bump');
    }, CORE_BUMP_DELAY_MS);
  }
}

function syncView(): void {
  const s = session;
  syncChrome({
    showCreator: s.showCreator,
    showVault: s.showVault,
    draft: s.draft,
    creatorHooks: {
      onBegin: (chosen) => {
        s.draft = chosen;
        s.showCreator = false;
        void beginRun(planFresh(chosen));
      },
      onBack: () => {
        s.showCreator = false;
      },
    },
    vaultHeroes: s.vaultHeroes,
    vaultLoading: s.vaultLoading,
    onVeteran: (id) => {
      const hero = s.vaultHeroes?.find((h) => h.id === id);
      if (!hero) return;
      s.showVault = false;
      void beginRun(planVeteran(hero));
    },
    boardTab: s.boardTab,
    chainHeroId: s.chainHeroId,
    chainClears: s.chainClears,
    runWasVeteran: s.runWasVeteran,
    canRetry: s.canRetry,
    verifyState: s.verifyState,
    runId: s.runId,
    showLeaderboard: s.showLeaderboard,
    showStats: s.showStats,
    leaderboardLoading: s.leaderboardLoading,
    leaderboardRows: s.leaderboardRows,
    leaderboardFailed: s.leaderboardFailed,
    recoveryNote: s.recoveryNote,
    restoreStep: s.restoreStep,
    restoreError: s.restoreError,
    restoreTarget: s.restoreTarget,
    displayRelics: s.displayedRelics,
    justVerified: performance.now() < s.justVerifiedUntil,
    playerAddress: s.playerAddress,
    run: s.run,
    progress: s.progress,
    onchain: onchainSnapshot(),
    relics: s.relicBalances,
    chainRead: s.chainRead,
    chainStatus: s.chainStatus,
    chainTx: s.chainTx,
    chainRank: s.chainRank,
    starting: s.starting,
    startStage: s.startStage,
    descent: s.descent,
    practice: s.practice,
    onDescendHover,
    onSeal: sfxSeal,
  });
}

function frame(): void {
  const { run } = session;
  if (run?.mode === 'result' && session.resultShownRunId !== session.runId) {
    session.resultShownRunId = session.runId;
    session.resultShownAt = performance.now();
  }
  pulseHeartbeatWhenLow();
  paintBoard();
  landArrivedRelics();
  syncView();
  if (session.run?.mode !== 'choice' && isDescendHovering()) onDescendHover(false);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
