/**
 * PAS (Prediction Accuracy Score) — a 0–100 score derived from REAL data.
 *
 * There is no formally documented PAS formula in the repo, so instead of
 * fabricating a constant (the old `pasScore: 50` for every user) we score the
 * user's actual prediction accuracy: their resolved-market win rate expressed
 * as a percentage. When a user has no settled markets the win rate is unknown
 * and the score is `null` (UIs render "—").
 *
 * winRatePct is 0–100 (or null when there are no settled markets).
 */
export function computePasScore(winRatePct: number | null): number | null {
  if (winRatePct === null) return null;
  const clamped = Math.max(0, Math.min(100, winRatePct));
  return Math.round(clamped);
}

/** Convenience wrapper around wins/losses counts (used by leaderboards). */
export function computePasScoreFromRecord(
  wins: number,
  losses: number,
  marketsResolved?: number,
): number | null {
  const settled = marketsResolved ?? wins + losses;
  if (settled <= 0) return null;
  return computePasScore((wins / settled) * 100);
}