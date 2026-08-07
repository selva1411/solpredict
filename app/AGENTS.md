<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SolPredict — Dev Guide

## Commands
- `npm run dev` — Start Next.js dev server (port 3000)
- `npm run build && npm start` — Production build + start
- `npx vitest run` — Run unit tests (Vitest 4.1.10)
- `npx vitest run --coverage` — Run with coverage report
- `npx vitest --ui` — Vitest UI mode
- `npx playwright test` — Run e2e tests (Chromium only)
- `npx next lint` — Lint check
- `npm run typecheck` — TypeScript check (via tsc)

## Test Files
- `src/lib/format.test.ts` — Format utilities (45+ tests)
- `src/lib/errors.test.ts` — Error helpers (14 tests)
- `src/lib/api-response.test.ts` — API response helpers (14 tests)
- `src/lib/market-adapter.test.ts` — Market adapter (40 tests)
- `e2e/home.spec.ts` — Home, health, markets, leaderboard pages

## Localnet
- Validator: `http://127.0.0.1:8899` (Solana 4.0.2)
- Program: `BUQ2gf7NDyoTc1AVRcDN6eZnuX8nG4e77chmPkCByP8v` (pubkey of `target/deploy/solpredict-keypair.json`)
- RPC proxy: `http://localhost:3000/api/rpc` → validator
- CLI keypair: `2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS` (admin, 500M+ SOL) — also the on-chain `config.admin` (seed uses it as the admin signer; import it into a wallet to drive the admin UI)
- Dev mode: `useUserRole` and the server `requireAdmin` both grant admin in `development`, so the Admin panel is reachable without a specific wallet; production resolves role from on-chain config ownership
- Ledger at `/tmp/opencode/sol-ledger`; note `getSignaturesForAddress` returns `[]` on the bare test validator, so trades are reconstructed from on-chain `user_position` accounts instead
- Seed: `scripts/seed-localnet.ts` (repo root) → 13 real markets (7 open / 4 settled / 2 cancelled), ~27 trades across 3 buyers; indexer then fills `markets_cache`, `trades`, `positions`, `users`, `user_stats`
- Validator reset recipe: `kill <pid>`, `rm -rf /tmp/opencode/sol-ledger`, start `solana-test-validator --ledger /tmp/opencode/sol-ledger --reset --quiet`, then `anchor deploy` and `npx tsx scripts/seed-localnet.ts`

## Env
- `.env.local` → `NEXT_PUBLIC_CLUSTER=localnet`, `RPC_URL=http://localhost:3000/api/rpc`, `PROGRAM_ID=BXHBts76C2bwRCGuEB2n8nrUeQ5hfHvyHcQSrJQkvzig`
- `DATABASE_URL` points to Neon (pooled)
