import { delverOutcome } from '../game/delverOutcome';
import { clearSavedRun } from '../game/savedRun';
import type { RunState } from '../game/state';
import type { LeaderboardRow, OnchainSnapshot } from '../render/chromeTypes';
import { sfxHeroEarned } from '../render/audio';
import { chain } from '../stellar/lazy';
import { shortenAddress } from '../render/dom';
import type { FinishedRun, TopEntry } from '../stellar/contract';
import { fetchRelicBalances } from '../stellar/relics';
import { HERO_EARNED_DELAY_MS, RESTORE_FIELD_ID, JUST_VERIFIED_MS, LEADERBOARD_ROWS, VERIFY_ATTEMPTS, VERIFY_RETRY_MS } from '../constants';
import { chainQueue, sleep } from './chainQueue';
import { describeFailure, failureKind, isPermanentFailure, keepsRun, SettlementUnconfirmed } from './failures';
import { checkSettlement } from './settlement';
import { session } from './session';

/** Reads the player's record and relic balances. The title never waits for it. */
export async function refreshOnchain(): Promise<void> {
  try {
    const api = await chain();
    const keypair = await api.getPlayerKeypair();
    session.playerAddress = keypair.publicKey();
    const [record, balances] = await Promise.all([api.fetchRecord(session.playerAddress), fetchRelicBalances(session.playerAddress)]);
    session.onchainRecord = record;
    session.relicBalances = balances;
    session.chainRead = 'ready';
  } catch (err) {
    session.chainRead = 'unavailable';
    console.warn('Deepmark: could not read the on-chain record yet', err);
  }
}

export function onchainSnapshot(): OnchainSnapshot | null {
  const record = session.onchainRecord;
  if (!record) return null;
  return {
    bestFloor: record.best_floor,
    bestScore: record.best_score,
    runs: record.total_runs,
    extractions: record.extractions,
    deaths: record.deaths,
    forfeits: record.forfeits,
    relicsBanked: record.relics_banked,
  };
}

function toRows(entries: TopEntry[]): LeaderboardRow[] {
  return entries.slice(0, LEADERBOARD_ROWS).map((entry) => ({
    address: entry.player,
    name: entry.name,
    emblem: entry.emblem,
    score: entry.score,
    floor: entry.floor,
    hpLeft: entry.hp_left,
    actions: entry.actions,
  }));
}

export async function loadBoard(): Promise<void> {
  const tab = session.boardTab;
  session.leaderboardLoading = true;
  session.leaderboardRows = null;
  session.leaderboardFailed = false;
  try {
    const api = await chain();
    const entries = tab === 'veteran' ? await api.fetchTopVeteran() : await api.fetchTopFresh();
    if (tab === session.boardTab) session.leaderboardRows = toRows(entries);
  } catch (err) {
    console.warn('Deepmark: could not load the leaderboard', err);
    if (tab === session.boardTab) session.leaderboardFailed = true;
  } finally {
    if (tab === session.boardTab) session.leaderboardLoading = false;
  }
}

export async function openLeaderboard(): Promise<void> {
  session.showLeaderboard = true;
  if (session.leaderboardRows || session.leaderboardLoading) return;
  await loadBoard();
}

export async function copyRecoveryCode(): Promise<void> {
  try {
    const api = await chain();
    const code = api.getRecoveryCode();
    if (!code) throw new Error('No account yet');
    await navigator.clipboard.writeText(code);
    session.recoveryNote = 'Recovery code copied. Keep it somewhere private, anyone who has it can use your account.';
  } catch (err) {
    console.warn('Deepmark: could not copy the recovery code', err);
    session.recoveryNote = 'The recovery code could not be copied from this browser.';
  }
}

/** The validated code waiting for the player's confirmation. Module private so it is never rendered or logged. */
let pendingRestoreCode: string | null = null;

export function startRestore(): void {
  pendingRestoreCode = null;
  session.restoreError = '';
  session.restoreTarget = '';
  session.restoreStep = 'enter';
}

export function cancelRestore(): void {
  pendingRestoreCode = null;
  session.restoreError = '';
  session.restoreTarget = '';
  session.restoreStep = 'closed';
}

/** Validates the pasted code strictly. Nothing is replaced until the player confirms the next step. */
export async function checkRestoreCode(): Promise<void> {
  const field = document.getElementById(RESTORE_FIELD_ID);
  const pasted = field instanceof HTMLInputElement ? field.value : '';
  if (field instanceof HTMLInputElement) field.value = '';
  try {
    const api = await chain();
    const code = pasted.trim();
    if (!api.isRecoveryCode(code)) {
      session.restoreError = 'That recovery code is not valid. Nothing was changed.';
      return;
    }
    pendingRestoreCode = code;
    session.restoreTarget = shortenAddress(api.recoveryCodeAddress(code));
    session.restoreError = '';
    session.restoreStep = 'confirm';
  } catch (err) {
    console.warn('Deepmark: could not check the recovery code', err);
    session.restoreError = 'That recovery code could not be checked. Nothing was changed.';
  }
}

/** Swaps this browser's account for the one in the confirmed recovery code, then reloads. */
export async function confirmRestore(): Promise<void> {
  const code = pendingRestoreCode;
  if (!code) return;
  try {
    const api = await chain();
    api.restoreRecoveryCode(code);
    pendingRestoreCode = null;
    window.location.reload();
  } catch (err) {
    console.warn('Deepmark: could not restore the account', err);
    session.restoreError = 'That recovery code could not be used. Your current account was kept.';
    session.restoreStep = 'enter';
    pendingRestoreCode = null;
  }
}

export async function openVault(): Promise<void> {
  session.showVault = true;
  if (session.vaultHeroes || session.vaultLoading) return;
  session.vaultLoading = true;
  try {
    const api = await chain();
    const keypair = await api.getPlayerKeypair();
    session.vaultHeroes = await api.fetchHeroes(keypair.publicKey());
  } catch (err) {
    console.warn('Deepmark: could not read the vault', err);
    session.vaultHeroes = null;
  } finally {
    session.vaultLoading = false;
  }
}

type Api = Awaited<ReturnType<typeof chain>>;

/** Either the run just settled, or proof from the record that an earlier send already settled it. */
type Settlement = { kind: 'finished'; run: FinishedRun } | { kind: 'recorded' };

async function readRunCount(api: Api): Promise<number | null> {
  try {
    return (await api.fetchRecord((await api.getPlayerKeypair()).publicKey()))?.total_runs ?? 0;
  } catch {
    return null;
  }
}

/** Redoes the account's relic setup. A failure is logged only: the next send reports the real cause. */
async function redoRelicSetup(api: Api): Promise<void> {
  session.chainStatus = 'Getting your relic setup ready...';
  session.verifyState = 'waiting';
  try {
    await api.prepareRelicSetup();
  } catch (err) {
    console.warn('Deepmark: relic setup did not finish', err);
  }
}

/** A retry found no open run. If an earlier send of this very run happened, the record says whether it landed. */
async function settleWhenClosed(api: Api, err: unknown, previouslySent: boolean): Promise<Settlement> {
  if (!previouslySent) throw err;
  const address = (await api.getPlayerKeypair()).publicKey();
  const verdict = await checkSettlement(() => api.fetchRecord(address), session.finishBaselineRuns);
  if (verdict === 'recorded') return { kind: 'recorded' };
  if (verdict === 'unknown') throw new SettlementUnconfirmed();
  throw err;
}

async function submitWithRetries(api: Api, finished: RunState): Promise<Settlement> {
  const previouslySent = session.finishAttemptRunId === session.runId;
  if (!previouslySent) {
    session.finishAttemptRunId = session.runId;
    session.finishBaselineRuns = await readRunCount(api);
  }
  let setupRedone = false;
  let sentBefore = previouslySent;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const run = await api.finishRun(await api.getPlayerKeypair(), finished.actions);
      return { kind: 'finished', run };
    } catch (err) {
      const kind = failureKind(err);
      if (kind === 'closed') return settleWhenClosed(api, err, sentBefore);
      sentBefore = true;
      if (kind === 'mint' && !setupRedone) {
        // The contract reverted and kept the run open, so one more send after the setup is safe.
        setupRedone = true;
        await redoRelicSetup(api);
        continue;
      }
      if (kind !== 'wait' || attempt >= VERIFY_ATTEMPTS - 1) throw err;
      session.chainStatus = 'Waiting for Stellar to settle this run...';
      session.verifyState = 'waiting';
      await sleep(VERIFY_RETRY_MS);
    }
  }
}

/** Sends the log, waiting out the contract's minimum play time and brief network trouble. */
function submitLog(finished: RunState): Promise<Settlement> {
  // The whole retry loop holds the chain queue, sleeps included, so start_run
  // cannot slip in between attempts and overwrite the run that is still open.
  return chainQueue.enqueue(async () => {
    const api = await chain();
    return submitWithRetries(api, finished);
  });
}

/** Adds the player's leaderboard rank and refreshed record. Decoration only, so it never throws. */
async function decorateResult(): Promise<void> {
  try {
    await refreshOnchain();
    const api = await chain();
    if (session.runWasVeteran && session.chainHeroId !== null) {
      session.chainClears = (await api.fetchHero(session.chainHeroId))?.clears ?? null;
    }
    const top = session.runWasVeteran ? await api.fetchTopVeteran() : await api.fetchTopFresh();
    const position = top.findIndex((entry) => entry.player === session.playerAddress);
    session.chainRank = position >= 0 ? position + 1 : null;
    session.leaderboardRows = null;
  } catch (err) {
    console.warn('Deepmark: could not refresh the leaderboard rank', err);
  }
}

/** Sends the action log. The contract replays it and decides the result. */
export async function verifyOnChain(finished: RunState): Promise<void> {
  session.chainStatus = 'Verifying on Stellar...';
  session.verifyState = 'pending';
  session.canRetry = false;
  let settled: Settlement;
  try {
    settled = await submitLog(finished);
  } catch (err) {
    console.warn('Deepmark: failed to verify this run on-chain', err);
    session.chainStatus = describeFailure(err);
    session.verifyState = 'failed';
    session.canRetry = !isPermanentFailure(err);
    session.failedRun = finished;
    // Only a refusal that waiting cannot fix means the run is gone for good. Otherwise the saved run and its log stay for another try.
    if (!keepsRun(err)) clearSavedRun();
    return;
  }

  if (settled.kind === 'recorded') {
    // The send landed but its response was lost. The record proves it, so show the verified state.
    session.failedRun = null;
    clearSavedRun();
    session.chainTx = '';
    session.chainHeroId = null;
    session.vaultHeroes = null;
    session.chainStatus = 'Verified on Stellar (the confirmation arrived late, so the details come from your record)';
    session.verifyState = 'verified';
    session.justVerifiedUntil = performance.now() + JUST_VERIFIED_MS;
    await decorateResult();
    return;
  }

  const { hash, outcome } = settled.run;
  session.failedRun = null;
  clearSavedRun();
  session.chainTx = hash;
  session.chainHeroId = outcome.hero_id ?? null;
  if (session.chainHeroId !== null) session.vaultHeroes = null;
  const relicsMatch = outcome.relics_common + outcome.relics_rare + outcome.relics_core === finished.relicsThisRun;
  const agrees =
    outcome.floor_reached === finished.floorNumber &&
    outcome.score === finished.scoreThisRun &&
    outcome.hp_left === finished.player.hp &&
    relicsMatch;
  if (!agrees) console.error('Deepmark: the contract result differs from the local simulation', outcome);
  session.chainStatus = agrees ? 'Verified on Stellar' : 'Verified on Stellar (this browser disagreed, the chain result stands)';
  session.verifyState = 'verified';
  session.justVerifiedUntil = performance.now() + JUST_VERIFIED_MS;
  const earned = delverOutcome(session.chainHeroId, session.runWasVeteran, null).kind === 'earned';
  if (earned) window.setTimeout(sfxHeroEarned, HERO_EARNED_DELAY_MS);

  // The run is settled. Anything below only decorates the result screen, so a
  // failure here must never turn a confirmed transaction into an error.
  await decorateResult();
}
