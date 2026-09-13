import type { Metadata } from "next";
import { Building2, Clock, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import { PageHero, PageShell } from "@/components/marketing/PageShell";
import { Card } from "@/components/ui/Primitives";
import { ContactForm } from "@/components/marketing/ContactForm";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Contact us",
  description: `Get in touch with ${COMPANY.name} — support, compliance and general enquiries. Registered office in Mauritius.`,
};

const CHANNELS = [
  {
    icon: Mail,
    label: "Client support",
    value: COMPANY.email.support,
    href: `mailto:${COMPANY.email.support}`,
    note: COMPANY.supportHours,
  },
  {
    icon: MessageSquare,
    label: "General enquiries",
    value: COMPANY.email.sales,
    href: `mailto:${COMPANY.email.sales}`,
    note: "Partnerships and press",
  },
  {
    icon: Phone,
    label: "Phone",
    value: COMPANY.phone,
    href: `tel:${COMPANY.phone.replace(/\s/g, "")}`,
    note: "Mon–Fri, business hours GMT+4",
  },
];

export default function ContactPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Contact"
        title="Talk to a human"
        lead="Questions about copying, your account, or becoming a strategy provider? Our team is here to help. Most messages get a reply within one business day."
      />

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          {/* Details */}
          <div className="space-y-4">
            {CHANNELS.map((c) => (
              <a
                key={c.label}
                href={c.href}
                className="focus-ring flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.05]"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-mint-500/25 bg-mint-500/10">
                  <c.icon className="h-5 w-5 text-mint-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] uppercase tracking-[0.1em] text-slate-500">
                    {c.label}
                  </p>
                  <p className="mt-0.5 truncate text-[15px] font-semibold text-white">
                    {c.value}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-slate-500">{c.note}</p>
                </div>
              </a>
            ))}

            <Card className="p-5">
              <div className="flex items-center gap-2 text-white">
                <Building2 className="h-4.5 w-4.5 text-mint-400" />
                <h3 className="text-[15px] font-semibold">Head office</h3>
              </div>
              <p className="mt-3 flex items-start gap-2 text-[14px] leading-relaxed text-slate-400">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>
                  {COMPANY.address.line1}
                  <br />
                  {COMPANY.address.line2}
                  <br />
                  {COMPANY.address.street}, {COMPANY.address.city}, {COMPANY.address.country}
                  <br />
                  {COMPANY.address.postal}
                </span>
              </p>
              <p className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-[13px] text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                {COMPANY.supportHours}
              </p>
            </Card>

            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-slate-500">
              For a formal complaint, email{" "}
              <a
                href={`mailto:${COMPANY.email.complaints}`}
                className="text-mint-400 hover:text-mint-300"
              >
                {COMPANY.email.complaints}
              </a>{" "}
              and we will acknowledge it within two business days, in line with our
              regulatory obligations.
            </p>
          </div>

          {/* Form */}
          <Card className="p-6 sm:p-7">
            <h2 className="text-[18px] font-semibold text-white">Send us a message</h2>
            <p className="mt-1 text-[13.5px] text-slate-400">
              Fill this in and we will get back to you by email.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </Card>
        </div>
      </section>
    </PageShell>
  );
}
