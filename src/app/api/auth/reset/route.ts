import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { resetPassword } from "@/server/passwordReset";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!token) return NextResponse.json({ error: "Missing reset token." }, { status: 400 });

  const result = await resetPassword(getDb(), token, password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
