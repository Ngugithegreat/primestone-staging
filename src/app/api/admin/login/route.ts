import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  checkAdminPassword,
  isAdminConfigured,
  setAdminCookie,
  verifyTurnstile,
} from "@/server/adminAuth";

export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin access is not configured. Set ADMIN_PASSWORD in the environment." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const turnstileToken = typeof body?.turnstileToken === "string" ? body.turnstileToken : undefined;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const human = await verifyTurnstile(turnstileToken, ip);
  if (!human) {
    return NextResponse.json({ error: "Please complete the human verification." }, { status: 400 });
  }

  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  await setAdminCookie();
  return NextResponse.json({ ok: true });
}
