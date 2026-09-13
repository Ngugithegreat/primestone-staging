"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bitcoin,
  Check,
  CreditCard,
  Gauge,
  Layers,
  LineChart,
  Lock,
  Radio,
  Repeat2,
  Search,
  ShieldCheck,
  Signal,
  Smartphone,
  SlidersHorizontal,
  Star,
  Wallet,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import {
  AnimatedNumber,
  Avatar,
  Badge,
  Card,
  Eyebrow,
  Reveal,
} from "@/components/ui/Primitives";
import { TraderCard } from "@/components/traders/TraderCard";
import { LiveCandles } from "./LiveCandles";
import { WorldGlobe } from "./WorldGlobe";
import { PhoneMockup } from "./PhoneMockup";
import { ACCOUNT_TYPES } from "@/lib/accounts";
import { COMPANY } from "@/lib/company";
import { FEATURED_TRADERS, PLATFORM_STATS, TRADERS } from "@/lib/traders";
import { cn, initialsOf } from "@/lib/utils";

/* ========================================================================== */
/*  Stats band                                                                */
/* ========================================================================== */

// Derived from the real provider set so nothing on the page can contradict the
// leaderboard a visitor is one click from counting.
const STATS = [
  {
    value: Math.round(PLATFORM_STATS.copiers / 1000) / 10,
    suffix: "M+",
    label: "Funded copiers",
    decimals: 1,
  },
  {
    value: Math.round(PLATFORM_STATS.volume / 1e8) / 10,
    prefix: "$",
    suffix: "B",
    label: "Assets under copy",
    decimals: 1,
  },
  { value: PLATFORM_STATS.providers, suffix: "+", label: "Verified providers", decimals: 0 },
  { value: PLATFORM_STATS.avgLatencyMs, suffix: "ms", label: "Signal latency", decimals: 0 },
];

export function StatsBand() {
  return (
    <section className="relative border-b border-white/[0.06] py-14">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-9 px-5 sm:px-8 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} className="text-center lg:text-left">
            <p className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-bold leading-none text-white">
              <AnimatedNumber
                value={s.value}
                prefix={s.prefix}
                suffix={s.suffix}
                decimals={s.decimals}
              />
            </p>
            <p className="mt-2 text-[13px] text-slate-400">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  Section heading helper                                                    */
/* ========================================================================== */

function Heading({
  eyebrow,
  title,
  body,
  align = "center",
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
  align?: "center" | "left";
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "center" ? "items-center text-center" : "items-start",
        action && "md:flex-row md:items-end md:justify-between md:text-left",
      )}
    >
      <div className={cn(align === "center" && !action && "mx-auto max-w-2xl")}>
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="mt-5 font-display text-[clamp(1.9rem,4.4vw,3rem)] font-bold leading-[1.06] text-white">
            {title}
          </h2>
        </Reveal>
        {body && (
          <Reveal delay={0.12}>
            <p
              className={cn(
                "mt-4 text-[16px] leading-relaxed text-slate-400",
                align === "center" && !action ? "mx-auto max-w-2xl" : "max-w-2xl",
              )}
            >
              {body}
            </p>
          </Reveal>
        )}
      </div>
      {action && <Reveal delay={0.16}>{action}</Reveal>}
    </div>
  );
}

/* ========================================================================== */
/*  Global reach — interactive globe + phone preview                          */
/* ========================================================================== */

export function GlobalReach() {
  return (
    <section className="relative overflow-hidden py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Heading
          eyebrow="A global desk"
          title={
            <>
              Copiers in <span className="text-gradient">60+ countries</span>
            </>
          }
          body="Wherever you are, people copy verified traders on PrimeStone every day. Spin the globe — and see the whole desk in your pocket."
        />

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-2">
          {/* Interactive globe */}
          <Reveal>
            <div className="relative">
              <WorldGlobe />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-center">
                {[
                  [`${(PLATFORM_STATS.copiers / 1_000_000).toFixed(1)}M+`, "copiers"],
                  ["60+", "countries"],
                  [`$${(PLATFORM_STATS.volume / 1e9).toFixed(1)}B`, "copied"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <p className="font-display text-[22px] font-bold text-white">{v}</p>
                    <p className="text-[12px] text-slate-500">{l}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center text-[11.5px] text-slate-600">Drag to spin the globe</p>
            </div>
          </Reveal>

          {/* Phone preview */}
          <Reveal delay={0.1}>
            <PhoneMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  How it works                                                              */
/* ========================================================================== */

const STEPS = [
  {
    icon: Search,
    title: "Find a strategy that fits",
    body: "Filter hundreds of verified providers by return, drawdown, risk score, instruments and fee. Every number is calculated from settled trades — nothing is self-reported.",
    accent: "#00dfa4",
  },
  {
    icon: SlidersHorizontal,
    title: "Set your own limits",
    body: "Choose how much to allocate, scale their position size up or down, and set a copy stop-loss that unwinds everything if the strategy hits your pain threshold.",
    accent: "#6366f1",
  },
  {
    icon: Repeat2,
    title: "Their trades become yours",
    body: "Entries, exits, stops and partial closes mirror into your account within 40 milliseconds, sized proportionally to your allocation. Stop any time — no lock-in.",
    accent: "#22d3ee",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Heading
          eyebrow="How it works"
          title={
            <>
              Three steps between you and
              <br className="hidden sm:block" /> a professional track record
            </>
          }
          body="No signals group, no screenshots, no trust-me-bro. You allocate capital to a strategy and the platform executes it for you."
        />

        <div className="relative mt-16 grid gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Connector line behind the cards on desktop */}
          <div
            className="pointer-events-none absolute inset-x-[16%] top-[74px] hidden h-px lg:block"
            aria-hidden="true"
          >
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              className="h-full origin-left bg-gradient-to-r from-mint-500/50 via-iris-500/50 to-cyan-400/10"
            />
          </div>

          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.12}>
              <Card hover className="relative h-full p-6">
                <div className="flex items-center gap-3.5">
                  <div
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border"
                    style={{
                      background: `linear-gradient(140deg, ${step.accent}26, transparent)`,
                      borderColor: `${step.accent}40`,
                    }}
                  >
                    <step.icon className="h-5 w-5" style={{ color: step.accent }} />
                  </div>
                  <span className="font-display text-[42px] font-bold leading-none text-white/[0.13]">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold text-white">{step.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-slate-400">
                  {step.body}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  Top traders preview                                                       */
/* ========================================================================== */

export function TopTraders() {
  const featured = FEATURED_TRADERS.slice(0, 4);

  return (
    <section id="traders" className="relative py-24 lg:py-28">
      {/* Section glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 blur-[120px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(99,102,241,0.16), rgba(99,102,241,0) 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <Heading
          align="left"
          eyebrow="Strategy providers"
          title="The leaderboard is the product"
          body="Ranked on audited, settled performance. Drawdown and risk score sit next to the return, because a 300% year means nothing without knowing what it cost to get there."
          action={
            <ButtonLink href="/signup" variant="secondary" className="group">
              Browse all {PLATFORM_STATS.providers} providers
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </ButtonLink>
          }
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {featured.map((t, i) => (
            <TraderCard key={t.id} trader={t} href="/signup" index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  Feature bento                                                             */
/* ========================================================================== */

export function Features() {
  return (
    <section className="relative py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Heading
          eyebrow="Built for the long run"
          title="Risk controls that a professional would recognise"
          body="Copy trading fails when a good month hides a bad system. Every control here exists to make that impossible to miss."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-6">
          {/* Big feature */}
          <Reveal className="lg:col-span-4">
            <Card hover className="relative h-full overflow-hidden p-7">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-[70px]"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(0,223,164,0.24), transparent 70%)",
                }}
              />
              <Badge tone="mint" dot>
                Proportional engine
              </Badge>
              <h3 className="mt-4 font-display text-[26px] font-bold leading-tight text-white">
                Your account is not a clone. It is scaled.
              </h3>
              <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-slate-400">
                A provider trading 5 lots on a $500,000 book does not put 5 lots on your
                $2,000. PrimeStone sizes every mirrored trade to your allocation, respects
                your leverage cap, and skips any signal that would breach your margin.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Provider order", value: "5.00 lots", sub: "$500,000 book" },
                  { label: "Your allocation", value: "$2,000", sub: "0.4% of book" },
                  { label: "Mirrored to you", value: "0.02 lots", sub: "Same risk %" },
                ].map((row, i) => (
                  <div
                    key={row.label}
                    className={cn(
                      "rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5",
                      i === 2 && "border-mint-500/25 bg-mint-500/[0.07]",
                    )}
                  >
                    <p className="text-[11px] text-slate-500">{row.label}</p>
                    <p
                      className={cn(
                        "tnum mt-1 text-[17px] font-semibold",
                        i === 2 ? "text-mint-400" : "text-white",
                      )}
                    >
                      {row.value}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{row.sub}</p>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.08} className="lg:col-span-2">
            <Card hover className="flex h-full flex-col justify-between p-7">
              <div>
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-rose-500/25 bg-rose-500/10">
                  <ShieldCheck className="h-5 w-5 text-rose-400" />
                </div>
                <h3 className="mt-4 text-[17px] font-semibold text-white">
                  Copy stop-loss
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-400">
                  Set a maximum loss on the allocation itself. Breach it and every copied
                  position is closed and the link is cut — without you being awake.
                </p>
              </div>
              <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-slate-500">Allocation drawdown</span>
                  <span className="tnum font-semibold text-amber-450">-18.4%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full w-[61%] rounded-full bg-gradient-to-r from-amber-450 to-rose-500" />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Auto-unwind set at -30%</p>
              </div>
            </Card>
          </Reveal>

          {[
            {
              icon: BarChart3,
              color: "#818cf8",
              title: "Audited track records",
              body: "Every provider statistic is recomputed nightly from settled trades. Providers cannot edit history, hide losers or reset a bad month.",
            },
            {
              icon: Zap,
              color: "#fbbf24",
              title: "40ms execution",
              body: "Co-located matching with 12 tier-1 liquidity providers. Slippage between the provider's fill and yours is published on every trade.",
            },
            {
              icon: Layers,
              color: "#22d3ee",
              title: "Diversify across strategies",
              body: "Split capital across uncorrelated providers and the platform shows you the combined exposure before you commit a cent.",
            },
          ].map((f, i) => (
            <Reveal key={f.title} delay={0.12 + i * 0.06} className="lg:col-span-2">
              <Card hover className="h-full p-6">
                <div
                  className="grid h-11 w-11 place-items-center rounded-xl border"
                  style={{
                    background: `linear-gradient(140deg, ${f.color}22, transparent)`,
                    borderColor: `${f.color}38`,
                  }}
                >
                  <f.icon className="h-5 w-5" style={{ color: f.color }} />
                </div>
                <h3 className="mt-4 text-[16px] font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{f.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  Account types                                                             */
/* ========================================================================== */

export function AccountTypesSection() {
  return (
    <section id="accounts" className="relative py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Heading
          eyebrow="Account types"
          title="Pick the pricing model, not a tier of you"
          body="Every account gets the full platform: all instruments, all providers, all tools. The difference is how you pay for execution."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {ACCOUNT_TYPES.map((a, i) => (
            <Reveal key={a.id} delay={i * 0.07}>
              <Card
                hover
                className={cn(
                  "relative flex h-full flex-col p-6",
                  a.popular && "border-mint-500/30 bg-mint-500/[0.035]",
                )}
              >
                {/* Inside the flow — the card clips its own overflow for the sheen. */}
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="h-1 w-11 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${a.accent[0]}, ${a.accent[1]})`,
                    }}
                  />
                  {a.popular && (
                    <span className="rounded-full bg-mint-500 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-950">
                      Most popular
                    </span>
                  )}
                </div>
                <h3 className="mt-4 font-display text-[21px] font-bold text-white">{a.name}</h3>
                <p className="mt-2 min-h-[42px] text-[13.5px] leading-snug text-slate-400">
                  {a.tagline}
                </p>

                <div className="mt-5 border-y border-white/[0.06] py-4">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    Spread
                  </p>
                  <p className="mt-1 font-display text-[22px] font-bold text-white">
                    {a.spreadLabel}
                  </p>
                  <p className="mt-1 text-[12.5px] text-slate-400">{a.commissionLabel}</p>
                </div>

                <dl className="mt-4 space-y-2 text-[12.5px]">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Minimum deposit</dt>
                    <dd className="tnum font-medium text-white">${a.minDeposit.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Max leverage</dt>
                    <dd className="tnum font-medium text-white">1:{a.maxLeverage}</dd>
                  </div>
                </dl>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {a.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-[13px] leading-snug text-slate-300">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-400" />
                      {f}
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  href={`/signup?account=${a.id}`}
                  variant={a.popular ? "primary" : "secondary"}
                  className="mt-6 w-full"
                >
                  Open {a.name}
                </ButtonLink>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  Funding                                                                   */
/* ========================================================================== */

const METHODS = [
  {
    icon: Smartphone,
    name: "M-Pesa",
    color: "#00dfa4",
    speed: "Instant",
    fee: "No fee",
    body: "Push an STK prompt to your phone and the funds land before the confirmation SMS does. Kenya, Tanzania and Ghana.",
    tags: ["KES", "TZS", "GHS"],
  },
  {
    icon: Bitcoin,
    name: "Crypto",
    color: "#fbbf24",
    speed: "1–3 confirmations",
    fee: "Network fee only",
    body: "USDT, USDC, BTC and ETH across five chains. Deposit addresses are unique per account and never recycled.",
    tags: ["TRC-20", "ERC-20", "BEP-20", "Solana"],
  },
  {
    icon: CreditCard,
    name: "Cards",
    color: "#818cf8",
    speed: "Instant",
    fee: "No fee",
    body: "Visa and Mastercard, 3-D Secure enforced. Card details are tokenised by the processor — they never touch our servers.",
    tags: ["Visa", "Mastercard", "3DS2"],
  },
];

export function Funding() {
  return (
    <section id="funding" className="relative py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Heading
          eyebrow="Deposits & withdrawals"
          title="Money in fast. Money out faster."
          body="Withdrawals are processed to the same method you funded with. Requests submitted before 14:00 GMT settle the same working day."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {METHODS.map((m, i) => (
            <Reveal key={m.name} delay={i * 0.09}>
              <Card hover className="h-full p-6">
                <div className="flex items-center justify-between">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-xl border"
                    style={{
                      background: `linear-gradient(140deg, ${m.color}22, transparent)`,
                      borderColor: `${m.color}38`,
                    }}
                  >
                    <m.icon className="h-5.5 w-5.5" style={{ color: m.color }} />
                  </div>
                  <Badge tone="mint">{m.fee}</Badge>
                </div>

                <h3 className="mt-4 text-[18px] font-semibold text-white">{m.name}</h3>
                <p className="mt-1 text-[12.5px] font-medium" style={{ color: m.color }}>
                  {m.speed}
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-slate-400">{m.body}</p>

                <div className="mt-5 flex flex-wrap gap-1.5">
                  {m.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-5 text-[13px] text-slate-400">
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-mint-400" /> Client funds held in segregated tier-1 accounts
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-mint-400" /> Negative balance protection
            </span>
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-mint-400" /> No deposit or inactivity fees
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  Platform showcase                                                         */
/* ========================================================================== */

const SHOWCASE = [
  {
    id: "chart",
    icon: LineChart,
    title: "Live trading desk",
    body: "Candlestick charts on 18 instruments with five timeframes, a full order ticket, and stop-loss and take-profit levels you can drag. Practise on demo funds before a cent of your own is at risk.",
    points: ["Market and limit orders", "Draggable SL/TP", "Live floating P&L per position"],
  },
  {
    id: "portfolio",
    icon: Gauge,
    title: "Portfolio analytics",
    body: "Open positions, full trade history, win rate, profit factor, average win against average loss, and your exposure broken down by instrument and by provider.",
    points: ["Equity curve since day one", "Per-provider attribution", "Exportable statements"],
  },
  {
    id: "signals",
    icon: Radio,
    title: "Signal feed",
    body: "Watch every mirrored entry and exit as it happens, with the provider's original fill next to yours so slippage is never a mystery.",
    points: ["Real-time mirror log", "Slippage published per trade", "Push and email alerts"],
  },
];

export function PlatformShowcase() {
  const [active, setActive] = useState(0);
  const item = SHOWCASE[active]!;

  return (
    <section id="platform" className="relative overflow-hidden py-24 lg:py-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/3 h-[500px] blur-[130px]"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,223,164,0.13), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <Heading
          eyebrow="The platform"
          title="A real terminal, not a dashboard with a chart on it"
          body="Everything you need to evaluate a provider, place your own trades and understand your exposure — in one place."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-[0.9fr_1.35fr] lg:gap-12">
          <div className="space-y-3">
            {SHOWCASE.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                className={cn(
                  "focus-ring w-full rounded-2xl border p-5 text-left transition-all duration-300",
                  active === i
                    ? "border-mint-500/30 bg-mint-500/[0.06]"
                    : "border-white/[0.07] bg-white/[0.015] hover:bg-white/[0.04]",
                )}
              >
                <div className="flex items-center gap-3">
                  <s.icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      active === i ? "text-mint-400" : "text-slate-500",
                    )}
                  />
                  <h3
                    className={cn(
                      "text-[16px] font-semibold transition-colors",
                      active === i ? "text-white" : "text-slate-300",
                    )}
                  >
                    {s.title}
                  </h3>
                </div>
                {active === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 text-[14px] leading-relaxed text-slate-400">{s.body}</p>
                    <ul className="mt-3.5 space-y-1.5">
                      {s.points.map((p) => (
                        <li key={p} className="flex items-center gap-2 text-[13px] text-slate-300">
                          <Check className="h-3.5 w-3.5 text-mint-400" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </button>
            ))}

            <ButtonLink href="/signup" className="mt-4 w-full sm:w-auto">
              Open the demo desk
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>

          <Reveal>
            <ShowcaseFrame variant={item.id} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** A stylised in-browser mock of the product, built from real markup. */
function ShowcaseFrame({ variant }: { variant: string }) {
  return (
    <div className="card-sheen overflow-hidden rounded-2xl border border-white/[0.09] bg-ink-900/80 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-ink-880/80 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-450/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-mint-500/70" />
        <div className="ml-3 flex-1 rounded-md border border-white/[0.06] bg-ink-950/60 px-3 py-1 text-[11px] text-slate-500">
          app.primestone.com/{variant === "chart" ? "trade" : variant}
        </div>
      </div>

      <div className="p-4">
        {variant === "chart" && <MockChart />}
        {variant === "portfolio" && <MockPortfolio />}
        {variant === "signals" && <MockSignals />}
      </div>
    </div>
  );
}

function MockChart() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold text-white">XAUUSD</p>
          <p className="tnum text-[11.5px] text-slate-500">Gold / US Dollar · H1</p>
        </div>
        <div className="text-right">
          <p className="tnum text-[17px] font-semibold text-mint-400">2,412.60</p>
          <p className="tnum text-[11.5px] text-mint-400">+0.87%</p>
        </div>
      </div>

      <div className="relative mt-4 h-52">
        <LiveCandles />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Buy", "2,412.88", "mint"],
          ["Sell", "2,412.32", "rose"],
          ["Spread", "0.28", "slate"],
        ].map(([label, value, tone]) => (
          <div
            key={label}
            className={cn(
              "rounded-lg border p-2.5",
              tone === "mint"
                ? "border-mint-500/25 bg-mint-500/[0.08]"
                : tone === "rose"
                  ? "border-rose-500/25 bg-rose-500/[0.08]"
                  : "border-white/[0.07] bg-white/[0.02]",
            )}
          >
            <p className="text-[10.5px] text-slate-500">{label}</p>
            <p
              className={cn(
                "tnum mt-0.5 text-[14px] font-semibold",
                tone === "mint" ? "text-mint-400" : tone === "rose" ? "text-rose-400" : "text-white",
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockPortfolio() {
  const rows = [
    ["XAUUSD", "Buy", "0.25", "+$482.10", true],
    ["EURUSD", "Buy", "0.50", "+$126.40", true],
    ["BTCUSD", "Sell", "0.08", "-$214.80", false],
    ["US100", "Buy", "0.30", "+$318.60", true],
  ] as const;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5">
        {[
          ["Equity", "$48,291.64", "text-white"],
          ["Open P&L", "+$712.30", "text-mint-400"],
          ["Win rate", "72.4%", "text-white"],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="text-[10.5px] text-slate-500">{label}</p>
            <p className={cn("tnum mt-1 text-[15px] font-semibold", tone)}>{value}</p>
          </div>
        ))}
      </div>

      <table className="mt-4 w-full">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-[10.5px] uppercase tracking-wide text-slate-500">
            <th className="pb-2 font-medium">Symbol</th>
            <th className="pb-2 font-medium">Side</th>
            <th className="pb-2 font-medium">Lots</th>
            <th className="pb-2 text-right font-medium">P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([sym, side, lots, pnl, up]) => (
            <tr key={sym} className="border-b border-white/[0.04]">
              <td className="py-2.5 text-[12.5px] font-medium text-white">{sym}</td>
              <td className="py-2.5">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-bold",
                    side === "Buy"
                      ? "bg-mint-500/15 text-mint-400"
                      : "bg-rose-500/15 text-rose-400",
                  )}
                >
                  {side.toUpperCase()}
                </span>
              </td>
              <td className="tnum py-2.5 text-[12.5px] text-slate-400">{lots}</td>
              <td
                className={cn(
                  "tnum py-2.5 text-right text-[12.5px] font-semibold",
                  up ? "text-mint-400" : "text-rose-400",
                )}
              >
                {pnl}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockSignals() {
  const signals = [
    ["Kwame Mwangi", "BUY", "XAUUSD", "2,410.40", "12s ago", true],
    ["Elena Fischer", "SELL", "GER40", "18,472.0", "1m ago", false],
    ["David Chen", "BUY", "US100", "19,838.5", "4m ago", true],
    ["Raj Patel", "CLOSE", "USDJPY", "156.38", "6m ago", true],
    ["Thabo Nkosi", "BUY", "XAGUSD", "30.842", "9m ago", true],
  ] as const;

  return (
    <div className="space-y-2">
      {signals.map(([who, action, sym, price, when, up], i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
        >
          <Avatar
            initials={initialsOf(who)}
            gradient={TRADERS[i % TRADERS.length]!.gradient}
            size={30}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-white">{who}</p>
            <p className="text-[11px] text-slate-500">{when}</p>
          </div>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-bold",
              action === "BUY"
                ? "bg-mint-500/15 text-mint-400"
                : action === "SELL"
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-white/10 text-slate-300",
            )}
          >
            {action}
          </span>
          <div className="text-right">
            <p className="text-[12px] font-medium text-white">{sym}</p>
            <p className={cn("tnum text-[11px]", up ? "text-mint-400" : "text-rose-400")}>
              {price}
            </p>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-center gap-2 pt-1 text-[11.5px] text-slate-500">
        <Signal className="h-3.5 w-3.5 text-mint-400" />
        Streaming live · 40ms median latency
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Testimonials                                                              */
/* ========================================================================== */

const QUOTES = [
  {
    quote:
      "I stopped trying to be a trader and started being an allocator. Six providers, rebalanced quarterly. My drawdown is a third of what it was when I traded my own ideas.",
    name: "Brian Kimani",
    role: "Copying since 2023 · Nairobi",
    gradient: ["#00dfa4", "#0ea5e9"] as [string, string],
    stat: "+64.2% in 14 months",
  },
  {
    quote:
      "The thing that sold me was the drawdown column sitting right next to the return. Every other platform buries it. Here it is the second number you see.",
    name: "Anita Deshmukh",
    role: "ECN account · Mumbai",
    gradient: ["#818cf8", "#c084fc"] as [string, string],
    stat: "9 providers copied",
  },
  {
    quote:
      "Funded with M-Pesa on a Sunday night and the balance was there before I locked my phone. Withdrew on Tuesday, same speed. That alone puts it ahead of the broker I left.",
    name: "Joseph Otieno",
    role: "Standard account · Kisumu",
    gradient: ["#fbbf24", "#f97316"] as [string, string],
    stat: "31 withdrawals, zero delays",
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Heading
          eyebrow="From the desk"
          title="What copiers actually say"
          body="Real accounts, real allocations. Returns shown are the copier's own, net of provider fees."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={q.name} delay={i * 0.1}>
              <Card hover className="flex h-full flex-col p-6">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-amber-450 text-amber-450" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-[14.5px] leading-relaxed text-slate-300">
                  “{q.quote}”
                </blockquote>
                <div className="mt-5 flex items-center gap-3 border-t border-white/[0.06] pt-4">
                  <Avatar initials={initialsOf(q.name)} gradient={q.gradient} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-white">{q.name}</p>
                    <p className="truncate text-[11.5px] text-slate-500">{q.role}</p>
                  </div>
                </div>
                <p className="mt-3 rounded-lg bg-mint-500/[0.08] px-3 py-1.5 text-center text-[12px] font-semibold text-mint-400">
                  {q.stat}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  FAQ                                                                       */
/* ========================================================================== */

const FAQS = [
  {
    q: "How does copy trading actually work here?",
    a: "You allocate an amount to a strategy provider. From that moment their orders are mirrored into your account, sized proportionally to your allocation against their own equity. If they risk 1% of their book on a trade, you risk 1% of your allocation. You keep full control: you can adjust the size multiplier, set a copy stop-loss, pause the link, or close any individual mirrored position yourself.",
  },
  {
    q: "What do the strategy providers charge?",
    a: "A performance fee only, between 15% and 30% depending on the provider, and it is taken from profit only. There is no management fee and no fee on a losing period. Every provider runs a high-water mark, so if your allocation drops they earn nothing until it recovers past its previous peak.",
  },
  {
    q: "Are the track records real?",
    a: "Yes, and they are not editable. Provider statistics are recalculated nightly from settled trades on the platform's own books — win rate, drawdown, profit factor and every number on the card. Providers cannot delete a trade, hide a losing month or reset the record by opening a new account. Anything older than the provider's join date is not shown at all.",
  },
  {
    q: "Which account type should I choose?",
    a: "If you are funding under about $2,000 and mostly copying rather than trading yourself, Standard is the right call — no commission, and the spread difference is immaterial at that size. If you trade actively or scalp, ECN's raw spreads plus a flat $3.50 per lot per side works out cheaper. Pro is for six-figure accounts. Swap-free is for anyone who needs an Islamic-finance-compliant account. You can switch type later from settings.",
  },
  {
    q: "Can I trade myself as well as copy?",
    a: "Yes. The trading desk is a full terminal with 18 instruments, five timeframes, market and limit orders, and draggable stop-loss and take-profit levels. Copied positions and your own positions live side by side in the portfolio, tagged so you can always tell which is which and attribute performance separately.",
  },
  {
    q: "How fast are deposits and withdrawals?",
    a: "M-Pesa and card deposits are instant. Crypto lands after network confirmation, typically one to three blocks. Withdrawals go back to the method you funded with: M-Pesa and card same day, crypto within the hour, bank transfer one to two working days. Requests submitted before 14:00 GMT are processed the same working day.",
  },
  {
    q: "What happens if a provider blows up?",
    a: "Your copy stop-loss is the backstop and we recommend setting one on every allocation. When your allocation's drawdown hits that threshold every copied position is closed at market and the link is severed automatically — it does not wait for you to be at your screen. Separately, negative balance protection means you can never lose more than the money in your account.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 lg:py-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <Heading eyebrow="Questions" title="Everything you are about to ask" />

        <div className="mt-12 space-y-3">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={Math.min(i * 0.05, 0.3)}>
              <div
                className={cn(
                  "overflow-hidden rounded-2xl border transition-colors duration-300",
                  open === i
                    ? "border-white/[0.14] bg-white/[0.04]"
                    : "border-white/[0.07] bg-white/[0.015]",
                )}
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="focus-ring flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-[15px] font-medium text-white">{f.q}</span>
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 transition-transform duration-300",
                      open === i && "rotate-45 border-mint-500/40 bg-mint-500/15",
                    )}
                  >
                    <span className="relative block h-2.5 w-2.5">
                      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
                      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                    </span>
                  </span>
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: open === i ? "auto" : 0, opacity: open === i ? 1 : 0 }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-slate-400">{f.a}</p>
                </motion.div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  Closing CTA                                                               */
/* ========================================================================== */

export function CtaBand() {
  return (
    <section className="relative py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <div className="card-sheen noise relative overflow-hidden rounded-4xl border border-white/[0.09] bg-ink-880/70 px-6 py-16 text-center backdrop-blur-2xl sm:px-12">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 60% 90% at 50% 0%, rgba(0,223,164,0.18), transparent 65%), radial-gradient(ellipse 50% 80% at 80% 100%, rgba(99,102,241,0.16), transparent 65%)",
              }}
              aria-hidden="true"
            />
            <div className="relative">
              <Eyebrow>Get started in 90 seconds</Eyebrow>
              <h2 className="mx-auto mt-6 max-w-3xl font-display text-[clamp(2rem,4.8vw,3.4rem)] font-bold leading-[1.05] text-white">
                Your first allocation can be{" "}
                <span className="text-gradient">demo money</span>.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-slate-400">
                Open an account and we credit your demo desk immediately. Copy real
                providers, place real orders, watch a real P&L — and fund it only when the
                numbers convince you.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/signup" size="lg" className="group w-full sm:w-auto">
                  Open a free account
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" size="lg" className="w-full sm:w-auto">
                  I already have one
                </ButtonLink>
              </div>
              <p className="mt-6 text-[12.5px] text-slate-500">
                No card required · Demo credit included · Withdraw any time
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  Footer                                                                    */
/* ========================================================================== */

const FOOTER_LINKS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "Copy trading", href: "/#traders" },
      { label: "Trading desk", href: "/#platform" },
      { label: "Account types", href: "/#accounts" },
      { label: "Deposits & withdrawals", href: "/#funding" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Become a provider", href: "/signup" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help & FAQ", href: "/#faq" },
      { label: "Contact us", href: "/contact" },
      { label: "Deposits & withdrawals", href: "/#funding" },
      { label: "Complaints", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of service", href: "/legal/terms" },
      { label: "Privacy policy", href: "/legal/privacy" },
      { label: "Risk disclosure", href: "/legal/risk-disclosure" },
      { label: "Regulation", href: "/about" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/[0.07] bg-ink-900/40">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2.6fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="font-display text-[19px] font-semibold tracking-tight text-white">
                Prime<span className="text-mint-400">Stone</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-slate-400">
              A copy-trading platform built around one idea: you should be able to see
              exactly what you are copying before you copy it.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge tone="slate">Segregated funds</Badge>
              <Badge tone="slate">Negative balance protection</Badge>
              <Badge tone="slate">SSL / 2FA</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_LINKS.map((col) => (
              <div key={col.title}>
                <h4 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {col.title}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-[13.5px] text-slate-400 transition-colors hover:text-white"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 space-y-4 border-t border-white/[0.06] pt-8">
          <p className="text-[11.5px] leading-relaxed text-slate-500">
            {COMPANY.name} is authorised and regulated by the {COMPANY.regulator} (licence{" "}
            {COMPANY.licence}). Registered office: {COMPANY.address.line1},{" "}
            {COMPANY.address.line2}, {COMPANY.address.street}, {COMPANY.address.city},{" "}
            {COMPANY.address.country}.
          </p>
          <p className="text-[11.5px] leading-relaxed text-slate-500">
            <strong className="font-semibold text-slate-400">Risk warning.</strong>{" "}
            Trading leveraged products carries a high level of risk and can result in the
            loss of all of your capital. Copying another trader does not remove that risk —
            past performance is not a reliable indicator of future results, and a provider&rsquo;s
            historical return says nothing about what the next month will do. Never allocate
            money you cannot afford to lose, and make sure you understand how leverage works
            before you fund an account. See our{" "}
            <Link href="/legal/risk-disclosure" className="text-slate-400 underline-offset-2 hover:underline">
              Risk Disclosure
            </Link>{" "}
            for more.
          </p>
          <div className="flex flex-col items-start justify-between gap-3 pt-2 sm:flex-row sm:items-center">
            <p className="text-[12.5px] text-slate-500">
              © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
            </p>
            <p className="text-[12.5px] text-slate-500">
              Client funds held in segregated accounts.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
