"use client";

import { motion } from "framer-motion";
import { KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Turnstile } from "./Turnstile";

/**
 * Server-backed admin gate. The password is verified server-side against the
 * ADMIN_PASSWORD env var, protected by Cloudflare Turnstile, and the session is
 * an httpOnly cookie. No password lives in the client bundle.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "authed">("checking");
  const [configured, setConfigured] = useState(true);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/session", { cache: "no-store" });
        const data = await res.json();
        setConfigured(data.configured);
        setSiteKey(data.turnstileSiteKey);
        setState(data.authed ? "authed" : "locked");
      } catch {
        setState("locked");
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, turnstileToken: token }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setState("authed");
    } else {
      setError(data.error ?? "Login failed.");
    }
  };

  if (state === "checking") {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-950">
        <LogoMark className="h-10 w-10 animate-pulse" />
      </div>
    );
  }

  if (state === "authed") return <>{children}</>;

  const requireHuman = Boolean(siteKey);
  const canSubmit = password.length > 0 && (!requireHuman || token.length > 0);

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink-950 px-5">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.14), transparent 60%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-sheen relative w-full max-w-sm rounded-2xl border border-white/[0.09] bg-ink-880/80 p-7 backdrop-blur-xl"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-iris-500/25 bg-iris-500/10">
            <ShieldCheck className="h-5 w-5 text-iris-300" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold text-white">Admin console</h1>
            <p className="text-[12.5px] text-slate-500">Authorised staff only</p>
          </div>
        </div>

        {!configured ? (
          <p className="mt-6 rounded-lg border border-amber-450/25 bg-amber-450/[0.07] p-3 text-[12.5px] leading-relaxed text-amber-200">
            Admin access is not configured yet. Set an{" "}
            <code className="rounded bg-white/10 px-1">ADMIN_PASSWORD</code> environment variable in
            Vercel and redeploy.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Admin password" htmlFor="pw" error={error}>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(undefined);
                  }}
                  placeholder="Enter admin password"
                  className="pl-10"
                  autoFocus
                />
              </div>
            </Field>

            <Turnstile siteKey={siteKey} onToken={setToken} />

            <Button type="submit" className="w-full" disabled={busy || !canSubmit}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Unlock console
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
