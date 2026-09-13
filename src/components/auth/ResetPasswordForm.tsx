"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { useState } from "react";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { apiResetPassword } from "@/lib/authClient";

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    setError(undefined);
    const res = await apiResetPassword(token, password);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDone(true);
  };

  if (!token) {
    return (
      <AuthLayout title="Invalid link" subtitle="This password reset link is missing or malformed.">
        <Link href="/forgot-password" className="font-medium text-mint-400 hover:text-mint-300">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={done ? "Password updated" : "Choose a new password"}
      subtitle={
        done
          ? "Your password has been changed. You can now sign in with it."
          : "Enter a new password for your account. You'll be signed out of other devices."
      }
      footer={
        <>
          <Link href="/login" className="font-medium text-mint-400 hover:text-mint-300">
            Back to sign in
          </Link>
        </>
      }
    >
      {done ? (
        <div className="grid place-items-center rounded-xl border border-mint-500/25 bg-mint-500/[0.06] px-6 py-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-mint-500/30 bg-mint-500/15">
            <CheckCircle2 className="h-6 w-6 text-mint-400" />
          </div>
          <p className="mt-4 text-[14px] font-semibold text-white">All set</p>
          <p className="mt-1.5 text-[13px] text-slate-400">Your password has been updated.</p>
          <Button size="lg" className="mt-5 w-full" onClick={() => router.push("/login")}>
            Sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" htmlFor="pw" hint="8+ characters" error={error}>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(undefined);
                }}
                placeholder="••••••••"
                className="pl-10"
                autoComplete="new-password"
                autoFocus
              />
            </div>
          </Field>
          <Field label="Confirm new password" htmlFor="pw2">
            <Input
              id="pw2"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
