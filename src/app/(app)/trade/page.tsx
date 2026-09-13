import type { Metadata } from "next";
import { TradingDesk } from "@/components/trade/TradingDesk";

export const metadata: Metadata = {
  title: "Trading desk",
  description: "Live charts, order ticket and open positions.",
};

export default function TradePage() {
  return <TradingDesk />;
}
