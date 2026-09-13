"use client";

import { motion } from "framer-motion";
import {
  BadgeCheck,
  Clock,
  FileCheck2,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Primitives";
import {
  DOC_LABELS,
  REQUIRED_DOCS,
  STATUS_META,
  type IdType,
  type KycDocType,
  type KycStatus,
} from "@/lib/kyc";
import {
  fetchKycStatus,
  submitKycApplication,
  uploadKycDoc,
  type UploadedDoc,
} from "@/lib/kycClient";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ID_TYPES: IdType[] = ["National ID", "Passport", "Driving Licence"];
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Identity verification for the signed-in user — real, server-backed.
 *
 * Documents upload to encrypted object storage (Vercel Blob) via /api/kyc; the
 * raw ID number is sent once over HTTPS and masked + hashed server-side, never
 * stored raw. Status is read from the server so pending/verified/rejected always
 * reflect the compliance team's real decision.
 */
export function KycFlow({ compact = false }: { compact?: boolean }) {
  const user = useStore((s) => s.user);
  const setKycStatus = useStore((s) => s.setKycStatus);
  const pushToast = useStore((s) => s.pushToast);

  const [status, setStatus] = useState<KycStatus | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [serverDocs, setServerDocs] = useState<{ type: string; fileName: string }[]>([]);

  const [idType, setIdType] = useState<IdType>("National ID");
  const [idNumber, setIdNumber] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [docs, setDocs] = useState<Partial<Record<KycDocType, UploadedDoc>>>({});
  const [uploading, setUploading] = useState<Partial<Record<KycDocType, boolean>>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Load the real status from the server on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchKycStatus();
      if (cancelled) return;
      if (res) {
        setStatus(res.status);
        setSubmittedAt(res.profile?.submittedAt ?? null);
        setReviewedAt(res.profile?.reviewedAt ?? null);
        setRejectionReason(res.profile?.rejectionReason ?? null);
        setServerDocs(res.documents);
        setKycStatus(res.status);
      } else {
        setStatus("unverified");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setKycStatus]);

  const uploadedCount = REQUIRED_DOCS.filter((d) => docs[d]).length;
  const allUploaded = uploadedCount === REQUIRED_DOCS.length;

  const onFile = async (type: KycDocType, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`${DOC_LABELS[type]} is over 8 MB. Please upload a smaller file.`);
      return;
    }
    setError(undefined);
    setUploading((u) => ({ ...u, [type]: true }));
    const res = await uploadKycDoc(type, file);
    setUploading((u) => ({ ...u, [type]: false }));
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDocs((d) => ({ ...d, [type]: res.doc }));
  };

  const submit = async () => {
    if (idNumber.trim().length < 4) return setError("Enter your document number.");
    if (dob === "") return setError("Select your date of birth.");
    if (address.trim().length < 3) return setError("Enter your residential address.");
    if (!allUploaded) {
      const missing = REQUIRED_DOCS.filter((d) => !docs[d]).map((d) => DOC_LABELS[d]);
      return setError(`Please upload: ${missing.join(", ")}.`);
    }
    setError(undefined);
    setBusy(true);
    const res = await submitKycApplication({
      idType,
      idNumber: idNumber.trim(),
      dateOfBirth: dob,
      residentialAddress: address.trim(),
      documents: REQUIRED_DOCS.map((d) => docs[d]!),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStatus("pending");
    setSubmittedAt(new Date().toISOString());
    setKycStatus("pending");
    pushToast({
      tone: "success",
      title: "Submitted for review",
      body: "Your documents are with our compliance team. We'll email you the moment you're verified.",
    });
  };

  /* ---- Loading ----------------------------------------------------------- */
  if (status === null) {
    return (
      <div className="grid place-items-center py-14">
        <Loader2 className="h-6 w-6 animate-spin text-mint-400" />
      </div>
    );
  }

  /* ---- Verified ---------------------------------------------------------- */
  if (status === "verified") {
    return (
      <StatusPanel
        icon={ShieldCheck}
        tone="mint"
        title="Identity verified"
        body="Your identity has been confirmed. Withdrawals are enabled on your account."
        meta={reviewedAt ? `Approved ${fmtDate(reviewedAt)}` : undefined}
      />
    );
  }

  /* ---- Pending ----------------------------------------------------------- */
  if (status === "pending") {
    return (
      <StatusPanel
        icon={Clock}
        tone="amber"
        title="Verification under review"
        body="Thanks — your documents are with our compliance team. Most checks are completed within a few hours. We'll email you the moment your account is verified."
        meta={submittedAt ? `Submitted ${fmtDate(submittedAt)}` : undefined}
      >
        {serverDocs.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {serverDocs.map((d) => (
              <div
                key={d.type}
                className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2"
              >
                <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-mint-400" />
                <span className="truncate text-[11.5px] text-slate-400">
                  {DOC_LABELS[toClientType(d.type)] ?? d.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </StatusPanel>
    );
  }

  /* ---- Form (unverified / rejected) -------------------------------------- */
  return (
    <div className={cn(!compact && "space-y-5")}>
      {status === "rejected" && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-4">
          <ShieldAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-400" />
          <div>
            <p className="text-[13.5px] font-semibold text-white">Your last submission was rejected</p>
            <p className="mt-0.5 text-[12.5px] text-slate-400">
              {rejectionReason ?? "Please review your documents and submit again."}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <Lock className="h-4 w-4 shrink-0 text-mint-400" />
        <p className="text-[12.5px] leading-snug text-slate-400">
          Your documents are encrypted in transit and stored in access-controlled storage —
          handled under our{" "}
          <a href="/legal/privacy" className="text-mint-400 hover:text-mint-300">
            Privacy Policy
          </a>{" "}
          and used only to verify your identity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Document type" htmlFor="idType">
          <Select id="idType" value={idType} onChange={(e) => setIdType(e.target.value as IdType)}>
            {ID_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Document number" htmlFor="idNumber">
          <Input
            id="idNumber"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="e.g. 12345678"
            autoComplete="off"
          />
        </Field>
        <Field label="Date of birth" htmlFor="dob">
          <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </Field>
        <Field label="Residential address" htmlFor="addr">
          <Input
            id="addr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, city, country"
            autoComplete="off"
          />
        </Field>
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[13px] font-medium text-slate-300">Upload documents</p>
          <span className="text-[12px] text-slate-500">
            {uploadedCount}/{REQUIRED_DOCS.length} uploaded
          </span>
        </div>
        {/* Progress bar */}
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-mint-500 to-iris-500"
            initial={false}
            animate={{ width: `${(uploadedCount / REQUIRED_DOCS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {REQUIRED_DOCS.map((type) => (
            <DocDrop
              key={type}
              type={type}
              doc={docs[type]}
              uploading={!!uploading[type]}
              onFile={(f) => onFile(type, f)}
              onClear={() => setDocs((s) => ({ ...s, [type]: undefined }))}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-[12.5px] text-rose-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {busy ? "Submitting…" : "Submit for verification"}
        </Button>
        <span className="text-[12px] text-slate-500">
          {user?.firstName ? `${user.firstName}, ` : ""}all four documents are required.
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function DocDrop({
  type,
  doc,
  uploading,
  onFile,
  onClear,
}: {
  type: KycDocType;
  doc: UploadedDoc | undefined;
  uploading: boolean;
  onFile: (file: File | undefined) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const sizeKb = doc ? Math.round(doc.fileSize / 1024) : 0;

  return (
    <div
      className={cn(
        "relative rounded-xl border border-dashed p-4 transition-colors",
        doc
          ? "border-mint-500/40 bg-mint-500/[0.06]"
          : uploading
            ? "border-iris-500/40 bg-iris-500/[0.05]"
            : "border-white/15 bg-white/[0.02] hover:bg-white/[0.04]",
      )}
    >
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {uploading ? (
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-iris-500/15">
            <Loader2 className="h-4.5 w-4.5 animate-spin text-iris-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-white">{DOC_LABELS[type]}</p>
            <p className="text-[11px] text-slate-500">Uploading…</p>
          </div>
        </div>
      ) : doc ? (
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mint-500/15">
            <FileCheck2 className="h-4.5 w-4.5 text-mint-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-white">{DOC_LABELS[type]}</p>
            <p className="truncate text-[11px] text-slate-500">
              {doc.fileName} · {sizeKb} KB
            </p>
          </div>
          <button
            onClick={onClear}
            aria-label="Remove"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()} className="flex w-full items-center gap-3 text-left">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
            <Upload className="h-4 w-4 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-slate-200">{DOC_LABELS[type]}</p>
            <p className="text-[11px] text-slate-500">JPG, PNG or PDF · max 8 MB</p>
          </div>
        </button>
      )}
    </div>
  );
}

function StatusPanel({
  icon: Icon,
  tone,
  title,
  body,
  meta,
  children,
}: {
  icon: typeof ShieldCheck;
  tone: "mint" | "amber";
  title: string;
  body: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  const toneCls =
    tone === "mint"
      ? "border-mint-500/25 bg-mint-500/[0.06] text-mint-400"
      : "border-amber-450/25 bg-amber-450/[0.06] text-amber-450";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-2xl border p-6", toneCls)}
    >
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-current/10">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-white">{title}</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-slate-300">{body}</p>
          {meta && <p className="mt-2 text-[12px] text-slate-500">{meta}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

/** Compact status chip for reuse in the wallet, header, etc. */
export function KycStatusChip() {
  const status = useStore((s) => s.kyc.status);
  const meta = STATUS_META[status];
  const Icon = status === "verified" ? BadgeCheck : status === "pending" ? Clock : ShieldAlert;
  return (
    <Badge tone={meta.tone}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function toClientType(server: string): KycDocType {
  const map: Record<string, KycDocType> = {
    id_front: "id-front",
    id_back: "id-back",
    selfie: "selfie",
    proof_of_address: "proof-of-address",
  };
  return map[server] ?? "id-front";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
