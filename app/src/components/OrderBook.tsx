"use client";

import { motion } from "framer-motion";

function generateOrderBook(yesPrice: number) {
  const bids: { price: number; size: number; total: number }[] = [];
  const asks: { price: number; size: number; total: number }[] = [];
  let bidTotal = 0, askTotal = 0;
  for (let i = 0; i < 12; i++) {
    const bidPrice = Math.max(0.01, yesPrice - 0.005 - i * 0.008);
    const askPrice = Math.min(0.99, yesPrice + 0.005 + i * 0.008);
    const bidSize = Math.round(50 + Math.random() * 500);
    const askSize = Math.round(50 + Math.random() * 500);
    bidTotal += bidSize;
    askTotal += askSize;
    bids.push({ price: bidPrice, size: bidSize, total: bidTotal });
    asks.push({ price: askPrice, size: askSize, total: askTotal });
  }
  return { bids, asks: asks.reverse() };
}

interface OrderBookProps {
  yesPrice: number;
}

export function OrderBook({ yesPrice }: OrderBookProps) {
  const { bids, asks } = generateOrderBook(yesPrice);
  const maxSize = Math.max(
    ...bids.map(b => b.size),
    ...asks.map(a => a.size)
  );

  return (
    <div className="holo-card p-4">
      <div className="flex items-center justify-between mb-3 relative z-10">
        <h3 className="font-display text-sm font-semibold">Order Book</h3>
        <span className="text-[10px] font-mono text-[#A5A8B8] uppercase tracking-wider">CLOB · Live</span>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-3 text-[10px] font-mono uppercase tracking-wider text-[#A5A8B8] mb-1.5 px-1">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sells) - reversed so highest is at top */}
      <div className="space-y-0.5 mb-2 max-h-[180px] overflow-hidden">
        {asks.map((ask, i) => (
          <motion.div
            key={`ask-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            className="relative grid grid-cols-3 text-[11px] font-mono px-1 py-0.5"
          >
            <div
              className="absolute right-0 top-0 bottom-0 bg-[#FF4D6D]/10"
              style={{ width: `${(ask.size / maxSize) * 100}%` }}
            />
            <span className="text-[#FF4D6D] relative z-10">{ask.price.toFixed(3)}</span>
            <span className="text-right text-[#F4F5FA]/70 relative z-10">{ask.size}</span>
            <span className="text-right text-[#A5A8B8] relative z-10">{ask.total}</span>
          </motion.div>
        ))}
      </div>

      {/* Spread */}
      <div className="flex items-center justify-between py-2 border-y border-white/5 mb-2">
        <span className="text-[10px] font-mono text-[#A5A8B8]">SPREAD</span>
        <div className="flex items-center gap-2">
          <span className="text-base font-mono font-bold text-[#C8FF00]">
            ${yesPrice.toFixed(3)}
          </span>
          <span className="text-[10px] font-mono text-[#A5A8B8]">
            ${(asks[0].price - bids[0].price).toFixed(3)}
          </span>
        </div>
      </div>

      {/* Bids (buys) */}
      <div className="space-y-0.5 max-h-[180px] overflow-hidden">
        {bids.map((bid, i) => (
          <motion.div
            key={`bid-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            className="relative grid grid-cols-3 text-[11px] font-mono px-1 py-0.5"
          >
            <div
              className="absolute right-0 top-0 bottom-0 bg-[#C8FF00]/10"
              style={{ width: `${(bid.size / maxSize) * 100}%` }}
            />
            <span className="text-[#C8FF00] relative z-10">{bid.price.toFixed(3)}</span>
            <span className="text-right text-[#F4F5FA]/70 relative z-10">{bid.size}</span>
            <span className="text-right text-[#A5A8B8] relative z-10">{bid.total}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
