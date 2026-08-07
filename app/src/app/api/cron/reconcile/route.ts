export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, type Idl } from "@coral-xyz/anchor";
import { getDb } from "@/lib/db/client";
import { reconcileMarkets, reconcileTrades } from "@/lib/indexer/reconciler";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import type { Solpredict } from "@/lib/idl/solpredict";
import rawIdl from "@/lib/idl/solpredict.json";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "BXHBts76C2bwRCGuEB2n8nrUeQ5hfHvyHcQSrJQkvzig";

export const GET = apiHandler(async (req: NextRequest) => {
  if (!getDb()) return serverError("Database not available");

  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const dummyKeypair = Keypair.generate();
    const dummyWallet = {
      publicKey: dummyKeypair.publicKey,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    const provider = new AnchorProvider(
      connection,
      dummyWallet as any,
      { commitment: "confirmed" },
    );
    const idl = { ...rawIdl, address: PROGRAM_ID };
    const program = new Program(idl as Idl, provider) as unknown as Program<Solpredict>;

    const marketsCount = await reconcileMarkets({ connection, program, limit: 500 });
    const tradesRes = await reconcileTrades({ connection, program, limit: 20 });

    return ok({
      ok: true,
      reconciledMarkets: marketsCount,
      reconciledTrades: tradesRes.trades,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return serverError(err);
  }
});
