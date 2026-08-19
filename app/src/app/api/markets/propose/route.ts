export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { marketProposals } from "@/lib/db/schema";
import { proposeMarketBodySchema } from "@/lib/api/contracts";
import { ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { PublicKey } from "@solana/web3.js";
import { verifySignature } from "@/lib/auth";
import { verifyProposalSignature } from "@/lib/indexer/onchain";
import { normalizeOracleFeedId } from "@/lib/pyth-feeds";

/**
 * POST /api/markets/propose
 *
 * Records a market proposal in the DB. The proposal is ONLY recorded after:
 *   1. The wallet proves ownership by signing the exact message we present
 *      (x-message / x-signature headers — the body is never trusted for
 *      identity).
 *   2. A confirmed propose_market transaction exists on-chain for that wallet
 *      (submitted as `signature` and verified via RPC). The question, category,
 *      timestamps and proposal pubkey are taken from the parsed transaction —
 *      NOT from the request body.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  // 1. Wallet ownership proof.
  const wallet = req.headers.get("x-wallet")?.trim();
  const message = req.headers.get("x-message");
  const proofSignature = req.headers.get("x-signature");
  if (!wallet || wallet.length < 32) {
    return badRequest("x-wallet header required to propose a market");
  }
  if (!message || !proofSignature) {
    return badRequest("x-message and x-signature headers required to prove wallet ownership");
  }
  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(wallet);
  } catch {
    return badRequest("Invalid wallet address");
  }
  let sigBytes: Uint8Array;
  try {
    sigBytes = Buffer.from(proofSignature, "base64");
  } catch {
    return badRequest("Invalid signature encoding");
  }
  if (!verifySignature(message, sigBytes, pubkey)) {
    return badRequest("Signature verification failed — sign the challenge with the proposing wallet");
  }

  // 2. Basic parameter validation (mirrors the on-chain constraints). The
  // oracle feed ID is normalized BEFORE the schema check: the create form lets
  // users paste a `0x`-prefixed feed (66 chars) or leave "all zeros" for
  // non-oracle markets, while the DB persists the canonical 64-char hex.
  // Rejecting here would strand a confirmed on-chain proposal with no DB row.
  if (typeof body?.oracleFeedId === "string" && body.oracleFeedId.trim() !== "") {
    const normalized = normalizeOracleFeedId(body.oracleFeedId);
    if (!normalized) {
      return badRequest(
        "oracleFeedId must be a 64-character hex string (optionally 0x-prefixed) — e.g. the SOL/USD feed, or 64 zeros for non-oracle markets",
      );
    }
    body.oracleFeedId = normalized;
  } else {
    // Non-oracle markets (or empty input) default to an all-zeros feed.
    body.oracleFeedId = "0".repeat(64);
  }

  const parsed = proposeMarketBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return badRequest(`Validation failed: ${issue.path.join(".")} — ${issue.message}`);
  }
  const { outcomes } = parsed.data;
  if (outcomes && outcomes.length > 0) {
    const uniqueLabels = new Set(outcomes.map((o) => o.trim().toLowerCase()));
    if (uniqueLabels.size !== outcomes.length) {
      return badRequest("Outcome labels must be unique");
    }
  }

  // 3. The on-chain propose_market transaction must be confirmed and verified.
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
  if (!signature) {
    return badRequest(
      "signature (the confirmed propose_market transaction) is required to record a proposal",
    );
  }

  try {
    const verified = await verifyProposalSignature(signature, wallet);
    if (verified.proposer !== wallet) {
      return badRequest("The on-chain proposal was not submitted by this wallet");
    }

    const db = assertDb();
    const [proposal] = await db
      .insert(marketProposals)
      .values({
        proposalPubkey: verified.proposalPubkey,
        proposer: verified.proposer,
        question: verified.question,
        description: verified.description || null,
        category: ["Crypto", "Sports", "Politics", "Tech", "Other"][verified.category] ?? "Crypto",
        oracleFeedId: body?.oracleFeedId ?? null,
        endTs: new Date(verified.endTs * 1000),
        resolveTs: new Date(verified.resolveTs * 1000),
        // MarketProposal::MIN_BOND_LAMPORTS on-chain (0.1 SOL).
        bondLamports: 100_000_000,
        status: "pending",
      })
      .returning();

    return ok({
      ok: true,
      proposal,
      bondLamports: 100_000_000,
      verified: true,
      note: "Proposal recorded from the verified on-chain propose_market transaction",
    }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return ok({ ok: false, error: msg }, { status: 400 } as ResponseInit);
  }
});
