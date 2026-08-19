import { WebSocketServer, WebSocket } from "ws";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { randomUUID } from "crypto";
import { PublicKey, Connection, Logs } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";

const PORT = parseInt(process.env.WS_PORT || "3001", 10);
const NEXT_PORT = parseInt(process.env.NEXT_PORT || "3000", 10);
const API_BASE = `http://127.0.0.1:${NEXT_PORT}/api`;
const HEARTBEAT_INTERVAL = 30_000;
// Slow safety-net poll only. The primary trigger is on-chain program logs
// (pushes) plus an explicit /broadcast HTTP endpoint used after a confirmed
// trade. Polling is kept purely as a fallback for events the chain pubsub
// missed, not as the source of freshness.
const DB_POLL_MS = 15_000;

// --- On-chain subscription config ---
// The WS server runs standalone (outside Next.js), so it cannot use the app's
// /api/rpc proxy. Connect straight to the local validator like the indexer does.
const CHAIN_RPC =
  process.env.LOCALNET_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL?.replace("http://localhost:3000/api/rpc", "http://127.0.0.1:8899") ??
  "http://127.0.0.1:8899";
const CHAIN_WS = process.env.LOCALNET_WS_URL ?? "ws://127.0.0.1:8900";
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG"
);

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

// --- DB reads (source of truth for the UI) ---
interface PollCache {
  markets: string;
  activities: string;
  leaderboard: string;
  positions: Map<string, string>;
}

const cache: PollCache = { markets: "", activities: "", leaderboard: "", positions: new Map() };

async function pollMarkets() {
  try {
    const res = await fetch(`${API_BASE}/markets/cached`);
    if (!res.ok) return;
    const body = await res.json();
    const serialized = JSON.stringify(body.markets || []);
    if (serialized !== cache.markets) {
      cache.markets = serialized;
      broadcast("markets", "update", body.markets || []);
      broadcast("global", "markets", body.markets || []);
    }
  } catch { /* next.js not ready yet */ }
}

async function pollActivities() {
  try {
    const res = await fetch(`${API_BASE}/activity/recent`);
    if (!res.ok) return;
    const body = await res.json();
    const serialized = JSON.stringify(body.activities || []);
    if (serialized !== cache.activities) {
      cache.activities = serialized;
      broadcast("trades", "update", body.activities || []);
      broadcast("global", "activity", body.activities || []);
    }
  } catch { /* next.js not ready yet */ }
}

async function pollLeaderboard() {
  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    if (!res.ok) return;
    const body = await res.json();
    const serialized = JSON.stringify(body.leaderboard || []);
    if (serialized !== cache.leaderboard) {
      cache.leaderboard = serialized;
      broadcast("leaderboard", "update", body.leaderboard || []);
      broadcast("global", "leaderboard", body.leaderboard || []);
    }
  } catch { /* next.js not ready yet */ }
}

/** Re-read one user's positions and broadcast to anyone subscribed to that
 * wallet's channel. Called after a confirmed trade so the portfolio page of
 * the SAME wallet on OTHER tabs/sessions updates immediately too. */
async function refreshUserPositions(wallet?: string) {
  if (!wallet) return;
  const channel = `positions:${wallet}`;
  const subscribed = Array.from(clients.values()).some((c) => c.subscriptions.has(channel));
  if (!subscribed) return;
  try {
    const res = await fetch(`${API_BASE}/user/positions?wallet=${encodeURIComponent(wallet)}`);
    if (!res.ok) return;
    const body = await res.json();
    const serialized = JSON.stringify(body.positions || []);
    if (serialized !== cache.positions.get(wallet)) {
      cache.positions.set(wallet, serialized);
      broadcast(channel, "positions", body.positions || []);
    }
  } catch { /* skip */ }
}

/** Re-read every channel a connected client cares about and broadcast. */
async function refreshAll() {
  await Promise.all([pollMarkets(), pollActivities(), pollLeaderboard()]);
  const wallets = new Set<string>();
  for (const client of clients.values()) {
    if (client.wallet) wallets.add(client.wallet);
    for (const ch of client.subscriptions) {
      const m = ch.match(/^positions:(.+)$/);
      if (m) wallets.add(m[1]);
    }
  }
  await Promise.all(Array.from(wallets).map((w) => refreshUserPositions(w)));
}

// --- On-chain push subscription ---
let chainConnection: Connection | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounce multiple rapid on-chain logs into a single refresh pass. */
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    refreshAll();
  }, 700);
}

function startChainSubscription() {
  try {
    chainConnection = new Connection(CHAIN_RPC, {
      wsEndpoint: CHAIN_WS,
      confirmTransactionInitialTimeout: 10_000,
    });
    // Fire on every successful program invocation (buy/sell/settle/claim/LP).
    // When ANY transaction touches the program we re-read the DB and push it
    // to every subscribed client — genuine push, no polling.
    chainConnection.onLogs(PROGRAM_ID, (logs: Logs) => {
      if (!logs.err) scheduleRefresh();
    });
    console.log(`[WS] subscribed to on-chain program logs @ ${CHAIN_RPC} (${PROGRAM_ID.toBase58()})`);
  } catch (e) {
    console.warn("[WS] failed to subscribe to on-chain logs, falling back to polling:", e);
  }
}

// --- HTTP handler on the same server for explicit refresh triggers ---
function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const url = (req.url || "").split("?")[0];
  const method = (req.method || "GET").toUpperCase();

  if (url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, clients: clients.size, onchain: !!chainConnection }));
    return;
  }

  if (url === "/broadcast" && method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let wallet: string | undefined;
      try {
        const parsed = JSON.parse(body || "{}");
        wallet = parsed.wallet;
      } catch { /* ignore */ }
      await refreshAll();
      if (wallet) await refreshUserPositions(wallet);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, clients: clients.size }));
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not found" }));
}

// --- WebSocket server ---
const server = createServer(handleHttp);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const client: Client = { ws, subscriptions: new Set(["global"]), alive: true };
  clients.set(ws, client);
  ws.on("pong", heartbeat.bind(ws));

  sendTo(ws, "connected", { clientId: randomUUID() });

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
            // Push any cached data for the newly-subscribed channels.
            for (const ch of msg.channels) {
              const pos = ch.match(/^positions:(.+)$/);
              if (pos) refreshUserPositions(pos[1]);
            }
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

const heartbeatInterval = setInterval(() => {
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

wss.on("close", () => clearInterval(heartbeatInterval));

server.listen(PORT, () => {
  console.log(`[WS] WebSocket server listening on ws://0.0.0.0:${PORT}`);
  console.log(`[WS] HTTP refresh endpoint: POST http://127.0.0.1:${PORT}/broadcast`);
  startChainSubscription();
  // Safety-net poll only; freshness comes from on-chain push + /broadcast.
  pollMarkets();
  pollActivities();
  setInterval(pollMarkets, DB_POLL_MS);
  setInterval(pollActivities, DB_POLL_MS);
  setInterval(pollLeaderboard, DB_POLL_MS);
});

export { broadcast, clients, sendTo, refreshAll, refreshUserPositions };