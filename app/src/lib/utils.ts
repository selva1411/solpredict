import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize a trade-quantity input into a safe, non-negative integer.
 *
 * Surfaces malformed input (NaN, Infinity, non-integer decimals, negatives)
 * into a finite integer ≥ 0, and optionally caps it at `max` shares. This
 * prevents `new anchor.BN(...)` from throwing on bad input and clamps
 * infeasible quantities before they reach the RPC.
 *
 * @returns 0 when the input is invalid/empty — callers treat 0 as "cannot trade".
 */
export function clampQuantity(raw: number | string | null | undefined, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  const floored = Math.floor(n);
  if (floored < 0) return 0;
  return Math.min(floored, Math.max(0, Math.floor(max)));
}
