"use client";

import { useEffect, useRef } from "react";

/**
 * A live equity line that never stops moving. The line scrolls continuously
 * to the left as fresh points stream in from a gentle upward random walk, with
 * a pulsing marker riding the leading edge — genuine, ongoing motion rather
 * than a one-shot draw. All animation is driven imperatively through refs
 * (requestAnimationFrame updates a transform + rebuilds the path on each new
 * point), so React re-renders don't fire every frame.
 *
 * The first paint matches the server (a static seed path) to avoid a hydration
 * mismatch; the stream takes over on mount.
 */

const N = 56; // visible points
const STEP_MS = 130; // time between new points
const W = 460;
const H = 150;
const PAD = 12;
const DX = W / N;

// Deterministic seed so SSR and the first client paint are identical.
const SEED = Array.from({ length: N + 2 }, (_, i) => {
  const t = i / (N + 1);
  return 42 + t * 26 + Math.sin(t * 7) * 6;
});

const yOf = (v: number) => H - PAD - (Math.max(0, Math.min(100, v)) / 100) * (H - PAD * 2);

/** Catmull-Rom → cubic Bézier for a smooth (non-polygonal) line. */
function smoothPath(vals: number[]): string {
  const pts = vals.map((v, i) => [i * DX, yOf(v)] as const);
  if (pts.length === 0) return "";
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function LiveEquityStream() {
  const groupRef = useRef<SVGGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    // Respect users who prefer reduced motion — leave the seed frame static.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const vals = [...SEED];
    let velocity = 0.35;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const redraw = () => {
      const line = smoothPath(vals);
      lineRef.current?.setAttribute("d", line);
      areaRef.current?.setAttribute("d", `${line} L${(vals.length - 1) * DX},${H} L0,${H} Z`);
      // Leading marker sits on the last always-visible point.
      const lead = vals[N]!;
      const y = yOf(lead);
      dotRef.current?.setAttribute("cy", y.toFixed(1));
      glowRef.current?.setAttribute("cy", y.toFixed(1));
    };

    const step = () => {
      // Mean-reverting random walk with a soft bullish drift; stays in [8, 96].
      const center = 52;
      velocity += (Math.random() - 0.5) * 1.4;
      velocity += (center - vals[vals.length - 1]!) * 0.012; // pull to center
      velocity += 0.06; // gentle upward bias
      velocity = Math.max(-3.2, Math.min(3.2, velocity));
      let nextVal = vals[vals.length - 1]! + velocity;
      if (nextVal > 96 || nextVal < 8) {
        velocity *= -0.6;
        nextVal = Math.max(8, Math.min(96, nextVal));
      }
      vals.push(nextVal);
      vals.shift();
      redraw();
    };

    const frame = (now: number) => {
      // Clamp dt so returning to a backgrounded tab (rAF was paused) resumes
      // smoothly instead of jumping forward by the whole hidden interval.
      const dt = Math.min(now - last, 100);
      last = now;
      acc += dt;
      const p = Math.min(1, acc / STEP_MS);
      // Scroll the whole plot left by one slot over each STEP_MS window.
      groupRef.current?.setAttribute("transform", `translate(${(-DX * p).toFixed(2)},0)`);
      if (acc >= STEP_MS) {
        acc -= STEP_MS;
        step();
      }
      raf = requestAnimationFrame(frame);
    };

    redraw();
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seedLine = smoothPath(SEED.slice(0, N + 1));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
      <defs>
        <linearGradient id="live-eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00dfa4" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#00dfa4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="live-eq-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#00dfa4" />
          <stop offset="100%" stopColor="#2ff0bd" />
        </linearGradient>
        {/* Clip so the incoming point scrolls in instead of overflowing. */}
        <clipPath id="live-eq-clip">
          <rect x="0" y="0" width={W} height={H} />
        </clipPath>
      </defs>

      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1="0"
          x2={W}
          y1={H * f}
          y2={H * f}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
      ))}

      <g clipPath="url(#live-eq-clip)">
        <g ref={groupRef}>
          <path
            ref={areaRef}
            d={`${seedLine} L${(N) * DX},${H} L0,${H} Z`}
            fill="url(#live-eq-fill)"
          />
          <path
            ref={lineRef}
            d={seedLine}
            fill="none"
            stroke="url(#live-eq-line)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>

      {/* Leading marker — pinned near the right edge, pulsing. */}
      <circle ref={glowRef} cx={N * DX} cy={yOf(SEED[N]!)} r="9" fill="#2ff0bd" opacity="0.18">
        <animate attributeName="r" values="6;12;6" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.28;0.05;0.28" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle ref={dotRef} cx={N * DX} cy={yOf(SEED[N]!)} r="4" fill="#2ff0bd" />
    </svg>
  );
}
