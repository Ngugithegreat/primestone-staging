import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { createResetToken } from "@/server/passwordReset";
import { passwordResetEmail, sendEmail } from "@/server/email";
import { siteUrl } from "@/lib/siteUrl";

/**
 * Start a password reset. Always responds success — we never reveal whether an
 * email is registered.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const result = await createResetToken(getDb(), email);
  if (result) {
    const resetUrl = `${siteUrl()}/reset-password?token=${result.token}`;
    const { subject, html } = passwordResetEmail({ firstName: result.firstName, resetUrl });
    await sendEmail({ to: email.trim().toLowerCase(), subject, html });
  }

  return NextResponse.json({ ok: true });
}
