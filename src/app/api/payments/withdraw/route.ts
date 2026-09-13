import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { requestWithdrawal } from "@/server/payments";
import { normalizeMsisdn } from "@/server/mpesa";
import { is2FAEnabled, verify2FA } from "@/server/twoFactor";

export const runtime = "nodejs";

/**
 * Request a withdrawal to M-Pesa or crypto (USDT TRC-20). KYC-gated (enforced in
 * requestWithdrawal). Funds are locked immediately (debited to the
 * withdrawals-clearing account); an operator sends the money out of band and
 * marks it paid in the admin queue. When the user has 2FA on, a valid code is
 * required before the request is accepted.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount); // USD, major units
  const method = body?.method === "crypto" ? "crypto" : "mpesa";
  const code = typeof body?.code === "string" ? body.code : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  // 2FA gate — verified before any funds are locked.
  if (await is2FAEnabled(getDb(), user.id)) {
    if (!code) {
      return NextResponse.json({ twoFactorRequired: true }, { status: 200 });
    }
    if (!(await verify2FA(getDb(), user.id, code))) {
      return NextResponse.json(
        { twoFactorRequired: true, error: "Invalid authentication code." },
        { status: 401 },
      );
    }
  }

  let provider: "mpesa" | "crypto";
  let destination: string;
  if (method === "crypto") {
    provider = "crypto";
    const addr = typeof body?.address === "string" ? body.address.trim() : "";
    // USDT on TRON: base58, starts with T, 34 chars.
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) {
      return NextResponse.json(
        { error: "Enter a valid USDT (TRC-20) wallet address." },
        { status: 400 },
      );
    }
    destination = addr;
  } else {
    provider = "mpesa";
    const phoneRaw = typeof body?.phone === "string" && body.phone ? body.phone : user.phone;
    const phone = normalizeMsisdn(phoneRaw ?? "");
    if (!/^2547\d{8}$|^2541\d{8}$/.test(phone)) {
      return NextResponse.json(
        { error: "Enter a valid Safaricom number to receive the funds." },
        { status: 400 },
      );
    }
    destination = phone;
  }

  const res = await requestWithdrawal(getDb(), {
    userId: user.id,
    provider,
    amount,
    fee: 0,
    destination,
    currency: "USD",
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, paymentId: res.paymentId });
}
