import "server-only";
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { sessions, users, type UserRow } from "@/db/schema";
import { ensureClientCashAccount } from "./ledger";

const scrypt = promisify(_scrypt);

/* -------------------------------------------------------------------------- */
/*  Password hashing (Node scrypt — no native deps, runs anywhere)             */
/* -------------------------------------------------------------------------- */

const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;
  // Constant-time comparison so a timing side-channel can't leak the hash.
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

/* -------------------------------------------------------------------------- */
/*  Sessions                                                                   */
/* -------------------------------------------------------------------------- */

export const SESSION_COOKIE = "ps_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type PublicUser = Omit<UserRow, "passwordHash">;

function toPublic(row: UserRow): PublicUser {
  const { passwordHash: _omit, ...rest } = row;
  return rest;
}

/**
 * Create a session and return the raw token to set in an httpOnly cookie.
 * Only the token's hash is stored, so a database leak cannot be replayed.
 */
export async function createSession(
  db: Database,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    ipAddress: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return { token, expiresAt };
}

export async function resolveSession(
  db: Database,
  token: string | undefined,
): Promise<PublicUser | null> {
  if (!token) return null;
  const rows = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  return row ? toPublic(row.users) : null;
}

export async function destroySession(db: Database, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/* -------------------------------------------------------------------------- */
/*  Register / login                                                           */
/* -------------------------------------------------------------------------- */

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).default(""),
  phone: z.string().max(40).default(""),
  country: z.string().max(80).default(""),
  accountType: z.enum(["standard", "ecn", "pro", "swap-free"]).default("standard"),
  leverage: z.number().int().min(1).max(500).default(500),
});

export type RegisterInput = z.input<typeof registerSchema>;

export async function register(
  db: Database,
  input: RegisterInput,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const data = parsed.data;
  const email = data.email.trim().toLowerCase();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return { ok: false, error: "An account with this email already exists." };

  const passwordHash = await hashPassword(data.password);

  const [row] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone.trim(),
      country: data.country.trim(),
      accountType: data.accountType,
      leverage: data.leverage,
    })
    .returning();

  // Every client gets a cash ledger account from the moment they register.
  await ensureClientCashAccount(db, row!.id);

  return { ok: true, user: toPublic(row!) };
}

export async function login(
  db: Database,
  email: string,
  password: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  const user = rows[0];

  // Verify against a dummy hash even when the user is missing, so response
  // time doesn't reveal whether an email is registered.
  const stored = user?.passwordHash ?? "scrypt$00$00";
  const valid = await verifyPassword(password, stored);
  if (!user || !valid) return { ok: false, error: "Incorrect email or password." };

  return { ok: true, user: toPublic(user) };
}
