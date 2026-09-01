/**
 * Dev-mode authentication bypass gate.
 *
 * The localnet admin/user flows intentionally skip proof-of-ownership so a
 * browser wallet adapter isn't required (the seed runs the wallet as a CLI
 * keypair). Relying on `NODE_ENV === "development"` alone is a foot-gun: a
 * dev build deployed to a server would silently disable ALL auth.
 *
 * The bypass now requires BOTH:
 *   - `NODE_ENV === "development"`, AND
 *   - an explicit `DEV_AUTH_ENABLED === "1"` opt-in
 *     (set in .env.local and scripts/start-stack.sh for the localnet stack).
 *
 * Any other combination (production, or a dev build without the flag) enforces
 * real signature/session authentication.
 */
export function isDevAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_ENABLED === "1"
  );
}
