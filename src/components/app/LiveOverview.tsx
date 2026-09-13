"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, TrendingUp, Users, Wallet } from "lucide-react";
import { LiveCopiedTrades } from "./LiveCopiedTrades";
import { ButtonLink } from "@/components/ui/Button";
import { Card, LiveDot } from "@/components/ui/Primitives";
import { usd } from "@/lib/accountClient";
import { useRealAccount } from "@/lib/useRealAccount";
import { useStore } from "@/lib/store";
import { cn, initialsOf } from "@/lib/utils";

/** The dashboard for a real, funded (live) account — real USD money only. */
export function LiveOverview() {
  const user = useStore((s) => s.user);
  const real = useRealAccount();
  const kyc = useStore((s) => s.kyc.status);

  const subs = (real.account?.allocations ?? []).filter((a) => a.status !== "closed");
  const realized = real.realizedPnlMinor;

  const identity =
    kyc === "verified"
      ? { label: "Verified", dot: "bg-mint-500", sub: "Withdrawals enabled" }
      : kyc === "pending"
        ? { label: "Under review", dot: "bg-amber-450", sub: "Usually within hours" }
        : { label: "Not verified", dot: "", sub: "" };

  return (
    <div className="space-y-5">
      {/* Hero — total value */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="card-sheen overflow-hidden p-0">
          <div className="relative p-6 sm:p-7">
            <div
              className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full blur-[90px]"
              style={{ background: "radial-gradient(closest-side, rgba(0,223,164,0.20), transparent 70%)" }}
            />
            <div
              className="pointer-events-none absolute -left-20 bottom-[-40%] h-64 w-64 rounded-full blur-[90px] opacity-70"
              style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.16), transparent 70%)" }}
            />

            <div className="relative flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="text-[13px] text-slate-400">
                  {greeting()}, <span className="font-medium text-slate-200">{user?.firstName}</span>
                </p>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <p className="text-[11.5px] uppercase tracking-[0.14em] text-slate-500">
                    Total account value
                  </p>
                  <LiveDot />
                </div>
                <p className="tnum mt-1.5 font-display text-[clamp(2rem,5vw,2.75rem)] font-bold leading-none text-white">
                  {usd(real.totalMinor)}
                </p>
                {realized !== 0 && (
                  <span
                    className={cn(
                      "mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold",
                      realized >= 0
                        ? "border-mint-500/25 bg-mint-500/10 text-mint-400"
                        : "border-rose-500/25 bg-rose-500/10 text-rose-400",
                    )}
                  >
                    <TrendingUp className="h-3 w-3" />
                    {realized >= 0 ? "+" : "-"}
                    {usd(Math.abs(realized))} realized all-time
                  </span>
                )}
              </div>

              <div className="flex shrink-0 gap-2.5">
                <ButtonLink href="/wallet" variant="secondary" size="sm">
                  <Wallet className="h-4 w-4" />
                  Deposit
                </ButtonLink>
                <ButtonLink href="/wallet" size="sm">
                  <Users className="h-4 w-4" />
                  Copy a provider
                </ButtonLink>
              </div>
            </div>

            {/* Breakdown */}
            <div className="relative mt-6 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-5 sm:grid-cols-3">
              <MiniStat
                label="Available"
                value={usd(real.balanceMinor)}
                sub="ready to allocate"
              />
              <MiniStat
                label="Copying"
                value={usd(real.allocatedMinor)}
                valueClass="text-mint-400"
                sub={`${subs.length} provider${subs.length === 1 ? "" : "s"}`}
              />
              <MiniStat
                label="Identity"
                value={identity.label}
                sub={identity.sub}
                dot={identity.dot}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Live copied trades (marks against real prices) */}
      <LiveCopiedTrades positions={real.openPositions} />

      {/* Subscriptions */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">Your subscriptions</h2>
          <Link href="/wallet" className="text-[13px] font-medium text-mint-400 hover:text-mint-300">
            Manage →
          </Link>
        </div>

        {subs.length === 0 ? (
          <div className="mt-4 grid place-items-center rounded-xl border border-white/[0.07] bg-white/[0.02] px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
              <Users className="h-6 w-6 text-slate-500" />
            </span>
            <p className="mt-3 text-[14px] font-medium text-white">No subscriptions yet</p>
            <p className="mt-1 max-w-sm text-[13px] text-slate-400">
              Assign your {usd(real.balanceMinor)} to a provider and their trades mirror into
              your account.
            </p>
            <ButtonLink href="/wallet" size="sm" className="mt-4">
              Browse providers
              <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {subs.map((a) => {
              const pnl = a.valueMinor - a.amountMinor;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-ink-950"
                      style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}
                    >
                      {initialsOf(a.provider.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-white">
                        {a.provider.name}
                      </p>
                      <p className="truncate text-[11.5px] text-slate-500">{a.provider.strategy}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-[13.5px] font-semibold text-white">{usd(a.valueMinor)}</p>
                    {pnl !== 0 ? (
                      <p
                        className={cn(
                          "tnum text-[11.5px]",
                          pnl >= 0 ? "text-mint-400" : "text-rose-400",
                        )}
                      >
                        {pnl >= 0 ? "+" : "-"}
                        {usd(Math.abs(pnl))} P&L
                      </p>
                    ) : (
                      <p className="tnum text-[11.5px] text-slate-500">{usd(a.amountMinor)} in</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-center text-[12px] text-slate-600">
        Want to practise with virtual funds first? The{" "}
        <Link href="/trade" className="text-slate-400 underline-offset-2 hover:underline">
          Trading desk
        </Link>{" "}
        is a separate demo account on live charts.
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  valueClass,
  dot,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
  dot?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={cn("tnum mt-1 truncate text-[18px] font-semibold text-white", valueClass)}>
        {value}
      </p>
      {(sub || dot) && (
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
          {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
          {sub}
        </p>
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
