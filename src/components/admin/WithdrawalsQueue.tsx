"use client";

import { useCallback, useEffect, useState } from "react";
import { Bitcoin, Check, Loader2, Phone, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/Primitives";
import { Input } from "@/components/ui/Field";
import { cn, initialsOf } from "@/lib/utils";

type Withdrawal = {
  id: string;
  amountMinor: number;
  currency: string;
  provider: string;
  destination: string | null;
  status: string;
  externalRef: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; phone: string; flag: string; kyc: string; account: string };
};

const usd = (m: number) =>
  `$${(m / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TONE: Record<string, "mint" | "amber" | "rose" | "slate"> = {
  completed: "mint",
  pending: "amber",
  cancelled: "slate",
  failed: "rose",
};

export function WithdrawalsQueue() {
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [active, setActive] = useState<{ id: string; mode: "pay" | "reject" } | null>(null);
  const [refInput, setRefInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [err, setErr] = useState<string>();

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/withdrawals", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).withdrawals ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (paymentId: string, action: "complete" | "reject" | "send-mpesa") => {
    setBusy(paymentId + action);
    setErr(undefined);
    const res = await fetch("/api/admin/withdrawals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paymentId,
        action,
        externalRef: action === "complete" ? refInput.trim() || undefined : undefined,
        reason: action === "reject" ? reasonInput.trim() || undefined : undefined,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setErr(d.error ?? "Action failed.");
      return;
    }
    setActive(null);
    setRefInput("");
    setReasonInput("");
    await load();
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-mint-400" />
      </div>
    );
  }

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-bold text-white">Withdrawals</h1>
        <p className="mt-1 text-[14px] text-slate-400">
          {pending.length > 0
            ? `${pending.length} request${pending.length === 1 ? "" : "s"} awaiting payout. Send the money via M-Pesa, then mark it paid.`
            : "No pending withdrawal requests."}
        </p>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3.5 py-2.5 text-[12.5px] text-rose-300">
          {err}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-880/50">
        {rows.length === 0 ? (
          <p className="px-4 py-16 text-center text-[14px] text-slate-500">No withdrawals yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {rows.map((w) => (
              <div key={w.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-ink-950"
                      style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}
                    >
                      {initialsOf(w.user.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13.5px] font-medium text-white">{w.user.name}</p>
                        <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-mint-300">
                          {w.user.account}
                        </span>
                        <Badge tone={w.provider === "crypto" ? "iris" : "slate"}>
                          {w.provider === "crypto" ? "USDT" : "M-Pesa"}
                        </Badge>
                      </div>
                      <p className="flex items-center gap-1.5 truncate text-[11.5px] text-slate-500">
                        {w.provider === "crypto" ? (
                          <Bitcoin className="h-3 w-3" />
                        ) : (
                          <Phone className="h-3 w-3" />
                        )}
                        <span className={w.provider === "crypto" ? "font-mono" : ""}>
                          {w.destination ?? w.user.phone}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="tnum text-[15px] font-semibold text-white">{usd(w.amountMinor)}</p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(w.createdAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {w.status === "pending" ? (
                      <div className="flex gap-2">
                        {w.provider === "mpesa" && (
                          <button
                            onClick={() => act(w.id, "send-mpesa")}
                            disabled={busy !== null}
                            title="Pay this out automatically via M-Pesa (B2C)"
                            className="focus-ring inline-flex items-center gap-1 rounded-lg border border-iris-500/30 bg-iris-500/[0.1] px-3 py-1.5 text-[12.5px] font-medium text-iris-200 hover:bg-iris-500/[0.18]"
                          >
                            {busy === w.id + "send-mpesa" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Send via M-Pesa
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActive({ id: w.id, mode: "pay" });
                            setErr(undefined);
                          }}
                          disabled={busy !== null}
                          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-mint-500/30 bg-mint-500/[0.1] px-3 py-1.5 text-[12.5px] font-medium text-mint-300 hover:bg-mint-500/[0.18]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Mark paid
                        </button>
                        <button
                          onClick={() => {
                            setActive({ id: w.id, mode: "reject" });
                            setErr(undefined);
                          }}
                          disabled={busy !== null}
                          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/[0.08] px-3 py-1.5 text-[12.5px] font-medium text-rose-300 hover:bg-rose-500/[0.16]"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <Badge tone={TONE[w.status] ?? "slate"}>{w.status}</Badge>
                    )}
                  </div>
                </div>

                {active?.id === w.id && (
                  <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                    {active.mode === "pay" ? (
                      <>
                        <p className="text-[12.5px] text-slate-300">
                          Confirm you have sent <span className="font-semibold text-white">{usd(w.amountMinor)}</span> to{" "}
                          <span className={cn("font-semibold text-white", w.provider === "crypto" && "break-all font-mono")}>
                            {w.destination ?? w.user.phone}
                          </span>{" "}
                          {w.provider === "crypto" ? "via USDT (TRC-20)." : "via M-Pesa."}
                        </p>
                        <Input
                          value={refInput}
                          onChange={(e) => setRefInput(e.target.value)}
                          placeholder={
                            w.provider === "crypto"
                              ? "Transaction hash (optional)"
                              : "M-Pesa confirmation code (optional)"
                          }
                          className="mt-2.5"
                        />
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => act(w.id, "complete")}
                            disabled={busy === w.id + "complete"}
                            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-mint-500 px-3.5 py-2 text-[12.5px] font-semibold text-ink-950 hover:bg-mint-400"
                          >
                            {busy === w.id + "complete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Confirm paid
                          </button>
                          <button onClick={() => setActive(null)} className="rounded-lg px-3 py-2 text-[12.5px] text-slate-400 hover:text-white">
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-[12.5px] text-slate-300">
                          Reject this request and return <span className="font-semibold text-white">{usd(w.amountMinor)}</span> to the
                          client&rsquo;s balance.
                        </p>
                        <Input
                          value={reasonInput}
                          onChange={(e) => setReasonInput(e.target.value)}
                          placeholder="Reason (optional)"
                          className="mt-2.5"
                        />
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => act(w.id, "reject")}
                            disabled={busy === w.id + "reject"}
                            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-rose-400"
                          >
                            {busy === w.id + "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                            Reject & refund
                          </button>
                          <button onClick={() => setActive(null)} className="rounded-lg px-3 py-2 text-[12.5px] text-slate-400 hover:text-white">
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
