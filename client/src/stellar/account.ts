import { Keypair } from '@stellar/stellar-sdk';
import { STELLAR_CONFIG } from './config';

const STORAGE_KEY = 'deepmark:stellar-secret:v1';

let cached: Promise<Keypair> | null = null;

async function fundOnTestnet(publicKey: string): Promise<void> {
  const response = await fetch(`${STELLAR_CONFIG.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`);
  // Friendbot answers 400 when the account already exists and is funded;
  // that is success from our point of view, not a failure to surface.
  if (!response.ok && response.status !== 400) {
    throw new Error(`Friendbot funding failed with status ${response.status}`);
  }
}

/**
 * The player's non-custodial Stellar testnet identity: an Ed25519 keypair
 * generated once on this device and kept in localStorage. Nobody but this
 * browser ever sees the secret key, and the player never has to see a seed
 * phrase, a wallet extension prompt, or the word "wallet" at all.
 *
 * This stands in for Cavos's passkey-based onboarding, which needs an app ID
 * issued from Cavos's own dashboard, not available in this session. Swapping
 * Cavos in later only means replacing this one file; nothing else in the
 * client depends on how the keypair was obtained.
 */
export function getPlayerKeypair(): Promise<Keypair> {
  if (!cached) {
    cached = (async () => {
      const existingSecret = localStorage.getItem(STORAGE_KEY);
      const keypair = existingSecret ? Keypair.fromSecret(existingSecret) : Keypair.random();
      if (!existingSecret) localStorage.setItem(STORAGE_KEY, keypair.secret());

      try {
        await fundOnTestnet(keypair.publicKey());
      } catch (err) {
        console.warn('Deepmark: testnet funding attempt failed', err);
      }

      return keypair;
    })();
  }
  return cached;
}
