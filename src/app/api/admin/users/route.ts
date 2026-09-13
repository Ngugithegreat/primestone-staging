import { NextResponse } from "next/server";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  kycDocuments,
  kycProfiles,
  ledgerAccounts,
  ledgerEntries,
  payments,
  users,
} from "@/db/schema";
import { isAdminAuthed } from "@/server/adminAuth";
import { accountNumber } from "@/lib/account";

const FLAG: Record<string, string> = {
  Kenya: "🇰🇪", Nigeria: "🇳🇬", "South Africa": "🇿🇦", Ghana: "🇬🇭", Tanzania: "🇹🇿",
  Uganda: "🇺🇬", "United Kingdom": "🇬🇧", UAE: "🇦🇪", India: "🇮🇳", Egypt: "🇪🇬",
};

/** Real registered users with live figures — for the admin console. */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
  const db = getDb();

  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  const ids = rows.map((u) => u.id);

  // Ledger cash balance per user.
  const cashByUser = new Map<string, number>();
  // Live value currently in allocations (money that's copying) per user.
  const copyingByUser = new Map<string, number>();
  if (ids.length) {
    const bals = await db
      .select({
        userId: ledgerAccounts.userId,
        kind: ledgerAccounts.kind,
        total: sql<number>`coalesce(sum(${ledgerEntries.amount}),0)::bigint`,
      })
      .from(ledgerAccounts)
      .leftJoin(ledgerEntries, eq(ledgerEntries.accountId, ledgerAccounts.id))
      .where(inArray(ledgerAccounts.kind, ["client_cash", "client_allocation"]))
      .groupBy(ledgerAccounts.userId, ledgerAccounts.kind);
    for (const b of bals) {
      if (!b.userId) continue;
      const map = b.kind === "client_cash" ? cashByUser : copyingByUser;
      map.set(b.userId, (map.get(b.userId) ?? 0) + Number(b.total));
    }
  }

  // Deposit / withdrawal totals + KYC profiles + document counts.
  const pays = ids.length ? await db.select().from(payments).where(inArray(payments.userId, ids)) : [];
  const profiles = ids.length ? await db.select().from(kycProfiles).where(inArray(kycProfiles.userId, ids)) : [];
  const docs = ids.length ? await db.select().from(kycDocuments).where(inArray(kycDocuments.userId, ids)) : [];

  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const docsByUser = new Map<string, typeof docs>();
  for (const d of docs) {
    const list = docsByUser.get(d.userId) ?? [];
    list.push(d);
    docsByUser.set(d.userId, list);
  }
  const depByUser = new Map<string, number>();
  const wdrByUser = new Map<string, number>();
  for (const p of pays) {
    if (p.status !== "completed") continue;
    const map = p.kind === "deposit" ? depByUser : wdrByUser;
    map.set(p.userId, (map.get(p.userId) ?? 0) + (p.creditedAmount ?? p.amount));
  }

  const list = rows.map((u) => {
    const profile = profileByUser.get(u.id);
    const uDocs = docsByUser.get(u.id) ?? [];
    return {
      id: u.id,
      account: accountNumber(u.id),
      firstName: u.firstName,
      lastName: u.lastName || "",
      email: u.email,
      phone: u.phone || "—",
      country: u.country || "—",
      flag: FLAG[u.country] ?? "🌐",
      role: u.role,
      accountType: u.accountType,
      balanceMinor: cashByUser.get(u.id) ?? 0,
      copyingMinor: copyingByUser.get(u.id) ?? 0,
      // Live total the user sees on their side: spendable cash + money copying.
      totalMinor: (cashByUser.get(u.id) ?? 0) + (copyingByUser.get(u.id) ?? 0),
      depositsMinor: depByUser.get(u.id) ?? 0,
      withdrawalsMinor: wdrByUser.get(u.id) ?? 0,
      joinedAt: u.createdAt,
      flagged: u.flagged,
      kycStatus: u.kycStatusCache,
      docCount: uDocs.length,
      kyc: profile
        ? {
            idType: profile.idType,
            idNumberMasked: profile.idNumberMasked,
            dateOfBirth: profile.dateOfBirth,
            residentialAddress: profile.residentialAddress,
            submittedAt: profile.submittedAt,
            reviewedAt: profile.reviewedAt,
            rejectionReason: profile.rejectionReason,
            documents: uDocs.map((d) => ({
              type: d.type,
              fileName: d.fileName,
              fileSize: d.fileSize,
              storageKey: d.storageKey,
              contentType: d.contentType,
            })),
          }
        : null,
    };
  });

  const counts = list.reduce(
    (acc, u) => {
      acc.total++;
      acc[u.kycStatus] = (acc[u.kycStatus] ?? 0) + 1;
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );

  return NextResponse.json({ users: list, counts });
  } catch (e) {
    // Drizzle wraps the driver error as "Failed query: …"; the real Postgres
    // cause (missing column, auth, connection limit, enum) is in e.cause.
    const err = e as { message?: string; cause?: { message?: string; code?: string; detail?: string } };
    const c = err.cause;
    const root = c
      ? `${c.message ?? ""}${c.code ? ` [code ${c.code}]` : ""}${c.detail ? ` — ${c.detail}` : ""}`.trim()
      : "";
    console.error("[admin/users] db error:", err.message, "| cause:", c);
    return NextResponse.json(
      { error: root || err.message || "Database error" },
      { status: 500 },
    );
  }
}
