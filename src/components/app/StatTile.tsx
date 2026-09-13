"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Sparkline } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  delta,
  icon: Icon,
  accent = "#00dfa4",
  spark,
  sparkPositive = true,
  footer,
  index = 0,
}: {
  label: string;
  value: ReactNode;
  delta?: { value: string; positive: boolean };
  icon: LucideIcon;
  accent?: string;
  spark?: number[];
  sparkPositive?: boolean;
  footer?: ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="card-sheen relative overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-880/70 p-4 backdrop-blur-xl"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[46px] opacity-40"
        style={{ background: `radial-gradient(closest-side, ${accent}, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-slate-500">
            {label}
          </p>
          <p className="tnum mt-1.5 truncate font-display text-[24px] font-bold leading-none text-white">
            {value}
          </p>
        </div>
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border"
          style={{
            background: `linear-gradient(140deg, ${accent}20, transparent)`,
            borderColor: `${accent}35`,
          }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </span>
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {delta && (
            <span
              className={cn(
                "tnum text-[12.5px] font-semibold",
                delta.positive ? "text-mint-400" : "text-rose-400",
              )}
            >
              {delta.value}
            </span>
          )}
          {footer && <p className="mt-0.5 text-[11.5px] text-slate-500">{footer}</p>}
        </div>
        {spark && spark.length > 1 && (
          <div className="w-[76px] shrink-0">
            <Sparkline points={spark} positive={sparkPositive} height={26} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
