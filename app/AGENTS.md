<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SolPredict — Dev Guide

## Commands
- `npm run dev` — Start Next.js dev server (port 3000)
- `npm run build && npm start` — Production build + start
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript check (via `tsc --noEmit`)
- `npm test` — Vitest unit tests (Vitest 4, `npx vitest run`)
- `npx vitest run --coverage` — Coverage report
- `npx playwright test` — E2E (Chromium only; needs app running, localnet for on-chain specs)
- `npm run dev:full` — app + WS server + price-alert checker
- `npm run db:push` — `drizzle-kit push` (DB schema is `src/lib/db/schema.ts`)
- `npm run indexer:loop` — run the on-chain indexer worker (fills Postgres caches)

**Verify a UI change in this order:** `npm run typecheck` → `npm run lint` → `npm test` (Vitest, no services needed). Playwright E2E requires the dev server + a seeded localnet.

## Test Files
- `src/lib/format.test.ts`, `errors.test.ts`, `api-response.test.ts`, `market-adapter.test.ts`, `schemas.test.ts`, `admin-guard.test.ts`, `pda.test.ts`, `market-pools.test.ts`, `src/lib/amm/{cpmm,lmsr,lp}.test.ts`, `src/lib/clob/orderbook.test.ts`, `src/lib/api/client.test.ts`, `src/lib/indexer/reducer.test.ts`
- `e2e/` — home, portfolio, market, wallet-flow, airdrop, perf, mobile-audit, etc.

## Redesign boundary (this repo's #1 rule)
The whole point of current work is a full UI/UX redesign. **Presentation only** — JSX, Tailwind classes, component structure, CSS. Everything below stays identical:

- **Preserve (do not touch):** all `src/hooks/*` (useMarket, useMarkets, useUserPositions, useRealtime, usePythPrices, useProgram, useUserRole, …), `src/contexts/AppContext.tsx`, `src/components/WalletContextProvider.tsx`, `src/lib/amm/*`, `src/lib/clob/*`, `src/lib/market-pools.ts`, `src/lib/market-adapter.ts`, `src/lib/pda.ts`, `src/lib/data/*` (DB query layer), `src/lib/db/*`, `src/app/api/**` (API contracts), `src/lib/api/*`, `src/lib/indexer/*`, `src/workers/*`, `server/*` (WS server, price-alert checker), `src/lib/realtime/*`. Root `AGENTS.md` has the full list.
- **Rewrite freely:** `src/app/**/page.tsx`, `src/app/**/*Client.tsx` (e.g. `MarketDetailClient.tsx`, `HomeClient.tsx`, `DiscoverClient.tsx`, `ProfileClient.tsx`), directory components in `src/components/` (Navigation, MobileNav, MarketCard, MarketsDirectory, TradePanel, market/TradingPanel, portfolio, admin, dashboard, ui/*), `src/app/globals.css`.
- Components like `TradingPanel.tsx`, `TradePanel.tsx`, `MarketCard.tsx` receive business state via props from client parents. Keep the props and parent-handler contracts; rewrite JSX/styles. Client pages fetch data via `useQuery` + hooks and API routes — do not bypass or change those.
- Some pages are huge monoliths (e.g. `admin/page.tsx` ~2000 lines, `market/[id]/MarketDetailClient.tsx` ~2100). Splitting them into new presentational components is encouraged — but move only JSX/CSS, not logic.

## Stack & styling quirks
- Next.js 16 App Router, React 19, Tailwind **v4** (CSS-first config: no `tailwind.config.js`). Theme tokens and custom utilities live in `src/app/globals.css` via `@theme`, `@utility`, `@layer` — add new design tokens/utilities there, not in a config file.
- shadcn/ui (style `base-nova`) — component source is committed under `src/components/ui/`; `components.json` aliases `@/components`, `@/lib`, `@/hooks`, `@/lib/utils`. Icons: `lucide-react`. Animation: `framer-motion`. Charts: `recharts`.
- Fonts are currently split across two places — `next/font/google` in `src/app/layout.tsx` (IBM Plex Sans, Share Tech, Space Mono, Orbitron, JetBrains Mono) AND a Google CDN `@import` in `globals.css` that redefines `--font-display` (Instrument Serif) / `--font-sans` (Inter) / `--font-mono` (JetBrains Mono). A redesign should consolidate typography in ONE place; don't assume the layout's font variables are the active ones.
- `next.config.ts` sets a strict CSP (no external images/fonts unless allowed; `connect-src` allows `wss:`/`ws:`). If the redesign adds image hosts or inline resources, update the CSP header too.
- `globals.css` currently carries a legacy compatibility block mapping old tokens (`--surface-0`, `--accent`, `--primary`, …) plus legacy component classes (`.terminal-card`, `.glass-panel`, `.holo-card`, `.btn-royale`, split-flap) used by pages not yet redesigned. If you redesign a page, its legacy classes can be removed; keep the token map until all pages are done.

## Design-system docs
- `design-system/solpredict/MASTER.md` + `pages/{home,market,portfolio,leaderboard,admin}.md` describe the current visual identity ("Mechanical Departure-Board / Solari" with amber `#FFA500`). `app/globals.css` actually implements a newer "Obsidian Royale" gold-on-ink palette (`--color-gold #C9A227`, `--color-ivory #F4F1EA`). The redesign supersedes both — treat these docs as historical reference, not constraints.

## Localnet
- Validator: `http://127.0.0.1:8899` (Solana 4.0.2)
- Program: `AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG` (pubkey of `target/deploy/solpredict-keypair.json`)
- RPC proxy: `http://localhost:3000/api/rpc` → validator
- CLI keypair: `2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS` (admin, 500M+ SOL) — also the on-chain `config.admin` (seed uses it as the admin signer; import it into a wallet to drive the admin UI)
- Dev mode: `useUserRole` and the server `requireAdmin` both grant admin in `development`, so the Admin panel is reachable without a specific wallet; production resolves role from on-chain config ownership
- Ledger at `/tmp/opencode/sol-ledger`; note `getSignaturesForAddress` returns `[]` on the bare test validator, so trades are reconstructed from on-chain `user_position` accounts instead
- Seed: `scripts/seed-localnet.ts` (repo root) → 13 real markets (7 open / 4 settled / 2 cancelled), ~27 trades across 3 buyers; indexer then fills `markets_cache`, `trades`, `positions`, `users`, `user_stats`
- Validator reset recipe: `kill <pid>`, `rm -rf /tmp/opencode/sol-ledger`, start `solana-test-validator --ledger /tmp/opencode/sol-ledger --reset --quiet`, then `anchor deploy` and `npx tsx scripts/seed-localnet.ts`

## Env
- `.env.local` → `NEXT_PUBLIC_CLUSTER=localnet`, `RPC_URL=http://localhost:3000/api/rpc`, `PROGRAM_ID=AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG`
- `DATABASE_URL` points to Neon (pooled); env is validated at boot by `src/lib/env-validate.ts`
