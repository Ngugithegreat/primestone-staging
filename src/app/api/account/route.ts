import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { is2FAEnabled } from "@/server/twoFactor";
import { clientCashBalance } from "@/server/ledger";
import { listAllocations } from "@/server/allocations";
import { listPayments } from "@/server/payments";
import {
  activeAllocationValues,
  listClosedCopyPositions,
  listOpenCopyPositions,
  realizedCopyPnl,
} from "@/server/copyEngine";

/** Real account snapshot for the signed-in user: cash, allocations, payments. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [cashMinor, allocations, payments, openPositions, closedPositions, realizedPnlMinor, allocValues, twoFactor] =
    await Promise.all([
      clientCashBalance(db, user.id),
      listAllocations(db, user.id),
      listPayments(db, user.id),
      listOpenCopyPositions(db, user.id),
      listClosedCopyPositions(db, user.id),
      realizedCopyPnl(db, user.id),
      activeAllocationValues(db, user.id),
      is2FAEnabled(db, user.id),
    ]);

  // The live value of an active allocation is the provider's ledger balance,
  // which is per-provider. Collapse any duplicate active rows for the same
  // provider (legacy data from before top-up-on-recopy) to one, so the total
  // isn't double-counted.
  const seenActiveProviders = new Set<string>();
  const allocationsOut = [];
  for (const a of allocations) {
    const al = a.allocation;
    if (al.status === "active") {
      if (seenActiveProviders.has(al.providerId)) continue;
      seenActiveProviders.add(al.providerId);
    }
    allocationsOut.push({
      id: al.id,
      amountMinor: al.amount,
      // Live ledger value (principal + settled P&L); committed principal for closed.
      valueMinor:
        al.status === "active" ? allocValues.byProvider[al.providerId] ?? al.amount : al.amount,
      status: al.status,
      riskMultiplier: al.riskMultiplier,
      startedAt: al.startedAt,
      provider: {
        id: a.provider.id,
        name: a.provider.name,
        strategy: a.provider.strategy,
        roi12m: a.provider.roi12m,
      },
    });
  }

  return NextResponse.json({
    currency: "USD",
    balanceMinor: cashMinor,
    kycStatus: user.kycStatusCache,
    twoFactor,
    allocations: allocationsOut,
    payments: payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      provider: p.provider,
      // USD that hit the account (falls back to charged amount for older rows).
      amountMinor: p.creditedAmount ?? p.amount,
      chargedAmountMinor: p.amount,
      chargedCurrency: p.currency,
      feeMinor: p.feeAmount,
      status: p.status,
      createdAt: p.createdAt,
    })),
    realizedPnlMinor,
    openPositions: openPositions.map((o) => ({
      id: o.id,
      symbol: o.symbol,
      label: o.label,
      side: o.side,
      entryPrice: o.entryPrice,
      stakeMinor: o.stakeMinor,
      slPct: o.slPct,
      provider: o.provider,
      openedAt: o.openedAt,
    })),
    closedPositions,
  });
}
