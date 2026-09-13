"use client";

import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  hover = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Tag
      className={cn(
        "card-sheen relative rounded-2xl border border-white/[0.07] bg-ink-880/70 backdrop-blur-xl",
        hover &&
          "transition-all duration-300 hover:border-white/[0.14] hover:bg-ink-850/80 hover:shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Badge / Pill                                                               */
/* -------------------------------------------------------------------------- */

const BADGE_TONES = {
  mint: "bg-mint-500/12 text-mint-300 border-mint-500/25",
  rose: "bg-rose-500/12 text-rose-400 border-rose-500/25",
  iris: "bg-iris-500/12 text-iris-300 border-iris-500/25",
  amber: "bg-amber-450/12 text-amber-450 border-amber-450/25",
  slate: "bg-white/[0.06] text-slate-300 border-white/10",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  children,
  tone = "slate",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide",
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function LiveDot({ label = "LIVE" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-mint-400">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-mint-400" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
      </span>
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Animated number                                                            */
/* -------------------------------------------------------------------------- */

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
  duration = 1.4,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      // easeOutExpo — fast arrival, gentle settle
      const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/** Smoothly interpolates toward a live value — used for equity/P&L readouts. */
export function SpringNumber({
  value,
  decimals = 2,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20, mass: 0.6 });
  const [text, setText] = useState(value);

  useEffect(() => motionValue.set(value), [value, motionValue]);
  useEffect(() => spring.on("change", (v) => setText(v)), [spring]);

  return (
    <span className={className}>
      {text.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sparkline                                                                  */
/* -------------------------------------------------------------------------- */

export function Sparkline({
  points,
  positive = true,
  className,
  width = 100,
  height = 32,
  fill = true,
}: {
  points: number[];
  positive?: boolean;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / span) * (height - 4) - 2;
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const color = positive ? "#00dfa4" : "#f43f5e";
  const gid = `spark-${positive ? "u" : "d"}-${points.length}-${Math.round(min)}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Progress                                                                   */
/* -------------------------------------------------------------------------- */

export function Meter({
  value,
  tone = "mint",
  className,
  height = "h-1.5",
}: {
  value: number;
  tone?: "mint" | "rose" | "iris" | "amber";
  className?: string;
  height?: string;
}) {
  const colors = {
    mint: "from-mint-500 to-mint-300",
    rose: "from-rose-500 to-rose-400",
    iris: "from-iris-500 to-iris-300",
    amber: "from-amber-450 to-orange-400",
  } as const;

  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-white/[0.07]", height, className)}>
      <motion.div
        className={cn("h-full rounded-full bg-gradient-to-r", colors[tone])}
        initial={{ width: 0 }}
        whileInView={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section scaffolding                                                        */
/* -------------------------------------------------------------------------- */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-mint-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Avatar                                                                     */
/* -------------------------------------------------------------------------- */

export function Avatar({
  initials,
  gradient,
  size = 44,
  ring = true,
  className,
}: {
  initials: string;
  gradient: [string, string];
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full font-display font-semibold text-ink-950",
        ring && "ring-2 ring-white/10",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(140deg, ${gradient[0]}, ${gradient[1]})`,
      }}
    >
      {initials}
    </div>
  );
}
