import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

let cachedPrice = 0;
let cacheTime = 0;
const CACHE_MS = 30_000;

async function fetchFromCoinGecko(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
    { next: { revalidate: 30 } }
  );
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const json = await res.json();
  const price = json?.solana?.usd;
  if (typeof price !== "number" || !(price > 0)) throw new Error("invalid price");
  return price;
}

async function fetchFromBinance(): Promise<number> {
  const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const json = await res.json();
  const price = parseFloat(json?.price);
  if (!(price > 0)) throw new Error("invalid price");
  return price;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const now = Date.now();
  if (cachedPrice > 0 && now - cacheTime < CACHE_MS) {
    return ok({ ok: true, price: cachedPrice, source: "cache" });
  }

  let price = 0;
  let source = "none";
  try {
    price = await fetchFromCoinGecko();
    source = "coingecko";
  } catch {
    try {
      price = await fetchFromBinance();
      source = "binance";
    } catch {
      return serverError("Unable to fetch SOL price");
    }
  }

  cachedPrice = price;
  cacheTime = now;
  return ok({ ok: true, price, source });
});