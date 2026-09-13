import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { register } from "@/server/auth";
import { startSession } from "@/server/session";
import { sendEmail, welcomeEmail } from "@/server/email";
import { startEmailVerification } from "@/server/emailVerify";
import { siteUrl } from "@/lib/siteUrl";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await register(getDb(), body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await startSession(result.user.id);

  // Welcome email with a verification code — best-effort; never block or fail
  // registration on it.
  try {
    const verifyCode = await startEmailVerification(getDb(), result.user.id);
    const { subject, html } = welcomeEmail({
      firstName: result.user.firstName,
      loginUrl: `${siteUrl()}/dashboard`,
      verifyCode,
    });
    await sendEmail({ to: result.user.email, subject, html });
  } catch (e) {
    console.error("[register] welcome email failed:", e);
  }

  return NextResponse.json({ user: result.user });
}
