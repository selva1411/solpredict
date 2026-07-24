import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WS_PORT = process.env.WS_PORT || "3001";

export function GET(req: NextRequest) {
  if (req.headers.get("upgrade") === "websocket") {
    return new NextResponse(null, { status: 101 });
  }

  return NextResponse.json({
    status: "available",
    wsUrl: `ws://${req.headers.get("host")?.split(":")[0] || "localhost"}:${WS_PORT}`,
    channels: [
      { name: "global", description: "All public events" },
      { name: "market:{pubkey}", description: "Per-market updates (trades, price changes)" },
      { name: "user:{wallet}", description: "Personal notifications and position updates" },
      { name: "admin", description: "Admin-only events (settlements, fee withdrawals)" },
    ],
    auth: "Send { type: 'auth', wallet, signature, message } after connecting",
    docs: "npm run ws:start to start the WebSocket server on port " + WS_PORT,
  });
}