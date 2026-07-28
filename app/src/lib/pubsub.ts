import { EventEmitter } from "events";
import { logger } from "@/lib/logger";

const REDIS_URL = process.env.REDIS_URL;
const USE_REDIS = Boolean(REDIS_URL);

let redisPublisher: import("ioredis").Redis | null = null;
let redisSubscriber: import("ioredis").Redis | null = null;
const localBus = new EventEmitter();
localBus.setMaxListeners(100);

const CHANNELS = {
  MARKET_UPDATES: "market:updates",
  TRADES: "market:trades",
  ORDERBOOK: "market:orderbook",
  NOTIFICATIONS: "user:notifications",
  SYSTEM: "system:events",
} as const;

export type PubSubChannel = (typeof CHANNELS)[keyof typeof CHANNELS];

export interface PubSubMessage {
  channel: PubSubChannel;
  event: string;
  data: unknown;
  timestamp: number;
}

async function getRedis(): Promise<{
  publisher: import("ioredis").Redis;
  subscriber: import("ioredis").Redis;
} | null> {
  if (!USE_REDIS) return null;
  if (redisPublisher && redisSubscriber) return { publisher: redisPublisher, subscriber: redisSubscriber };

  try {
    const Redis = (await import("ioredis")).default;
    redisPublisher = new Redis(REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 3 });
    redisSubscriber = new Redis(REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 3 });
    await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);

    redisSubscriber.on("message", (channel: string, message: string) => {
      try {
        const parsed: PubSubMessage = JSON.parse(message);
        localBus.emit(parsed.channel, parsed);
      } catch {}
    });

    for (const channel of Object.values(CHANNELS)) {
      await redisSubscriber.subscribe(channel);
    }

    return { publisher: redisPublisher, subscriber: redisSubscriber };
  } catch (e) {
    logger.warn("Redis connection failed, falling back to in-memory pub/sub:", e);
    redisPublisher = null;
    redisSubscriber = null;
    return null;
  }
}

export async function publish(channel: PubSubChannel, event: string, data: unknown) {
  const message: PubSubMessage = { channel, event, data, timestamp: Date.now() };
  localBus.emit(channel, message);

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.publisher.publish(channel, JSON.stringify(message));
    } catch (e) {
      logger.warn("Redis publish failed:", e);
    }
  }
}

export function subscribe(
  channel: PubSubChannel,
  handler: (msg: PubSubMessage) => void,
): () => void {
  localBus.on(channel, handler);
  return () => {
    localBus.off(channel, handler);
  };
}

export function subscribeEvent(
  channel: PubSubChannel,
  event: string,
  handler: (msg: PubSubMessage) => void,
): () => void {
  const wrapped = (msg: PubSubMessage) => {
    if (msg.event === event) handler(msg);
  };
  localBus.on(channel, wrapped);
  return () => {
    localBus.off(channel, wrapped);
  };
}

export async function disconnectRedis() {
  if (redisSubscriber) {
    for (const channel of Object.values(CHANNELS)) {
      await redisSubscriber.unsubscribe(channel).catch(() => {});
    }
    redisSubscriber.disconnect();
    redisSubscriber = null;
  }
  if (redisPublisher) {
    redisPublisher.disconnect();
    redisPublisher = null;
  }
}

export { CHANNELS };