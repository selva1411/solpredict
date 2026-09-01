# SOLPredict — repo guide

Solana prediction market (Polymarket-style): users connect a wallet and buy/sell YES/NO SPL-token positions on real-world events, priced by CPMM, settled by a Pyth oracle, winners claim a pro-rata payout from the treasury.

## Repo map

- `programs/solpredict/` — Anchor (Rust) on-chain program. **Never touch for UI work.**
- `app/` — Next.js 16 frontend, API routes, Drizzle/Postgres layer, indexer + background workers, WebSocket server. All UI work happens here → read `app/AGENTS.md`.
- `tests/` — Anchor integration tests (`tests/solpredict.ts`) + unit tests (`tests/unit/`), run with ts-mocha from the root.
- `scripts/` — root ops: `seed-localnet.ts`, `keeper.ts`, `simulate-traders.ts`, `sync-program-id.ts`, `start-stack.sh`.
- `design-system/solpredict/` — design spec docs (`MASTER.md` + per-page override files under `pages/`). These describe the current visual identity; a full UI redesign supersedes them.
- `migrations/deploy.ts` — on-chain deploy; `app/drizzle/migrations/` — DB migrations.
- `opencode.json` — enables the remote `stitch` MCP (UI design tool).

## Hard boundary for UI/UX redesigns

Functionality and data flow must stay identical; only the presentation layer (JSX, Tailwind classes, component structure, CSS) may be rewritten. Do NOT modify:

- `programs/**`, root `tests/**`, `Cargo.*`, `Anchor.toml`
- Wallet connection / transaction signing: `app/src/components/WalletContextProvider.tsx`, `app/src/hooks/useProgram.ts`, `app/src/hooks/useUserRole.ts`
- Business hooks: `app/src/hooks/*` (useMarket, useMarkets, useUserPositions, useRealtime, usePythPrices, …)
- Pricing/liquidity math: `app/src/lib/amm/*` (cpmm, lmsr, lp), `app/src/lib/clob/*`, `app/src/lib/market-pools.ts`, `app/src/lib/market-adapter.ts`, `app/src/lib/pda.ts`
- Database: `app/src/lib/db/schema.ts` (Drizzle schema), `app/src/lib/data/*` (DB query layer), `app/src/lib/db/*`, `app/drizzle/`
- API contracts: `app/src/app/api/**` route handlers, `app/src/lib/api/*`, `app/src/lib/api-response.ts`
- Data pipelines / realtime: `app/src/lib/indexer/*`, `app/src/workers/*`, `app/server/*` (WS server, price-alert checker), `app/src/lib/realtime/*`, `app/src/lib/pubsub.ts`
- Auth/admin permissions: `app/src/lib/auth.ts`, `admin-guard.ts`, `user-guard.ts`
- Root `scripts/*` and existing env variables

Presentation-only, safe to fully rewrite: `app/src/app/**/page.tsx`, the `*Client.tsx` / directory components in `app/src/components/`, `app/src/components/ui/*`, and `app/src/app/globals.css`. Components like `TradePanel.tsx`, `market/TradingPanel.tsx`, `MarketCard.tsx` mix UI with props-threaded business state — rewrite the JSX/styles, keep the props and parent-handler contracts.

## Commands (root)

- `npm run dev` — frontend dev server (forwards to `app`)
- `npm run dev:full` — app + WebSocket server + price-alert checker
- `npm run test` — unit tests (ts-mocha); `npm run test:anchor` — Anchor integration test
- `npm run build` — `anchor build` + sync program ID into app
- `npm run start:local` — full localnet reset (validator → deploy → seed)
- `npm run lint` — prettier check (root); **eslint lives in `app`**

Frontend dev/build/lint/typecheck/vitest/playwright all run inside `app/` — see `app/AGENTS.md`.
