"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useMarket } from "@/components/providers/MarketProvider";
import { Avatar } from "@/components/ui/Primitives";
import { dateTimeShort, num, signed } from "@/lib/format";
import { formatPrice, getInstrument, pnlOf } from "@/lib/market";
import { useStore, type ClosedPosition, type Position } from "@/lib/store";
import { getTrader } from "@/lib/traders";
import { cn, initialsOf } from "@/lib/utils";

function SideTag({ side }: { side: "buy" | "sell" }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
        side === "buy" ? "bg-mint-500/15 text-mint-400" : "bg-rose-500/15 text-rose-400",
      )}
    >
      {side.toUpperCase()}
    </span>
  );
}

function SourceTag({ traderId }: { traderId: string | null }) {
  if (!traderId) {
    return <span className="text-[11.5px] text-slate-500">Manual</span>;
  }
  const trader = getTrader(traderId);
  if (!trader) return <span className="text-[11.5px] text-slate-500">Copy</span>;

  return (
    <span className="flex items-center gap-1.5">
      <Avatar
        initials={initialsOf(trader.name)}
        gradient={trader.gradient}
        size={18}
        ring={false}
      />
      <span className="truncate text-[11.5px] text-slate-400">
        {trader.name.split(" ")[0]}
      </span>
    </span>
  );
}

const TH =
  "px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-slate-500";
const TD = "px-3 py-3 text-[12.5px]";

/* -------------------------------------------------------------------------- */
/*  Open positions                                                            */
/* -------------------------------------------------------------------------- */

export function OpenPositionsTable({ compact = false }: { compact?: boolean }) {
  const { prices } = useMarket();
  const positions = useStore((s) => s.positions);
  const closePosition = useStore((s) => s.closePosition);
  const pushToast = useStore((s) => s.pushToast);

  if (positions.length === 0) {
    return (
      <Empty
        title="No open positions"
        body="Place an order from the trading desk, or allocate to a strategy provider and their signals will show up here."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-left">
            <th className={TH}>Symbol</th>
            <th className={TH}>Side</th>
            <th className={TH}>Volume</th>
            <th className={TH}>Entry</th>
            <th className={TH}>Current</th>
            {!compact && <th className={TH}>S/L</th>}
            {!compact && <th className={TH}>T/P</th>}
            <th className={TH}>Source</th>
            <th className={cn(TH, "text-right")}>P&amp;L</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {positions.map((p) => {
              const inst = getInstrument(p.symbol);
              const current = prices[p.symbol] ?? p.entry;
              const pnl = pnlOf(p.side, p.entry, current, p.lots, inst);
              const up = pnl >= 0;

              return (
                <motion.tr
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.24 }}
                  className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]"
                >
                  <td className={cn(TD, "font-semibold text-white")}>{p.symbol}</td>
                  <td className={TD}>
                    <SideTag side={p.side} />
                  </td>
                  <td className={cn(TD, "tnum text-slate-300")}>{num(p.lots, 2)}</td>
                  <td className={cn(TD, "tnum text-slate-300")}>
                    {formatPrice(p.entry, inst.digits)}
                  </td>
                  <td className={cn(TD, "tnum text-slate-200")}>
                    {formatPrice(current, inst.digits)}
                  </td>
                  {!compact && (
                    <td className={cn(TD, "tnum text-slate-500")}>
                      {p.sl ? formatPrice(p.sl, inst.digits) : "—"}
                    </td>
                  )}
                  {!compact && (
                    <td className={cn(TD, "tnum text-slate-500")}>
                      {p.tp ? formatPrice(p.tp, inst.digits) : "—"}
                    </td>
                  )}
                  <td className={TD}>
                    <SourceTag traderId={p.copiedFrom} />
                  </td>
                  <td
                    className={cn(
                      TD,
                      "tnum text-right font-semibold",
                      up ? "text-mint-400" : "text-rose-400",
                    )}
                  >
                    {signed(pnl)}
                  </td>
                  <td className={cn(TD, "text-right")}>
                    <button
                      onClick={() => {
                        closePosition(p.id, current);
                        pushToast({
                          tone: up ? "success" : "info",
                          title: "Position closed",
                          body: `${p.symbol} ${p.side.toUpperCase()} ${p.lots} · ${signed(pnl)}`,
                        });
                      }}
                      aria-label={`Close ${p.symbol} position`}
                      className="focus-ring grid h-7 w-7 place-items-center rounded-md border border-white/[0.08] text-slate-500 opacity-60 transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  History                                                                   */
/* -------------------------------------------------------------------------- */

const REASON_LABEL: Record<ClosedPosition["closeReason"], string> = {
  manual: "Manual",
  sl: "Stop-loss",
  tp: "Take-profit",
  "copy-stopped": "Copy stopped",
};

export function HistoryTable({ rows }: { rows: ClosedPosition[] }) {
  if (rows.length === 0) {
    return (
      <Empty
        title="No closed trades yet"
        body="Once a position is closed it lands here with its full result."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-left">
            <th className={TH}>Closed</th>
            <th className={TH}>Symbol</th>
            <th className={TH}>Side</th>
            <th className={TH}>Volume</th>
            <th className={TH}>Entry</th>
            <th className={TH}>Exit</th>
            <th className={TH}>Source</th>
            <th className={TH}>Reason</th>
            <th className={cn(TH, "text-right")}>P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const inst = getInstrument(h.symbol);
            const up = h.pnl >= 0;
            return (
              <tr
                key={h.id}
                className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]"
              >
                <td className={cn(TD, "whitespace-nowrap text-slate-400")}>
                  {dateTimeShort(h.closedAt)}
                </td>
                <td className={cn(TD, "font-semibold text-white")}>{h.symbol}</td>
                <td className={TD}>
                  <SideTag side={h.side} />
                </td>
                <td className={cn(TD, "tnum text-slate-300")}>{num(h.lots, 2)}</td>
                <td className={cn(TD, "tnum text-slate-400")}>
                  {formatPrice(h.entry, inst.digits)}
                </td>
                <td className={cn(TD, "tnum text-slate-400")}>
                  {formatPrice(h.exit, inst.digits)}
                </td>
                <td className={TD}>
                  <SourceTag traderId={h.copiedFrom} />
                </td>
                <td className={cn(TD, "text-[11.5px] text-slate-500")}>
                  {REASON_LABEL[h.closeReason]}
                </td>
                <td
                  className={cn(
                    TD,
                    "tnum text-right font-semibold",
                    up ? "text-mint-400" : "text-rose-400",
                  )}
                >
                  {signed(h.pnl)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <span className="h-2 w-2 rounded-full bg-slate-600" />
      </div>
      <p className="mt-4 text-[14px] font-medium text-slate-300">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}
