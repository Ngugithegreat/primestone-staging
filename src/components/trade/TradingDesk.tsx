"use client";

import { motion } from "framer-motion";
import { Search, Star, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { CandleChart, type ChartOverlay } from "./CandleChart";
import { LiveChart } from "./LiveChart";
import { OrderTicket } from "./OrderTicket";
import { HistoryTable, OpenPositionsTable } from "./PositionsTable";
import { useMarket } from "@/components/providers/MarketProvider";
import { Card, LiveDot } from "@/components/ui/Primitives";
import { SegmentedControl } from "@/components/ui/Field";
import {
  ASSET_CLASS_LABEL,
  INSTRUMENTS,
  TIMEFRAMES,
  formatPrice,
  getInstrument,
  type AssetClass,
  type TimeframeId,
} from "@/lib/market";
import { getAccountType } from "@/lib/accounts";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const CLASSES: (AssetClass | "all" | "watchlist")[] = [
  "watchlist",
  "all",
  "forex",
  "crypto",
  "metals",
  "indices",
  "stocks",
];

export function TradingDesk() {
  const { quotes, prices } = useMarket();
  const user = useStore((s) => s.user);
  const positions = useStore((s) => s.positions);
  const history = useStore((s) => s.history);
  const watchlist = useStore((s) => s.watchlist);
  const toggleWatch = useStore((s) => s.toggleWatch);

  const [symbol, setSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState<TimeframeId>("H1");
  const [filter, setFilter] = useState<(typeof CLASSES)[number]>("watchlist");
  const [query, setQuery] = useState("");
  const [bottomTab, setBottomTab] = useState<"open" | "history">("open");
  const [chartMode, setChartMode] = useState<"live" | "demo">("live");

  const inst = getInstrument(symbol);
  const acct = getAccountType(user?.accountType);
  const quote = quotes[symbol];
  const price = quote?.price ?? inst.base;
  const spread = inst.spread * acct.spreadMultiplier;
  const ask = price + spread / 2;
  const bid = price - spread / 2;

  const list = useMemo(() => {
    let items = INSTRUMENTS;
    if (filter === "watchlist") items = items.filter((i) => watchlist.includes(i.id));
    else if (filter !== "all") items = items.filter((i) => i.cls === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      items = items.filter(
        (i) => i.id.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
      );
    }
    return items;
  }, [filter, query, watchlist]);

  // Draw this symbol's open positions onto the chart.
  const overlays = useMemo<ChartOverlay[]>(() => {
    const out: ChartOverlay[] = [];
    for (const p of positions.filter((x) => x.symbol === symbol)) {
      out.push({
        price: p.entry,
        label: `${p.side === "buy" ? "▲" : "▼"} ${p.lots}`,
        color: p.side === "buy" ? "#00dfa4" : "#f43f5e",
      });
      if (p.sl) out.push({ price: p.sl, label: "SL", color: "#f43f5e", dashed: true });
      if (p.tp) out.push({ price: p.tp, label: "TP", color: "#2ff0bd", dashed: true });
    }
    return out;
  }, [positions, symbol]);

  const symbolPositions = positions.filter((p) => p.symbol === symbol);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[260px_1fr_296px]">
        {/* ---- Watchlist ------------------------------------------------- */}
        <Card className="flex max-h-[640px] flex-col overflow-hidden xl:max-h-none">
          <div className="border-b border-white/[0.06] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search instruments"
                className="h-9 w-full rounded-lg border border-white/[0.08] bg-ink-900/70 pl-9 pr-3 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-mint-500/50"
              />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {CLASSES.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors",
                    filter === c
                      ? "bg-white/[0.10] text-white"
                      : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300",
                  )}
                >
                  {c === "all"
                    ? "All"
                    : c === "watchlist"
                      ? "★"
                      : ASSET_CLASS_LABEL[c as AssetClass]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            {list.length === 0 && (
              <p className="px-3 py-6 text-center text-[12.5px] text-slate-500">
                Nothing matches that filter.
              </p>
            )}
            {list.map((i) => {
              const q = quotes[i.id];
              const up = (q?.changePct ?? i.drift) >= 0;
              const active = i.id === symbol;
              const watched = watchlist.includes(i.id);

              return (
                <div
                  key={i.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                    active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
                  )}
                >
                  <button
                    onClick={() => toggleWatch(i.id)}
                    aria-label={watched ? `Unwatch ${i.id}` : `Watch ${i.id}`}
                    className="focus-ring shrink-0"
                  >
                    <Star
                      className={cn(
                        "h-3.5 w-3.5 transition-colors",
                        watched
                          ? "fill-amber-450 text-amber-450"
                          : "text-slate-600 hover:text-slate-400",
                      )}
                    />
                  </button>
                  <button
                    onClick={() => setSymbol(i.id)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                  >
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-[12.5px] font-semibold",
                          active ? "text-white" : "text-slate-200",
                        )}
                      >
                        {i.id}
                      </span>
                      <span className="block truncate text-[10.5px] text-slate-500">
                        {i.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tnum block text-[12px] text-slate-200">
                        {formatPrice(q?.price ?? i.base, i.digits)}
                      </span>
                      <span
                        className={cn(
                          "tnum block text-[10.5px]",
                          up ? "text-mint-400" : "text-rose-400",
                        )}
                      >
                        {up ? "+" : ""}
                        {(q?.changePct ?? i.drift).toFixed(2)}%
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ---- Chart ------------------------------------------------------ */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-baseline gap-3">
              <div>
                <h1 className="font-display text-[19px] font-bold leading-tight text-white">
                  {symbol}
                </h1>
                <p className="text-[11.5px] text-slate-500">{inst.name}</p>
              </div>
              <motion.div
                key={price}
                initial={{ opacity: 0.65 }}
                animate={{ opacity: 1 }}
                className="flex items-baseline gap-2"
              >
                <span
                  className={cn(
                    "tnum text-[21px] font-semibold",
                    quote?.dir === -1 ? "text-rose-400" : "text-mint-400",
                  )}
                >
                  {formatPrice(price, inst.digits)}
                </span>
                <span
                  className={cn(
                    "tnum flex items-center gap-1 text-[12.5px] font-medium",
                    (quote?.changePct ?? 0) >= 0 ? "text-mint-400" : "text-rose-400",
                  )}
                >
                  {(quote?.changePct ?? 0) >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {(quote?.changePct ?? 0) >= 0 ? "+" : ""}
                  {(quote?.changePct ?? 0).toFixed(2)}%
                </span>
              </motion.div>
            </div>

            <div className="flex items-center gap-3">
              <LiveDot />
              <SegmentedControl
                size="sm"
                value={chartMode}
                onChange={(v) => setChartMode(v)}
                options={[
                  { value: "live", label: "Live" },
                  { value: "demo", label: "Demo" },
                ]}
              />
              <SegmentedControl
                size="sm"
                value={timeframe}
                onChange={(v) => setTimeframe(v)}
                options={TIMEFRAMES.map((t) => ({ value: t.id, label: t.label }))}
              />
            </div>
          </div>

          {chartMode === "live" ? (
            <div style={{ height: 440 }}>
              <LiveChart symbol={symbol} timeframe={timeframe} />
            </div>
          ) : (
            <CandleChart
              symbol={symbol}
              timeframe={timeframe}
              price={price}
              overlays={overlays}
              height={440}
            />
          )}

          <div className="grid grid-cols-2 gap-px border-t border-white/[0.06] bg-white/[0.04] sm:grid-cols-4">
            {[
              { label: "Bid", value: formatPrice(bid, inst.digits), tone: "text-rose-400" },
              { label: "Ask", value: formatPrice(ask, inst.digits), tone: "text-mint-400" },
              {
                label: "Spread",
                value: formatPrice(spread, inst.digits),
                tone: "text-slate-200",
              },
              {
                label: "Open positions",
                value: String(symbolPositions.length),
                tone: "text-slate-200",
              },
            ].map((s) => (
              <div key={s.label} className="bg-ink-880 px-4 py-2.5">
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-slate-500">
                  {s.label}
                </p>
                <p className={cn("tnum mt-0.5 text-[14px] font-semibold", s.tone)}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* ---- Order ticket ---------------------------------------------- */}
        <OrderTicket symbol={symbol} bid={bid} ask={ask} />
      </div>

      {/* ---- Positions --------------------------------------------------- */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <SegmentedControl
            value={bottomTab}
            onChange={setBottomTab}
            options={[
              { value: "open", label: `Open (${positions.length})` },
              { value: "history", label: `History (${history.length})` },
            ]}
          />
          {bottomTab === "open" && positions.length > 0 && (
            <CloseAllButton prices={prices} />
          )}
        </div>
        {bottomTab === "open" ? (
          <OpenPositionsTable />
        ) : (
          <HistoryTable rows={history.slice(0, 40)} />
        )}
      </Card>
    </div>
  );
}

function CloseAllButton({ prices }: { prices: Record<string, number> }) {
  const closeAll = useStore((s) => s.closeAll);
  const pushToast = useStore((s) => s.pushToast);

  return (
    <button
      onClick={() => {
        closeAll(prices);
        pushToast({
          tone: "info",
          title: "All positions closed",
          body: "Every open position was closed at the current market price.",
        });
      }}
      className="focus-ring rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[12.5px] font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
    >
      Close all
    </button>
  );
}
