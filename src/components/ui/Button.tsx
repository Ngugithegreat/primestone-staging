"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-mint-500 text-ink-950 font-semibold shadow-[0_8px_28px_-8px_rgba(0,223,164,0.65)] hover:bg-mint-400 hover:shadow-[0_12px_36px_-8px_rgba(0,223,164,0.8)] active:scale-[0.98]",
  secondary:
    "bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.11] hover:border-white/20 active:scale-[0.98]",
  outline:
    "bg-transparent text-white border border-white/15 hover:bg-white/[0.06] hover:border-white/30 active:scale-[0.98]",
  ghost: "bg-transparent text-slate-300 hover:text-white hover:bg-white/[0.06]",
  danger:
    "bg-rose-500 text-white font-semibold shadow-[0_8px_28px_-8px_rgba(244,63,94,0.6)] hover:bg-rose-400 active:scale-[0.98]",
  success:
    "bg-mint-600 text-white font-semibold hover:bg-mint-500 active:scale-[0.98]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-13 px-7 text-[15px] rounded-xl gap-2.5",
};

const BASE =
  "inline-flex items-center justify-center whitespace-nowrap transition-all duration-200 focus-ring disabled:opacity-45 disabled:pointer-events-none select-none";

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: Common & ComponentProps<"button">) {
  return (
    <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...rest
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </Link>
  );
}
