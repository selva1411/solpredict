/**
 * Unified React Query / SWR key namespace per spec §2.4.
 *
 * Every page (Home, /markets, /discover, /market/[id], /dashboard, /portfolio,
 * /profile/[wallet], /rewards, /leaderboard, /admin) MUST read from these shared keys.
 * No page may compute or shadow its own server data in local state.
 */

export interface MarketFilters {
  category?: string;
  status?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export const keys = {
  markets: (filters: MarketFilters = {}) => ["markets", filters] as const,
  market: (id: string) => ["market", id] as const,
  userStats: (wallet: string) => ["user-stats", wallet] as const,
  positions: (wallet: string) => ["positions", wallet] as const,
  rewards: (wallet: string) => ["rewards", wallet] as const,
  treasury: () => ["treasury"] as const,
  proposals: (status?: string) => ["proposals", status ?? "all"] as const,
  disputes: (status?: string) => ["disputes", status ?? "all"] as const,
  platformConfig: () => ["platform-config"] as const,
  leaderboard: (period?: string) => ["leaderboard", period ?? "all"] as const,
};

export const defaultQueryOptions = {
  revalidateOnFocus: true,
  dedupingInterval: 2000,
  staleTime: 5000,
};
