"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck, KeyRound, RotateCcw, ShieldCheck, Trash2, User } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Toggle } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Badge, Card, CardHeader } from "@/components/ui/Primitives";
import { TwoFactorCard } from "./TwoFactorCard";
import { ACCOUNT_TYPES, LEVERAGE_OPTIONS, getAccountType, type AccountTypeId } from "@/lib/accounts";
import { dateShort, money } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const balance = useStore((s) => s.balance);
  const updateUser = useStore((s) => s.updateUser);
  const resetDemo = useStore((s) => s.resetDemo);
  const signOut = useStore((s) => s.signOut);
  const pushToast = useStore((s) => s.pushToast);

  const [profile, setProfile] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    country: user?.country ?? "Kenya",
  });
  const [prefs, setPrefs] = useState({
    emailSignals: true,
    pushSignals: true,
    marketing: false,
    confirmOrders: true,
  });
  const [resetOpen, setResetOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  if (!user) return null;
  const acct = getAccountType(user.accountType);

  const saveProfile = () => {
    updateUser(profile);
    pushToast({ tone: "success", title: "Profile updated" });
  };

  const changeAccountType = (id: AccountTypeId) => {
    updateUser({
      accountType: id,
      leverage: Math.min(user.leverage, getAccountType(id).maxLeverage),
    });
    pushToast({
      tone: "success",
      title: `Switched to ${getAccountType(id).name}`,
      body: "New pricing applies to orders placed from now on.",
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-tight text-white">Settings</h1>
        <p className="mt-1 text-[14px] text-slate-400">
          Member since {dateShort(user.createdAt)} · {money(balance)} available
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          {/* ---- Profile --------------------------------------------------- */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Profile"
              subtitle="How we identify you and where we send confirmations"
              action={<User className="h-4 w-4 text-slate-500" />}
            />
            <div className="space-y-4 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  />
                </Field>
                <Field label="Last name">
                  <Input
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Email address">
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone number">
                  <Input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+254 7XX XXX XXX"
                  />
                </Field>
                <Field label="Country">
                  <Select
                    value={profile.country}
                    onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                  >
                    {[
                      "Kenya", "Nigeria", "South Africa", "Ghana", "Tanzania",
                      "United Kingdom", "Germany", "United Arab Emirates",
                      "India", "Singapore", "Brazil", "Canada", "Australia",
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button onClick={saveProfile}>Save changes</Button>
            </div>
          </Card>

          {/* ---- Account type ---------------------------------------------- */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Account type"
              subtitle="Changing type re-prices execution on new orders only"
            />
            <div className="grid gap-2.5 p-4 sm:grid-cols-2">
              {ACCOUNT_TYPES.map((a) => {
                const active = user.accountType === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => changeAccountType(a.id)}
                    className={cn(
                      "focus-ring rounded-xl border p-4 text-left transition-all duration-200",
                      active
                        ? "border-mint-500/45 bg-mint-500/[0.07]"
                        : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-[16px] font-bold text-white">
                        {a.name}
                      </span>
                      {active && <Badge tone="mint">Current</Badge>}
                    </div>
                    <p className="mt-1 text-[12px] text-slate-400">{a.spreadLabel}</p>
                    <p className="text-[12px] text-slate-500">{a.commissionLabel}</p>
                    <p className="mt-2 text-[11.5px] text-slate-500">
                      Max leverage 1:{a.maxLeverage}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* ---- Trading --------------------------------------------------- */}
          <Card className="overflow-hidden">
            <CardHeader title="Trading" subtitle="Leverage and order defaults" />
            <div className="space-y-4 p-4">
              <Field label="Leverage" hint={`Max 1:${acct.maxLeverage} on ${acct.name}`}>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {LEVERAGE_OPTIONS.map((l) => {
                    const disabled = l > acct.maxLeverage;
                    return (
                      <button
                        key={l}
                        disabled={disabled}
                        onClick={() => {
                          updateUser({ leverage: l });
                          pushToast({ tone: "info", title: `Leverage set to 1:${l}` });
                        }}
                        className={cn(
                          "focus-ring rounded-lg border py-2 text-[12.5px] font-medium transition-all",
                          disabled
                            ? "cursor-not-allowed border-white/[0.05] text-slate-600"
                            : user.leverage === l
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

              <p className="rounded-lg border border-amber-450/25 bg-amber-450/[0.07] p-3 text-[12px] leading-relaxed text-amber-450">
                Higher leverage does not increase your profit potential — it reduces the
                margin each position ties up, which makes it easier to over-size. Most
                copiers should sit at 1:100 or below.
              </p>

              <Toggle
                checked={prefs.confirmOrders}
                onChange={(v) => setPrefs({ ...prefs, confirmOrders: v })}
                label="Confirm before placing an order"
                description="Show a summary dialog for every manual order. Copied signals are never held for confirmation."
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {/* ---- Verification ---------------------------------------------- */}
          <Card className="overflow-hidden">
            <CardHeader title="Identity verification" />
            <div className="p-4">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-xl border",
                    user.kycVerified
                      ? "border-mint-500/25 bg-mint-500/10"
                      : "border-amber-450/25 bg-amber-450/10",
                  )}
                >
                  <BadgeCheck
                    className={cn(
                      "h-5 w-5",
                      user.kycVerified ? "text-mint-400" : "text-amber-450",
                    )}
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white">
                    {user.kycVerified ? "Verified" : "Not verified"}
                  </p>
                  <p className="text-[12.5px] text-slate-400">
                    {user.kycVerified
                      ? "Full withdrawal limits are active."
                      : "Verify to lift withdrawal limits above $2,000 per day."}
                  </p>
                </div>
              </div>
              {!user.kycVerified && (
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => {
                    updateUser({ kycVerified: true });
                    pushToast({
                      tone: "success",
                      title: "Identity verified",
                      body: "Withdrawal limits have been lifted.",
                    });
                  }}
                >
                  Start verification
                </Button>
              )}
            </div>
          </Card>

          {/* ---- Security -------------------------------------------------- */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Security"
              action={<ShieldCheck className="h-4 w-4 text-slate-500" />}
            />
            <div className="space-y-2.5 p-4">
              <TwoFactorCard />
              <button className="focus-ring flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.05]">
                <KeyRound className="h-4 w-4 shrink-0 text-slate-400" />
                <span>
                  <span className="block text-[14px] font-medium text-white">
                    Change password
                  </span>
                  <span className="text-[12px] text-slate-500">
                    Last changed {dateShort(user.createdAt)}
                  </span>
                </span>
              </button>
            </div>
          </Card>

          {/* ---- Notifications --------------------------------------------- */}
          <Card className="overflow-hidden">
            <CardHeader title="Notifications" />
            <div className="space-y-2.5 p-4">
              <Toggle
                checked={prefs.pushSignals}
                onChange={(v) => setPrefs({ ...prefs, pushSignals: v })}
                label="Push on mirrored signals"
                description="A notification each time a provider's trade opens or closes on your account."
              />
              <Toggle
                checked={prefs.emailSignals}
                onChange={(v) => setPrefs({ ...prefs, emailSignals: v })}
                label="Email daily summary"
                description="One email a day with your P&L, open positions and copy performance."
              />
              <Toggle
                checked={prefs.marketing}
                onChange={(v) => setPrefs({ ...prefs, marketing: v })}
                label="Product and market updates"
                description="Occasional emails about new providers and platform features."
              />
            </div>
          </Card>

          {/* ---- Danger ---------------------------------------------------- */}
          <Card className="overflow-hidden border-rose-500/20">
            <CardHeader title="Danger zone" subtitle="These actions cannot be undone" />
            <div className="space-y-2.5 p-4">
              <button
                onClick={() => setResetOpen(true)}
                className="focus-ring flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
              >
                <RotateCcw className="h-4 w-4 shrink-0 text-amber-450" />
                <span>
                  <span className="block text-[14px] font-medium text-white">
                    Reset demo account
                  </span>
                  <span className="text-[12px] text-slate-500">
                    Restore the starting credit and clear all positions and history.
                  </span>
                </span>
              </button>
              <button
                onClick={() => setCloseOpen(true)}
                className="focus-ring flex w-full items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] px-4 py-3 text-left transition-colors hover:bg-rose-500/10"
              >
                <Trash2 className="h-4 w-4 shrink-0 text-rose-400" />
                <span>
                  <span className="block text-[14px] font-medium text-rose-300">
                    Close account
                  </span>
                  <span className="text-[12px] text-rose-400/70">
                    Sign out and erase this session from the browser.
                  </span>
                </span>
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* ---- Confirmations ------------------------------------------------- */}
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demo account?"
        subtitle="Your balance, positions, history and copies all go back to the starting state."
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDemo();
                setResetOpen(false);
                pushToast({
                  tone: "info",
                  title: "Demo account reset",
                  body: `Balance restored to ${money(acct.demoCredit)}.`,
                });
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-slate-400">
          This restores your {acct.name} demo account to {money(acct.demoCredit)} of practice
          credit and clears its positions and history. Your live account, its balance and any
          active copies are not affected.
        </p>
      </Modal>

      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Close your account?"
        subtitle="This clears the session stored in this browser."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>
              Keep my account
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                signOut();
                router.push("/");
              }}
            >
              Close account
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-slate-400">
          Your positions, history, copies and balance are erased from this browser. You can
          open a new account at any time — it takes about ninety seconds.
        </p>
      </Modal>
    </div>
  );
}
