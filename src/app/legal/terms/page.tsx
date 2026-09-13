import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/LegalDoc";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms governing your use of ${COMPANY.name} and its copy-trading services.`,
};

const SECTIONS: LegalSection[] = [
  {
    heading: "About these terms",
    body: [
      <p key="1">
        These Terms of Service (&ldquo;Terms&rdquo;) are a legal agreement between you and{" "}
        {COMPANY.name} (&ldquo;{COMPANY.shortName}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), a company regulated by the{" "}
        {COMPANY.regulator} under licence {COMPANY.licence}. By opening an account or using
        the platform you confirm that you have read, understood and agree to be bound by
        these Terms.
      </p>,
      <p key="2">
        If you do not agree with any part of these Terms, you must not use the platform.
        We may update these Terms from time to time; the version published on this page is
        the one in force.
      </p>,
    ],
  },
  {
    heading: "Eligibility",
    body: [
      <p key="1">
        You must be at least 18 years old and legally able to enter into a binding contract
        in your country of residence. You may not use the platform if doing so is prohibited
        by the laws that apply to you, or if you are resident in a jurisdiction we do not
        serve.
      </p>,
      <p key="2">
        You are responsible for keeping your login credentials confidential and for all
        activity that takes place under your account. Notify us immediately if you suspect
        unauthorised access.
      </p>,
    ],
  },
  {
    heading: "The copy-trading service",
    body: [
      <p key="1">
        {COMPANY.shortName} allows you to allocate funds to third-party strategy providers
        whose trades are then mirrored into your account, sized in proportion to your
        allocation. You retain full control: you set your allocation, your risk multiplier
        and any copy stop-loss, and you may pause, adjust or stop copying at any time.
      </p>,
      <p key="2">
        Strategy providers are independent traders, not our employees or agents. We verify
        and publish their track records but we do not guarantee their future performance.
        The decision to copy any provider is yours alone.
      </p>,
    ],
  },
  {
    heading: "Fees",
    body: [
      <p key="1">
        Strategy providers charge a performance fee, disclosed on their profile, taken from
        profit only and subject to a high-water mark. Account-level pricing (spreads and any
        commission) depends on your account type and is disclosed before you trade. We do
        not charge deposit or inactivity fees. Certain withdrawal methods carry a processing
        fee, shown to you before you confirm.
      </p>,
    ],
  },
  {
    heading: "Deposits, withdrawals and client money",
    body: [
      <p key="1">
        Client funds are held in segregated accounts, separate from our own money, in
        accordance with our regulatory obligations. Withdrawals are paid back to the method
        used to fund the account, up to the amount funded by that method, with any remainder
        paid to your verified bank account.
      </p>,
      <p key="2">
        We may apply holding periods and identity-verification requirements before releasing
        funds, as required by anti-money-laundering law.
      </p>,
    ],
  },
  {
    heading: "Risk",
    body: [
      <p key="1">
        Trading leveraged products carries a high level of risk and can result in the loss
        of all of your capital. Copying another trader does not remove this risk. Past
        performance is not a reliable indicator of future results. You should not trade with
        money you cannot afford to lose. Please read our Risk Disclosure in full.
      </p>,
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      <p key="1">
        You agree not to use the platform for any unlawful purpose, not to attempt to
        manipulate prices or the copy-trading engine, not to interfere with the platform&rsquo;s
        operation, and not to access it through automated means except via any API we
        expressly provide.
      </p>,
    ],
  },
  {
    heading: "Limitation of liability",
    body: [
      <p key="1">
        To the fullest extent permitted by law, {COMPANY.shortName} is not liable for
        trading losses, for the performance of any strategy provider, or for losses arising
        from events outside our reasonable control. Nothing in these Terms excludes any
        liability that cannot lawfully be excluded.
      </p>,
    ],
  },
  {
    heading: "Governing law",
    body: [
      <p key="1">
        These Terms are governed by the laws of {COMPANY.jurisdiction}, and the courts of{" "}
        {COMPANY.jurisdiction} have exclusive jurisdiction over any dispute arising from them.
      </p>,
    ],
  },
  {
    heading: "Contact",
    body: [
      <p key="1">
        Questions about these Terms can be sent to{" "}
        <a href={`mailto:${COMPANY.email.support}`} className="text-mint-400 hover:text-mint-300">
          {COMPANY.email.support}
        </a>{" "}
        or by post to {COMPANY.name}, {COMPANY.address.line1}, {COMPANY.address.line2},{" "}
        {COMPANY.address.city}, {COMPANY.address.country}.
      </p>,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Terms of Service"
      lead="The agreement that governs your use of PrimeStone and its copy-trading services."
      updated="24 July 2026"
      sections={SECTIONS}
    />
  );
}
