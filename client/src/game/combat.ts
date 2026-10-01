import { randInt, type Rng } from './rng';

export interface ExchangeResult {
  playerDamageDealt: number;
  enemyDamageDealt: number;
  enemyDied: boolean;
  playerDied: boolean;
}

/**
 * One full round: the player strikes first, then the enemy strikes back if it
 * survived. Damage ranges come from the chosen delver and the enemy archetype.
 * The function stays pure so the same seed and the same ranges always resolve
 * the same exchange.
 */
export function resolveExchange(
  rng: Rng,
  playerHp: number,
  enemyHp: number,
  enemyDmgMin: number,
  enemyDmgMax: number,
  playerDmgMin: number,
  playerDmgMax: number
): ExchangeResult {
  const playerDamageDealt = randInt(rng, playerDmgMin, playerDmgMax);
  const enemyHpAfter = enemyHp - playerDamageDealt;
  const enemyDied = enemyHpAfter <= 0;

  if (enemyDied) {
    return { playerDamageDealt, enemyDamageDealt: 0, enemyDied: true, playerDied: false };
  }

  const enemyDamageDealt = randInt(rng, enemyDmgMin, enemyDmgMax);
  const playerDied = playerHp - enemyDamageDealt <= 0;
  return { playerDamageDealt, enemyDamageDealt, enemyDied: false, playerDied };
}
