"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeCheck, Copy, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Avatar, Badge, Meter, Sparkline } from "@/components/ui/Primitives";
import { compact, durationSince, moneyCompact } from "@/lib/format";
import { equityCurve, type Trader } from "@/lib/traders";
import { cn, initialsOf } from "@/lib/utils";

const RISK_TONE = {
  Low: "mint",
  Medium: "amber",
  High: "rose",
} as const;

export function TraderCard({
  trader,
  href,
  onCopy,
  index = 0,
  copying = false,
}: {
  trader: Trader;
  href: string;
  onCopy?: (trader: Trader) => void;
  index?: number;
  copying?: boolean;
}) {
  const curve = equityCurve(trader, 40).map((p) => p.value);
  const up = trader.roi30d >= 0;
  const capacity = (trader.slotsTaken / trader.copySlots) * 100;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
      className="card-sheen group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-880/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.15] hover:shadow-[0_30px_70px_-30px_rgba(0,0,0,0.95)]"
    >
      {/* Accent wash keyed to the trader's own gradient */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-[0.14] transition-opacity duration-300 group-hover:opacity-25"
        style={{
          background: `radial-gradient(120% 100% at 20% 0%, ${trader.gradient[0]}, transparent 70%)`,
        }}
      />

      <div className="relative p-5">
        <Link href={href} className="flex min-w-0 items-center gap-3">
          <Avatar initials={initialsOf(trader.name)} gradient={trader.gradient} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-semibold text-white transition-colors group-hover:text-mint-300">
                {trader.name}
              </h3>
              {trader.verified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-mint-400" aria-label="Verified" />
              )}
            </div>
            <p className="truncate text-[12.5px] text-slate-400">
              {trader.flag} {trader.handle}
            </p>
          </div>
        </Link>

        {/* Strategy and risk share a row so the name gets the full card width. */}
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <p className="truncate text-[12.5px] font-medium text-slate-300">
            {trader.strategy}
          </p>
          <Badge tone={RISK_TONE[trader.risk]} className="shrink-0">
            {trader.risk}
          </Badge>
        </div>

        {/* Headline return + curve */}
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
              Return · 12M
            </p>
            <p
              className={cn(
                "tnum mt-1 font-display text-[26px] font-bold leading-none",
                trader.roi12m >= 0 ? "text-mint-400" : "text-rose-400",
              )}
            >
              +{trader.roi12m.toFixed(1)}%
            </p>
          </div>
          <div className="w-[104px] shrink-0">
            <Sparkline points={curve} positive={trader.roi12m >= 0} height={38} />
            <p
              className={cn(
                "tnum mt-1 flex items-center justify-end gap-1 text-[11.5px] font-medium",
                up ? "text-mint-400" : "text-rose-400",
              )}
            >
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? "+" : ""}
              {trader.roi30d.toFixed(1)}% 30D
            </p>
          </div>
        </div>

        {/* Core stats */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.06] pt-4">
          <Stat label="Win rate" value={`${trader.winRate.toFixed(1)}%`} />
          <Stat label="Copiers" value={compact(trader.followers)} icon={<Users className="h-3 w-3" />} />
          <Stat label="Perf. fee" value={`${trader.fee}%`} />
          <Stat label="Trading for" value={durationSince(trader.monthsActive)} />
          <Stat label="Max drawdown" value={`-${trader.maxDrawdown.toFixed(1)}%`} tone="rose" />
          <Stat label="Assets" value={moneyCompact(trader.aum)} />
        </dl>

        {/* Capacity */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="text-slate-500">Copy capacity</span>
            <span className="tnum text-slate-400">
              {compact(trader.slotsTaken)} / {compact(trader.copySlots)}
            </span>
          </div>
          <Meter
            value={capacity}
            tone={capacity > 92 ? "rose" : capacity > 75 ? "amber" : "mint"}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="mt-auto flex gap-2 border-t border-white/[0.06] p-3.5">
        <Link
          href={href}
          className="focus-ring flex h-10 flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[13px] font-medium text-slate-200 transition-colors hover:bg-white/[0.09] hover:text-white"
        >
          View profile
        </Link>
        {onCopy ? (
          <button
            onClick={() => onCopy(trader)}
            disabled={copying}
            className="focus-ring flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-mint-500 text-[13px] font-semibold text-ink-950 transition-all hover:bg-mint-400 disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {copying ? "Copying" : "Copy trader"}
          </button>
        ) : (
          <Link
            href="/signup"
            className="focus-ring flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-mint-500 text-[13px] font-semibold text-ink-950 transition-all hover:bg-mint-400"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy trader
          </Link>
        )}
      </div>
    </motion.article>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "rose";
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[11px] text-slate-500">
        {icon}
        {label}
      </dt>
      <dd
        className={cn(
          "tnum mt-0.5 text-[13.5px] font-semibold",
          tone === "rose" ? "text-rose-400" : "text-white",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
