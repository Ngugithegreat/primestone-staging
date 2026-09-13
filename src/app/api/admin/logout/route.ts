import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/server/adminAuth";

export async function POST() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
