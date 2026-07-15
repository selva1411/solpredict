import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, Idl, Wallet, BorshCoder } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { ENV } from "@/lib/env";
import idl from "@/lib/idl/solpredict.json";

export interface InstructionBuilder {
  accounts(accounts: Record<string, unknown>): InstructionBuilder;
  rpc(): Promise<string>;
}

export interface SolPredictProgram {
  programId: PublicKey;
  rpc: unknown;
  provider: AnchorProvider;
  coder: BorshCoder;
  methods: Record<string, (...args: unknown[]) => InstructionBuilder>;
  account: {
    config: {
      fetch(pda: PublicKey): Promise<{
        admin: PublicKey;
        marketCount: anchor.BN;
        feeBps: number;
        bump: number;
      }>;
    };
    market: {
      all(): Promise<Array<{
        publicKey: PublicKey;
        account: {
          marketId: anchor.BN;
          authority: PublicKey;
          question: string;
          description: string;
          category: number;
          oracleFeedId: number[];
          targetPrice: anchor.BN;
          targetExpo: number;
          comparison: number;
          endTs: anchor.BN;
          resolveTs: anchor.BN;
          status: { open?: Record<string, never>; settled?: Record<string, never>; cancelled?: Record<string, never> };
          winningOutcome: { unset?: Record<string, never>; yes?: Record<string, never>; no?: Record<string, never> };
          yesMint: PublicKey;
          noMint: PublicKey;
          yesPoolLamports: anchor.BN;
          noPoolLamports: anchor.BN;
          yesSupply: anchor.BN;
          noSupply: anchor.BN;
          totalPayoutPool: anchor.BN;
          sharePriceLamports: anchor.BN;
          feeCollected: anchor.BN;
          feeWithdrawn: boolean;
        };
      }>>;
      fetch(pda: PublicKey): Promise<{
        marketId: anchor.BN;
        authority: PublicKey;
        question: string;
        description: string;
        category: number;
        oracleFeedId: number[];
        targetPrice: anchor.BN;
        targetExpo: number;
        comparison: number;
        endTs: anchor.BN;
        resolveTs: anchor.BN;
        status: { open?: Record<string, never>; settled?: Record<string, never>; cancelled?: Record<string, never> };
        winningOutcome: { unset?: Record<string, never>; yes?: Record<string, never>; no?: Record<string, never> };
        yesMint: PublicKey;
        noMint: PublicKey;
        yesPoolLamports: anchor.BN;
        noPoolLamports: anchor.BN;
        yesSupply: anchor.BN;
        noSupply: anchor.BN;
        totalPayoutPool: anchor.BN;
        sharePriceLamports: anchor.BN;
        feeCollected: anchor.BN;
        feeWithdrawn: boolean;
      }>;
    };
    userPosition: {
      all(filters?: Array<{ memcmp: { offset: number; bytes: string } }>): Promise<Array<{
        publicKey: PublicKey;
        account: {
          owner: PublicKey;
          market: PublicKey;
          yesAmount: anchor.BN;
          noAmount: anchor.BN;
          totalSpentLamports: anchor.BN;
          claimed: boolean;
        };
      }>>;
    };
  };
}

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const program = useMemo(() => {
    // If no wallet is connected, construct a read-only provider
    const provider = new AnchorProvider(
      connection,
      wallet as unknown as Wallet,
      AnchorProvider.defaultOptions()
    );

    const idlCopy = { ...idl, address: ENV.programId.toBase58() };
    return new Program(idlCopy as Idl, provider) as unknown as SolPredictProgram;
  }, [connection, wallet]);

  return { program, connection, wallet };
}
