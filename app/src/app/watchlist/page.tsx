"use client";
import { useMarkets } from "@/hooks/useMarkets";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchWatchlistFromDb, getWatchlist } from "@/lib/watchlist";
import { formatSol, calcYesPct, calcNoPct, timeUntil, categoryName, outcomeLabel } from "@/lib/format";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Star } from "lucide-react";

export default function WatchlistPage() {
  const { markets, loading } = useMarkets();
  const { publicKey } = useWallet();
  const [watchlistKeys, setWatchlistKeys] = useState<string[]>([]);

  useEffect(() => {
    if (publicKey) {
      fetchWatchlistFromDb(publicKey.toBase58()).then(keys => setWatchlistKeys(keys));
    } else {
      setWatchlistKeys(getWatchlist());
    }
  }, [publicKey]);

  const watchedMarkets = markets.filter((m) =>
    watchlistKeys.includes(m.publicKey.toBase58()) ||
    watchlistKeys.includes(String(m.account.marketId))
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2 text-[#F4F4F9] flex items-center gap-2">
          <Star className="w-6 h-6 text-[#FFA500]" />
          Watchlist
        </h1>
        <p className="text-sm text-[#808495]">
          {watchedMarkets.length} tracked market{watchedMarkets.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm text-[#808495]">Loading watchlist...</div>
      ) : watchedMarkets.length === 0 ? (
        <div className="holo-card p-12 text-center space-y-4">
          <Star className="w-12 h-12 text-[#808495] mx-auto" />
          <p className="text-[#808495]">Star markets to track them here</p>
          <Link href="/markets"
            className="btn-glow inline-flex text-sm">
            Browse Markets
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {watchedMarkets.map((m) => (
            <Link key={m.publicKey.toBase58()} href={`/market/${m.publicKey.toBase58()}`} className="block group">
              <div className="holo-card p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-white/5 text-[#808495]">
                    {categoryName(m.account.category)}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    m.account.status === 0 ? "bg-[#4CAF50]/10 text-[#4CAF50]" : m.account.status === 1 ? "bg-[#FFA500]/10 text-[#FFA500]" : "bg-[#E4574A]/10 text-[#E4574A]"
                  }`}>
                    {m.account.status === 0 ? "Open" : m.account.status === 1 ? "Settled" : "Cancelled"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#F4F4F9] group-hover:text-[#FFA500] transition-colors leading-snug line-clamp-2">
                  {m.account.question}
                </p>
                <div className="relative h-1.5 w-full bg-[#E4574A]/15 rounded-full overflow-hidden">
                  <div className="absolute left-0 top-0 h-full bg-[#4CAF50] rounded-full transition-all duration-500"
                    style={{ width: `${calcYesPct(m.account.yesPoolLamports, m.account.noPoolLamports)}%` }} />
                </div>
                <div className="flex justify-between text-xs font-mono text-[#808495]">
                  <span>YES <span className="text-[#4CAF50] font-bold">{calcYesPct(m.account.yesPoolLamports, m.account.noPoolLamports)}%</span></span>
                  <span>NO <span className="text-[#E4574A] font-bold">{calcNoPct(m.account.yesPoolLamports, m.account.noPoolLamports)}%</span></span>
                </div>
                <div className="flex justify-between text-xs font-mono text-[#808495] border-t border-white/5 pt-3">
                  <span>Vol: {formatSol(m.account.yesPoolLamports + m.account.noPoolLamports)} SOL</span>
                  <span className="text-[#FFA500]">
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
