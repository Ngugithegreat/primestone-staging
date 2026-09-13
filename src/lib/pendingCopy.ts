"use client";

/**
 * "Copy-first" deposits. When a user picks a provider to copy but has no funds,
 * we remember that choice so the deposit they then make is auto-allocated to
 * that provider — no separate "now go and copy" step.
 *
 * Stored in localStorage (per-device, survives the redirect to the wallet).
 */

const KEY = "ps_pending_copy";

export type PendingCopy = { providerId: string; name: string };

export function setPendingCopy(providerId: string, name: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ providerId, name }));
  } catch {
    /* storage unavailable */
  }
}

export function getPendingCopy(): PendingCopy | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as PendingCopy;
    return v && typeof v.providerId === "string" ? v : null;
  } catch {
    return null;
  }
}

export function clearPendingCopy(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
