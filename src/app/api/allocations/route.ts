import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { allocate, deallocate } from "@/server/allocations";

/** Subscribe: allocate real cash to a signal provider. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const providerId = typeof body?.providerId === "string" ? body.providerId : "";
  const amount = Number(body?.amount);
  const riskMultiplier = body?.riskMultiplier != null ? Number(body.riskMultiplier) : undefined;
  const copyStopLossBps = body?.copyStopLossBps != null ? Number(body.copyStopLossBps) : null;

  if (!providerId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Provider and a positive amount are required." }, { status: 400 });
  }

  const result = await allocate(getDb(), {
    userId: user.id,
    providerId,
    amount,
    riskMultiplier,
    copyStopLossBps,
    currency: "USD",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, allocationId: result.allocationId });
}

/** Unsubscribe: close an allocation and return its funds to cash. */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const allocationId = typeof body?.allocationId === "string" ? body.allocationId : "";
  if (!allocationId) return NextResponse.json({ error: "allocationId is required." }, { status: 400 });

  const result = await deallocate(getDb(), { userId: user.id, allocationId, currency: "USD" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, returnedMinor: result.returned });
}
