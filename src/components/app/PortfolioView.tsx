"use client";

import {
  Award,
  Coins,
  Download,
  Layers,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { StatTile } from "./StatTile";
import { HistoryTable, OpenPositionsTable } from "@/components/trade/PositionsTable";
import { useMarket } from "@/components/providers/MarketProvider";
import { Avatar, Card, CardHeader, Meter } from "@/components/ui/Primitives";
import { SegmentedControl } from "@/components/ui/Field";
import { money, num, signed } from "@/lib/format";
import { getInstrument, pnlOf } from "@/lib/market";
import { openPnl, portfolioStats, usedMargin, useStore } from "@/lib/store";
import { RealPortfolio } from "./RealPortfolio";
import { getTrader } from "@/lib/traders";
import { cn, initialsOf } from "@/lib/utils";

const SLICE_COLORS = [
  "#00dfa4",
  "#6366f1",
  "#22d3ee",
  "#fbbf24",
  "#f43f5e",
  "#a855f7",
  "#84cc16",
  "#fb923c",
];

export function PortfolioView() {
  const sessionMode = useStore((s) => s.sessionMode);
  // On a real account, show the real ledger portfolio — never the demo numbers.
  if (sessionMode === "real") return <RealPortfolio />;
  return <DemoPortfolio />;
}

function DemoPortfolio() {
  const { prices } = useMarket();
  const user = useStore((s) => s.user);
  const balance = useStore((s) => s.balance);
  const positions = useStore((s) => s.positions);
  const history = useStore((s) => s.history);
  const copies = useStore((s) => s.copies);

  const [tab, setTab] = useState<"open" | "history">("open");
  const [filter, setFilter] = useState<"all" | "copied" | "manual">("all");

  const stats = useMemo(() => portfolioStats(history), [history]);
  const floating = useMemo(() => openPnl(positions, prices), [positions, prices]);
  const margin = useMemo(
    () => usedMargin(positions, prices, user?.leverage ?? 500),
    [positions, prices, user?.leverage],
  );
  const equity = balance + floating;

  const filteredHistory = useMemo(() => {
    if (filter === "copied") return history.filter((h) => h.copiedFrom);
    if (filter === "manual") return history.filter((h) => !h.copiedFrom);
    return history;
  }, [history, filter]);

  /* Exposure by instrument, from open positions. */
  const exposure = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of positions) {
      const inst = getInstrument(p.symbol);
      const price = prices[p.symbol] ?? p.entry;
      map.set(p.symbol, (map.get(p.symbol) ?? 0) + price * p.lots * inst.contractSize);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [positions, prices]);

  /* Attribution: realised + floating P&L grouped by source. */
  const attribution = useMemo(() => {
    const map = new Map<string, { realised: number; open: number; trades: number }>();
    const bump = (key: string, patch: Partial<{ realised: number; open: number; trades: number }>) => {
      const cur = map.get(key) ?? { realised: 0, open: 0, trades: 0 };
      map.set(key, {
        realised: cur.realised + (patch.realised ?? 0),
        open: cur.open + (patch.open ?? 0),
        trades: cur.trades + (patch.trades ?? 0),
      });
    };

    for (const h of history) bump(h.copiedFrom ?? "manual", { realised: h.pnl, trades: 1 });
    for (const p of positions) {
      const inst = getInstrument(p.symbol);
      const price = prices[p.symbol] ?? p.entry;
      bump(p.copiedFrom ?? "manual", { open: pnlOf(p.side, p.entry, price, p.lots, inst) });
    }

    return [...map.entries()]
      .map(([key, v]) => ({ key, ...v, total: v.realised + v.open }))
      .sort((a, b) => b.total - a.total);
  }, [history, positions, prices]);

  const bestAbs = Math.max(...attribution.map((a) => Math.abs(a.total)), 1);

  const exportCsv = () => {
    const header = "closed_at,symbol,side,lots,entry,exit,pnl,source,reason";
    const lines = history.map((h) =>
      [
        new Date(h.closedAt).toISOString(),
        h.symbol,
        h.side,
        h.lots,
        h.entry,
        h.exit,
        h.pnl.toFixed(2),
        h.copiedFrom ? getTrader(h.copiedFrom)?.name ?? h.copiedFrom : "manual",
        h.closeReason,
      ].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "primestone-statement.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-tight text-white">
            Portfolio
          </h1>
          <p className="mt-1 text-[14px] text-slate-400">
            {positions.length} open · {history.length} settled · {money(margin)} margin in use
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="focus-ring flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 text-[13px] font-medium text-slate-200 transition-colors hover:bg-white/[0.09]"
        >
          <Download className="h-3.5 w-3.5" />
          Export statement
        </button>
      </div>

      {/* ---- Tiles --------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          label="Equity"
          value={money(equity)}
          icon={Coins}
          accent="#00dfa4"
          delta={{ value: `${signed(floating)} floating`, positive: floating >= 0 }}
          footer={`Balance ${money(balance)}`}
        />
        <StatTile
          index={1}
          label="Realised P&L"
          value={signed(stats.gross)}
          icon={stats.gross >= 0 ? TrendingUp : TrendingDown}
          accent={stats.gross >= 0 ? "#2ff0bd" : "#f43f5e"}
          delta={{
            value: `Profit factor ${stats.profitFactor.toFixed(2)}`,
            positive: stats.profitFactor >= 1,
          }}
          footer={`${num(stats.totalVolume, 2)} lots traded`}
        />
        <StatTile
          index={2}
          label="Win rate"
          value={`${stats.winRate.toFixed(1)}%`}
          icon={Target}
          accent="#818cf8"
          delta={{ value: `${stats.wins}W / ${stats.losses}L`, positive: stats.winRate >= 50 }}
          footer={`${stats.total} trades`}
        />
        <StatTile
          index={3}
          label="Avg win / avg loss"
          value={`${(stats.avgLoss > 0 ? stats.avgWin / stats.avgLoss : 0).toFixed(2)}`}
          icon={Scale}
          accent="#fbbf24"
          delta={{
            value: `${money(stats.avgWin)} vs ${money(stats.avgLoss)}`,
            positive: stats.avgWin >= stats.avgLoss,
          }}
          footer="Expectancy ratio"
        />
      </div>

      {/* ---- Analytics ----------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader title="Open exposure" subtitle="Notional value by instrument" />
          {exposure.length === 0 ? (
            <p className="px-5 py-12 text-center text-[13px] text-slate-500">
              No open positions.
            </p>
          ) : (
            <div className="h-[260px] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={exposure}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={2}
                    stroke="none"
                    animationDuration={900}
                  >
                    {exposure.map((_, i) => (
                      <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#0c111b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(v) => [money(Number(v ?? 0)), "Notional"] as [string, string]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={44}
                    formatter={(v: string) => (
                      <span style={{ color: "#94a3b8", fontSize: 11.5 }}>{v}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader
            title="Performance attribution"
            subtitle="Where the profit and loss actually came from"
          />
          <div className="space-y-3 p-4">
            {attribution.length === 0 && (
              <p className="py-8 text-center text-[13px] text-slate-500">
                Nothing to attribute yet.
              </p>
            )}
            {attribution.map((a) => {
              const trader = a.key === "manual" ? null : getTrader(a.key);
              const label = trader?.name ?? "Your own trades";
              return (
                <div key={a.key} className="flex items-center gap-3">
                  {trader ? (
                    <Avatar
                      initials={initialsOf(trader.name)}
                      gradient={trader.gradient}
                      size={32}
                    />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] font-medium text-white">
                        {label}
                      </span>
                      <span
                        className={cn(
                          "tnum shrink-0 text-[13px] font-semibold",
                          a.total >= 0 ? "text-mint-400" : "text-rose-400",
                        )}
                      >
                        {signed(a.total)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <Meter
                        value={(Math.abs(a.total) / bestAbs) * 100}
                        tone={a.total >= 0 ? "mint" : "rose"}
                        height="h-1"
                      />
                      <span className="tnum shrink-0 text-[10.5px] text-slate-500">
                        {a.trades} settled
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ---- Best / worst -------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Best trade", value: signed(stats.bestTrade), icon: Award, tone: "text-mint-400" },
          { label: "Worst trade", value: signed(stats.worstTrade), icon: TrendingDown, tone: "text-rose-400" },
          { label: "Average win", value: money(stats.avgWin), icon: TrendingUp, tone: "text-mint-400" },
          { label: "Average loss", value: money(stats.avgLoss), icon: TrendingDown, tone: "text-rose-400" },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-ink-880/70 p-4"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
              <s.icon className={cn("h-4 w-4", s.tone)} />
            </span>
            <div className="min-w-0">
              <p className="text-[11.5px] uppercase tracking-[0.08em] text-slate-500">
                {s.label}
              </p>
              <p className={cn("tnum mt-0.5 text-[16px] font-semibold", s.tone)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ---- Tables -------------------------------------------------------- */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: "open", label: `Open positions (${positions.length})` },
              { value: "history", label: `Trade history (${history.length})` },
            ]}
          />
          {tab === "history" && (
            <SegmentedControl
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "copied", label: "Copied" },
                { value: "manual", label: "Manual" },
              ]}
            />
          )}
        </div>
        {tab === "open" ? (
          <OpenPositionsTable />
        ) : (
          <HistoryTable rows={filteredHistory} />
        )}
      </Card>

      <p className="px-1 text-[11.5px] leading-relaxed text-slate-500">
        Statistics are calculated from settled trades only. Floating profit and loss on open
        positions is excluded from win rate and profit factor until the position closes.
        Copies currently allocated: {copies.length}.
      </p>
    </div>
  );
}
