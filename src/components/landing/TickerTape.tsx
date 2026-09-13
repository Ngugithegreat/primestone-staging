"use client";

import { INSTRUMENTS, formatPrice } from "@/lib/market";
import { useMarket } from "@/components/providers/MarketProvider";
import { cn } from "@/lib/utils";

function Row({ ariaHidden }: { ariaHidden?: boolean }) {
  const { quotes } = useMarket();

  return (
    <div
      className="flex shrink-0 items-center gap-7 px-3.5"
      aria-hidden={ariaHidden || undefined}
    >
      {INSTRUMENTS.map((inst) => {
        const q = quotes[inst.id];
        const up = (q?.changePct ?? inst.drift) >= 0;
        return (
          <div key={inst.id} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[12px] font-semibold tracking-wide text-slate-300">
              {inst.id}
            </span>
            <span className="tnum text-[12px] text-slate-400">
              {formatPrice(q?.price ?? inst.base, inst.digits)}
            </span>
            <span
              className={cn(
                "tnum text-[12px] font-medium",
                up ? "text-mint-400" : "text-rose-400",
              )}
            >
              {up ? "▲" : "▼"} {Math.abs(q?.changePct ?? inst.drift).toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TickerTape({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex overflow-hidden border-y border-white/[0.06] bg-ink-900/60 py-2 backdrop-blur-xl",
        className,
      )}
    >
      {/* Edge fades so items enter and leave instead of popping. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-ink-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-ink-950 to-transparent" />
      <div className="flex animate-marquee">
        <Row />
        <Row ariaHidden />
      </div>
    </div>
  );
}
