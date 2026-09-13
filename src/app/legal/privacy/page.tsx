import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/LegalDoc";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${COMPANY.name} collects, uses and protects your personal data.`,
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    body: [
      <p key="1">
        {COMPANY.name} (&ldquo;{COMPANY.shortName}&rdquo;, &ldquo;we&rdquo;) is the data controller responsible
        for your personal data. We are regulated by the {COMPANY.regulator} and based at{" "}
        {COMPANY.address.line1}, {COMPANY.address.city}, {COMPANY.address.country}. This
        policy explains what we collect, why, and the rights you have.
      </p>,
    ],
  },
  {
    heading: "Data we collect",
    body: [
      <p key="1">
        <strong className="text-slate-300">Account data</strong> — your name, email, phone
        number, country and the credentials you use to sign in.
      </p>,
      <p key="2">
        <strong className="text-slate-300">Identity and verification data</strong> —
        documents and information we are required to collect to verify your identity and meet
        anti-money-laundering obligations.
      </p>,
      <p key="3">
        <strong className="text-slate-300">Financial and trading data</strong> — deposits,
        withdrawals, allocations, positions and history generated as you use the platform.
      </p>,
      <p key="4">
        <strong className="text-slate-300">Technical data</strong> — device, browser and
        approximate location information collected automatically to keep your account secure.
      </p>,
    ],
  },
  {
    heading: "How we use your data",
    body: [
      <p key="1">
        We use your data to operate your account and execute copy-trading on your
        instructions, to verify your identity and prevent fraud, to comply with our legal
        and regulatory duties, to provide support, and — only where you have not opted out —
        to send you product updates.
      </p>,
    ],
  },
  {
    heading: "Legal bases",
    body: [
      <p key="1">
        We process your data to perform our contract with you, to comply with legal
        obligations, where we have a legitimate interest in running and securing the
        platform, and — for optional communications — with your consent, which you can
        withdraw at any time.
      </p>,
    ],
  },
  {
    heading: "Sharing your data",
    body: [
      <p key="1">
        We share data with payment and identity-verification providers who help us operate,
        with regulators and law-enforcement where legally required, and with technology
        suppliers who process data on our behalf under strict contractual controls. We do not
        sell your personal data.
      </p>,
    ],
  },
  {
    heading: "Security and retention",
    body: [
      <p key="1">
        We protect your data with encryption in transit and at rest, access controls and
        continuous monitoring. We keep personal data only for as long as your account is
        active and for any period we are legally required to retain it afterwards.
      </p>,
    ],
  },
  {
    heading: "Your rights",
    body: [
      <p key="1">
        Subject to applicable law, you may request access to your data, correction of
        inaccurate data, deletion, or a copy of your data in a portable format, and you may
        object to certain processing. To exercise any right, contact{" "}
        <a href={`mailto:${COMPANY.email.compliance}`} className="text-mint-400 hover:text-mint-300">
          {COMPANY.email.compliance}
        </a>
        .
      </p>,
    ],
  },
  {
    heading: "Cookies",
    body: [
      <p key="1">
        We use essential cookies to keep you signed in and the platform secure, and optional
        analytics cookies only where you allow them. You can control non-essential cookies
        through your browser or our cookie settings.
      </p>,
    ],
  },
  {
    heading: "Contact",
    body: [
      <p key="1">
        For any privacy question, email{" "}
        <a href={`mailto:${COMPANY.email.compliance}`} className="text-mint-400 hover:text-mint-300">
          {COMPANY.email.compliance}
        </a>{" "}
        or write to us at {COMPANY.address.line1}, {COMPANY.address.city},{" "}
        {COMPANY.address.country}.
      </p>,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Privacy Policy"
      lead="How we collect, use and protect your personal data — and the rights you have over it."
      updated="24 July 2026"
      sections={SECTIONS}
    />
  );
}
