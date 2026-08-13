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

  /**
   * Reduce a level's total size by `quantity` WITHOUT removing the order from
   * it — used when a resting maker is partially filled and stays on the book.
   */
  private decrementLevel(map: Map<string, PriceLevel>, price: anchor.BN, quantity: anchor.BN) {
    const key = this.priceKey(price);
    const level = map.get(key);
    if (!level) return;
    level.totalQuantity = level.totalQuantity.sub(quantity);
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
        const map = maker.side === "buy" ? this.bids : this.asks;
        if (maker.remaining.isZero()) {
          // Fully filled: remove the maker from the level (the matched amount
          // is its whole remaining size — NOT its original quantity).
          maker.status = "filled";
          this.removeFromLevel(map, maker.priceLamports, maker.id, match.quantity);
        } else {
          // Partially filled: shrink the level's size but keep the maker
          // resting at this price.
          this.decrementLevel(map, maker.priceLamports, match.quantity);
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
      // matchOrder is pure (placeOrder applies state changes afterwards), so
      // traverse the level by index. Exhaust EVERY resting order at the best
      // price before crossing to the next-worst level (price-optimality).
      let i = 0;
      while (i < level.orders.length && !remaining.isZero()) {
        const makerId = level.orders[i];
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
        // Only advance once this maker is fully consumed (a partial fill keeps
        // matching against the same order on the next iteration).
        if (maker.remaining.eq(matchQty)) i += 1;
      }
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