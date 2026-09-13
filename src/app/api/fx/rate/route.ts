import { NextResponse } from "next/server";
import { usdKesRate } from "@/server/fx";

/** Current USD→KES rate, for showing a live conversion estimate on the deposit form. */
export async function GET() {
  const rate = await usdKesRate();
  return NextResponse.json({ usdKes: rate });
}
