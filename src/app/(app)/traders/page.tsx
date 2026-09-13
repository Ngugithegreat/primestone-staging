import type { Metadata } from "next";
import { TradersDirectory } from "@/components/traders/TradersDirectory";

export const metadata: Metadata = {
  title: "Copy traders",
  description: "Browse and filter verified strategy providers.",
};

export default function TradersPage() {
  return <TradersDirectory />;
}
