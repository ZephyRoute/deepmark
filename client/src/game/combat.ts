import { randInt, type Rng } from './rng';

export interface ExchangeResult {
  playerDamageDealt: number;
  enemyDamageDealt: number;
  enemyDied: boolean;
  playerDied: boolean;
}

/**
 * One full round: player strikes first, then the enemy strikes back if it
 * survived. This is the exact resolution the Phase 3 Soroban contract will
 * reproduce deterministically from the same seed, so it stays pure and
 * free of any rendering or DOM concerns.
 */
export function resolveExchange(
  rng: Rng,
  playerHp: number,
  enemyHp: number
): ExchangeResult {
  const playerDamageDealt = randInt(rng, 2, 4);
  const enemyHpAfter = enemyHp - playerDamageDealt;
  const enemyDied = enemyHpAfter <= 0;

  if (enemyDied) {
    return { playerDamageDealt, enemyDamageDealt: 0, enemyDied: true, playerDied: false };
  }

  const enemyDamageDealt = randInt(rng, 1, 3);
  const playerDied = playerHp - enemyDamageDealt <= 0;
  return { playerDamageDealt, enemyDamageDealt, enemyDied: false, playerDied };
}
