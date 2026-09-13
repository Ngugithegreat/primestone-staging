"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-xl border border-white/10 bg-ink-900/70 px-3.5 text-[14px] text-white placeholder:text-slate-500 transition-all duration-200 outline-none focus:border-mint-500/60 focus:bg-ink-900 focus:shadow-[0_0_0_3px_rgba(0,223,164,0.12)] disabled:opacity-50";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-center justify-between text-[13px] font-medium text-slate-300"
        >
          <span>{label}</span>
          {hint && <span className="text-[12px] font-normal text-slate-500">{hint}</span>}
        </label>
      )}
      {children}
      {error && <p className="text-[12px] text-rose-400">{error}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-11", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(CONTROL, "h-11 appearance-none pr-9 [&>option]:bg-ink-800", className)}
        {...rest}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-3.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      >
        <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-24 py-2.5", className)} {...rest} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring flex w-full items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-white">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-400">
            {description}
          </span>
        )}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
          checked ? "bg-mint-500" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-white/[0.07] bg-ink-900/60 p-1",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "focus-ring flex-1 rounded-lg font-medium transition-all duration-200",
            size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]",
            value === o.value
              ? "bg-white/[0.10] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
