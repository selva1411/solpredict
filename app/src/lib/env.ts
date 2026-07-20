import { PublicKey } from "@solana/web3.js";

export const ENV = {
  get rpcUrl(): string {
    return process.env.NEXT_PUBLIC_RPC_URL
      ?? "https://devnet.helius-rpc.com/?api-key=8a85d3a7-d21b-47d3-8345-b9705f666ce7";
  },
  get programId(): PublicKey {
    const pubkeyStr = process.env.NEXT_PUBLIC_PROGRAM_ID || "FNLixfQFTWZNFd9YuPk4c6VwcUs4nC2Z7FzhJkhHL9eD";
    return new PublicKey(pubkeyStr);
  },
  get pythProgramId(): PublicKey {
    const pubkeyStr = process.env.NEXT_PUBLIC_PYTH_PROGRAM_ID || "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
    return new PublicKey(pubkeyStr);
  },
  get cluster(): "devnet" | "mainnet-beta" | "testnet" {
    return "devnet";
  },
};
