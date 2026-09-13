"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, PlayCircle, ShieldCheck, TrendingUp } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, LiveDot } from "@/components/ui/Primitives";
import { PLATFORM_STATS, TRADERS } from "@/lib/traders";
import { initialsOf } from "@/lib/utils";
import { TickerTape } from "./TickerTape";
import { LiveEquityStream } from "./LiveEquityStream";

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
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

// Friendly hero photo. To use your own, drop an image at /public/hero.jpg and
// set HERO_IMAGE = "/hero.jpg".
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1500&q=80";

export function Hero() {
  const topProvider = [...TRADERS].sort((a, b) => b.roi30d - a.roi30d)[0]!;

  return (
    <section className="relative overflow-hidden pt-17">
      {/* Full-bleed photo */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover"
          style={{ backgroundImage: `url("${HERO_IMAGE}")`, backgroundPosition: "72% 28%" }}
        />
        {/* Cinematic scrim — deep on the left for crisp type, lifting toward the subject */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(96deg, #04060a 0%, rgba(4,6,10,0.95) 28%, rgba(4,6,10,0.74) 50%, rgba(4,6,10,0.34) 76%, rgba(4,6,10,0.55) 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-40"
          style={{ background: "linear-gradient(to bottom, #04060a, transparent)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-52"
          style={{ background: "linear-gradient(to top, #04060a 12%, transparent)" }}
        />
        {/* Soft brand glow */}
        <div
          className="absolute -left-[8%] top-[10%] h-[44vw] w-[44vw] rounded-full blur-[140px]"
          style={{
            background: "radial-gradient(closest-side, rgba(0,223,164,0.16), transparent 70%)",
          }}
        />
      </div>

      {/* Content — vertically centred, everything above the ticker */}
      <div className="relative mx-auto flex min-h-[80vh] w-full max-w-7xl items-center px-6 py-14 sm:px-8">
        <div className="max-w-2xl">
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

          <h1 className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.7rem)] font-bold leading-[1.02] tracking-tight text-white">
            <span className="block">
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
              className="group shadow-[0_12px_44px_-12px_rgba(0,223,164,0.7)]"
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
      </div>

      {/* Floating credibility card over the photo */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 1, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-28 right-8 z-10 hidden w-64 xl:block"
      >
        <div className="card-sheen rounded-2xl border border-white/[0.12] bg-ink-900/70 p-4 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Top provider · 30d
            </span>
            <LiveDot />
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <Avatar initials={initialsOf(topProvider.name)} gradient={topProvider.gradient} size={38} />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-white">{topProvider.name}</p>
              <p className="truncate text-[11px] text-slate-400">{topProvider.strategy}</p>
            </div>
          </div>
          {/* Live, always-moving equity sparkline */}
          <div className="mt-3 h-14 overflow-hidden">
            <LiveEquityStream />
          </div>
          <div className="mt-1 flex items-end justify-between border-t border-white/[0.08] pt-3">
            <span className="text-[11.5px] text-slate-400">Return this month</span>
            <span className="tnum text-[18px] font-bold text-mint-400">
              +{topProvider.roi30d.toFixed(1)}%
            </span>
          </div>
        </div>
      </motion.div>

      <TickerTape />
    </section>
  );
}
