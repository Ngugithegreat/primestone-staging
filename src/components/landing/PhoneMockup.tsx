"use client";

import { ArrowUpRight } from "lucide-react";
import { LiveEquityStream } from "./LiveEquityStream";
import { AnimatedNumber, LiveDot } from "@/components/ui/Primitives";

/**
 * A phone showing the app's interior — a live-feeling dashboard inside a device
 * frame, so visitors see what PrimeStone looks like on a phone.
 */
export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[286px]">
      {/* glow */}
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[48px] blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(0,223,164,0.18), transparent 75%)" }}
      />
      {/* device */}
      <div className="rounded-[42px] border border-white/12 bg-ink-950 p-2.5 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.9)]">
        <div className="relative overflow-hidden rounded-[34px] border border-white/[0.06] bg-ink-900">
          {/* notch */}
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-ink-950" />

          <div className="px-4 pb-5 pt-8">
            {/* top bar */}
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-white">
                Prime<span className="text-mint-400">Stone</span>
              </span>
              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-slate-300">
                <LiveDot label="" /> Live
              </span>
            </div>

            {/* balance card */}
            <div className="mt-3 rounded-2xl border border-white/[0.08] bg-ink-880/80 p-3.5">
              <p className="text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Account value</p>
              <p className="mt-0.5 font-display text-[22px] font-bold leading-none text-white">
                $<AnimatedNumber value={12480.35} decimals={2} duration={2} />
              </p>
              <p className="mt-1 text-[10px] font-semibold text-mint-400">+14.8% · 30 days</p>
              <div className="mt-2 h-16">
                <LiveEquityStream />
              </div>
            </div>

            {/* stat row */}
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {[
                ["Copying", "4"],
                ["Open P&L", "+$312"],
                ["Win rate", "71%"],
              ].map(([l, v], i) => (
                <div key={l} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
                  <p className="text-[8.5px] text-slate-500">{l}</p>
                  <p className={`mt-0.5 text-[11px] font-semibold ${i === 1 ? "text-mint-400" : "text-white"}`}>
                    {v}
                  </p>
                </div>
              ))}
            </div>

            {/* mini copied trade */}
            <div className="mt-2.5 space-y-1.5">
              {[
                ["Kwame M.", "XAUUSD", "+$18.40", true],
                ["Elena F.", "BTCUSD", "+$41.05", true],
                ["David C.", "US100", "−$6.20", false],
              ].map(([who, sym, pnl, up]) => (
                <div
                  key={who as string}
                  className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full text-[8px] font-bold text-ink-950" style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}>
                      {(who as string).slice(0, 1)}
                    </span>
                    <div>
                      <p className="text-[10px] font-medium leading-tight text-white">{who}</p>
                      <p className="text-[8.5px] leading-tight text-slate-500">{sym}</p>
                    </div>
                  </div>
                  <span className={`text-[10.5px] font-semibold ${up ? "text-mint-400" : "text-rose-400"}`}>
                    {pnl}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-mint-500 py-2 text-[11px] font-semibold text-ink-950">
              Deposit & copy <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
