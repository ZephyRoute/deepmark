/** An in-memory stand-in for `localStorage`, so storage code runs under `bun test`. */
export function installMemoryStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => void store.set(key, value),
    removeItem: (key: string): void => void store.delete(key),
  };
  return store;
}
