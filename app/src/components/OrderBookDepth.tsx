"use client";

import React, { useState, useEffect, useRef } from "react";
import { useProgram } from "@/hooks/useProgram";
import { useRealtime } from "@/hooks/useRealtime";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

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
  const yesPct = totalSol > 0 ? (yesSol / totalSol) * 100 : 50;
  const noPct = 100 - yesPct;

  useEffect(() => {
    if (!program || !marketPda) return;
    let cancelled = false;

    const fetchOrders = async () => {
      try {
        const allOrders = await program.account.order.all();
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
    <div className="board-panel p-5 space-y-4 border-[#9e8e78]/40 bg-[#131313]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#9e8e78]/30 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider font-display text-[#ffd89c]">
            CLOB Order Book
          </h3>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[#22c55e] font-bold">
            P2P
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-[#0d0d0d] p-0.5 rounded border border-[#9e8e78]/20 font-mono text-[10px]">
            {(["ALL", "YES", "NO"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedSideFilter(tab)}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  selectedSideFilter === tab
                    ? "bg-[#ffd89c] text-[#131313] font-bold"
                    : "text-[#9e8e78] hover:text-[#e5e2e1]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-mono text-[#d6c4ac] flex items-center gap-1 pl-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse inline-block" />
            <span>LIVE</span>
          </span>
        </div>
      </div>

      {/* Order Book Table */}
      <div className="space-y-1">
        {/* Column Headers */}
        <div className="grid grid-cols-5 text-[9px] uppercase tracking-wider font-display text-[#d6c4ac] border-b border-[#9e8e78]/20 pb-1 font-semibold">
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
                <div key={`ask-${idx}`} className="grid grid-cols-5 py-1.5 items-center relative font-mono text-xs hover:bg-white/5 transition-colors rounded px-1 group">
                  <div className="text-left">
                    <span className="text-[#ef4444] font-bold text-[10px]">ASK {ask.side}</span>
                  </div>
                  <div className="text-center text-[#e5e2e1] font-bold">{(ask.priceBps / 10000).toFixed(2)} SOL</div>
                  <div className="text-center text-[#d6c4ac]">{remaining}</div>
                  <div className="text-center text-[#9e8e78] text-[10px]">{isUserOrder ? "You" : `${ask.maker}…`}</div>
                  <div className="text-right z-10">
                    {onFillOrder && !isUserOrder ? (
                      <button
                        onClick={() => onFillOrder(ask.orderAccountObj, Math.min(remaining, 5))}
                        className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-[#ef4444]/20 hover:bg-[#ef4444]/40 text-[#ef4444] border border-[#ef4444]/40 transition-all cursor-pointer"
                      >
                        ⚡ Fill
                      </button>
                    ) : (
                      <span className="text-[9px] text-[#9e8e78]">{isUserOrder ? "Your Ask" : "Open"}</span>
                    )}
                  </div>
                  <div
                    style={{ width: `${Math.min(depthPct, 100)}%` }}
                    className="absolute top-0 bottom-0 right-0 bg-[#ef4444]/8 pointer-events-none rounded-r transition-[width] duration-300"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-2 text-center text-[10px] font-mono text-[#d6c4ac]/50 border-b border-[#9e8e78]/10">
            No active ask orders
          </div>
        )}

        {/* Spread divider */}
        <div className="py-1.5 px-3 flex justify-between items-center text-[10px] font-mono text-[#ffd89c] font-bold border-y border-[#9e8e78]/20 bg-[#ffd89c]/5 rounded-sm">
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
                <div key={`bid-${idx}`} className="grid grid-cols-5 py-1.5 items-center relative font-mono text-xs hover:bg-white/5 transition-colors rounded px-1 group">
                  <div className="text-left">
                    <span className="text-[#22c55e] font-bold text-[10px]">BID {bid.side}</span>
                  </div>
                  <div className="text-center text-[#e5e2e1] font-bold">{(bid.priceBps / 10000).toFixed(2)} SOL</div>
                  <div className="text-center text-[#d6c4ac]">{remaining}</div>
                  <div className="text-center text-[#9e8e78] text-[10px]">{isUserOrder ? "You" : `${bid.maker}…`}</div>
                  <div className="text-right z-10">
                    {onFillOrder && !isUserOrder ? (
                      <button
                        onClick={() => onFillOrder(bid.orderAccountObj, Math.min(remaining, 5))}
                        className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-[#22c55e]/20 hover:bg-[#22c55e]/40 text-[#22c55e] border border-[#22c55e]/40 transition-all cursor-pointer"
                      >
                        ⚡ Fill
                      </button>
                    ) : (
                      <span className="text-[9px] text-[#9e8e78]">{isUserOrder ? "Your Bid" : "Open"}</span>
                    )}
                  </div>
                  <div
                    style={{ width: `${Math.min(depthPct, 100)}%` }}
                    className="absolute top-0 bottom-0 left-0 bg-[#22c55e]/8 pointer-events-none rounded-l transition-all duration-500"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-2 text-center text-[10px] font-mono text-[#d6c4ac]/50">
            No active bid orders
          </div>
        )}
      </div>

      {/* AMM Pool Summary Bar */}
      <div className="pt-3 border-t border-[#9e8e78]/30 space-y-2">
        <div className="flex justify-between text-[10px] font-mono text-[#d6c4ac]">
          <span>YES Pool: <span className="text-[#22c55e] font-bold">{yesSol.toFixed(3)} SOL ({yesPct.toFixed(0)}%)</span></span>
          <span>NO Pool: <span className="text-[#ef4444] font-bold">{noSol.toFixed(3)} SOL ({noPct.toFixed(0)}%)</span></span>
        </div>
        <div className="w-full h-2.5 bg-[#ef4444]/20 rounded-full overflow-hidden flex border border-[#0d0d0d]">
          <div
            style={{ width: `${yesPct}%` }}
            className="h-full bg-[#22c55e] transition-all duration-700 ease-out"
          />
        </div>
        <div className="text-center text-[9px] font-mono text-[#9e8e78]">
          {bids.length + asks.length} active limit order{bids.length + asks.length !== 1 ? "s" : ""} on CLOB · Click ⚡ Fill to match order
        </div>
      </div>
    </div>
  );
});
