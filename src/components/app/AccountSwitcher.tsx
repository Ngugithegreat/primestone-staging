"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, FlaskConical, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { useRealAccount } from "@/lib/useRealAccount";
import { usd } from "@/lib/accountClient";
import { cn } from "@/lib/utils";

/**
 * Real ⇄ Demo account switcher (top bar). Switching flips `sessionMode`, which
 * drives the dashboard, wallet, metrics and copy engine — so the whole app moves
 * between the funded ledger account and the virtual practice account, with a
 * clear tag so real and demo money are never confused.
 */
export function AccountSwitcher() {
  const sessionMode = useStore((s) => s.sessionMode);
  const setSessionMode = useStore((s) => s.setSessionMode);
  const demoBalance = useStore((s) => s.balance);
  const real = useRealAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const isDemo = sessionMode === "demo";
  const demoFmt = `$${demoBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const choose = (mode: "real" | "demo") => {
    setSessionMode(mode);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "focus-ring flex items-center gap-2 rounded-xl border py-1.5 pl-2.5 pr-2 transition-colors",
          isDemo
            ? "border-amber-450/30 bg-amber-450/[0.08] hover:bg-amber-450/[0.12]"
            : "border-mint-500/30 bg-mint-500/[0.08] hover:bg-mint-500/[0.12]",
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isDemo ? "bg-amber-450" : "bg-mint-500")} />
        <span className="flex flex-col items-start leading-tight">
          <span
            className={cn(
              "text-[10.5px] font-semibold uppercase tracking-wide",
              isDemo ? "text-amber-300" : "text-mint-300",
            )}
          >
            {isDemo ? "Demo" : "Real"}
          </span>
          <span className="tnum text-[12px] font-medium text-white">
            {isDemo ? demoFmt : usd(real.totalMinor)}
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-white/[0.09] bg-ink-850/97 p-1.5 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
        >
          <p className="px-2.5 py-1.5 text-[10.5px] uppercase tracking-[0.12em] text-slate-500">
            Switch account
          </p>
          <AccountRow
            active={!isDemo}
            onClick={() => choose("real")}
            icon={Wallet}
            tone="mint"
            title="Real account"
            subtitle="Your funded balance"
            value={usd(real.totalMinor)}
          />
          <AccountRow
            active={isDemo}
            onClick={() => choose("demo")}
            icon={FlaskConical}
            tone="amber"
            title="Demo account"
            subtitle="Virtual practice funds"
            value={demoFmt}
          />
        </div>
      )}
    </div>
  );
}

function AccountRow({
  active,
  onClick,
  icon: Icon,
  tone,
  title,
  subtitle,
  value,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  tone: "mint" | "amber";
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors",
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03]",
          tone === "mint" ? "text-mint-400" : "text-amber-450",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-white">{title}</span>
        <span className="block text-[11px] text-slate-500">{subtitle}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="tnum text-[12.5px] font-semibold text-white">{value}</span>
        {active && <Check className="h-3.5 w-3.5 text-mint-400" />}
      </span>
    </button>
  );
}
