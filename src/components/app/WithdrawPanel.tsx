"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Bitcoin,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Card } from "@/components/ui/Primitives";
import { usd, withdrawRequest } from "@/lib/accountClient";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Method = "mpesa" | "crypto";

/**
 * Withdraw funds (Wallet). The form is always fillable; at submit we require a
 * verified identity and sufficient funds. Unverified users get a clean verify
 * step; users with 2FA on are asked for their authenticator code before the
 * request is locked in. Payouts go to M-Pesa or a USDT (TRC-20) address.
 */
export function WithdrawPanel({
  balanceMinor,
  kycStatus,
  twoFactor,
  onDone,
}: {
  balanceMinor: number;
  kycStatus: string;
  twoFactor: boolean;
  onDone: () => Promise<void>;
}) {
  const userPhone = useStore((s) => s.user?.phone ?? "");
  const verified = kycStatus === "verified";
  const maxUsd = Math.floor(balanceMinor / 100);

  const [method, setMethod] = useState<Method>("mpesa");
  const [amount, setAmount] = useState<number>(0);
  const [phone, setPhone] = useState(userPhone);
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "verify" | "twofa" | "done">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const noFunds = maxUsd <= 0;
  const destLabel = method === "mpesa" ? phone : `${address.slice(0, 6)}…${address.slice(-4)}`;

  /** Validate the form; returns an error string or null. */
  const validate = (): string | null => {
    if (noFunds) return "You have no funds available to withdraw.";
    if (amount <= 0) return "Enter an amount to withdraw.";
    if (amount > maxUsd) return `You can withdraw up to ${usd(balanceMinor)}.`;
    if (method === "mpesa") {
      if (!/^(\+?254|0)\d{9}$/.test(phone.replace(/\s+/g, ""))) {
        return "Enter a valid Safaricom number.";
      }
    } else {
      if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address.trim())) {
        return "Enter a valid USDT (TRC-20) wallet address.";
      }
    }
    return null;
  };

  /** Fire the request (optionally with a 2FA code). */
  const send = async (withCode?: string) => {
    setSubmitting(true);
    setError(undefined);
    const res = await withdrawRequest({
      amount,
      method,
      phone: method === "mpesa" ? phone : undefined,
      address: method === "crypto" ? address.trim() : undefined,
      code: withCode,
    });
    setSubmitting(false);
    if (!res.ok && res.twoFactorRequired) {
      // Need an authenticator code — surface the code step.
      setState("twofa");
      if (res.error) setError(res.error);
      return;
    }
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setState("done");
    await onDone();
  };

  const submit = async () => {
    const err = validate();
    if (err) return setError(err);
    // Identity check happens at submit — an unverified account is asked to verify.
    if (!verified) return setState("verify");
    await send();
  };

  const confirmCode = async () => {
    if (!/^\d{6}$|^[0-9A-Za-z]{8,10}$/.test(code.replace(/\s/g, ""))) {
      return setError("Enter your 6-digit code (or a backup code).");
    }
    await send(code.replace(/\s/g, ""));
  };

  return (
    <Card className="card-sheen overflow-hidden p-0">
      <div className="relative p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full blur-[70px]"
          style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.18), transparent 70%)" }}
        />
        <div className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-iris-500/25 bg-iris-500/10">
            <ArrowUpRight className="h-4.5 w-4.5 text-iris-300" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-white">Withdraw funds</h2>
            <p className="text-[12px] text-slate-500">Cash out to M-Pesa or crypto.</p>
          </div>
        </div>

        {/* ---- Verify step (shown after submit when unverified) ------------- */}
        {state === "verify" ? (
          <div className="relative mt-5 grid place-items-center rounded-2xl border border-amber-450/25 bg-amber-450/[0.05] px-5 py-9 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-450/12">
              <ShieldAlert className="h-7 w-7 text-amber-400" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-white">Verify your identity to withdraw</p>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-400">
              Your withdrawal of <span className="font-semibold text-white">{usd(amount * 100)}</span> is
              ready. For your security and to meet compliance rules, we need to confirm your identity
              first — it takes about a minute.
            </p>
            <div className="mt-5 flex gap-2.5">
              <Button variant="ghost" size="sm" onClick={() => setState("idle")}>
                Back
              </Button>
              <Link
                href="/verify"
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl bg-mint-500 px-4 text-[13px] font-semibold text-ink-950 hover:bg-mint-400"
              >
                Verify identity
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : state === "twofa" ? (
          /* ---- 2FA code step --------------------------------------------- */
          <div className="relative mt-5 grid place-items-center rounded-2xl border border-iris-500/25 bg-iris-500/[0.05] px-5 py-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-iris-500/12">
              <ShieldCheck className="h-7 w-7 text-iris-300" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-white">Confirm with your authenticator</p>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-400">
              Enter the 6-digit code from your authenticator app to release{" "}
              <span className="font-semibold text-white">{usd(amount * 100)}</span> to {destLabel}.
            </p>
            <div className="mt-4 w-full max-w-[220px]">
              <Input
                autoFocus
                inputMode="numeric"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(undefined);
                }}
                placeholder="123456"
                className="text-center text-[18px] tracking-[0.3em]"
                onKeyDown={(e) => e.key === "Enter" && confirmCode()}
              />
            </div>
            {error && <p className="mt-2 text-[12.5px] text-rose-400">{error}</p>}
            <div className="mt-4 flex gap-2.5">
              <Button variant="ghost" size="sm" onClick={() => setState("idle")}>
                Back
              </Button>
              <Button size="sm" onClick={confirmCode} disabled={submitting}>
                Confirm withdrawal
              </Button>
            </div>
          </div>
        ) : state === "done" ? (
          <div className="relative mt-5 grid place-items-center rounded-2xl border border-mint-500/25 bg-mint-500/[0.07] px-5 py-9 text-center">
            <CheckCircle2 className="h-10 w-10 text-mint-400" />
            <p className="mt-3 text-[15px] font-semibold text-white">Withdrawal requested</p>
            <p className="mt-1 text-[13px] text-slate-400">
              We&rsquo;ll send {usd(amount * 100)} to {destLabel} shortly.
            </p>
            <button
              onClick={() => {
                setState("idle");
                setAmount(0);
                setCode("");
              }}
              className="mt-4 text-[13px] font-medium text-mint-400 hover:text-mint-300"
            >
              Make another request
            </button>
          </div>
        ) : (
          /* ---- Form ------------------------------------------------------- */
          <div className="relative mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
              <span className="text-[12px] text-slate-500">Available to withdraw</span>
              <span className="tnum text-[14px] font-semibold text-white">{usd(balanceMinor)}</span>
            </div>

            {/* Method toggle */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "mpesa", label: "M-Pesa", icon: Smartphone },
                { key: "crypto", label: "Crypto (USDT)", icon: Bitcoin },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setMethod(m.key);
                    setError(undefined);
                  }}
                  className={cn(
                    "focus-ring flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition",
                    method === m.key
                      ? "border-iris-500/40 bg-iris-500/10 text-white"
                      : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200",
                  )}
                >
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </button>
              ))}
            </div>

            <Field label="Amount (USD)" htmlFor="wd-amount">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">
                  $
                </span>
                <Input
                  id="wd-amount"
                  type="number"
                  min={0}
                  max={maxUsd}
                  value={amount || ""}
                  onChange={(e) => {
                    setAmount(Math.max(0, Math.round(Number(e.target.value))));
                    setError(undefined);
                  }}
                  disabled={submitting || noFunds}
                  className="pl-7"
                  placeholder="0"
                />
                {!noFunds && (
                  <button
                    type="button"
                    onClick={() => setAmount(maxUsd)}
                    className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/[0.1]"
                  >
                    Max
                  </button>
                )}
              </div>
            </Field>

            {method === "mpesa" ? (
              <Field label="M-Pesa phone" htmlFor="wd-phone" hint="Safaricom number">
                <Input
                  id="wd-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  disabled={submitting}
                />
              </Field>
            ) : (
              <Field label="USDT wallet address" htmlFor="wd-addr" hint="TRC-20 (TRON) network only">
                <Input
                  id="wd-addr"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  disabled={submitting}
                  className="font-mono text-[12.5px]"
                />
              </Field>
            )}

            {twoFactor && (
              <p className="flex items-center gap-1.5 text-[12px] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-mint-400" />
                You&rsquo;ll confirm this with your authenticator code.
              </p>
            )}

            {error && <p className="text-[12.5px] text-rose-400">{error}</p>}

            <Button onClick={submit} disabled={submitting || noFunds} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {noFunds
                ? "No funds to withdraw"
                : amount > 0
                  ? `Request withdrawal · $${amount.toLocaleString()}`
                  : "Request withdrawal"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
