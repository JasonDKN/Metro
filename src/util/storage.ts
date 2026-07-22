// ============================================================================
// Thin, typed wrapper around localStorage. Kept isolated so that if a future
// version of Metro wants to swap in IndexedDB or a sync backend, only this
// file (and data/store.ts) needs to change.
// ============================================================================

export function loadRaw<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Metro: failed to read "${key}" from localStorage`, err);
    return null;
  }
}

export function saveRaw<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Metro: failed to write "${key}" to localStorage`, err);
  }
}
