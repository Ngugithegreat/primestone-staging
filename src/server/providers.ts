import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { signalProviders } from "@/db/schema";
import { toMinor } from "./ledger";

/**
 * Signal providers are owner-managed: the platform owner supplies the real
 * providers clients can allocate to. (Their simulated trading activity can stay
 * as-is for now — this table is the real, allocatable list.)
 */

export const providerSchema = z.object({
  name: z.string().min(2).max(120),
  handle: z.string().max(60).default(""),
  strategy: z.string().max(120).default(""),
  bio: z.string().max(1000).default(""),
  country: z.string().max(80).default(""),
  roi12m: z.number().default(0),
  winRate: z.number().min(0).max(100).default(0),
  maxDrawdown: z.number().min(0).max(100).default(0),
  feeBps: z.number().int().min(0).max(10000).default(2000),
  minInvestment: z.number().min(0).default(0), // major units
  verified: z.boolean().default(false),
  active: z.boolean().default(true),
});

export type ProviderInput = z.input<typeof providerSchema>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createProvider(
  db: Database,
  input: ProviderInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = providerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid provider." };
  }
  const d = parsed.data;
  let slug = slugify(d.name) || `provider-${Date.now()}`;

  // Ensure the slug is unique.
  const clash = await db
    .select({ id: signalProviders.id })
    .from(signalProviders)
    .where(eq(signalProviders.slug, slug))
    .limit(1);
  if (clash[0]) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const [row] = await db
    .insert(signalProviders)
    .values({
      slug,
      name: d.name,
      handle: d.handle,
      strategy: d.strategy,
      bio: d.bio,
      country: d.country,
      roi12m: String(d.roi12m),
      winRate: String(d.winRate),
      maxDrawdown: String(d.maxDrawdown),
      feeBps: d.feeBps,
      minInvestment: toMinor(d.minInvestment),
      verified: d.verified,
      active: d.active,
    })
    .returning({ id: signalProviders.id });

  return { ok: true, id: row!.id };
}

export async function listProviders(db: Database, opts?: { activeOnly?: boolean }) {
  const rows = await db.select().from(signalProviders).orderBy(desc(signalProviders.createdAt));
  return opts?.activeOnly ? rows.filter((r) => r.active) : rows;
}

export async function setProviderActive(db: Database, id: string, active: boolean) {
  await db.update(signalProviders).set({ active }).where(eq(signalProviders.id, id));
}
