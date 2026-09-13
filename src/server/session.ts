import "server-only";
import { cookies, headers } from "next/headers";
import { getDb } from "@/db/client";
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  resolveSession,
  type PublicUser,
} from "./auth";

/**
 * Server-side session helpers for route handlers and server components.
 * The raw session token lives only in an httpOnly cookie.
 */

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function startSession(userId: string) {
  const hdrs = await headers();
  const { token, expiresAt } = await createSession(getDb(), userId, {
    ip: hdrs.get("x-forwarded-for") ?? undefined,
    userAgent: hdrs.get("user-agent") ?? undefined,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await destroySession(getDb(), token);
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Reads and validates the session cookie. */
export async function currentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return resolveSession(getDb(), token);
}

/** Throws if not signed in — use to guard protected route handlers. */
export async function requireUser(): Promise<PublicUser> {
  const user = await currentUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

/** Throws unless the signed-in user is an admin or owner. */
export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "owner") {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}
