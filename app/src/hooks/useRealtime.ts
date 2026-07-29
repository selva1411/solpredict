"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type MessageHandler = (data: Record<string, unknown>) => void;

interface QueuedMessage {
  type: string;
  payload?: Record<string, unknown>;
  queuedAt: number;
}

interface RealtimeState {
  connected: boolean;
  subscriptions: string[];
  error: string | null;
  reconnectAttempt: number;
  lastEventTimestamp: number | null;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL
  || (typeof window !== "undefined" ? process.env.NEXT_PUBLIC_WS_PORT : "")
  || "";

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY = 1000;
const MAX_DELAY = 30000;
const HEARTBEAT_INTERVAL = 15000;
const HEARTBEAT_TIMEOUT = 5000;

function getReconnectDelay(attempt: number): number {
  const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
  const jitter = delay * 0.1 * (Math.random() - 0.5);
  return Math.round(delay + jitter);
}

export function useRealtime(channel?: string, handler?: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectAttemptRef = useRef(0);
  const handlerRef = useRef<MessageHandler | undefined>(handler);
  const subscriptionsRef = useRef<string[]>(["global"]);
  const mountedRef = useRef(true);
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const lastEventTimestampRef = useRef<number | null>(null);

  const [state, setState] = useState<RealtimeState>({
    connected: false,
    subscriptions: ["global"],
    error: null,
    reconnectAttempt: 0,
    lastEventTimestamp: null,
  });

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = undefined;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = undefined;
    }
  }, []);

  const startHeartbeat = useCallback((ws: WebSocket) => {
    stopHeartbeat();

    heartbeatTimerRef.current = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        stopHeartbeat();
        return;
      }
      try {
        ws.send(JSON.stringify({ type: "ping" }));
        heartbeatTimeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          ws.close();
        }, HEARTBEAT_TIMEOUT);
      } catch {}
    }, HEARTBEAT_INTERVAL);
  }, [stopHeartbeat]);

  const flushMessageQueue = useCallback((ws: WebSocket) => {
    const queue = messageQueueRef.current;
    messageQueueRef.current = [];
    for (const msg of queue) {
      ws.send(JSON.stringify({ type: msg.type, ...msg.payload }));
    }
  }, []);

  const disconnect = useCallback(() => {
    stopHeartbeat();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = undefined;
    }
    reconnectAttemptRef.current = 0;
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      } else {
        wsRef.current.onopen = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
      }
    }
    wsRef.current = null;
    setState(s => ({ ...s, connected: false, reconnectAttempt: 0 }));
  }, [stopHeartbeat]);

  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    if (!WS_URL) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        reconnectAttemptRef.current = 0;
        setState(s => ({ ...s, connected: true, error: null, reconnectAttempt: 0 }));
        startHeartbeat(ws);

        for (const sub of subscriptionsRef.current) {
          ws.send(JSON.stringify({ type: "subscribe", channels: [sub] }));
        }

        if (lastEventTimestampRef.current) {
          ws.send(JSON.stringify({
            type: "replay",
            since: lastEventTimestampRef.current,
          }));
        }

        flushMessageQueue(ws);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "pong") {
            if (heartbeatTimeoutRef.current) {
              clearTimeout(heartbeatTimeoutRef.current);
              heartbeatTimeoutRef.current = undefined;
            }
            return;
          }

          lastEventTimestampRef.current = Date.now();
          setState(s => ({ ...s, lastEventTimestamp: Date.now() }));

          const { event: eventName, data, channel: msgChannel } = msg;

          if (msgChannel) {
            const channelHandlers = handlersRef.current.get(msgChannel);
            if (channelHandlers) {
              for (const h of channelHandlers) h(data || msg);
            }
          }

          if (eventName) {
            const eventHandlers = handlersRef.current.get(eventName);
            if (eventHandlers) {
              for (const h of eventHandlers) h(data || msg);
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        stopHeartbeat();
        if (!mountedRef.current) return;
        setState(s => ({ ...s, connected: false }));
        const attempt = reconnectAttemptRef.current;
        if (attempt >= MAX_RECONNECT_ATTEMPTS) return;
        const delay = getReconnectDelay(attempt);
        reconnectAttemptRef.current = attempt + 1;
        reconnectTimerRef.current = setTimeout(() => connectRef.current?.(), delay);
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setState(s => ({ ...s, error: "WebSocket connection error" }));
      };
    } catch {
      if (!mountedRef.current) return;
      setState(s => ({ ...s, error: "Failed to create WebSocket" }));
    }
  }, [startHeartbeat, flushMessageQueue]);

  connectRef.current = connect;

  const subscribe = useCallback((ch: string) => {
    if (!subscriptionsRef.current.includes(ch)) {
      subscriptionsRef.current.push(ch);
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", channels: [ch] }));
    }
    setState(s => {
      if (s.subscriptions.includes(ch)) return s;
      return { ...s, subscriptions: [...s.subscriptions, ch] };
    });
  }, []);

  const unsubscribe = useCallback((ch: string) => {
    subscriptionsRef.current = subscriptionsRef.current.filter(c => c !== ch);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unsubscribe", channels: [ch] }));
    }
    setState(s => {
      if (!s.subscriptions.includes(ch)) return s;
      return { ...s, subscriptions: s.subscriptions.filter(c => c !== ch) };
    });
  }, []);

  const on = useCallback((eventOrChannel: string, h: MessageHandler) => {
    if (!handlersRef.current.has(eventOrChannel)) {
      handlersRef.current.set(eventOrChannel, new Set());
    }
    handlersRef.current.get(eventOrChannel)!.add(h);
    return () => {
      handlersRef.current.get(eventOrChannel)?.delete(h);
    };
  }, []);

  const send = useCallback((type: string, payload?: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }));
    } else {
      messageQueueRef.current.push({ type, payload, queuedAt: Date.now() });
    }
  }, []);

  useEffect(() => {
    if (channel) {
      subscribe(channel);
      const unsub = on(channel, (data) => {
        handlerRef.current?.(data);
      });
      return () => {
        unsub();
        unsubscribe(channel);
      };
    }
  }, [channel, subscribe, on, unsubscribe]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { ...state, connect, disconnect, subscribe, unsubscribe, on, send };
}
