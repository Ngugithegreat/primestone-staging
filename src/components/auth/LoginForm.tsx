"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useStore } from "@/lib/store";
import { apiLogin } from "@/lib/authClient";
import type { AccountTypeId } from "@/lib/accounts";

export function LoginForm() {
  const router = useRouter();
  const signInReal = useStore((s) => s.signInReal);
  const pushToast = useStore((s) => s.pushToast);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // The login page always shows the form and requires credentials — we never
  // auto-forward to the dashboard on an existing cookie. Signing in is an
  // explicit action.

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Enter your password.");
      return;
    }
    if (twoFactor && !code.trim()) {
      setError("Enter your authentication code.");
      return;
    }

    setBusy(true);
    setError(undefined);
    const result = await apiLogin(
      email.trim().toLowerCase(),
      password,
      twoFactor ? code.replace(/\s/g, "") : undefined,
    );
    if (!result.ok && result.twoFactorRequired) {
      // Reveal the code step (and surface any "wrong code" message on retry).
      setBusy(false);
      setTwoFactor(true);
      setError(result.error);
      return;
    }
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    signInReal({
      id: result.user.id,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      phone: result.user.phone,
      country: result.user.country,
      accountType: (result.user.accountType as AccountTypeId) ?? "standard",
      leverage: result.user.leverage,
      kycVerified: result.user.kycStatusCache === "verified",
    });
    pushToast({ tone: "success", title: "Welcome back", body: "Your desk is ready." });
    router.push("/dashboard");
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your desk to check your copies, positions and balance."
      footer={
        <>
          New to PrimeStone?{" "}
          <Link href="/signup" className="font-medium text-mint-400 hover:text-mint-300">
            Open a free account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email address" htmlFor="email" error={error}>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={
            <Link href="/forgot-password" className="text-mint-400 hover:text-mint-300">
              Forgot?
            </Link>
          }
        >
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>

        {twoFactor && (
          <Field
            label="Authentication code"
            htmlFor="code"
            hint="From your authenticator app"
          >
            <Input
              id="code"
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              autoComplete="one-time-code"
              className="text-center text-[17px] tracking-[0.3em]"
            />
          </Field>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : twoFactor ? "Verify & sign in" : "Sign in"}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </Button>

        <p className="pt-1 text-center text-[12px] leading-relaxed text-slate-500">
          Protected by 256-bit encryption. Enable two-factor authentication in settings
          for an extra layer of security on sign-in and withdrawals.
        </p>
      </form>
    </AuthLayout>
  );
}
