"use client";

import React, { useState, useEffect, useRef } from "react";
import { useProgram } from "@/hooks/useProgram";
import { useRealtime } from "@/hooks/useRealtime";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { getSpotPriceYes, getSpotPriceNo } from "@/lib/amm/cpmm";

interface OrderBookDepthProps {
  yesPoolLamports: number;
  noPoolLamports: number;
  marketPda?: string;
  onFillOrder?: (orderAccount: { publicKey: PublicKey; account: OrderAccountRaw }, qty: number) => void;
}

interface OrderAccountRaw {
  maker: PublicKey;
  market: PublicKey;
  side: object;
  isBuy: boolean;
  priceBps: anchor.BN;
  quantity: anchor.BN;
  filledQuantity: anchor.BN;
  status: object;
  orderId: anchor.BN;
  [key: string]: unknown;
}

interface OrderEntry {
  account: OrderAccountRaw;
  orderAccountObj: { publicKey: PublicKey; account: OrderAccountRaw };
  priceBps: number;
  quantity: number;
  filled: number;
  side: "YES" | "NO";
  isBuy: boolean;
  maker: string;
}

export const OrderBookDepth = React.memo(function OrderBookDepth({ yesPoolLamports, noPoolLamports, marketPda, onFillOrder }: OrderBookDepthProps) {
  const { program, wallet } = useProgram();
  const [bids, setBids] = useState<OrderEntry[]>([]);
  const [asks, setAsks] = useState<OrderEntry[]>([]);
  const [selectedSideFilter, setSelectedSideFilter] = useState<"ALL" | "YES" | "NO">("ALL");
  const lastOrdersSnapshotRef = useRef<string>("");

  const yesSol = yesPoolLamports / 1e9;
  const noSol = noPoolLamports / 1e9;
  const totalSol = yesSol + noSol;
  // CPMM reserves weight reflects the share of liquidity each side holds.
  const yesWeight = totalSol > 0 ? (yesSol / totalSol) * 100 : 50;
  const noWeight = 100 - yesWeight;
  // Spot probability = pool_side / (pool_yes + pool_no) — the on-chain spot
  // price basis (see amm_math.rs), matching the page's implied-probability bar.
  const yesSpotBI = getSpotPriceYes(BigInt(yesPoolLamports), BigInt(noPoolLamports), 0);
  const noSpotBI = getSpotPriceNo(BigInt(yesPoolLamports), BigInt(noPoolLamports), 0);
  const yesOdds = yesSpotBI === 0n ? yesWeight
    : Math.max(1, Math.min(99, (Number(yesSpotBI) / 1e12) * 100));

  useEffect(() => {
    if (!program || !marketPda) return;
    let cancelled = false;

    const fetchOrders = async () => {
      try {
        if (!marketPda || marketPda === "11111111111111111111111111111111") return;
        const allOrders = await program.account.order.all().catch(() => []);
        if (cancelled) return;
        const mktKey = new PublicKey(marketPda);
        const marketOrders = allOrders.filter((o) => {
          try { return o.account.market.equals(mktKey); } catch { return false; }
        });

        const openOrders = marketOrders.filter((o) => {
          const status = o.account.status;
          if (typeof status === "object" && status !== null) {
            return "open" in status || Object.keys(status)[0]?.toLowerCase() === "open";
          }
          return status === 0;
        });

        const bidEntries: OrderEntry[] = [];
        const askEntries: OrderEntry[] = [];

        for (const o of openOrders) {
          const acc = o.account;
          const isYes = typeof acc.side === "object" && acc.side !== null 
            ? ("yes" in acc.side || Object.keys(acc.side)[0]?.toLowerCase() === "yes")
            : acc.side === 0;
          const side: "YES" | "NO" = isYes ? "YES" : "NO";

          const entry: OrderEntry = {
            account: acc,
            orderAccountObj: o,
            priceBps: acc.priceBps?.toNumber?.() ?? Number(acc.priceBps),
            quantity: acc.quantity?.toNumber?.() ?? Number(acc.quantity),
            filled: acc.filledQuantity?.toNumber?.() ?? Number(acc.filledQuantity),
            side,
            isBuy: Boolean(acc.isBuy),
            maker: acc.maker.toBase58().slice(0, 6),
          };

          if (entry.isBuy) {
            bidEntries.push(entry);
          } else {
            askEntries.push(entry);
          }
        }

        bidEntries.sort((a, b) => b.priceBps - a.priceBps);
        askEntries.sort((a, b) => a.priceBps - b.priceBps);

        if (!cancelled) {
          const snapshot = JSON.stringify([
            bidEntries.map(b => `${b.priceBps}:${b.quantity}:${b.filled}:${b.maker}`),
            askEntries.map(a => `${a.priceBps}:${a.quantity}:${a.filled}:${a.maker}`)
          ]);
          if (snapshot !== lastOrdersSnapshotRef.current) {
            lastOrdersSnapshotRef.current = snapshot;
            setBids(bidEntries);
            setAsks(askEntries);
          }
        }
      } catch (e) {
        console.error("OrderBook fetch error:", e);
      }
    };

    fetchOrders();
    return () => { cancelled = true; };
  }, [program, marketPda]);

  useRealtime(marketPda ? `market:${marketPda}:orderbook` : undefined, (payload: unknown) => {
    try {
      const data = payload as { bids: OrderEntry[]; asks: OrderEntry[] };
      if (data.bids) setBids(data.bids);
      if (data.asks) setAsks(data.asks);
    } catch {}
  });

  const filteredBids = bids.filter(b => selectedSideFilter === "ALL" || b.side === selectedSideFilter).slice(0, 10);
  const filteredAsks = asks.filter(a => selectedSideFilter === "ALL" || a.side === selectedSideFilter).slice(0, 10);

  const maxQty = Math.max(
    ...filteredBids.map(b => b.quantity - b.filled),
    ...filteredAsks.map(a => a.quantity - a.filled),
    1
  );

  const bestBid = filteredBids.length > 0 ? (filteredBids[0].priceBps / 10000).toFixed(2) : "—";
  const bestAsk = filteredAsks.length > 0 ? (filteredAsks[0].priceBps / 10000).toFixed(2) : "—";
  const spreadSol = filteredBids.length > 0 && filteredAsks.length > 0
    ? (Math.abs(filteredAsks[0].priceBps - filteredBids[0].priceBps) / 10000).toFixed(2)
    : "—";

  return (
    <div className="holo-card p-5 space-y-4 border-hairline/40 bg-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-hairline/30 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold uppercase tracking-wider font-display text-gold-lite">
            CLOB Order Book
          </h3>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-panel-2 border border-hairline text-verdigris font-bold">
            P2P
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-panel p-0.5 rounded border border-hairline/20 font-mono text-[10px]">
            {(["ALL", "YES", "NO"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedSideFilter(tab)}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  selectedSideFilter === tab
                    ? "bg-gold-lite text-void font-bold"
                    : "text-ash hover:text-ivory"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-mono text-graphite flex items-center gap-1 pl-2">
            <span className="w-1.5 h-1.5 rounded-[2px] bg-verdigris animate-pulse inline-block" />
            <span>LIVE</span>
          </span>
        </div>
      </div>

      {/* Order Book Table */}
      <div className="space-y-1">
        {/* Column Headers */}
        <div className="grid grid-cols-5 text-[9px] uppercase tracking-wider font-display text-graphite border-b border-hairline/20 pb-1 font-semibold">
          <div className="text-left">Side</div>
          <div className="text-center">Price</div>
          <div className="text-center">Qty</div>
          <div className="text-center">Maker</div>
          <div className="text-right">Action</div>
        </div>

        {/* Asks (sells) — highest first */}
        {filteredAsks.length > 0 ? (
          <div className="space-y-0.5">
            {[...filteredAsks].reverse().map((ask, idx) => {
              const remaining = ask.quantity - ask.filled;
              const depthPct = (remaining / maxQty) * 100;
              const isUserOrder = wallet?.publicKey && ask.account.maker.equals(wallet.publicKey);
              return (
                <div key={`ask-${idx}`} className="grid grid-cols-5 py-1.5 items-center relative font-mono text-xs hover:bg-ivory/5 transition-colors rounded px-1 group">
                  <div className="text-left">
                    <span className="text-bordeaux font-bold text-[10px]">ASK {ask.side}</span>
                  </div>
                  <div className="text-center text-ivory font-bold">{(ask.priceBps / 10000).toFixed(2)} SOL</div>
                  <div className="text-center text-graphite">{remaining}</div>
                  <div className="text-center text-ash text-[10px]">{isUserOrder ? "You" : `${ask.maker}…`}</div>
                  <div className="text-right z-10">
                    {onFillOrder && !isUserOrder ? (
                      <button
                        onClick={() => onFillOrder(ask.orderAccountObj, Math.min(remaining, 5))}
                        className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-bordeaux/20 hover:bg-bordeaux/40 text-bordeaux border border-bordeaux/40 transition-all cursor-pointer"
                      >
                        FILL
                      </button>
                    ) : (
                      <span className="text-[9px] text-ash">{isUserOrder ? "Your Ask" : "Open"}</span>
                    )}
                  </div>
                  <div
                    style={{ width: `${Math.min(depthPct, 100)}%` }}
                    className="absolute top-0 bottom-0 right-0 bg-bordeaux/8 pointer-events-none rounded-r transition-[width] duration-300"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-2 text-center text-[10px] font-mono text-ash border-b border-hairline/10">
            No active ask orders
          </div>
        )}

        {/* Spread divider */}
        <div className="py-1.5 px-3 flex justify-between items-center text-[10px] font-mono text-gold-lite font-bold border-y border-hairline/20 bg-gold-lite/5 rounded-[2px]">
          <span>BID: {bestBid} SOL</span>
          <span>SPREAD: {spreadSol} SOL</span>
          <span>ASK: {bestAsk} SOL</span>
        </div>

        {/* Bids (buys) */}
        {filteredBids.length > 0 ? (
          <div className="space-y-0.5">
            {filteredBids.map((bid, idx) => {
              const remaining = bid.quantity - bid.filled;
              const depthPct = (remaining / maxQty) * 100;
              const isUserOrder = wallet?.publicKey && bid.account.maker.equals(wallet.publicKey);
              return (
                <div key={`bid-${idx}`} className="grid grid-cols-5 py-1.5 items-center relative font-mono text-xs hover:bg-ivory/5 transition-colors rounded px-1 group">
                  <div className="text-left">
                    <span className="text-verdigris font-bold text-[10px]">BID {bid.side}</span>
                  </div>
                  <div className="text-center text-ivory font-bold">{(bid.priceBps / 10000).toFixed(2)} SOL</div>
                  <div className="text-center text-graphite">{remaining}</div>
                  <div className="text-center text-ash text-[10px]">{isUserOrder ? "You" : `${bid.maker}…`}</div>
                  <div className="text-right z-10">
                    {onFillOrder && !isUserOrder ? (
                      <button
                        onClick={() => onFillOrder(bid.orderAccountObj, Math.min(remaining, 5))}
                        className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-verdigris/20 hover:bg-verdigris/40 text-verdigris border border-verdigris/40 transition-all cursor-pointer"
                      >
                        FILL
                      </button>
                    ) : (
                      <span className="text-[9px] text-ash">{isUserOrder ? "Your Bid" : "Open"}</span>
                    )}
                  </div>
                  <div
                    style={{ width: `${Math.min(depthPct, 100)}%` }}
                    className="absolute top-0 bottom-0 left-0 bg-verdigris/8 pointer-events-none rounded-l transition-all duration-500"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-2 text-center text-[10px] font-mono text-ash">
            No active bid orders
          </div>
        )}
      </div>

      {/* AMM Pool Liquidity & Reserves Inspector */}
      <div className="pt-3 border-t border-hairline/30 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gold-lite">
            CPMM Liquidity & AMM Reserves
          </span>
          <span className="text-[10px] font-mono text-gold font-bold">
            Total Liquidity: {totalSol.toFixed(2)} SOL
          </span>
        </div>

        {totalSol === 0 && (
          <div className="bg-gold/10 border border-gold/30 rounded p-2 text-[9px] font-mono text-gold leading-snug">
            <strong>Initial Pool Reserves:</strong> New prediction boards start with 0 SOL in reserves. The smart contract automatically applies <strong>Flat Linear Minting</strong> (at baseline share price) for initial trades. Your first buy or LP deposit immediately seeds the pool and activates constant-product ($x \cdot y = k$) CPMM price curves!
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="bg-panel-2 p-2.5 rounded border border-verdigris/30 space-y-1">
            <div className="text-ash text-[9px] uppercase font-bold">YES Pool Inventory</div>
            <div className="text-verdigris font-bold text-[13px]">{yesSol.toFixed(3)} SOL</div>
            <div className="text-[9px] text-ash">Weight: {yesWeight.toFixed(1)}%</div>
          </div>
          <div className="bg-panel-2 p-2.5 rounded border border-bordeaux/30 space-y-1">
            <div className="text-ash text-[9px] uppercase font-bold">NO Pool Inventory</div>
            <div className="text-bordeaux font-bold text-[13px]">{noSol.toFixed(3)} SOL</div>
            <div className="text-[9px] text-ash">Weight: {noWeight.toFixed(1)}%</div>
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-ash">Implied YES Probability:</span>
          <span className="text-verdigris font-bold">{yesOdds.toFixed(1)}%</span>
        </div>

        <div className="w-full h-2.5 bg-bordeaux/20 rounded-[2px] overflow-hidden flex border border-void">
          <div
            style={{ width: `${yesOdds}%` }}
            className="h-full bg-verdigris transition-all duration-700 ease-out"
          />
        </div>

        <div className="bg-panel p-2.5 rounded border border-hairline text-[9px] font-mono space-y-1.5 text-ash">
          <div className="flex justify-between text-ivory font-bold">
            <span>CPMM Constant (k = YES · NO):</span>
            <span className="text-gold">{(yesSol * noSol).toFixed(4)} SOL²</span>
          </div>
          <div className="flex justify-between text-ivory font-bold">
            <span>Spot Price of YES (YES ÷ Total):</span>
            <span className="text-verdigris">
              {(yesSpotBI === 0n ? 0.5 : Number(yesSpotBI) / 1e12).toFixed(4)} SOL
            </span>
          </div>
          <div className="flex justify-between text-ash">
            <span className="text-ivory font-bold">Spot Price of NO (NO ÷ Total):</span>
            <span className="text-bordeaux">
              {(noSpotBI === 0n ? 0.5 : Number(noSpotBI) / 1e12).toFixed(4)} SOL
            </span>
          </div>
          <div>
            k = YES · NO tracks pool balance across trades. Buying YES raises the YES spot price.
          </div>
        </div>
      </div>
    </div>
  );
});
