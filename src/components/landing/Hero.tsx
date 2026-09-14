"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, PlayCircle, ShieldCheck, TrendingUp } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, LiveDot } from "@/components/ui/Primitives";
import { PLATFORM_STATS, TRADERS } from "@/lib/traders";
import { initialsOf } from "@/lib/utils";
import { TickerTape } from "./TickerTape";
import { LiveCandles } from "./LiveCandles";

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/*                                                                              */
/*  No photograph anywhere in this section — the "showpiece" is a live         */
/*  candlestick tape, not a stock photo of a person. Two-column editorial      */
/*  layout (headline + copy on the left, a standing trading-floor panel on     */
/*  the right) rather than a full-bleed image with text laid over it.          */
/* -------------------------------------------------------------------------- */

const HEADLINE_WORDS = ["Copy", "the", "traders"];

// The ending rotates through several phrases for a livelier headline.
const ROTATING_PHRASES = [
  "who actually win.",
  "you can verify.",
  "with proven records.",
  "worth following.",
];

/** The gradient tail of the headline, cycling through ROTATING_PHRASES. */
function RotatingPhrase() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((p) => (p + 1) % ROTATING_PHRASES.length), 2800);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="mt-1 block">
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="text-gradient inline-block"
        >
          {ROTATING_PHRASES[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function Hero() {
  const board = [...TRADERS].sort((a, b) => b.roi30d - a.roi30d).slice(0, 3);

  return (
    <section className="relative overflow-hidden pt-32 pb-10">
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 sm:px-8">
        {/* Left — editorial headline column */}
        <div className="max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.05] py-1.5 pl-3 pr-4 backdrop-blur-md"
          >
            <LiveDot label="" />
            <span className="text-[12.5px] font-medium tracking-wide text-slate-200">
              Regulated copy-trading · FSC Mauritius
            </span>
          </motion.div>

          <h1 className="mt-7 font-display text-[clamp(2.4rem,4.4vw,4.1rem)] font-semibold italic leading-[1.03] tracking-tight text-white">
            <span className="block not-italic">
              {HEADLINE_WORDS.map((word, i) => (
                <motion.span
                  key={word + i}
                  initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.75, delay: 0.12 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-block pr-[0.26em]"
                >
                  {word}
                </motion.span>
              ))}
            </span>
            <RotatingPhrase />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.58 }}
            className="mt-6 max-w-lg text-[17px] leading-relaxed text-slate-300"
          >
            Verified, independently audited traders — copy their every move into your own
            account in real time, sized to your balance and your risk limits, not theirs.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <ButtonLink
              href="/signup"
              size="lg"
              className="group shadow-[0_12px_44px_-12px_rgba(207,166,83,0.7)]"
            >
              Open a free account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </ButtonLink>
            <ButtonLink
              href="/#how"
              variant="secondary"
              size="lg"
              className="border-white/15 bg-white/[0.06] backdrop-blur-md"
            >
              <PlayCircle className="h-4.5 w-4.5" />
              How it works
            </ButtonLink>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-2.5">
                {TRADERS.slice(0, 5).map((t) => (
                  <Avatar
                    key={t.id}
                    initials={initialsOf(t.name)}
                    gradient={t.gradient}
                    size={30}
                    className="ring-ink-950"
                  />
                ))}
              </div>
              <p className="text-[13px] text-slate-300">
                <span className="font-semibold text-white">
                  {(PLATFORM_STATS.copiers / 1_000_000).toFixed(1)}M+
                </span>{" "}
                copiers
              </p>
            </div>
            <span className="hidden h-4 w-px bg-white/15 sm:block" />
            <div className="flex items-center gap-2 text-[13px] text-slate-300">
              <ShieldCheck className="h-4 w-4 text-mint-400" />
              Segregated funds
            </div>
            <span className="hidden h-4 w-px bg-white/15 sm:block" />
            <div className="flex items-center gap-2 text-[13px] text-slate-300">
              <TrendingUp className="h-4 w-4 text-mint-400" />
              ${(PLATFORM_STATS.volume / 1e9).toFixed(1)}B copied
            </div>
          </motion.div>
        </div>

        {/* Right — a standing trading-floor panel. No photograph. */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div className="card-sheen relative overflow-hidden rounded border border-white/[0.1] bg-ink-900/60 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Live desk
              </span>
              <LiveDot />
            </div>

            <div className="h-56 px-1 pt-4">
              <LiveCandles />
            </div>

            <div className="grid grid-cols-3 divide-x divide-white/[0.08] border-t border-white/[0.08]">
              {board.map((t) => (
                <div key={t.id} className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Avatar initials={initialsOf(t.name)} gradient={t.gradient} size={22} ring={false} />
                    <span className="truncate text-[12px] font-medium text-slate-200">
                      {t.name.split(" ")[0]}
                    </span>
                  </div>
                  <p className="tnum mt-2 text-[15px] font-semibold text-mint-400">
                    +{t.roi30d.toFixed(1)}%
                  </p>
                  <p className="text-[10.5px] text-slate-500">30d return</p>
                </div>
              ))}
            </div>
          </div>

          {/* Small floating stat, not overlapping any image now — just the panel. */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.1 }}
            className="absolute -right-6 top-14 hidden rounded border border-white/[0.12] bg-ink-880/90 px-4 py-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:block"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Signal latency</p>
            <p className="tnum text-[19px] font-bold text-white">
              18<span className="text-[12px] font-medium text-slate-400">ms</span>
            </p>
          </motion.div>
        </motion.div>
      </div>

      <div className="mt-14">
        <TickerTape />
      </div>
    </section>
  );
}
