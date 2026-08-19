import React from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

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
  lp: { yesAddSol: number; noAddSol: number; lpTokensMinted: number; newYesPoolSol: number; newNoPoolSol: number };
  lpTokensMinted: number;
  lpNewYesPoolSol: number;
  lpNewNoPoolSol: number;

  /* User state */
  userYesBalance: number;
  userNoBalance: number;
  userOrders: UserOrder[];
  userLp: { lpShares: number; deposited: string | number; feesEarned: string | number } | null;
  marketLpStats: { totalLiquiditySol: string | number | null; totalLpTokens: number | null; feeEarnedSol: string | number | null } | null;

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
    status, marketPdaB58,
    yesProb, noProb, yesPool, noPool,
    sharePriceSol, activeSharePriceSol, yesSharePriceSol, noSharePriceSol,
    tradeCost, potentialPayout, priceImpactPct, slippageWarning,
    sellRefundSol, sellUnavailable,
    lp, lpTokensMinted, lpNewYesPoolSol, lpNewNoPoolSol,
    userYesBalance, userNoBalance, userOrders, userLp, marketLpStats,
    tradeTab, tradeSide, quantity, sellSide, sellQuantity,
    isLimitOrder, limitPriceSol, showAdvanced, lpOption, lpDepositAmount,
    submitting, txState, txSig,
    setTradeTab, setTradeSide, setQuantity, setSellSide, setSellQuantity,
    setIsLimitOrder, setLimitPriceSol, setShowAdvanced, setLpOption, setLpDepositAmount,
    handleBuy, handleSell, handleProvideLiquidity, handlePlaceLimitOrder, handleCancelOrder,
  } = p;

  /* ------- closed-market banner ------- */
  if (status !== "Open") {
    return (
      <div className="space-y-0">
        <div className="py-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-gold/10 text-gold rounded flex items-center justify-center border border-gold/25">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-[13px] font-bold text-ivory uppercase">
              {status === "Cancelled" ? "BOARD CANCELLED" : status === "Ended" ? "TRADING ENDED" : "TRADING TERMINATED"}
            </h4>
            <p className="text-xs text-ash">
              {status === "Cancelled" ? (
                "This board was cancelled. Deposited funds are being returned to traders — no action needed."
              ) : status === "Ended" ? (
                "Trading for this board has ended. It will be resolved by the oracle shortly — check back for settlement."
              ) : (
                <>This board has settled. Go to your <Link href="/dashboard" className="text-gold hover:underline font-bold">Dashboard</Link> to withdraw payout.</>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ── Buy / Sell / Liquidity Tabs ── */}
      <div className="flex border-b border-hairline">
        {(["buy", "sell", "liquidity"] as const).map((tab) => (
          <button
            key={tab}
            data-testid={`tab-${tab}`}
            onClick={() => setTradeTab(tab)}
            className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-[.16em] transition-colors cursor-pointer ${
              tradeTab === tab
                ? "text-gold-lite border-b border-gold -mb-px"
                : "text-ash-dim hover:text-ivory"
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
          {/* Position selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTradeSide("YES")}
              className={`sheen group flex flex-col items-start justify-between p-4 rounded-[2px] border transition-colors cursor-pointer ${
                tradeSide === "YES"
                  ? "border-gold bg-panel-2"
                  : "border-hairline bg-panel hover:border-ash-dim"
              }`}
            >
              <span className={`label-lux ${tradeSide === "YES" ? "!text-verdigris" : ""}`}>Yes</span>
              <span className={`mt-2 font-mono tnum text-[28px] ${
                tradeSide === "YES" ? "text-verdigris" : "text-ivory"
              }`}>{yesProb}¢</span>
              <span className="mt-1 font-mono text-[10px] text-ash-dim">{yesSharePriceSol.toFixed(4)} SOL · {yesPool.toFixed(2)} SOL</span>
            </button>
            <button
              onClick={() => setTradeSide("NO")}
              className={`sheen group flex flex-col items-start justify-between p-4 rounded-[2px] border transition-colors cursor-pointer ${
                tradeSide === "NO"
                  ? "border-gold bg-panel-2"
                  : "border-hairline bg-panel hover:border-ash-dim"
              }`}
            >
              <span className={`label-lux ${tradeSide === "NO" ? "!text-bordeaux" : ""}`}>No</span>
              <span className={`mt-2 font-mono tnum text-[28px] ${
                tradeSide === "NO" ? "text-bordeaux" : "text-ivory"
              }`}>{noProb}¢</span>
              <span className="mt-1 font-mono text-[10px] text-ash-dim">{noSharePriceSol.toFixed(4)} SOL · {noPool.toFixed(2)} SOL</span>
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ash uppercase tracking-wider">Amount (Shares)</label>
              <span className="text-[10px] font-mono text-ash">
                {tradeSide === "YES" ? `${userYesBalance.toFixed(1)} YES` : `${userNoBalance.toFixed(1)} NO`} held
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 10))}
                className="w-9 h-9 rounded-[2px] bg-panel border border-hairline/30 hover:border-hairline/60 text-ivory font-mono font-bold text-[15px] cursor-pointer transition-all"
              >−</button>
              <input
                type="number"
                data-testid="buy-quantity"
                value={quantity}
                min={1}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="flex-1 bg-panel border border-hairline/40 rounded-[2px] px-3 py-2 text-center text-[13px] font-mono text-ivory focus:outline-none focus:border-gold/60"
              />
              <button
                onClick={() => setQuantity(quantity + 10)}
                className="w-9 h-9 rounded-[2px] bg-panel border border-hairline/30 hover:border-hairline/60 text-ivory font-mono font-bold text-[15px] cursor-pointer transition-all"
              >+</button>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[10, 25, 50, 100, 250].map((v) => (
                <button key={v} onClick={() => setQuantity(v)}
                  className={`py-1 rounded text-[10px] font-mono cursor-pointer transition-all border ${
                    quantity === v
                      ? "border-gold/60 bg-gold/10 text-gold"
                      : "border-hairline/20 bg-panel text-ash hover:text-ivory hover:border-hairline/40"
                  }`}>{v}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {[0.1, 0.5, 1, 5].map((sol) => {
                const shares = Math.max(1, Math.floor(sol / Math.max(0.0005, activeSharePriceSol)));
                return (
                  <button
                    key={sol}
                    onClick={() => setQuantity(shares)}
                    className="flex-1 py-1 rounded text-[9px] font-mono cursor-pointer transition-all border border-hairline/20 bg-panel text-gold/80 hover:text-gold hover:border-gold/40"
                  >
                    {sol} SOL
                  </button>
                );
              })}
              <span className="flex-1 py-1 text-center text-[9px] text-ash/60 font-mono truncate">one-click</span>
            </div>
          </div>

          {/* Advanced: Limit Order toggle */}
          <div className="border border-hairline/20 rounded-[2px] overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-ash hover:text-ash cursor-pointer transition-colors bg-panel"
            >
              <span>Advanced: Limit Order</span>
              <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {showAdvanced && (
              <div className="px-3 pb-3 pt-2 bg-panel space-y-3 border-t border-hairline/15">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="limit-toggle"
                    onClick={() => setIsLimitOrder(!isLimitOrder)}
                    className={`relative w-8 h-4 rounded-[2px] transition-colors cursor-pointer ${
                      isLimitOrder ? "bg-gold" : "bg-[#353534]"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-[2px] transition-all ${
                      isLimitOrder ? "left-4.5 left-[18px]" : "left-0.5"
                    }`} />
                  </button>
                  <span className="text-[11px] text-ash">Place as limit order</span>
                </div>
                {isLimitOrder && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-ash uppercase tracking-wider">
                      <span>Limit Price (SOL/share)</span>
                      <button
                        type="button"
                        onClick={() => setLimitPriceSol(Number(activeSharePriceSol.toFixed(4)))}
                        className="text-gold hover:underline font-mono"
                      >
                        Use Current ({activeSharePriceSol.toFixed(4)})
                      </button>
                    </div>
                    <input
                      data-testid="limit-price"
                      type="number" step="0.0001" min="0.0001" max="10"
                      value={limitPriceSol}
                      onChange={(e) => setLimitPriceSol(Math.max(0.0001, Math.min(10, Number(e.target.value))))}
                      className="w-full bg-panel border border-hairline/40 rounded px-3 py-1.5 text-[13px] font-mono text-ivory focus:outline-none focus:border-gold/60"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="bg-panel rounded-[2px] border border-hairline/20 p-3 space-y-2 text-[11px] font-mono">
            <div className="flex justify-between text-ash">
              <span>Price per share</span>
              <span className="text-ivory">{isLimitOrder ? `${limitPriceSol.toFixed(4)} SOL` : `${activeSharePriceSol.toFixed(4)} SOL`}</span>
            </div>
            <div className="flex justify-between text-ash">
              <span>Quantity</span>
              <span className="text-ivory">{quantity} shares</span>
            </div>
            <div className="flex justify-between text-ivory font-bold border-t border-hairline/15 pt-2">
              <span>Total Investment Amount</span>
              <span className="text-gold font-mono text-xs">{isLimitOrder ? (quantity * limitPriceSol).toFixed(4) : tradeCost.toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between border-t border-hairline/15 pt-2">
              <span className="text-ash">Est. Payout on Win</span>
              <span className={`font-bold ${
                tradeSide === "YES" ? "text-verdigris" : "text-bordeaux"
              }`}>{potentialPayout.toFixed(4)} SOL</span>
            </div>
            {potentialPayout > 0 && (
              <div className="flex justify-between text-[10px]">
                <span className="text-ash">Est. Net Profit</span>
                <span className="text-verdigris font-bold">
                  +{(potentialPayout - (isLimitOrder ? quantity * limitPriceSol : tradeCost)).toFixed(4)} SOL
                  {" "}(+{(((potentialPayout - (isLimitOrder ? quantity * limitPriceSol : tradeCost)) / Math.max(0.0001, (isLimitOrder ? quantity * limitPriceSol : tradeCost))) * 100).toFixed(0)}% return)
                </span>
              </div>
            )}
            <div className="flex justify-between text-[10px]">
              <span className="text-ash">Est. Price Impact</span>
              <span className={priceImpactPct >= 5 ? "text-bordeaux font-bold" : "text-ash"}>
                {priceImpactPct.toFixed(2)}%
              </span>
            </div>
            {slippageWarning && (
              <div className="flex items-start gap-1.5 p-2 rounded bg-bordeaux/10 border border-bordeaux/30 text-[10px] text-bordeaux">
                <span>
                  High price impact (≥5%). This large order may move the market price significantly. Consider splitting it into smaller orders.
                </span>
              </div>
            )}
          </div>

          {/* CTA Button */}
          <button
            data-testid="buy-submit"
            disabled={submitting}
            onClick={isLimitOrder ? () => handlePlaceLimitOrder(true) : handleBuy}
            className={`sheen w-full h-11 rounded-[2px] bg-gold text-void font-mono text-[11px] uppercase tracking-[.16em] cursor-pointer transition-colors flex items-center justify-center gap-2 hover:bg-gold-lite disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {submitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-[2px] animate-spin" />}
            {isLimitOrder
              ? `Place Limit ${tradeSide} Order`
              : `Buy ${tradeSide}`
            }
          </button>

          {/* Tx status */}
          {txState === "signing" && <p className="text-center text-xs font-mono text-gold-lite animate-pulse">Approve in wallet...</p>}
          {txState === "confirming" && <p className="text-center text-xs font-mono text-gold animate-pulse">Confirming on-chain...</p>}
          {txState === "success" && txSig && (
            <p className="text-center text-xs font-mono text-verdigris">
              ✓ Done —{" "}
              <a href={`https://solscan.io/tx/${txSig}?cluster=localnet`} target="_blank" rel="noopener noreferrer" className="underline">View tx</a>
            </p>
          )}
          {txState === "error" && <p className="text-center text-xs font-mono text-bordeaux">Transaction failed</p>}

          {/* Active limit orders */}
          {userOrders.length > 0 && (
            <div className="pt-2 border-t border-hairline/20 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ash">Your Open Orders</p>
              {userOrders.map((ordAcc, idx) => {
                const ord = ordAcc.account;
                const sideStr = "yes" in ord.side ? "YES" : "NO";
                const priceSol = (ord.priceBps.toNumber() / 10000).toFixed(2);
                const qty2 = ord.quantity.toNumber();
                const filled = ord.filledQuantity.toNumber();
                return (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-[2px] bg-panel border border-hairline/20 text-[10px] font-mono">
                    <div>
                      <span className={ord.isBuy ? "text-verdigris font-bold" : "text-bordeaux font-bold"}>
                        {ord.isBuy ? "BUY" : "SELL"} {sideStr}
                      </span>
                      <span className="text-ash ml-2">@ {priceSol} SOL</span>
                      <span className="text-ash ml-2">{filled}/{qty2} filled</span>
                    </div>
                    <button
                      onClick={() => handleCancelOrder(ordAcc)}
                      className="text-bordeaux hover:text-[#ff6b6b] cursor-pointer underline"
                    >Cancel</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      /* ════════════════════════════════════════════════════════════════
          SELL TAB
         ════════════════════════════════════════════════════════════════ */
      ) : tradeTab === "sell" ? (
        <div className="space-y-4 pt-4">
          {/* User balances */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-[2px] bg-panel border border-verdigris/20 text-center">
              <div className="text-[9px] uppercase tracking-wider text-ash font-bold">YES Shares</div>
              <div className="text-[21px] font-black font-mono text-verdigris mt-0.5">{userYesBalance.toFixed(1)}</div>
            </div>
            <div className="p-3 rounded-[2px] bg-panel border border-bordeaux/20 text-center">
              <div className="text-[9px] uppercase tracking-wider text-ash font-bold">NO Shares</div>
              <div className="text-[21px] font-black font-mono text-bordeaux mt-0.5">{userNoBalance.toFixed(1)}</div>
            </div>
          </div>

          {/* Which side to sell */}
          <div className="grid grid-cols-2 gap-2">
            {(["YES", "NO"] as const).map((s) => (
              <button key={s} onClick={() => setSellSide(s)}
                className={`py-2.5 rounded-[2px] border-2 text-[13px] font-bold uppercase tracking-wide cursor-pointer transition-all ${
                  sellSide === s
                    ? s === "YES"
                      ? "border-verdigris bg-verdigris/10 text-verdigris"
                      : "border-bordeaux bg-bordeaux/10 text-bordeaux"
                    : "border-hairline/25 bg-panel text-ash"
                }`}
              >{s}</button>
            ))}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ash uppercase tracking-wider">Sell Quantity</label>
              <button
                onClick={() => setSellQuantity(Math.floor(sellSide === "YES" ? userYesBalance : userNoBalance))}
                className="text-[10px] text-gold hover:underline cursor-pointer font-mono font-bold"
              >
                MAX ({Math.floor(sellSide === "YES" ? userYesBalance : userNoBalance)})
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSellQuantity(Math.max(1, sellQuantity - 5))}
                className="w-9 h-9 rounded-[2px] bg-panel border border-hairline/30 text-ivory font-mono font-bold cursor-pointer">−</button>
              <input type="number" data-testid="sell-quantity" value={sellQuantity} min={1}
                onChange={(e) => setSellQuantity(Math.max(1, Number(e.target.value)))}
                className="flex-1 bg-panel border border-hairline/40 rounded-[2px] px-3 py-2 text-center text-[13px] font-mono text-ivory focus:outline-none focus:border-gold/60" />
              <button onClick={() => setSellQuantity(sellQuantity + 5)}
                className="w-9 h-9 rounded-[2px] bg-panel border border-hairline/30 text-ivory font-mono font-bold cursor-pointer">+</button>
            </div>
          </div>

          {/* Advanced: Limit Sell Ask toggle */}
          <div className="border border-hairline/20 rounded-[2px] overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-ash hover:text-ash cursor-pointer transition-colors bg-panel"
            >
              <span>Advanced: Limit Sell (Ask)</span>
              <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {showAdvanced && (
              <div className="px-3 pb-3 pt-2 bg-panel space-y-3 border-t border-hairline/15">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="limit-toggle"
                    onClick={() => setIsLimitOrder(!isLimitOrder)}
                    className={`relative w-8 h-4 rounded-[2px] transition-colors cursor-pointer ${
                      isLimitOrder ? "bg-gold" : "bg-[#353534]"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-[2px] transition-all ${
                      isLimitOrder ? "left-4.5 left-[18px]" : "left-0.5"
                    }`} />
                  </button>
                  <span className="text-[11px] text-ash">Place as limit sell (ask)</span>
                </div>
                {isLimitOrder && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-ash uppercase tracking-wider">
                      <span>Min Sell Price (SOL/share)</span>
                      <button
                        type="button"
                        onClick={() => setLimitPriceSol(Number(activeSharePriceSol.toFixed(4)))}
                        className="text-gold hover:underline font-mono"
                      >
                        Use Current ({activeSharePriceSol.toFixed(4)})
                      </button>
                    </div>
                    <input
                      data-testid="limit-price"
                      type="number" step="0.0001" min="0.0001" max="10"
                      value={limitPriceSol}
                      onChange={(e) => setLimitPriceSol(Math.max(0.0001, Math.min(10, Number(e.target.value))))}
                      className="w-full bg-panel border border-hairline/40 rounded px-3 py-1.5 text-[13px] font-mono text-ivory focus:outline-none focus:border-gold/60"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-panel rounded-[2px] border border-hairline/20 p-3 space-y-2 text-[11px] font-mono">
            <div className="flex justify-between">
              <span className="text-ash">Shares to sell</span>
              <span className="text-ivory">{sellQuantity} {sellSide}</span>
            </div>
            <div className="flex justify-between border-t border-hairline/15 pt-2">
              <span className="text-ash">Est. payout</span>
              <span className="text-verdigris font-bold">
                {isLimitOrder ? (sellQuantity * limitPriceSol).toFixed(4) : sellRefundSol.toFixed(4)} SOL
              </span>
            </div>
          </div>

          {!isLimitOrder && sellQuantity > 0 && sellUnavailable && (
            <div className="bg-bordeaux/10 border border-bordeaux/40 rounded-[2px] p-2.5 text-[10px] font-mono text-bordeaux leading-snug">
              The treasury can&apos;t cover this payout — the on-chain sell would revert. Reduce the quantity or wait for the pool to refill before selling.
            </div>
          )}

          <button
            data-testid="sell-submit"
            disabled={
              submitting ||
              (sellSide === "YES" ? userYesBalance < sellQuantity : userNoBalance < sellQuantity) ||
              (!isLimitOrder && sellUnavailable)
            }
            onClick={isLimitOrder ? () => handlePlaceLimitOrder(false) : handleSell}
            className={`sheen w-full h-11 rounded-[2px] font-mono text-[11px] uppercase tracking-[.16em] cursor-pointer transition-colors ${
              sellSide === "YES"
                ? "bg-verdigris text-void hover:bg-verdigris/80"
                : "bg-bordeaux text-ivory hover:bg-bordeaux/80"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {submitting ? "Processing..." : isLimitOrder ? `Place Limit Sell Ask (${sellQuantity} ${sellSide})` : `Instant Sell ${sellQuantity} ${sellSide} Shares`}
          </button>
        </div>

      /* ════════════════════════════════════════════════════════════════
          LP TAB
         ════════════════════════════════════════════════════════════════ */
      ) : (
        <div className="space-y-4 pt-4">
          <div className="space-y-1 bg-gold/5 border border-gold/20 p-3 rounded font-mono text-[10px] text-ash leading-normal">
            <span className="text-gold font-bold">Liquidity Provision (LP)</span>:{" "}
            Provide custom seed reserves directly to outcome pools to support larger trading volume and earn fees.
          </div>

          {/* Your LP position + market LP pool */}
          {(userLp || marketLpStats) && (
            <div className="bg-panel rounded-[2px] border border-hairline p-3 space-y-2 text-[10px] font-mono text-ash">
              {userLp && (
                <>
                  <div className="text-[9px] uppercase tracking-wider text-gold font-bold">Your LP in this market</div>
                  <div className="flex justify-between">
                    <span>Deposited:</span>
                    <span className="text-ivory font-bold">{Number(userLp.deposited ?? 0).toFixed(2)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>LP Tokens:</span>
                    <span className="text-gold-lite font-bold">{Number(userLp.lpShares ?? 0).toLocaleString()} LP</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fees Earned:</span>
                    <span className="text-verdigris">
                      {Number(userLp.feesEarned ?? 0) > 0 ? `+${Number(userLp.feesEarned).toFixed(3)} SOL` : "\u2014"}
                    </span>
                  </div>
                </>
              )}
              {marketLpStats && Number(marketLpStats.totalLiquiditySol ?? 0) > 0 && (
                <>
                  {userLp && <div className="border-t border-hairline pt-2" />}
                  <div className="text-[9px] uppercase tracking-wider text-ash">Market LP Pool</div>
                  <div className="flex justify-between">
                    <span>Total Liquidity:</span>
                    <span className="text-ivory font-bold">{Number(marketLpStats.totalLiquiditySol ?? 0).toFixed(2)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total LP Tokens:</span>
                    <span className="text-gold-lite font-bold">{Number(marketLpStats.totalLpTokens ?? 0).toLocaleString()} LP</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* LP Allocation Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ash uppercase tracking-wider">LP Pool Allocation</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["balanced", "yes", "no"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLpOption(opt)}
                  className={`py-2 px-1 rounded-[2px] text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-all border ${
                    lpOption === opt
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-hairline bg-panel text-ash"
                  }`}
                >
                  {opt === "balanced" ? "Balanced 50:50" : opt === "yes" ? "YES Pool" : "NO Pool"}
                </button>
              ))}
            </div>
          </div>

          {/* LP Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ash uppercase tracking-wider">Liquidity to Deposit (SOL)</label>
            <input
              type="number"
              data-testid="lp-amount"
              step="0.5"
              min={0.1}
              value={lpDepositAmount}
              onChange={(e) => setLpDepositAmount(Math.max(0.1, Number(e.target.value)))}
              className="w-full bg-panel border border-hairline rounded-[2px] px-3 py-2 text-ivory focus:outline-none focus:border-gold font-mono text-[13px]"
            />
          </div>

          {/* LP Impact summary */}
          <div className="bg-panel rounded-[2px] border border-hairline p-3 space-y-2 text-[10px] font-mono text-ash">
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
              <span className="text-gold-lite">{lpTokensMinted.toLocaleString()} LP</span>
            </div>
            <div className="text-[9px] text-ash-dim leading-snug">
              1:1 with deposited SOL ({lp.yesAddSol.toFixed(2)} YES + {lp.noAddSol.toFixed(2)} NO). No fee, no curve — exactly what <span className="text-ash">add_liquidity</span> mints on-chain.
            </div>
          </div>

          <button
            data-testid="lp-submit"
            disabled={submitting}
            onClick={handleProvideLiquidity}
            className="sheen w-full h-11 rounded-[2px] bg-gold text-void font-mono text-[11px] uppercase tracking-[.16em] cursor-pointer transition-colors hover:bg-gold-lite disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Processing..." : `Deposit ${lpDepositAmount} SOL Liquidity`}
          </button>
        </div>
      )}
    </div>
  );
}
