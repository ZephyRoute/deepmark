import { MAX_FLOOR } from '../game/floor';
import { HEROES, HERO_ORDER } from '../game/heroes';
import type { RunState } from '../game/state';
import { LOW_HEALTH_RATIO } from '../constants';
import { STELLAR_CONFIG } from '../stellar/config';
import type { RelicBalances } from '../stellar/relics';
import type { ChromeView } from './chromeTypes';
import { isTouchFirst, setBumpText, setText } from './dom';
import { mountCreator } from './creator';
import { cloakFilter } from './emblems';
import { leaderboardCard } from './leaderboardCard';
import { combatCard, choiceCard } from './promptCards';
import { mountResult, updateVerification, type ResultSummary, type Verification } from './result';
import { mountDescent, setDescentStage } from './descent';
import { delverOutcome } from '../game/delverOutcome';
import { shouldNudgeRecord } from '../game/recordNudge';
import { statsCard } from './statsCard';
import { mountTitle, updateTitle, type TitleInfo } from './title';
import { vaultCard } from './vaultCard';

const TX_HASH = /^[a-f0-9]{64}$/;

function relicSummary(relics: RelicBalances | null): string {
  if (!relics) return '';
  const parts: string[] = [];
  if (relics.common > 0) parts.push(`${relics.common} common`);
  if (relics.rare > 0) parts.push(`${relics.rare} rare`);
  if (relics.core > 0) parts.push(`${relics.core} core`);
  return parts.join(', ');
}

function paintHp(hp: number, max: number): void {
  const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const fill = document.getElementById('hp-fill');
  const ghost = document.getElementById('hp-ghost');
  const bar = document.getElementById('hud-hp');
  const pct = `${(ratio * 100).toFixed(1)}%`;
  if (fill) fill.style.width = pct;
  if (ghost) ghost.style.width = pct;
  if (bar) {
    bar.classList.toggle('is-low', ratio <= LOW_HEALTH_RATIO);
    bar.setAttribute('aria-label', `Health ${hp} of ${max}${ratio <= LOW_HEALTH_RATIO ? ', low' : ''}`);
  }
  setText('hp-text', `${hp} / ${max}`);
}

let overlayKey = '';

/** Screens a player leaves with Back or Escape. Returning to the title from one of these restores focus. */
const PANEL_KEYS: readonly string[] = ['creator', 'vault', 'board', 'stats', 'result'];

/**
 * Puts focus on a panel's heading when it opens, so a keyboard or screen
 * reader player lands on the new screen and Tab reaches its first control.
 */
function focusPanelHeading(overlay: HTMLElement): void {
  const heading = overlay.querySelector<HTMLElement>('.panel-title');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

function renderOverlay(view: ChromeView): void {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const key = overlaySignature(view);
  if (key === overlayKey) {
    if (key === 'title') updateTitle(titleInfo(view));
    return;
  }
  const previousKey = overlayKey;
  overlayKey = key;
  overlay.replaceChildren();

  if (view.starting && view.descent) {
    overlay.hidden = false;
    mountDescent(overlay, view.descent);
    return;
  }

  if (view.showCreator) {
    overlay.hidden = false;
    mountCreator(overlay, view.draft, view.creatorHooks);
    return;
  }

  if (view.showVault) {
    overlay.hidden = false;
    overlay.append(vaultCard(view));
    focusPanelHeading(overlay);
    return;
  }

  if (view.showLeaderboard) {
    overlay.hidden = false;
    overlay.append(leaderboardCard(view));
    focusPanelHeading(overlay);
    return;
  }

  if (view.showStats) {
    overlay.hidden = false;
    overlay.append(statsCard(view));
    focusPanelHeading(overlay);
    return;
  }

  if (!view.run) {
    overlay.hidden = false;
    const info = titleInfo(view);
    if (overlay.querySelector('.title-v2')) updateTitle(info);
    else mountTitle(overlay, info);
    if (!isTouchFirst() && PANEL_KEYS.some((panel) => previousKey.startsWith(panel))) {
      overlay.querySelector<HTMLElement>('.menu-item.is-primary')?.focus({ preventScroll: true });
    }
    return;
  }

  if (view.run.mode === 'result') {
    overlay.hidden = false;
    mountResult(overlay, resultSummary(view), view.onSeal);
    return;
  }

  if (view.run.mode === 'combat' || view.run.mode === 'choice') {
    overlay.hidden = false;
    overlay.classList.add('overlay-prompt');
    overlay.append(view.run.mode === 'combat' ? combatCard(view.run) : choiceCard(view.run, view.onDescendHover));
    return;
  }

  overlay.hidden = true;
  overlay.classList.remove('overlay-prompt');
}

function overlaySignature(view: ChromeView): string {
  // The descent scene animates itself, so it keeps one signature while it plays.
  if (view.starting && view.descent) return 'descent';
  // The creator owns its DOM, so it must keep one constant signature while open.
  if (view.showCreator) return 'creator';
  if (view.showVault) {
    const ids = view.vaultHeroes?.map((h) => `${h.id}:${h.clears}`).join('|');
    return `vault:${view.vaultLoading}:${ids ?? ''}`;
  }
  if (view.showLeaderboard) {
    const rows = view.leaderboardRows?.map((row) => `${row.address}:${row.score}:${row.floor}:${row.hpLeft}:${row.actions}`).join('|');
    return `board:${view.boardTab}:${view.leaderboardLoading}:${view.leaderboardFailed}:${rows ?? ''}:${view.playerAddress}`;
  }
  if (view.showStats) {
    const progress = view.progress;
    const chain = view.onchain
      ? `${view.onchain.bestFloor}:${view.onchain.bestScore}:${view.onchain.runs}:${view.onchain.extractions}:${view.onchain.deaths}:${view.onchain.forfeits}:${view.onchain.relicsBanked}`
      : '';
    const vault = view.relics ? `${view.relics.common}:${view.relics.rare}:${view.relics.core}` : '';
    return `stats:${view.restoreStep}:${view.restoreError}:${view.restoreTarget}:${view.recoveryNote}:${view.chainRead}:${chain}:${vault}:${view.playerAddress}:${progress.runsPlayed}:${progress.extractions}:${progress.deaths}:${progress.bestFloor}:${progress.bestRelics}:${progress.bestScore}:${progress.relicsKept}:${progress.lanternRuns}:${progress.cinderRuns}`;
  }
  if (!view.run) return 'title';
  if (view.run.mode === 'result') {
    // The ceremony owns its DOM and is updated in place, so it keeps one signature per run.
    return `result:${view.runId}`;
  }
  if (view.run.mode === 'combat') {
    const enemy = view.run.activeEnemyIndex !== null ? view.run.enemies[view.run.activeEnemyIndex] : undefined;
    return `combat:${enemy?.kind ?? ''}:${enemy?.hp ?? ''}`;
  }
  if (view.run.mode === 'choice') {
    return `choice:${view.run.floorNumber}:${view.run.relicsThisRun}`;
  }
  return 'play';
}

function titleInfo(view: ChromeView): TitleInfo {
  const progress = view.progress;
  const local =
    progress.runsPlayed > 0
      ? `Best floor ${progress.bestFloor} / ${MAX_FLOOR}  ·  Best relics ${progress.bestRelics}  ·  Runs ${progress.runsPlayed}`
      : '';
  const chain =
    view.onchain && view.onchain.runs > 0
      ? `Verified on Stellar: best score ${view.onchain.bestScore}, floor ${view.onchain.bestFloor} / ${MAX_FLOOR}, ${view.onchain.runs} runs`
      : '';
  const held = relicSummary(view.relics);
  return { local, chain, vault: held ? `Relics in your vault: ${held}` : '' };
}

function resultSummary(view: ChromeView): ResultSummary {
  const run = view.run as RunState;
  const won = run.resultKind === 'extracted';
  const heroId = HERO_ORDER[run.loadout.base] ?? 'lantern';
  return {
    won,
    floorReached: run.floorNumber,
    maxFloor: MAX_FLOOR,
    relics: run.relicsThisRun,
    score: won ? run.scoreThisRun : 0,
    hpLeft: run.player.hp,
    newBest: run.newBest,
    bestLine: view.practice ? '' : `Best floor ${view.progress.bestFloor} / ${MAX_FLOOR}  ·  Best relics ${view.progress.bestRelics}`,
    delver: {
      name: run.look.name,
      art: HEROES[heroId].veteranArt,
      filter: cloakFilter(run.look.cloak, run.loadout.base),
      emblem: run.look.emblem,
    },
  };
}

function verificationOf(view: ChromeView): Verification {
  const url = TX_HASH.test(view.chainTx) ? `${STELLAR_CONFIG.explorerUrl}/tx/${view.chainTx}` : null;
  const outcome = delverOutcome(view.chainHeroId, view.runWasVeteran, view.chainClears);
  return {
    state: view.practice ? 'practice' : view.verifyState,
    message: view.practice
      ? view.chainStatus || 'Practice run. This one is not recorded on Stellar, so it cannot earn a delver.'
      : view.chainStatus,
    rank: view.chainRank,
    txUrl: url,
    heroEarned: outcome.kind === 'earned',
    delverGrew: outcome.kind === 'grew' ? { clears: outcome.clears } : null,
    canRetry: view.canRetry,
    recordNudge: shouldNudgeRecord({
      practice: view.practice,
      verified: view.verifyState === 'verified',
      won: view.run?.resultKind === 'extracted',
      verifiedRuns: view.onchain?.runs ?? null,
    }),
  };
}

export function syncChrome(view: ChromeView): void {
  if (view.starting) setDescentStage(view.startStage);
  const playing =
    Boolean(view.run) && !view.showLeaderboard && !view.showStats && !view.showCreator && !view.showVault && view.run?.mode !== 'result';
  const hud = document.getElementById('hud');
  if (hud) hud.hidden = !playing;

  const overlay = document.getElementById('overlay');
  if (overlay && view.run?.mode !== 'combat' && view.run?.mode !== 'choice') {
    overlay.classList.remove('overlay-prompt');
  }

  if (playing && view.run) {
    const floorName = ['', 'Reliquary', 'Drowned chapel', 'Obsidian crypt'][view.run.floorNumber] ?? '';
    // A practice run is already labelled in the run status, so the title bar stays short.
    setText('floor-label', `Floor ${view.run.floorNumber} / ${MAX_FLOOR}  ${floorName}`);
    setText('hud-name', view.run.look.name);
    paintHp(view.run.player.hp, view.run.player.maxHp);
    setBumpText('hud-relics', `Relics ${view.displayRelics}`);
    setBumpText('hud-score', `Score ${view.run.scoreThisRun}`);
    setText('hud-mode', view.practice ? 'Practice, not recorded' : '');
    const lastLine = view.run.log[view.run.log.length - 1] ?? '';
    setText('hud-log', lastLine);
  } else if (view.showCreator || view.showVault) {
    setText('floor-label', '');
  } else if (view.showStats) {
    setText('floor-label', 'Record');
  } else if (view.showLeaderboard) {
    setText('floor-label', 'Records');
  } else if (!view.run) {
    setText('floor-label', '');
  } else {
    setText('floor-label', view.run.resultKind === 'extracted' ? 'Out' : 'Ended');
  }

  if (view.run?.mode === 'result' && !view.showStats && !view.showLeaderboard && !view.showVault) {
    updateVerification(verificationOf(view));
  }
  renderOverlay(view);
}
