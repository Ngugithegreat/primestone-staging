"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Quote, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { SiteBackground } from "@/components/landing/SiteBackground";
import { Avatar } from "@/components/ui/Primitives";
import { TRADERS } from "@/lib/traders";
import { initialsOf } from "@/lib/utils";

const HIGHLIGHTS = [
  { icon: TrendingUp, text: "340+ audited strategy providers" },
  { icon: Zap, text: "40ms mirrored execution" },
  { icon: ShieldCheck, text: "Segregated funds, negative balance protection" },
];

export function AuthLayout({
  children,
  title,
  subtitle,
  footer,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_auto]">
      <SiteBackground />
      {/* ---- Form side ---------------------------------------------------- */}
      <div className="relative flex flex-col px-5 py-7 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 15% 0%, rgba(0,223,164,0.10), transparent 60%)",
          }}
          aria-hidden="true"
        />

        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[13px] text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={wide ? "w-full max-w-2xl" : "w-full max-w-[400px]"}
          >
            <h1 className="font-display text-[30px] font-bold leading-tight text-white">
              {title}
            </h1>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-slate-400">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>

        {footer && <div className="text-center text-[13px] text-slate-500">{footer}</div>}
      </div>

      {/* ---- Marketing side ----------------------------------------------- */}
      <aside className="relative hidden w-[440px] overflow-hidden border-l border-white/[0.07] bg-ink-900/60 xl:block">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(ellipse 70% 50% at 30% 100%, rgba(0,223,164,0.14), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 grid-lines opacity-60" aria-hidden="true" />

        <div className="relative flex h-full flex-col justify-between p-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-mint-300">
              Why PrimeStone
            </span>
            <h2 className="mt-7 font-display text-[30px] font-bold leading-[1.15] text-white">
              You do not need to be a great trader.
              <br />
              You need to pick great traders.
            </h2>
            <ul className="mt-8 space-y-4">
              {HIGHLIGHTS.map((h, i) => (
                <motion.li
                  key={h.text}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 + i * 0.12 }}
                  className="flex items-center gap-3 text-[14px] text-slate-300"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-mint-500/25 bg-mint-500/10">
                    <h.icon className="h-4 w-4 text-mint-400" />
                  </span>
                  {h.text}
                </motion.li>
              ))}
            </ul>
          </div>

          <motion.figure
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="card-sheen rounded-2xl border border-white/[0.09] bg-ink-880/80 p-5 backdrop-blur-xl"
          >
            <Quote className="h-5 w-5 text-mint-400/50" />
            <blockquote className="mt-3 text-[14px] leading-relaxed text-slate-300">
              I allocated $800 across three providers to see whether the numbers held up.
              Fourteen months later that is the core of my account, and I have still never
              placed a trade of my own.
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3 border-t border-white/[0.06] pt-4">
              <Avatar
                initials={initialsOf("Brian Kimani")}
                gradient={TRADERS[0]!.gradient}
                size={36}
              />
              <div>
                <p className="text-[13px] font-semibold text-white">Brian Kimani</p>
                <p className="text-[11.5px] text-slate-500">Standard account · Nairobi</p>
              </div>
            </figcaption>
          </motion.figure>
        </div>
      </aside>
    </div>
  );
}
