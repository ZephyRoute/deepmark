type Api = typeof import('./api');

/** The chunk also starts account preparation, so it should begin soon after first paint. */
const IDLE_TIMEOUT_MS = 600;
const FALLBACK_DELAY_MS = 250;

let loading: Promise<Api> | null = null;

/** Loads the Stellar SDK chunk the first time it is needed. Later calls reuse it. */
export function chain(): Promise<Api> {
  loading ??= import('./api');
  return loading;
}

/**
 * Starts loading the chunk when the browser is idle, so it is usually ready by
 * the time the player presses Forge, while the title still paints without it.
 */
export function warmChain(onReady?: () => void): void {
  const start = (): void => void chain().then(() => onReady?.());
  if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS });
  else setTimeout(start, FALLBACK_DELAY_MS);
}
