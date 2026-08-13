import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/api/keys";

export interface PlatformStats {
  totalMarkets: number;
  openMarkets: number;
  settledMarkets: number;
  totalVolume: string;
  totalLiquidity: string;
  totalTraders: number;
  volume24h: string;
}

interface StatsResponse {
  ok: boolean;
  stats: PlatformStats;
}

export function usePlatformStats(initialStats?: PlatformStats | null) {
  return useQuery({
    queryKey: keys.markets.stats,
    queryFn: async (): Promise<PlatformStats> => {
      const res = await fetch("/api/markets/stats");
      if (!res.ok) {
        throw new Error(`Failed to load platform stats (HTTP ${res.status})`);
      }
      const data = (await res.json()) as StatsResponse;
      if (!data.ok || !data.stats) {
        throw new Error("Failed to load platform stats");
      }
      return data.stats;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    // Server-rendered stats render immediately (no first-load flash). React
    // Query still refetches on the interval, so numbers stay fresh.
    initialData: initialStats ?? undefined,
    // Mark the prefetched value as fresh from mount time. Without this, React
    // Query treats `initialData` as dataUpdatedAt:0 → immediately stale → fires
    // a background refetch that can resolve BEFORE hydration finishes, changing
    // the rendered number and producing a React hydration-mismatch error on the
    // stat tiles ("server rendered text didn't match the client").
    initialDataUpdatedAt: () => Date.now(),
  });
}
