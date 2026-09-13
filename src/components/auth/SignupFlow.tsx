"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, PartyPopper, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { COUNTRIES } from "@/lib/countries";
import { Badge } from "@/components/ui/Primitives";
import { ACCOUNT_TYPES, LEVERAGE_OPTIONS, type AccountTypeId } from "@/lib/accounts";
import { useStore } from "@/lib/store";
import { apiRegister } from "@/lib/authClient";
import { cn } from "@/lib/utils";


const EXPERIENCE = [
  { value: "new", label: "New to trading", hint: "Never placed a trade" },
  { value: "some", label: "Some experience", hint: "Under 2 years" },
  { value: "experienced", label: "Experienced", hint: "2+ years live" },
];

const STEPS = ["Your details", "Account type", "Preferences", "Done"];

type Errors = Partial<Record<string, string>>;

export function SignupFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const signInReal = useStore((s) => s.signInReal);
  const pushToast = useStore((s) => s.pushToast);

  const presetAccount = params.get("account") as AccountTypeId | null;
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "Kenya",
    password: "",
    accountType: (presetAccount &&
    ACCOUNT_TYPES.some((a) => a.id === presetAccount)
      ? presetAccount
      : "standard") as AccountTypeId,
    leverage: 500,
    experience: "some",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Switching account type can invalidate the chosen leverage; pull it back
      // to the new ceiling so the preferences step never shows nothing selected.
      if (key === "accountType") {
        const max = ACCOUNT_TYPES.find((a) => a.id === value)?.maxLeverage ?? 500;
        next.leverage = Math.min(next.leverage, max);
      }
      return next;
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const selectedAccount = useMemo(
    () => ACCOUNT_TYPES.find((a) => a.id === form.accountType)!,
    [form.accountType],
  );

  const validateDetails = () => {
    const e: Errors = {};
    if (form.firstName.trim().length < 2) e.firstName = "Enter your first name.";
    if (form.lastName.trim().length < 2) e.lastName = "Enter your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) e.email = "Enter a valid email address.";
    if (form.phone.replace(/\D/g, "").length < 9) e.phone = "Enter a valid phone number.";
    if (form.password.length < 8) e.password = "Use at least 8 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = async () => {
    if (step === 0 && !validateDetails()) return;

    if (step === 2) {
      // Create the real account in the backend before advancing.
      setSubmitting(true);
      const leverage = Math.min(form.leverage, selectedAccount.maxLeverage);
      const result = await apiRegister({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        country: form.country,
        accountType: form.accountType,
        leverage,
      });
      setSubmitting(false);

      if (!result.ok) {
        // Surface the server error on the details step (usually a taken email).
        setStep(0);
        setErrors({ email: result.error });
        return;
      }

      signInReal({
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        phone: result.user.phone,
        country: result.user.country,
        accountType: (result.user.accountType as AccountTypeId) ?? form.accountType,
        leverage: result.user.leverage,
        kycVerified: result.user.kycStatusCache === "verified",
      });
      pushToast({
        tone: "success",
        title: "Account created",
        body: "Your account is live. Verify your identity to enable withdrawals.",
      });
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const copy = [
    {
      title: "Open your account",
      subtitle: "Two minutes, no card, and demo credit waiting at the end of it.",
    },
    {
      title: "Choose your account type",
      subtitle: "Every type gets the full platform. The difference is how you pay for execution.",
    },
    {
      title: "Set your trading preferences",
      subtitle: "These are defaults — you can change any of them later from settings.",
    },
    {
      title: "You are in",
      subtitle: "Your demo desk is funded and the leaderboard is waiting.",
    },
  ][step]!;

  return (
    <AuthLayout
      title={copy.title}
      subtitle={copy.subtitle}
      wide={step === 1}
      footer={
        step < 3 ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-mint-400 hover:text-mint-300">
              Sign in
            </Link>
          </>
        ) : null
      }
    >
      <Stepper step={step} />

      <div className="mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -22 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 0 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" error={errors.firstName} htmlFor="firstName">
                    <Input
                      id="firstName"
                      value={form.firstName}
                      onChange={(e) => set("firstName", e.target.value)}
                      placeholder="Amara"
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field label="Last name" error={errors.lastName} htmlFor="lastName">
                    <Input
                      id="lastName"
                      value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                      placeholder="Okafor"
                      autoComplete="family-name"
                    />
                  </Field>
                </div>

                <Field label="Email address" error={errors.email} htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
                  <Field label="Country" htmlFor="country">
                    <Select
                      id="country"
                      value={form.country}
                      onChange={(e) => set("country", e.target.value)}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Phone number" error={errors.phone} htmlFor="phone">
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="+254 7XX XXX XXX"
                      autoComplete="tel"
                    />
                  </Field>
                </div>

                <Field
                  label="Password"
                  error={errors.password}
                  hint="8+ characters"
                  htmlFor="password"
                >
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </Field>

                <p className="text-[12px] leading-relaxed text-slate-500">
                  By continuing you agree to the{" "}
                  <Link href="/legal/terms" className="text-mint-400 hover:text-mint-300">
                    Terms of Service
                  </Link>{" "}
                  and the{" "}
                  <Link href="/legal/privacy" className="text-mint-400 hover:text-mint-300">
                    Privacy Policy
                  </Link>
                  , and confirm you have read and understood the{" "}
                  <Link href="/legal/risk-disclosure" className="text-mint-400 hover:text-mint-300">
                    Risk Disclosure
                  </Link>
                  .
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {ACCOUNT_TYPES.map((a) => {
                  const active = form.accountType === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => set("accountType", a.id)}
                      className={cn(
                        "focus-ring relative rounded-2xl border p-5 text-left transition-all duration-250",
                        active
                          ? "border-mint-500/50 bg-mint-500/[0.07] shadow-[0_0_0_1px_rgba(0,223,164,0.25)]"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className="h-1 w-10 rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${a.accent[0]}, ${a.accent[1]})`,
                          }}
                        />
                        <span
                          className={cn(
                            "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all",
                            active
                              ? "border-mint-500 bg-mint-500"
                              : "border-white/20 bg-transparent",
                          )}
                        >
                          {active && <Check className="h-3 w-3 text-ink-950" strokeWidth={3} />}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <h3 className="font-display text-[18px] font-bold text-white">
                          {a.name}
                        </h3>
                        {a.popular && <Badge tone="mint">Popular</Badge>}
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-snug text-slate-400">
                        {a.bestFor}
                      </p>

                      <dl className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3 text-[12px]">
                        <Row label="Spread" value={a.spreadLabel} />
                        <Row label="Commission" value={a.commissionLabel} />
                        <Row label="Min deposit" value={`$${a.minDeposit.toLocaleString()}`} />
                        <Row label="Max leverage" value={`1:${a.maxLeverage}`} />
                        <Row
                          label="Demo credit"
                          value={`$${a.demoCredit.toLocaleString()}`}
                          highlight
                        />
                      </dl>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <Field
                  label="Leverage"
                  hint={`Max 1:${selectedAccount.maxLeverage} on ${selectedAccount.name}`}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {LEVERAGE_OPTIONS.map((l) => {
                      const disabled = l > selectedAccount.maxLeverage;
                      return (
                        <button
                          key={l}
                          type="button"
                          disabled={disabled}
                          onClick={() => set("leverage", l)}
                          className={cn(
                            "focus-ring rounded-xl border py-2.5 text-[13.5px] font-medium transition-all",
                            disabled
                              ? "cursor-not-allowed border-white/[0.05] text-slate-600"
                              : form.leverage === l
                                ? "border-mint-500/50 bg-mint-500/10 text-mint-300"
                                : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]",
                          )}
                        >
                          1:{l}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Trading experience">
                  <div className="space-y-2">
                    {EXPERIENCE.map((x) => (
                      <button
                        key={x.value}
                        type="button"
                        onClick={() => set("experience", x.value)}
                        className={cn(
                          "focus-ring flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                          form.experience === x.value
                            ? "border-mint-500/50 bg-mint-500/[0.07]"
                            : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
                        )}
                      >
                        <span>
                          <span className="block text-[14px] font-medium text-white">
                            {x.label}
                          </span>
                          <span className="text-[12px] text-slate-500">{x.hint}</span>
                        </span>
                        <span
                          className={cn(
                            "grid h-5 w-5 place-items-center rounded-full border",
                            form.experience === x.value
                              ? "border-mint-500 bg-mint-500"
                              : "border-white/20",
                          )}
                        >
                          {form.experience === x.value && (
                            <Check className="h-3 w-3 text-ink-950" strokeWidth={3} />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="rounded-xl border border-mint-500/25 bg-mint-500/[0.07] p-4">
                  <div className="flex items-center gap-2 text-mint-300">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-[13px] font-semibold">
                      ${selectedAccount.demoCredit.toLocaleString()} demo credit included
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">
                    It lands in your wallet the moment the account opens. Copy real
                    providers and place real orders against live prices with none of your
                    own money at risk.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-mint-500/30 bg-mint-500/10"
                >
                  <PartyPopper className="h-9 w-9 text-mint-400" />
                </motion.div>

                <div className="mt-7 grid gap-2.5 text-left">
                  {[
                    ["Account type", selectedAccount.name],
                    ["Leverage", `1:${Math.min(form.leverage, selectedAccount.maxLeverage)}`],
                    ["Demo credit", `$${selectedAccount.demoCredit.toLocaleString()}`],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                    >
                      <span className="text-[13px] text-slate-400">{k}</span>
                      <span className="text-[13.5px] font-semibold text-white">{v}</span>
                    </div>
                  ))}
                </div>

                <Button
                  size="lg"
                  className="mt-7 w-full"
                  onClick={() => router.push("/dashboard")}
                >
                  Go to my dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {step < 3 && (
          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <Button variant="secondary" onClick={back} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button onClick={next} className="flex-1" disabled={submitting}>
              {submitting
                ? "Creating your account…"
                : step === 2
                  ? "Create my account"
                  : "Continue"}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 flex-col gap-2">
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-mint-500 to-mint-300"
              initial={false}
              animate={{ width: i <= step ? "100%" : "0%" }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span
            className={cn(
              "hidden text-[11.5px] font-medium transition-colors sm:block",
              i <= step ? "text-mint-300" : "text-slate-600",
            )}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn("font-medium", highlight ? "text-mint-400" : "text-slate-200")}>
        {value}
      </dd>
    </div>
  );
}
