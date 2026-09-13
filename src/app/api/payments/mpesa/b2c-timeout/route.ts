import { NextResponse } from "next/server";

/**
 * Safaricom B2C queue-timeout callback. Fires when Safaricom couldn't even queue
 * the request. We just log it and leave the withdrawal pending so an operator
 * can retry the payout or reject/refund it manually — we never settle from here.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  console.error("[b2c-timeout]", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
