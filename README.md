# SOLPredict — Decentralized Prediction Market on Solana

A Polymarket-style prediction market built on Solana Devnet.
Users buy YES/NO SPL-token positions on real-world questions
(e.g. "Will SOL close above $250 on Dec 31 2026?"), the market
is settled by a Pyth oracle price, and winners claim a pro-rata
payout from the treasury.

## Quick Links
- Full spec: see `/docs`
- Build order: `/docs/build-plan/00-phased-execution.md`
- Kickoff prompt for AI agent: `PROMPT.md`

## Stack
Solana Devnet · Rust · Anchor 0.30+ · Pyth Pull Oracle ·
SPL Token · Next.js 14 · TypeScript · Tailwind ·
React Three Fiber · Framer Motion · GSAP

## Status
See `/docs/build-plan/00-phased-execution.md` for current phase.

## Setup
See `/docs/ops/02-deployment-runbook.md`.