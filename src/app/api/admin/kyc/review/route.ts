import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditLog, kycProfiles, users } from "@/db/schema";
import { isAdminAuthed } from "@/server/adminAuth";
import { kycApprovedEmail, kycRejectedEmail, sendEmail } from "@/server/email";
import { siteUrl } from "@/lib/siteUrl";

/** Approve or reject a user's KYC. Admin-authed (env-password session). */
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const decision = body?.decision === "verified" || body?.decision === "rejected" ? body.decision : null;
  const reason = typeof body?.reason === "string" ? body.reason : undefined;
  if (!userId || !decision) {
    return NextResponse.json({ error: "userId and a valid decision are required." }, { status: 400 });
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(kycProfiles)
      .set({
        status: decision,
        reviewedAt: new Date(),
        rejectionReason: decision === "rejected" ? (reason ?? "Not verified.") : null,
      })
      .where(eq(kycProfiles.userId, userId));
    await tx.update(users).set({ kycStatusCache: decision }).where(eq(users.id, userId));
    await tx.insert(auditLog).values({
      action: `kyc.${decision}`,
      targetType: "user",
      targetId: userId,
      metadata: reason ? { reason } : null,
    });
  });

  // Notify the user of the decision (best-effort).
  try {
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (u?.email) {
      const e =
        decision === "verified"
          ? kycApprovedEmail({ firstName: u.firstName, dashboardUrl: `${siteUrl()}/dashboard` })
          : kycRejectedEmail({ firstName: u.firstName, reason, verifyUrl: `${siteUrl()}/verify` });
      await sendEmail({ to: u.email, subject: e.subject, html: e.html });
    }
  } catch (err) {
    console.error("[email] kyc notify failed:", err);
  }

  return NextResponse.json({ ok: true });
}

/** Toggle a fraud flag on a user. */
export async function PATCH(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const flagged = Boolean(body?.flagged);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  await getDb().update(users).set({ flagged }).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
