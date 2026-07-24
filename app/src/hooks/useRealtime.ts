"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type MessageHandler = (data: Record<string, unknown>) => void;

interface RealtimeState {
  connected: boolean;
  subscriptions: string[];
  error: string | null;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || (typeof window !== "undefined"
  ? `ws://${window.location.hostname}:${parseInt(process.env.NEXT_PUBLIC_WS_PORT || "3001")}`
  : "ws://localhost:3001");

export function useRealtime(channel?: string, handler?: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handlerRef = useRef<MessageHandler | undefined>(handler);
  const subscriptionsRef = useRef<string[]>(["global"]);

  const [state, setState] = useState<RealtimeState>({
    connected: false,
    subscriptions: ["global"],
    error: null,
  });

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setState(s => ({ ...s, connected: true, error: null }));
        for (const sub of subscriptionsRef.current) {
          ws.send(JSON.stringify({ type: "subscribe", channels: [sub] }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const { event: eventName, data, channel: msgChannel } = msg;

          if (msgChannel) {
            const channelHandlers = handlersRef.current.get(msgChannel);
            if (channelHandlers) {
              for (const h of channelHandlers) {
                h(data || msg);
              }
            }
          }

          if (eventName) {
            const eventHandlers = handlersRef.current.get(eventName);
            if (eventHandlers) {
              for (const h of eventHandlers) {
                h(data || msg);
              }
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        setState(s => ({ ...s, connected: false }));
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setState(s => ({ ...s, error: "WebSocket connection error" }));
        ws.close();
      };
    } catch {
      setState(s => ({ ...s, error: "Failed to create WebSocket" }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setState(s => ({ ...s, connected: false }));
  }, []);

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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
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