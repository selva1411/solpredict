/**
 * Centralized React Query key factory for SolPredict.
 *
 * Every query in the app keys off these builders so cache busting,
 * invalidation, and shared refetches stay consistent. Invalidate with:
 *   queryClient.invalidateQueries({ queryKey: keys.markets.list() })
 */

export const keys = {
  markets: {
    root: ["markets"] as const,
    list: () => [...keys.markets.root, "list"] as const,
    byCategory: (category: string) => [...keys.markets.list(), { category }] as const,
    byStatus: (status: string) => [...keys.markets.list(), { status }] as const,
    detail: (pubkey: string) => [...keys.markets.root, "detail", pubkey] as const,
    liquidity: (pubkey: string) => [...keys.markets.root, "liquidity", pubkey] as const,
    comments: (pubkey: string) => [...keys.markets.root, "comments", pubkey] as const,
    stats: ["markets", "stats"] as const,
    trending: ["markets", "trending"] as const,
  },
  user: {
    root: ["user"] as const,
    positions: (wallet: string) => [...keys.user.root, "positions", wallet] as const,
    profile: (wallet: string) => [...keys.user.root, "profile", wallet] as const,
    achievements: (wallet: string) => [...keys.user.root, "achievements", wallet] as const,
    notifications: (wallet: string) => [...keys.user.root, "notifications", wallet] as const,
    watchlist: (wallet: string) => [...keys.user.root, "watchlist", wallet] as const,
  },
  leaderboard: {
    root: ["leaderboard"] as const,
    list: (period: string, sortBy: string) => [...keys.leaderboard.root, { period, sortBy }] as const,
  },
  health: ["health"] as const,
} as const;