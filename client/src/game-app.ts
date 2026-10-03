import { ActionCode, applyAction, drainEvents, newRun, type GameEvent, type RunState } from './game/state';
import { loadProgress, type Progress } from './game/progress';
import { onAction, type Action } from './input/keyboard';
import { drawWorld, face } from './render/canvas';
import { playAttack, resetMotion } from './render/motion';
import {
  syncChrome,
  type BoardTab,
  type ChainRead,
  type LeaderboardRow,
  type OnchainSnapshot,
} from './render/chrome';
import './styles.css';
import { spawnPopup, triggerShake } from './render/effects';
import {
  sfxDead,
  sfxDescend,
  sfxEnemyDied,
  sfxExtracted,
  sfxFloorCleared,
  sfxHitEnemy,
  sfxHitPlayer,
  sfxBossIntro,
  sfxRelic,
  sfxStep,
  sfxUi,
  isMuted,
  startAmbience,
  stopAmbience,
  toggleMuted,
} from './render/audio';
import { loadDraft, loadoutOf, type Draft } from './game/draft';
import { MAX_FLOOR } from './game/floor';
import { HEROES, HERO_ORDER } from './game/heroes';
import { CHARMS, WEAPONS } from './game/items';
import { cloakFilter } from './render/emblems';
import type { DescentOptions, DescentStage } from './render/descent';
import { rankForClears, type Loadout, type Look } from './game/loadout';
import { getPlayerKeypair } from './stellar/account';
import {
  CONTRACT_ERROR,
  fetchHeroes,
  fetchRecord,
  fetchTopFresh,
  fetchTopVeteran,
  finishRun,
  freshChoice,
  isContractError,
  startRun,
  veteranChoice,
  type FinishedRun,
  type Hero,
  type HeroChoice,
  type PlayerRecord,
  type TopEntry,
} from './stellar/contract';
import { fetchRelicBalances, type RelicBalances } from './stellar/relics';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const context = canvas.getContext('2d');
if (!context) throw new Error('Canvas 2D context unavailable');
const ctx: CanvasRenderingContext2D = context;

let run: RunState | null = null;
let progress: Progress = loadProgress();
let chainStatus = '';
let chainTx = '';
let chainRank: number | null = null;
let onchainRecord: PlayerRecord | null = null;
let relicBalances: RelicBalances | null = null;
let playerAddress = '';

let draft: Draft = loadDraft();
let showCreator = false;
let showVault = false;
let vaultHeroes: Hero[] | null = null;
let vaultLoading = false;
let boardTab: BoardTab = 'fresh';
let chainHeroId: number | null = null;
let canRetry = false;
let failedRun: RunState | null = null;
let runWasVeteran = false;
let showLeaderboard = false;
let showStats = false;
let starting = false;
let startStage: DescentStage = 'account';
let descent: DescentOptions | null = null;
let practice = false;
let leaderboardLoading = false;
let leaderboardRows: LeaderboardRow[] | null = null;
let chainRead: ChainRead = 'loading';

/** Waiting longer than this for the chain to open a run falls back to a practice run. */
const START_TIMEOUT_MS = 50_000;
const START_RETRIES = 3;
/** The stairs-open beat before the first floor appears, so the scene resolves instead of cutting. */
const READY_HOLD_MS = 1400;
/** The scene always plays at least this long, so a fast network never shows a flash of it. */
const MIN_SCENE_MS = 3200;
const START_RETRY_MS = 6_000;
const LEADERBOARD_ROWS = 10;

// One chain transaction at a time. Two transactions from the same account
// built before the first lands would reuse a sequence number and one of them
// would fail, so starting a run waits for the previous run's verification.
let chainQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = chainQueue.then(job, job);
  chainQueue = next.catch(() => undefined);
  return next;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for Stellar')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function refreshOnchain(): Promise<void> {
  try {
    const keypair = await getPlayerKeypair();
    playerAddress = keypair.publicKey();
    const [record, balances] = await Promise.all([fetchRecord(playerAddress), fetchRelicBalances(playerAddress)]);
    onchainRecord = record;
    relicBalances = balances;
    chainRead = 'ready';
  } catch (err) {
    chainRead = 'unavailable';
    console.warn('Deepmark: could not read the on-chain record yet', err);
  }
}

void refreshOnchain();

function onchainSnapshot(): OnchainSnapshot | null {
  if (!onchainRecord) return null;
  return {
    bestFloor: onchainRecord.best_floor,
    bestScore: onchainRecord.best_score,
    runs: onchainRecord.total_runs,
    extractions: onchainRecord.extractions,
    deaths: onchainRecord.deaths,
    forfeits: onchainRecord.forfeits,
    relicsBanked: onchainRecord.relics_banked,
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

async function loadBoard(): Promise<void> {
  const tab = boardTab;
  leaderboardLoading = true;
  leaderboardRows = null;
  try {
    const entries = tab === 'veteran' ? await fetchTopVeteran() : await fetchTopFresh();
    if (tab === boardTab) leaderboardRows = toRows(entries);
  } catch (err) {
    console.warn('Deepmark: could not load the leaderboard', err);
    if (tab === boardTab) leaderboardRows = [];
  } finally {
    if (tab === boardTab) leaderboardLoading = false;
  }
}

async function openLeaderboard(): Promise<void> {
  showLeaderboard = true;
  if (leaderboardRows || leaderboardLoading) return;
  await loadBoard();
}

async function openVault(): Promise<void> {
  showVault = true;
  if (vaultHeroes || vaultLoading) return;
  vaultLoading = true;
  try {
    const keypair = await getPlayerKeypair();
    vaultHeroes = await fetchHeroes(keypair.publicKey());
  } catch (err) {
    console.warn('Deepmark: could not read the vault', err);
    vaultHeroes = null;
  } finally {
    vaultLoading = false;
  }
}

interface DelverPlan {
  choice: HeroChoice;
  loadout: Loadout;
  look: Look;
  veteran: boolean;
}

function planFresh(chosen: Draft): DelverPlan {
  return {
    choice: freshChoice({ look: chosen.look, base: chosen.base, weapon: chosen.weapon, charm: chosen.charm }),
    loadout: loadoutOf(chosen),
    look: chosen.look,
    veteran: false,
  };
}

function planVeteran(hero: Hero): DelverPlan {
  return {
    choice: veteranChoice(hero.id),
    loadout: { base: hero.base, weapon: hero.weapon, charm: hero.charm, rank: rankForClears(hero.clears) },
    look: hero.look,
    veteran: true,
  };
}

/** Opens a run on chain so the contract issues the seed. Falls back to a practice run. */
async function beginRun(plan: DelverPlan): Promise<void> {
  if (starting) return;
  starting = true;
  startStage = 'account';
  const openedAt = performance.now();
  const heroId = HERO_ORDER[plan.loadout.base] ?? 'lantern';
  descent = {
    art: HEROES[heroId].art,
    filter: cloakFilter(plan.look.cloak, plan.loadout.base),
    name: plan.look.name,
    emblem: plan.look.emblem,
    kit: [
      HEROES[heroId].name,
      WEAPONS[plan.loadout.weapon]?.name ?? '',
      CHARMS[plan.loadout.charm]?.name ?? '',
      ...(plan.loadout.rank > 0 ? [`Veteran rank ${plan.loadout.rank}`] : []),
    ].join('  ·  '),
  };
  chainStatus = '';
  chainTx = '';
  chainRank = null;
  chainHeroId = null;
  runWasVeteran = plan.veteran;
  try {
    const ticket = await withTimeout(
      enqueue(async () => {
        const keypair = await getPlayerKeypair();
        startStage = 'opening';
        for (let attempt = 0; ; attempt += 1) {
          try {
            return await startRun(keypair, plan.choice);
          } catch (err) {
            const cooling = isContractError(err, CONTRACT_ERROR.StartCooldown);
            if (!cooling || attempt >= START_RETRIES) throw err;
            await sleep(START_RETRY_MS);
          }
        }
      }),
      START_TIMEOUT_MS
    );
    await sleep(Math.max(0, MIN_SCENE_MS - (performance.now() - openedAt)));
    startStage = 'ready';
    sfxDescend();
    await sleep(READY_HOLD_MS);
    resetMotion();
    startAmbience(1);
    // The ticket is authoritative: the contract fixed the delver and the seed.
    const loadout: Loadout = { base: ticket.base, weapon: ticket.weapon, charm: ticket.charm, rank: ticket.rank };
    run = newRun(loadout, ticket.seed, ticket.look);
    practice = false;
  } catch (err) {
    console.warn('Deepmark: could not open a verified run, starting a practice run', err);
    await sleep(Math.max(0, MIN_SCENE_MS - (performance.now() - openedAt)));
    startStage = 'offline';
    await sleep(READY_HOLD_MS + 600);
    resetMotion();
    startAmbience(1);
    run = newRun(plan.loadout, undefined, plan.look);
    practice = true;
  } finally {
    starting = false;
    descent = null;
  }
}

/** Sends the action log. The contract replays it and decides the result. */
const VERIFY_ATTEMPTS = 6;
const VERIFY_RETRY_MS = 6_000;

/** The contract's own refusals do not heal by waiting. Only TooFast and network trouble do. */
function isPermanentFailure(err: unknown): boolean {
  if (!(err instanceof Error) || !err.message.includes('Error(Contract, #')) return false;
  return !isContractError(err, CONTRACT_ERROR.TooFast);
}

function describeFailure(err: unknown): string {
  if (isContractError(err, CONTRACT_ERROR.RunNotStarted)) {
    return 'This run is no longer open on Stellar. It was already settled or it expired.';
  }
  if (isContractError(err, CONTRACT_ERROR.NotHeroOwner)) return 'This delver changed hands during the run, so it cannot be settled.';
  if (
    isContractError(err, CONTRACT_ERROR.RunIncomplete) ||
    isContractError(err, CONTRACT_ERROR.TrailingActions) ||
    isContractError(err, CONTRACT_ERROR.InvalidAction)
  ) {
    return 'The contract could not reproduce this run, so it was not recorded.';
  }
  return 'Stellar could not be reached to settle this run.';
}

/** Sends the log, waiting out the contract's minimum play time and brief network trouble. */
async function submitLog(finished: RunState): Promise<FinishedRun> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await enqueue(async () => finishRun(await getPlayerKeypair(), finished.actions));
    } catch (err) {
      if (isPermanentFailure(err) || attempt >= VERIFY_ATTEMPTS - 1) throw err;
      chainStatus = 'Waiting for Stellar to settle this run...';
      await sleep(VERIFY_RETRY_MS);
    }
  }
}

async function verifyOnChain(finished: RunState): Promise<void> {
  chainStatus = 'Verifying on Stellar...';
  canRetry = false;
  let settled: FinishedRun;
  try {
    settled = await submitLog(finished);
  } catch (err) {
    console.warn('Deepmark: failed to verify this run on-chain', err);
    chainStatus = describeFailure(err);
    canRetry = !isPermanentFailure(err);
    failedRun = finished;
    return;
  }

  const { hash, outcome } = settled;
  failedRun = null;
  chainTx = hash;
  chainHeroId = outcome.hero_id ?? null;
  if (chainHeroId !== null) vaultHeroes = null;
  const relicsMatch = outcome.relics_common + outcome.relics_rare + outcome.relics_core === finished.relicsThisRun;
  const agrees =
    outcome.floor_reached === finished.floorNumber &&
    outcome.score === finished.scoreThisRun &&
    outcome.hp_left === finished.player.hp &&
    relicsMatch;
  if (!agrees) console.error('Deepmark: the contract result differs from the local simulation', outcome);
  chainStatus = agrees ? 'Verified on Stellar' : 'Verified on Stellar (this browser disagreed, the chain result stands)';

  // The run is settled. Anything below only decorates the result screen, so a
  // failure here must never turn a confirmed transaction into an error.
  try {
    await refreshOnchain();
    const top = runWasVeteran ? await fetchTopVeteran() : await fetchTopFresh();
    const position = top.findIndex((entry) => entry.player === playerAddress);
    chainRank = position >= 0 ? position + 1 : null;
    leaderboardRows = null;
  } catch (err) {
    console.warn('Deepmark: could not refresh the leaderboard rank', err);
  }
}

/** A run that grows past what the contract accepts can no longer be verified. */
function endExhaustedRun(state: RunState): void {
  if (state.mode === 'result') return;
  state.mode = 'result';
  state.resultKind = 'dead';
  state.relicsThisRun = 0;
  state.scoreThisRun = 0;
  practice = true;
  chainStatus = 'This run grew too long to be verified.';
}

const DIRS: Partial<Record<Action, [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

function handleEvent(event: GameEvent): void {
  switch (event.type) {
    case 'enemyHit':
      if (run) playAttack('player', run.player.x, run.player.y);
      spawnPopup(event.x, event.y, `-${event.amount}`, '#e5e7eb');
      sfxHitEnemy();
      triggerShake(100, 4);
      break;
    case 'playerHit':
      if (run && run.activeEnemyIndex !== null) {
        const enemy = run.enemies[run.activeEnemyIndex];
        if (enemy) playAttack(`enemy-${run.activeEnemyIndex}`, enemy.x, enemy.y);
      }
      spawnPopup(event.x, event.y, `-${event.amount}`, '#ef5350');
      sfxHitPlayer();
      triggerShake(150, 7);
      break;
    case 'enemyDied':
      sfxEnemyDied();
      triggerShake(120, 5);
      break;
    case 'relic':
      spawnPopup(event.x, event.y, '+relic', '#ffca28');
      sfxRelic(event.kind);
      break;
    case 'floorCleared':
      sfxFloorCleared();
      break;
    case 'descended':
      resetMotion();
      sfxDescend();
      startAmbience(event.floor);
      if (event.floor >= MAX_FLOOR) sfxBossIntro();
      break;
    case 'extracted':
      stopAmbience();
      sfxExtracted();
      progress = loadProgress();
      if (run && !practice) void verifyOnChain(run);
      break;
    case 'dead':
      stopAmbience();
      sfxDead();
      triggerShake(250, 10);
      progress = loadProgress();
      if (run && !practice) void verifyOnChain(run);
      break;
    case 'combatStart':
      break;
  }
}

const MOVE_CODES = {
  up: ActionCode.Up,
  down: ActionCode.Down,
  left: ActionCode.Left,
  right: ActionCode.Right,
} as const;

function syncMuteButton(): void {
  const button = document.getElementById('mute');
  if (!button) return;
  const muted = isMuted();
  button.textContent = muted ? 'Sound off' : 'Sound on';
  button.setAttribute('aria-pressed', muted ? 'true' : 'false');
}

syncMuteButton();

onAction((action) => {
  if (action === 'mute') {
    toggleMuted();
    syncMuteButton();
    return;
  }
  if (!run) sfxUi();
  if (showStats) {
    if (action === 'stats' || action === 'cancel') showStats = false;
    return;
  }

  if (showLeaderboard) {
    if (action === 'leaderboard' || action === 'cancel') showLeaderboard = false;
    if (action === 'tabFresh' || action === 'tabVeteran') {
      boardTab = action === 'tabVeteran' ? 'veteran' : 'fresh';
      void loadBoard();
    }
    return;
  }

  if (starting) return;

  if (showCreator) {
    if (action === 'cancel') showCreator = false;
    return;
  }

  if (showVault) {
    if (action === 'vault' || action === 'cancel') showVault = false;
    return;
  }

  if (!run) {
    if (action === 'confirm') {
      draft = loadDraft();
      showCreator = true;
    }
    if (action === 'vault') void openVault();
    if (action === 'stats') showStats = true;
    if (action === 'leaderboard') void openLeaderboard();
    return;
  }

  if (run.mode === 'result') {
    if (action === 'confirm') {
      resetMotion();
      run = null;
      chainStatus = '';
      chainTx = '';
      chainRank = null;
      canRetry = false;
    }
    if (action === 'retryVerify' && failedRun) void verifyOnChain(failedRun);
    return;
  }

  if (run.mode === 'combat') {
    if (action === 'confirm') applyAction(run, ActionCode.Attack);
    if (action === 'cancel') applyAction(run, ActionCode.Retreat);
  } else if (run.mode === 'choice') {
    if (action === 'confirm') applyAction(run, ActionCode.Descend);
    if (action === 'cancel') applyAction(run, ActionCode.Extract);
  } else {
    const dir = DIRS[action];
    if (dir) {
      if (dir[0] !== 0) face(dir[0] < 0 ? -1 : 1);
      const moved = applyAction(run, MOVE_CODES[action as keyof typeof MOVE_CODES]);
      if (moved && run.mode === 'explore') sfxStep();
    }
  }

  if (run.exhausted) endExhaustedRun(run);
  for (const event of drainEvents(run)) handleEvent(event);
});

function frame(): void {
  if (run && !showLeaderboard && !showStats && run.mode !== 'result') drawWorld(ctx, run);
  else {
    ctx.fillStyle = '#07080e';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  syncChrome({
    showCreator,
    showVault,
    draft,
    creatorHooks: {
      onBegin: (chosen) => {
        draft = chosen;
        showCreator = false;
        void beginRun(planFresh(chosen));
      },
      onBack: () => {
        showCreator = false;
      },
    },
    vaultHeroes,
    vaultLoading,
    onVeteran: (id) => {
      const hero = vaultHeroes?.find((h) => h.id === id);
      if (!hero) return;
      showVault = false;
      void beginRun(planVeteran(hero));
    },
    boardTab,
    chainHeroId,
    canRetry,
    showLeaderboard,
    showStats,
    leaderboardLoading,
    leaderboardRows,
    playerAddress,
    run,
    progress,
    onchain: onchainSnapshot(),
    relics: relicBalances,
    chainRead,
    chainStatus,
    chainTx,
    chainRank,
    starting,
    startStage,
    descent,
    practice,
  });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
