import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { isAdminAuthed } from "@/server/adminAuth";
import { getAutoBlowDays, getRiskPct, setAutoBlowDays, setRiskPct } from "@/server/settings";

/** Read/update runtime engine settings (risk per trade, auto-blow days). */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  const [riskPct, autoBlowDays] = await Promise.all([getRiskPct(db), getAutoBlowDays(db)]);
  return NextResponse.json({ riskPct, autoBlowDays });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const db = getDb();

  // Auto-blow days (0 = off) — separate control from risk.
  if (body?.autoBlowDays !== undefined) {
    const days = Number(body.autoBlowDays);
    if (!Number.isFinite(days) || days < 0) {
      return NextResponse.json({ error: "Enter a valid number of days (0 = off)." }, { status: 400 });
    }
    const saved = await setAutoBlowDays(db, days);
    return NextResponse.json({ ok: true, autoBlowDays: saved });
  }

  const riskPct = Number(body?.riskPct);
  if (!Number.isFinite(riskPct) || riskPct <= 0) {
    return NextResponse.json({ error: "Enter a valid risk %." }, { status: 400 });
  }
  const saved = await setRiskPct(db, riskPct);
  return NextResponse.json({ ok: true, riskPct: saved });
}
