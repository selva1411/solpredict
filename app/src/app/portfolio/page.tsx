"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import { 
  FolderOpen, 
  Wallet, 
  Coins, 
  CheckCircle, 
  Gift, 
  TrendingUp, 
  ShieldAlert 
} from "lucide-react";
import * as anchor from "@coral-xyz/anchor";

interface PositionWithMarket {
  publicKey: PublicKey;
  account: {
    owner: PublicKey;
    market: PublicKey;
    yesAmount: anchor.BN;
    noAmount: anchor.BN;
    claimed: boolean;
    totalSpentLamports: anchor.BN;
  };
  marketAccount: {
    marketId: anchor.BN;
    question: string;
    description: string;
    category: number;
    status: any;
    winningOutcome: any;
    yesMint: PublicKey;
    noMint: PublicKey;
    yesPoolLamports: anchor.BN;
    noPoolLamports: anchor.BN;
    yesSupply: anchor.BN;
    noSupply: anchor.BN;
    totalPayoutPool: anchor.BN;
    sharePriceLamports: anchor.BN;
  };
}

function PortfolioPage() {
  const { program, wallet, connection } = useProgram();
  const [positions, setPositions] = useState<PositionWithMarket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchPortfolio = async () => {
    if (!wallet || !wallet.publicKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch all position accounts belonging to this user
      const allPositions = await program.account.userPosition.all([
        {
          memcmp: {
            offset: 8, // Offset 8 after discriminator
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ]);

      const positionData: PositionWithMarket[] = [];

      for (const pos of allPositions) {
        try {
          // Fetch corresponding market details
          const marketAccount = await program.account.market.fetch(pos.account.market);
          positionData.push({
            publicKey: pos.publicKey,
            account: pos.account as any,
            marketAccount: marketAccount as any,
          });
        } catch (err) {
          console.error("Error fetching market for position:", pos.publicKey.toBase58(), err);
        }
      }

      setPositions(positionData);
    } catch (err: any) {
      console.error("Error fetching portfolio:", err);
      toast.error(`Failed to load portfolio: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [wallet, program]);

  // Settle outcomes parsing
  const getStatusString = (status: any): "Open" | "Settled" | "Cancelled" => {
    if (status.open) return "Open";
    if (status.settled) return "Settled";
    if (status.cancelled) return "Cancelled";
    return "Open";
  };

  // Claim Rewards implementation
  const handleClaimRewards = async (pos: PositionWithMarket) => {
    if (!wallet || !wallet.publicKey) return;
    try {
      setClaimingId(pos.publicKey.toBase58());
      
      const winningOutcome = pos.marketAccount.winningOutcome;
      let winningMint: PublicKey;
      
      if (winningOutcome.yes) {
        winningMint = pos.marketAccount.yesMint;
      } else if (winningOutcome.no) {
        winningMint = pos.marketAccount.noMint;
      } else {
        toast.error("Winning outcome is unset.");
        return;
      }

      const claimerAta = getAssociatedTokenAddressSync(winningMint, wallet.publicKey);

      const tx = await program.methods
        .claimRewards()
        .accounts({
          claimer: wallet.publicKey,
          market: pos.account.market,
          treasury: PublicKey.findProgramAddressSync([Buffer.from("treasury"), pos.account.market.toBuffer()], program.programId)[0],
          winningMint: winningMint,
          claimerAta: claimerAta,
          userPosition: pos.publicKey,
        } as any)
        .rpc();

      toast.success("Rewards claimed successfully!");
      fetchPortfolio();
    } catch (err: any) {
      console.error("Error claiming rewards:", err);
      toast.error(`Failed to claim rewards: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setClaimingId(null);
    }
  };

  // Claim Refund implementation
  const handleClaimRefund = async (pos: PositionWithMarket) => {
    if (!wallet || !wallet.publicKey) return;
    try {
      setClaimingId(pos.publicKey.toBase58());

      const claimerYesAta = getAssociatedTokenAddressSync(pos.marketAccount.yesMint, wallet.publicKey);
      const claimerNoAta = getAssociatedTokenAddressSync(pos.marketAccount.noMint, wallet.publicKey);

      const tx = await program.methods
        .claimRefund()
        .accounts({
          claimer: wallet.publicKey,
          market: pos.account.market,
          treasury: PublicKey.findProgramAddressSync([Buffer.from("treasury"), pos.account.market.toBuffer()], program.programId)[0],
          yesMint: pos.marketAccount.yesMint,
          noMint: pos.marketAccount.noMint,
          claimerYesAta: claimerYesAta,
          claimerNoAta: claimerNoAta,
          userPosition: pos.publicKey,
        } as any)
        .rpc();

      toast.success("Refund processed successfully!");
      fetchPortfolio();
    } catch (err: any) {
      console.error("Error claiming refund:", err);
      toast.error(`Failed to claim refund: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setClaimingId(null);
    }
  };

  // Calculate statistics
  const portfolioStats = (() => {
    let totalInvested = 0;
    let activePositionsCount = 0;

    positions.forEach((p) => {
      totalInvested += p.account.totalSpentLamports.toNumber();
      if (!p.account.claimed) {
        activePositionsCount++;
      }
    });

    return {
      invested: (totalInvested / 1e9).toFixed(2),
      count: activePositionsCount
    };
  })();

  if (!wallet || !wallet.publicKey) {
    return (
      <div className="glass-panel py-20 text-center space-y-6 max-w-xl mx-auto my-12">
        <div className="mx-auto w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-text-muted">
          <Wallet className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-display text-text-primary">Wallet Not Connected</h2>
          <p className="text-text-muted text-sm max-w-sm mx-auto">
            Connect your Phantom wallet or any supported wallet to view your active predictions, claims, and refunds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="border-b border-white/5 pb-4">
        <h1 className="text-3xl font-extrabold font-display bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
          My Predictions Portfolio
        </h1>
        <p className="text-text-muted text-sm">Track your open positions, settle claims, and request refunds.</p>
      </div>

      {/* Portfolio Overview */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-text-muted">Total Spent</div>
            <div className="text-2xl font-mono font-bold">{portfolioStats.invested} SOL</div>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-text-muted">Active Predictions</div>
            <div className="text-2xl font-mono font-bold">{portfolioStats.count}</div>
          </div>
        </div>
      </section>

      {/* Positions List */}
      {loading ? (
        <section className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="glass-panel p-6 h-40 skeleton-shimmer" />
          ))}
        </section>
      ) : positions.length === 0 ? (
        <div className="glass-panel py-20 text-center text-text-muted flex flex-col items-center justify-center space-y-4">
          <FolderOpen className="w-12 h-12 opacity-50" />
          <div>
            <h3 className="text-lg font-bold text-text-primary">No Positions Found</h3>
            <p className="text-xs">You haven't bought shares in any prediction markets yet.</p>
          </div>
        </div>
      ) : (
        <section className="space-y-6">
          {positions.map((pos) => {
            const status = getStatusString(pos.marketAccount.status);
            const spentSol = pos.account.totalSpentLamports.toNumber() / 1e9;
            const yesShares = pos.account.yesAmount.toNumber() / 1e6;
            const noShares = pos.account.noAmount.toNumber() / 1e6;
            
            // Settle details
            const isSettled = status === "Settled";
            const isCancelled = status === "Cancelled";
            
            const winningOutcome = pos.marketAccount.winningOutcome;
            const userWon = isSettled && (
              (winningOutcome.yes && yesShares > 0) || 
              (winningOutcome.no && noShares > 0)
            );
            const userLost = isSettled && !userWon;

            return (
              <div key={pos.publicKey.toBase58()} className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                {/* Left Side: Market Details */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-white/5 border border-white/8 text-violet-400">
                      Market ID #{pos.marketAccount.marketId?.toString()}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${
                      status === "Open" ? "bg-[#10E58C]" : isSettled ? "bg-text-muted" : "bg-[#FF4D6D]"
                    }`}></span>
                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                      {status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold font-display text-text-primary">
                    {pos.marketAccount.question}
                  </h3>
                  <div className="flex items-center space-x-6 text-xs text-text-muted font-mono">
                    <div>Bought: <span className="text-[#10E58C] font-semibold">{yesShares} YES</span> / <span className="text-[#FF4D6D] font-semibold">{noShares} NO</span></div>
                    <div>Spent: <span className="text-text-primary font-semibold">{spentSol.toFixed(2)} SOL</span></div>
                  </div>
                </div>

                {/* Right Side: Action Trigger Panels */}
                <div className="flex items-center justify-end">
                  {pos.account.claimed ? (
                    <div className="flex items-center space-x-2 bg-[#10E58C]/10 border border-[#10E58C]/20 px-4 py-2.5 rounded-xl text-[#10E58C]">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-xs font-semibold">Claimed & Finalized</span>
                    </div>
                  ) : isCancelled ? (
                    <button
                      disabled={claimingId !== null}
                      onClick={() => handleClaimRefund(pos)}
                      className="btn-primary py-2.5 px-6 flex items-center space-x-2 text-xs"
                    >
                      {claimingId === pos.publicKey.toBase58() ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <ShieldAlert className="w-4 h-4" />
                      )}
                      <span>Claim Full Refund</span>
                    </button>
                  ) : isSettled ? (
                    userWon ? (
                      <button
                        disabled={claimingId !== null}
                        onClick={() => handleClaimRewards(pos)}
                        className="btn-primary py-2.5 px-6 flex items-center space-x-2 text-xs"
                      >
                        {claimingId === pos.publicKey.toBase58() ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <Gift className="w-4 h-4" />
                        )}
                        <span>Claim Winning Payout</span>
                      </button>
                    ) : (
                      <div className="px-4 py-2 border border-white/10 rounded-xl text-text-muted text-xs font-semibold">
                        Unsuccessful Prediction
                      </div>
                    )
                  ) : (
                    <div className="px-4 py-2 border border-[#10E58C]/20 bg-[#10E58C]/5 rounded-xl text-[#10E58C] text-xs font-semibold">
                      Prediction Open (Trading Active)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

const Portfolio = dynamic(() => Promise.resolve(PortfolioPage), { ssr: false });
export default Portfolio;
