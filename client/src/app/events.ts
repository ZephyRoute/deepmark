import type { GameEvent } from '../game/state';
import { GRID_WIDTH, MAX_FLOOR, TILE_SIZE } from '../game/floor';
import { HEROES, HERO_ORDER } from '../game/heroes';
import {
  sfxBanner,
  sfxBossIntro,
  sfxDead,
  sfxDescend,
  sfxEnemyDied,
  sfxExtracted,
  sfxFloorCleared,
  sfxHitEnemy,
  sfxHitPlayer,
  sfxRelic,
  stopAmbience,
  startAmbience,
} from '../render/audio';
import { showBanner } from '../render/banner';
import { playBossIntro, preloadBossArt } from '../render/bossIntro';
import { hitStop, punch } from '../render/clock';
import { flashActor, spawnBurst, spawnPopup, spawnRelicTravel, triggerShake } from '../render/effects';
import { showHint } from '../render/hints';
import { playAttack, resetMotion } from '../render/motion';
import { preloadShareAssets } from '../render/shareCard';
import { canvas } from './canvas';
import { FLOOR_NAMES } from './floorNames';
import { verifyOnChain } from './onchain';
import { settleLocalProgress } from './run';
import { session } from './session';

/** Popup colours by kind of number. */
const POPUP_DAMAGE_DEALT = '#e5e7eb';
const POPUP_DAMAGE_TAKEN = '#ef5350';
const POPUP_RELIC = '#ffca28';

/** Space reserved below the board's bottom edge so a travelling relic never leaves the canvas. */
const RELIC_TRAVEL_EDGE_MARGIN = 4;
const BOSS_NAME = 'Warden Prime';

/** A hit of this size or more freezes the frame a little longer. */
const HEAVY_HIT = 5;

type EventOf<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

function onEnemyHit(event: EventOf<'enemyHit'>): void {
  const run = session.run;
  if (run) {
    playAttack('player', run.player.x, run.player.y);
    const struck = run.enemies.findIndex((e) => e.x === event.x && e.y === event.y);
    if (struck >= 0) flashActor(`enemy-${struck}`);
  }
  spawnPopup(event.x, event.y, `-${event.amount}`, POPUP_DAMAGE_DEALT);
  spawnBurst(event.x, event.y, 'hit');
  sfxHitEnemy();
  hitStop(event.amount >= HEAVY_HIT ? 90 : 55);
  punch(Math.min(1, 0.25 + event.amount * 0.1));
  triggerShake(100 + event.amount * 12, 3 + event.amount);
}

function onPlayerHit(event: EventOf<'playerHit'>): void {
  const run = session.run;
  if (run && run.activeEnemyIndex !== null) {
    const enemy = run.enemies[run.activeEnemyIndex];
    if (enemy) playAttack(`enemy-${run.activeEnemyIndex}`, enemy.x, enemy.y);
  }
  spawnPopup(event.x, event.y, `-${event.amount}`, POPUP_DAMAGE_TAKEN);
  flashActor('player');
  spawnBurst(event.x, event.y, 'hit');
  sfxHitPlayer();
  hitStop(80);
  punch(0.5 + Math.min(0.5, event.amount * 0.1));
  triggerShake(150 + event.amount * 15, 5 + event.amount * 1.5);
}

function onEnemyDied(event: EventOf<'enemyDied'>): void {
  spawnBurst(event.x, event.y, 'kill');
  hitStop(120);
  punch(0.8);
  sfxEnemyDied();
  triggerShake(120, 5);
}

function onRelic(event: EventOf<'relic'>): void {
  spawnPopup(event.x, event.y, '+relic', POPUP_RELIC);
  spawnBurst(event.x, event.y, 'relic');
  sfxRelic(event.kind);
  const offsetX = (canvas.width - GRID_WIDTH * TILE_SIZE) / 2;
  const startX = offsetX + event.x * TILE_SIZE + TILE_SIZE / 2;
  const startY = event.y * TILE_SIZE + TILE_SIZE / 2;
  const counter = document.getElementById('hud-relics');
  const canvasRect = canvas.getBoundingClientRect();
  if (!counter || canvasRect.width <= 0 || canvasRect.height <= 0) return;
  // The counter sits below the board in this layout: the point aims at the counter's
  // live horizontal position but can only ever reach the board's own bottom edge.
  const counterRect = counter.getBoundingClientRect();
  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;
  const endX = Math.min(canvas.width, Math.max(0, (counterRect.left + counterRect.width / 2 - canvasRect.left) * scaleX));
  const endY = Math.min(canvas.height - RELIC_TRAVEL_EDGE_MARGIN, (counterRect.top - canvasRect.top) * scaleY);
  spawnRelicTravel(startX, startY, endX, endY, event.kind);
}

function onFloorCleared(): void {
  sfxFloorCleared();
  showHint('choice');
  if (session.run && session.run.floorNumber === MAX_FLOOR - 1) preloadBossArt();
}

function onDescended(event: EventOf<'descended'>): void {
  resetMotion();
  sfxDescend();
  startAmbience(event.floor);
  if (event.floor < MAX_FLOOR) {
    showBanner(`Floor ${event.floor}`, FLOOR_NAMES[event.floor] ?? '', 'floor');
    sfxBanner();
    return;
  }
  const stage = document.querySelector<HTMLElement>('.stage');
  if (!stage) {
    sfxBossIntro();
    return;
  }
  session.bossIntro = playBossIntro(
    stage,
    BOSS_NAME,
    () => sfxBossIntro(),
    () => {
      session.bossIntro = null;
    }
  );
}

/** Books the finished run locally and, unless it is practice, sends its log to the contract. */
function settleFinishedRun(): void {
  const run = session.run;
  if (run) settleLocalProgress(run, session.practice);
  session.runId += 1;
  if (run && !session.practice) void verifyOnChain(run);
}

function onExtracted(): void {
  stopAmbience();
  sfxExtracted();
  const run = session.run;
  if (run) {
    const heroId = HERO_ORDER[run.loadout.base] ?? 'lantern';
    preloadShareAssets(HEROES[heroId].veteranArt, run.loadout);
  }
  settleFinishedRun();
}

function onDead(): void {
  stopAmbience();
  sfxDead();
  triggerShake(250, 10);
  canvas.classList.add('board-sunk');
  settleFinishedRun();
}

/** Turns one simulation event into its feedback: effects, sound, hints and, at the end of a run, settlement. */
export function handleEvent(event: GameEvent): void {
  switch (event.type) {
    case 'enemyHit':
      onEnemyHit(event);
      break;
    case 'playerHit':
      onPlayerHit(event);
      break;
    case 'enemyDied':
      onEnemyDied(event);
      break;
    case 'relic':
      onRelic(event);
      break;
    case 'floorCleared':
      onFloorCleared();
      break;
    case 'descended':
      onDescended(event);
      break;
    case 'extracted':
      onExtracted();
      break;
    case 'dead':
      onDead();
      break;
    case 'combatStart':
      showHint('combat');
      break;
  }
}
