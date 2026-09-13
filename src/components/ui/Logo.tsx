import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden="true">
      <defs>
        <linearGradient id="ps-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e3c583" />
          <stop offset="55%" stopColor="#cfa653" />
          <stop offset="100%" stopColor="#279d6c" />
        </linearGradient>
      </defs>
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="11"
        fill="url(#ps-mark)"
        opacity="0.14"
      />
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="11"
        fill="none"
        stroke="url(#ps-mark)"
        strokeWidth="1.4"
        opacity="0.5"
      />
      {/* Two candles and the signal line that mirrors between them. */}
      <path
        d="M10 27.5 L15.5 19 L21 22.5 L30 11"
        fill="none"
        stroke="url(#ps-mark)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="11" r="3" fill="#e3c583" />
      <circle cx="30" cy="11" r="3" fill="none" stroke="#e3c583" strokeWidth="1" opacity="0.4">
        <animate attributeName="r" values="3;7;3" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  compact = false,
}: {
  className?: string;
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      <LogoMark className="transition-transform duration-300 group-hover:scale-105" />
      {!compact && (
        <span className="font-display text-[19px] font-semibold tracking-tight text-white">
          Meri<span className="text-mint-400">dian</span>
        </span>
      )}
    </Link>
  );
}
