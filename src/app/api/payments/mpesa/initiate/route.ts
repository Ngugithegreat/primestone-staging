import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { initiateDeposit } from "@/server/payments";
import { isMpesaConfigured, normalizeMsisdn, stkPush } from "@/server/mpesa";
import { usdToKesCharge } from "@/server/fx";

/**
 * Start an M-Pesa deposit: send an STK Push to the customer's phone. The money
 * is credited only later, from the callback — this just kicks off the prompt
 * and records a pending payment keyed on the CheckoutRequestID.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isMpesaConfigured()) {
    return NextResponse.json(
      { error: "M-Pesa is not configured on the server yet." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const amountUsd = Math.round(Number(body?.amountUsd)); // whole USD
  const phoneRaw = typeof body?.phone === "string" && body.phone ? body.phone : user.phone;

  const MIN_USD = 100;
  if (!Number.isFinite(amountUsd) || amountUsd < MIN_USD) {
    return NextResponse.json(
      { error: `The minimum deposit is $${MIN_USD}.` },
      { status: 400 },
    );
  }
  const phone = normalizeMsisdn(phoneRaw ?? "");
  if (!/^2547\d{8}$|^2541\d{8}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid Safaricom phone number." }, { status: 400 });
  }

  // The client picks USD; M-Pesa charges the KES equivalent at the live rate,
  // and the account is credited with exactly that USD.
  const { kesWhole, usdMinor, rate } = await usdToKesCharge(amountUsd);

  const push = await stkPush({
    phone,
    amount: kesWhole,
    accountReference: `PS${user.id.slice(0, 8)}`,
    description: "PrimeStone deposit",
  });
  if (!push.ok) return NextResponse.json({ error: push.error }, { status: 502 });

  // Record the pending deposit against the CheckoutRequestID the callback carries.
  const paymentId = await initiateDeposit(getDb(), {
    userId: user.id,
    provider: "mpesa",
    amount: kesWhole, // charged amount (KES)
    currency: "KES",
    creditedAmount: usdMinor, // credited amount (USD)
    fxRate: rate,
    providerRequestId: push.checkoutRequestId,
    destination: phone,
  });

  return NextResponse.json({
    ok: true,
    paymentId,
    checkoutRequestId: push.checkoutRequestId,
    message: push.customerMessage,
  });
}
