"use client";

import Link from "next/link";
import { PiggyBank, TrendingUp, Users, Wallet as WalletIcon } from "lucide-react";
import { StatTile } from "./StatTile";
import { LiveCopiedTrades } from "./LiveCopiedTrades";
import { Badge, Card } from "@/components/ui/Primitives";
import { usd } from "@/lib/accountClient";
import { useRealAccount } from "@/lib/useRealAccount";
import { cn, initialsOf } from "@/lib/utils";

/** Compact price formatting that adapts to magnitude (JPY pairs to Bitcoin). */
function fmt(price: number): string {
  const digits = price >= 1000 ? 1 : price >= 1 ? 2 : 5;
  return price.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Portfolio for a real, ledger-backed account — real USD money only, no demo. */
export function RealPortfolio() {
  const real = useRealAccount();
  const subs = (real.account?.allocations ?? []).filter((a) => a.status !== "closed");
  const payments = real.account?.payments ?? [];
  const closed = real.account?.closedPositions ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[26px] font-bold text-white">Portfolio</h1>
            <Badge tone="mint" dot>
              Real account
            </Badge>
          </div>
          <p className="mt-1 text-[14px] text-slate-400">
            Your real money — balances, copied positions and settled performance.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile index={0} label="Account value" value={usd(real.totalMinor)} icon={WalletIcon} accent="#00dfa4" />
        <StatTile index={1} label="Available" value={usd(real.balanceMinor)} icon={PiggyBank} accent="#2ff0bd" footer="Not yet allocated" />
        <StatTile index={2} label="Copying" value={usd(real.allocatedMinor)} icon={Users} accent="#818cf8" footer={`${subs.length} provider${subs.length === 1 ? "" : "s"}`} />
        <StatTile
          index={3}
          label="Realized P&L"
          value={`${real.realizedPnlMinor >= 0 ? "+" : "-"}${usd(Math.abs(real.realizedPnlMinor))}`}
          icon={TrendingUp}
          accent={real.realizedPnlMinor >= 0 ? "#00dfa4" : "#f43f5e"}
          footer="All-time, from closed trades"
        />
      </div>

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
          <p className="mt-4 text-[13px] text-slate-500">
            You aren&rsquo;t copying anyone yet. Browse{" "}
            <Link href="/traders" className="text-mint-400 hover:text-mint-300">
              strategy providers
            </Link>{" "}
            to start.
          </p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {subs.map((a) => {
              const pnl = a.valueMinor - a.amountMinor;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-ink-950"
                      style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}
                    >
                      {initialsOf(a.provider.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-white">{a.provider.name}</p>
                      <p className="truncate text-[11.5px] text-slate-500">{a.provider.strategy}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-[13.5px] font-semibold text-white">{usd(a.valueMinor)}</p>
                    <p className={cn("tnum text-[11.5px]", pnl >= 0 ? "text-mint-400" : "text-rose-400")}>
                      {pnl >= 0 ? "+" : "-"}
                      {usd(Math.abs(pnl))} P&L
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Trade history */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">Trade history</h2>
          <span className="text-[12px] text-slate-500">{closed.length} closed</span>
        </div>
        {closed.length === 0 ? (
          <p className="mt-4 text-[13px] text-slate-500">
            No closed trades yet. Once the providers you copy open and close positions, they&rsquo;ll
            appear here.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.08em] text-slate-500">
                  <th className="pb-2 font-medium">Instrument</th>
                  <th className="pb-2 font-medium">Provider</th>
                  <th className="pb-2 text-right font-medium">Entry → Exit</th>
                  <th className="pb-2 text-right font-medium">P&L</th>
                  <th className="pb-2 text-right font-medium">Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {closed.map((t) => (
                  <tr key={t.id} className="text-[13px]">
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-white">{t.symbol}</span>
                        <Badge tone={t.side === "buy" ? "mint" : "rose"}>{t.side.toUpperCase()}</Badge>
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-400">{t.provider}</td>
                    <td className="tnum py-2.5 text-right text-slate-400">
                      {fmt(t.entryPrice)}
                      {t.exitPrice != null ? ` → ${fmt(t.exitPrice)}` : ""}
                    </td>
                    <td
                      className={cn(
                        "tnum py-2.5 text-right font-semibold",
                        t.realizedPnl >= 0 ? "text-mint-400" : "text-rose-400",
                      )}
                    >
                      {t.realizedPnl >= 0 ? "+" : "-"}
                      {usd(Math.abs(t.realizedPnl))}
                    </td>
                    <td className="py-2.5 text-right text-[11.5px] text-slate-500">
                      {t.closedAt
                        ? new Date(t.closedAt).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Transactions */}
      {payments.length > 0 && (
        <Card className="p-6">
          <h2 className="text-[15px] font-semibold text-white">Transactions</h2>
          <div className="mt-4 space-y-1.5">
            {payments.slice(0, 15).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-lg",
                      p.kind === "deposit" ? "bg-mint-500/12 text-mint-400" : "bg-rose-500/12 text-rose-400",
                    )}
                  >
                    <WalletIcon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium capitalize text-white">
                      {p.kind} · {p.provider}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(p.createdAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("tnum text-[13px] font-semibold", p.kind === "deposit" ? "text-mint-400" : "text-white")}>
                    {p.kind === "deposit" ? "+" : "-"}
                    {usd(p.amountMinor)}
                  </p>
                  <Badge tone={p.status === "completed" ? "mint" : p.status === "failed" ? "rose" : "amber"}>
                    {p.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
