import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { isEmailVerified, verifyEmailCode } from "@/server/emailVerify";

export const runtime = "nodejs";

/** Verification status for the signed-in user. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ verified: await isEmailVerified(getDb(), user.id) });
}

/** Submit the 6-digit code to verify the email. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";

  const res = await verifyEmailCode(getDb(), user.id, code);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
