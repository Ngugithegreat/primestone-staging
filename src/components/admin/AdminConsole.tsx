"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowDownToLine,
  Ban,
  Banknote,
  Check,
  Clock,
  Coins,
  FileText,
  Flag,
  Hash,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  Users2,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { Badge } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn, initialsOf } from "@/lib/utils";
import { accountNumber } from "@/lib/account";
import { DepositsView } from "./DepositsView";
import { EngineMonitor } from "./EngineMonitor";
import { WithdrawalsQueue } from "./WithdrawalsQueue";

/* -------------------------------------------------------------------------- */
/*  Types + helpers                                                            */
/* -------------------------------------------------------------------------- */

type KycStatus = "unverified" | "pending" | "verified" | "rejected";

type AdminUser = {
  id: string;
  account: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  flag: string;
  role: string;
  accountType: string;
  balanceMinor: number;
  copyingMinor: number;
  totalMinor: number;
  depositsMinor: number;
  withdrawalsMinor: number;
  joinedAt: string;
  flagged: boolean;
  kycStatus: KycStatus;
  docCount: number;
  kyc: {
    idType: string;
    idNumberMasked: string;
    dateOfBirth: string;
    residentialAddress: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
    documents: {
      type: string;
      fileName: string;
      fileSize: number;
      storageKey: string;
      contentType?: string;
    }[];
  } | null;
};

const usd = (m: number) => `$${(m / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_META: Record<KycStatus, { label: string; tone: "mint" | "amber" | "rose" | "slate" }> = {
  verified: { label: "Verified", tone: "mint" },
  pending: { label: "Under review", tone: "amber" },
  rejected: { label: "Rejected", tone: "rose" },
  unverified: { label: "Not started", tone: "slate" },
};

const FILTERS: { id: KycStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
  { id: "unverified", label: "Not started" },
];

const DOC_LABEL: Record<string, string> = {
  id_front: "ID / passport — front",
  id_back: "ID / passport — back",
  selfie: "Selfie with ID",
  proof_of_address: "Proof of address",
};

/* -------------------------------------------------------------------------- */
/*  Console                                                                    */
/* -------------------------------------------------------------------------- */

export function AdminConsole() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<KycStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"users" | "engine" | "deposits" | "withdrawals">("users");

  const [loadError, setLoadError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
        setLoadError(undefined);
      } else {
        // Distinguish "can't read the database" from "genuinely no users" —
        // a 500 here means the query/connection failed, data is not lost.
        const body = await res.json().catch(() => ({}));
        setLoadError(
          `Couldn't load users — the server returned HTTP ${res.status}` +
            (body?.error ? ` (${body.error})` : "") +
            ". This is a data-read failure (likely the database connection), not deleted data.",
        );
      }
    } catch {
      setLoadError("Couldn't reach the server to load users (network error).");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: users.length, pending: 0, verified: 0, rejected: 0, unverified: 0 };
    for (const u of users) c[u.kycStatus] = (c[u.kycStatus] ?? 0) + 1;
    return c;
  }, [users]);

  const results = useMemo(() => {
    let list = users;
    if (filter !== "all") list = list.filter((u) => u.kycStatus === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      // Dash-insensitive so the M-Pesa receipt reference (e.g. "PSa5185f8d",
      // which has no dash) matches the account number "PS-A5185F8D".
      const qb = q.replace(/-/g, "");
      list = list.filter(
        (u) =>
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.country.toLowerCase().includes(q) ||
          accountNumber(u.id).toLowerCase().replace(/-/g, "").includes(qb),
      );
    }
    return list;
  }, [users, filter, query]);

  const selected = users.find((u) => u.id === selectedId) ?? null;

  const signOut = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  };

  const STATS = [
    { label: "Total users", value: counts.total, icon: Users2, tone: "text-white" },
    { label: "Pending review", value: counts.pending, icon: Clock, tone: "text-amber-450" },
    { label: "Verified", value: counts.verified, icon: ShieldCheck, tone: "text-mint-400" },
    { label: "Rejected", value: counts.rejected, icon: XCircle, tone: "text-rose-400" },
  ];

  return (
    <div className="min-h-dvh bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href="/admin" />
            <Badge tone="iris" className="hidden sm:inline-flex">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setLoading(true); load(); }}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[12.5px] text-slate-300 hover:bg-white/[0.08]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              onClick={signOut}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[12.5px] text-slate-300 hover:bg-white/[0.08]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {/* Tabs */}
        <div className="mb-5 inline-flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
          {([
            { id: "users", label: "Users", icon: Users2 },
            { id: "engine", label: "Copy engine", icon: Activity },
            { id: "deposits", label: "Deposits", icon: ArrowDownToLine },
            { id: "withdrawals", label: "Withdrawals", icon: Banknote },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={cn(
                "focus-ring inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                view === t.id ? "bg-white/[0.10] text-white" : "text-slate-400 hover:text-slate-200",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {view === "engine" ? (
          <EngineMonitor />
        ) : view === "deposits" ? (
          <DepositsView />
        ) : view === "withdrawals" ? (
          <WithdrawalsQueue />
        ) : (
          <>
        <h1 className="font-display text-[24px] font-bold text-white">User management</h1>
        <p className="mt-1 text-[14px] text-slate-400">
          Every registered account with live figures. Review identity submissions here.
        </p>

        {loadError && (
          <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] px-4 py-3 text-[13px] text-rose-200">
            {loadError}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="card-sheen rounded-2xl border border-white/[0.07] bg-ink-880/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{s.label}</span>
                <s.icon className={cn("h-4 w-4", s.tone)} />
              </div>
              <p className={cn("tnum mt-2 font-display text-[26px] font-bold", s.tone)}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, country…" className="pl-10" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "focus-ring rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  filter === f.id ? "bg-white/[0.10] text-white" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200",
                )}
              >
                {f.label}
                {f.id !== "all" && <span className="tnum ml-1.5 text-slate-500">{counts[f.id] ?? 0}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-880/50">
          {loading ? (
            <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-mint-400" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-white/[0.07] text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Country</th>
                    <th className="px-4 py-3 text-right font-medium">Current balance</th>
                    <th className="px-4 py-3 text-right font-medium">Deposited</th>
                    <th className="px-4 py-3 font-medium">KYC</th>
                    <th className="px-4 py-3 font-medium">Docs</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-ink-950" style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}>
                            {initialsOf(`${u.firstName} ${u.lastName}`)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[13.5px] font-medium text-white">{u.firstName} {u.lastName}</p>
                              {u.role !== "client" && <Badge tone="iris">{u.role}</Badge>}
                              {u.flagged && <Flag className="h-3 w-3 text-rose-400" />}
                            </div>
                            <p className="truncate text-[12px] text-slate-500">
                              {u.email} · <span className="font-mono text-slate-400">{accountNumber(u.id)}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-300">{u.flag} {u.country}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="tnum text-[13px] font-semibold text-white">{usd(u.totalMinor)}</p>
                        {u.copyingMinor > 0 && (
                          <p className="tnum text-[11px] text-slate-500">
                            {usd(u.balanceMinor)} free · {usd(u.copyingMinor)} copying
                          </p>
                        )}
                      </td>
                      <td className="tnum px-4 py-3 text-right text-[13px] text-slate-400">{usd(u.depositsMinor)}</td>
                      <td className="px-4 py-3"><Badge tone={STATUS_META[u.kycStatus].tone}>{STATUS_META[u.kycStatus].label}</Badge></td>
                      <td className="tnum px-4 py-3 text-[13px] text-slate-400">{u.docCount}</td>
                      <td className="px-4 py-3 text-[12.5px] text-slate-400">{new Date(u.joinedAt).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3 text-right"><span className="text-[12.5px] font-medium text-mint-400">View →</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {results.length === 0 && <div className="px-4 py-14 text-center text-[14px] text-slate-500">No users match those filters.</div>}
            </div>
          )}
        </div>
        <p className="mt-3 text-[12px] text-slate-600">Showing {results.length} of {users.length} accounts.</p>
          </>
        )}
      </main>

      <AnimatePresence>
        {selected && <UserDrawer user={selected} onClose={() => setSelectedId(null)} onChanged={load} />}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Detail drawer                                                              */
/* -------------------------------------------------------------------------- */

const REJECT_REASONS = [
  "ID photo blurred — details not legible.",
  "Selfie does not match the ID document.",
  "Proof of address older than 3 months.",
  "Document appears to be expired.",
];

function UserDrawer({ user, onClose, onChanged }: { user: AdminUser; onClose: () => void; onChanged: () => Promise<void> }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]!);
  const [busy, setBusy] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [fundNote, setFundNote] = useState("");
  const [fundBusy, setFundBusy] = useState(false);
  const [fundMsg, setFundMsg] = useState<{ tone: "ok" | "err"; text: string }>();
  const meta = STATUS_META[user.kycStatus];
  const canReview = user.kycStatus === "pending";

  const fund = async () => {
    const amount = Number(fundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFundMsg({ tone: "err", text: "Enter a valid amount." });
      return;
    }
    setFundBusy(true);
    setFundMsg(undefined);
    const res = await fetch("/api/admin/fund", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: user.id, amount, note: fundNote.trim() || undefined }),
    });
    const d = await res.json().catch(() => ({}));
    setFundBusy(false);
    if (!res.ok) {
      setFundMsg({ tone: "err", text: d.error ?? "Funding failed." });
      return;
    }
    setFundMsg({ tone: "ok", text: `Credited $${amount.toLocaleString()} to ${user.firstName}.` });
    setFundAmount("");
    setFundNote("");
    await onChanged();
  };

  const review = async (decision: "verified" | "rejected") => {
    setBusy(true);
    await fetch("/api/admin/kyc/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: user.id, decision, reason: decision === "rejected" ? reason : undefined }),
    });
    setBusy(false);
    await onChanged();
    onClose();
  };

  const toggleFlag = async () => {
    await fetch("/api/admin/kyc/review", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: user.id, flagged: !user.flagged }),
    });
    await onChanged();
  };

  return (
    <>
      <motion.div className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-white/[0.09] bg-ink-900"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full text-[15px] font-semibold text-ink-950" style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}>
              {initialsOf(`${user.firstName} ${user.lastName}`)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-semibold text-white">{user.firstName} {user.lastName}</h2>
                {user.role !== "client" && <Badge tone="iris">{user.role}</Badge>}
              </div>
              <p className="text-[12.5px] text-slate-500">{user.flag} {user.country}</p>
              <p className="mt-0.5 font-mono text-[11.5px] tracking-wide text-mint-400">
                {accountNumber(user.id)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className={cn("flex items-center justify-between rounded-xl border p-3.5",
            user.kycStatus === "verified" ? "border-mint-500/25 bg-mint-500/[0.06]" : user.kycStatus === "pending" ? "border-amber-450/25 bg-amber-450/[0.06]" : user.kycStatus === "rejected" ? "border-rose-500/25 bg-rose-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]")}>
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">KYC status</p>
              <div className="mt-1"><Badge tone={meta.tone}>{meta.label}</Badge></div>
            </div>
            {user.kyc?.submittedAt && <p className="text-right text-[11.5px] text-slate-500">Submitted {new Date(user.kyc.submittedAt).toLocaleString("en-GB")}</p>}
          </div>

          <Section title="Contact">
            <Row icon={Mail} label="Email" value={user.email} />
            <Row icon={Phone} label="Phone" value={user.phone} />
            <Row icon={MapPin} label="Country" value={`${user.flag} ${user.country}`} />
          </Section>

          <Section title="Account">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Current balance" value={usd(user.totalMinor)} />
              <Metric label="Available (free)" value={usd(user.balanceMinor)} />
              <Metric label="Copying" value={usd(user.copyingMinor)} />
              <Metric label="Deposited" value={usd(user.depositsMinor)} />
              <Metric label="Withdrawn" value={usd(user.withdrawalsMinor)} />
              <Metric label="Account type" value={user.accountType} />
            </div>
            <p className="mt-2 text-[11.5px] text-slate-500">Joined {new Date(user.joinedAt).toLocaleString("en-GB")}</p>
          </Section>

          <Section title="Fund account">
            <p className="text-[12px] leading-relaxed text-slate-400">
              Manually credit {user.firstName}&rsquo;s balance — use this when a real payment
              didn&rsquo;t reflect. It records a completed deposit and emails them.
            </p>
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
                <Input
                  type="number"
                  min={0}
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="Amount (USD)"
                  className="pl-6"
                  disabled={fundBusy}
                />
              </div>
              <Button onClick={fund} disabled={fundBusy}>
                {fundBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                Fund
              </Button>
            </div>
            <Input
              value={fundNote}
              onChange={(e) => setFundNote(e.target.value)}
              placeholder="Note (optional) — e.g. M-Pesa UHMCJ3Q6FP"
              className="mt-2"
              disabled={fundBusy}
            />
            {fundMsg && (
              <p className={cn("mt-2 text-[12.5px]", fundMsg.tone === "ok" ? "text-mint-400" : "text-rose-400")}>
                {fundMsg.text}
              </p>
            )}
          </Section>

          {user.kyc ? (
            <>
              <Section title="Identity details">
                <Row label="Document type" value={user.kyc.idType} />
                <Row label="Document number" value={user.kyc.idNumberMasked} mono />
                <Row label="Date of birth" value={user.kyc.dateOfBirth} />
                <Row label="Residential address" value={user.kyc.residentialAddress} />
              </Section>
              <Section title={`Documents (${user.kyc.documents.length})`}>
                {user.kyc.documents.length === 0 ? (
                  <p className="text-[13px] text-slate-500">No documents uploaded.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {user.kyc.documents.map((d) => {
                      // Private blobs are served only via the admin proxy.
                      const url = d.storageKey
                        ? `/api/admin/kyc/doc?path=${encodeURIComponent(d.storageKey)}`
                        : null;
                      const isImage =
                        url != null &&
                        (d.contentType?.startsWith("image/") ||
                          /\.(jpe?g|png|webp|heic|gif)$/i.test(d.fileName));
                      return (
                        <a
                          key={d.type}
                          href={url ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "group block overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] transition-colors",
                            url ? "hover:border-mint-500/40" : "cursor-default",
                          )}
                        >
                          <div className="relative grid aspect-[4/3] place-items-center bg-black/30">
                            {isImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={url!}
                                alt={DOC_LABEL[d.type] ?? d.type}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <FileText className="h-8 w-8 text-slate-500" />
                            )}
                            {url && (
                              <span className="absolute right-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                                Open ↗
                              </span>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="text-[12px] font-medium text-white">{DOC_LABEL[d.type] ?? d.type}</p>
                            <p className="truncate text-[10.5px] text-slate-500">
                              {d.fileName} · {Math.round(d.fileSize / 1024)} KB
                            </p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </Section>
            </>
          ) : (
            <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-center">
              <p className="text-[13px] text-slate-400">This user has not submitted identity documents yet.</p>
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.07] p-4">
          {rejecting ? (
            <div className="space-y-3">
              <p className="text-[13px] font-medium text-white">Reason for rejection</p>
              <div className="space-y-1.5">
                {REJECT_REASONS.map((r) => (
                  <button key={r} onClick={() => setReason(r)} className={cn("focus-ring flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] transition-colors", reason === r ? "border-rose-500/40 bg-rose-500/[0.08] text-white" : "border-white/[0.07] text-slate-400 hover:bg-white/[0.04]")}>
                    <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border", reason === r ? "border-rose-500 bg-rose-500" : "border-white/20")}>{reason === r && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}</span>
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setRejecting(false)} className="flex-1">Cancel</Button>
                <Button variant="danger" onClick={() => review("rejected")} disabled={busy} className="flex-1"><XCircle className="h-4 w-4" />Confirm</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={toggleFlag} className={cn("focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors", user.flagged ? "border-rose-500/40 bg-rose-500/10 text-rose-400" : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]")} title={user.flagged ? "Remove flag" : "Flag account"}>
                <Flag className="h-4 w-4" />
              </button>
              {canReview ? (
                <>
                  <Button variant="secondary" onClick={() => setRejecting(true)} className="flex-1"><Ban className="h-4 w-4" />Reject</Button>
                  <Button onClick={() => review("verified")} disabled={busy} className="flex-1"><ShieldCheck className="h-4 w-4" />Approve</Button>
                </>
              ) : (
                <div className="flex-1 text-center text-[12.5px] text-slate-500">
                  {user.kycStatus === "verified" ? "This account is verified." : user.kycStatus === "rejected" ? "Awaiting re-submission." : "No pending submission."}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, value, mono }: { icon?: typeof Mail; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-2 last:border-0">
      <span className="flex items-center gap-2 text-[12.5px] text-slate-500">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</span>
      <span className={cn("text-right text-[13px] text-slate-200", mono && "tnum")}>{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
      <p className="text-[10.5px] text-slate-500">{label}</p>
      <p className="tnum mt-0.5 text-[13.5px] font-semibold text-white">{value}</p>
    </div>
  );
}
