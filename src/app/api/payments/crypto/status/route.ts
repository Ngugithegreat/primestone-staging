import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { payments } from "@/db/schema";
import { currentUser } from "@/server/session";
import { confirmDeposit } from "@/server/payments";
import {
  creditedMinorFromPaid,
  getCryptoStatus,
  isCreditableStatus,
  isFailedStatus,
} from "@/server/nowpayments";

/**
 * Reconcile a pending crypto deposit by asking NOWPayments directly, then credit
 * on success. The wallet polls this so a deposit reflects even if the IPN is
 * delayed. Idempotent — crediting is keyed on the NOWPayments payment id.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
  if (!paymentId) return NextResponse.json({ error: "paymentId required" }, { status: 400 });

  const db = getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.userId, user.id)))
    .limit(1);
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  if (payment.status === "completed") return NextResponse.json({ status: "completed" });
  if (payment.status === "failed") return NextResponse.json({ status: "failed" });
  if (!payment.providerRequestId) return NextResponse.json({ status: "pending" });

  const q = await getCryptoStatus(payment.providerRequestId);
  if (!q) return NextResponse.json({ status: "pending" });

  if (isCreditableStatus(q.status)) {
    await confirmDeposit(db, {
      paymentId: payment.id,
      externalRef: `nowpay:${payment.providerRequestId}`,
      rawCallback: { source: "status-poll", status: q.status, actuallyPaid: q.actuallyPaid },
      creditMinorOverride: creditedMinorFromPaid(q.actuallyPaid),
    });
    return NextResponse.json({ status: "completed" });
  }
  if (isFailedStatus(q.status)) {
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    return NextResponse.json({ status: "failed" });
  }
  return NextResponse.json({ status: "pending" });
}
