"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Primitives";
import { useStore } from "@/lib/store";
import {
  twoFactorDisable,
  twoFactorEnable,
  twoFactorSetup,
  twoFactorStatus,
} from "@/lib/authClient";

type SetupData = { qr: string; secret: string };

/**
 * Real two-factor authentication management, backed by /api/auth/2fa.
 * Set up (QR + verify → backup codes) and disable (verify a code) live here.
 */
export function TwoFactorCard() {
  const pushToast = useStore((s) => s.pushToast);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  useEffect(() => {
    twoFactorStatus().then((s) => setEnabled(s.enabled));
  }, []);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={
              enabled
                ? "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-mint-500/25 bg-mint-500/10"
                : "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03]"
            }
          >
            <ShieldCheck className={enabled ? "h-5 w-5 text-mint-400" : "h-5 w-5 text-slate-400"} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-semibold text-white">Two-factor authentication</p>
              {enabled && <Badge tone="mint">On</Badge>}
            </div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-400">
              Require a code from your authenticator app at sign-in and before withdrawals.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3.5">
        {enabled === null ? (
          <Button variant="secondary" size="sm" disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
          </Button>
        ) : enabled ? (
          <Button variant="ghost" size="sm" onClick={() => setDisableOpen(true)}>
            <ShieldOff className="h-4 w-4" />
            Turn off
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setSetupOpen(true)}>
            <ShieldCheck className="h-4 w-4" />
            Set up
          </Button>
        )}
      </div>

      {setupOpen && (
        <SetupModal
          onClose={() => setSetupOpen(false)}
          onEnabled={() => {
            setEnabled(true);
            pushToast({ tone: "success", title: "Two-factor enabled" });
          }}
        />
      )}
      {disableOpen && (
        <DisableModal
          onClose={() => setDisableOpen(false)}
          onDisabled={() => {
            setEnabled(false);
            pushToast({ tone: "info", title: "Two-factor disabled" });
          }}
        />
      )}
    </div>
  );
}

/* ---- Setup flow: QR → verify → backup codes ------------------------------- */
function SetupModal({ onClose, onEnabled }: { onClose: () => void; onEnabled: () => void }) {
  const [data, setData] = useState<SetupData | null>(null);
  const [loadErr, setLoadErr] = useState<string>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    twoFactorSetup().then((r) => {
      if (r.ok) setData({ qr: r.qr, secret: r.secret });
      else setLoadErr(r.error);
    });
  }, []);

  const verify = async () => {
    if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) {
      return setError("Enter the 6-digit code from your app.");
    }
    setBusy(true);
    setError(undefined);
    const r = await twoFactorEnable(code.replace(/\s/g, ""));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setBackupCodes(r.backupCodes);
    onEnabled();
  };

  const copyBackup = () => {
    if (!backupCodes) return;
    navigator.clipboard?.writeText(backupCodes.join("\n")).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={backupCodes ? "Save your backup codes" : "Set up two-factor authentication"}
      subtitle={
        backupCodes
          ? "Store these somewhere safe — each works once if you lose your authenticator."
          : "Scan the QR with Google Authenticator, Authy or 1Password, then enter the code."
      }
      footer={
        backupCodes ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={verify} disabled={busy || !data}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify & enable
            </Button>
          </>
        )
      }
    >
      {backupCodes ? (
        <div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.08] bg-ink-950/40 p-4">
            {backupCodes.map((c) => (
              <span key={c} className="font-mono text-[13px] tracking-wider text-slate-200">
                {c}
              </span>
            ))}
          </div>
          <button
            onClick={copyBackup}
            className="focus-ring mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-mint-400 hover:text-mint-300"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy all codes"}
          </button>
        </div>
      ) : loadErr ? (
        <p className="text-[13px] text-rose-400">{loadErr}</p>
      ) : !data ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-xl border border-white/10 bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qr} alt="2FA QR code" width={180} height={180} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-slate-400">
                Can&rsquo;t scan? Enter this key manually:
              </p>
              <p className="mt-1 break-all rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[12.5px] tracking-wide text-slate-200">
                {data.secret}
              </p>
            </div>
          </div>
          <Field label="Enter the 6-digit code" error={error}>
            <Input
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(undefined);
              }}
              placeholder="123456"
              className="text-center text-[18px] tracking-[0.3em]"
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ---- Disable flow: verify a code ------------------------------------------ */
function DisableModal({ onClose, onDisabled }: { onClose: () => void; onDisabled: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const disable = async () => {
    if (!code.trim()) return setError("Enter a current code or a backup code.");
    setBusy(true);
    setError(undefined);
    const r = await twoFactorDisable(code.replace(/\s/g, ""));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDisabled();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Turn off two-factor authentication?"
      subtitle="This lowers the security on your account. Confirm with a current code."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it on
          </Button>
          <Button variant="danger" onClick={disable} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Turn off
          </Button>
        </>
      }
    >
      <Field label="Authentication code" error={error}>
        <Input
          inputMode="numeric"
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(undefined);
          }}
          placeholder="123456"
          className="text-center text-[18px] tracking-[0.3em]"
          onKeyDown={(e) => e.key === "Enter" && disable()}
        />
      </Field>
    </Modal>
  );
}
