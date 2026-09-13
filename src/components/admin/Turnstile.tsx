"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget ("verify you are human"). Renders only when a
 * site key is provided; otherwise nothing shows and login proceeds without it
 * (the server also skips verification until keys are configured).
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string | null;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !ref.current) return;

    const render = () => {
      if (!window.turnstile || !ref.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: "dark",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };

    if (window.turnstile) {
      render();
    } else if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      const t = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(t);
          render();
        }
      }, 200);
      return () => window.clearInterval(t);
    }
  }, [siteKey, onToken]);

  if (!siteKey) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}
