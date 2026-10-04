import { Asset, BASE_FEE, Keypair, Operation, rpc, TransactionBuilder } from '@stellar/stellar-sdk';
import { RELIC_ASSETS, RELIC_ISSUER, STELLAR_CONFIG } from './config';

const STORAGE_KEY = 'deepmark:stellar-secret:v1';
const TRUSTLINE_FLAG_PREFIX = 'deepmark:relic-trustlines:v1:';

const ACCOUNT_POLL_ATTEMPTS = 10;
const TX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 1500;

let cached: Promise<Keypair> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fundOnTestnet(publicKey: string): Promise<void> {
  const response = await fetch(`${STELLAR_CONFIG.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`);
  // Friendbot answers 400 when the account already exists and is funded;
  // that is success from our point of view, not a failure to surface.
  if (!response.ok && response.status !== 400) {
    throw new Error(`Friendbot funding failed with status ${response.status}`);
  }
}

function trustlineFlagKey(publicKey: string): string {
  return `${TRUSTLINE_FLAG_PREFIX}${STELLAR_CONFIG.contractId}:${publicKey}`;
}

function trustlinesAlreadyAdded(publicKey: string): boolean {
  try {
    return localStorage.getItem(trustlineFlagKey(publicKey)) === '1';
  } catch {
    return false;
  }
}

function rememberTrustlines(publicKey: string): void {
  try {
    localStorage.setItem(trustlineFlagKey(publicKey), '1');
  } catch {
    // Without storage the step simply repeats next visit. It is idempotent.
  }
}

/**
 * Lets this account hold the three relic assets. One classic transaction with
 * three trustline operations, sent once per account. Relics are minted by the
 * game contract only if the trustline exists, and the contract never loses a
 * verified run if it does not, so a failure here is not fatal.
 */
async function ensureRelicTrustlines(keypair: Keypair): Promise<void> {
  const publicKey = keypair.publicKey();
  if (trustlinesAlreadyAdded(publicKey)) return;

  const server = new rpc.Server(STELLAR_CONFIG.rpcUrl);
  let account = null;
  for (let attempt = 0; attempt < ACCOUNT_POLL_ATTEMPTS && !account; attempt += 1) {
    try {
      account = await server.getAccount(publicKey);
    } catch {
      await sleep(POLL_INTERVAL_MS);
    }
  }
  if (!account) throw new Error('The account was not visible on the network in time');

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_CONFIG.networkPassphrase,
  });
  for (const relic of Object.values(RELIC_ASSETS)) {
    builder.addOperation(Operation.changeTrust({ asset: new Asset(relic.code, RELIC_ISSUER) }));
  }
  const tx = builder.setTimeout(60).build();
  tx.sign(keypair);

  const sent = await server.sendTransaction(tx);
  if (sent.status === 'ERROR') throw new Error('The trustline transaction was rejected');

  for (let attempt = 0; attempt < TX_POLL_ATTEMPTS; attempt += 1) {
    const result = await server.getTransaction(sent.hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      rememberTrustlines(publicKey);
      return;
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('The trustline transaction failed');
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('The trustline transaction did not settle in time');
}

/**
 * The player's non-custodial Stellar testnet identity: an Ed25519 keypair
 * generated once on this device and kept in localStorage. Nobody but this
 * browser ever sees the secret key, and the player never has to see a seed
 * phrase, a wallet extension prompt, or the word "wallet" at all.
 *
 * Preparing the account (funding and relic trustlines) happens here, before
 * the keypair is handed out, so no later transaction can race it for the
 * account's sequence number.
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
        await ensureRelicTrustlines(keypair);
      } catch (err) {
        console.warn('Deepmark: account preparation did not finish', err);
      }

      return keypair;
    })();
  }
  return cached;
}
