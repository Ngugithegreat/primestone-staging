"use client";

import { motion } from "framer-motion";
import { Info, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Primitives";
import { SegmentedControl } from "@/components/ui/Field";
import { money } from "@/lib/format";
import {
  formatPrice,
  getInstrument,
  marginOf,
  pipSize,
  round,
  type Side,
} from "@/lib/market";
import { getAccountType } from "@/lib/accounts";
import { openPnl, usedMargin, useStore } from "@/lib/store";
import { useMarket } from "@/components/providers/MarketProvider";
import { cn } from "@/lib/utils";

type OrderKind = "market" | "limit";

const LOT_PRESETS = [0.01, 0.1, 0.5, 1];

export function OrderTicket({
  symbol,
  bid,
  ask,
}: {
  symbol: string;
  bid: number;
  ask: number;
}) {
  const { prices } = useMarket();
  const user = useStore((s) => s.user);
  const balance = useStore((s) => s.balance);
  const positions = useStore((s) => s.positions);
  const open = useStore((s) => s.openPosition);
  const pushToast = useStore((s) => s.pushToast);

  const inst = getInstrument(symbol);
  const acct = getAccountType(user?.accountType);
  const leverage = user?.leverage ?? 500;

  const [side, setSide] = useState<Side>("buy");
  const [kind, setKind] = useState<OrderKind>("market");
  const [lots, setLots] = useState(0.1);
  const [limitPrice, setLimitPrice] = useState(ask);
  const [useSl, setUseSl] = useState(false);
  const [useTp, setUseTp] = useState(false);
  const [slPips, setSlPips] = useState(200);
  const [tpPips, setTpPips] = useState(400);

  // Keep the limit price glued to the market until the user edits it.
  const [limitTouched, setLimitTouched] = useState(false);
  useEffect(() => {
    if (!limitTouched) setLimitPrice(side === "buy" ? ask : bid);
  }, [ask, bid, side, limitTouched]);
  useEffect(() => {
    setLimitTouched(false);
  }, [symbol]);

  const entry = kind === "market" ? (side === "buy" ? ask : bid) : limitPrice;
  const pip = pipSize(inst);

  const sl = useSl
    ? round(side === "buy" ? entry - slPips * pip : entry + slPips * pip, inst.digits)
    : null;
  const tp = useTp
    ? round(side === "buy" ? entry + tpPips * pip : entry - tpPips * pip, inst.digits)
    : null;

  const notional = entry * lots * inst.contractSize;
  const margin = marginOf(entry, lots, inst, leverage);
  const commission = lots * acct.commissionPerLot;
  const pipValue = pip * lots * inst.contractSize;
  const riskAmount = useSl ? slPips * pipValue : null;
  const rewardAmount = useTp ? tpPips * pipValue : null;

  const floating = useMemo(() => openPnl(positions, prices), [positions, prices]);
  const used = useMemo(
    () => usedMargin(positions, prices, leverage),
    [positions, prices, leverage],
  );
  const freeMargin = balance + floating - used;
  const insufficient = margin > freeMargin;

  const submit = () => {
    const result = open({
      symbol,
      side,
      lots,
      price: round(entry, inst.digits),
      sl,
      tp,
    });
    pushToast({
      tone: result.ok ? "success" : "error",
      title: result.ok ? "Order filled" : "Order rejected",
      body: result.message,
    });
  };

  const adjust = (delta: number) => setLots((l) => round(Math.max(0.01, l + delta), 2));

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] p-3">
        {/* Buy / Sell */}
        <div className="grid grid-cols-2 gap-2">
          {(["sell", "buy"] as const).map((s) => {
            const active = side === s;
            const isBuy = s === "buy";
            return (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={cn(
                  "focus-ring relative overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                  active
                    ? isBuy
                      ? "border-mint-500/50 bg-mint-500/[0.12]"
                      : "border-rose-500/50 bg-rose-500/[0.12]"
                    : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "block text-[10.5px] font-bold uppercase tracking-[0.1em]",
                    active ? (isBuy ? "text-mint-400" : "text-rose-400") : "text-slate-500",
                  )}
                >
                  {isBuy ? "Buy · Ask" : "Sell · Bid"}
                </span>
                <span
                  className={cn(
                    "tnum mt-0.5 block text-[16px] font-semibold",
                    active ? "text-white" : "text-slate-400",
                  )}
                >
                  {formatPrice(isBuy ? ask : bid, inst.digits)}
                </span>
              </button>
            );
          })}
        </div>

        <SegmentedControl
          className="mt-3 w-full"
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: "market", label: "Market" },
            { value: "limit", label: "Limit" },
          ]}
        />
      </div>

      <div className="space-y-4 p-3">
        {kind === "limit" && (
          <div>
            <label className="text-[12px] font-medium text-slate-400">Limit price</label>
            <input
              type="number"
              step={10 ** -inst.digits}
              value={limitPrice}
              onChange={(e) => {
                setLimitTouched(true);
                setLimitPrice(Number(e.target.value));
              }}
              className="tnum mt-1.5 h-10 w-full rounded-lg border border-white/[0.08] bg-ink-900/70 px-3 text-[14px] text-white outline-none transition-colors focus:border-mint-500/50"
            />
          </div>
        )}

        {/* Volume */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-slate-400">Volume (lots)</label>
            <span className="tnum text-[11px] text-slate-500">
              {(lots * inst.contractSize).toLocaleString()} units
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              onClick={() => adjust(-0.01)}
              aria-label="Decrease volume"
              className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.08]"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={lots}
              onChange={(e) => setLots(Math.max(0.01, Number(e.target.value) || 0.01))}
              className="tnum h-10 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-ink-900/70 px-3 text-center text-[15px] font-semibold text-white outline-none transition-colors focus:border-mint-500/50"
            />
            <button
              onClick={() => adjust(0.01)}
              aria-label="Increase volume"
              className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.08]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {LOT_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setLots(p)}
                className={cn(
                  "rounded-md py-1.5 text-[11.5px] font-medium transition-colors",
                  lots === p
                    ? "bg-white/[0.10] text-white"
                    : "bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Risk levels */}
        <div className="space-y-2">
          <RiskRow
            label="Stop loss"
            enabled={useSl}
            onToggle={setUseSl}
            pips={slPips}
            onPips={setSlPips}
            price={sl}
            digits={inst.digits}
            amount={riskAmount}
            tone="rose"
          />
          <RiskRow
            label="Take profit"
            enabled={useTp}
            onToggle={setUseTp}
            pips={tpPips}
            onPips={setTpPips}
            price={tp}
            digits={inst.digits}
            amount={rewardAmount}
            tone="mint"
          />
        </div>

        {/* Summary */}
        <dl className="space-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[12px]">
          <SummaryRow label="Notional" value={money(notional)} />
          <SummaryRow
            label="Required margin"
            value={money(margin)}
            tone={insufficient ? "text-rose-400" : undefined}
          />
          <SummaryRow label="Free margin" value={money(freeMargin)} />
          {commission > 0 && <SummaryRow label="Commission" value={money(commission)} />}
          <SummaryRow label="Pip value" value={money(pipValue)} />
          {riskAmount != null && rewardAmount != null && (
            <SummaryRow
              label="Risk / reward"
              value={`1 : ${(rewardAmount / riskAmount).toFixed(2)}`}
              tone="text-mint-400"
            />
          )}
        </dl>

        {insufficient && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 p-2.5 text-[12px] leading-snug text-rose-300"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This order needs {money(margin)} of margin but only {money(freeMargin)} is free.
            Reduce the volume or deposit more.
          </motion.p>
        )}

        <button
          onClick={submit}
          disabled={insufficient}
          className={cn(
            "focus-ring h-12 w-full rounded-xl text-[15px] font-bold transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45",
            side === "buy"
              ? "bg-mint-500 text-ink-950 shadow-[0_8px_28px_-10px_rgba(0,223,164,0.7)] hover:bg-mint-400"
              : "bg-rose-500 text-white shadow-[0_8px_28px_-10px_rgba(244,63,94,0.7)] hover:bg-rose-400",
          )}
        >
          {side === "buy" ? "Buy" : "Sell"} {lots} {symbol}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          Market execution · orders filled at the next available price
        </p>
      </div>
    </Card>
  );
}

function RiskRow({
  label,
  enabled,
  onToggle,
  pips,
  onPips,
  price,
  digits,
  amount,
  tone,
}: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  pips: number;
  onPips: (v: number) => void;
  price: number | null;
  digits: number;
  amount: number | null;
  tone: "rose" | "mint";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 transition-colors",
        enabled
          ? tone === "rose"
            ? "border-rose-500/25 bg-rose-500/[0.06]"
            : "border-mint-500/25 bg-mint-500/[0.06]"
          : "border-white/[0.07] bg-white/[0.02]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => onToggle(!enabled)}
          className="focus-ring flex items-center gap-2 text-[12.5px] font-medium text-slate-300"
        >
          <span
            className={cn(
              "grid h-4 w-4 place-items-center rounded border transition-colors",
              enabled
                ? tone === "rose"
                  ? "border-rose-500 bg-rose-500"
                  : "border-mint-500 bg-mint-500"
                : "border-white/20",
            )}
          >
            {enabled && (
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-ink-950">
                <path
                  d="M1.5 5.2 4 7.5 8.5 2.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          {label}
        </button>

        {enabled && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              value={pips}
              onChange={(e) => onPips(Math.max(1, Number(e.target.value) || 1))}
              className="tnum h-7 w-16 rounded-md border border-white/[0.08] bg-ink-900/70 px-2 text-right text-[12px] text-white outline-none focus:border-white/25"
            />
            <span className="text-[11px] text-slate-500">pips</span>
          </div>
        )}
      </div>

      {enabled && price != null && (
        <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11.5px]">
          <span className="tnum text-slate-400">@ {price.toFixed(digits)}</span>
          {amount != null && (
            <span
              className={cn(
                "tnum font-semibold",
                tone === "rose" ? "text-rose-400" : "text-mint-400",
              )}
            >
              {tone === "rose" ? "-" : "+"}
              {money(amount)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn("tnum font-medium", tone ?? "text-slate-200")}>{value}</dd>
    </div>
  );
}
