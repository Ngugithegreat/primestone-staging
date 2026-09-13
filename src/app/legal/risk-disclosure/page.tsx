import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/LegalDoc";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Risk Disclosure",
  description: `Important information about the risks of trading and copy-trading with ${COMPANY.name}.`,
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Trading involves substantial risk",
    body: [
      <p key="1">
        Trading leveraged products such as forex and contracts for difference (CFDs) carries
        a high level of risk and can result in the loss of all of your invested capital.
        These products may not be suitable for everyone. You should not trade with money you
        cannot afford to lose, and you should ensure you fully understand the risks involved.
      </p>,
    ],
  },
  {
    heading: "Leverage works both ways",
    body: [
      <p key="1">
        Leverage lets you control a position larger than your deposit. It magnifies profits
        and losses equally. A small move against a leveraged position can result in losses
        that exceed your initial margin for that position, and can lead to the rapid loss of
        your capital.
      </p>,
    ],
  },
  {
    heading: "Copy-trading does not remove risk",
    body: [
      <p key="1">
        Copying a strategy provider does not reduce or remove the risks above. When you copy
        a provider, their positions are opened in your account and you bear the full market
        risk of those positions. A provider can lose money, and so can you by copying them.
      </p>,
      <p key="2">
        You are responsible for choosing which providers to copy and for setting your own
        allocation, risk multiplier and copy stop-loss. We strongly recommend setting a copy
        stop-loss on every allocation.
      </p>,
    ],
  },
  {
    heading: "Past performance is not indicative of future results",
    body: [
      <p key="1">
        A provider&rsquo;s historical return, win rate or any other published statistic describes
        what has happened, not what will happen. Strategies that have performed well can and
        do experience losing periods, sometimes severe ones. No track record is a promise of
        future performance.
      </p>,
    ],
  },
  {
    heading: "Negative balance protection",
    body: [
      <p key="1">
        We provide negative balance protection: you cannot lose more than the funds in your
        account. Positions may be closed automatically if your margin level falls too low, in
        order to protect you from a negative balance.
      </p>,
    ],
  },
  {
    heading: "No investment advice",
    body: [
      <p key="1">
        {COMPANY.name} does not provide investment, tax or legal advice. Nothing on the
        platform is a personal recommendation to trade or to copy any particular provider.
        If you are unsure whether trading is appropriate for you, seek independent advice
        from a licensed professional.
      </p>,
    ],
  },
  {
    heading: "Acknowledgement",
    body: [
      <p key="1">
        By opening an account you confirm that you have read and understood this Risk
        Disclosure, that you accept the risks described, and that you are trading on your own
        judgement and at your own risk. Questions can be directed to{" "}
        <a href={`mailto:${COMPANY.email.support}`} className="text-mint-400 hover:text-mint-300">
          {COMPANY.email.support}
        </a>
        .
      </p>,
    ],
  },
];

export default function RiskDisclosurePage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Risk Disclosure"
      lead="Please read this carefully before you fund an account. It explains the risks of trading and copy-trading."
      updated="24 July 2026"
      sections={SECTIONS}
    />
  );
}
