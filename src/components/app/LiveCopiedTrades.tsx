"use client";

import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { Badge, Card, LiveDot } from "@/components/ui/Primitives";
import {
  getQuotes,
  unrealizedPnlMinor,
  usd,
  type RealOpenPosition,
} from "@/lib/accountClient";

/**
 * Live view of a user's open copied positions. Polls REAL quotes and marks
 * every position to market, so the P&L on screen is the genuine unrealized
 * result of the provider's trade — updated in near real time.
 */
export function LiveCopiedTrades({
  positions,
  pollMs = 5000,
}: {
  positions: RealOpenPosition[];
  pollMs?: number;
}) {
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  const symbols = Array.from(new Set(positions.map((p) => p.symbol)));
  const symbolsKey = symbols.slice().sort().join(",");
  const keyRef = useRef(symbolsKey);
  keyRef.current = symbolsKey;

  useEffect(() => {
    if (symbolsKey === "") {
      setQuotes({});
      return;
    }
    let cancelled = false;
    const run = async () => {
      const q = await getQuotes(keyRef.current.split(","));
      if (!cancelled) setQuotes(q);
    };
    run();
    const id = window.setInterval(run, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbolsKey, pollMs]);

  if (positions.length === 0) return null;

  const marked = positions.map((p) => ({
    pos: p,
    price: quotes[p.symbol],
    pnl: unrealizedPnlMinor(p, quotes[p.symbol]),
  }));
  const totalPnl = marked.reduce((s, m) => s + (m.pnl ?? 0), 0);
  const totalStake = positions.reduce((s, p) => s + p.stakeMinor, 0);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-white">Live copied trades</h2>
          <LiveDot />
        </div>
        <div className="text-right">
          <p className={`tnum text-[15px] font-semibold ${pnlColor(totalPnl)}`}>
            {signed(totalPnl)}
          </p>
          <p className="text-[11.5px] text-slate-500">unrealized · {usd(totalStake)} at work</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {marked.map(({ pos, price, pnl }) => {
          const pct =
            pnl != null && pos.stakeMinor > 0 ? (pnl / pos.stakeMinor) * 100 : null;
          return (
            <div
              key={pos.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.05]">
                  <Activity className="h-4 w-4 text-slate-300" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-white">
                    <span className="truncate">{pos.symbol}</span>
                    <Badge tone={pos.side === "buy" ? "mint" : "rose"}>
                      {pos.side.toUpperCase()}
                    </Badge>
                  </p>
                  <p className="truncate text-[11.5px] text-slate-500">
                    {pos.provider} · {usd(pos.stakeMinor)} · entry {fmt(pos.entryPrice)}
                    {price != null ? ` → ${fmt(price)}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {pnl == null ? (
                  <p className="tnum text-[13px] text-slate-500">pricing…</p>
                ) : (
                  <>
                    <p className={`tnum text-[13.5px] font-semibold ${pnlColor(pnl)}`}>
                      {signed(pnl)}
                    </p>
                    {pct != null && (
                      <p className={`tnum text-[11.5px] ${pnlColor(pnl)}`}>
                        {pct >= 0 ? "+" : ""}
                        {pct.toFixed(2)}%
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11.5px] text-slate-600">
        Prices are live from the market. Realized results settle to your balance when the
        provider closes each position.
      </p>
    </Card>
  );
}

function pnlColor(v: number): string {
  if (v > 0) return "text-mint-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-300";
}

function signed(minor: number): string {
  const s = usd(Math.abs(minor));
  return minor < 0 ? `-${s}` : `+${s}`;
}

/** Compact price formatting that adapts to magnitude (JPY pairs to Bitcoin). */
function fmt(price: number): string {
  const digits = price >= 1000 ? 1 : price >= 1 ? 2 : 5;
  return price.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
