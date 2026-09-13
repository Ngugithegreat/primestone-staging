import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TraderProfile } from "@/components/traders/TraderProfile";
import { FEATURED_TRADERS, getTrader } from "@/lib/traders";

// Pre-render the curated providers at build time; the hundreds of generated
// ones render on first request and are then cached, so the build stays fast.
export const dynamicParams = true;

export function generateStaticParams() {
  return FEATURED_TRADERS.map((t) => ({ id: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const trader = getTrader(id);
  if (!trader) return { title: "Provider not found" };
  return {
    title: trader.name,
    description: `${trader.strategy} · ${trader.roi12m.toFixed(1)}% over 12 months with a ${trader.maxDrawdown.toFixed(1)}% maximum drawdown.`,
  };
}

export default async function TraderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trader = getTrader(id);
  if (!trader) notFound();

  return <TraderProfile traderId={id} />;
}
