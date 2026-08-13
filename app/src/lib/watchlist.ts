import { logger } from "@/lib/logger";

export function getWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("solpredict-watchlist");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export async function fetchWatchlistFromDb(walletPubkey: string): Promise<string[]> {
  if (!walletPubkey) return getWatchlist();
  try {
    const res = await fetch(`/api/watchlist?wallet=${walletPubkey}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.keys)) {
      if (typeof window !== "undefined") {
        localStorage.setItem("solpredict-watchlist", JSON.stringify(data.keys));
      }
      return data.keys;
    }
  } catch (e) {
    logger.warn("Failed to fetch watchlist from DB:", e);
  }
  return getWatchlist();
}

export function toggleWatchlist(key: string, walletPubkey?: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getWatchlist();
    const set = new Set(current);
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
    const next = Array.from(set);
    localStorage.setItem("solpredict-watchlist", JSON.stringify(next));

    // Sync directly with NeonDB
    if (walletPubkey) {
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletPubkey, marketPubkey: key }),
      }).catch((err) => logger.warn("Watchlist DB sync warning:", err));
    }

    return next;
  } catch {
    return [];
  }
}

export function isWatchlisted(key: string): boolean {
  return getWatchlist().includes(key);
}

/**
 * Remove stale market pubkeys from the local watchlist (e.g. markets that were
 * re-deployed under a new program ID, so the old pubkey no longer exists).
 * Returns the pruned list. `validKeys` is the set of pubkeys that still exist.
 * The DB copy is left alone — the caller may also post the removals via
 * toggleWatchlist per key, but the localStorage is the source of stale links
 * that users click into.
 */
export function pruneWatchlist(validKeys: string[] | Set<string>): string[] {
  if (typeof window === "undefined") return [];
  try {
    const valid = new Set(validKeys);
    const current = getWatchlist();
    const next = current.filter((k) => valid.has(k));
    if (next.length !== current.length) {
      localStorage.setItem("solpredict-watchlist", JSON.stringify(next));
    }
    return next;
  } catch {
    return getWatchlist();
  }
}
