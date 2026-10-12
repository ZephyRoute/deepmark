import { loadDraft, loadoutOf, type Draft } from '../game/draft';
import { HEROES, HERO_ORDER } from '../game/heroes';
import { CHARMS, WEAPONS } from '../game/items';
import { rankForClears, type Loadout, type Look } from '../game/loadout';
import { recordRun } from '../game/progress';
import { clearSavedRun, loadSavedRun, planResume, saveRun, type ResumePlan } from '../game/savedRun';
import { newRun, type RunState } from '../game/state';
import { showBanner } from '../render/banner';
import { cloakFilter } from '../render/emblems';
import { resetRelicTravel } from '../render/effects';
import { showHint } from '../render/hints';
import { resetMotion } from '../render/motion';
import { startAmbience, sfxDescend } from '../render/audio';
import { preloadShareAssets } from '../render/shareCard';
import { CONTRACT_ERROR, freshChoice, isContractError, veteranChoice } from '../stellar/choice';
import type { Hero, HeroChoice, RunTicket } from '../stellar/contract';
import { chain } from '../stellar/lazy';
import { isRetryableTxFailure } from '../stellar/txOutcome';
import { retryTransient } from '../stellar/transient';
import {
  MIN_SCENE_MS,
  OFFLINE_EXTRA_HOLD_MS,
  READY_HOLD_MS,
  START_CONTENTION_BACKOFF_MS,
  START_CONTENTION_JITTER_MS,
  START_CONTENTION_RETRIES,
  START_RETRIES,
  START_RETRY_MS,
  START_TIMEOUT_MS,
} from '../constants';
import { canvas } from './canvas';
import { raceSkip, SKIPPED, SkipGate } from './skipGate';
import { chainQueue, sleep, withTimeout } from './chainQueue';
import { FLOOR_NAMES } from './floorNames';
import { session } from './session';
import { verifyOnChain } from './onchain';

export interface DelverPlan {
  choice: HeroChoice;
  loadout: Loadout;
  look: Look;
  veteran: boolean;
}

export function planFresh(chosen: Draft): DelverPlan {
  return {
    choice: freshChoice({ look: chosen.look, base: chosen.base, weapon: chosen.weapon, charm: chosen.charm }),
    loadout: loadoutOf(chosen),
    look: chosen.look,
    veteran: false,
  };
}

export function planVeteran(hero: Hero): DelverPlan {
  return {
    choice: veteranChoice(hero.id),
    loadout: { base: hero.base, weapon: hero.weapon, charm: hero.charm, rank: rankForClears(hero.clears) },
    look: hero.look,
    veteran: true,
  };
}

function resetChainReadout(): void {
  session.chainStatus = '';
  session.chainTx = '';
  session.chainRank = null;
  session.chainHeroId = null;
  session.chainClears = null;
}

/** Calls start_run, riding out the contract's cooldown between delves. */
async function openRunOnChain(choice: HeroChoice, gate: SkipGate): Promise<RunTicket> {
  const api = await chain();
  const keypair = await api.getPlayerKeypair();
  if (!gate.closed) session.startStage = 'opening';
  let cooldownRetries = 0;
  let contentionRetries = 0;
  for (;;) {
    try {
      // A passing HTTP or network error on the send is retried before the descent gives up.
      return await retryTransient(() => api.startRun(keypair, choice), { cancelled: () => gate.closed });
    } catch (err) {
      if (gate.closed) throw err;
      if (isContractError(err, CONTRACT_ERROR.StartCooldown) && cooldownRetries < START_RETRIES) {
        cooldownRetries += 1;
        await sleep(START_RETRY_MS);
      } else if (isRetryableTxFailure(err) && contentionRetries < START_CONTENTION_RETRIES) {
        // Several players starting in the same ledger can clash on the shared
        // player index. The failed transaction had no effect, so simulate again.
        contentionRetries += 1;
        await sleep(START_CONTENTION_BACKOFF_MS * contentionRetries + Math.random() * START_CONTENTION_JITTER_MS);
      } else {
        throw err;
      }
    }
  }
}

function enterFirstFloor(): void {
  resetMotion();
  startAmbience(1);
  showBanner('Floor 1', FLOOR_NAMES[1] ?? '');
}

function descentOptionsFor(plan: DelverPlan, onSkip: () => void): NonNullable<typeof session.descent> {
  const heroId = HERO_ORDER[plan.loadout.base] ?? 'lantern';
  return {
    art: plan.loadout.rank > 0 ? HEROES[heroId].veteranArt : HEROES[heroId].art,
    filter: cloakFilter(plan.look.cloak, plan.loadout.base),
    name: plan.look.name,
    emblem: plan.look.emblem,
    onSkip,
    kit: [
      HEROES[heroId].name,
      WEAPONS[plan.loadout.weapon]?.name ?? '',
      CHARMS[plan.loadout.charm]?.name ?? '',
      ...(plan.loadout.rank > 0 ? [`Veteran rank ${plan.loadout.rank}`] : []),
    ].join('  ·  '),
  };
}

/** Plays a labelled practice run in place of a verified one. `immediate` skips the notice hold. */
async function startPractice(plan: DelverPlan, immediate: boolean, sceneRemaining: () => number): Promise<void> {
  if (!immediate) await sleep(sceneRemaining());
  session.startStage = 'offline';
  if (!immediate) await sleep(READY_HOLD_MS + OFFLINE_EXTRA_HOLD_MS);
  enterFirstFloor();
  session.run = newRun(plan.loadout, session.challengeSeed ?? undefined, plan.look);
  session.challengeSeed = null;
  session.practice = true;
}

/** Opens a run on chain so the contract issues the seed. Falls back to a practice run. */
export async function beginRun(plan: DelverPlan): Promise<void> {
  if (session.starting) return;
  session.starting = true;
  session.displayedRelics = 0;
  resetRelicTravel();
  canvas.classList.remove('board-sunk');
  session.startStage = 'account';
  const openedAt = performance.now();
  const gate = new SkipGate();
  session.descent = descentOptionsFor(plan, () => gate.skip());
  resetChainReadout();
  session.runWasVeteran = plan.veteran;
  const sceneRemaining = (): number => Math.max(0, MIN_SCENE_MS - (performance.now() - openedAt));
  try {
    const ticket = await raceSkip(
      withTimeout(
        chainQueue.enqueue(() => openRunOnChain(plan.choice, gate)),
        START_TIMEOUT_MS
      ),
      gate
    );
    if (ticket === SKIPPED) {
      await startPractice(plan, true, sceneRemaining);
    } else {
      await sleep(sceneRemaining());
      session.startStage = 'ready';
      sfxDescend();
      await sleep(READY_HOLD_MS);
      enterFirstFloor();
      // The ticket is authoritative: the contract fixed the delver and the seed.
      const loadout: Loadout = { base: ticket.base, weapon: ticket.weapon, charm: ticket.charm, rank: ticket.rank };
      session.run = newRun(loadout, ticket.seed, ticket.look);
      session.practice = false;
      saveRun(session.run);
    }
  } catch (err) {
    console.warn('Deepmark: could not open a verified run, starting a practice run', err);
    await startPractice(plan, false, sceneRemaining);
  } finally {
    gate.close();
    session.starting = false;
    session.descent = null;
  }
  showHint('move');
}

/** A run that grows past what the contract accepts can no longer be verified. */
export function endExhaustedRun(state: RunState): void {
  if (state.mode === 'result') return;
  state.mode = 'result';
  state.resultKind = 'dead';
  state.relicsThisRun = 0;
  state.scoreThisRun = 0;
  session.practice = true;
  clearSavedRun();
  session.chainStatus = 'This run grew too long to be verified.';
}

/** Books a finished run into this browser's own progress, unless it was a practice run. The simulation stays free of storage so a log can be replayed safely. */
export function settleLocalProgress(finished: RunState, practice: boolean): void {
  const extracted = finished.resultKind === 'extracted';
  const result = recordRun({
    floorReached: finished.floorNumber,
    relicsKept: finished.relicsThisRun,
    score: finished.scoreThisRun,
    extracted,
    heroId: finished.heroId,
    practice,
  });
  session.progress = result.progress;
  finished.newBest = result.isNewBest && extracted;
}

/** Puts a run rebuilt from its saved log back on screen, at the point it was left. */
function presentResumedRun(plan: Exclude<ResumePlan, { kind: 'discard' }>, ticket: RunTicket): void {
  const resumed = plan.run;
  resetMotion();
  resetRelicTravel();
  canvas.classList.remove('board-sunk');
  resetChainReadout();
  session.canRetry = false;
  session.practice = false;
  session.runWasVeteran = typeof ticket.veteran === 'number';
  session.displayedRelics = resumed.relicsThisRun;
  session.run = resumed;
  if (plan.kind === 'continue') {
    startAmbience(resumed.floorNumber);
    showBanner('Run restored', FLOOR_NAMES[resumed.floorNumber] ?? '');
    return;
  }
  // The run had already ended when the page went away: show its result and send the log.
  session.runId += 1;
  if (resumed.resultKind === 'dead') canvas.classList.add('board-sunk');
  else preloadShareAssets(HEROES[resumed.heroId].veteranArt, resumed.loadout);
  void verifyOnChain(resumed);
}

/**
 * If this browser holds a saved run, asks the contract whether that very run is
 * still open and, if so, restores it. A saved run the contract no longer knows
 * is dropped. If Stellar cannot be read the save is kept for the next visit.
 */
export async function resumeOpenRun(): Promise<void> {
  if (session.resumeChecked || session.chainRead !== 'ready') return;
  session.resumeChecked = true;
  const saved = loadSavedRun();
  if (!saved) return;
  try {
    const api = await chain();
    const ticket = await api.fetchOpenRun(session.playerAddress);
    if (session.run || session.starting) return;
    const plan = planResume(saved, ticket);
    if (plan.kind === 'discard' || !ticket) {
      clearSavedRun();
      return;
    }
    presentResumedRun(plan, ticket);
  } catch (err) {
    console.warn('Deepmark: could not check for an open run', err);
  }
}

/** Leaves the result screen for the title, clearing everything that belonged to the finished run. */
export function leaveResult(): void {
  resetMotion();
  session.run = null;
  session.chainStatus = '';
  session.chainTx = '';
  session.chainRank = null;
  session.canRetry = false;
}

/** Opens the delver creator, keeping a delver that arrived with a challenge link. */
export function openCreator(): void {
  if (session.pendingChallengeDraft) {
    session.pendingChallengeDraft = false;
  } else {
    session.draft = loadDraft();
  }
  session.showCreator = true;
}
