import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Compass,
  HeartHandshake,
  MapPin,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageHero, PageShell } from "@/components/marketing/PageShell";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Primitives";
import { COMPANY, fullAddress } from "@/lib/company";
import { PLATFORM_STATS } from "@/lib/traders";

export const metadata: Metadata = {
  title: "About us",
  description: `${COMPANY.name} is a copy-trading platform regulated by the ${COMPANY.regulator}, giving everyday investors access to verified, audited strategy providers.`,
};

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Transparency over hype",
    body: "Every provider statistic is recalculated nightly from settled trades. We show drawdown next to return, because a headline number without its risk is a half-truth.",
  },
  {
    icon: HeartHandshake,
    title: "The client's side of the table",
    body: "Client funds are held in segregated accounts, separate from company money. Providers earn a performance fee from profit only, against a high-water mark — they win when you win.",
  },
  {
    icon: Compass,
    title: "Access, not gatekeeping",
    body: "A professional track record used to require a private bank and a six-figure minimum. We built PrimeStone so anyone with a phone and a hundred dollars can allocate to the same strategies.",
  },
];

export default function AboutPage() {
  const copiers = (PLATFORM_STATS.copiers / 1_000_000).toFixed(1);
  const aum = (PLATFORM_STATS.volume / 1e9).toFixed(1);

  return (
    <PageShell>
      <PageHero
        eyebrow="About PrimeStone"
        title="We help people invest alongside traders who have earned the right to be followed."
        lead={`${COMPANY.name} is a copy-trading platform regulated by the ${COMPANY.regulator}. We connect everyday investors with verified, independently audited strategy providers — and give them the tools to copy those strategies on their own terms.`}
      />

      {/* Stats */}
      <section className="border-b border-white/[0.06]">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-y-8 px-5 py-12 sm:px-8 lg:grid-cols-4">
          {[
            { value: `${copiers}M+`, label: "Funded copiers" },
            { value: `$${aum}B`, label: "Assets under copy" },
            { value: `${PLATFORM_STATS.providers}+`, label: "Verified providers" },
            { value: `${new Date().getFullYear() - COMPANY.foundedYear}yrs`, label: "In operation" },
          ].map((s) => (
            <div key={s.label} className="text-center lg:text-left">
              <p className="font-display text-[28px] font-bold text-white">{s.value}</p>
              <p className="mt-1 text-[13px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[180px_1fr]">
          <h2 className="font-display text-[22px] font-bold text-white">Our story</h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-slate-300">
            <p>
              PrimeStone started with a simple frustration: the best traders most people
              had access to were the loudest ones on social media, not the most consistent
              ones. Track records were screenshots. &ldquo;Signals&rdquo; arrived in group chats with
              no way to verify whether they had ever actually worked.
            </p>
            <p>
              We thought the model was backwards. Instead of asking people to trust a
              screenshot and place the trade themselves, we built a platform where the
              track record is computed by us, from real settled trades, and the trade is
              executed for you the moment the provider takes it. You allocate capital to a
              strategy the way you would to a fund — except you can see every position, set
              your own risk limits, and stop at any time.
            </p>
            <p>
              Since {COMPANY.foundedYear} we have grown into a regulated platform serving
              hundreds of thousands of copiers across Africa, Asia, the Middle East and
              beyond, from our home in Mauritius. The mission has not changed: make a
              professional track record something you can inspect before you trust it.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-white/[0.06] bg-white/[0.01]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="font-display text-[24px] font-bold text-white">What we stand for</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {VALUES.map((v) => (
              <Card key={v.title} className="p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-mint-500/25 bg-mint-500/10">
                  <v.icon className="h-5 w-5 text-mint-400" />
                </div>
                <h3 className="mt-4 text-[16px] font-semibold text-white">{v.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{v.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Regulation + office */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-7">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
              <ScrollText className="h-5 w-5 text-mint-400" />
            </div>
            <h3 className="mt-4 text-[18px] font-semibold text-white">Regulation</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-400">
              {COMPANY.name} is authorised and regulated by the {COMPANY.regulator}. We
              operate under strict conduct rules covering client-money segregation, fair
              treatment and transparent reporting.
            </p>
            <dl className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Regulator</dt>
                <dd className="text-right font-medium text-white">{COMPANY.regulatorShort}, {COMPANY.jurisdiction}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Licence number</dt>
                <dd className="text-right font-medium text-white">{COMPANY.licence}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Registered name</dt>
                <dd className="text-right font-medium text-white">{COMPANY.name}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-7">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
              <Building2 className="h-5 w-5 text-mint-400" />
            </div>
            <h3 className="mt-4 text-[18px] font-semibold text-white">Head office</h3>
            <p className="mt-2 flex items-start gap-2 text-[14px] leading-relaxed text-slate-400">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <span>
                {COMPANY.address.line1}
                <br />
                {COMPANY.address.line2}
                <br />
                {COMPANY.address.street}, {COMPANY.address.city}
                <br />
                {COMPANY.address.country}
              </span>
            </p>
            <p className="mt-4 text-[13px] text-slate-500">
              Client support {COMPANY.supportHours}.
            </p>
            <ButtonLink href="/contact" variant="secondary" size="sm" className="mt-5">
              <Users className="h-4 w-4" />
              Get in touch
            </ButtonLink>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-8">
          <h2 className="font-display text-[26px] font-bold text-white">
            Ready to copy your first strategy?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] text-slate-400">
            Open an account in under two minutes and explore the leaderboard with demo
            credit before you fund a cent.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/signup">Open a free account</ButtonLink>
            <ButtonLink href="/#traders" variant="secondary">
              See the leaderboard
            </ButtonLink>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
