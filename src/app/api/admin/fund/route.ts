import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { isAdminAuthed } from "@/server/adminAuth";
import { adminCreditUser } from "@/server/payments";

/** Manually fund a user's account (admin) — for a real payment that didn't reflect. */
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const amount = Number(body?.amount);
  const note = typeof body?.note === "string" ? body.note : undefined;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  const res = await adminCreditUser(getDb(), { userId, amountUsd: amount, note });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, name: res.name });
}
