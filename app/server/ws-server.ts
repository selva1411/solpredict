import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { PublicKey } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";

const PORT = parseInt(process.env.WS_PORT || "3001", 10);
const HEARTBEAT_INTERVAL = 30_000;

interface Client {
  ws: WebSocket;
  subscriptions: Set<string>;
  wallet?: string;
  alive: boolean;
}

const clients = new Map<WebSocket, Client>();

function heartbeat(this: WebSocket) {
  const client = clients.get(this);
  if (client) client.alive = true;
}

function broadcast(channel: string, event: string, data: unknown) {
  const message = JSON.stringify({ channel, event, data, timestamp: Date.now() });
  for (const [ws, client] of clients) {
    if (client.subscriptions.has(channel) && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

function sendTo(ws: WebSocket, event: string, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
  }
}

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const client: Client = { ws, subscriptions: new Set(["global"]), alive: true };
  clients.set(ws, client);
  ws.on("pong", heartbeat.bind(ws));

  sendTo(ws, "connected", { clientId: `${Math.random().toString(36).slice(2, 10)}` });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case "subscribe":
          if (msg.channels && Array.isArray(msg.channels)) {
            for (const ch of msg.channels) {
              client.subscriptions.add(ch);
            }
            sendTo(ws, "subscribed", { channels: Array.from(client.subscriptions) });
          }
          break;

        case "unsubscribe":
          if (msg.channels && Array.isArray(msg.channels)) {
            for (const ch of msg.channels) {
              client.subscriptions.delete(ch);
            }
            sendTo(ws, "unsubscribed", { channels: Array.from(client.subscriptions) });
          }
          break;

        case "auth":
          if (msg.wallet && msg.signature && msg.message) {
            try {
              const wallet = new PublicKey(msg.wallet);
              const sigBytes = Uint8Array.from(Buffer.from(msg.signature, "base64"));
              const messageBytes = new TextEncoder().encode(msg.message);
              const valid = ed25519.verify(sigBytes, messageBytes, wallet.toBytes());
              if (valid) {
                client.wallet = msg.wallet;
                sendTo(ws, "authenticated", { wallet: msg.wallet });
              } else {
                sendTo(ws, "auth_error", { error: "Invalid signature" });
              }
            } catch (e) {
              sendTo(ws, "auth_error", { error: "Authentication failed" });
            }
          }
          break;

        case "ping":
          sendTo(ws, "pong", {});
          break;
      }
    } catch {
      sendTo(ws, "error", { error: "Invalid message format" });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });

  ws.on("error", () => {
    clients.delete(ws);
  });
});

const interval = setInterval(() => {
  for (const [ws, client] of clients) {
    if (!client.alive) {
      ws.terminate();
      clients.delete(ws);
      continue;
    }
    client.alive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL);

wss.on("close", () => clearInterval(interval));

server.listen(PORT, () => {
  console.log(`[WS] WebSocket server listening on ws://0.0.0.0:${PORT}`);
});

export { broadcast, clients, sendTo };