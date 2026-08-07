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

export function usePlatformStats() {
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
  });
}
