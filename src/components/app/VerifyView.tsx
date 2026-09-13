"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Primitives";
import { KycFlow, KycStatusChip } from "./KycFlow";
import { useStore } from "@/lib/store";

const STEPS = [
  { n: 1, title: "Submit your details", body: "Enter your ID details and upload four documents." },
  { n: 2, title: "We review", body: "Our compliance team verifies your identity, usually within a few hours." },
  { n: 3, title: "Withdrawals unlock", body: "Once approved, you can withdraw to any supported method." },
];

export function VerifyView() {
  const status = useStore((s) => s.kyc.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[26px] font-bold text-white">Identity verification</h1>
            <KycStatusChip />
          </div>
          <p className="mt-1 text-[14px] text-slate-400">
            Verifying your identity keeps your account secure and is required before your
            first withdrawal.
          </p>
        </div>
        {status === "verified" && (
          <Link
            href="/wallet"
            className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-xl bg-mint-500 px-4 text-[13.5px] font-semibold text-ink-950 hover:bg-mint-400"
          >
            Go to wallet
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {status !== "verified" && (
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <Card key={s.n} className="p-4">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-mint-500/12 text-[13px] font-bold text-mint-400">
                {s.n}
              </div>
              <p className="mt-3 text-[13.5px] font-semibold text-white">{s.title}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-slate-400">{s.body}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2 border-b border-white/[0.06] pb-4">
          <ShieldCheck className="h-4.5 w-4.5 text-mint-400" />
          <h2 className="text-[15px] font-semibold text-white">Know Your Customer (KYC)</h2>
        </div>
        <KycFlow />
      </Card>
    </div>
  );
}
