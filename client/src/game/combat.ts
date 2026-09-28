import { randInt, type Rng } from './rng';

export interface ExchangeResult {
  playerDamageDealt: number;
  enemyDamageDealt: number;
  enemyDied: boolean;
  playerDied: boolean;
}

const PLAYER_DMG_MIN = 2;
const PLAYER_DMG_MAX = 4;

/**
 * One full round: player strikes first, then the enemy strikes back if it
 * survived. This is the exact resolution the Phase 3 Soroban contract will
 * reproduce deterministically from the same seed, so it stays pure and
 * free of any rendering, audio or DOM concerns.
 */
export function resolveExchange(
  rng: Rng,
  playerHp: number,
  enemyHp: number,
  enemyDmgMin: number,
  enemyDmgMax: number
): ExchangeResult {
  const playerDamageDealt = randInt(rng, PLAYER_DMG_MIN, PLAYER_DMG_MAX);
  const enemyHpAfter = enemyHp - playerDamageDealt;
  const enemyDied = enemyHpAfter <= 0;

  if (enemyDied) {
    return { playerDamageDealt, enemyDamageDealt: 0, enemyDied: true, playerDied: false };
  }

  const enemyDamageDealt = randInt(rng, enemyDmgMin, enemyDmgMax);
  const playerDied = playerHp - enemyDamageDealt <= 0;
  return { playerDamageDealt, enemyDamageDealt, enemyDied: false, playerDied };
}
