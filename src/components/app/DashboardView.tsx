"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  CandlestickChart,
  Pause,
  Percent,
  Play,
  Plus,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatTile } from "./StatTile";
import { OpenPositionsTable } from "@/components/trade/PositionsTable";
import { useMarket } from "@/components/providers/MarketProvider";
import { Avatar, Badge, Card, CardHeader, Meter } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { money, relativeTime, signed } from "@/lib/format";
import { INSTRUMENTS, formatPrice } from "@/lib/market";
import { openPnl, portfolioStats, useStore } from "@/lib/store";
import { LiveOverview } from "./LiveOverview";
import { getTrader } from "@/lib/traders";
import { cn, initialsOf } from "@/lib/utils";

export function DashboardView() {
  const { prices, quotes } = useMarket();
  const user = useStore((s) => s.user);
  const sessionMode = useStore((s) => s.sessionMode);
  const balance = useStore((s) => s.balance);
  const positions = useStore((s) => s.positions);
  const history = useStore((s) => s.history);
  const copies = useStore((s) => s.copies);
  const toggleCopy = useStore((s) => s.toggleCopy);

  const floating = useMemo(() => openPnl(positions, prices), [positions, prices]);
  const stats = useMemo(() => portfolioStats(history), [history]);
  const equity = balance + floating;

  /* Equity curve reconstructed backwards from today's balance. */
  const curve = useMemo(() => {
    const ordered = [...history].sort((a, b) => a.closedAt - b.closedAt);
    const start = balance - ordered.reduce((s, h) => s + h.pnl, 0);
    let running = start;
    const points = ordered.map((h) => {
      running += h.pnl;
      return { t: h.closedAt, value: Math.round(running * 100) / 100 };
    });
    return [{ t: ordered[0]?.openedAt ?? Date.now(), value: Math.round(start * 100) / 100 }, ...points];
  }, [history, balance]);

  const totalPnl = stats.gross + floating;
  const totalPnlPct = balance > 0 ? (totalPnl / (balance - stats.gross)) * 100 : 0;
  const activeCopies = copies.filter((c) => c.status === "active");
  const copyAllocated = copies.reduce((s, c) => s + c.allocated, 0);
  const copyPnl = copies.reduce((s, c) => s + c.realizedPnl, 0);

  const movers = useMemo(
    () =>
      [...INSTRUMENTS]
        .sort(
          (a, b) =>
            Math.abs(quotes[b.id]?.changePct ?? 0) - Math.abs(quotes[a.id]?.changePct ?? 0),
        )
        .slice(0, 6),
    [quotes],
  );

  const recent = useMemo(() => history.slice(0, 6), [history]);
  const now = Date.now();

  // The switcher decides which account you're viewing. Real → the funded
  // ledger overview (even at $0, with a fund-your-account CTA); Demo → the
  // virtual practice desk below.
  if (sessionMode === "real") return <LiveOverview />;

  return (
    <div className="space-y-5">
      {/* ---- Header --------------------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-tight text-white">
            {greeting()}, {user?.firstName}
          </h1>
          <p className="mt-1 text-[14px] text-slate-400">
            {activeCopies.length > 0
              ? `You are copying ${activeCopies.length} strategy ${
                  activeCopies.length === 1 ? "provider" : "providers"
                } with ${positions.length} position${positions.length === 1 ? "" : "s"} open.`
              : "You have no active copies yet — the leaderboard is a good place to start."}
          </p>
        </div>
        <div className="flex gap-2.5">
          <ButtonLink href="/wallet" variant="secondary" size="sm">
            <Plus className="h-4 w-4" />
            Deposit
          </ButtonLink>
          <ButtonLink href="/traders" size="sm">
            <Users className="h-4 w-4" />
            Find traders
          </ButtonLink>
        </div>
      </div>

      {/* ---- Stat tiles ----------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          label="Account equity"
          value={money(equity)}
          icon={Wallet}
          delta={{
            value: `${floating >= 0 ? "+" : ""}${money(floating)} floating`,
            positive: floating >= 0,
          }}
          spark={curve.slice(-24).map((p) => p.value)}
          sparkPositive={totalPnl >= 0}
          accent="#00dfa4"
        />
        <StatTile
          index={1}
          label="Total profit"
          value={signed(totalPnl)}
          icon={Activity}
          accent={totalPnl >= 0 ? "#2ff0bd" : "#f43f5e"}
          delta={{
            value: `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}% all time`,
            positive: totalPnl >= 0,
          }}
          footer={`${stats.total} trades settled`}
        />
        <StatTile
          index={2}
          label="Win rate"
          value={`${stats.winRate.toFixed(1)}%`}
          icon={Target}
          accent="#818cf8"
          delta={{ value: `${stats.wins}W / ${stats.losses}L`, positive: stats.winRate >= 50 }}
          footer={`Profit factor ${stats.profitFactor.toFixed(2)}`}
        />
        <StatTile
          index={3}
          label="Copy allocation"
          value={money(copyAllocated)}
          icon={Users}
          accent="#fbbf24"
          delta={{
            value: `${copyPnl >= 0 ? "+" : ""}${money(copyPnl)} realised`,
            positive: copyPnl >= 0,
          }}
          footer={`${activeCopies.length} active · ${copies.length - activeCopies.length} paused`}
        />
      </div>

      {/* ---- Equity curve + copies ------------------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Equity curve"
            subtitle="Account balance across every settled trade"
            action={
              <span
                className={cn(
                  "tnum text-[13px] font-semibold",
                  totalPnl >= 0 ? "text-mint-400" : "text-rose-400",
                )}
              >
                {signed(totalPnl)}
              </span>
            }
          />
          <div className="h-[280px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00dfa4" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#00dfa4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="t" hide />
                <YAxis
                  domain={["dataMin - 200", "dataMax + 200"]}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v: number) => `$${Math.round(v).toLocaleString("en-US")}`}
                  axisLine={false}
                  tickLine={false}
                  width={62}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,0.2)", strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "#0c111b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelFormatter={() => "Balance"}
                  formatter={(v) => [money(Number(v ?? 0)), ""] as [string, string]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00dfa4"
                  strokeWidth={2}
                  fill="url(#equity-fill)"
                  animationDuration={1100}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader
            title="Active copies"
            subtitle={`${money(copyAllocated)} allocated`}
            action={
              <Link
                href="/traders"
                className="flex items-center gap-1 text-[12.5px] font-medium text-mint-400 hover:text-mint-300"
              >
                Manage
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {copies.length === 0 && (
              <div className="grid place-items-center px-4 py-10 text-center">
                <p className="text-[13.5px] text-slate-400">No copies yet</p>
                <ButtonLink href="/traders" size="sm" className="mt-3">
                  Browse providers
                </ButtonLink>
              </div>
            )}

            {copies.map((c) => {
              const trader = getTrader(c.traderId);
              if (!trader) return null;
              const pnlPct = (c.realizedPnl / c.allocated) * 100;
              const open = positions.filter((p) => p.copiedFrom === c.traderId).length;

              return (
                <motion.div
                  key={c.id}
                  layout
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      initials={initialsOf(trader.name)}
                      gradient={trader.gradient}
                      size={34}
                    />
                    <Link href={`/traders/${trader.id}`} className="min-w-0 flex-1">
                      <span className="flex items-center gap-1">
                        <span className="truncate text-[13px] font-semibold text-white hover:text-mint-300">
                          {trader.name}
                        </span>
                        {trader.verified && (
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-mint-400" />
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {money(c.allocated)} · {open} open · {c.tradesCopied} copied
                      </span>
                    </Link>
                    <button
                      onClick={() => toggleCopy(c.id)}
                      aria-label={c.status === "active" ? "Pause copying" : "Resume copying"}
                      className={cn(
                        "focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors",
                        c.status === "active"
                          ? "border-white/[0.08] text-slate-400 hover:bg-white/[0.07] hover:text-white"
                          : "border-mint-500/30 bg-mint-500/10 text-mint-400 hover:bg-mint-500/20",
                      )}
                    >
                      {c.status === "active" ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
                    <Badge tone={c.status === "active" ? "mint" : "slate"} dot>
                      {c.status === "active" ? "Copying" : "Paused"}
                    </Badge>
                    <span
                      className={cn(
                        "tnum font-semibold",
                        c.realizedPnl >= 0 ? "text-mint-400" : "text-rose-400",
                      )}
                    >
                      {signed(c.realizedPnl)} ({pnlPct >= 0 ? "+" : ""}
                      {pnlPct.toFixed(1)}%)
                    </span>
                  </div>

                  {c.copyStopLoss != null && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10.5px] text-slate-500">
                        <span>Copy stop-loss</span>
                        <span className="tnum">-{c.copyStopLoss}%</span>
                      </div>
                      <Meter
                        value={Math.max(0, (-pnlPct / c.copyStopLoss) * 100)}
                        tone={-pnlPct > c.copyStopLoss * 0.6 ? "rose" : "mint"}
                        height="h-1"
                        className="mt-1"
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ---- Positions + side rail ------------------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Open positions"
            subtitle={`${positions.length} live · ${signed(floating)} floating`}
            action={
              <ButtonLink href="/trade" variant="secondary" size="sm">
                <CandlestickChart className="h-3.5 w-3.5" />
                Trade
              </ButtonLink>
            }
          />
          <OpenPositionsTable compact />
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader title="Market movers" subtitle="Biggest sessions today" />
            <div className="divide-y divide-white/[0.04]">
              {movers.map((i) => {
                const q = quotes[i.id];
                const up = (q?.changePct ?? 0) >= 0;
                return (
                  <Link
                    key={i.id}
                    href="/trade"
                    className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white">{i.id}</p>
                      <p className="truncate text-[11px] text-slate-500">{i.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="tnum text-[12.5px] text-slate-200">
                        {formatPrice(q?.price ?? i.base, i.digits)}
                      </p>
                      <p
                        className={cn(
                          "tnum text-[11.5px] font-medium",
                          up ? "text-mint-400" : "text-rose-400",
                        )}
                      >
                        {up ? "+" : ""}
                        {(q?.changePct ?? 0).toFixed(2)}%
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Recent activity"
              subtitle="Last settled trades"
              action={
                <Link
                  href="/portfolio"
                  className="text-[12.5px] font-medium text-mint-400 hover:text-mint-300"
                >
                  All
                </Link>
              }
            />
            <div className="divide-y divide-white/[0.04]">
              {recent.map((h) => {
                const trader = h.copiedFrom ? getTrader(h.copiedFrom) : null;
                return (
                  <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                        h.pnl >= 0
                          ? "bg-mint-500/12 text-mint-400"
                          : "bg-rose-500/12 text-rose-400",
                      )}
                    >
                      <Percent className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-white">
                        {h.side === "buy" ? "Bought" : "Sold"} {h.lots} {h.symbol}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {trader ? `via ${trader.name}` : "Manual trade"} ·{" "}
                        {relativeTime(h.closedAt, now)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "tnum shrink-0 text-[12.5px] font-semibold",
                        h.pnl >= 0 ? "text-mint-400" : "text-rose-400",
                      )}
                    >
                      {signed(h.pnl)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
