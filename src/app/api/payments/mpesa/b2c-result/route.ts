import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import {
  completeWithdrawal,
  findWithdrawalByConversationId,
  rejectWithdrawal,
} from "@/server/payments";
import { parseB2CResult } from "@/server/mpesaB2C";

/**
 * Safaricom B2C result callback. Settles the matching withdrawal:
 *   success → complete it (store the M-Pesa receipt);
 *   failure → refund the client (the money never left).
 * Idempotent via completeWithdrawal/rejectWithdrawal, which no-op once the
 * withdrawal is no longer "pending".
 *
 * Optional hardening: set MPESA_CALLBACK_SECRET and the payout result URL is
 * built with ?token=…; unmatched tokens are ignored.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (secret) {
    const token = new URL(req.url).searchParams.get("token");
    if (token !== secret) {
      console.error("[b2c-result] bad or missing token");
      return NextResponse.json({ ok: true });
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = parseB2CResult(body);
  console.log("[b2c-result]", JSON.stringify({ ...parsed, raw: body }));

  if (!parsed.conversationId) return NextResponse.json({ ok: true });

  const db = getDb();
  const payment = await findWithdrawalByConversationId(db, parsed.conversationId);
  if (!payment) {
    // Unknown conversation — acknowledge so Safaricom stops retrying.
    return NextResponse.json({ ok: true });
  }

  if (parsed.success) {
    await completeWithdrawal(db, {
      paymentId: payment.id,
      externalRef: parsed.receipt ?? parsed.conversationId,
    });
  } else {
    // Payout failed — return the locked funds to the client.
    await rejectWithdrawal(db, {
      paymentId: payment.id,
      reason: parsed.resultDesc ?? `M-Pesa payout failed (${parsed.resultCode ?? "?"})`,
    });
  }

  return NextResponse.json({ ok: true });
}
