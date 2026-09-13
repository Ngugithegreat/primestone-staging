/**
 * Add the "Flossin" signal provider (idempotent). Run once:
 *   NODE_OPTIONS=--conditions=react-server tsx scripts/add-flossin.ts
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { getDb } from "../src/db/client";
import { createProvider, listProviders } from "../src/server/providers";

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error("No database URL set.");
    process.exit(1);
  }
  const db = getDb();
  const existing = await listProviders(db);
  if (existing.some((p) => p.name.toLowerCase() === "flossin")) {
    console.log("Flossin already exists — nothing to do.");
    return;
  }
  const res = await createProvider(db, {
    name: "Flossin",
    handle: "flossin",
    strategy: "Momentum · Crypto & Indices",
    bio: "Nairobi-based momentum trader focused on high-liquidity crypto and index moves, with disciplined risk control.",
    country: "Kenya",
    roi12m: 128.5,
    winRate: 68.4,
    maxDrawdown: 12.7,
    feeBps: 2000,
    minInvestment: 100,
    verified: true,
    active: true,
  });
  console.log(res.ok ? `Added Flossin (id ${res.id}).` : `Failed: ${res.error}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
