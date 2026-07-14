# Project Overview

## Mission
Build a decentralized prediction market where:
- An Admin creates markets ("Will SOL close above $250 on Dec 31 2026?")
- Users connect Phantom, buy YES/NO SPL-token positions, track
  their portfolio, and claim rewards after settlement via Pyth oracle.
- Runs entirely on Solana Devnet with a public, production-grade
  Next.js frontend featuring a premium 3D UI.

## Non-Goals (explicitly out of scope for MVP)
- Mainnet deployment (Devnet only for this project)
- Real money / real USDC (devnet faucet tokens only)
- AMM/dynamic pricing (MVP uses fixed-price parimutuel — see
  `program/00-design-decisions.md`). AMM is a Phase-2 stretch goal.
- Permissionless market creation (admin-gated for MVP)
- Mobile native app (responsive web only)

## Definition of Done
All items in `build-plan/00-phased-execution.md` Phase 8 acceptance
criteria pass, AND every test in `testing/00-test-matrix.md` is green.

## Golden Rule for the Build Agent
Never skip a phase's acceptance checks to move faster. A broken
Phase 3 compounds into unfixable bugs by Phase 7. Comments-first,
then implementation, for every instruction.