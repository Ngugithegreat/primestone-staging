import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { isAdminAuthed } from "@/server/adminAuth";
import { blowAllocations, testCredit } from "@/server/testTools";
import { clearBlowSchedule, getBlowSchedule, setBlowSchedule } from "@/server/settings";

/** TESTING-ONLY admin actions. Remove before public launch. */
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const db = getDb();

  if (action === "credit") {
    const email = typeof body?.email === "string" ? body.email : "";
    const amount = Number(body?.amount);
    if (!email || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Enter an email and a positive amount." }, { status: 400 });
    }
    const res = await testCredit(db, email, amount);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true, message: `Credited ${res.name} with $${amount}.` });
  }

  if (action === "blow") {
    const email = typeof body?.email === "string" && body.email ? body.email : undefined;
    const res = await blowAllocations(db, email);
    return NextResponse.json({ ok: true, message: `Blew ${res.blown} account${res.blown === 1 ? "" : "s"}.` });
  }

  if (action === "schedule-blow") {
    const minutes = Number(body?.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return NextResponse.json({ error: "Enter minutes from now (e.g. 2)." }, { status: 400 });
    }
    const email = typeof body?.email === "string" && body.email ? body.email : null;
    const at = Date.now() + minutes * 60_000;
    await setBlowSchedule(db, at, email);
    const who = email ?? "all accounts";
    return NextResponse.json({ ok: true, message: `Scheduled: ${who} will blow in ${minutes} min.`, at });
  }

  if (action === "cancel-blow") {
    await clearBlowSchedule(db);
    return NextResponse.json({ ok: true, message: "Scheduled blow cancelled." });
  }

  if (action === "blow-status") {
    const s = await getBlowSchedule(db);
    return NextResponse.json({ ok: true, schedule: s });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
