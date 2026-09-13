/**
 * Seed the production/dev database with an owner account and a few signal
 * providers so you can log in and allocate immediately after provisioning.
 *
 *   1. Set DATABASE_URL (and run `npm run db:migrate` first).
 *   2. npm run db:seed
 *
 * Override the owner credentials with SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { getDb } from "../src/db/client";
import { register } from "../src/server/auth";
import { createProvider, listProviders } from "../src/server/providers";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Set it before seeding.");
    process.exit(1);
  }
  const db = getDb();

  // Owner creation is optional: only runs if you pass SEED_OWNER_PASSWORD.
  // Otherwise register yourself through the app and promote your account later.
  const password = process.env.SEED_OWNER_PASSWORD;
  if (password) {
    const email = (process.env.SEED_OWNER_EMAIL ?? "owner@primestone.com").toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) {
      console.log(`Owner ${email} already exists.`);
    } else {
      const reg = await register(db, { email, password, firstName: "Platform", lastName: "Owner" });
      if (!reg.ok) {
        console.error("Failed to create owner:", reg.error);
        process.exit(1);
      }
      await db.update(users).set({ role: "owner" }).where(eq(users.id, reg.user.id));
      console.log(`Owner created: ${email}.`);
    }
  } else {
    console.log("No SEED_OWNER_PASSWORD — skipping owner (register in-app and promote later).");
  }

  const providers = await listProviders(db);
  if (providers.length > 0) {
    console.log(`${providers.length} providers already present — skipping provider seed.`);
  } else {
    const sample = [
      { name: "Kwame Mwangi", strategy: "Swing · Trend Following", country: "Kenya", roi12m: 142.8, winRate: 71.2, maxDrawdown: 11.4, feeBps: 2200, minInvestment: 250, verified: true },
      { name: "Elena Fischer", strategy: "London Session Breakout", country: "Germany", roi12m: 98.6, winRate: 64.8, maxDrawdown: 8.2, feeBps: 2000, minInvestment: 500, verified: true },
      { name: "Raj Patel", strategy: "Statistical Arbitrage", country: "Singapore", roi12m: 61.4, winRate: 78.9, maxDrawdown: 5.1, feeBps: 2500, minInvestment: 1000, verified: true },
    ];
    for (const p of sample) {
      const res = await createProvider(db, p);
      console.log(res.ok ? `+ provider ${p.name}` : `! ${p.name}: ${res.error}`);
    }
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
