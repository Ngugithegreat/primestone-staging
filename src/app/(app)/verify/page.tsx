import type { Metadata } from "next";
import { VerifyView } from "@/components/app/VerifyView";

export const metadata: Metadata = {
  title: "Verify identity",
  description: "Complete identity verification to enable withdrawals.",
};

export default function VerifyPage() {
  return <VerifyView />;
}
