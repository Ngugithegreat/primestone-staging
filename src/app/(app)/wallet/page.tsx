import type { Metadata } from "next";
import { WalletRouter } from "@/components/app/WalletRouter";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Deposit with M-Pesa, crypto or card, and withdraw your balance.",
};

export default function WalletPage() {
  return <WalletRouter />;
}
