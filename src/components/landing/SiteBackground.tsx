"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Site-wide ambient background.
 *
 * Four stacked layers, all fixed to the viewport and non-interactive:
 *   1. drifting colour orbs that parallax against the scroll
 *   2. a grid, masked so it fades out toward the edges
 *   3. a canvas particle field
 *   4. a slow diagonal light sweep
 *
 * Everything animates transform and opacity only, so it stays on the compositor
 * and never triggers layout. The whole thing collapses to a static gradient
 * when the visitor prefers reduced motion.
 */
export function SiteBackground({
  variant = "full",
}: {
  /** "subtle" drops the particles and sweep — used behind data-dense app screens. */
  variant?: "full" | "subtle";
}) {
  const reduced = useReducedMotion();
  const subtle = variant === "subtle";
  const { scrollYProgress } = useScroll();

  // Opposing drifts give the field a sense of depth as the page moves.
  const driftUp = useTransform(scrollYProgress, [0, 1], ["0%", "-22%"]);
  const driftDown = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const driftSlow = useTransform(scrollYProgress, [0, 1], ["0%", "-9%"]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${
        subtle ? "opacity-60" : ""
      }`}
      aria-hidden="true"
    >
      {/* Base wash */}
      <div className="absolute inset-0 bg-ink-950" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(0,223,164,0.16), transparent 62%)",
        }}
      />

      {/* 1 — Orbs */}
      <motion.div
        style={reduced ? undefined : { y: driftUp }}
        className="absolute -left-[16%] -top-[14%] h-[58vw] w-[58vw] animate-aurora rounded-full blur-[120px]"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(0,223,164,0.46), rgba(0,223,164,0) 72%)",
          }}
        />
      </motion.div>

      <motion.div
        style={reduced ? undefined : { y: driftDown }}
        className="absolute -right-[18%] top-[8%] h-[52vw] w-[52vw] animate-aurora rounded-full blur-[130px]"
        transition={{ delay: 3 }}
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            animationDelay: "-7s",
            background:
              "radial-gradient(closest-side, rgba(99,102,241,0.38), rgba(99,102,241,0) 72%)",
          }}
        />
      </motion.div>

      <motion.div
        style={reduced ? undefined : { y: driftSlow }}
        className="absolute bottom-[-14%] left-[22%] h-[46vw] w-[46vw] animate-aurora rounded-full blur-[140px]"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            animationDelay: "-13s",
            background:
              "radial-gradient(closest-side, rgba(34,211,238,0.28), rgba(34,211,238,0) 72%)",
          }}
        />
      </motion.div>

      <motion.div
        style={reduced ? undefined : { y: driftDown }}
        className="absolute right-[12%] bottom-[6%] h-[36vw] w-[36vw] animate-aurora rounded-full blur-[120px]"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            animationDelay: "-19s",
            background:
              "radial-gradient(closest-side, rgba(0,223,164,0.26), rgba(0,223,164,0) 72%)",
          }}
        />
      </motion.div>

      {/* 2 — Grid, faded at the edges so it never reads as a hard texture */}
      <div
        className="grid-lines absolute inset-0 opacity-70"
        style={{
          maskImage:
            "radial-gradient(ellipse 80% 65% at 50% 40%, #000 30%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 65% at 50% 40%, #000 30%, transparent 78%)",
        }}
      />

      {/* 3 — Particles */}
      {!reduced && !subtle && <ParticleField />}

      {/* 4 — Light sweep */}
      {!reduced && !subtle && (
        <motion.div
          className="absolute inset-y-0 -left-1/3 w-1/3 opacity-[0.55]"
          style={{
            background:
              "linear-gradient(100deg, transparent, rgba(0,223,164,0.055) 45%, rgba(129,140,248,0.045) 60%, transparent)",
          }}
          animate={{ x: ["0%", "420%"] }}
          transition={{ duration: 26, repeat: Infinity, ease: "linear", repeatDelay: 6 }}
        />
      )}

      {/* Vignette so foreground type always wins */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,transparent_28%,rgba(4,6,10,0.55)_88%)]" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Particles                                                                  */
/* -------------------------------------------------------------------------- */

type Dot = {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  alpha: number;
  hue: "mint" | "iris" | "white";
  phase: number;
};

const COLORS: Record<Dot["hue"], string> = {
  mint: "0,223,164",
  iris: "129,140,248",
  white: "226,236,247",
};

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dots: Dot[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const build = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Scale the count to the viewport so a phone isn't doing desktop work.
      const count = Math.round(Math.min(70, Math.max(24, (w * h) / 26_000)));
      dots = Array.from({ length: count }, () => spawn(w, h, true));
    };

    const spawn = (vw: number, vh: number, anywhere: boolean): Dot => {
      const roll = Math.random();
      return {
        x: Math.random() * vw,
        y: anywhere ? Math.random() * vh : vh + 12,
        r: 0.7 + Math.random() * 1.7,
        speed: 0.08 + Math.random() * 0.28,
        drift: (Math.random() - 0.5) * 0.16,
        alpha: 0.16 + Math.random() * 0.42,
        hue: roll < 0.6 ? "mint" : roll < 0.85 ? "white" : "iris",
        phase: Math.random() * Math.PI * 2,
      };
    };

    let t = 0;
    const frame = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]!;
        d.y -= d.speed;
        d.x += d.drift + Math.sin(t * 0.5 + d.phase) * 0.14;

        if (d.y < -12) dots[i] = spawn(w, h, false);
        if (d.x < -12) d.x = w + 12;
        if (d.x > w + 12) d.x = -12;

        // Gentle twinkle keeps the field from looking like static noise.
        const twinkle = 0.72 + Math.sin(t * 1.6 + d.phase) * 0.28;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${COLORS[d.hue]},${(d.alpha * twinkle).toFixed(3)})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };

    build();
    frame();

    // Pause entirely when the tab is hidden — no point burning a phone battery
    // animating a background nobody is looking at.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(frame);
      }
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 180);
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
