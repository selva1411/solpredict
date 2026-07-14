"use client";

const KEY = "solpredict_watchlist_v1";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable — fail silently, watchlist just won't persist
  }
}

export function getWatchlist(): string[] {
  return read();
}

export function isWatched(marketPda: string): boolean {
  return read().includes(marketPda);
}

export function toggleWatch(marketPda: string): boolean {
  const ids = read();
  const idx = ids.indexOf(marketPda);
  if (idx === -1) {
    ids.push(marketPda);
    write(ids);
    window.dispatchEvent(new Event("watchlist-change"));
    return true;
  } else {
    ids.splice(idx, 1);
    write(ids);
    window.dispatchEvent(new Event("watchlist-change"));
    return false;
  }
}
