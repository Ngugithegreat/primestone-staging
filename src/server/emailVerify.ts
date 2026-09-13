import "server-only";
import { createHash, randomInt } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditLog } from "@/db/schema";

/**
 * Email verification via a 6-digit code, stored as the latest audit-log entry
 * for the user (no migration needed) — same pattern as 2FA. Holds a hash of the
 * current code, its expiry, and whether the email is verified.
 */

type State = { codeHash: string | null; expiresAt: number; verified: boolean };

const TTL_MS = 30 * 60 * 1000; // 30 minutes

function key(userId: string): string {
  return `email.verify:${userId}`;
}

function hash(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

async function get(db: Database, userId: string): Promise<State> {
  try {
    const [row] = await db
      .select({ metadata: auditLog.metadata })
      .from(auditLog)
      .where(eq(auditLog.action, key(userId)))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    const m = row?.metadata as Partial<State> | null;
    return {
      codeHash: typeof m?.codeHash === "string" ? m.codeHash : null,
      expiresAt: typeof m?.expiresAt === "number" ? m.expiresAt : 0,
      verified: m?.verified === true,
    };
  } catch {
    return { codeHash: null, expiresAt: 0, verified: false };
  }
}

async function set(db: Database, userId: string, state: State): Promise<void> {
  await db.insert(auditLog).values({
    actorId: userId,
    action: key(userId),
    targetType: "settings",
    metadata: state,
  });
}

export async function isEmailVerified(db: Database, userId: string): Promise<boolean> {
  return (await get(db, userId)).verified;
}

/** Mint a fresh 6-digit code, store its hash, and return the plaintext to email. */
export async function startEmailVerification(db: Database, userId: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await set(db, userId, { codeHash: hash(code), expiresAt: Date.now() + TTL_MS, verified: false });
  return code;
}

/** Check a submitted code; on success mark the email verified. */
export async function verifyEmailCode(
  db: Database,
  userId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = await get(db, userId);
  if (state.verified) return { ok: true };
  if (!state.codeHash) return { ok: false, error: "Request a new code." };
  if (Date.now() > state.expiresAt) return { ok: false, error: "That code has expired — request a new one." };
  if (!/^\d{6}$/.test(code.trim()) || hash(code) !== state.codeHash) {
    return { ok: false, error: "That code isn't right — check and try again." };
  }
  await set(db, userId, { codeHash: null, expiresAt: 0, verified: true });
  return { ok: true };
}
