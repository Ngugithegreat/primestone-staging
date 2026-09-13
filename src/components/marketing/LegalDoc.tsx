import type { ReactNode } from "react";
import { PageHero, PageShell } from "./PageShell";

export type LegalSection = {
  heading: string;
  body: ReactNode[];
};

/** Renders a legal document from structured sections with a table of contents. */
export function LegalDoc({
  eyebrow,
  title,
  lead,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <PageShell>
      <PageHero eyebrow={eyebrow} title={title} lead={lead} />

      <section className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
        <p className="mb-10 text-[13px] text-slate-500">Last updated: {updated}</p>

        <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
          {/* Table of contents */}
          <nav className="hidden lg:block">
            <div className="sticky top-24 space-y-1.5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                On this page
              </p>
              {sections.map((s, i) => (
                <a
                  key={s.heading}
                  href={`#s${i + 1}`}
                  className="block text-[13px] leading-snug text-slate-400 transition-colors hover:text-mint-300"
                >
                  {i + 1}. {s.heading}
                </a>
              ))}
            </div>
          </nav>

          {/* Body */}
          <div className="min-w-0 space-y-10">
            {sections.map((s, i) => (
              <div key={s.heading} id={`s${i + 1}`} className="scroll-mt-24">
                <h2 className="font-display text-[20px] font-semibold text-white">
                  <span className="text-slate-600">{i + 1}.</span> {s.heading}
                </h2>
                <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-slate-400">
                  {s.body.map((p, j) => (
                    <div key={j}>{p}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
