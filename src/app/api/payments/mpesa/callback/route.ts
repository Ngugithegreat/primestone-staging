import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { payments } from "@/db/schema";
import { confirmDeposit } from "@/server/payments";
import { parseStkCallback } from "@/server/mpesa";

/**
 * Safaricom's STK callback. This is the ONLY place a deposit is credited.
 *
 * We always answer 200 so Safaricom doesn't retry a message we've handled.
 * Crediting is idempotent (keyed on the M-Pesa receipt), and we only ever act
 * on a callback whose CheckoutRequestID matches a pending payment we created —
 * a forged callback with an unknown id does nothing.
 *
 * Optional hardening: set MPESA_CALLBACK_SECRET and append ?token=... to your
 * MPESA_CALLBACK_URL; unmatched tokens are ignored.
 */
export async function POST(req: Request) {
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (secret) {
    const token = new URL(req.url).searchParams.get("token");
    if (token !== secret) {
      // Silently accept-and-ignore so we don't leak whether a secret is set.
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = parseStkCallback(body);
  // Log so the Vercel function logs show exactly what Safaricom sent.
  console.log("[mpesa callback]", JSON.stringify({ parsed }));
  if (!parsed.checkoutRequestId) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Ignored" });
  }

  const db = getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerRequestId, parsed.checkoutRequestId))
    .limit(1);

  if (!payment) return NextResponse.json({ ResultCode: 0, ResultDesc: "No matching payment" });

  if (!parsed.success || !parsed.receipt) {
    // Customer cancelled or it failed — mark it, credit nothing.
    if (payment.status === "pending") {
      await db
        .update(payments)
        .set({ status: "failed", rawCallback: body as object, updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
    }
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Recorded failure" });
  }

  await confirmDeposit(db, {
    paymentId: payment.id,
    // Prefer the real receipt; fall back to the CheckoutRequestID (also unique).
    externalRef: parsed.receipt ?? parsed.checkoutRequestId,
    rawCallback: body,
  });

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
