import { NextResponse } from "next/server";
import { isAdminAuthed, isAdminConfigured } from "@/server/adminAuth";

export async function GET() {
  return NextResponse.json({
    authed: await isAdminAuthed(),
    configured: isAdminConfigured(),
    turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
  });
}
