"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { useState } from "react";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { apiForgotPassword } from "@/lib/authClient";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(undefined);
    await apiForgotPassword(email.trim().toLowerCase());
    setBusy(false);
    setSent(true);
  };

  return (
    <AuthLayout
      title={sent ? "Check your email" : "Forgot your password?"}
      subtitle={
        sent
          ? "If an account exists for that address, we've sent a link to reset your password."
          : "Enter your account email and we'll send you a link to reset your password."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-mint-400 hover:text-mint-300">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="grid place-items-center rounded-xl border border-mint-500/25 bg-mint-500/[0.06] px-6 py-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-mint-500/30 bg-mint-500/15">
            <CheckCircle2 className="h-6 w-6 text-mint-400" />
          </div>
          <p className="mt-4 text-[14px] font-semibold text-white">Reset link sent</p>
          <p className="mt-1.5 max-w-sm text-[13px] text-slate-400">
            Open the email and follow the link. It expires in 60 minutes. Check your spam
            folder if you don't see it.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-mint-400 hover:text-mint-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email address" htmlFor="email" error={error}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(undefined);
                }}
                placeholder="you@example.com"
                className="pl-10"
                autoComplete="email"
                autoFocus
              />
            </div>
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
