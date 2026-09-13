import type { ReactNode } from "react";
import { SiteBackground } from "@/components/landing/SiteBackground";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/Sections";

/** Wraps a content page in the site chrome: background, fixed nav, footer. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteBackground variant="subtle" />
      <SiteNav />
      <main className="pt-17">{children}</main>
      <SiteFooter />
    </>
  );
}

/** Standard hero band for content pages. */
export function PageHero({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <section className="relative border-b border-white/[0.06]">
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:py-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-mint-300">
          {eyebrow}
        </span>
        <h1 className="mt-5 font-display text-[clamp(2rem,5vw,3.2rem)] font-bold leading-[1.05] text-white">
          {title}
        </h1>
        {lead && (
          <p className="mt-5 max-w-2xl text-[16.5px] leading-relaxed text-slate-400">{lead}</p>
        )}
      </div>
    </section>
  );
}
