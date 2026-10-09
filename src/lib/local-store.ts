import { useSyncExternalStore } from "react";

/**
 * Tiny browser-storage store for Phase 1 demo data. The server snapshot is the
 * seed, so SSR/hydration stays consistent; the client then switches to saved data.
 * Replace with backend reads when the real API exists.
 */
export function createLocalStore<T>(key: string, seed: () => T) {
  const event = `resqfood:${key}`;
  let cachedRaw: string | null | undefined;
  let cached: T | undefined;
  let serverValue: T | undefined;

  const getServer = () => (serverValue ??= seed());
  const get = (): T => {
    if (typeof window === "undefined") return getServer();
    let raw: string | null = null;
    try { raw = localStorage.getItem(key); } catch { /* storage unavailable */ }
    if (raw === cachedRaw && cached !== undefined) return cached;
    cachedRaw = raw;
    try { cached = raw ? (JSON.parse(raw) as T) : seed(); } catch { cached = seed(); }
    return cached;
  };
  const set = (next: T | ((prev: T) => T)) => {
    const value = typeof next === "function" ? (next as (prev: T) => T)(get()) : next;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota or private mode */ }
    cachedRaw = undefined;
    window.dispatchEvent(new Event(event));
  };
  const reset = () => { try { localStorage.removeItem(key); } catch { /* ignore */ } cachedRaw = undefined; window.dispatchEvent(new Event(event)); };
  const subscribe = (cb: () => void) => {
    window.addEventListener(event, cb);
    window.addEventListener("storage", cb);
    return () => { window.removeEventListener(event, cb); window.removeEventListener("storage", cb); };
  };
  const useStore = () => useSyncExternalStore(subscribe, get, getServer);
  return { get, set, reset, useStore };
}
