"use client";
import { useMarkets } from "@/hooks/useMarkets";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchWatchlistFromDb, getWatchlist, pruneWatchlist } from "@/lib/watchlist";
import { signUserProof, userFetch } from "@/lib/user-client";
import { formatSol, calcYesPct, calcNoPct, timeUntil, categoryName, outcomeLabel } from "@/lib/format";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

export default function WatchlistClient({ initialMarkets }: { initialMarkets: MarketCacheEntry[] }) {
  // Seed from server-prefetched rows so the SSR HTML shows the market cards
  // instantly; the background poll still enriches with on-chain data. All
  // statuses are loaded because a watched market may have since settled or
  // been cancelled — it must still render here.
  const { markets, loading } = useMarkets(10_000, initialMarkets, { status: "all" });
  const { publicKey, signMessage } = useWallet();
  const [watchlistKeys, setWatchlistKeys] = useState<string[]>([]);

  useEffect(() => {
    if (publicKey) {
      fetchWatchlistFromDb(publicKey.toBase58(), { publicKey, signMessage }).then(keys => setWatchlistKeys(keys));
    } else {
      setWatchlistKeys(getWatchlist());
    }
  }, [publicKey, signMessage]);

  // Self-heal: drop stale watchlist keys (markets that no longer exist on-chain
  // — e.g. old pubkeys from a previous program deploy) from the local list so
  // they can't be clicked into a dead board. The known list now includes ALL
  // statuses, so a watchlisted settled/cancelled market is never pruned — only
  // genuinely dead keys are. Any dead keys are also deleted from the DB copy so
  // they don't reappear the next time this wallet connects.
  useEffect(() => {
    if (loading || markets.length === 0) return;
    // Watchlist keys may be stored as either the market pubkey OR the numeric
    // marketId (see watchedMarkets filter below) — keep both forms valid.
    const validKeys = new Set<string>();
    for (const m of markets) {
      validKeys.add(m.publicKey.toBase58());
      validKeys.add(String(m.account.marketId));
    }
    const pruned = pruneWatchlist(validKeys);
    if (pruned.length !== watchlistKeys.length) {
      setWatchlistKeys(pruned);
      // Remove dead keys from the DB copy too (only when a wallet is connected)
      // so they don't reappear on the next connect. DELETE (not POST, which is
      // a toggle) is used so a stale key is never re-added.
      if (publicKey) {
        const dead = watchlistKeys.filter((k) => !pruned.includes(k));
        for (const key of dead) {
          void (async () => {
            const auth = await signUserProof({ publicKey, signMessage }, signMessage);
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (auth) {
              headers["x-wallet"] = auth.wallet;
              headers["x-message"] = auth.message;
              headers["x-signature"] = auth.signature;
            }
            await userFetch("/api/watchlist", {
              method: "DELETE",
              headers,
              body: JSON.stringify({ wallet: publicKey.toBase58(), marketPubkey: key }),
            }).catch(() => {});
          })();
        }
      }
    }
    // watchlistKeys is a dependency: the DB keys load async (after markets), so
    // the prune must re-run once they arrive. It converges — when pruned equals
    // the current list no state change is made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, markets.length, publicKey, watchlistKeys]);

  const watchedMarkets = markets.filter((m) =>
    watchlistKeys.includes(m.publicKey.toBase58()) ||
    watchlistKeys.includes(String(m.account.marketId))
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2 text-ivory flex items-center gap-2">
          <Star className="w-6 h-6 text-gold" />
          Watchlist
        </h1>
        <p className="text-[13px] text-ash">
          {watchedMarkets.length} tracked market{watchedMarkets.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[13px] text-ash">Loading watchlist...</div>
      ) : watchedMarkets.length === 0 ? (
        <div className="holo-card p-12 text-center space-y-4">
          <Star className="w-12 h-12 text-ash mx-auto" />
          <p className="text-ash">Star markets to track them here</p>
          <Link href="/markets"
            className="btn-royale inline-flex text-[13px]">
            Browse Markets
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {watchedMarkets.map((m) => (
            <Link key={m.publicKey.toBase58()} href={`/market/${m.publicKey.toBase58()}`} className="block group">
              <div className="holo-card p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-panel-2 text-ash">
                    {categoryName(m.account.category)}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    m.account.status === 0 ? "bg-verdigris/10 text-verdigris" : m.account.status === 1 ? "bg-gold/10 text-gold" : "bg-bordeaux/10 text-bordeaux"
                  }`}>
                    {m.account.status === 0 ? "Open" : m.account.status === 1 ? "Settled" : "Cancelled"}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-ivory group-hover:text-gold transition-colors leading-snug line-clamp-2">
                  {m.account.question}
                </p>
                <div className="relative h-1.5 w-full bg-bordeaux/15 rounded-[2px] overflow-hidden">
                  <div className="absolute left-0 top-0 h-full bg-verdigris rounded-[2px] transition-all duration-500"
                    style={{ width: `${calcYesPct(m.account.yesPoolLamports, m.account.noPoolLamports)}%` }} />
                </div>
                <div className="flex justify-between text-xs font-mono text-ash">
                  <span>YES <span className="text-verdigris font-bold">{calcYesPct(m.account.yesPoolLamports, m.account.noPoolLamports)}%</span></span>
                  <span>NO <span className="text-bordeaux font-bold">{calcNoPct(m.account.yesPoolLamports, m.account.noPoolLamports)}%</span></span>
                </div>
                <div className="flex justify-between text-xs font-mono text-ash border-t border-hairline pt-3">
                  <span>Vol: {formatSol(m.account.yesPoolLamports + m.account.noPoolLamports)} SOL</span>
                  <span className="text-gold">
                    {m.account.status === 0 && timeUntil(m.account.endTs)}
                    {m.account.status === 1 && outcomeLabel(m.account.winningOutcome)}
                    {m.account.status === 2 && "Cancelled"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
