import { NextResponse } from "next/server";
import { getQuotes, priceableSymbols } from "@/server/marketData";

/**
 * Real, live quotes for marking open copied positions on the dashboard.
 * `?symbols=BTCUSD,ETHUSD` — anything not currently priceable is dropped.
 * With no symbols given, returns every instrument that has a live price.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const requested = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const allowed = new Set(priceableSymbols());
  const ids = (requested.length ? requested.filter((s) => allowed.has(s)) : [...allowed]);

  const quotes = ids.length ? await getQuotes(ids) : {};
  return NextResponse.json({ quotes, at: Date.now() });
}
