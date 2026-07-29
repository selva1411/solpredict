import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WS_PORT = process.env.WS_PORT || "3001";

export const GET = apiHandler(async (req) => {
  const host = req.headers.get("host")?.split(":")[0] || "localhost";

  return ok({
    status: "available",
    wsUrl: `ws://${host}:${WS_PORT}`,
    channels: [
      { name: "global", description: "All public events" },
      { name: "market:{pubkey}", description: "Per-market updates (trades, price changes)" },
      { name: "user:{wallet}", description: "Personal notifications and position updates" },
      { name: "admin", description: "Admin-only events (settlements, fee withdrawals)" },
    ],
    auth: "Send { type: 'auth', wallet, signature, message } after connecting",
    docs: "npm run ws:start to start the WebSocket server on port " + WS_PORT,
  });
});
