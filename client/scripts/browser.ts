/** Shared headless Chrome setup for the measurement scripts (perf, a11y). */
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 1 } as const;

/** Hosts the game talks to. Blocking them forces the offline practice run. */
export const STELLAR_HOSTS: readonly string[] = ['soroban-testnet.stellar.org', 'horizon-testnet.stellar.org', 'friendbot.stellar.org'];

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? DEFAULT_CHROME,
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--window-size=${VIEWPORT.width},${VIEWPORT.height}`],
    defaultViewport: VIEWPORT,
  });
}

/** Aborts every request to a Stellar host so the game runs fully offline. */
export async function blockStellar(page: Page): Promise<void> {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (STELLAR_HOSTS.includes(new URL(req.url()).host)) void req.abort();
    else void req.continue();
  });
}
