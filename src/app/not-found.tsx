import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { SiteBackground } from "@/components/landing/SiteBackground";

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5">
      <SiteBackground />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,223,164,0.12), transparent 60%)",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 grid-lines opacity-60" aria-hidden="true" />

      <div className="relative text-center">
        <LogoMark className="mx-auto h-12 w-12" />
        <p className="mt-8 font-display text-[76px] font-bold leading-none text-white/[0.12]">
          404
        </p>
        <h1 className="mt-2 font-display text-[28px] font-bold text-white">
          This page closed at a loss
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-slate-400">
          The link you followed does not point anywhere on PrimeStone. It may have moved, or
          the strategy provider may no longer be listed.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/dashboard" variant="secondary">
            Go to my dashboard
          </ButtonLink>
        </div>
        <p className="mt-8 text-[13px] text-slate-500">
          Looking for a provider?{" "}
          <Link href="/traders" className="text-mint-400 hover:text-mint-300">
            Browse the leaderboard
          </Link>
        </p>
      </div>
    </main>
  );
}
