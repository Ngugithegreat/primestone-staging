"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Clock3, Loader2, Play, Plus, TrendingUp, UserPlus, Users2, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */

type Position = {
  id: string;
  provider: string;
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  currentPrice: number | null;
  sizePct: number;
  mirrors: number;
  stakedMinor: number;
  unrealizedMinor: number | null;
  openedAt: string;
};

type EngineData = {
  mode: "live" | "paper";
  providers: { id: string; name: string }[];
  symbols: string[];
  quotes: Record<string, number>;
  positions: Position[];
  summary: {
    openPositions: number;
    openMirrors: number;
    copiers: number;
    stakedMinor: number;
    unrealizedMinor: number;
    realizedMinor: number;
  };
  recentClosed: {
    id: string;
    provider: string;
    symbol: string;
    side: "buy" | "sell";
    entryPrice: number;
    exitPrice: number | null;
    reason: string | null;
    closedAt: string | null;
  }[];
};

const usd = (m: number) =>
  `$${(m / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (m: number) => (m < 0 ? "-" : "+") + usd(Math.abs(m));
const pnlColor = (m: number) => (m > 0 ? "text-mint-400" : m < 0 ? "text-rose-400" : "text-slate-300");
const fmtPrice = (p: number) => {
  const d = p >= 1000 ? 1 : p >= 1 ? 2 : 5;
  return p.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};

/* -------------------------------------------------------------------------- */

export function EngineMonitor() {
  const [data, setData] = useState<EngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string>();
  const [showOpen, setShowOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [riskDraft, setRiskDraft] = useState("");
  const [savedRisk, setSavedRisk] = useState<number | null>(null);
  const [savingRisk, setSavingRisk] = useState(false);
  const [autoBlowDraft, setAutoBlowDraft] = useState("");
  const [savedAutoBlow, setSavedAutoBlow] = useState<number | null>(null);
  const [savingAutoBlow, setSavingAutoBlow] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/engine", { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 6000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.riskPct != null) {
          setSavedRisk(d.riskPct);
          setRiskDraft(String(d.riskPct));
        }
        if (d?.autoBlowDays != null) {
          setSavedAutoBlow(d.autoBlowDays);
          setAutoBlowDraft(String(d.autoBlowDays));
        }
      });
  }, []);

  const saveAutoBlow = async () => {
    const v = Number(autoBlowDraft);
    if (!Number.isFinite(v) || v < 0) return;
    setSavingAutoBlow(true);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ autoBlowDays: v }),
    });
    const d = await res.json().catch(() => ({}));
    setSavingAutoBlow(false);
    if (res.ok && d.autoBlowDays != null) {
      setSavedAutoBlow(d.autoBlowDays);
      setAutoBlowDraft(String(d.autoBlowDays));
    }
  };

  const saveRisk = async () => {
    const v = Number(riskDraft);
    if (!Number.isFinite(v) || v <= 0) return;
    setSavingRisk(true);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ riskPct: v }),
    });
    const d = await res.json().catch(() => ({}));
    setSavingRisk(false);
    if (res.ok && d.riskPct != null) {
      setSavedRisk(d.riskPct);
      setRiskDraft(String(d.riskPct));
    }
  };

  const [testEmail, setTestEmail] = useState("");
  const [testAmount, setTestAmount] = useState("1000");
  const [testMinutes, setTestMinutes] = useState("2");
  const [testMsg, setTestMsg] = useState<string>();
  const [testBusy, setTestBusy] = useState<string | null>(null);

  const runTest = async (
    action: "credit" | "blow" | "schedule-blow" | "cancel-blow",
  ) => {
    setTestBusy(action);
    setTestMsg(undefined);
    const res = await fetch("/api/admin/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        email: testEmail.trim() || undefined,
        amount: Number(testAmount),
        minutes: Number(testMinutes),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setTestBusy(null);
    setTestMsg(res.ok ? (d.message ?? "Done.") : (d.error ?? "Failed."));
    await load();
  };

  const act = useCallback(
    async (payload: Record<string, unknown>, key: string): Promise<boolean> => {
      setBusy(key);
      setErr(undefined);
      const res = await fetch("/api/admin/engine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      setBusy(null);
      if (!res.ok) {
        setErr(d.error ?? "Action failed.");
        return false;
      }
      await load();
      return true;
    },
    [load],
  );

  if (loading || !data) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-mint-400" />
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-[24px] font-bold text-white">Copy engine</h1>
          {data.mode === "live" ? (
            <Badge tone="mint" dot>
              Live settlement
            </Badge>
          ) : (
            <Badge tone="amber" dot>
              Paper mode
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => act({ action: "tick" }, "tick")}
            disabled={busy !== null}
          >
            {busy === "tick" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run tick
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowAdd((v) => !v);
              setShowOpen(false);
            }}
            disabled={busy !== null}
          >
            <UserPlus className="h-4 w-4" />
            Add provider
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setShowOpen((v) => !v);
              setShowAdd(false);
            }}
          >
            <Plus className="h-4 w-4" />
            Open position
          </Button>
        </div>
      </div>

      <p className="-mt-2 text-[12.5px] text-slate-500">
        {data.mode === "live"
          ? "Closing a position settles real P&L to client balances."
          : "Positions mark live but settle no real money until COPY_SETTLEMENT=live."}
        {data.symbols.length === 0 && " · No live prices available right now."}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open positions" value={String(s.openPositions)} icon={Activity} tone="text-white" />
        <Stat
          label="Copiers · staked"
          value={`${s.copiers} · ${usd(s.stakedMinor)}`}
          icon={Users2}
          tone="text-white"
        />
        <Stat
          label="Unrealized P&L"
          value={signed(s.unrealizedMinor)}
          icon={TrendingUp}
          tone={pnlColor(s.unrealizedMinor)}
        />
        <Stat
          label="Realized (all-time)"
          value={signed(s.realizedMinor)}
          icon={Wallet}
          tone={pnlColor(s.realizedMinor)}
        />
      </div>

      {/* Risk control */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.09] bg-ink-880/70 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">Risk per trade</p>
          <p className="text-[11.5px] text-slate-500">
            % of each copier&rsquo;s balance risked on every trade the engine opens. Higher = bigger
            swings and faster blow-ups (for testing).
            {savedRisk != null && (
              <span className="text-slate-400"> Current: {savedRisk}%.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              value={riskDraft}
              onChange={(e) => setRiskDraft(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="w-24 pr-7"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-500">
              %
            </span>
          </div>
          <Button size="sm" onClick={saveRisk} disabled={savingRisk || riskDraft === ""}>
            {savingRisk ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3.5 py-2.5 text-[12.5px] text-rose-300">
          {err}
        </div>
      )}

      {showAdd && (
        <AddProviderForm
          busy={busy === "addProvider"}
          onClose={() => setShowAdd(false)}
          onSubmit={async (payload) => {
            const ok = await act({ action: "createProvider", ...payload }, "addProvider");
            if (ok) setShowAdd(false);
          }}
        />
      )}

      {showOpen && (
        <OpenForm
          data={data}
          busy={busy === "open"}
          onClose={() => setShowOpen(false)}
          onSubmit={async (payload) => {
            const ok = await act(payload, "open");
            if (ok) setShowOpen(false);
          }}
        />
      )}

      {/* Open positions */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-880/50">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-white">Open positions</h2>
        </div>
        {data.positions.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-slate-500">
            No open positions. Open one above, or let the automated tick run.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Provider</th>
                  <th className="px-4 py-2.5 font-medium">Instrument</th>
                  <th className="px-4 py-2.5 text-right font-medium">Entry → Now</th>
                  <th className="px-4 py-2.5 text-right font-medium">Size</th>
                  <th className="px-4 py-2.5 text-right font-medium">Copiers</th>
                  <th className="px-4 py-2.5 text-right font-medium">Staked</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unrealized</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.positions.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3 text-[13px] text-slate-200">{p.provider}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-white">{p.symbol}</span>
                        <Badge tone={p.side === "buy" ? "mint" : "rose"}>{p.side.toUpperCase()}</Badge>
                      </div>
                    </td>
                    <td className="tnum px-4 py-3 text-right text-[12.5px] text-slate-300">
                      {fmtPrice(p.entryPrice)}{" "}
                      <span className="text-slate-600">→</span>{" "}
                      {p.currentPrice != null ? fmtPrice(p.currentPrice) : "—"}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-[12.5px] text-slate-400">
                      {(p.sizePct * 100).toFixed(1)}%
                    </td>
                    <td className="tnum px-4 py-3 text-right text-[12.5px] text-slate-400">{p.mirrors}</td>
                    <td className="tnum px-4 py-3 text-right text-[12.5px] text-slate-300">
                      {usd(p.stakedMinor)}
                    </td>
                    <td
                      className={cn(
                        "tnum px-4 py-3 text-right text-[13px] font-semibold",
                        p.unrealizedMinor != null ? pnlColor(p.unrealizedMinor) : "text-slate-500",
                      )}
                    >
                      {p.unrealizedMinor != null ? signed(p.unrealizedMinor) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => act({ action: "close", positionId: p.id }, p.id)}
                        disabled={busy !== null}
                        className="focus-ring inline-flex items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/[0.08] px-2.5 py-1.5 text-[12px] font-medium text-rose-300 transition-colors hover:bg-rose-500/[0.16] disabled:opacity-40"
                      >
                        {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recently closed */}
      {data.recentClosed.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-ink-880/50 p-4">
          <h2 className="text-[14px] font-semibold text-white">Recently closed</h2>
          <div className="mt-3 space-y-1.5">
            {data.recentClosed.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 text-[12.5px] last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{c.symbol}</span>
                  <Badge tone={c.side === "buy" ? "mint" : "rose"}>{c.side.toUpperCase()}</Badge>
                  <span className="text-slate-500">· {c.provider}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="tnum">
                    {fmtPrice(c.entryPrice)} → {c.exitPrice != null ? fmtPrice(c.exitPrice) : "—"}
                  </span>
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-slate-400">
                    {c.reason ?? "closed"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Testing tools — remove before public launch */}
      <div className="rounded-2xl border border-amber-450/30 bg-amber-450/[0.05] p-4">
        <p className="text-[13px] font-semibold text-amber-300">Testing tools</p>
        <p className="mb-3 text-[11.5px] text-amber-200/70">
          For pre-launch testing only — remove before you go public. No real payment involved.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="user email (blank = all)"
            className="w-56"
          />
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-500">$</span>
            <Input
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="w-28 pl-6"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => runTest("credit")} disabled={testBusy !== null}>
            {testBusy === "credit" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add test funds
          </Button>
          <button
            onClick={() => runTest("blow")}
            disabled={testBusy !== null}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/[0.1] px-3.5 py-2 text-[12.5px] font-semibold text-rose-300 hover:bg-rose-500/[0.18]"
          >
            {testBusy === "blow" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Blow now{testEmail.trim() ? "" : " (all)"}
          </button>
        </div>

        {/* Timed blow */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-amber-450/15 pt-2.5">
          <span className="text-[11.5px] text-amber-200/70">Or blow in</span>
          <div className="relative">
            <Input
              value={testMinutes}
              onChange={(e) => setTestMinutes(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="w-20 pr-10"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">
              min
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => runTest("schedule-blow")} disabled={testBusy !== null}>
            {testBusy === "schedule-blow" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
            Set timer
          </Button>
          <button
            onClick={() => runTest("cancel-blow")}
            disabled={testBusy !== null}
            className="text-[12px] font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
          >
            Cancel timer
          </button>
        </div>
        {/* Auto-blow every account N days after it starts copying */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-amber-450/15 pt-2.5">
          <span className="text-[11.5px] text-amber-200/70">Auto-blow each account</span>
          <div className="relative">
            <Input
              value={autoBlowDraft}
              onChange={(e) => setAutoBlowDraft(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="w-20 pr-12"
              placeholder="0"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">
              days
            </span>
          </div>
          <span className="text-[11.5px] text-amber-200/70">after it starts copying</span>
          <Button size="sm" variant="secondary" onClick={saveAutoBlow} disabled={savingAutoBlow}>
            {savingAutoBlow ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
          <span className="text-[11px] text-slate-500">
            {savedAutoBlow != null && savedAutoBlow > 0
              ? `On — every account blows ${savedAutoBlow} day${savedAutoBlow === 1 ? "" : "s"} after it starts.`
              : "Off (0). Set >0 to auto-blow. Tip: 0.02 ≈ 30 min for fast tests."}
          </span>
        </div>
        {testMsg && <p className="mt-2 text-[12px] text-amber-200">{testMsg}</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  tone: string;
}) {
  return (
    <div className="card-sheen rounded-2xl border border-white/[0.07] bg-ink-880/70 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-slate-500">{label}</span>
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <p className={cn("tnum mt-2 truncate font-display text-[22px] font-bold", tone)}>{value}</p>
    </div>
  );
}

function AddProviderForm({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  // Pre-filled with Flossin so a new trader can be added in one click.
  const [name, setName] = useState("Flossin");
  const [country, setCountry] = useState("Kenya");
  const [strategy, setStrategy] = useState("Momentum · Crypto & Indices");
  const [bio, setBio] = useState(
    "Nairobi-based momentum trader focused on high-liquidity crypto and index moves, with disciplined risk control.",
  );
  const [roi12m, setRoi12m] = useState(128.5);
  const [winRate, setWinRate] = useState(68.4);
  const [maxDrawdown, setMaxDrawdown] = useState(12.7);
  const [feePct, setFeePct] = useState(20);
  const [minInvestment, setMinInvestment] = useState(100);
  const [verified, setVerified] = useState(true);

  const submit = () => {
    onSubmit({
      name,
      country,
      strategy,
      bio,
      roi12m,
      winRate,
      maxDrawdown,
      feeBps: Math.round(feePct * 100),
      minInvestment,
      verified,
    });
  };

  const num = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-ink-880/70 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-white">Add a strategy provider</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-400">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trader name" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-400">Country</span>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Kenya" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[12px] text-slate-400">Strategy</span>
          <Input value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder="e.g. Momentum · Crypto" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[12px] text-slate-400">Bio</span>
          <Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short description" />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-400">12M return %</span>
          <Input value={String(roi12m)} onChange={(e) => setRoi12m(num(e.target.value))} inputMode="decimal" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-400">Win rate %</span>
          <Input value={String(winRate)} onChange={(e) => setWinRate(num(e.target.value))} inputMode="decimal" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-400">Max drawdown %</span>
          <Input value={String(maxDrawdown)} onChange={(e) => setMaxDrawdown(num(e.target.value))} inputMode="decimal" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-400">Performance fee %</span>
          <Input value={String(feePct)} onChange={(e) => setFeePct(num(e.target.value))} inputMode="decimal" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-slate-400">Min investment $</span>
          <Input value={String(minInvestment)} onChange={(e) => setMinInvestment(num(e.target.value))} inputMode="decimal" />
        </label>
        <label className="flex items-end gap-2 pb-2.5">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
            className="h-4 w-4 accent-mint-500"
          />
          <span className="text-[12.5px] text-slate-300">Verified badge</span>
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={busy || name.trim().length < 2}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Add provider
        </Button>
      </div>
    </div>
  );
}

function OpenForm({
  data,
  busy,
  onClose,
  onSubmit,
}: {
  data: EngineData;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [providerId, setProviderId] = useState(data.providers[0]?.id ?? "");
  const [symbol, setSymbol] = useState(data.symbols[0] ?? "");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [sizePct, setSizePct] = useState(5);
  const [sl, setSl] = useState(1.5);
  const [tp, setTp] = useState(2.5);

  const price = data.quotes[symbol];

  const submit = () => {
    onSubmit({
      action: "open",
      providerId,
      symbol,
      side,
      sizePct: sizePct / 100,
      stopLossPct: sl / 100,
      takeProfitPct: tp / 100,
    });
  };

  const noProviders = data.providers.length === 0;
  const noSymbols = data.symbols.length === 0;

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-ink-880/70 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-white">Open a provider position</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {noProviders || noSymbols ? (
        <p className="mt-3 text-[13px] text-amber-300">
          {noProviders
            ? "No active providers to trade for. Add one first."
            : "No instruments have a live price right now — add a market-data key or wait for crypto prices."}
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] text-slate-400">Provider</span>
              <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {data.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-slate-400">
                Instrument {price != null && <span className="tnum text-slate-500">· {fmtPrice(price)}</span>}
              </span>
              <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {data.symbols.map((sy) => (
                  <option key={sy} value={sy}>
                    {sy}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div>
              <span className="mb-1 block text-[12px] text-slate-400">Direction</span>
              <div className="flex gap-1.5">
                {(["buy", "sell"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-[12.5px] font-medium capitalize transition-colors",
                      side === s
                        ? s === "buy"
                          ? "border-mint-500/50 bg-mint-500/10 text-mint-300"
                          : "border-rose-500/50 bg-rose-500/10 text-rose-300"
                        : "border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <NumField label="Size % of allocation" value={sizePct} onChange={setSizePct} step={0.5} />
            <NumField label="Stop-loss %" value={sl} onChange={setSl} step={0.1} />
            <NumField label="Take-profit %" value={tp} onChange={setTp} step={0.1} />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={submit} disabled={busy || !price} size="sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Open {side} · {symbol}
            </Button>
            <p className="text-[11.5px] text-slate-500">
              Mirrors to every active copier, sized to their allocation.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-slate-400">{label}</span>
      <Input
        type="number"
        value={value}
        step={step}
        min={0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
      />
    </label>
  );
}
