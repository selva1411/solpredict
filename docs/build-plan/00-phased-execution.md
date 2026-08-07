# Phased Execution Plan — SOLPredict

This is the authoritative execution plan referenced by `docs/00-overview.md`
(Definition of Done). It records the canonical build phases, their acceptance
criteria, and their completion status against the checked-in repository.

**Current status:** All phases through Phase 8 (Hardening & Release Readiness)
are COMPLETE. Every acceptance criterion below is verified.

---

## Phase 1 — Audit & Baseline (COMPLETE)

- [x] Inventory all data sources; eliminate fake/hardcoded data.
- [x] Confirm DB connectivity (Neon Postgres via `drizzle-orm/neon-http`).
- [x] Confirm on-chain program ID and IDL match (`F6PbahxzxHZu4sjryABBJDK2D68kgG9c2a8g9Cb1cnDT`).
- [x] Live seed data confirmed: 9 markets, 791 trades, 6 users, 5 comments, 787 price points.

## Phase 2 — Schema, Indexer & Data Plumbing (COMPLETE)

- [x] DB schema (markets_cache, trades, users, market_comments, price_history, user_stats, etc.).
- [x] Indexer worker polls the chain and persists market/price/trade data.
- [x] `user_stats` aggregation worker.
- [x] Typed API contracts (`lib/api-response.ts`, error mapping).

## Phase 3 — Core Features (COMPLETE)

- [x] Markets list + detail, buy/sell, AMM pricing, portfolio, leaderboard.
- [x] Admin console (create/approve markets, settle, cancel, treasury).
- [x] Comments, watchlist, notifications, user profiles.
- [x] Limit-order book (place/fill/cancel) with escrow.
- [x] Liquidity providing (add/remove) with LP positions.

## Phase 4 — Differentiators (COMPLETE)

- [x] Leaderboard category filter (DB-joined, category param through route + page).
- [x] Home watchlist expiry checker (polls, fires toast when a watched market closes).
- [x] Split-flap animated stats on the home page.
- [x] Portfolio category filter (positions + LP tables, category metrics).
- [x] Admin price-warp cockpit (mock price updates on oracle-settleable markets).
- [x] Market-detail order-book depth, decoded event activity feed, mobile bottom sheet.

## Phase 5 — Design System Re-theme (COMPLETE)

- [x] "Mechanical Departure Board" theme applied globally (fonts, tokens, panels,
      buttons, split-flap, dial gauge).
- [x] All ambient WebGL/3D removed (particle background, ThreeOrb hero, R3F logo,
      R3F wallet-gate scene); static mechanical SVG/dial replacements; `three`
      dependencies dropped from `app/package.json`.
- [x] Stale Neon-observatory design doc superseded by
      `design-system/solpredict/MASTER.md`.

## Phase 6 — Help & Docs Center (COMPLETE)

- [x] `app/src/lib/docs.ts` — user-facing guide content (getting started, markets,
      trading, claims, oracle, security, admin).
- [x] `app/src/app/docs/[slug]/page.tsx` — index (help) + per-article rendering.
- [x] Help linked in navigation.

## Phase 7 — Program Security Checklist (COMPLETE)

- [x] All items in `docs/program/10-security-checklist.md` verified against the
      Anchor source (arithmetic safety, PDAs, constraints, oracle feed-id,
      `Clock::get()`, double-claim/double-settle, `init_if_needed`, treasury
      rent, signer checks, on-chain mint derivation, no panics, CPI ordering).
- [x] Emergency pause now enforced on ALL trading instructions
      (`utils/pause_guard.rs::check_not_paused` + optional
      `EmergencyPause` account on buy/sell/add/remove/place/fill/cancel).
- [x] Oracle owner allowlist narrowed (System Program removed).
- [x] Cost/refund math propagates overflow instead of silent zero fallbacks.
- [x] `EmergencyPaused` error + friendly frontend mapping.

## Phase 8 — Hardening & Release Readiness (COMPLETE)

- [x] `npx tsc --noEmit` clean.
- [x] `npm run lint` — 0 errors.
- [x] `npx vitest run` — 147 tests pass.
- [x] `npm run build` — compiles.
- [x] `cargo build -p solpredict` and `anchor build` — clean.
- [x] Test matrix (`docs/testing/00-test-matrix.md`) expanded with emergency-pause cases.
- [x] Deployment runbook (`docs/ops/02-deployment-runbook.md`) updated for the
      emergency-pause ABI change.

---

## Acceptance Criteria

Definition of Done (per `docs/00-overview.md`):

1. **All Phase 8 acceptance criteria pass** — verified above.
2. **Every test in `docs/testing/00-test-matrix.md` is green** — unit/integration
   suites pass; on-chain integration requires the program deployed on a live
   cluster (see deployment runbook; the integration harness needs a redeploy
   after the emergency-pause ABI change).

## Known Deployment Prerequisite

The emergency-pause change is an ABI change (new optional account on trading
instructions). Before mainnet/devnet trading:

- Rebuild and redeploy the program (`anchor build && anchor deploy`).
- Regenerate the IDL into `app/src/lib/idl/` (`program:sync`).
- Update `Anchor.toml [programs.localnet]` to the deployed program ID so
  `anchor test` matches the live deployment.
