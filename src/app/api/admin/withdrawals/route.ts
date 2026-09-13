import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { isAdminAuthed } from "@/server/adminAuth";
import { eq } from "drizzle-orm";
import { payments } from "@/db/schema";
import {
  attachPayoutRef,
  completeWithdrawal,
  listWithdrawals,
  rejectWithdrawal,
} from "@/server/payments";
import { accountNumber } from "@/lib/account";
import { isB2CConfigured, sendB2C } from "@/server/mpesaB2C";
import { usdToKesCharge } from "@/server/fx";

const FLAG: Record<string, string> = {
  Kenya: "🇰🇪", Nigeria: "🇳🇬", "South Africa": "🇿🇦", Ghana: "🇬🇭", Tanzania: "🇹🇿",
  Uganda: "🇺🇬", "United Kingdom": "🇬🇧", UAE: "🇦🇪", India: "🇮🇳", Egypt: "🇪🇬",
};

/** Withdrawal queue for the admin console. */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await listWithdrawals(getDb());
  const withdrawals = rows.map((r) => ({
    id: r.payment.id,
    amountMinor: r.payment.amount,
    currency: r.payment.currency,
    provider: r.payment.provider,
    destination: r.payment.destination,
    status: r.payment.status,
    externalRef: r.payment.externalRef,
    createdAt: r.payment.createdAt,
    user: {
      id: r.user.id,
      name: `${r.user.firstName} ${r.user.lastName}`.trim(),
      email: r.user.email,
      phone: r.user.phone,
      flag: FLAG[r.user.country] ?? "🌐",
      kyc: r.user.kycStatusCache,
      account: accountNumber(r.user.id),
    },
  }));
  const pending = withdrawals.filter((w) => w.status === "pending").length;
  return NextResponse.json({ withdrawals, pending });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
  const action = body?.action;
  if (!paymentId) return NextResponse.json({ error: "paymentId required" }, { status: 400 });

  const db = getDb();
  if (action === "complete") {
    const externalRef = typeof body?.externalRef === "string" ? body.externalRef : undefined;
    const res = await completeWithdrawal(db, { paymentId, externalRef });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (action === "reject") {
    const reason = typeof body?.reason === "string" ? body.reason : undefined;
    const res = await rejectWithdrawal(db, { paymentId, reason });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  // Automated M-Pesa payout (B2C). Queues the payment with Safaricom; the
  // ledger is only settled later, in the b2c-result callback.
  if (action === "send-mpesa") {
    if (!isB2CConfigured()) {
      return NextResponse.json({ error: "M-Pesa B2C is not configured on the server." }, { status: 503 });
    }
    const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!p || p.kind !== "withdrawal") return NextResponse.json({ error: "Withdrawal not found." }, { status: 404 });
    if (p.status !== "pending") return NextResponse.json({ error: "This withdrawal is already processed." }, { status: 400 });
    if (p.provider !== "mpesa") return NextResponse.json({ error: "This withdrawal isn't an M-Pesa payout." }, { status: 400 });
    if (!p.destination) return NextResponse.json({ error: "No M-Pesa number on this withdrawal." }, { status: 400 });

    // Payout amount is the USD held, converted to whole KES at the live rate.
    const { kesWhole } = await usdToKesCharge(p.amount / 100);
    const res = await sendB2C({
      phone: p.destination,
      amountKes: kesWhole,
      remarks: `PrimeStone withdrawal ${accountNumber(p.userId)}`,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });

    // Remember the ConversationID so the async result can match this payout.
    await attachPayoutRef(db, p.id, res.conversationId);
    return NextResponse.json({ ok: true, queued: true, conversationId: res.conversationId });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
