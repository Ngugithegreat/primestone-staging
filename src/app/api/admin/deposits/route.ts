import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { payments } from "@/db/schema";
import { isAdminAuthed } from "@/server/adminAuth";
import { confirmDeposit, listDeposits } from "@/server/payments";
import { stkQuery } from "@/server/mpesa";
import {
  creditedMinorFromPaid,
  getCryptoStatus,
  isCreditableStatus,
  isFailedStatus,
} from "@/server/nowpayments";
import { accountNumber } from "@/lib/account";

const FLAG: Record<string, string> = {
  Kenya: "🇰🇪", Nigeria: "🇳🇬", "South Africa": "🇿🇦", Ghana: "🇬🇭", Tanzania: "🇹🇿",
  Uganda: "🇺🇬", "United Kingdom": "🇬🇧", UAE: "🇦🇪", India: "🇮🇳", Egypt: "🇪🇬",
};

/** Every deposit with its user + totals, for the admin console. */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await listDeposits(getDb());
  const deposits = rows.map((r) => ({
    id: r.payment.id,
    // USD credited to the account (falls back to charged amount for older rows).
    amountMinor: r.payment.creditedAmount ?? r.payment.amount,
    chargedAmountMinor: r.payment.amount,
    chargedCurrency: r.payment.currency,
    provider: r.payment.provider,
    status: r.payment.status,
    providerRef: r.payment.providerRequestId,
    createdAt: r.payment.createdAt,
    user: {
      id: r.user.id,
      name: `${r.user.firstName} ${r.user.lastName}`.trim(),
      email: r.user.email,
      flag: FLAG[r.user.country] ?? "🌐",
      // The traceable account number. Its 8 chars match the M-Pesa STK account
      // reference (PS + first 8 of the user id) shown on the customer's receipt.
      account: accountNumber(r.user.id),
    },
  }));

  const totals = deposits.reduce(
    (acc, d) => {
      acc.count++;
      if (d.status === "completed") {
        acc.completed++;
        acc.completedMinor += d.amountMinor;
      } else if (d.status === "pending" || d.status === "initiated") {
        acc.pending++;
        acc.pendingMinor += d.amountMinor;
      } else if (d.status === "failed" || d.status === "cancelled") {
        acc.failed++;
      }
      return acc;
    },
    { count: 0, completed: 0, completedMinor: 0, pending: 0, pendingMinor: 0, failed: 0 },
  );

  return NextResponse.json({ deposits, totals });
}

/** Reconcile a pending deposit with the provider, or force-credit it manually. */
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
  const action = body?.action;
  if (!paymentId) return NextResponse.json({ error: "paymentId required" }, { status: 400 });

  const db = getDb();
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!p || p.kind !== "deposit") return NextResponse.json({ error: "Deposit not found." }, { status: 404 });
  if (p.status === "completed") return NextResponse.json({ ok: true, status: "completed" });

  if (action === "credit") {
    // Manual force-credit — for a deposit you've confirmed arrived out of band.
    await confirmDeposit(db, {
      paymentId: p.id,
      externalRef: p.externalRef ?? `manual:${p.id}`,
      rawCallback: { source: "admin-manual-credit" },
    });
    return NextResponse.json({ ok: true, status: "completed" });
  }

  if (action === "reconcile") {
    if (!p.providerRequestId) return NextResponse.json({ error: "No provider reference to reconcile." }, { status: 400 });
    if (p.provider === "mpesa") {
      const q = await stkQuery(p.providerRequestId);
      if (q.status === "success") {
        await confirmDeposit(db, { paymentId: p.id, externalRef: p.externalRef ?? p.providerRequestId, rawCallback: { source: "admin-reconcile" } });
        return NextResponse.json({ ok: true, status: "completed" });
      }
      if (q.status === "failed") {
        await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.id, p.id));
        return NextResponse.json({ ok: true, status: "failed", detail: q.resultDesc });
      }
      return NextResponse.json({ ok: true, status: "pending", detail: q.resultDesc });
    }
    if (p.provider === "crypto") {
      const q = await getCryptoStatus(p.providerRequestId);
      if (!q) return NextResponse.json({ ok: true, status: "pending", detail: "NOWPayments unreachable or not configured." });
      if (isCreditableStatus(q.status)) {
        await confirmDeposit(db, {
          paymentId: p.id,
          externalRef: `nowpay:${p.providerRequestId}`,
          rawCallback: { source: "admin-reconcile", actuallyPaid: q.actuallyPaid },
          creditMinorOverride: creditedMinorFromPaid(q.actuallyPaid),
        });
        return NextResponse.json({ ok: true, status: "completed" });
      }
      if (isFailedStatus(q.status)) {
        await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.id, p.id));
        return NextResponse.json({ ok: true, status: "failed", detail: `NOWPayments: ${q.status}` });
      }
      return NextResponse.json({
        ok: true,
        status: "pending",
        detail: `NOWPayments: ${q.status}${q.actuallyPaid ? ` · received ${q.actuallyPaid}` : " · nothing received yet"}`,
      });
    }
    return NextResponse.json({ error: "This provider can't be reconciled automatically." }, { status: 400 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
