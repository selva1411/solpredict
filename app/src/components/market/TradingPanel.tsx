import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { ENV } from "@/lib/env";

/**
 * TradingPanel — the buy / sell / liquidity panel extracted from MarketDetailClient.
 *
 * Rendered in both the desktop sidebar and the mobile drawer.  All state and
 * handlers remain in the parent; this component is a thin presentational layer
 * that calls back via props.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UserOrder {
  account: {
    side: { yes?: Record<string, never>; no?: Record<string, never> };
    isBuy: boolean;
    priceBps: { toNumber(): number };
    quantity: { toNumber(): number };
    filledQuantity: { toNumber(): number };
  };
}

export interface TradingPanelProps {
  /* Market state */
  status: string;
  marketPdaB58: string;

  /* Computed prices */
  yesProb: number;
  noProb: number;
  yesPool: number;
  noPool: number;
  sharePriceSol: number;
  activeSharePriceSol: number;
  yesSharePriceSol: number;
  noSharePriceSol: number;
  tradeCost: number;
  potentialPayout: number;
  priceImpactPct: number;
  slippageWarning: boolean;
  sellRefundSol: number;
  sellUnavailable: boolean;

  /* LP preview */
  lp: {
    yesAddSol: number;
    noAddSol: number;
    lpTokensMinted: number;
    newYesPoolSol: number;
    newNoPoolSol: number;
  };
  lpTokensMinted: number;
  lpNewYesPoolSol: number;
  lpNewNoPoolSol: number;

  /* User state */
  userYesBalance: number;
  userNoBalance: number;
  userOrders: UserOrder[];
  userLp: {
    lpShares: number;
    deposited: string | number;
    feesEarned: string | number;
  } | null;
  marketLpStats: {
    totalLiquiditySol: string | number | null;
    totalLpTokens: number | null;
    feeEarnedSol: string | number | null;
  } | null;

  /* Trade tab state */
  tradeTab: "buy" | "sell" | "liquidity";
  tradeSide: "YES" | "NO";
  quantity: number;
  sellSide: "YES" | "NO";
  sellQuantity: number;
  isLimitOrder: boolean;
  limitPriceSol: number;
  showAdvanced: boolean;
  lpOption: "balanced" | "yes" | "no";
  lpDepositAmount: number;

  /* Tx state */
  submitting: boolean;
  txState: "idle" | "signing" | "confirming" | "success" | "error";
  txSig: string | null;

  /* Setters */
  setTradeTab: (tab: "buy" | "sell" | "liquidity") => void;
  setTradeSide: (side: "YES" | "NO") => void;
  setQuantity: (q: number) => void;
  setSellSide: (side: "YES" | "NO") => void;
  setSellQuantity: (q: number) => void;
  setIsLimitOrder: (v: boolean) => void;
  setLimitPriceSol: (v: number) => void;
  setShowAdvanced: (v: boolean) => void;
  setLpOption: (opt: "balanced" | "yes" | "no") => void;
  setLpDepositAmount: (v: number) => void;

  /* Callbacks */
  handleBuy: () => void;
  handleSell: () => void;
  handleProvideLiquidity: () => void;
  handlePlaceLimitOrder: (isBuy: boolean) => void;
  handleCancelOrder: (order: UserOrder) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TradingPanel(p: TradingPanelProps) {
  const {
    status,
    marketPdaB58,
    yesProb,
    noProb,
    yesPool,
    noPool,
    sharePriceSol,
    activeSharePriceSol,
    yesSharePriceSol,
    noSharePriceSol,
    tradeCost,
    potentialPayout,
    priceImpactPct,
    slippageWarning,
    sellRefundSol,
    sellUnavailable,
    lp,
    lpTokensMinted,
    lpNewYesPoolSol,
    lpNewNoPoolSol,
    userYesBalance,
    userNoBalance,
    userOrders,
    userLp,
    marketLpStats,
    tradeTab,
    tradeSide,
    quantity,
    sellSide,
    sellQuantity,
    isLimitOrder,
    limitPriceSol,
    showAdvanced,
    lpOption,
    lpDepositAmount,
    submitting,
    txState,
    txSig,
    setTradeTab,
    setTradeSide,
    setQuantity,
    setSellSide,
    setSellQuantity,
    setIsLimitOrder,
    setLimitPriceSol,
    setShowAdvanced,
    setLpOption,
    setLpDepositAmount,
    handleBuy,
    handleSell,
    handleProvideLiquidity,
    handlePlaceLimitOrder,
    handleCancelOrder,
  } = p;

  /* ------- closed-market banner ------- */
  if (status !== "Open") {
    return (
      <div className="p-8 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "var(--color-panel)", border: "1px solid var(--color-hairline)" }}>
          <AlertCircle className="w-6 h-6 text-gold" />
        </div>
        <h4 className="font-display font-semibold text-[18px] text-ivory mb-2">
          {status === "Cancelled"
            ? "Board Cancelled"
            : status === "Ended"
            ? "Trading Ended"
            : "Market Settled"}
        </h4>
        <p className="text-[13px] text-ash leading-relaxed max-w-[34ch] mx-auto">
          {status === "Cancelled" ? (
            "This board was cancelled. Deposited funds are being returned to traders — no action needed."
          ) : status === "Ended" ? (
            "Trading for this board has ended. Oracle resolution is pending."
          ) : (
            <>
              This market has settled. Go to your{" "}
              <Link
                href="/dashboard"
                className="text-gold hover:underline font-bold"
              >
                Dashboard
              </Link>{" "}
              to withdraw payout.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ── Buy / Sell / Liquidity Tabs ── */}
      <div className="grid grid-cols-3 rounded-lg p-1 gap-1" style={{ background: "var(--color-obsidian)", border: "1px solid var(--color-hairline)" }}>
        {(["buy", "sell", "liquidity"] as const).map((tab) => (
          <button
            key={tab}
            data-testid={`tab-${tab}`}
            onClick={() => setTradeTab(tab)}
            className={`rounded-md py-2 text-[12px] font-medium transition-colors cursor-pointer ${
              tradeTab === tab
                ? "bg-panel-2 text-ivory"
                : "text-ash-dim hover:text-ash"
            }`}
          >
            {tab === "liquidity" ? "LP Pool" : tab}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          BUY TAB
         ════════════════════════════════════════════════════════════════ */}
      {tradeTab === "buy" ? (
        <div className="space-y-4 pt-4">
          {/* Position selector — dominant YES/NO cards */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              onClick={() => setTradeSide("YES")}
              className={`flex flex-col items-start justify-between p-5 transition-all cursor-pointer ${
                tradeSide === "YES"
                  ? "trade-side-yes-active"
                  : "trade-side-yes-inactive"
              }`}
              style={{ minHeight: "130px" }}
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-verdigris">
                YES
              </span>
              <span
                className={`font-display font-bold tnum text-[48px] leading-none ${
                  tradeSide === "YES" ? "text-verdigris" : "text-ash"
                }`}
              >
                {yesProb}¢
              </span>
              <span className="font-mono text-[10px] text-ash-dim">
                {yesSharePriceSol.toFixed(4)} SOL · {yesPool.toFixed(2)} pool
              </span>
            </button>

            <button
              onClick={() => setTradeSide("NO")}
              className={`flex flex-col items-start justify-between p-5 transition-all cursor-pointer ${
                tradeSide === "NO"
                  ? "trade-side-no-active"
                  : "trade-side-no-inactive"
              }`}
              style={{ minHeight: "130px" }}
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-bordeaux">
                NO
              </span>
              <span
                className={`font-display font-bold tnum text-[48px] leading-none ${
                  tradeSide === "NO" ? "text-bordeaux" : "text-ash"
                }`}
              >
                {noProb}¢
              </span>
              <span className="font-mono text-[10px] text-ash-dim">
                {noSharePriceSol.toFixed(4)} SOL · {noPool.toFixed(2)} pool
              </span>
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-[.16em] text-ash-dim">
                Shares
              </label>
              <span className="font-mono text-[10px] text-ash-dim tnum">
                {tradeSide === "YES"
                  ? userYesBalance.toFixed(1)
                  : userNoBalance.toFixed(1)}{" "}
                held
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-11 rounded-md font-display font-bold text-[16px] text-ivory cursor-pointer transition-all"
                style={{
                  background: "var(--color-panel)",
                  border: "1px solid var(--color-hairline)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor =
                    "color-mix(in oklab, var(--color-gold) 40%, transparent)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--color-hairline)")
                }
              >
                −
              </button>
              <input
                type="number"
                data-testid="buy-quantity"
                step={1}
                value={quantity}
                min={1}
                onChange={(e) =>
                  setQuantity(Math.max(1, Math.floor(Number(e.target.value)) || 0))
                }
                className="flex-1 rounded-lg px-4 py-3 font-mono text-[18px] font-bold text-ivory text-center focus:outline-none transition-all"
                style={{
                  background: "var(--color-obsidian)",
                  border: "1px solid var(--color-hairline)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor =
                    "color-mix(in oklab, var(--color-gold) 70%, transparent)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px color-mix(in oklab, var(--color-gold) 18%, transparent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-hairline)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-11 rounded-md font-display font-bold text-[16px] text-ivory cursor-pointer transition-all"
                style={{
                  background: "var(--color-panel)",
                  border: "1px solid var(--color-hairline)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor =
                    "color-mix(in oklab, var(--color-gold) 40%, transparent)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--color-hairline)")
                }
              >
                +
              </button>
            </div>

            {/* Quick-pick buttons */}
            <div className="flex gap-1.5 flex-wrap">
              {[10, 25, 50, 100, 250].map((n) => (
                <button
                  key={n}
                  onClick={() => setQuantity(n)}
                  className="px-2.5 py-1 font-mono text-[10px] text-ash-dim hover:text-ivory cursor-pointer transition-colors rounded-[6px]"
                  style={{
                    background: "var(--color-panel)",
                    border: "1px solid var(--color-hairline)",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced: Limit Order toggle */}
          <div className="border border-hairline/20 rounded-md overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-ash hover:text-ash cursor-pointer transition-colors bg-panel"
            >
              <span>Advanced: Limit Order</span>
              <span
                className={`transition-transform ${
                  showAdvanced ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>
            {showAdvanced && (
              <div className="px-3 pb-3 pt-2 bg-panel space-y-3 border-t border-hairline/15">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="buy-limit-toggle"
                    onClick={() => setIsLimitOrder(!isLimitOrder)}
                    className={`relative w-8 h-4 rounded-md transition-colors cursor-pointer ${
                      isLimitOrder ? "bg-gold" : "bg-panel-2"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 bg-ivory rounded-md transition-all ${
                        isLimitOrder ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                  <span className="text-[11px] text-ash">
                    Place as limit order
                  </span>
                </div>
                {isLimitOrder && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-ash uppercase tracking-wider">
                      <span>Limit Price (SOL/share)</span>
                      <button
                        type="button"
                        onClick={() =>
                          setLimitPriceSol(
                            Number(activeSharePriceSol.toFixed(4))
                          )
                        }
                        className="text-gold hover:underline font-mono"
                      >
                        Use Current ({activeSharePriceSol.toFixed(4)})
                      </button>
                    </div>
                    <input
                      data-testid="limit-price"
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      max="10"
                      value={limitPriceSol}
                      onChange={(e) =>
                        setLimitPriceSol(
                          Math.max(0.0001, Math.min(10, Number(e.target.value)))
                        )
                      }
                      className="w-full bg-panel border border-hairline/40 rounded px-3 py-1.5 text-[13px] font-mono text-ivory focus:outline-none focus:border-gold/60"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trade summary */}
          <div className="data-cell space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-ash-dim">Cost</span>
              <span className="font-mono font-bold text-ivory tnum">
                {tradeCost.toFixed(4)} SOL
              </span>
            </div>
            <div
              className="h-px"
              style={{ background: "var(--color-hairline)" }}
            />
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-ash-dim">Payout (if correct)</span>
              <span
                className={`font-mono font-bold tnum ${
                  tradeSide === "YES" ? "text-verdigris" : "text-bordeaux"
                }`}
              >
                {potentialPayout.toFixed(4)} SOL
              </span>
            </div>
            {priceImpactPct > 0 && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ash-dim">Price impact</span>
                <span
                  className={`font-mono tnum ${
                    priceImpactPct > 5 ? "text-amber" : "text-ash-dim"
                  }`}
                >
                  {priceImpactPct.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          {slippageWarning && (
            <div
              className="px-3 py-2 rounded-md font-mono text-[10px] leading-snug"
              style={{
                background:
                  "color-mix(in srgb, var(--color-amber) 10%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--color-amber) 40%, transparent)",
                color: "var(--color-amber)",
              }}
            >
              ⚠ High price impact — consider a smaller position.
            </div>
          )}

          {/* CTA Button — colored by selected side */}
          <motion.button
            data-testid="buy-submit"
            disabled={submitting || quantity < 1}
            onClick={
              isLimitOrder ? () => handlePlaceLimitOrder(true) : handleBuy
            }
            whileTap={{ scale: 0.97 }}
            className="w-full h-14 font-semibold text-[13px] tracking-wide cursor-pointer transition-colors rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                tradeSide === "YES"
                  ? "var(--color-verdigris)"
                  : "var(--color-bordeaux)",
              color: "#fff",
            }}
          >
            {submitting
              ? "Processing..."
              : isLimitOrder
              ? `Place Limit ${tradeSide} Order`
              : `Buy ${quantity} ${tradeSide}`}
          </motion.button>

          {/* Tx status */}
          {txState === "signing" && (
            <p className="text-center text-xs font-mono text-gold-lite animate-pulse">
              Approve in wallet...
            </p>
          )}
          {txState === "confirming" && (
            <p className="text-center text-xs font-mono text-gold animate-pulse">
              Confirming on-chain...
            </p>
          )}
          {txState === "success" && txSig && (
            <p className="text-center text-xs font-mono text-verdigris">
              ✓ Done —{" "}
              <a
                href={`https://solscan.io/tx/${txSig}${
                  ENV.cluster === "mainnet-beta"
                    ? ""
                    : `?cluster=${ENV.cluster}`
                }`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View tx
              </a>
            </p>
          )}
          {txState === "error" && (
            <p className="text-center text-xs font-mono text-bordeaux">
              Transaction failed
            </p>
          )}

          {/* Active limit orders */}
          {userOrders.length > 0 && (
            <div className="pt-2 border-t border-hairline/20 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ash">
                Your Open Orders
              </p>
              {userOrders.map((ordAcc, idx) => {
                const ord = ordAcc.account;
                const sideStr = "yes" in ord.side ? "YES" : "NO";
                const priceSol = (ord.priceBps.toNumber() / 10000).toFixed(2);
                const qty2 = ord.quantity.toNumber();
                const filled = ord.filledQuantity.toNumber();
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-md bg-panel border border-hairline/20 text-[10px] font-mono"
                  >
                    <div>
                      <span
                        className={
                          ord.isBuy
                            ? "text-verdigris font-bold"
                            : "text-bordeaux font-bold"
                        }
                      >
                        {ord.isBuy ? "BUY" : "SELL"} {sideStr}
                      </span>
                      <span className="text-ash ml-2">@ {priceSol} SOL</span>
                      <span className="text-ash ml-2">
                        {filled}/{qty2} filled
                      </span>
                    </div>
                    <button
                      onClick={() => handleCancelOrder(ordAcc)}
                      className="text-bordeaux hover:text-bordeaux/80 cursor-pointer underline"
                    >
                      Cancel
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : /* ════════════════════════════════════════════════════════════════
          SELL TAB
         ════════════════════════════════════════════════════════════════ */
      tradeTab === "sell" ? (
        <div className="space-y-4 pt-4">
          {/* User balances */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div
              className="p-4 rounded-lg text-center"
              style={{
                background: "rgba(34,197,94,.06)",
                border: "1px solid rgba(34,197,94,.3)",
              }}
            >
              <div className="font-mono text-[9px] uppercase tracking-wider text-verdigris mb-1">
                YES Shares
              </div>
              <div className="font-display font-bold text-[28px] text-verdigris leading-none">
                {userYesBalance.toFixed(1)}
              </div>
            </div>
            <div
              className="p-4 rounded-lg text-center"
              style={{
                background: "rgba(239,68,68,.06)",
                border: "1px solid rgba(239,68,68,.3)",
              }}
            >
              <div className="font-mono text-[9px] uppercase tracking-wider text-bordeaux mb-1">
                NO Shares
              </div>
              <div className="font-display font-bold text-[28px] text-bordeaux leading-none">
                {userNoBalance.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Which side to sell */}
          <div className="grid grid-cols-2 gap-2">
            {(["YES", "NO"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSellSide(s)}
                className={`py-2.5 rounded-md border-2 text-[13px] font-bold uppercase tracking-wide cursor-pointer transition-all ${
                  sellSide === s
                    ? s === "YES"
                      ? "border-verdigris bg-verdigris/10 text-verdigris"
                      : "border-bordeaux bg-bordeaux/10 text-bordeaux"
                    : "border-hairline/25 bg-panel text-ash"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ash uppercase tracking-wider">
                Sell Quantity
              </label>
              <button
                onClick={() =>
                  setSellQuantity(
                    Math.floor(
                      sellSide === "YES" ? userYesBalance : userNoBalance
                    )
                  )
                }
                className="text-[10px] text-gold hover:underline cursor-pointer font-mono font-bold"
              >
                MAX (
                {Math.floor(
                  sellSide === "YES" ? userYesBalance : userNoBalance
                )}
                )
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSellQuantity(Math.max(1, sellQuantity - 5))}
                className="w-10 h-10 rounded-md bg-panel border border-hairline/30 text-ivory font-mono font-bold cursor-pointer"
              >
                −
              </button>
              <input
                type="number"
                data-testid="sell-quantity"
                step={1}
                value={sellQuantity}
                min={1}
                onChange={(e) =>
                  setSellQuantity(Math.max(1, Math.floor(Number(e.target.value)) || 0))
                }
                className="flex-1 bg-panel border border-hairline/40 rounded-md px-3 py-2 text-center text-[13px] font-mono text-ivory focus:outline-none focus:border-gold/60"
              />
              <button
                onClick={() => setSellQuantity(sellQuantity + 5)}
                className="w-10 h-10 rounded-md bg-panel border border-hairline/30 text-ivory font-mono font-bold cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Advanced: Limit Sell Ask toggle */}
          <div className="border border-hairline/20 rounded-md overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-ash hover:text-ash cursor-pointer transition-colors bg-panel"
            >
              <span>Advanced: Limit Sell (Ask)</span>
              <span
                className={`transition-transform ${
                  showAdvanced ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>
            {showAdvanced && (
              <div className="px-3 pb-3 pt-2 bg-panel space-y-3 border-t border-hairline/15">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="sell-limit-toggle"
                    onClick={() => setIsLimitOrder(!isLimitOrder)}
                    className={`relative w-8 h-4 rounded-md transition-colors cursor-pointer ${
                      isLimitOrder ? "bg-gold" : "bg-panel-2"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 bg-ivory rounded-md transition-all ${
                        isLimitOrder ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                  <span className="text-[11px] text-ash">
                    Place as limit sell (ask)
                  </span>
                </div>
                {isLimitOrder && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-ash uppercase tracking-wider">
                      <span>Min Sell Price (SOL/share)</span>
                      <button
                        type="button"
                        onClick={() =>
                          setLimitPriceSol(
                            Number(activeSharePriceSol.toFixed(4))
                          )
                        }
                        className="text-gold hover:underline font-mono"
                      >
                        Use Current ({activeSharePriceSol.toFixed(4)})
                      </button>
                    </div>
                    <input
                      data-testid="limit-price"
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      max="10"
                      value={limitPriceSol}
                      onChange={(e) =>
                        setLimitPriceSol(
                          Math.max(0.0001, Math.min(10, Number(e.target.value)))
                        )
                      }
                      className="w-full bg-panel border border-hairline/40 rounded px-3 py-1.5 text-[13px] font-mono text-ivory focus:outline-none focus:border-gold/60"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-panel rounded-md border border-hairline/20 p-3 space-y-2 text-[11px] font-mono">
            <div className="flex justify-between">
              <span className="text-ash">Shares to sell</span>
              <span className="text-ivory">
                {sellQuantity} {sellSide}
              </span>
            </div>
            <div className="flex justify-between border-t border-hairline/15 pt-2">
              <span className="text-ash">Est. payout</span>
              <span className="text-verdigris font-bold">
                {isLimitOrder
                  ? (sellQuantity * limitPriceSol).toFixed(4)
                  : sellRefundSol.toFixed(4)}{" "}
                SOL
              </span>
            </div>
          </div>

          {!isLimitOrder && sellQuantity > 0 && sellUnavailable && (
            <div className="bg-bordeaux/10 border border-bordeaux/40 rounded-md p-2.5 text-[10px] font-mono text-bordeaux leading-snug">
              The treasury can&apos;t cover this payout — the on-chain sell
              would revert. Reduce the quantity or wait for the pool to refill
              before selling.
            </div>
          )}

          <motion.button
            data-testid="sell-submit"
            disabled={
              submitting ||
              (sellSide === "YES"
                ? userYesBalance < sellQuantity
                : userNoBalance < sellQuantity) ||
              (!isLimitOrder && sellUnavailable)
            }
            onClick={
              isLimitOrder ? () => handlePlaceLimitOrder(false) : handleSell
            }
            whileTap={{ scale: 0.97 }}
            className="w-full h-13 font-semibold text-[13px] tracking-wide cursor-pointer transition-colors rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                sellSide === "YES"
                  ? "var(--color-verdigris)"
                  : "var(--color-bordeaux)",
              color: "#fff",
            }}
          >
            {submitting
              ? "Processing..."
              : isLimitOrder
              ? `Limit Sell ${sellQuantity} ${sellSide}`
              : `Sell ${sellQuantity} ${sellSide}`}
          </motion.button>
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════
          LP TAB
         ════════════════════════════════════════════════════════════════ */
        <div className="space-y-4 pt-4">
          <div className="space-y-1 bg-gold/5 border border-gold/20 p-3 rounded font-mono text-[10px] text-ash leading-normal">
            <span className="text-gold font-bold">
              Liquidity Provision (LP)
            </span>
            : Provide custom seed reserves directly to outcome pools to support
            larger trading volume and earn fees.
          </div>

          {/* Your LP position + market LP pool */}
          {(userLp || marketLpStats) && (
            <div className="bg-panel rounded-md border border-hairline p-3 space-y-2 text-[10px] font-mono text-ash">
              {userLp && (
                <>
                  <div className="text-[9px] uppercase tracking-wider text-gold font-bold">
                    Your LP in this market
                  </div>
                  <div className="flex justify-between">
                    <span>Deposited:</span>
                    <span className="text-ivory font-bold">
                      {Number(userLp.deposited ?? 0).toFixed(2)} SOL
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>LP Tokens:</span>
                    <span className="text-gold-lite font-bold">
                      {Number(userLp.lpShares ?? 0).toLocaleString()} LP
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fees Earned:</span>
                    <span className="text-verdigris">
                      {Number(userLp.feesEarned ?? 0) > 0
                        ? `+${Number(userLp.feesEarned).toFixed(3)} SOL`
                        : "\u2014"}
                    </span>
                  </div>
                </>
              )}
              {marketLpStats &&
                Number(marketLpStats.totalLiquiditySol ?? 0) > 0 && (
                  <>
                    {userLp && (
                      <div className="border-t border-hairline pt-2" />
                    )}
                    <div className="text-[9px] uppercase tracking-wider text-ash">
                      Market LP Pool
                    </div>
                    <div className="flex justify-between">
                      <span>Total Liquidity:</span>
                      <span className="text-ivory font-bold">
                        {Number(marketLpStats.totalLiquiditySol ?? 0).toFixed(
                          2
                        )}{" "}
                        SOL
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total LP Tokens:</span>
                      <span className="text-gold-lite font-bold">
                        {Number(
                          marketLpStats.totalLpTokens ?? 0
                        ).toLocaleString()}{" "}
                        LP
                      </span>
                    </div>
                  </>
                )}
            </div>
          )}

          {/* LP Allocation Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ash uppercase tracking-wider">
              LP Pool Allocation
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["balanced", "yes", "no"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLpOption(opt)}
                  className={`py-2 px-1 rounded-md text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-all border ${
                    lpOption === opt
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-hairline bg-panel text-ash"
                  }`}
                >
                  {opt === "balanced"
                    ? "Balanced 50:50"
                    : opt === "yes"
                    ? "YES Pool"
                    : "NO Pool"}
                </button>
              ))}
            </div>
          </div>

          {/* LP Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ash uppercase tracking-wider">
              Liquidity to Deposit (SOL)
            </label>
            <input
              type="number"
              data-testid="lp-amount"
              step="0.5"
              min={0.1}
              value={lpDepositAmount}
              onChange={(e) =>
                setLpDepositAmount(Math.max(0.1, Number(e.target.value)))
              }
              className="w-full bg-panel border border-hairline rounded-md px-3 py-2 text-ivory focus:outline-none focus:border-gold font-mono text-[13px]"
            />
          </div>

          {/* LP Impact summary */}
          <div className="bg-panel rounded-md border border-hairline p-3 space-y-2 text-[10px] font-mono text-ash">
            <div className="flex justify-between">
              <span>Current YES Pool:</span>
              <span className="text-ivory">{yesPool.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Current NO Pool:</span>
              <span className="text-ivory">{noPool.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between border-t border-hairline pt-2 text-gold">
              <span>New YES Pool:</span>
              <span>{lpNewYesPoolSol.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between text-gold">
              <span>New NO Pool:</span>
              <span>{lpNewNoPoolSol.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between border-t border-hairline pt-2">
              <span>LP Tokens Minted:</span>
              <span className="text-gold-lite">
                {lpTokensMinted.toLocaleString()} LP
              </span>
            </div>
            <div className="text-[9px] text-ash-dim leading-snug">
              {lpOption === "balanced"
                ? `1:1 with deposited SOL (${lp.yesAddSol.toFixed(
                    2
                  )} YES + ${lp.noAddSol.toFixed(
                    2
                  )} NO). No fee, no curve — exactly what add_liquidity mints on-chain.`
                : `All ${lpDepositAmount} SOL deposited to the ${lpOption.toUpperCase()} pool only.`}
            </div>
          </div>

          <button
            data-testid="lp-submit"
            disabled={submitting}
            onClick={handleProvideLiquidity}
            className="w-full h-12 rounded-lg text-white font-semibold text-[12px] tracking-wide cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-gold hover:bg-gold-deep"
          >
            {submitting
              ? "Processing..."
              : `Deposit ${lpDepositAmount} SOL Liquidity`}
          </button>
        </div>
      )}
    </div>
  );
}
