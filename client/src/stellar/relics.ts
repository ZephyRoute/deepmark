import { RELIC_ASSETS, RELIC_ISSUER, RELIC_UNIT, STELLAR_CONFIG, type RelicKind } from './config';

export type RelicBalances = Record<RelicKind, number>;

const KINDS: readonly RelicKind[] = ['common', 'rare', 'core'];
const ADDRESS = /^G[A-Z2-7]{55}$/;
const AMOUNT = /^\d{1,15}\.\d{7}$/;

/** Parses a classic amount such as "3.0000000" into whole relics, or null if it is not one. */
function wholeRelics(amount: string): number | null {
  if (!AMOUNT.test(amount)) return null;
  const [whole = '0', fraction = ''] = amount.split('.');
  const stroops = BigInt(whole) * RELIC_UNIT + BigInt(fraction);
  const relics = stroops / RELIC_UNIT;
  return relics > 1_000_000n ? null : Number(relics);
}

interface HorizonBalance {
  asset_code?: unknown;
  asset_issuer?: unknown;
  balance?: unknown;
}

/**
 * The relics a player holds, read from their account's balances. Every field
 * of the response is validated before it is trusted, and an asset only counts
 * if its issuer is ours.
 */
export async function fetchRelicBalances(address: string): Promise<RelicBalances> {
  const empty: RelicBalances = { common: 0, rare: 0, core: 0 };
  if (!ADDRESS.test(address)) return empty;

  const response = await fetch(`${STELLAR_CONFIG.horizonUrl}/accounts/${address}`);
  if (response.status === 404) return empty;
  if (!response.ok) throw new Error(`Balances unavailable (${response.status})`);

  const body = (await response.json()) as { balances?: unknown };
  if (!Array.isArray(body.balances)) return empty;

  const out: RelicBalances = { ...empty };
  for (const entry of body.balances as HorizonBalance[]) {
    if (entry.asset_issuer !== RELIC_ISSUER || typeof entry.balance !== 'string') continue;
    for (const kind of KINDS) {
      if (entry.asset_code === RELIC_ASSETS[kind].code) {
        const relics = wholeRelics(entry.balance);
        if (relics !== null) out[kind] = relics;
      }
    }
  }
  return out;
}
