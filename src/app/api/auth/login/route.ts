import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { login } from "@/server/auth";
import { startSession } from "@/server/session";
import { is2FAEnabled, verify2FA } from "@/server/twoFactor";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const code = typeof body?.code === "string" ? body.code : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const result = await login(getDb(), email, password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

  // Password is correct — if 2FA is on, require a valid code before the session.
  if (await is2FAEnabled(getDb(), result.user.id)) {
    if (!code) {
      // Signal the client to collect the authenticator code, no session yet.
      return NextResponse.json({ twoFactorRequired: true }, { status: 200 });
    }
    if (!(await verify2FA(getDb(), result.user.id, code))) {
      return NextResponse.json({ twoFactorRequired: true, error: "Invalid authentication code." }, { status: 401 });
    }
  }

  await startSession(result.user.id);
  return NextResponse.json({ user: result.user });
}
