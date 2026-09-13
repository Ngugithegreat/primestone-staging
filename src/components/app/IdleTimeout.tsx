"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { apiLogout } from "@/lib/authClient";

/**
 * Security: sign the user out after a period of inactivity, so an unattended
 * session on a shared device can't be picked up. Any real interaction resets
 * the timer. Configurable via NEXT_PUBLIC_IDLE_MINUTES (default 20).
 */
const IDLE_MS = Math.max(1, Number(process.env.NEXT_PUBLIC_IDLE_MINUTES) || 20) * 60_000;

const EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click", "mousemove"] as const;

export function IdleTimeout() {
  const router = useRouter();
  const signOut = useStore((s) => s.signOut);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const logout = () => {
      void apiLogout();
      signOut();
      router.replace("/login");
    };
    const reset = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(logout, IDLE_MS);
    };
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [router, signOut]);

  return null;
}
