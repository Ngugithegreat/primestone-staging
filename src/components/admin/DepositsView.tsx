"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Check, Coins, Smartphone, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Primitives";
import { cn, initialsOf } from "@/lib/utils";

type Deposit = {
  id: string;
  amountMinor: number;
  chargedAmountMinor: number;
  chargedCurrency: string;
  provider: string;
  status: string;
  providerRef: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; flag: string; account: string };
};

type Totals = {
  count: number;
  completed: number;
  completedMinor: number;
  pending: number;
  pendingMinor: number;
  failed: number;
};

const usd = (m: number) =>
  `$${(m / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TONE: Record<string, "mint" | "amber" | "rose" | "slate"> = {
  completed: "mint",
  pending: "amber",
  initiated: "amber",
  failed: "rose",
  cancelled: "slate",
};

export function DepositsView() {
  const [rows, setRows] = useState<Deposit[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string>();

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/deposits", { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      setRows(d.deposits ?? []);
      setTotals(d.totals ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (paymentId: string, action: "reconcile" | "credit") => {
    setBusy(paymentId + action);
    setErr(undefined);
    const res = await fetch("/api/admin/deposits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentId, action }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setErr(d.error ?? "Action failed.");
      return;
    }
    if (action === "reconcile") {
      const msg =
        d.status === "completed"
          ? "Credited ✓"
          : `Still ${d.status}${d.detail ? ` — ${d.detail}` : ""}`;
      setNotes((n) => ({ ...n, [paymentId]: msg }));
    }
    await load();
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-mint-400" />
      </div>
    );
  }

  const shown = pendingOnly
    ? rows.filter((r) => r.status === "pending" || r.status === "initiated")
    : rows;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold text-white">Deposits</h1>
          <p className="mt-1 text-[14px] text-slate-400">
            Every deposit across all users. Reconcile or credit any that got stuck pending.
          </p>
        </div>
        <button
          onClick={() => setPendingOnly((v) => !v)}
          className={cn(
            "focus-ring rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
            pendingOnly
              ? "border-amber-450/40 bg-amber-450/10 text-amber-300"
              : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]",
          )}
        >
          {pendingOnly ? "Showing pending only" : "Show pending only"}
        </button>
      </div>

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total credited" value={usd(totals.completedMinor)} tone="text-mint-400" />
          <Stat label="Completed" value={String(totals.completed)} tone="text-white" />
          <Stat
            label="Pending"
            value={`${totals.pending} · ${usd(totals.pendingMinor)}`}
            tone="text-amber-300"
          />
          <Stat label="Failed" value={String(totals.failed)} tone="text-slate-300" />
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3.5 py-2.5 text-[12.5px] text-rose-300">
          {err}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-880/50">
        {shown.length === 0 ? (
          <p className="px-4 py-16 text-center text-[14px] text-slate-500">
            {pendingOnly ? "No pending deposits." : "No deposits yet."}
          </p>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {shown.map((d) => {
              // Show the reconcile/credit actions for anything not yet credited —
              // including "failed", since a customer can pay (M-Pesa proof) after
              // an STK prompt timed out, leaving real money that must be credited.
              const canSettle =
                d.status === "pending" || d.status === "initiated" || d.status === "failed";
              return (
                <div key={d.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-ink-950"
                      style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}
                    >
                      {initialsOf(d.user.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-[13.5px] font-medium text-white">
                        {d.user.flag} {d.user.name || d.user.email}
                        <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-mint-300">
                          {d.user.account}
                        </span>
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-[11.5px] text-slate-500">
                        {d.provider === "crypto" ? (
                          <Coins className="h-3 w-3" />
                        ) : d.provider === "mpesa" ? (
                          <Smartphone className="h-3 w-3" />
                        ) : (
                          <Wallet className="h-3 w-3" />
                        )}
                        {d.provider} ·{" "}
                        {new Date(d.createdAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="tnum text-[15px] font-semibold text-white">{usd(d.amountMinor)}</p>
                      <Badge tone={TONE[d.status] ?? "slate"}>{d.status}</Badge>
                    </div>
                    {canSettle && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => act(d.id, "reconcile")}
                          disabled={busy !== null}
                          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-medium text-slate-200 hover:bg-white/[0.09]"
                        >
                          {busy === d.id + "reconcile" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Reconcile
                        </button>
                        <button
                          onClick={() => act(d.id, "credit")}
                          disabled={busy !== null}
                          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-mint-500/30 bg-mint-500/[0.1] px-3 py-1.5 text-[12.5px] font-medium text-mint-300 hover:bg-mint-500/[0.18]"
                        >
                          {busy === d.id + "credit" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Credit
                        </button>
                      </div>
                    )}
                  </div>
                  </div>
                  {(d.providerRef || notes[d.id]) && (
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 pl-12 text-[11px] text-slate-500">
                      {d.providerRef && (
                        <span className="font-mono text-slate-400">ref {d.providerRef}</span>
                      )}
                      {notes[d.id] && (
                        <span
                          className={
                            notes[d.id].startsWith("Credited") ? "text-mint-400" : "text-amber-300"
                          }
                        >
                          {notes[d.id]}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[11.5px] text-slate-600">
        <strong className="text-slate-400">Reconcile</strong> re-checks the provider (Safaricom /
        NOWPayments) and credits if the payment actually completed.{" "}
        <strong className="text-slate-400">Credit</strong> force-credits a deposit you&rsquo;ve
        confirmed arrived out of band. Both are idempotent — a deposit can never be credited twice.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-ink-880/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={cn("tnum mt-1.5 text-[20px] font-bold", tone)}>{value}</p>
    </div>
  );
}
