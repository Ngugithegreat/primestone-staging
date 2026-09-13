import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupFlow } from "@/components/auth/SignupFlow";

export const metadata: Metadata = {
  title: "Open an account",
  description:
    "Open a PrimeStone account in under two minutes and get demo credit to start copying immediately.",
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupFlow />
    </Suspense>
  );
}
