import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditLog } from "@/db/schema";
import { verifyTotp } from "./totp";

/**
 * Per-user 2FA state, stored as the latest audit-log entry for the user (no
 * migration needed). Holds the TOTP secret, whether it's enabled, and hashed
 * one-time backup codes.
 */

type State = { secret: string | null; enabled: boolean; backupHashes: string[] };

function key(userId: string): string {
  return `security.2fa:${userId}`;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code.replace(/\s/g, "").toUpperCase()).digest("hex");
}

export async function get2FA(db: Database, userId: string): Promise<State> {
  try {
    const [row] = await db
      .select({ metadata: auditLog.metadata })
      .from(auditLog)
      .where(eq(auditLog.action, key(userId)))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    const m = row?.metadata as Partial<State> | null;
    return {
      secret: typeof m?.secret === "string" ? m.secret : null,
      enabled: m?.enabled === true,
      backupHashes: Array.isArray(m?.backupHashes) ? (m!.backupHashes as string[]) : [],
    };
  } catch {
    return { secret: null, enabled: false, backupHashes: [] };
  }
}

async function set2FA(db: Database, userId: string, state: State): Promise<void> {
  await db.insert(auditLog).values({
    actorId: userId,
    action: key(userId),
    targetType: "settings",
    metadata: state,
  });
}

export async function is2FAEnabled(db: Database, userId: string): Promise<boolean> {
  return (await get2FA(db, userId)).enabled;
}

/** Store a fresh (not-yet-enabled) secret for setup. */
export async function begin2FASetup(db: Database, userId: string, secret: string): Promise<void> {
  await set2FA(db, userId, { secret, enabled: false, backupHashes: [] });
}

/** Verify the setup code, enable 2FA, and return one-time backup codes. */
export async function enable2FA(
  db: Database,
  userId: string,
  code: string,
): Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }> {
  const state = await get2FA(db, userId);
  if (!state.secret) return { ok: false, error: "Start setup first." };
  if (!verifyTotp(state.secret, code)) return { ok: false, error: "That code isn't right — try again." };

  const backupCodes = Array.from({ length: 8 }, () =>
    randomBytes(5).toString("hex").toUpperCase().slice(0, 10),
  );
  await set2FA(db, userId, {
    secret: state.secret,
    enabled: true,
    backupHashes: backupCodes.map(hashCode),
  });
  return { ok: true, backupCodes };
}

/**
 * Verify a login/withdrawal code against a user's TOTP or an unused backup code.
 * A used backup code is consumed. Returns false if 2FA isn't enabled with a code.
 */
export async function verify2FA(db: Database, userId: string, code: string): Promise<boolean> {
  const state = await get2FA(db, userId);
  if (!state.enabled || !state.secret) return false;
  if (verifyTotp(state.secret, code)) return true;

  const h = hashCode(code);
  if (state.backupHashes.includes(h)) {
    await set2FA(db, userId, {
      secret: state.secret,
      enabled: true,
      backupHashes: state.backupHashes.filter((x) => x !== h),
    });
    return true;
  }
  return false;
}

/** Turn 2FA off after verifying a current code. */
export async function disable2FA(
  db: Database,
  userId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await verify2FA(db, userId, code))) {
    return { ok: false, error: "That code isn't right." };
  }
  await set2FA(db, userId, { secret: null, enabled: false, backupHashes: [] });
  return { ok: true };
}
