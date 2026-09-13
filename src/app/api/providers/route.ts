import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { listProviders } from "@/server/providers";

/** Real, allocatable signal providers (owner-managed). */
export async function GET() {
  const providers = await listProviders(getDb(), { activeOnly: true });
  return NextResponse.json({
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name,
      handle: p.handle,
      strategy: p.strategy,
      bio: p.bio,
      country: p.country,
      roi12m: p.roi12m,
      winRate: p.winRate,
      maxDrawdown: p.maxDrawdown,
      feeBps: p.feeBps,
      minInvestmentMinor: p.minInvestment,
      verified: p.verified,
    })),
  });
}
