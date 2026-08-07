"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Zap, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BN } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "@/hooks/useProgram";
import type { UiMarket } from "@/lib/market-adapter";
import { getBuyAmountOut, getSellAmountOut, getSpotPriceYes, getSpotPriceNo } from "@/lib/amm/cpmm";

interface TradePanelProps {
  market: UiMarket;
  onTrade?: (side: "YES" | "NO", amount: number, type: "amm" | "limit") => void;
}

// Amount in SOL → shares out, using the on-chain constant-product engine.
function calculateAmmOutput(amountIn: number, side: "YES" | "NO", poolYesLamports: number, poolNoLamports: number, feeBps: number): number {
  if (amountIn <= 0) return 0;
  const dxIn = BigInt(Math.round(amountIn * 1e9));
  const poolYes = BigInt(poolYesLamports);
  const poolNo = BigInt(poolNoLamports);
  try {
    const out = side === "YES"
      ? getBuyAmountOut(poolYes, poolNo, dxIn, feeBps)
      : getBuyAmountOut(poolNo, poolYes, dxIn, feeBps);
    return Number(out) / 1e9;
  } catch {
    return 0;
  }
}

function calculatePriceImpact(amountIn: number, side: "YES" | "NO", poolYesLamports: number, poolNoLamports: number, feeBps: number): number {
  if (amountIn <= 0) return 0;
  const poolYes = BigInt(poolYesLamports);
  const poolNo = BigInt(poolNoLamports);
  const spot = side === "YES"
    ? getSpotPriceYes(poolYes, poolNo, feeBps)
    : getSpotPriceNo(poolYes, poolNo, feeBps);
  if (spot === 0n) return 0;
  const spotPerShareSol = Number(spot) / 1e12;
  const out = calculateAmmOutput(amountIn, side, poolYesLamports, poolNoLamports, feeBps);
  if (out <= 0) return 0;
  const avgPerShareSol = amountIn / out;
  return ((avgPerShareSol - spotPerShareSol) / spotPerShareSol) * 100;
}

export function TradePanel({ market, onTrade }: TradePanelProps) {
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState<string>("");
  const [limitPrice, setLimitPrice] = useState<string>(side === "YES" ? market.yesPrice.toFixed(2) : market.noPrice.toFixed(2));
  const [submitting, setSubmitting] = useState(false);
  const { publicKey } = useWallet();
  const { program } = useProgram();

  const numAmount = parseFloat(amount) || 0;
  const poolYesLamports = Math.round((market.yesPool ?? 0) * 1e9);
  const poolNoLamports = Math.round((market.noPool ?? 0) * 1e9);
  const feeBps = 300;
  const spotYes = getSpotPriceYes(BigInt(poolYesLamports), BigInt(poolNoLamports), feeBps);
  const currentPrice = side === "YES"
    ? spotYes === 0n ? market.yesPrice : Number(spotYes) / 1e12
    : spotYes === 0n ? market.noPrice : 1 - Number(spotYes) / 1e12;
  const sharesOut = calculateAmmOutput(numAmount, side, poolYesLamports, poolNoLamports, feeBps);
  const priceImpact = calculatePriceImpact(numAmount, side, poolYesLamports, poolNoLamports, feeBps);
  const avgPrice = numAmount > 0 && sharesOut > 0 ? numAmount / sharesOut : 0;
  const potentialPayout = sharesOut;
  const potentialProfit = potentialPayout - numAmount;

  const handleSubmit = async (type: "amm" | "limit") => {
    if (numAmount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    if (numAmount > 100000) {
      toast.error("Amount too large");
      return;
    }
    setSubmitting(true);
    try {
      if (!program || !publicKey) {
        toast.error("Connect your wallet first");
        return;
      }
      const quantityLamports = new BN(Math.round(numAmount * 1e9));
      const sideEnum = side === "YES" ? { yes: {} } : { no: {} };
      const txSig = await program.methods
        .buyShares(sideEnum, quantityLamports)
        .accounts({ buyer: publicKey })
        .rpc();
      toast.success(`${type === "amm" ? "AMM buy" : "Limit order"}: ${sharesOut.toFixed(2)} ${side} shares for ${numAmount.toFixed(2)} SOL`, {
        description: `TX: ${txSig.slice(0, 8)}...${txSig.slice(-6)}`,
      });
      onTrade?.(side, numAmount, type);
      setAmount("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      toast.error(`Trade failed: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="holo-card p-5">
      <div className="grid grid-cols-2 gap-2 mb-4 relative z-10">
        <button
          onClick={() => {
            setSide("YES");
            setLimitPrice(market.yesPrice.toFixed(2));
          }}
          className={`py-2.5 rounded-xl font-mono font-bold text-sm transition-all ${
            side === "YES"
              ? "bg-[#F5A524] text-[#0A0C14] shadow-[0_0_24px_-4px_#F5A524]"
              : "bg-white/5 text-[#F5A524] border border-[#F5A524]/25 hover:bg-[#F5A524]/10"
          }`}
        >
          BUY YES · ${market.yesPrice.toFixed(2)}
        </button>
        <button
          onClick={() => {
            setSide("NO");
            setLimitPrice(market.noPrice.toFixed(2));
          }}
          className={`py-2.5 rounded-xl font-mono font-bold text-sm transition-all ${
            side === "NO"
              ? "bg-[#E4574A] text-white shadow-[0_0_24px_-4px_#E4574A]"
              : "bg-white/5 text-[#E4574A] border border-[#E4574A]/20 hover:bg-[#E4574A]/10"
          }`}
        >
          BUY NO · ${market.noPrice.toFixed(2)}
        </button>
      </div>

      <Tabs defaultValue="amm" className="relative z-10">
        <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/5 h-9">
          <TabsTrigger value="amm" className="text-xs data-[state=active]:bg-[#F5A524] data-[state=active]:text-[#0A0C14] data-[state=active]:font-bold">
            <Zap size={12} className="mr-1.5" /> Instant
          </TabsTrigger>
          <TabsTrigger value="limit" className="text-xs data-[state=active]:bg-[#F5A524] data-[state=active]:text-[#0A0C14] data-[state=active]:font-bold">
            <ArrowUpDown size={12} className="mr-1.5" /> Limit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="amm" className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] text-[#808495] font-mono uppercase tracking-wider mb-1.5 block">
              Amount (SOL)
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/5 border-white/10 text-[#F4F4F9] font-mono text-base h-12 focus:border-[#F5A524]"
            />
            <div className="flex gap-1.5 mt-2">
              {[10, 50, 100, 500].map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(String(q))}
                  className="flex-1 py-1.5 text-[11px] font-mono text-[#808495] bg-white/5 rounded-md hover:bg-white/10 hover:text-[#F4F4F9] transition-colors"
                >
                  ${q}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {numAmount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2"
              >
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#808495]">Shares out</span>
                  <span className="text-[#F4F4F9] font-semibold">{sharesOut.toFixed(2)} {side}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#808495]">Avg price</span>
                  <span className="text-[#F4F4F9] font-semibold">${avgPrice.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#808495]">Price impact</span>
                  <span className={priceImpact > 5 ? "text-[#E4574A]" : "text-[#4CAF50]"}>
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
                <div className="h-px bg-white/5 my-2" />
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#808495]">If {side} wins</span>
                  <span className="text-[#4CAF50] font-semibold">+${potentialProfit.toFixed(2)}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={() => handleSubmit("amm")}
            disabled={submitting || numAmount <= 0}
            className={`w-full h-12 font-mono font-bold text-sm rounded-xl transition-all ${
              side === "YES"
                ? "bg-[#F5A524] text-[#0A0C14] hover:bg-[#F5A524]/90 shadow-[0_0_24px_-4px_#F5A524]"
                : "bg-[#E4574A] text-white hover:bg-[#E4574A]/90 shadow-[0_0_24px_-4px_#E4574A]"
            }`}
          >
            {submitting ? "Submitting..." : `Buy ${side} · $${(numAmount || 0).toFixed(2)}`}
          </Button>
          <p className="text-[10px] text-[#808495] text-center font-mono">
            {(feeBps / 100).toFixed(2)}% fee · Settles in SOL · Pyth oracle resolution
          </p>
        </TabsContent>

        <TabsContent value="limit" className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] text-[#808495] font-mono uppercase tracking-wider mb-1.5 block">
              Limit Price ($ per share)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="0.99"
              placeholder={currentPrice.toFixed(2)}
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="bg-white/5 border-white/10 text-[#F4F4F9] font-mono text-base h-12 focus:border-[#F5A524]"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#808495] font-mono uppercase tracking-wider mb-1.5 block">
              Amount (SOL)
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/5 border-white/10 text-[#F4F4F9] font-mono text-base h-12 focus:border-[#F5A524]"
            />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#808495]">Shares requested</span>
              <span className="text-[#F4F4F9] font-semibold">
                {(numAmount / (parseFloat(limitPrice) || currentPrice)).toFixed(2)} {side}
              </span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#808495]">Expires in</span>
              <span className="text-[#F4F4F9] font-semibold">7 days</span>
            </div>
          </div>
          <Button
            onClick={() => handleSubmit("limit")}
            disabled={submitting || numAmount <= 0}
            className={`w-full h-12 font-mono font-bold text-sm rounded-xl transition-all ${
              side === "YES"
                ? "bg-[#F5A524] text-[#0A0C14] hover:bg-[#F5A524]/90"
                : "bg-[#E4574A] text-white hover:bg-[#E4574A]/90"
            }`}
          >
            {submitting ? "Placing..." : `Place ${side} Order @ $${parseFloat(limitPrice || "0").toFixed(2)}`}
          </Button>
          <p className="text-[10px] text-[#808495] text-center font-mono">
            Order enters the CLOB · Matched by keeper bot · Auto-cancel on expiry
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}