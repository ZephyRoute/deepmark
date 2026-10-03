import { ActionCode, applyAction, drainEvents, newRun, type GameEvent, type RunState } from './game/state';
import { loadProgress, type Progress } from './game/progress';
import { onAction, type Action } from './input/keyboard';
import { drawWorld, face } from './render/canvas';
import { playAttack, resetMotion } from './render/motion';
import { syncChrome, type ChainRead, type LeaderboardRow, type OnchainSnapshot } from './render/chrome';
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
  sfxRelic,
} from './render/audio';
import { loadHero, saveHero, type HeroId } from './game/heroes';
import { getPlayerKeypair } from './stellar/account';
import {
  CONTRACT_ERROR,
  fetchRecord,
  fetchTop,
  finishRun,
  HERO_CODE,
  isContractError,
  startRun,
  type PlayerRecord,
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

let heroId: HeroId = loadHero();
let showLeaderboard = false;
let showStats = false;
let starting = false;
let practice = false;
let leaderboardLoading = false;
let leaderboardRows: LeaderboardRow[] | null = null;
let chainRead: ChainRead = 'loading';

/** Waiting longer than this for the chain to open a run falls back to a practice run. */
const START_TIMEOUT_MS = 50_000;
const START_RETRIES = 3;
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

async function openLeaderboard(): Promise<void> {
  showLeaderboard = true;
  if (leaderboardRows || leaderboardLoading) return;
  leaderboardLoading = true;
  try {
    const entries = await fetchTop();
    leaderboardRows = entries.slice(0, LEADERBOARD_ROWS).map((entry) => ({
      address: entry.player,
      score: entry.score,
      floor: entry.floor,
      hpLeft: entry.hp_left,
      actions: entry.actions,
    }));
  } catch (err) {
    console.warn('Deepmark: could not load the leaderboard', err);
    leaderboardRows = [];
  } finally {
    leaderboardLoading = false;
  }
}

/** Opens a run on chain so the contract issues the seed. Falls back to a practice run. */
async function beginRun(): Promise<void> {
  if (starting) return;
  starting = true;
  const chosen = heroId;
  saveHero(chosen);
  chainStatus = '';
  chainTx = '';
  chainRank = null;
  try {
    const ticket = await withTimeout(
      enqueue(async () => {
        const keypair = await getPlayerKeypair();
        for (let attempt = 0; ; attempt += 1) {
          try {
            return await startRun(keypair, HERO_CODE[chosen]);
          } catch (err) {
            const cooling = isContractError(err, CONTRACT_ERROR.StartCooldown);
            if (!cooling || attempt >= START_RETRIES) throw err;
            await sleep(START_RETRY_MS);
          }
        }
      }),
      START_TIMEOUT_MS
    );
    resetMotion();
    run = newRun(chosen, ticket.seed);
    practice = false;
  } catch (err) {
    console.warn('Deepmark: could not open a verified run, starting a practice run', err);
    resetMotion();
    run = newRun(chosen);
    practice = true;
  } finally {
    starting = false;
  }
}

/** Sends the action log. The contract replays it and decides the result. */
async function verifyOnChain(finished: RunState): Promise<void> {
  chainStatus = 'Verifying on Stellar...';
  try {
    const { hash, outcome } = await enqueue(async () => finishRun(await getPlayerKeypair(), finished.actions));
    chainTx = hash;
    const relicsMatch =
      outcome.relics_common + outcome.relics_rare + outcome.relics_core === finished.relicsThisRun;
    const agrees =
      outcome.floor_reached === finished.floorNumber &&
      outcome.score === finished.scoreThisRun &&
      outcome.hp_left === finished.player.hp &&
      relicsMatch;
    if (!agrees) console.error('Deepmark: the contract result differs from the local simulation', outcome);
    chainStatus = agrees ? 'Verified on Stellar' : 'Verified on Stellar (this browser disagreed, the chain result stands)';
    await refreshOnchain();
    const top = await fetchTop();
    const position = top.findIndex((entry) => entry.player === playerAddress);
    chainRank = position >= 0 ? position + 1 : null;
    leaderboardRows = null;
  } catch (err) {
    console.warn('Deepmark: failed to verify this run on-chain', err);
    chainStatus = 'Could not verify this run on Stellar this time';
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
      sfxRelic();
      break;
    case 'floorCleared':
      sfxFloorCleared();
      break;
    case 'descended':
      resetMotion();
      sfxDescend();
      break;
    case 'extracted':
      sfxExtracted();
      progress = loadProgress();
      if (run && !practice) void verifyOnChain(run);
      break;
    case 'dead':
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

onAction((action) => {
  if (showStats) {
    if (action === 'stats' || action === 'cancel') showStats = false;
    return;
  }

  if (showLeaderboard) {
    if (action === 'leaderboard' || action === 'cancel') showLeaderboard = false;
    return;
  }

  if (starting) return;

  if (!run) {
    if (action === 'pickLantern' || action === 'left') heroId = 'lantern';
    if (action === 'pickCinder' || action === 'right') heroId = 'cinder';
    if (action === 'pickLantern' || action === 'pickCinder' || action === 'left' || action === 'right') {
      saveHero(heroId);
    }
    if (action === 'confirm') void beginRun();
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
    }
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
      applyAction(run, MOVE_CODES[action as keyof typeof MOVE_CODES]);
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
    practice,
    heroId,
  });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
