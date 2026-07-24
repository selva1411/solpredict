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
          feeBps: number;
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
        feeBps: number;
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
          bump: number;
        };
      }>>;
    };
    order: {
      all(filters?: Array<{ memcmp: { offset: number; bytes: string } }>): Promise<Array<{
        publicKey: PublicKey;
        account: {
          maker: PublicKey;
          market: PublicKey;
          side: object;
          isBuy: boolean;
          priceBps: anchor.BN;
          quantity: anchor.BN;
          filledQuantity: anchor.BN;
          status: object;
          orderId: anchor.BN;
        };
      }>>;
    };
    marketProposal: {
      all(filters?: Array<{ memcmp: { offset: number; bytes: string } }>): Promise<Array<{
        publicKey: PublicKey;
        account: {
          proposalId: anchor.BN;
          proposer: PublicKey;
          question: string;
          description: string;
          category: number;
          oracleFeedId: number[];
          targetPrice: anchor.BN;
          targetExpo: number;
          comparison: number;
          endTs: anchor.BN;
          resolveTs: anchor.BN;
          sharePriceLamports: anchor.BN;
          bondLamports: anchor.BN;
          status: object;
          createdAt: anchor.BN;
          bump: number;
        };
      }>>;
      fetch(pda: PublicKey): Promise<{
        proposalId: anchor.BN;
        proposer: PublicKey;
        question: string;
        description: string;
        category: number;
        oracleFeedId: number[];
        targetPrice: anchor.BN;
        targetExpo: number;
        comparison: number;
        endTs: anchor.BN;
        resolveTs: anchor.BN;
        sharePriceLamports: anchor.BN;
        bondLamports: anchor.BN;
        status: object;
        createdAt: anchor.BN;
        bump: number;
      }>;
    };
  };
}

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const program = useMemo(() => {
    const provider = new AnchorProvider(
      connection,
      wallet as unknown as Wallet,
      AnchorProvider.defaultOptions()
    );

    const idlCopy = { ...idl, address: ENV.programId.toBase58() };
    const rawProgram = new Program(idlCopy as Idl, provider);

    const parseCategory = (categoryObj: any): number => {
      if (typeof categoryObj === "number") return categoryObj;
      if (!categoryObj) return 4;
      if (categoryObj.crypto !== undefined) return 0;
      if (categoryObj.sports !== undefined) return 1;
      if (categoryObj.politics !== undefined) return 2;
      if (categoryObj.tech !== undefined) return 3;
      if (categoryObj.other !== undefined) return 4;
      if (categoryObj.Crypto !== undefined) return 0;
      if (categoryObj.Sports !== undefined) return 1;
      if (categoryObj.Politics !== undefined) return 2;
      if (categoryObj.Tech !== undefined) return 3;
      if (categoryObj.Other !== undefined) return 4;
      return 4;
    };

    const parseComparison = (comparisonObj: any): number => {
      if (typeof comparisonObj === "number") return comparisonObj;
      if (!comparisonObj) return 0;
      if (comparisonObj.greaterThan !== undefined) return 0;
      if (comparisonObj.lessThan !== undefined) return 1;
      if (comparisonObj.GreaterThan !== undefined) return 0;
      if (comparisonObj.LessThan !== undefined) return 1;
      return 0;
    };

    const wrapMarketAccount = (marketAccount: any) => {
      if (!marketAccount) return marketAccount;
      return {
        ...marketAccount,
        category: parseCategory(marketAccount.category),
        comparison: parseComparison(marketAccount.comparison)
      };
    };

    const originalMarket = (rawProgram.account as any).market;
    const wrappedMarket = new Proxy(originalMarket, {
      get(target: any, prop: string | symbol) {
        if (prop === "fetch") {
          return async (address: any, ...args: any[]) => {
            const res = await target.fetch(address, ...args);
            return wrapMarketAccount(res);
          };
        }
        if (prop === "all") {
          return async (...args: any[]) => {
            const res = await target.all(...args);
            return res.map((item: any) => ({
              ...item,
              account: wrapMarketAccount(item.account)
            }));
          };
        }
        const val = target[prop];
        return typeof val === "function" ? val.bind(target) : val;
      }
    });

    const wrappedProgram = new Proxy(rawProgram, {
      get(target: any, prop: string | symbol) {
        if (prop === "account") {
          return new Proxy(target.account, {
            get(accountTarget: any, accountProp: string | symbol) {
              if (accountProp === "market") {
                return wrappedMarket;
              }
              const val = accountTarget[accountProp];
              return typeof val === "function" ? val.bind(accountTarget) : val;
            }
          });
        }
        const val = target[prop];
        return typeof val === "function" ? val.bind(target) : val;
      }
    });

    return wrappedProgram as unknown as SolPredictProgram;
  }, [connection, wallet]);

  return { program, connection, wallet };
}