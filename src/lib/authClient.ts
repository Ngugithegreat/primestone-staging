"use client";

import type { AccountTypeId } from "./accounts";

/**
 * Thin client-side wrappers around the real auth API (`/api/auth/*`).
 * These hit the server, which persists to Postgres and manages the httpOnly
 * session cookie. The response never includes the password hash.
 */

export type ApiUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  accountType: string;
  leverage: number;
  role: "client" | "admin" | "owner";
  kycStatusCache: "unverified" | "pending" | "verified" | "rejected";
};

type Ok = { ok: true; user: ApiUser };
type Err = { ok: false; error: string };

async function post(path: string, body?: unknown): Promise<Ok | Err> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong." };
    return { ok: true, user: data.user };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export function apiRegister(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  accountType: AccountTypeId;
  leverage: number;
}) {
  return post("/api/auth/register", input);
}

export type LoginResult =
  | { ok: true; user: ApiUser }
  | { ok: false; twoFactorRequired: true; error?: string }
  | { ok: false; twoFactorRequired?: false; error: string };

/**
 * Sign in. When the account has 2FA on, the first call (no code) comes back with
 * `twoFactorRequired` and NO session — the caller collects the authenticator
 * code and calls again with it.
 */
export async function apiLogin(
  email: string,
  password: string,
  code?: string,
): Promise<LoginResult> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, code }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.twoFactorRequired) {
      return { ok: false, twoFactorRequired: true, error: data.error };
    }
    if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong." };
    return { ok: true, user: data.user };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function apiForgotPassword(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function apiResetPassword(
  token: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Could not reset password." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function apiLogout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

/* ---- Email verification -------------------------------------------------- */

export async function emailVerifyStatus(): Promise<{ verified: boolean }> {
  try {
    const res = await fetch("/api/auth/verify-email", { cache: "no-store" });
    if (!res.ok) return { verified: true }; // don't nag if we can't tell
    return await res.json();
  } catch {
    return { verified: true };
  }
}

export async function emailVerifySubmit(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "That code isn't right." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function emailVerifyResend(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/verify-email/resend", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Couldn't resend." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

/* ---- Two-factor authentication ------------------------------------------- */

export async function twoFactorStatus(): Promise<{ enabled: boolean }> {
  try {
    const res = await fetch("/api/auth/2fa", { cache: "no-store" });
    if (!res.ok) return { enabled: false };
    return await res.json();
  } catch {
    return { enabled: false };
  }
}

/** Begin setup — returns the QR data URL, otpauth URI and the raw secret. */
export async function twoFactorSetup(): Promise<
  { ok: true; qr: string; secret: string; otpauthUrl: string } | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/auth/2fa", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Could not start setup." };
    return { ok: true, qr: data.qr, secret: data.secret, otpauthUrl: data.otpauthUrl };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

/** Confirm the setup code and switch 2FA on — returns one-time backup codes. */
export async function twoFactorEnable(
  code: string,
): Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/2fa/enable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "That code isn't right." };
    return { ok: true, backupCodes: data.backupCodes ?? [] };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

/** Turn 2FA off after verifying a current code (or backup code). */
export async function twoFactorDisable(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "That code isn't right." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

/**
 * Reads the current session. `ok:false` means the request itself failed
 * (network/server) — the caller should NOT treat that as "logged out", only a
 * successful `{ user: null }` means the server has no session.
 */
export async function apiMe(): Promise<{ ok: boolean; user: ApiUser | null }> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return { ok: false, user: null };
    const data = await res.json().catch(() => ({}));
    return { ok: true, user: data.user ?? null };
  } catch {
    return { ok: false, user: null };
  }
}
