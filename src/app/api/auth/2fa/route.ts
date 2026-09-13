import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { get2FA, begin2FASetup } from "@/server/twoFactor";
import { generateSecret, otpauthUrl } from "@/server/totp";

export const runtime = "nodejs";

/** Current 2FA status for the signed-in user. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await get2FA(getDb(), user.id);
  return NextResponse.json({ enabled: state.enabled });
}

/** Start setup: mint a secret, store it (disabled), return the QR + secret. */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = generateSecret();
  await begin2FASetup(getDb(), user.id, secret);
  const url = otpauthUrl(user.email, secret);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
  return NextResponse.json({ secret, otpauthUrl: url, qr });
}
