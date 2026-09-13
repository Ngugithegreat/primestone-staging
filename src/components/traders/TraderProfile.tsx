"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock,
  Copy as CopyIcon,
  Pause,
  Play,
  Shield,
  StopCircle,
  TrendingDown,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CopyModal } from "./CopyModal";
import { Button } from "@/components/ui/Button";
import { Avatar, Badge, Card, CardHeader, Meter } from "@/components/ui/Primitives";
import { HistoryTable } from "@/components/trade/PositionsTable";
import { compact, durationSince, money, moneyCompact, signed } from "@/lib/format";
import { openPnl, useStore } from "@/lib/store";
import { equityCurve, getTrader, monthlyReturns } from "@/lib/traders";
import { useMarket } from "@/components/providers/MarketProvider";
import { cn, initialsOf } from "@/lib/utils";

const RISK_TONE = { Low: "mint", Medium: "amber", High: "rose" } as const;

export function TraderProfile({ traderId }: { traderId: string }) {
  const { prices } = useMarket();
  const copies = useStore((s) => s.copies);
  const positions = useStore((s) => s.positions);
  const history = useStore((s) => s.history);
  const toggleCopy = useStore((s) => s.toggleCopy);
  const stopCopy = useStore((s) => s.stopCopy);
  const pushToast = useStore((s) => s.pushToast);
  const [modalOpen, setModalOpen] = useState(false);

  const trader = getTrader(traderId);
  const copy = copies.find((c) => c.traderId === traderId);

  const curve = useMemo(() => (trader ? equityCurve(trader, 120) : []), [trader]);
  const months = useMemo(() => (trader ? monthlyReturns(trader) : []), [trader]);

  const copiedPositions = useMemo(
    () => positions.filter((p) => p.copiedFrom === traderId),
    [positions, traderId],
  );
  const copiedHistory = useMemo(
    () => history.filter((h) => h.copiedFrom === traderId),
    [history, traderId],
  );
  const copiedFloating = useMemo(
    () => openPnl(copiedPositions, prices),
    [copiedPositions, prices],
  );

  if (!trader) return null;

  const capacity = (trader.slotsTaken / trader.copySlots) * 100;

  return (
    <div className="space-y-5">
      <Link
        href="/traders"
        className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All providers
      </Link>

      {/* ---- Header -------------------------------------------------------- */}
      <Card className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-20"
          style={{
            background: `radial-gradient(90% 100% at 15% 0%, ${trader.gradient[0]}, transparent 70%)`,
          }}
        />
        <div className="relative flex flex-col gap-6 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <Avatar
              initials={initialsOf(trader.name)}
              gradient={trader.gradient}
              size={72}
              className="shrink-0"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[24px] font-bold leading-tight text-white">
                  {trader.name}
                </h1>
                {trader.verified && (
                  <span className="flex items-center gap-1 rounded-full border border-mint-500/25 bg-mint-500/10 px-2 py-0.5 text-[11px] font-medium text-mint-300">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}
                <Badge tone={RISK_TONE[trader.risk]}>{trader.risk} risk · {trader.riskScore}/10</Badge>
              </div>
              <p className="mt-1 text-[13.5px] text-slate-400">
                {trader.flag} {trader.handle} · {trader.country}
              </p>
              <p className="mt-2.5 text-[14px] font-medium text-mint-300">{trader.strategy}</p>
              <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-slate-400">
                {trader.bio}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {trader.markets.map((m) => (
                  <span
                    key={m}
                    className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11.5px] text-slate-300"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Copy control */}
          <div className="w-full shrink-0 lg:w-[280px]">
            {copy ? (
              <div className="rounded-2xl border border-mint-500/25 bg-mint-500/[0.06] p-4">
                <div className="flex items-center justify-between">
                  <Badge tone={copy.status === "active" ? "mint" : "slate"} dot>
                    {copy.status === "active" ? "Copying" : "Paused"}
                  </Badge>
                  <span className="text-[12px] text-slate-400">
                    since {durationSince(Math.max(1, Math.round((Date.now() - copy.startedAt) / 2.6e9)))}
                  </span>
                </div>

                <dl className="mt-3.5 space-y-2 text-[12.5px]">
                  <Row label="Allocated" value={money(copy.allocated)} />
                  <Row label="Risk multiplier" value={`${copy.riskMultiplier}×`} />
                  <Row
                    label="Realised P&L"
                    value={signed(copy.realizedPnl)}
                    tone={copy.realizedPnl >= 0 ? "text-mint-400" : "text-rose-400"}
                  />
                  <Row
                    label="Open P&L"
                    value={signed(copiedFloating)}
                    tone={copiedFloating >= 0 ? "text-mint-400" : "text-rose-400"}
                  />
                  <Row label="Trades copied" value={String(copy.tradesCopied)} />
                </dl>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => toggleCopy(copy.id)}
                  >
                    {copy.status === "active" ? (
                      <>
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Resume
                      </>
                    )}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      stopCopy(copy.id);
                      pushToast({
                        tone: "info",
                        title: "Copying stopped",
                        body: `You are no longer mirroring ${trader.name}. Open positions were left untouched.`,
                      });
                    }}
                  >
                    <StopCircle className="h-3.5 w-3.5" /> Stop
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-[11.5px] uppercase tracking-[0.1em] text-slate-500">
                  Return · 12 months
                </p>
                <p className="tnum mt-1 font-display text-[32px] font-bold leading-none text-mint-400">
                  +{trader.roi12m.toFixed(1)}%
                </p>
                <dl className="mt-3.5 space-y-2 text-[12.5px]">
                  <Row label="Performance fee" value={`${trader.fee}% of profit`} />
                  <Row label="Minimum" value={money(trader.minInvestment)} />
                  <Row label="Max drawdown" value={`-${trader.maxDrawdown.toFixed(1)}%`} tone="text-rose-400" />
                </dl>
                <Button className="mt-4 w-full" onClick={() => setModalOpen(true)}>
                  <CopyIcon className="h-4 w-4" />
                  Copy this trader
                </Button>
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Capacity</span>
                    <span className="tnum">
                      {compact(trader.slotsTaken)} / {compact(trader.copySlots)}
                    </span>
                  </div>
                  <Meter
                    value={capacity}
                    tone={capacity > 92 ? "rose" : capacity > 75 ? "amber" : "mint"}
                    height="h-1"
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ---- Key metrics --------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Win rate", value: `${trader.winRate.toFixed(1)}%`, icon: Shield },
          { label: "Copiers", value: compact(trader.followers), icon: Users },
          { label: "Trading for", value: durationSince(trader.monthsActive), icon: CalendarDays },
          { label: "Total trades", value: compact(trader.trades), icon: CopyIcon },
          { label: "Avg hold", value: `${trader.avgHoldHours}h`, icon: Clock },
          {
            label: "Max drawdown",
            value: `-${trader.maxDrawdown.toFixed(1)}%`,
            icon: TrendingDown,
            tone: "text-rose-400",
          },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="rounded-xl border border-white/[0.07] bg-ink-880/70 p-3.5"
          >
            <div className="flex items-center gap-1.5 text-slate-500">
              <m.icon className="h-3.5 w-3.5" />
              <span className="text-[11px] uppercase tracking-[0.08em]">{m.label}</span>
            </div>
            <p className={cn("tnum mt-1.5 text-[19px] font-bold", m.tone ?? "text-white")}>
              {m.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ---- Charts -------------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Performance"
            subtitle="Growth of 100 units over the trailing 12 months"
            action={
              <span className="tnum text-[13px] font-semibold text-mint-400">
                +{trader.roi12m.toFixed(1)}%
              </span>
            }
          />
          <div className="h-[280px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${trader.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trader.gradient[0]} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={trader.gradient[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" hide />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  domain={["dataMin - 4", "dataMax + 4"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0c111b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  formatter={(v) => [Number(v ?? 0).toFixed(2), "Value"] as [string, string]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={trader.gradient[0]}
                  strokeWidth={2}
                  fill={`url(#grad-${trader.id})`}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Monthly returns" subtitle="Trailing 12 months, percent" />
          <div className="h-[280px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{
                    background: "#0c111b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, "Return"] as [string, string]}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} animationDuration={900}>
                  {months.map((m) => (
                    <Cell key={m.month} fill={m.value >= 0 ? "#00dfa4" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ---- Detail -------------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Risk & fee detail" />
          <dl className="divide-y divide-white/[0.04]">
            {[
              ["Assets under copy", moneyCompact(trader.aum)],
              ["Profit factor", trader.profitFactor.toFixed(2)],
              ["Average hold time", `${trader.avgHoldHours} hours`],
              ["Performance fee", `${trader.fee}% of profit`],
              ["Management fee", "None"],
              ["Minimum allocation", money(trader.minInvestment)],
              ["High-water mark", "Applied"],
              ["Lock-in period", "None"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-2.5 text-[13px]">
                <dt className="text-slate-400">{k}</dt>
                <dd className="tnum font-medium text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Your copied trades"
            subtitle={
              copiedHistory.length
                ? `${copiedHistory.length} settled from this provider`
                : "Nothing settled from this provider yet"
            }
          />
          <HistoryTable rows={copiedHistory.slice(0, 12)} />
        </Card>
      </div>

      <CopyModal trader={trader} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn("tnum font-medium", tone ?? "text-white")}>{value}</dd>
    </div>
  );
}
