import { logger } from "@/lib/logger";
import { userFetch, signUserProof, type UserSigner } from "@/lib/user-client";

export type WatchlistSigner = UserSigner;

export function getWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("solpredict-watchlist");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export async function fetchWatchlistFromDb(walletPubkey: string, signer?: UserSigner): Promise<string[]> {
  if (!walletPubkey) return getWatchlist();
  try {
    // Prove ownership of the wallet before reading its watchlist.
    const auth = signer ? await signUserProof(signer, signer.signMessage) : null;
    const headers: Record<string, string> = {};
    if (auth) {
      headers["x-wallet"] = auth.wallet;
      headers["x-message"] = auth.message;
      headers["x-signature"] = auth.signature;
    }
    const res = await userFetch(`/api/watchlist?wallet=${walletPubkey}`, { headers });
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

export function toggleWatchlist(key: string, walletPubkey?: string, signer?: UserSigner): string[] {
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

    // Sync directly with NeonDB (fire-and-forget). Attach the ownership proof
    // so the server can verify this wallet is really the one toggling.
    if (walletPubkey) {
      void (async () => {
        const auth = signer ? await signUserProof(signer, signer.signMessage) : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (auth) {
          headers["x-wallet"] = auth.wallet;
          headers["x-message"] = auth.message;
          headers["x-signature"] = auth.signature;
        }
        userFetch("/api/watchlist", {
          method: "POST",
          headers,
          body: JSON.stringify({ wallet: walletPubkey, marketPubkey: key }),
        }).catch((err) => logger.warn("Watchlist DB sync warning:", err));
      })();
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