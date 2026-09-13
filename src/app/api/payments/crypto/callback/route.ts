import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { payments } from "@/db/schema";
import { confirmDeposit } from "@/server/payments";
import {
  creditedMinorFromPaid,
  isCreditableStatus,
  isFailedStatus,
  verifyIpnSignature,
} from "@/server/nowpayments";

/**
 * NOWPayments IPN webhook. Credits the client's account ONLY after verifying the
 * HMAC signature — a forged callback can never credit money (the same rule that
 * hardened the M-Pesa path). Idempotent: crediting is keyed on the NOWPayments
 * payment id via the payment's unique externalRef.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-nowpayments-sig");

  if (!verifyIpnSignature(raw, sig)) {
    console.error("[crypto/callback] bad or missing signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const nowId = String(body.payment_id ?? "");
  const status = String(body.payment_status ?? "");
  const actuallyPaid = Number(body.actually_paid ?? 0);
  if (!nowId) return NextResponse.json({ ok: true });

  const db = getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerRequestId, nowId))
    .limit(1);
  if (!payment) {
    // Unknown payment — acknowledge so NOWPayments stops retrying.
    return NextResponse.json({ ok: true });
  }

  if (isCreditableStatus(status)) {
    // Credit whatever actually arrived on-chain, not the invoice amount, so an
    // under- or over-payment credits its real value instead of getting stuck.
    await confirmDeposit(db, {
      paymentId: payment.id,
      externalRef: `nowpay:${nowId}`,
      rawCallback: body,
      creditMinorOverride: creditedMinorFromPaid(actuallyPaid),
    });
  } else if (isFailedStatus(status)) {
    await db
      .update(payments)
      .set({ status: "failed", rawCallback: body, updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
  }
  // waiting / confirming / sending → leave pending; the wallet keeps polling.

  return NextResponse.json({ ok: true });
}
