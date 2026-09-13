import { NextResponse } from "next/server";
import { currentUser } from "@/server/session";

export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ user });
}
