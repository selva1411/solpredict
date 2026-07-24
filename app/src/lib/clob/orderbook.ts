import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market";
export type OrderStatus = "open" | "matched" | "cancelled" | "filled" | "expired";

export interface Order {
  id: string;
  marketPubkey: PublicKey;
  maker: PublicKey;
  side: OrderSide;
  token: "YES" | "NO";
  type: OrderType;
  priceLamports: anchor.BN;
  quantity: anchor.BN;
  filled: anchor.BN;
  remaining: anchor.BN;
  status: OrderStatus;
  createdAt: number;
  expiresAt?: number;
}

export interface Match {
  takerOrderId: string;
  makerOrderId: string;
  side: OrderSide;
  token: "YES" | "NO";
  priceLamports: anchor.BN;
  quantity: anchor.BN;
}

export interface OrderUpdate {
  type: "placed" | "matched" | "cancelled" | "filled";
  order: Order;
  match?: Match[];
}

export interface PriceLevel {
  price: anchor.BN;
  totalQuantity: anchor.BN;
  orders: string[];
}

export class Orderbook {
  private bids: Map<string, PriceLevel> = new Map();
  private asks: Map<string, PriceLevel> = new Map();
  private orders: Map<string, Order> = new Map();
  private listeners: ((update: OrderUpdate) => void)[] = [];
  private marketPubkey: PublicKey;

  constructor(marketPubkey: PublicKey) {
    this.marketPubkey = marketPubkey;
  }

  private priceKey(price: anchor.BN): string {
    return price.toString();
  }

  private addToLevel(map: Map<string, PriceLevel>, price: anchor.BN, orderId: string, quantity: anchor.BN) {
    const key = this.priceKey(price);
    const existing = map.get(key);
    if (existing) {
      existing.totalQuantity = existing.totalQuantity.add(quantity);
      existing.orders.push(orderId);
    } else {
      map.set(key, { price, totalQuantity: quantity, orders: [orderId] });
    }
  }

  private removeFromLevel(map: Map<string, PriceLevel>, price: anchor.BN, orderId: string, quantity: anchor.BN) {
    const key = this.priceKey(price);
    const level = map.get(key);
    if (!level) return;
    level.totalQuantity = level.totalQuantity.sub(quantity);
    level.orders = level.orders.filter(id => id !== orderId);
    if (level.orders.length === 0) {
      map.delete(key);
    }
  }

  private removeLevel(map: Map<string, PriceLevel>, price: anchor.BN) {
    map.delete(this.priceKey(price));
  }

  placeOrder(order: Order): OrderUpdate[] {
    const updates: OrderUpdate[] = [];
    let remaining = order.quantity;

    if (order.type === "market") {
      const matches = this.matchOrder(order);
      for (const match of matches) {
        const maker = this.orders.get(match.makerOrderId)!;
        maker.filled = maker.filled.add(match.quantity);
        maker.remaining = maker.remaining.sub(match.quantity);
        if (maker.remaining.isZero()) {
          maker.status = "filled";
          this.removeFromLevel(
            maker.side === "buy" ? this.bids : this.asks,
            maker.priceLamports,
            maker.id,
            maker.quantity,
          );
        }
        remaining = remaining.sub(match.quantity);
      }
      if (!remaining.isZero()) {
        order.filled = order.quantity.sub(remaining);
        order.remaining = remaining;
        order.status = "open";
      } else {
        order.filled = order.quantity;
        order.remaining = new anchor.BN(0);
        order.status = "filled";
      }
      updates.push({ type: "matched", order, match: matches });
    } else {
      this.orders.set(order.id, order);
      const map = order.side === "buy" ? this.bids : this.asks;
      this.addToLevel(map, order.priceLamports, order.id, order.quantity);
      updates.push({ type: "placed", order });
    }

    if (updates.length > 0) {
      for (const update of updates) {
        this.emit(update);
      }
    }

    return updates;
  }

  cancelOrder(orderId: string): Order | null {
    const order = this.orders.get(orderId);
    if (!order || order.status !== "open") return null;
    order.status = "cancelled";
    const map = order.side === "buy" ? this.bids : this.asks;
    this.removeFromLevel(map, order.priceLamports, orderId, order.remaining);
    this.emit({ type: "cancelled", order });
    return order;
  }

  private matchOrder(taker: Order): Match[] {
    const matches: Match[] = [];
    const map = taker.side === "buy" ? this.asks : this.bids;

    const sortedLevels = Array.from(map.entries())
      .map(([, level]) => level)
      .sort((a, b) => {
        return taker.side === "buy"
          ? a.price.cmp(b.price)
          : b.price.cmp(a.price);
      });

    let remaining = taker.quantity;
    for (const level of sortedLevels) {
      if (remaining.isZero()) break;
      const makerId = level.orders[0];
      const maker = this.orders.get(makerId)!;
      const matchQty = anchor.BN.min(remaining, maker.remaining);
      matches.push({
        takerOrderId: taker.id,
        makerOrderId: makerId,
        side: taker.side,
        token: taker.token,
        priceLamports: maker.priceLamports,
        quantity: matchQty,
      });
      remaining = remaining.sub(matchQty);
    }

    return matches;
  }

  getBids(): PriceLevel[] {
    return Array.from(this.bids.values()).sort((a, b) => b.price.cmp(a.price));
  }

  getAsks(): PriceLevel[] {
    return Array.from(this.asks.values()).sort((a, b) => a.price.cmp(b.price));
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  getOrdersByMaker(maker: PublicKey): Order[] {
    return Array.from(this.orders.values()).filter(o => o.maker.equals(maker));
  }

  getOpenOrders(): Order[] {
    return Array.from(this.orders.values()).filter(o => o.status === "open");
  }

  pruneExpired(now: number) {
    for (const [id, order] of this.orders) {
      if (order.expiresAt && order.expiresAt < now && order.status === "open") {
        order.status = "expired";
        const map = order.side === "buy" ? this.bids : this.asks;
        this.removeFromLevel(map, order.priceLamports, id, order.remaining);
        this.emit({ type: "cancelled", order });
      }
    }
  }

  subscribe(listener: (update: OrderUpdate) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(update: OrderUpdate) {
    for (const listener of this.listeners) {
      try {
        listener(update);
      } catch {}
    }
  }

  clear() {
    this.bids.clear();
    this.asks.clear();
    this.orders.clear();
    this.listeners = [];
  }
}

const bookInstances = new Map<string, Orderbook>();

export function getOrderbook(marketPubkey: PublicKey): Orderbook {
  const key = marketPubkey.toBase58();
  if (!bookInstances.has(key)) {
    bookInstances.set(key, new Orderbook(marketPubkey));
  }
  return bookInstances.get(key)!;
}

export function clearAllOrderbooks() {
  for (const book of bookInstances.values()) {
    book.clear();
  }
  bookInstances.clear();
}