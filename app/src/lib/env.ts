import { PublicKey, Cluster } from "@solana/web3.js";
import { logger } from "@/lib/logger";

type ClusterName = "mainnet-beta" | "devnet" | "testnet" | "localnet";

function requiredEnv(name: string, fallback = ""): string {
  const v = process.env[name] ?? fallback;
  if (!v && typeof window !== "undefined") {
    logger.warn(`[ENV] Missing ${name}; using empty fallback`);
  }
  return v;
}

export const ENV = {
  get rpcUrl(): string {
    return process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "http://localhost:3000/api/rpc";
  },

  get heliusApiKey(): string {
    if (typeof window !== "undefined") {
      throw new Error("HELIUS_API_KEY is server-only");
    }
    return process.env.HELIUS_API_KEY ?? "";
  },

  get heliusGrpcUrl(): string {
    if (typeof window !== "undefined") {
      throw new Error("HELIUS_GRPC_URL is server-only");
    }
    return process.env.HELIUS_GRPC_URL ?? "";
  },

  get programId(): PublicKey {
    const id = process.env.NEXT_PUBLIC_PROGRAM_ID
      ?? "3fwu7iEUNxQEmEX1B1Dq4hzvqYNuDMECQEd2yzNdjAYx";
    return new PublicKey(id);
  },

  get pythProgramId(): PublicKey {
    const id = process.env.NEXT_PUBLIC_PYTH_PROGRAM_ID
      ?? "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
    return new PublicKey(id);
  },

  get pythHermesUrl(): string {
    return process.env.NEXT_PUBLIC_PYTH_HERMES_URL ?? "https://hermes.pyth.network";
  },

  get cluster(): Cluster {
    const c = (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") as ClusterName;
    if (c === "localnet") return "devnet";
    return c as Cluster;
  },

  get isProd(): boolean {
    return this.cluster === "mainnet-beta";
  },

  get usdcMint(): PublicKey {
    const mints: Record<ClusterName, string> = {
      "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "devnet":       "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      "testnet":      "Gh9ZwEmdLJ8D1K7q4tYq2uZ4u8J5j5j5j5j5j5j5j5j",
      "localnet":     "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    };
    return new PublicKey(mints[this.cluster === "mainnet-beta" ? "mainnet-beta" : "devnet"]);
  },
};