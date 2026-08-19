import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, Idl, Wallet, BorshCoder } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { ENV } from "@/lib/env";
import idl from "@/lib/idl/solpredict.json";

export interface InstructionBuilder {
  accounts(accounts: Record<string, unknown>): InstructionBuilder;
  remainingAccounts(accounts: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>): InstructionBuilder;
  rpc(opts?: { skipPreflight?: boolean }): Promise<string>;
  transaction(): Promise<Transaction>;
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

    const rawAccount = rawProgram.account as object;
    const originalMarket = (rawAccount as Record<string, unknown>).market as object;
    const wrappedMarket = new Proxy(originalMarket, {
      get(target: object, prop: string | symbol) {
        const t = target as Record<string, unknown>;
        if (prop === "fetch") {
          return async (address: PublicKey, ...args: unknown[]) => {
            // Anchor's AccountClient.fetch internally calls this.fetchNullableAndContext;
            // it MUST be bound to the client or `this` is undefined and it crashes.
            const fetchFn = (t.fetch as (address: PublicKey, ...args: unknown[]) => Promise<object>).bind(t);
            return wrapMarketAccount(await fetchFn(address, ...args));
          };
        }
        if (prop === "all") {
          return async (...args: unknown[]) => {
            const allFn = (t.all as (...args: unknown[]) => Promise<Array<Record<string, unknown>>>).bind(t);
            const res = await allFn(...args);
            return res.map((item: Record<string, unknown>) => ({
              ...item,
              account: wrapMarketAccount(item.account)
            }));
          };
        }
        const val = t[prop as string];
        return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(target) : val;
      }
    });

    const wrappedProgram = new Proxy(rawProgram, {
      get(target: object, prop: string | symbol) {
        const t = target as Record<string, unknown>;
        if (prop === "account") {
          const targetAccount = t.account as object;
          return new Proxy(targetAccount, {
            get(accountTarget: object, accountProp: string | symbol) {
              const at = accountTarget as Record<string, unknown>;
              if (accountProp === "market") return wrappedMarket;
              const val = at[accountProp as string];
              return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(accountTarget) : val;
            }
          });
        }
        const val = t[prop as string];
        return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(target) : val;
      }
    });

    return wrappedProgram as unknown as SolPredictProgram;
    // Memoize on the wallet's identity (pubkey + connection state) rather than
    // the wallet adapter object itself: most adapters return a new object
    // reference on every render, which previously forced the entire program
    // (provider + proxies) to be rebuilt constantly, causing UI flicker and
    // redundant RPC connections.
  }, [connection, wallet.publicKey?.toBase58(), wallet.connected]);

  return { program, connection, wallet };
}