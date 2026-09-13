"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Loader2,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Wallet as WalletIcon,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Badge, Card } from "@/components/ui/Primitives";
import {
  closeAllocation,
  cryptoDeposit,
  cryptoStatus,
  getAccount,
  getRealProviders,
  usd,
  getUsdKesRate,
  mpesaDeposit,
  mpesaStatus,
  subscribeToProvider,
  type AccountSnapshot,
  type RealProvider,
} from "@/lib/accountClient";
import { useStore } from "@/lib/store";
import { clearPendingCopy, getPendingCopy, setPendingCopy } from "@/lib/pendingCopy";
import { WithdrawPanel } from "./WithdrawPanel";
import { cn, initialsOf } from "@/lib/utils";

/**
 * The real, ledger-backed money experience for authenticated users: live
 * balance, M-Pesa deposits, and subscribing real funds to signal providers.
 */
export function RealWallet() {
  const user = useStore((s) => s.user);
  const pushToast = useStore((s) => s.pushToast);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [providers, setProviders] = useState<RealProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<AccountSnapshot | null> => {
    const [acc, provs] = await Promise.all([getAccount(), getRealProviders()]);
    setAccount(acc);
    setProviders(provs);
    setLoading(false);
    return acc;
  }, []);

  // After a deposit credits, if the user chose a provider to copy first, put the
  // freshly-deposited funds straight to work with them — no separate step.
  const handleCredited = useCallback(async () => {
    const acc = await refresh();
    const pending = getPendingCopy();
    const avail = acc?.balanceMinor ?? 0;
    if (!pending || avail <= 0) return;
    clearPendingCopy();
    const res = await subscribeToProvider({ providerId: pending.providerId, amount: avail / 100 });
    if (res.ok) {
      pushToast({
        tone: "success",
        title: `Now copying ${pending.name}`,
        body: `${usd(avail)} from your deposit is now copying ${pending.name}.`,
      });
      await refresh();
    } else {
      pushToast({
        tone: "info",
        title: "Deposit credited",
        body: `Couldn't auto-start copying (${res.error}). You can copy from your wallet.`,
      });
    }
  }, [refresh, pushToast]);

  // Void-typed wrapper for children that just want a "reload" callback.
  const reload = useCallback(async () => {
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-mint-400" />
      </div>
    );
  }

  const balanceMinor = account?.balanceMinor ?? 0;
  const copyingMinor = (account?.allocations ?? [])
    .filter((a) => a.status !== "closed")
    .reduce((s, a) => s + (a.valueMinor ?? a.amountMinor), 0);
  const totalMinor = balanceMinor + copyingMinor;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-white">Wallet</h1>
        <p className="mt-1 text-[14px] text-slate-400">
          Deposit with M-Pesa and assign your funds to a strategy provider.
        </p>
      </div>

      {/* Balance */}
      <Card className="card-sheen overflow-hidden p-0">
        <div className="relative p-6">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-[70px]"
            style={{ background: "radial-gradient(closest-side, rgba(0,223,164,0.22), transparent 70%)" }}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-slate-500">
                Total account value
              </p>
              <p className="mt-1.5 font-display text-[34px] font-bold leading-none text-white">
                {usd(totalMinor)}
              </p>
              <p className="mt-2 text-[12.5px] text-slate-500">
                {user?.firstName ? `${user.firstName}'s account` : "Your account"} · real funds
              </p>
            </div>
            <Badge tone="mint" dot>
              Live balance
            </Badge>
          </div>

          {/* Available / Copying breakdown */}
          <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Available</p>
              <p className="tnum mt-1 text-[17px] font-semibold text-white">{usd(balanceMinor)}</p>
              <p className="text-[11px] text-slate-500">ready to deposit or copy</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Copying</p>
              <p className="tnum mt-1 text-[17px] font-semibold text-mint-400">{usd(copyingMinor)}</p>
              <p className="text-[11px] text-slate-500">working with providers</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <DepositPanel defaultPhone={user?.phone ?? ""} onCredited={handleCredited} />
        <WithdrawPanel
          balanceMinor={balanceMinor}
          kycStatus={account?.kycStatus ?? "unverified"}
          twoFactor={account?.twoFactor ?? false}
          onDone={reload}
        />
      </div>

      <Providers
        providers={providers}
        balanceMinor={balanceMinor}
        onSubscribed={reload}
        pushToast={pushToast}
      />

      <Allocations account={account} onChanged={reload} pushToast={pushToast} />
      <History account={account} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Deposit panel — M-Pesa / Crypto tabs                                       */
/* -------------------------------------------------------------------------- */

function DepositPanel({
  defaultPhone,
  onCredited,
}: {
  defaultPhone: string;
  onCredited: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"mpesa" | "crypto">("mpesa");
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
        {(["mpesa", "crypto"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors",
              tab === t ? "bg-white/[0.09] text-white" : "text-slate-400 hover:text-slate-200",
            )}
          >
            {t === "mpesa" ? "M-Pesa" : "Crypto"}
          </button>
        ))}
      </div>
      {tab === "mpesa" ? (
        <MpesaDeposit defaultPhone={defaultPhone} onCredited={onCredited} />
      ) : (
        <CryptoDeposit onCredited={onCredited} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  M-Pesa deposit                                                             */
/* -------------------------------------------------------------------------- */

function MpesaDeposit({
  defaultPhone,
  onCredited,
}: {
  defaultPhone: string;
  onCredited: () => Promise<void>;
}) {
  const MIN_USD = 100;
  const [amount, setAmount] = useState(MIN_USD); // USD
  const [phone, setPhone] = useState(defaultPhone);
  const [state, setState] = useState<
    "idle" | "prompting" | "waiting" | "confirming" | "slow" | "done" | "failed"
  >("idle");
  const [message, setMessage] = useState<string>();
  const [rate, setRate] = useState(129);
  const pollRef = useRef<number | null>(null);
  const lastPaymentId = useRef<string | null>(null);

  useEffect(() => {
    getUsdKesRate().then(setRate);
  }, []);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const start = async () => {
    if (amount < MIN_USD) {
      setState("failed");
      setMessage(`The minimum deposit is $${MIN_USD}.`);
      return;
    }
    setMessage(undefined);
    setState("prompting");
    const res = await mpesaDeposit({ amountUsd: amount, phone });
    if (!res.ok) {
      setState("failed");
      setMessage(res.error);
      return;
    }
    setState("waiting");
    setMessage(res.message ?? "Check your phone and enter your M-Pesa PIN.");

    // Poll Safaricom until the deposit resolves — independent of the async
    // callback. A "pending" result (incl. code 4999 "still processing") is NOT
    // a failure: we keep waiting. Only a real terminal code stops us, and after
    // a while we switch to a reassuring "still confirming" state, never an error.
    const paymentId = res.paymentId;
    lastPaymentId.current = paymentId;
    let ticks = 0;
    pollRef.current = window.setInterval(async () => {
      ticks++;
      // Once the customer has had time to punch in their PIN, reflect that we're
      // now confirming rather than still waiting on them.
      setState((s) => (s === "waiting" && ticks >= 6 ? "confirming" : s));
      const { status, detail, code } = await mpesaStatus(paymentId);
      if (status === "completed") {
        window.clearInterval(pollRef.current!);
        setState("done");
        setMessage("Payment received — your balance has been updated.");
        await onCredited();
      } else if (status === "failed") {
        window.clearInterval(pollRef.current!);
        setState("failed");
        setMessage(
          `Payment didn't go through${detail ? `: ${humanizeMpesa(detail, code)}` : "."}`,
        );
      } else if (ticks > 60) {
        // ~4 minutes and still pending — not a failure. The reconcile cron and
        // callback will credit it automatically once Safaricom confirms.
        window.clearInterval(pollRef.current!);
        setState("slow");
        setMessage(
          "Still confirming with M-Pesa. If the money left your phone, it will be credited automatically within a few minutes — you can safely close this.",
        );
      }
    }, 4000);
  };

  const recheck = async () => {
    const pid = lastPaymentId.current;
    if (!pid) return setState("idle");
    setState("confirming");
    const { status, detail, code } = await mpesaStatus(pid);
    if (status === "completed") {
      setState("done");
      setMessage("Payment received — your balance has been updated.");
      await onCredited();
    } else if (status === "failed") {
      setState("failed");
      setMessage(`Payment didn't go through${detail ? `: ${humanizeMpesa(detail, code)}` : "."}`);
    } else {
      setState("slow");
      setMessage(
        "Still confirming with M-Pesa. If the money left your phone, it will be credited automatically within a few minutes.",
      );
    }
  };

  const busy = state === "prompting" || state === "waiting" || state === "confirming";
  const inProgress = busy || state === "slow";

  const STEPS: { key: string; label: string }[] = [
    { key: "sent", label: "STK prompt sent to your phone" },
    { key: "pin", label: "Approve it — enter your M-Pesa PIN" },
    { key: "credit", label: "Confirming & crediting your account" },
  ];
  // Which step is active/complete for the timeline.
  const stepIndex = state === "prompting" ? 0 : state === "waiting" ? 1 : 2;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-mint-500/25 bg-mint-500/10">
          <Smartphone className="h-4.5 w-4.5 text-mint-400" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-white">Deposit with M-Pesa</h2>
          <p className="text-[12px] text-slate-500">An STK prompt is sent to your phone.</p>
        </div>
      </div>

      {state === "done" ? (
        <div className="mt-5 grid place-items-center rounded-xl border border-mint-500/25 bg-mint-500/[0.07] px-4 py-8 text-center">
          <CheckCircle2 className="h-9 w-9 text-mint-400" />
          <p className="mt-3 text-[14px] font-semibold text-white">Deposit successful</p>
          <p className="mt-1 text-[12.5px] text-slate-400">{message}</p>
          <button
            onClick={() => setState("idle")}
            className="mt-4 text-[13px] font-medium text-mint-400 hover:text-mint-300"
          >
            Make another deposit
          </button>
        </div>
      ) : inProgress ? (
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2.5">
            {state === "slow" ? (
              <Clock className="h-5 w-5 text-amber-400" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-mint-400" />
            )}
            <p className="text-[14.5px] font-semibold text-white">
              {state === "prompting"
                ? "Sending prompt…"
                : state === "slow"
                  ? "Still confirming"
                  : "Payment in progress"}
            </p>
          </div>
          <p className="mt-1 text-[12.5px] text-slate-400">
            ${amount.toLocaleString()} · ≈ KES {Math.round(amount * rate).toLocaleString()} to {phone}
          </p>

          <div className="mt-4 space-y-3">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                      done
                        ? "border-mint-500/30 bg-mint-500/15"
                        : active
                          ? "border-mint-500/40 bg-mint-500/10"
                          : "border-white/10 bg-white/[0.03]",
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-mint-400" />
                    ) : active ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-mint-300" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[13px]",
                      done ? "text-slate-300" : active ? "font-medium text-white" : "text-slate-500",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {message && (
            <div
              className={cn(
                "mt-4 rounded-lg border p-3 text-[12.5px] leading-relaxed",
                state === "slow"
                  ? "border-amber-450/25 bg-amber-450/[0.06] text-amber-300"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-400",
              )}
            >
              {message}
            </div>
          )}

          {state === "slow" && (
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={recheck} size="sm">
                Check again
              </Button>
              <button
                onClick={() => setState("idle")}
                className="text-[13px] font-medium text-slate-400 hover:text-white"
              >
                Make another deposit
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <Field label="Amount (USD)" htmlFor="dep-amount" hint={`Minimum $${MIN_USD}`}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">
                $
              </span>
              <Input
                id="dep-amount"
                type="number"
                min={MIN_USD}
                step={50}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value))))}
                disabled={busy}
                className="pl-7"
              />
            </div>
          </Field>
          <div className="flex flex-wrap gap-2">
            {[100, 200, 300, 500, 1000].map((v) => (
              <button
                key={v}
                type="button"
                disabled={busy}
                onClick={() => setAmount(v)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors",
                  amount === v
                    ? "border-mint-500/50 bg-mint-500/10 text-mint-300"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]",
                )}
              >
                ${v.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
            <span className="text-[12px] text-slate-500">You&rsquo;ll pay on M-Pesa</span>
            <span className="tnum text-[13.5px] font-semibold text-white">
              ≈ KES {Math.round(amount * rate).toLocaleString()}
            </span>
          </div>
          <p className="-mt-2 text-[11px] text-slate-600">
            Charged in KES at today&rsquo;s rate (~{rate.toFixed(1)} / $1) · credited to your
            account as ${amount.toLocaleString()}.
          </p>

          <Field label="M-Pesa phone" htmlFor="dep-phone" hint="Safaricom number">
            <Input
              id="dep-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              disabled={busy}
            />
          </Field>

          {message && state === "failed" && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-3 text-[12.5px] text-rose-300">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {message}
            </div>
          )}

          <Button onClick={start} disabled={busy} className="w-full">
            {state === "failed" ? "Try again" : `Deposit $${amount.toLocaleString()}`}
          </Button>

          <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px] text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-mint-500/70" />
            Secured by Safaricom M-Pesa · funds credited instantly on confirmation
          </div>
        </div>
      )}
    </Card>
  );
}


/* -------------------------------------------------------------------------- */
/*  Crypto deposit (NOWPayments)                                               */
/* -------------------------------------------------------------------------- */

const CRYPTO_MIN = 20;
const NETWORKS = [
  { id: "usdttrc20", label: "USDT", net: "Tron (TRC-20)", note: "lowest fees · recommended" },
  { id: "usdtbsc", label: "USDT", net: "BNB Chain (BEP-20)", note: "low fees" },
];

function CryptoDeposit({ onCredited }: { onCredited: () => Promise<void> }) {
  const [amount, setAmount] = useState(100);
  const [coin, setCoin] = useState("usdttrc20");
  const [state, setState] = useState<"idle" | "creating" | "awaiting" | "done" | "failed">("idle");
  const [message, setMessage] = useState<string>();
  const [addr, setAddr] = useState<string>();
  const [payAmount, setPayAmount] = useState<number>();
  const [payCurrency, setPayCurrency] = useState<string>();
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const network = NETWORKS.find((n) => n.id === coin) ?? NETWORKS[0]!;

  const start = async () => {
    if (amount < CRYPTO_MIN) {
      setState("failed");
      setMessage(`The minimum crypto deposit is $${CRYPTO_MIN}.`);
      return;
    }
    setMessage(undefined);
    setState("creating");
    const res = await cryptoDeposit({ amountUsd: amount, payCurrency: coin });
    if (!res.ok) {
      setState("failed");
      setMessage(res.error);
      return;
    }
    setAddr(res.payAddress);
    setPayAmount(res.payAmount);
    setPayCurrency(res.payCurrency);
    setState("awaiting");

    const paymentId = res.paymentId;
    let ticks = 0;
    pollRef.current = window.setInterval(async () => {
      ticks++;
      const status = await cryptoStatus(paymentId);
      if (status === "completed") {
        window.clearInterval(pollRef.current!);
        setState("done");
        setMessage("Payment received — your balance has been updated.");
        await onCredited();
      } else if (status === "failed" || ticks > 180) {
        window.clearInterval(pollRef.current!);
        if (status === "failed") {
          setState("failed");
          setMessage("This deposit expired or failed. You can start a new one.");
        }
      }
    }, 10000);
  };

  const copy = async () => {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-iris-500/25 bg-iris-500/10">
          <Coins className="h-4.5 w-4.5 text-iris-300" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-white">Deposit with crypto</h2>
          <p className="text-[12px] text-slate-500">USDT · credited automatically on confirmation.</p>
        </div>
      </div>

      {state === "done" ? (
        <div className="mt-5 grid place-items-center rounded-xl border border-mint-500/25 bg-mint-500/[0.07] px-4 py-8 text-center">
          <CheckCircle2 className="h-9 w-9 text-mint-400" />
          <p className="mt-3 text-[14px] font-semibold text-white">Deposit received</p>
          <p className="mt-1 text-[12.5px] text-slate-400">{message}</p>
          <button
            onClick={() => setState("idle")}
            className="mt-4 text-[13px] font-medium text-mint-400 hover:text-mint-300"
          >
            Make another deposit
          </button>
        </div>
      ) : state === "awaiting" ? (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-iris-500/20 bg-iris-500/[0.05] p-4">
            <p className="text-[12px] text-slate-400">Send at least (for ${amount.toLocaleString()})</p>
            <p className="tnum mt-0.5 text-[20px] font-bold text-white">
              {payAmount}{" "}
              <span className="text-[14px] font-semibold uppercase text-iris-300">{payCurrency}</span>
            </p>
            <p className="mt-1 text-[11.5px] text-slate-500">on {network.net} · to the address below</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-slate-500">Deposit address</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all text-[12.5px] text-white">{addr}</code>
              <button
                onClick={copy}
                aria-label="Copy address"
                className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.09]"
              >
                {copied ? <Check className="h-4 w-4 text-mint-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-amber-450/30 bg-amber-450/[0.08] p-3 text-[12px] text-amber-200">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-semibold">Send the full amount above (or a little more).</span>{" "}
              Your exchange deducts a network fee (~1–2 USDT) from what you send, so the amount that
              arrives must still be at least {payAmount} {payCurrency} — add the fee on top when you
              withdraw, or the deposit can be held as underpaid. We credit exactly what arrives.
            </span>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-amber-450/25 bg-amber-450/[0.06] p-3 text-[12px] text-amber-300">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse" />
            Waiting for your transfer… it credits automatically once the network confirms (usually
            1–2 min). You can safely leave this page.
          </div>
          <p className="text-[11px] text-slate-600">
            Only send {network.label} on {network.net}. Sending another coin or network can lose the
            funds.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <Field label="Amount (USD)" htmlFor="cd-amount" hint={`Minimum $${CRYPTO_MIN}`}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">
                $
              </span>
              <Input
                id="cd-amount"
                type="number"
                min={CRYPTO_MIN}
                step={10}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value))))}
                className="pl-7"
              />
            </div>
          </Field>
          <div className="flex flex-wrap gap-2">
            {[50, 100, 200, 500, 1000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors",
                  amount === v
                    ? "border-iris-500/50 bg-iris-500/10 text-iris-200"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]",
                )}
              >
                ${v.toLocaleString()}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-slate-400">Coin &amp; network</p>
            <div className="space-y-2">
              {NETWORKS.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setCoin(n.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                    coin === n.id
                      ? "border-iris-500/50 bg-iris-500/[0.08]"
                      : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="grid h-4 w-4 place-items-center rounded-full border border-white/25">
                      {coin === n.id && <span className="h-2 w-2 rounded-full bg-iris-400" />}
                    </span>
                    <span className="text-[13px] font-medium text-white">{n.label}</span>
                    <span className="text-[12px] text-slate-400">· {n.net}</span>
                  </span>
                  <span className="text-[11px] text-slate-500">{n.note}</span>
                </button>
              ))}
            </div>
          </div>
          {message && state === "failed" && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-3 text-[12.5px] text-rose-300">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {message}
            </div>
          )}
          <Button onClick={start} disabled={state === "creating"} className="w-full">
            {state === "creating" && <Loader2 className="h-4 w-4 animate-spin" />}
            {state === "creating" ? "Generating address…" : "Get deposit address"}
          </Button>
          <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px] text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-iris-400/70" />
            Powered by NOWPayments · funds credit automatically on-chain
          </div>
        </div>
      )}
    </Card>
  );
}

/** Compact relative time (e.g. "3h ago", "just now"). */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Turn Safaricom's raw result text (and code) into something a customer understands. */
function humanizeMpesa(detail: string, code?: string): string {
  // Map on the ResultCode first — it's unambiguous.
  switch (code) {
    case "1032":
      return "you cancelled the prompt on your phone.";
    case "1037":
      return "the prompt timed out — no PIN was entered. Please try again.";
    case "1":
      return "insufficient M-Pesa balance.";
    case "2001":
      return "the PIN entered was incorrect.";
    case "1019":
      return "the request expired before it was completed. Please try again.";
    case "1001":
      return "another M-Pesa transaction is already in progress on that line — wait a moment and retry.";
  }
  const d = detail.toLowerCase();
  if (d.includes("cancel")) return "you cancelled the prompt on your phone.";
  if (d.includes("timeout") || d.includes("cannot be reached"))
    return "the prompt timed out — no PIN was entered. Please try again.";
  if (d.includes("insufficient")) return "insufficient M-Pesa balance.";
  if (d.includes("wrong") && d.includes("pin")) return "the PIN entered was incorrect.";
  if (d.includes("limit")) return "the amount exceeds your M-Pesa transaction limit.";
  return detail;
}

/* -------------------------------------------------------------------------- */
/*  Providers (subscribe)                                                      */
/* -------------------------------------------------------------------------- */

function Providers({
  providers,
  balanceMinor,
  onSubscribed,
  pushToast,
}: {
  providers: RealProvider[];
  balanceMinor: number;
  onSubscribed: () => Promise<void>;
  pushToast: (t: { tone: "success" | "error" | "info"; title: string; body?: string }) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The amount allocated is always the client's full available balance.
  const amountMajor = balanceMinor / 100;

  const subscribe = async (p: RealProvider) => {
    setBusy(true);
    const res = await subscribeToProvider({ providerId: p.id, amount: amountMajor });
    setBusy(false);
    if (!res.ok) {
      pushToast({ tone: "error", title: "Could not subscribe", body: res.error });
      return;
    }
    pushToast({ tone: "success", title: `Now copying ${p.name}`, body: `${usd(balanceMinor)} allocated.` });
    setOpenId(null);
    await onSubscribed();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-iris-500/25 bg-iris-500/10">
          <TrendingUp className="h-4.5 w-4.5 text-iris-300" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-white">Copy a strategy provider</h2>
          <p className="text-[12px] text-slate-500">Assign your balance to a provider.</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {providers.length === 0 && (
          <p className="text-[13px] text-slate-500">No providers available yet.</p>
        )}
        {providers.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-ink-950"
                style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}
              >
                {initialsOf(p.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13.5px] font-medium text-white">{p.name}</p>
                  {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-mint-400" />}
                </div>
                <p className="truncate text-[11.5px] text-slate-500">{p.strategy}</p>
              </div>
              <div className="text-right">
                <p className="tnum text-[13px] font-semibold text-mint-400">
                  +{Number(p.roi12m).toFixed(1)}%
                </p>
                <p className="text-[10.5px] text-slate-500">12M</p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {openId === p.id ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 border-t border-white/[0.06] pt-3">
                    <p className="text-[12.5px] text-slate-300">
                      Copy <span className="font-semibold text-white">{p.name}</span> with your
                      full balance of{" "}
                      <span className="font-semibold text-mint-400">{usd(balanceMinor)}</span>?
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Fee {(p.feeBps / 100).toFixed(0)}% of profit · you can unsubscribe any time to
                      return your funds.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setOpenId(null)}
                        disabled={busy}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => subscribe(p)}
                        disabled={busy || balanceMinor <= 0}
                        className="flex-1"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Copy with ${usd(balanceMinor)}`}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => {
                    if (balanceMinor <= 0) {
                      // Copy-first: remember the pick, then the deposit they make
                      // auto-allocates to this provider.
                      setPendingCopy(p.id, p.name);
                      pushToast({
                        tone: "info",
                        title: `You'll copy ${p.name}`,
                        body: "Deposit above — your funds start copying automatically.",
                      });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    } else {
                      setOpenId(p.id);
                    }
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-2 text-[12.5px] font-medium text-slate-200 transition-colors hover:bg-white/[0.07]"
                >
                  {balanceMinor <= 0 ? `Deposit & copy ${p.name}` : "Copy this provider"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Active allocations                                                         */
/* -------------------------------------------------------------------------- */

function Allocations({
  account,
  onChanged,
  pushToast,
}: {
  account: AccountSnapshot | null;
  onChanged: () => Promise<void>;
  pushToast: (t: { tone: "success" | "error" | "info"; title: string; body?: string }) => void;
}) {
  const active = (account?.allocations ?? []).filter((a) => a.status !== "closed");
  const [busyId, setBusyId] = useState<string | null>(null);
  if (active.length === 0) return null;

  const close = async (id: string) => {
    setBusyId(id);
    const res = await closeAllocation(id);
    setBusyId(null);
    if (res.ok) {
      pushToast({ tone: "success", title: "Unsubscribed", body: `${usd(res.returnedMinor)} returned to your balance.` });
      await onChanged();
    } else {
      pushToast({ tone: "error", title: "Could not unsubscribe", body: res.error });
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-[15px] font-semibold text-white">Your subscriptions</h2>
      <div className="mt-4 space-y-2.5">
        {active.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5"
          >
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-white">{a.provider.name}</p>
              <p className="truncate text-[11.5px] text-slate-500">{a.provider.strategy}</p>
            </div>
            <div className="text-right">
              <p className="tnum text-[13.5px] font-semibold text-white">{usd(a.amountMinor)}</p>
              <button
                onClick={() => close(a.id)}
                disabled={busyId === a.id}
                className="text-[11.5px] font-medium text-rose-400 hover:text-rose-300"
              >
                {busyId === a.id ? "Closing…" : "Unsubscribe"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  History                                                                    */
/* -------------------------------------------------------------------------- */

function History({ account }: { account: AccountSnapshot | null }) {
  const payments = account?.payments ?? [];
  if (payments.length === 0) return null;

  const TONE: Record<string, "mint" | "amber" | "rose" | "slate"> = {
    completed: "mint",
    pending: "amber",
    initiated: "amber",
    failed: "rose",
    cancelled: "slate",
  };

  return (
    <Card className="p-6">
      <h2 className="text-[15px] font-semibold text-white">Transactions</h2>
      <div className="mt-4 space-y-1.5">
        {payments.slice(0, 10).map((p) => (
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
                <p className="text-[11px] text-slate-500">{timeAgo(p.createdAt)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn("tnum text-[13px] font-semibold", p.kind === "deposit" ? "text-mint-400" : "text-white")}>
                {p.kind === "deposit" ? "+" : "-"}
                {usd(p.amountMinor)}
              </p>
              <Badge tone={TONE[p.status] ?? "slate"}>{p.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
