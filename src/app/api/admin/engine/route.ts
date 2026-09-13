import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { providerPositions } from "@/db/schema";
import { isAdminAuthed } from "@/server/adminAuth";
import { adminEngineData } from "@/server/copyEngineAdmin";
import {
  closeProviderPosition,
  openProviderPosition,
  runEngineTick,
  settlementMode,
} from "@/server/copyEngine";
import { getQuotes, priceableSymbols } from "@/server/marketData";
import { createProvider, listProviders } from "@/server/providers";

/** Admin copy-engine monitor: overview + manual open/close/tick. */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  const data = await adminEngineData(db);
  const providers = (await listProviders(db, { activeOnly: true })).map((p) => ({
    id: p.id,
    name: p.name,
  }));
  const symbols = priceableSymbols();
  const quotes = await getQuotes(symbols);
  return NextResponse.json({ ...data, mode: settlementMode(), providers, symbols, quotes });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const db = getDb();

  if (action === "tick") {
    const tick = await runEngineTick(db);
    return NextResponse.json({ ok: true, tick });
  }

  if (action === "open") {
    const providerId = typeof body?.providerId === "string" ? body.providerId : "";
    const symbol = typeof body?.symbol === "string" ? body.symbol.toUpperCase() : "";
    const side = body?.side === "buy" || body?.side === "sell" ? body.side : null;
    if (!providerId || !symbol || !side) {
      return NextResponse.json({ error: "Provider, symbol and side are required." }, { status: 400 });
    }
    const quotes = await getQuotes([symbol]);
    const price = quotes[symbol];
    if (!price) {
      return NextResponse.json({ error: "No live price for that symbol right now." }, { status: 400 });
    }
    const sizePct = clamp(Number(body?.sizePct) || 0.05, 0.005, 0.25);
    const stopLossPct = body?.stopLossPct != null ? clamp(Number(body.stopLossPct), 0.001, 0.5) : null;
    const takeProfitPct =
      body?.takeProfitPct != null ? clamp(Number(body.takeProfitPct), 0.001, 1) : null;

    const res = await openProviderPosition(db, {
      providerId,
      symbol,
      side,
      price,
      sizePct,
      stopLossPct,
      takeProfitPct,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, positionId: res.positionId, mirrors: res.mirrors });
  }

  if (action === "close") {
    const positionId = typeof body?.positionId === "string" ? body.positionId : "";
    if (!positionId) return NextResponse.json({ error: "positionId is required." }, { status: 400 });
    const [pos] = await db
      .select()
      .from(providerPositions)
      .where(eq(providerPositions.id, positionId))
      .limit(1);
    if (!pos) return NextResponse.json({ error: "Position not found." }, { status: 404 });
    const quotes = await getQuotes([pos.symbol]);
    const price = quotes[pos.symbol];
    if (!price) {
      return NextResponse.json({ error: "No live price to close at right now." }, { status: 400 });
    }
    const res = await closeProviderPosition(db, { positionId, exitPrice: price, reason: "manual" });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json(res);
  }

  if (action === "createProvider") {
    const res = await createProvider(db, {
      name: String(body?.name ?? ""),
      handle: String(body?.handle ?? ""),
      strategy: String(body?.strategy ?? ""),
      bio: String(body?.bio ?? ""),
      country: String(body?.country ?? ""),
      roi12m: Number(body?.roi12m) || 0,
      winRate: clamp(Number(body?.winRate) || 0, 0, 100),
      maxDrawdown: clamp(Number(body?.maxDrawdown) || 0, 0, 100),
      feeBps: Math.round(clamp(Number(body?.feeBps) || 2000, 0, 10000)),
      minInvestment: Math.max(0, Number(body?.minInvestment) || 0),
      verified: Boolean(body?.verified),
      active: true,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: res.id });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
