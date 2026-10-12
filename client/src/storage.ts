/**
 * The only place that touches `localStorage` for optional, per-browser state.
 * Storage can be missing or throw (private mode, blocked site data, quota), and
 * none of the callers may crash the game because of it, so every access returns
 * a value that says what happened instead of throwing. Callers that must not
 * lose data silently (account secrets) do not use this module.
 */

/** Reads a raw string, or null when the key is absent or storage is unavailable. */
export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a raw string. Returns false when it could not be persisted. */
export function writeItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Removes a key. Returns false when storage is unavailable. */
export function removeItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Reads and parses JSON. Missing, unparsable or unavailable all give null. The caller validates the shape. */
export function readJson(key: string): unknown {
  const raw = readItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Serializes and writes JSON. Returns false when it could not be persisted. */
export function writeJson(key: string, value: unknown): boolean {
  return writeItem(key, JSON.stringify(value));
}
