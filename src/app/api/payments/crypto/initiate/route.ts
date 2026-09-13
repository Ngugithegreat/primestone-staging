import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { initiateDeposit } from "@/server/payments";
import { createCryptoPayment, isCryptoConfigured } from "@/server/nowpayments";
import { siteUrl } from "@/lib/siteUrl";

/**
 * Start a crypto deposit: ask NOWPayments for a unique deposit address for the
 * chosen amount + coin, and record a pending payment keyed on their payment id.
 * Crediting happens later, only from the signature-verified IPN webhook.
 */
export const runtime = "nodejs";

const MIN_USD = 20;
const ALLOWED = new Set(["usdttrc20", "usdtbsc", "usdcbsc", "usdterc20"]);

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCryptoConfigured()) {
    return NextResponse.json({ error: "Crypto deposits aren't enabled yet." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const amountUsd = Math.round(Number(body?.amountUsd));
  const payCurrency = typeof body?.payCurrency === "string" ? body.payCurrency.toLowerCase() : "";

  if (!Number.isFinite(amountUsd) || amountUsd < MIN_USD) {
    return NextResponse.json({ error: `The minimum crypto deposit is $${MIN_USD}.` }, { status: 400 });
  }
  if (!ALLOWED.has(payCurrency)) {
    return NextResponse.json({ error: "Choose a supported coin/network." }, { status: 400 });
  }

  const created = await createCryptoPayment({
    amountUsd,
    payCurrency,
    orderId: `PS-${user.id.slice(0, 8)}-${Date.now().toString(36)}`,
    callbackUrl: `${siteUrl()}/api/payments/crypto/callback`,
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 502 });

  // Record the pending deposit against the NOWPayments payment id. Stablecoins
  // are 1:1 with USD, so we credit exactly the USD amount requested on success.
  const paymentId = await initiateDeposit(getDb(), {
    userId: user.id,
    provider: "crypto",
    amount: amountUsd,
    currency: "USD",
    creditedAmount: amountUsd * 100,
    providerRequestId: created.payment.nowPaymentId,
    destination: created.payment.payAddress,
  });

  return NextResponse.json({
    ok: true,
    paymentId,
    payAddress: created.payment.payAddress,
    payAmount: created.payment.payAmount,
    payCurrency: created.payment.payCurrency,
  });
}
