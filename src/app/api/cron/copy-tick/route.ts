import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { runEngineTick } from "@/server/copyEngine";
import { clearBlowSchedule, getAutoBlowDays, getBlowSchedule } from "@/server/settings";
import { blowAgedAllocations, blowAllocations } from "@/server/testTools";

/**
 * The heartbeat of the copy-trade engine: advances every active provider by one
 * tick against real prices — closing positions that hit their stop/target and
 * opening new ones. Scheduled by Vercel Cron (see vercel.json).
 *
 * Protected by CRON_SECRET. Vercel automatically sends
 * `Authorization: Bearer <CRON_SECRET>` on scheduled invocations when the env
 * var is set; a manual trigger can pass `?key=<CRON_SECRET>`.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured → allow (dev)
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const key = new URL(req.url).searchParams.get("key");
  return key === secret;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = getDb();

    // Fire a scheduled test blow if its time has come.
    let blown = 0;
    const schedule = await getBlowSchedule(db);
    if (schedule && schedule.at <= Date.now()) {
      const res = await blowAllocations(db, schedule.email ?? undefined);
      blown = res.blown;
      await clearBlowSchedule(db);
    }

    // Auto-blow: blow accounts that started copying more than N days ago.
    const autoBlowDays = await getAutoBlowDays(db);
    const autoBlown = autoBlowDays > 0 ? (await blowAgedAllocations(db, autoBlowDays)).blown : 0;

    const result = await runEngineTick(db);
    return NextResponse.json({ ok: true, ...result, scheduledBlow: blown, autoBlown });
  } catch (err) {
    console.error("[copy-tick] failed:", err);
    return NextResponse.json({ ok: false, error: "Engine tick failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
