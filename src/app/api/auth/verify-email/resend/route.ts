import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { startEmailVerification } from "@/server/emailVerify";
import { sendEmail, verifyEmail } from "@/server/email";

export const runtime = "nodejs";

/** Send a fresh verification code to the signed-in user's email. */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const code = await startEmailVerification(getDb(), user.id);
    const { subject, html } = verifyEmail({ firstName: user.firstName, code });
    await sendEmail({ to: user.email, subject, html });
  } catch (e) {
    console.error("[verify-email/resend] failed:", e);
    return NextResponse.json({ error: "Couldn't send the code. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
