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

interface TradePanelProps {
  market: UiMarket;
  onTrade?: (side: "YES" | "NO", amount: number, type: "amm" | "limit") => void;
}

function calculateAmmOutput(amountIn: number, pool: number): number {
  const fee = amountIn * 0.003;
  const effectiveIn = amountIn - fee;
  return (effectiveIn * pool) / (pool + effectiveIn);
}

function calculatePriceImpact(amountIn: number, pool: number): number {
  if (amountIn === 0) return 0;
  return (amountIn / (pool + amountIn)) * 100;
}

export function TradePanel({ market, onTrade }: TradePanelProps) {
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState<string>("");
  const [limitPrice, setLimitPrice] = useState<string>(side === "YES" ? market.yesPrice.toFixed(2) : market.noPrice.toFixed(2));
  const [submitting, setSubmitting] = useState(false);
  const { publicKey } = useWallet();
  const { program } = useProgram();

  const numAmount = parseFloat(amount) || 0;
  const pool = side === "YES" ? market.yesPool : market.noPool;
  const currentPrice = side === "YES" ? market.yesPrice : market.noPrice;
  const sharesOut = calculateAmmOutput(numAmount, pool);
  const priceImpact = calculatePriceImpact(numAmount, pool);
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
              ? "bg-[#C8FF00] text-[#050507] shadow-[0_0_24px_-4px_#C8FF00]"
              : "bg-white/5 text-[#C8FF00] border border-[#C8FF00]/20 hover:bg-[#C8FF00]/10"
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
              ? "bg-[#FF4D6D] text-white shadow-[0_0_24px_-4px_#FF4D6D]"
              : "bg-white/5 text-[#FF4D6D] border border-[#FF4D6D]/20 hover:bg-[#FF4D6D]/10"
          }`}
        >
          BUY NO · ${market.noPrice.toFixed(2)}
        </button>
      </div>

      <Tabs defaultValue="amm" className="relative z-10">
        <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/5 h-9">
          <TabsTrigger value="amm" className="text-xs data-[state=active]:bg-[#7B3FE4] data-[state=active]:text-white">
            <Zap size={12} className="mr-1.5" /> Instant
          </TabsTrigger>
          <TabsTrigger value="limit" className="text-xs data-[state=active]:bg-[#7B3FE4] data-[state=active]:text-white">
            <ArrowUpDown size={12} className="mr-1.5" /> Limit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="amm" className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] text-[#A5A8B8] font-mono uppercase tracking-wider mb-1.5 block">
              Amount (SOL)
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/5 border-white/10 text-[#F4F5FA] font-mono text-base h-12 focus:border-[#7B3FE4]"
            />
            <div className="flex gap-1.5 mt-2">
              {[10, 50, 100, 500].map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(String(q))}
                  className="flex-1 py-1.5 text-[11px] font-mono text-[#A5A8B8] bg-white/5 rounded-md hover:bg-white/10 hover:text-[#F4F5FA] transition-colors"
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
                  <span className="text-[#A5A8B8]">Shares out</span>
                  <span className="text-[#F4F5FA] font-semibold">{sharesOut.toFixed(2)} {side}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#A5A8B8]">Avg price</span>
                  <span className="text-[#F4F5FA] font-semibold">${avgPrice.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#A5A8B8]">Price impact</span>
                  <span className={priceImpact > 5 ? "text-[#FF4D6D]" : "text-[#C8FF00]"}>
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
                <div className="h-px bg-white/5 my-2" />
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#A5A8B8]">If {side} wins</span>
                  <span className="text-[#C8FF00] font-semibold">+${potentialProfit.toFixed(2)}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={() => handleSubmit("amm")}
            disabled={submitting || numAmount <= 0}
            className={`w-full h-12 font-mono font-bold text-sm rounded-xl transition-all ${
              side === "YES"
                ? "bg-[#C8FF00] text-[#050507] hover:bg-[#C8FF00]/90 shadow-[0_0_24px_-4px_#C8FF00]"
                : "bg-[#FF4D6D] text-white hover:bg-[#FF4D6D]/90 shadow-[0_0_24px_-4px_#FF4D6D]"
            }`}
          >
            {submitting ? "Submitting..." : `Buy ${side} · $${(numAmount || 0).toFixed(2)}`}
          </Button>
          <p className="text-[10px] text-[#A5A8B8] text-center font-mono">
            0.3% fee · Settles in SOL · Pyth oracle resolution
          </p>
        </TabsContent>

        <TabsContent value="limit" className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] text-[#A5A8B8] font-mono uppercase tracking-wider mb-1.5 block">
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
              className="bg-white/5 border-white/10 text-[#F4F5FA] font-mono text-base h-12 focus:border-[#7B3FE4]"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#A5A8B8] font-mono uppercase tracking-wider mb-1.5 block">
              Amount (SOL)
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/5 border-white/10 text-[#F4F5FA] font-mono text-base h-12 focus:border-[#7B3FE4]"
            />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#A5A8B8]">Shares requested</span>
              <span className="text-[#F4F5FA] font-semibold">
                {(numAmount / (parseFloat(limitPrice) || currentPrice)).toFixed(2)} {side}
              </span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#A5A8B8]">Expires in</span>
              <span className="text-[#F4F5FA] font-semibold">7 days</span>
            </div>
          </div>
          <Button
            onClick={() => handleSubmit("limit")}
            disabled={submitting || numAmount <= 0}
            className={`w-full h-12 font-mono font-bold text-sm rounded-xl transition-all ${
              side === "YES"
                ? "bg-[#C8FF00] text-[#050507] hover:bg-[#C8FF00]/90"
                : "bg-[#FF4D6D] text-white hover:bg-[#FF4D6D]/90"
            }`}
          >
            {submitting ? "Placing..." : `Place ${side} Order @ $${parseFloat(limitPrice || "0").toFixed(2)}`}
          </Button>
          <p className="text-[10px] text-[#A5A8B8] text-center font-mono">
            Order enters the CLOB · Matched by keeper bot · Auto-cancel on expiry
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}