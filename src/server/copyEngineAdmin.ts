import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { copyPositions, providerPositions, signalProviders } from "@/db/schema";
import { positionPnl } from "./copyEngine";
import { getLiveQuotes } from "./marketData";

/**
 * Aggregated view of the copy engine for the admin monitor: every open provider
 * position with its mirror count / staked total / live unrealized P&L, plus
 * platform-wide totals and recently closed positions. Read-only — actions
 * (open / close / tick) go through the copy engine directly.
 */
export async function adminEngineData(db: Database) {
  const quotes = await getLiveQuotes();

  const provRows = await db
    .select({ pos: providerPositions, providerName: signalProviders.name })
    .from(providerPositions)
    .innerJoin(signalProviders, eq(providerPositions.providerId, signalProviders.id))
    .where(eq(providerPositions.status, "open"))
    .orderBy(desc(providerPositions.openedAt));

  const posIds = provRows.map((r) => r.pos.id);
  const openMirrors = posIds.length
    ? await db
        .select()
        .from(copyPositions)
        .where(
          and(
            inArray(copyPositions.providerPositionId, posIds),
            eq(copyPositions.status, "open"),
          ),
        )
    : [];

  const mirrorsByPos = new Map<string, typeof openMirrors>();
  for (const m of openMirrors) {
    const list = mirrorsByPos.get(m.providerPositionId) ?? [];
    list.push(m);
    mirrorsByPos.set(m.providerPositionId, list);
  }

  const positions = provRows.map((r) => {
    const ms = mirrorsByPos.get(r.pos.id) ?? [];
    const staked = ms.reduce((s, m) => s + m.stakeMinor, 0);
    const price = quotes[r.pos.symbol] ?? null;
    const entry = Number(r.pos.entryPrice);
    const slPct = r.pos.stopLossPct != null ? Number(r.pos.stopLossPct) : 0.02;
    const unrealized =
      price != null
        ? ms.reduce((s, m) => s + positionPnl(m.side, entry, price, m.stakeMinor, slPct), 0)
        : null;
    return {
      id: r.pos.id,
      provider: r.providerName,
      symbol: r.pos.symbol,
      side: r.pos.side,
      entryPrice: entry,
      currentPrice: price,
      sizePct: Number(r.pos.sizePct),
      stopLossPct: r.pos.stopLossPct != null ? Number(r.pos.stopLossPct) : null,
      takeProfitPct: r.pos.takeProfitPct != null ? Number(r.pos.takeProfitPct) : null,
      mirrors: ms.length,
      stakedMinor: staked,
      unrealizedMinor: unrealized,
      openedAt: new Date(r.pos.openedAt).toISOString(),
    };
  });

  const stakedTotal = openMirrors.reduce((s, m) => s + m.stakeMinor, 0);
  const copiers = new Set(openMirrors.map((m) => m.userId)).size;
  const unrealizedTotal = positions.reduce((s, p) => s + (p.unrealizedMinor ?? 0), 0);

  const closed = await db
    .select({ v: copyPositions.realizedPnl })
    .from(copyPositions)
    .where(eq(copyPositions.status, "closed"));
  const realizedTotal = closed.reduce((s, r) => s + (r.v ?? 0), 0);

  const recent = await db
    .select({ pos: providerPositions, providerName: signalProviders.name })
    .from(providerPositions)
    .innerJoin(signalProviders, eq(providerPositions.providerId, signalProviders.id))
    .where(eq(providerPositions.status, "closed"))
    .orderBy(desc(providerPositions.closedAt))
    .limit(10);

  return {
    positions,
    summary: {
      openPositions: positions.length,
      openMirrors: openMirrors.length,
      copiers,
      stakedMinor: stakedTotal,
      unrealizedMinor: unrealizedTotal,
      realizedMinor: realizedTotal,
    },
    recentClosed: recent.map((r) => ({
      id: r.pos.id,
      provider: r.providerName,
      symbol: r.pos.symbol,
      side: r.pos.side,
      entryPrice: Number(r.pos.entryPrice),
      exitPrice: r.pos.exitPrice != null ? Number(r.pos.exitPrice) : null,
      reason: r.pos.closeReason,
      closedAt: r.pos.closedAt ? new Date(r.pos.closedAt).toISOString() : null,
    })),
  };
}
