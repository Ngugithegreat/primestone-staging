"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Bitcoin,
  Building2,
  CheckCircle2,
  Clock,
  Copy as CopyIcon,
  CreditCard,
  Loader2,
  Lock,
  Shield,
  Smartphone,
  Wallet as WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { StatTile } from "./StatTile";
import { STATUS_META, type KycStatus } from "@/lib/kyc";
import { useMarket } from "@/components/providers/MarketProvider";
import { Badge, Card, CardHeader } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { dateTimeShort, money } from "@/lib/format";
import { openPnl, useStore, type Txn } from "@/lib/store";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Method definitions                                                         */
/* -------------------------------------------------------------------------- */

type MethodId = Txn["method"];

const DEPOSIT_METHODS: {
  id: MethodId;
  name: string;
  icon: typeof Smartphone;
  color: string;
  speed: string;
  fee: string;
  min: number;
}[] = [
  { id: "mpesa", name: "M-Pesa", icon: Smartphone, color: "#00dfa4", speed: "Instant", fee: "Free", min: 10 },
  { id: "crypto", name: "Crypto", icon: Bitcoin, color: "#fbbf24", speed: "1–3 confirmations", fee: "Network only", min: 20 },
  { id: "card", name: "Card", icon: CreditCard, color: "#818cf8", speed: "Instant", fee: "Free", min: 10 },
  { id: "bank", name: "Bank transfer", icon: Building2, color: "#22d3ee", speed: "1–2 working days", fee: "Free", min: 100 },
];

const CHAINS = [
  { id: "trc20", label: "USDT · TRC-20", address: "TQmVc4Xn8pR7LhK2sYbW9dJf3ZgN6aE1Cu" },
  { id: "erc20", label: "USDT · ERC-20", address: "0x7a3Fd91Bc42E8b6D05fA19cE7364B8aD2915eF07" },
  { id: "bep20", label: "USDC · BEP-20", address: "0x2E9bAc41D7f5836aC0dB48e17Ff9C5a6b3E410dF" },
  { id: "btc", label: "Bitcoin", address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" },
];

const QUICK = [100, 500, 1000, 5000];

/* -------------------------------------------------------------------------- */
/*  View                                                                       */
/* -------------------------------------------------------------------------- */

export function WalletView() {
  const { prices } = useMarket();
  const user = useStore((s) => s.user);
  const balance = useStore((s) => s.balance);
  const positions = useStore((s) => s.positions);
  const txns = useStore((s) => s.txns);

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  const floating = useMemo(() => openPnl(positions, prices), [positions, prices]);
  const equity = balance + floating;

  const deposited = txns
    .filter((t) => t.kind === "deposit" && t.status === "completed")
    .reduce((s, t) => s + t.amount, 0);
  const withdrawn = txns
    .filter((t) => t.kind === "withdrawal" && t.status !== "failed")
    .reduce((s, t) => s + t.amount, 0);
  const pending = txns.filter((t) => t.status === "pending" || t.status === "processing");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-tight text-white">Wallet</h1>
        <p className="mt-1 text-[14px] text-slate-400">
          Fund your account, withdraw your balance and review every movement.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          label="Available balance"
          value={money(balance)}
          icon={WalletIcon}
          accent="#00dfa4"
          footer="Free to withdraw or allocate"
        />
        <StatTile
          index={1}
          label="Account equity"
          value={money(equity)}
          icon={Banknote}
          accent="#2ff0bd"
          delta={{
            value: `${floating >= 0 ? "+" : ""}${money(floating)} floating`,
            positive: floating >= 0,
          }}
        />
        <StatTile
          index={2}
          label="Total deposited"
          value={money(deposited)}
          icon={ArrowDownLeft}
          accent="#818cf8"
          footer={`${txns.filter((t) => t.kind === "deposit").length} deposits`}
        />
        <StatTile
          index={3}
          label="Total withdrawn"
          value={money(withdrawn)}
          icon={ArrowUpRight}
          accent="#fbbf24"
          footer={pending.length ? `${pending.length} pending` : "Nothing pending"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-2 gap-px border-b border-white/[0.06] bg-white/[0.04]">
            {(["deposit", "withdraw"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center justify-center gap-2 bg-ink-880 py-3.5 text-[14px] font-semibold capitalize transition-colors",
                  mode === m
                    ? "text-white shadow-[inset_0_-2px_0_var(--color-mint-500)]"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                {m === "deposit" ? (
                  <ArrowDownLeft className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
                {m}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === "deposit" ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {mode === "deposit" ? <DepositPanel /> : <WithdrawPanel balance={balance} />}
            </motion.div>
          </AnimatePresence>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader
              title="Transaction history"
              subtitle={`${txns.length} movements`}
            />
            <div className="max-h-[520px] divide-y divide-white/[0.04] overflow-y-auto">
              {txns.length === 0 && (
                <p className="px-5 py-12 text-center text-[13px] text-slate-500">
                  Nothing here yet.
                </p>
              )}
              {txns.map((t) => (
                <TxnRow key={t.id} txn={t} />
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-mint-500/25 bg-mint-500/10">
                <Shield className="h-4 w-4 text-mint-400" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-white">
                  Withdrawals return to source
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
                  Anti-money-laundering rules mean funds go back to the method they came
                  from, up to the amount deposited with it. Anything above that is paid to
                  your verified bank account.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Deposit                                                                    */
/* -------------------------------------------------------------------------- */

function DepositPanel() {
  const user = useStore((s) => s.user);
  const deposit = useStore((s) => s.deposit);
  const settleTxn = useStore((s) => s.settleTxn);
  const pushToast = useStore((s) => s.pushToast);

  const [method, setMethod] = useState<MethodId>("mpesa");
  const [amount, setAmount] = useState(500);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [chain, setChain] = useState(CHAINS[0]!.id);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", name: "" });
  const [state, setState] = useState<"idle" | "processing" | "done">("idle");
  const [error, setError] = useState<string>();

  const active = DEPOSIT_METHODS.find((m) => m.id === method)!;
  const selectedChain = CHAINS.find((c) => c.id === chain)!;

  const submit = () => {
    if (amount < active.min) {
      setError(`Minimum deposit with ${active.name} is $${active.min}.`);
      return;
    }
    if (method === "mpesa" && phone.replace(/\D/g, "").length < 9) {
      setError("Enter the phone number registered to your M-Pesa account.");
      return;
    }
    if (method === "card" && card.number.replace(/\D/g, "").length < 15) {
      setError("Enter a valid card number.");
      return;
    }

    setError(undefined);
    setState("processing");

    const detail =
      method === "mpesa"
        ? `M-Pesa · ${phone}`
        : method === "crypto"
          ? `${selectedChain.label}`
          : method === "card"
            ? `Card ending ${card.number.replace(/\D/g, "").slice(-4) || "0000"}`
            : "Bank transfer";

    window.setTimeout(() => {
      const txn = deposit({ method, amount, detail });
      if (txn.status !== "completed") {
        // Crypto and bank land as processing, then settle a moment later.
        window.setTimeout(() => {
          settleTxn(txn.id);
          pushToast({
            tone: "success",
            title: "Deposit confirmed",
            body: `${money(amount)} credited to your balance.`,
          });
        }, 3200);
      }
      setState("done");
      pushToast({
        tone: "success",
        title: txn.status === "completed" ? "Deposit received" : "Deposit submitted",
        body:
          txn.status === "completed"
            ? `${money(amount)} is available in your balance.`
            : "We are waiting on network confirmation.",
      });
      window.setTimeout(() => setState("idle"), 2600);
    }, 1400);
  };

  return (
    <div className="space-y-5 p-4">
      {/* Method picker */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DEPOSIT_METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMethod(m.id);
              setError(undefined);
            }}
            className={cn(
              "focus-ring rounded-xl border p-3 text-left transition-all duration-200",
              method === m.id
                ? "border-mint-500/45 bg-mint-500/[0.08]"
                : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
            )}
          >
            <m.icon className="h-4.5 w-4.5" style={{ color: m.color }} />
            <p className="mt-2 text-[13px] font-semibold text-white">{m.name}</p>
            <p className="text-[10.5px] text-slate-500">{m.speed}</p>
          </button>
        ))}
      </div>

      <Field label="Amount" hint={`Minimum $${active.min} · ${active.fee}`} error={error}>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] font-medium text-slate-400">
            $
          </span>
          <Input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(Number(e.target.value) || 0);
              setError(undefined);
            }}
            className="tnum h-13 pl-8 text-[18px] font-semibold"
          />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(q)}
              className={cn(
                "rounded-lg py-1.5 text-[12px] font-medium transition-colors",
                amount === q
                  ? "bg-white/[0.10] text-white"
                  : "bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]",
              )}
            >
              ${q.toLocaleString()}
            </button>
          ))}
        </div>
      </Field>

      {/* Method-specific fields */}
      {method === "mpesa" && (
        <div className="space-y-3">
          <Field label="M-Pesa phone number" hint="An STK push is sent to this number">
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 7XX XXX XXX"
            />
          </Field>
          <div className="rounded-xl border border-mint-500/25 bg-mint-500/[0.07] p-3.5 text-[12.5px] leading-relaxed text-slate-300">
            <p className="font-semibold text-mint-300">What happens next</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-slate-400">
              <li>A payment prompt appears on your phone.</li>
              <li>Enter your M-Pesa PIN to authorise it.</li>
              <li>Your balance updates the moment the confirmation clears.</li>
            </ol>
          </div>
        </div>
      )}

      {method === "crypto" && (
        <div className="space-y-3">
          <Field label="Network">
            <Select value={chain} onChange={(e) => setChain(e.target.value)}>
              {CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
            <p className="text-[11.5px] uppercase tracking-[0.1em] text-slate-500">
              Your deposit address
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-950/60 px-2.5 py-2 font-mono text-[12px] text-mint-300">
                {selectedChain.address}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(selectedChain.address);
                  pushToast({ tone: "info", title: "Address copied" });
                }}
                aria-label="Copy address"
                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-slate-300 transition-colors hover:bg-white/[0.08]"
              >
                <CopyIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-amber-450">
              Send only {selectedChain.label.split(" · ")[0]} on this network. Anything else
              sent to this address is unrecoverable.
            </p>
          </div>
        </div>
      )}

      {method === "card" && (
        <div className="space-y-3">
          <Field label="Card number">
            <Input
              inputMode="numeric"
              value={card.number}
              onChange={(e) =>
                setCard({ ...card, number: formatCardNumber(e.target.value) })
              }
              placeholder="4242 4242 4242 4242"
              maxLength={19}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry">
              <Input
                value={card.expiry}
                onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                placeholder="MM/YY"
                maxLength={5}
              />
            </Field>
            <Field label="CVC">
              <Input
                value={card.cvc}
                onChange={(e) =>
                  setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })
                }
                placeholder="123"
              />
            </Field>
          </div>
          <Field label="Name on card">
            <Input
              value={card.name}
              onChange={(e) => setCard({ ...card, name: e.target.value })}
              placeholder="As printed on the card"
            />
          </Field>
          <p className="flex items-center gap-2 text-[11.5px] text-slate-500">
            <Lock className="h-3.5 w-3.5 text-mint-400" />
            Secured by 256-bit TLS. Card details are tokenised and never stored on our
            servers.
          </p>
        </div>
      )}

      {method === "bank" && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-[12.5px]">
          <p className="text-[11.5px] uppercase tracking-[0.1em] text-slate-500">
            Transfer to
          </p>
          <dl className="mt-2 space-y-1.5">
            {[
              ["Beneficiary", "PrimeStone Markets Ltd"],
              ["IBAN", "GB29 PRIM 6016 1331 9268 19"],
              ["SWIFT / BIC", "PRIMGB2LXXX"],
              ["Reference", `PS-${user?.email.slice(0, 6).toUpperCase() ?? "ACCOUNT"}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-white">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2.5 text-[11.5px] text-slate-500">
            Always include the reference or the transfer cannot be matched to your account.
          </p>
        </div>
      )}

      <Button
        size="lg"
        className="w-full"
        onClick={submit}
        disabled={state !== "idle"}
      >
        {state === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
        {state === "done" && <CheckCircle2 className="h-4 w-4" />}
        {state === "idle"
          ? `Deposit ${money(amount)}`
          : state === "processing"
            ? "Processing…"
            : "Submitted"}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Withdraw                                                                   */
/* -------------------------------------------------------------------------- */

function WithdrawPanel({ balance }: { balance: number }) {
  const user = useStore((s) => s.user);
  const withdraw = useStore((s) => s.withdraw);
  const pushToast = useStore((s) => s.pushToast);
  const kycStatus = useStore((s) => s.kyc.status);

  const [method, setMethod] = useState<MethodId>("mpesa");
  const [amount, setAmount] = useState(200);
  const [destination, setDestination] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const fee = method === "crypto" ? 2.5 : method === "bank" ? 15 : 0;
  const receives = Math.max(0, amount - fee);

  const submit = () => {
    if (amount <= 0) {
      setError("Enter an amount.");
      return;
    }
    if (amount + fee > balance) {
      setError("Amount plus fee is more than your available balance.");
      return;
    }
    if (destination.trim().length < 6) {
      setError("Enter where the funds should go.");
      return;
    }

    setError(undefined);
    setBusy(true);
    window.setTimeout(() => {
      const result = withdraw({ method, amount, detail: destination.trim() });
      pushToast({
        tone: result.ok ? "success" : "error",
        title: result.ok ? "Withdrawal submitted" : "Withdrawal rejected",
        body: result.ok
          ? `${money(receives)} is on its way. Requests before 14:00 GMT settle the same working day.`
          : result.message,
      });
      if (!result.ok) setError(result.message);
      setBusy(false);
    }, 1100);
  };

  const label =
    method === "mpesa"
      ? "M-Pesa phone number"
      : method === "crypto"
        ? "Wallet address"
        : method === "card"
          ? "Card ending in"
          : "Bank account / IBAN";

  // Withdrawals are gated on identity verification.
  if (kycStatus !== "verified") {
    return <WithdrawKycGate status={kycStatus} />;
  }

  return (
    <div className="space-y-5 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DEPOSIT_METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMethod(m.id);
              setError(undefined);
            }}
            className={cn(
              "focus-ring rounded-xl border p-3 text-left transition-all duration-200",
              method === m.id
                ? "border-mint-500/45 bg-mint-500/[0.08]"
                : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
            )}
          >
            <m.icon className="h-4.5 w-4.5" style={{ color: m.color }} />
            <p className="mt-2 text-[13px] font-semibold text-white">{m.name}</p>
            <p className="text-[10.5px] text-slate-500">
              {m.id === "crypto" ? "$2.50 fee" : m.id === "bank" ? "$15.00 fee" : "Free"}
            </p>
          </button>
        ))}
      </div>

      <Field label="Amount" hint={`Available ${money(balance)}`} error={error}>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] font-medium text-slate-400">
            $
          </span>
          <Input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(Number(e.target.value) || 0);
              setError(undefined);
            }}
            className="tnum h-13 pl-8 text-[18px] font-semibold"
          />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <button
              key={f}
              onClick={() => setAmount(Math.max(0, Math.floor((balance - fee) * f * 100) / 100))}
              className="rounded-lg bg-white/[0.03] py-1.5 text-[12px] font-medium text-slate-400 transition-colors hover:bg-white/[0.07]"
            >
              {f === 1 ? "Max" : `${f * 100}%`}
            </button>
          ))}
        </div>
      </Field>

      <Field label={label}>
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder={
            method === "mpesa"
              ? "+254 7XX XXX XXX"
              : method === "crypto"
                ? "Paste your wallet address"
                : method === "card"
                  ? "•••• 4242"
                  : "GB00 BANK 0000 0000 0000 00"
          }
        />
      </Field>

      <dl className="space-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-[12.5px]">
        <div className="flex justify-between">
          <dt className="text-slate-500">Withdrawal amount</dt>
          <dd className="tnum font-medium text-white">{money(amount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Processing fee</dt>
          <dd className="tnum font-medium text-white">{fee > 0 ? `-${money(fee)}` : "Free"}</dd>
        </div>
        <div className="flex justify-between border-t border-white/[0.06] pt-1.5">
          <dt className="font-medium text-slate-300">You receive</dt>
          <dd className="tnum text-[14px] font-bold text-mint-400">{money(receives)}</dd>
        </div>
      </dl>

      <Button size="lg" variant="secondary" className="w-full" onClick={submit} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? "Submitting…" : `Withdraw ${money(amount)}`}
      </Button>

      <p className="text-center text-[11.5px] leading-relaxed text-slate-500">
        Withdrawals are reviewed before release. Requests submitted before 14:00 GMT are
        processed the same working day.
      </p>
    </div>
  );
}

/** Shown in place of the withdraw form until the account is KYC-verified. */
function WithdrawKycGate({ status }: { status: KycStatus }) {
  const pending = status === "pending";
  const rejected = status === "rejected";
  const meta = STATUS_META[status];

  return (
    <div className="p-4">
      <div
        className={cn(
          "rounded-2xl border p-6 text-center",
          pending
            ? "border-amber-450/25 bg-amber-450/[0.05]"
            : rejected
              ? "border-rose-500/25 bg-rose-500/[0.05]"
              : "border-white/[0.08] bg-white/[0.02]",
        )}
      >
        <div
          className={cn(
            "mx-auto grid h-14 w-14 place-items-center rounded-2xl",
            pending ? "bg-amber-450/12 text-amber-450" : rejected ? "bg-rose-500/12 text-rose-400" : "bg-mint-500/12 text-mint-400",
          )}
        >
          {rejected ? <ShieldAlert className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
        </div>

        <h3 className="mt-4 text-[17px] font-semibold text-white">
          {pending
            ? "Verification in progress"
            : rejected
              ? "Verification needs attention"
              : "Verify your identity to withdraw"}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-slate-400">
          {pending
            ? "Your documents are under review. Withdrawals unlock automatically once your identity is confirmed — usually within a few hours."
            : rejected
              ? "Your last submission could not be verified. Please review the notes and re-submit your documents."
              : "For your security and to meet regulatory requirements, we verify every account before the first withdrawal. It takes about two minutes."}
        </p>

        <div className="mt-3">
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>

        {!pending && (
          <Link
            href="/verify"
            className="focus-ring mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-mint-500 px-6 text-[14px] font-semibold text-ink-950 transition-colors hover:bg-mint-400"
          >
            <ShieldCheck className="h-4 w-4" />
            {rejected ? "Re-submit documents" : "Start verification"}
          </Link>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Transaction row                                                            */
/* -------------------------------------------------------------------------- */

const METHOD_ICON: Record<MethodId, typeof Smartphone> = {
  mpesa: Smartphone,
  crypto: Bitcoin,
  card: CreditCard,
  bank: Building2,
};

const STATUS_TONE = {
  completed: "mint",
  pending: "amber",
  processing: "iris",
  failed: "rose",
} as const;

function TxnRow({ txn }: { txn: Txn }) {
  const Icon = METHOD_ICON[txn.method];
  const isDeposit = txn.kind === "deposit";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
          isDeposit
            ? "border-mint-500/25 bg-mint-500/10 text-mint-400"
            : "border-white/[0.08] bg-white/[0.03] text-slate-300",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-white">
          {isDeposit ? "Deposit" : "Withdrawal"} · {txn.detail}
        </p>
        <p className="truncate text-[11px] text-slate-500">
          {dateTimeShort(txn.createdAt)} · {txn.reference}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "tnum text-[13px] font-semibold",
            isDeposit ? "text-mint-400" : "text-slate-200",
          )}
        >
          {isDeposit ? "+" : "-"}
          {money(txn.amount)}
        </p>
        <Badge tone={STATUS_TONE[txn.status]} className="mt-0.5">
          {txn.status === "processing" && <Clock className="h-2.5 w-2.5" />}
          {txn.status}
        </Badge>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}
