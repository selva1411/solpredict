import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Orderbook, clearAllOrderbooks, getOrderbook, type Order, OrderSide } from "./orderbook";

const bn = (n: number) => new anchor.BN(n);

function makeOrder(overrides: Partial<Order> = {}): Order {
  const base: Order = {
    id: `o-${Math.random().toString(36).slice(2, 8)}`,
    marketPubkey: PublicKey.unique(),
    maker: PublicKey.unique(),
    side: "buy",
    token: "YES",
    type: "limit",
    priceLamports: bn(1000),
    quantity: bn(100),
    filled: bn(0),
    remaining: bn(100),
    status: "open",
    createdAt: Date.now(),
  };
  const merged = { ...base, ...overrides };
  // Keep remaining in sync with quantity unless the caller set it explicitly.
  if (overrides.remaining === undefined) {
    merged.remaining = merged.quantity;
  }
  return merged;
}

describe("clob orderbook", () => {
  let book: Orderbook;
  const market = PublicKey.unique();

  beforeEach(() => {
    clearAllOrderbooks();
    book = new Orderbook(market);
  });

  afterEach(() => {
    clearAllOrderbooks();
  });

  it("places a resting limit bid/ask on the book", () => {
    const bid = makeOrder({ side: "buy", priceLamports: bn(1000), quantity: bn(50) });
    book.placeOrder(bid);
    const bids = book.getBids();
    expect(bids).toHaveLength(1);
    expect(bids[0].totalQuantity.toString()).toBe("50");
    expect(bids[0].orders).toEqual([bid.id]);
    expect(book.getAsks()).toHaveLength(0);
  });

  it("sorts bids descending and asks ascending by price", () => {
    book.placeOrder(makeOrder({ side: "buy", priceLamports: bn(800), quantity: bn(10) }));
    book.placeOrder(makeOrder({ side: "buy", priceLamports: bn(1200), quantity: bn(10) }));
    book.placeOrder(makeOrder({ side: "sell", priceLamports: bn(900), quantity: bn(10) }));
    book.placeOrder(makeOrder({ side: "sell", priceLamports: bn(700), quantity: bn(10) }));

    const bids = book.getBids().map((l) => l.price.toNumber());
    const asks = book.getAsks().map((l) => l.price.toNumber());
    expect(bids).toEqual([1200, 800]);
    expect(asks).toEqual([700, 900]);
  });

  it("market buy matches the cheapest ask and fills it fully", () => {
    const ask1 = makeOrder({ side: "sell", priceLamports: bn(900), quantity: bn(40) });
    const ask2 = makeOrder({ side: "sell", priceLamports: bn(700), quantity: bn(30) });
    book.placeOrder(ask1);
    book.placeOrder(ask2);

    const taker = makeOrder({ side: "buy", type: "market", priceLamports: bn(0), quantity: bn(30) });
    const updates = book.placeOrder(taker);

    // Matched against the CHEAPEST ask (700) — price-optimal.
    const match = updates[0].match?.[0];
    expect(match?.makerOrderId).toBe(ask2.id);
    expect(match?.quantity.toString()).toBe("30");

    const maker = book.getOrder(ask2.id)!;
    expect(maker.status).toBe("filled");
    // Fully-filled maker is removed from the level.
    const asks = book.getAsks();
    expect(asks.find((l) => l.price.eq(bn(700)))).toBeUndefined();
    expect(asks.find((l) => l.price.eq(bn(900)))?.totalQuantity.toString()).toBe("40");
  });

  it("partial fill reduces the maker's level size but keeps it resting", () => {
    const ask = makeOrder({ side: "sell", priceLamports: bn(900), quantity: bn(100) });
    book.placeOrder(ask);

    // Taker buys only 40 of the 100 on offer.
    const taker = makeOrder({ side: "buy", type: "market", priceLamports: bn(0), quantity: bn(40) });
    book.placeOrder(taker);

    const maker = book.getOrder(ask.id)!;
    expect(maker.status).toBe("open");
    expect(maker.filled.toString()).toBe("40");
    expect(maker.remaining.toString()).toBe("60");

    // Level must show the REMAINING size, and the maker must still be in it.
    const asks = book.getAsks();
    expect(asks).toHaveLength(1);
    expect(asks[0].totalQuantity.toString()).toBe("60");
    expect(asks[0].orders).toContain(ask.id);
  });

  it("matches across multiple levels when one level is exhausted", () => {
    book.placeOrder(makeOrder({ side: "sell", priceLamports: bn(900), quantity: bn(30) }));
    book.placeOrder(makeOrder({ side: "sell", priceLamports: bn(950), quantity: bn(50) }));

    const taker = makeOrder({ side: "buy", type: "market", priceLamports: bn(0), quantity: bn(60) });
    const updates = book.placeOrder(taker);

    const matches = updates[0].match ?? [];
    expect(matches).toHaveLength(2);
    const total = matches.reduce((s, m) => s.add(m.quantity), bn(0));
    expect(total.toString()).toBe("60");

    const asks = book.getAsks();
    // 30-ask level fully consumed, 50-ask level partially filled to 20 remaining.
    expect(asks.find((l) => l.price.eq(bn(900)))).toBeUndefined();
    expect(asks.find((l) => l.price.eq(bn(950)))?.totalQuantity.toString()).toBe("20");
  });

  it("exhausts ALL orders at the best price level before crossing to worse prices", () => {
    // Two asks stacked at the SAME best price (700): 20 + 30 = 50 total.
    const a1 = makeOrder({ side: "sell", priceLamports: bn(700), quantity: bn(20) });
    const a2 = makeOrder({ side: "sell", priceLamports: bn(700), quantity: bn(30) });
    book.placeOrder(a1);
    book.placeOrder(a2);
    book.placeOrder(makeOrder({ side: "sell", priceLamports: bn(900), quantity: bn(40) }));

    // Taker wants 40 — must consume both 700-orders (20 + 20 of the 30)
    // WITHOUT touching the 900 level (price-optimality).
    const taker = makeOrder({ side: "buy", type: "market", priceLamports: bn(0), quantity: bn(40) });
    const updates = book.placeOrder(taker);

    const matches = updates[0].match ?? [];
    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.priceLamports.eq(bn(700)))).toBe(true);

    const asks = book.getAsks();
    expect(asks.find((l) => l.price.eq(bn(700)))?.totalQuantity.toString()).toBe("10");
    expect(asks.find((l) => l.price.eq(bn(900)))?.totalQuantity.toString()).toBe("40");

    const a1After = book.getOrder(a1.id)!;
    const a2After = book.getOrder(a2.id)!;
    expect(a1After.status).toBe("filled");
    expect(a2After.status).toBe("open");
    expect(a2After.filled.toString()).toBe("20");
    expect(a2After.remaining.toString()).toBe("10");
  });

  it("market order that cannot fully fill leaves the rest open", () => {
    book.placeOrder(makeOrder({ side: "sell", priceLamports: bn(900), quantity: bn(10) }));

    const taker = makeOrder({ side: "buy", type: "market", priceLamports: bn(0), quantity: bn(100) });
    book.placeOrder(taker);

    expect(taker.status).toBe("open");
    expect(taker.filled.toString()).toBe("10");
    expect(taker.remaining.toString()).toBe("90");
  });

  it("cancel removes the order from its level", () => {
    const bid = makeOrder({ side: "buy", priceLamports: bn(1000), quantity: bn(50) });
    book.placeOrder(bid);
    book.cancelOrder(bid.id);

    expect(book.getOrder(bid.id)?.status).toBe("cancelled");
    expect(book.getBids()).toHaveLength(0);
  });

  it("cancel of a partially-filled order removes only its remaining size", () => {
    const ask = makeOrder({ side: "sell", priceLamports: bn(900), quantity: bn(100) });
    book.placeOrder(ask);
    book.placeOrder(makeOrder({ side: "buy", type: "market", priceLamports: bn(0), quantity: bn(40) }));

    book.cancelOrder(ask.id);
    // Level is gone — nothing left on the book at this price.
    expect(book.getAsks()).toHaveLength(0);
  });

  it("getOrderbook returns the same instance per market", () => {
    expect(getOrderbook(market)).toBe(getOrderbook(market));
  });

  it("expires open orders past their deadline", () => {
    const bid = makeOrder({ side: "buy", priceLamports: bn(1000), quantity: bn(50), expiresAt: Date.now() - 1000 });
    book.placeOrder(bid);
    book.pruneExpired(Date.now());
    expect(book.getOrder(bid.id)?.status).toBe("expired");
    expect(book.getBids()).toHaveLength(0);
  });
});

describe("clob getOrdersByMaker / getOpenOrders", () => {
  it("filters by maker and open status", () => {
    clearAllOrderbooks();
    const maker = PublicKey.unique();
    const book = getOrderbook(PublicKey.unique());
    book.placeOrder(makeOrder({ maker, side: "buy", quantity: bn(10) }));
    book.placeOrder(makeOrder({ maker, side: "buy", quantity: bn(20) }));
    book.placeOrder(makeOrder({ maker: PublicKey.unique(), side: "buy", quantity: bn(30) }));

    const mine = book.getOrdersByMaker(maker);
    expect(mine).toHaveLength(2);
    expect(book.getOpenOrders()).toHaveLength(3);

    book.cancelOrder(mine[0].id);
    expect(book.getOpenOrders()).toHaveLength(2);
  });
});

describe("clob side/token typing", () => {
  it("accepts buy/sell on YES and NO tokens", () => {
    clearAllOrderbooks();
    const book = getOrderbook(PublicKey.unique());
    const sides: OrderSide[] = ["buy", "sell"];
    for (const side of sides) {
      for (const token of ["YES", "NO"] as const) {
        const o = makeOrder({ side, token, quantity: bn(1) });
        book.placeOrder(o);
        expect(book.getOrder(o.id)?.status).toBe("open");
      }
    }
  });
});
