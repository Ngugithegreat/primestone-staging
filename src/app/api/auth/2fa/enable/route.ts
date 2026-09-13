import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { enable2FA } from "@/server/twoFactor";

export const runtime = "nodejs";

/** Confirm the setup code and switch 2FA on. Returns one-time backup codes. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";

  const res = await enable2FA(getDb(), user.id, code);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, backupCodes: res.backupCodes });
}
