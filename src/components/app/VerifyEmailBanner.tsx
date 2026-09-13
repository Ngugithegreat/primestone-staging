"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { emailVerifyResend, emailVerifyStatus, emailVerifySubmit } from "@/lib/authClient";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Non-blocking "verify your email" prompt. Shows only when the signed-in user's
 * email isn't verified yet; lets them enter the 6-digit code from the welcome
 * email (or resend it). Hides itself once verified.
 */
export function VerifyEmailBanner() {
  const email = useStore((s) => s.user?.email ?? "");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    emailVerifyStatus().then((s) => {
      if (alive) setShow(!s.verified);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!show) return null;

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from your email.");
    setBusy(true);
    setError(undefined);
    const res = await emailVerifySubmit(code.trim());
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setShow(false);
  };

  const resend = async () => {
    setResent(false);
    setError(undefined);
    const res = await emailVerifyResend();
    if (!res.ok) return setError(res.error);
    setResent(true);
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-450/25 bg-amber-450/[0.06] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-450/25 bg-amber-450/10">
          <MailCheck className="h-4.5 w-4.5 text-amber-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-white">Verify your email</p>
          <p className="truncate text-[12px] text-slate-400">
            {resent ? "A new code is on its way to " : "Enter the 6-digit code we sent to "}
            <span className="text-slate-300">{email}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(undefined);
            }}
            placeholder="123456"
            className={cn("w-28 text-center text-[15px] tracking-[0.25em]")}
            onKeyDown={(e) => e.key === "Enter" && verify()}
          />
          <Button size="sm" onClick={verify} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Verify
          </Button>
          <button
            onClick={resend}
            className="focus-ring rounded-lg px-2 py-1 text-[12.5px] font-medium text-amber-300 hover:text-amber-200"
          >
            Resend
          </button>
        </div>
      </div>
      {error && <p className="mt-2 pl-12 text-[12px] text-rose-400">{error}</p>}
    </div>
  );
}
