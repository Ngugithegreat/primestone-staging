import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Admin console authentication.
 *
 * The password lives ONLY in the ADMIN_PASSWORD environment variable — there is
 * no demo/default. Login is protected by Cloudflare Turnstile (the "verify you
 * are human" check) when TURNSTILE_SECRET_KEY is configured. On success we set
 * an httpOnly cookie whose value is an HMAC of the password, so it cannot be
 * forged without knowing the password and is never the password itself.
 */

const COOKIE = "ps_admin";
const MAX_AGE = 60 * 60 * 8; // 8 hours

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function expectedToken(): string {
  const secret = process.env.ADMIN_PASSWORD ?? "";
  return createHmac("sha256", secret).update("primestone-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Check the submitted password against ADMIN_PASSWORD, constant-time. */
export function checkAdminPassword(password: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  return safeEqual(password, real);
}

/** Verify a Cloudflare Turnstile token. Skips (returns true) if not configured. */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Turnstile not set up yet — don't block login.
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function setAdminCookie() {
  const jar = await cookies();
  jar.set(COOKIE, expectedToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAdminAuthed(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  return Boolean(value) && safeEqual(value!, expectedToken());
}
