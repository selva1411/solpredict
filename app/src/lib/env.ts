import { PublicKey } from "@solana/web3.js";

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const ENV = {
  get rpcUrl(): string {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  },
  get programId(): PublicKey {
    const pubkeyStr = process.env.NEXT_PUBLIC_PROGRAM_ID || "DQGcvdEaQRiGdaVJs1vAcujh5csZv4iSr6azjD9DLHqm";
    return new PublicKey(pubkeyStr);
  },
  get pythProgramId(): PublicKey {
    const pubkeyStr = process.env.NEXT_PUBLIC_PYTH_PROGRAM_ID || "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
    return new PublicKey(pubkeyStr);
  }
};
