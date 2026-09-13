"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Shield, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Toggle } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Avatar, Badge } from "@/components/ui/Primitives";
import { money } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Trader } from "@/lib/traders";
import { cn, initialsOf } from "@/lib/utils";

const RISK_MULTIPLIERS = [0.25, 0.5, 1, 1.5, 2];

export function CopyModal({
  trader,
  open,
  onClose,
}: {
  trader: Trader | null;
  open: boolean;
  onClose: () => void;
}) {
  const balance = useStore((s) => s.balance);
  const startCopy = useStore((s) => s.startCopy);
  const pushToast = useStore((s) => s.pushToast);

  const [amount, setAmount] = useState(1000);
  const [multiplier, setMultiplier] = useState(1);
  const [useStop, setUseStop] = useState(true);
  const [stopPct, setStopPct] = useState(30);
  const [error, setError] = useState<string>();

  const projected = useMemo(() => {
    if (!trader) return { year: 0, month: 0, worst: 0, fee: 0 };
    const gross = amount * (trader.roi12m / 100) * multiplier;
    const fee = gross > 0 ? gross * (trader.fee / 100) : 0;
    return {
      year: gross - fee,
      month: (gross - fee) / 12,
      worst: -amount * (trader.maxDrawdown / 100) * multiplier,
      fee,
    };
  }, [trader, amount, multiplier]);

  if (!trader) return null;

  const tooLow = amount < trader.minInvestment;
  const tooHigh = amount > balance;

  const submit = () => {
    if (tooLow) {
      setError(`This provider requires at least ${money(trader.minInvestment)}.`);
      return;
    }
    if (tooHigh) {
      setError("That is more than your available balance.");
      return;
    }
    const result = startCopy(trader.id, amount, multiplier, useStop ? stopPct : null);
    pushToast({
      tone: result.ok ? "success" : "error",
      title: result.ok ? `Now copying ${trader.name}` : "Could not start copying",
      body: result.message,
    });
    if (result.ok) onClose();
    else setError(result.message);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`Copy ${trader.name}`}
      subtitle={trader.strategy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={tooLow || tooHigh}>
            Start copying
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Provider summary */}
        <div className="flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
          <Avatar initials={initialsOf(trader.name)} gradient={trader.gradient} size={46} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-white">{trader.name}</p>
            <p className="truncate text-[12px] text-slate-500">
              {trader.flag} {trader.handle} · {trader.markets.join(", ")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tnum text-[16px] font-bold text-mint-400">
              +{trader.roi12m.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-500">12M return</p>
          </div>
        </div>

        {/* Amount */}
        <Field
          label="Amount to allocate"
          hint={`Available ${money(balance)}`}
          error={error}
          htmlFor="copy-amount"
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-slate-400">
              $
            </span>
            <Input
              id="copy-amount"
              type="number"
              min={trader.minInvestment}
              value={amount}
              onChange={(e) => {
                setAmount(Number(e.target.value) || 0);
                setError(undefined);
              }}
              className="tnum h-12 pl-8 text-[16px] font-semibold"
            />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[250, 1000, 2500, 5000].map((v) => (
              <button
                key={v}
                onClick={() => {
                  setAmount(v);
                  setError(undefined);
                }}
                className={cn(
                  "rounded-lg py-1.5 text-[12px] font-medium transition-colors",
                  amount === v
                    ? "bg-white/[0.10] text-white"
                    : "bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]",
                )}
              >
                ${v.toLocaleString()}
              </button>
            ))}
          </div>
        </Field>

        {/* Risk multiplier */}
        <Field
          label="Risk multiplier"
          hint={`Positions sized at ${multiplier}× the provider's risk`}
        >
          <div className="grid grid-cols-5 gap-2">
            {RISK_MULTIPLIERS.map((m) => (
              <button
                key={m}
                onClick={() => setMultiplier(m)}
                className={cn(
                  "focus-ring rounded-lg border py-2 text-[12.5px] font-semibold transition-all",
                  multiplier === m
                    ? "border-mint-500/50 bg-mint-500/10 text-mint-300"
                    : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]",
                )}
              >
                {m}×
              </button>
            ))}
          </div>
          {multiplier > 1 && (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-450/25 bg-amber-450/[0.08] p-2.5 text-[12px] leading-snug text-amber-450">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Above 1× you take more risk per trade than the provider does. Their{" "}
              {trader.maxDrawdown.toFixed(1)}% worst drawdown becomes{" "}
              {(trader.maxDrawdown * multiplier).toFixed(1)}% on your allocation.
            </p>
          )}
        </Field>

        {/* Copy stop-loss */}
        <div className="space-y-2.5">
          <Toggle
            checked={useStop}
            onChange={setUseStop}
            label="Copy stop-loss"
            description="Close every copied position and cut the link if the allocation falls this far."
          />
          {useStop && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  value={stopPct}
                  onChange={(e) => setStopPct(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-rose-500"
                />
                <span className="tnum w-16 shrink-0 text-right text-[14px] font-semibold text-rose-400">
                  -{stopPct}%
                </span>
              </div>
              <p className="mt-1.5 text-[11.5px] text-slate-500">
                Unwinds at {money(amount * (1 - stopPct / 100))} of allocation value.
              </p>
            </motion.div>
          )}
        </div>

        {/* Projection */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <p className="text-[13px] font-semibold text-white">
              If the next 12 months repeat the last 12
            </p>
          </div>
          <div className="mt-3.5 grid grid-cols-3 gap-3">
            <Projection label="Net profit" value={money(projected.year)} tone="mint" />
            <Projection label="Per month" value={money(projected.month)} tone="slate" />
            <Projection label="Worst case" value={money(projected.worst)} tone="rose" />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[12px]">
            <span className="text-slate-500">
              Performance fee ({trader.fee}% of profit)
            </span>
            <span className="tnum font-medium text-slate-300">-{money(projected.fee)}</span>
          </div>
          <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-slate-500">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            An illustration, not a forecast. Past performance tells you how a strategy has
            behaved, not how it will behave. The fee is charged on profit only, against a
            high-water mark.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone="slate">Stop any time</Badge>
          <Badge tone="slate">No lock-in period</Badge>
          <Badge tone="slate">No management fee</Badge>
        </div>
      </div>
    </Modal>
  );
}

function Projection({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "mint" | "rose" | "slate";
}) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p
        className={cn(
          "tnum mt-0.5 text-[15px] font-semibold",
          tone === "mint" ? "text-mint-400" : tone === "rose" ? "text-rose-400" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}
