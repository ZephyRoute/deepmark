import {
  attack,
  chooseDescend,
  chooseExtract,
  drainEvents,
  newRun,
  retreat,
  tryMove,
  type GameEvent,
  type RunState,
} from './game/state';
import { loadProgress, type Progress } from './game/progress';
import { onAction, type Action } from './input/keyboard';
import { drawWorld, face } from './render/canvas';
import { playAttack, resetMotion } from './render/motion';
import { syncChrome, type LeaderboardRow } from './render/chrome';
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
import { getPlayerKeypair } from './stellar/account';
import { fetchLeaderboard, fetchOnchainRecord, submitRunResult, type PlayerRecord } from './stellar/contract';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const context = canvas.getContext('2d');
if (!context) throw new Error('Canvas 2D context unavailable');
const ctx: CanvasRenderingContext2D = context;

let run: RunState | null = null;
let progress: Progress = loadProgress();
let chainStatus = '';
let onchainRecord: PlayerRecord | null = null;
let playerAddress = '';

let showLeaderboard = false;
let leaderboardLoading = false;
let leaderboardRows: LeaderboardRow[] | null = null;

getPlayerKeypair()
  .then(async (keypair) => {
    playerAddress = keypair.publicKey();
    try {
      onchainRecord = await fetchOnchainRecord(keypair);
    } catch (err) {
      console.warn('Deepmark: could not read the on-chain record yet', err);
    }
  })
  .catch((err) => console.warn('Deepmark: could not set up a testnet account', err));

async function openLeaderboard(): Promise<void> {
  showLeaderboard = true;
  if (leaderboardRows || leaderboardLoading) return;
  leaderboardLoading = true;
  try {
    const keypair = await getPlayerKeypair();
    const entries = await fetchLeaderboard(keypair, 10);
    leaderboardRows = entries.map((entry) => ({
      address: entry.address,
      bestFloor: entry.record.best_floor,
      bestRelics: entry.record.best_relics,
      totalRuns: entry.record.total_runs,
    }));
  } catch (err) {
    console.warn('Deepmark: could not load the leaderboard', err);
    leaderboardRows = [];
  } finally {
    leaderboardLoading = false;
  }
}

function onchainSummary(): string {
  if (!onchainRecord) return '';
  return `On-chain (Stellar testnet): floor ${onchainRecord.best_floor} / 3, ${onchainRecord.best_relics} relics, ${onchainRecord.total_runs} runs`;
}

async function submitToChain(floorReached: number, relicsKept: number): Promise<void> {
  chainStatus = 'Saving to Stellar testnet...';
  try {
    const keypair = await getPlayerKeypair();
    const { hash, record } = await submitRunResult(keypair, floorReached, relicsKept);
    onchainRecord = record;
    chainStatus = hash ? `Saved on-chain (tx ${hash.slice(0, 8)}...)` : 'Saved on-chain';
    leaderboardRows = null;
  } catch (err) {
    console.warn('Deepmark: failed to record this run on-chain', err);
    chainStatus = 'Could not save to Stellar this time';
  }
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
      if (run) void submitToChain(run.floorNumber, run.relicsThisRun);
      break;
    case 'dead':
      sfxDead();
      triggerShake(250, 10);
      progress = loadProgress();
      if (run) void submitToChain(run.floorNumber, run.relicsThisRun);
      break;
    case 'combatStart':
      break;
  }
}

onAction((action) => {
  if (showLeaderboard) {
    if (action === 'leaderboard' || action === 'cancel') showLeaderboard = false;
    return;
  }

  if (!run) {
    if (action === 'confirm') {
      resetMotion();
      run = newRun();
    }
    if (action === 'leaderboard') void openLeaderboard();
    return;
  }

  if (run.mode === 'result') {
    if (action === 'confirm') {
      resetMotion();
      run = newRun();
      chainStatus = '';
    }
    return;
  }

  if (run.mode === 'combat') {
    if (action === 'confirm') attack(run);
    if (action === 'cancel') retreat(run);
  } else if (run.mode === 'choice') {
    if (action === 'confirm') chooseDescend(run);
    if (action === 'cancel') chooseExtract(run);
  } else {
    const dir = DIRS[action];
    if (dir) {
      if (dir[0] !== 0) face(dir[0] < 0 ? -1 : 1);
      tryMove(run, dir[0], dir[1]);
    }
  }

  for (const event of drainEvents(run)) handleEvent(event);
});

function frame(): void {
  if (run && !showLeaderboard && run.mode !== 'result') drawWorld(ctx, run);
  else {
    ctx.fillStyle = '#07080e';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  syncChrome({
    showLeaderboard,
    leaderboardLoading,
    leaderboardRows,
    playerAddress,
    run,
    progress,
    onchainSummary: onchainSummary(),
    chainStatus,
  });
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
