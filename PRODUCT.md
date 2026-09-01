# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyday retail bettors — Polymarket-style audience. Casual traders who browse
sports, politics, crypto and tech questions on mobile and desktop. Most are
new to on-chain trading; the interface must make a YES/NO wager legible in
seconds without explaining Solana mechanics. A minority are returning power
users who trade frequently and value speed and precision.

## Product Purpose

SOLPredict is a Solana prediction market where users buy and sell YES/NO
SPL-token positions on real-world questions. Markets are priced by a
constant-product AMM, resolved by a Pyth oracle (or manual admin settlement for
non-price events), and winners claim a pro-rata payout from the treasury. The
whole flow — pricing, settlement, payout — runs on-chain with no order book and
no discretion. Success = a retail user can discover a market, understand the
odds, place a wager, and later claim a payout without friction or confusion.

## Positioning

A prediction market where the mechanism itself is the guarantee: CPMM pricing
moves with real liquidity, Pyth oracle resolution removes human discretion, and
payouts are wired on-chain. "Conviction, priced" — every question is a live,
tradeable position with no counterparty beyond the pool.

## Operating Context

- Web app (Next.js 16 App Router, React 19, Tailwind v4 CSS-first).
- Wallet-first: users connect a Solana wallet (Phantom etc.), sign transactions.
- Trading surfaces: markets directory (browse/filter/search), market detail
  (chart, order book, trade panel), portfolio (positions + LP), leaderboard,
  activity, watchlist, create/propose, rewards, docs, admin console.
- On-chain state via Anchor program `AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG`;
  Postgres (Neon) caches markets/trades/positions for fast page loads.
- Redesign constraint (hard boundary): presentation only — JSX, Tailwind
  classes, component structure, CSS. Business hooks, API contracts, DB layer,
  indexer/workers, and the Anchor program must stay identical.

## Capabilities and Constraints

- Buy/sell YES/NO shares at AMM-derived prices; limit orders; LP deposits.
- Oracle (Pyth) settlement for crypto/tech/other; manual for sports/politics.
- Claims/refunds after settlement; emergency pause; guardian multisig.
- Categories: Crypto, Sports, Politics, Tech, Other.
- Redesign must preserve all functionality, props, handlers, and data flow.
- NO changes to `programs/**`, root `tests/**`, `app/src/hooks/*`,
  `app/src/lib/{amm,clob,data,db,api,indexer,realtime}/*`, API routes, workers,
  `server/*`, auth, or scripts.

## Brand Commitments

- Name: **SOLPredict** (not "Project X", not "PREDICT-X").
- Existing voice: "Conviction, priced" — confident, precise, a little theatrical.
- No explicit visual identity is binding; the current "Obsidian Royale"
  gold-on-ink theme and the older "Departure-Board" docs are both superseded by
  a full redesign. Existing fonts/colors are not commitments.

## Evidence on Hand

- 13 seeded markets on localnet (7 open / 4 settled / 2 cancelled), ~27 trades.
- Live screenshots captured at `/tmp/opencode/{home,markets,market}.png`.
- Current tokens/implementation in `app/src/app/globals.css`; component
  inventory in `app/src/components/` and `app/src/app/**`.
- Full e2e + unit test suites green (12 e2e specs, 294 unit tests).

## Product Principles

1. **A wager is legible in seconds** — odds, cost, and outcome must be
   graspable without reading help.
2. **The mechanism is the trust** — show real pools, real prices, on-chain
   settlement; never fake data or empty theater.
3. **Accessible energy** — retail-friendly and confident; dense where it
   serves the trader, calm where it serves the newcomer.
4. **One coherent world** — every page shares one material, type, and color
   language; no per-page one-offs.
5. **Fast is a feature** — instant first paint from DB caches; no client
   round-trips blocking content.

## Accessibility & Inclusion

- Keyboard-accessible navigation and trade flows; visible focus states.
- High-contrast text on all surfaces; YES/NO states distinguishable beyond
  color alone (icons/position, not just green/red).
- Legible type sizes for a general (not power-user) audience.
- No reliance on hover-only affordances (touch-primary).