"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A continuously streaming candlestick chart. New candles form and scroll in
 * from the right forever, driven by a mean-reverting random walk. The group is
 * scrolled imperatively via requestAnimationFrame for smoothness; the candles
 * themselves are React elements re-rendered only when a new candle is committed
 * (~once per STEP), and the transform resets on that commit so the scroll is
 * seamless.
 *
 * SSR/first paint renders a deterministic seed so hydration matches; motion
 * begins on mount and is skipped entirely under prefers-reduced-motion.
 */

const W = 520;
const H = 200;
const SLOT = 20;
const COUNT = Math.floor(W / SLOT); // fully-visible candles
const STEP_MS = 950;

type Candle = { id: number; open: number; close: number };

const yOf = (v: number) => 186 - v * 1.35;

// Deterministic seed series (no Math.random on the server).
function seedCandles(): Candle[] {
  const out: Candle[] = [];
  let prev = 60;
  for (let i = 0; i <= COUNT; i++) {
    const close = 60 + Math.sin(i * 0.5) * 14 + i * 0.6;
    out.push({ id: i, open: prev, close });
    prev = close;
  }
  return out;
}

export function LiveCandles() {
  const [candles, setCandles] = useState<Candle[]>(seedCandles);
  const groupRef = useRef<SVGGElement>(null);
  const nextId = useRef(COUNT + 1);
  const velocity = useRef(0.4);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const commit = () => {
      setCandles((prev) => {
        const open = prev[prev.length - 1]!.close;
        velocity.current += (Math.random() - 0.5) * 6;
        velocity.current += (66 - open) * 0.02; // mean-revert toward the middle
        velocity.current = Math.max(-9, Math.min(9, velocity.current));
        let close = open + velocity.current;
        if (close > 116 || close < 22) {
          velocity.current *= -0.5;
          close = Math.max(22, Math.min(116, close));
        }
        const next = prev.slice(1);
        next.push({ id: nextId.current++, open, close });
        return next;
      });
    };

    const frame = (now: number) => {
      // Clamp dt so returning to a backgrounded tab (where rAF was paused)
      // resumes smoothly instead of committing a burst of candles at once.
      const dt = Math.min(now - last, 100);
      last = now;
      acc += dt;
      const p = Math.min(1, acc / STEP_MS);
      groupRef.current?.setAttribute("transform", `translate(${(-SLOT * p).toFixed(2)},0)`);
      if (acc >= STEP_MS) {
        acc -= STEP_MS;
        commit();
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const lastClose = candles[candles.length - 1]!.close;
  const prevClose = candles[candles.length - 2]?.close ?? lastClose;
  const rising = lastClose >= prevClose;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id="live-candles-clip">
          <rect x="0" y="0" width={W} height={H} />
        </clipPath>
      </defs>

      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="0" x2={W} y1={i * 50 + 12} y2={i * 50 + 12} stroke="rgba(255,255,255,0.045)" />
      ))}

      <g clipPath="url(#live-candles-clip)">
        <g ref={groupRef}>
          {candles.map((c, i) => {
            const up = c.close >= c.open;
            const top = yOf(Math.max(c.open, c.close));
            const bottom = yOf(Math.min(c.open, c.close));
            const wick = 5 + (c.id % 4) * 3;
            const cx = i * SLOT + 11;
            const color = up ? "#00dfa4" : "#f43f5e";
            return (
              <g key={c.id}>
                <line x1={cx} x2={cx} y1={top - wick} y2={bottom + wick} stroke={color} strokeWidth="1.2" opacity="0.75" />
                <rect
                  x={cx - 5}
                  y={top}
                  width="10"
                  height={Math.max(3, bottom - top)}
                  rx="1.5"
                  fill={color}
                  opacity="0.92"
                />
              </g>
            );
          })}
        </g>
      </g>

      {/* Live price line + tag at the latest close. */}
      <line
        x1="0"
        x2={W}
        y1={yOf(lastClose)}
        y2={yOf(lastClose)}
        stroke={rising ? "rgba(0,223,164,0.45)" : "rgba(244,63,94,0.45)"}
        strokeDasharray="3 4"
        strokeWidth="1"
      />
    </svg>
  );
}
