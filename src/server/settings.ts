import "server-only";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditLog } from "@/db/schema";

/**
 * Lightweight runtime settings, stored as the latest audit-log entry for a key
 * (so there's no extra table/migration — it works the moment it deploys, and
 * keeps a full history of who changed what). Cached in-process for a few seconds.
 */

const RISK_KEY = "settings.risk_pct";
const DEFAULT_RISK_PCT = 6; // % of each copier's balance risked per trade
const TTL_MS = 8_000;

let cache: { pct: number; at: number } | null = null;
const now = () => Date.now();

/** Risk per trade as a PERCENT (e.g. 6 = 6% of the copier's allocation value). */
export async function getRiskPct(db: Database): Promise<number> {
  if (cache && now() - cache.at < TTL_MS) return cache.pct;
  try {
    const [row] = await db
      .select({ metadata: auditLog.metadata })
      .from(auditLog)
      .where(eq(auditLog.action, RISK_KEY))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    const raw = (row?.metadata as { pct?: unknown } | null)?.pct;
    const pct = typeof raw === "number" && raw > 0 ? raw : DEFAULT_RISK_PCT;
    cache = { pct, at: now() };
    return pct;
  } catch {
    return DEFAULT_RISK_PCT;
  }
}

export async function setRiskPct(
  db: Database,
  pct: number,
  actorId?: string | null,
): Promise<number> {
  const clamped = Math.max(0.5, Math.min(60, pct));
  await db.insert(auditLog).values({
    actorId: actorId ?? null,
    action: RISK_KEY,
    targetType: "settings",
    metadata: { pct: clamped },
  });
  cache = { pct: clamped, at: now() };
  return clamped;
}

export { DEFAULT_RISK_PCT };

/* -------------------------------------------------------------------------- */
/*  Auto-blow (testing) — blow each account N days after it starts copying     */
/* -------------------------------------------------------------------------- */

const AUTO_BLOW_KEY = "settings.auto_blow_days";

/** Days after a copier starts before their account auto-blows. 0 = off. */
export async function getAutoBlowDays(db: Database): Promise<number> {
  try {
    const [row] = await db
      .select({ metadata: auditLog.metadata })
      .from(auditLog)
      .where(eq(auditLog.action, AUTO_BLOW_KEY))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    const raw = (row?.metadata as { days?: unknown } | null)?.days;
    return typeof raw === "number" && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

export async function setAutoBlowDays(
  db: Database,
  days: number,
  actorId?: string | null,
): Promise<number> {
  // 0 = off. Fractional days allowed (e.g. 0.02 ≈ 30 min) for fast testing.
  const clamped = days > 0 ? Math.min(365, days) : 0;
  await db.insert(auditLog).values({
    actorId: actorId ?? null,
    action: AUTO_BLOW_KEY,
    targetType: "settings",
    metadata: { days: clamped },
  });
  return clamped;
}

/* -------------------------------------------------------------------------- */
/*  Scheduled blow (testing) — blow accounts at a future time                  */
/* -------------------------------------------------------------------------- */

const BLOW_KEY = "settings.blow_schedule";

export type BlowSchedule = { at: number; email: string | null };

/** The pending scheduled blow, or null if none is due/set. */
export async function getBlowSchedule(db: Database): Promise<BlowSchedule | null> {
  try {
    const [row] = await db
      .select({ metadata: auditLog.metadata })
      .from(auditLog)
      .where(eq(auditLog.action, BLOW_KEY))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    const m = row?.metadata as { at?: unknown; email?: unknown } | null;
    const at = typeof m?.at === "number" ? m.at : 0;
    if (at <= 0) return null;
    return { at, email: typeof m?.email === "string" ? m.email : null };
  } catch {
    return null;
  }
}

export async function setBlowSchedule(
  db: Database,
  atMs: number,
  email: string | null,
  actorId?: string | null,
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: actorId ?? null,
    action: BLOW_KEY,
    targetType: "settings",
    metadata: { at: atMs, email },
  });
}

/** Clear the pending blow (records at: 0). */
export async function clearBlowSchedule(db: Database, actorId?: string | null): Promise<void> {
  await db.insert(auditLog).values({
    actorId: actorId ?? null,
    action: BLOW_KEY,
    targetType: "settings",
    metadata: { at: 0, email: null },
  });
}
