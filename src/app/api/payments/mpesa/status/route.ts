import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { payments } from "@/db/schema";
import { currentUser } from "@/server/session";
import { confirmDeposit } from "@/server/payments";
import { stkQuery } from "@/server/mpesa";

/**
 * Reconcile a pending M-Pesa deposit by asking Safaricom directly, then credit
 * on success. The wallet polls this so a deposit reflects even if the async
 * callback never arrives. Idempotent — crediting is keyed on the receipt id.
 */
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

  const q = await stkQuery(payment.providerRequestId);

  if (q.status === "success") {
    // Use the CheckoutRequestID as the idempotency key (unique per deposit).
    await confirmDeposit(db, {
      paymentId: payment.id,
      externalRef: payment.externalRef ?? payment.providerRequestId,
      rawCallback: { source: "stk-query", resultDesc: q.resultDesc },
    });
    return NextResponse.json({ status: "completed" });
  }

  if (q.status === "failed") {
    console.error("[mpesa/status] failed", {
      paymentId: payment.id,
      code: q.resultCode,
      desc: q.resultDesc,
    });
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    return NextResponse.json({ status: "failed", detail: q.resultDesc, code: q.resultCode });
  }

  return NextResponse.json({ status: "pending" });
}
