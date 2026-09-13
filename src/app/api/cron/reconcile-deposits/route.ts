import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { payments } from "@/db/schema";
import { confirmDeposit, listPendingDeposits } from "@/server/payments";
import { stkQuery } from "@/server/mpesa";
import {
  creditedMinorFromPaid,
  getCryptoStatus,
  isCreditableStatus,
  isFailedStatus,
} from "@/server/nowpayments";

/**
 * Reconcile pending deposits directly with the provider, so a deposit credits
 * even if the callback/IPN never arrives and the user has left the page. This is
 * the safety net that stops paid deposits from getting stuck "pending".
 *
 * Runs on a schedule (vercel.json) and is CRON_SECRET-protected.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const pending = await listPendingDeposits(db);
  let credited = 0;
  let failed = 0;
  let checked = 0;

  for (const p of pending) {
    if (!p.providerRequestId) continue;
    checked++;
    try {
      if (p.provider === "mpesa") {
        const q = await stkQuery(p.providerRequestId);
        if (q.status === "success") {
          await confirmDeposit(db, {
            paymentId: p.id,
            externalRef: p.externalRef ?? p.providerRequestId,
            rawCallback: { source: "reconcile-cron", resultDesc: q.resultDesc },
          });
          credited++;
        } else if (q.status === "failed") {
          await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.id, p.id));
          failed++;
        }
      } else if (p.provider === "crypto") {
        const q = await getCryptoStatus(p.providerRequestId);
        if (q && isCreditableStatus(q.status)) {
          await confirmDeposit(db, {
            paymentId: p.id,
            externalRef: `nowpay:${p.providerRequestId}`,
            rawCallback: { source: "reconcile-cron", status: q.status, actuallyPaid: q.actuallyPaid },
            creditMinorOverride: creditedMinorFromPaid(q.actuallyPaid),
          });
          credited++;
        } else if (q && isFailedStatus(q.status)) {
          await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.id, p.id));
          failed++;
        }
      }
    } catch (err) {
      console.error("[reconcile-deposits] error on", p.id, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true, pending: pending.length, checked, credited, failed });
}

export const GET = handle;
export const POST = handle;
