import type { Metadata } from "next";
import { PortfolioView } from "@/components/app/PortfolioView";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Open positions, trade history and performance analytics.",
};

export default function PortfolioPage() {
  return <PortfolioView />;
}
