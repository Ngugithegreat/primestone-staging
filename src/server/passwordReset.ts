import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { hashPassword } from "./auth";

const TTL_MS = 60 * 60 * 1000; // 60 minutes

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a reset token for an email if it belongs to a user. Returns the raw
 * token + the user's name for the email. Returns null when there is no such
 * user — the caller should still respond success so email existence isn't
 * leaked.
 */
export async function createResetToken(
  db: Database,
  email: string,
): Promise<{ token: string; firstName: string } | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return { token, firstName: user.firstName };
}

/**
 * Consume a reset token and set the new password. Marks the token used and
 * invalidates all of the user's existing sessions.
 */
export async function resetPassword(
  db: Database,
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: "This reset link is invalid or has expired." };

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, row.userId));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, row.id));
    // Force re-login everywhere after a password change.
    await tx.delete(sessions).where(eq(sessions.userId, row.userId));
  });

  return { ok: true };
}
