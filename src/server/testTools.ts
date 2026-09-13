import "server-only";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  allocations,
  copyPositions,
  ledgerAccounts,
  providerPositions,
  signalProviders,
  users,
} from "@/db/schema";
import {
  balanceOf,
  createAllocationAccount,
  ensureClientCashAccount,
  ensureSystemAccount,
  postWithin,
  toMinor,
} from "./ledger";

/**
 * TESTING-ONLY utilities — fund a test account without a real payment, and
 * instantly "blow" allocated accounts to demonstrate that losses/blow-ups work.
 * Remove this module (and /api/admin/test) before public launch.
 */

/** Credit a user's real cash balance with test funds (no PSP involved). */
export async function testCredit(
  db: Database,
  email: string,
  amountMajor: number,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const amount = toMinor(amountMajor);
  if (!(amount > 0)) return { ok: false, error: "Amount must be positive." };
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  if (!u) return { ok: false, error: `No user with email ${email}.` };

  await db.transaction(async (tx) => {
    const clearing = await ensureSystemAccount(tx as unknown as Database, "system_deposits_clearing", "USD");
    const cash = await ensureClientCashAccount(tx as unknown as Database, u.id, "USD");
    await postWithin(tx as unknown as Database, {
      kind: "adjustment",
      reference: `test-credit:${u.id}:${Date.now()}`,
      memo: "TEST funds (no real payment)",
      createdBy: u.id,
      currency: "USD",
      legs: [
        { accountId: clearing, amount: -amount },
        { accountId: cash, amount },
      ],
    });
  });
  return { ok: true, name: `${u.firstName} ${u.lastName}`.trim() || u.email };
}

/**
 * Move all of a user's cash into an allocation so it can be blown. Reuses an
 * existing active allocation's account if there is one (avoids duplicate
 * accounts for the same provider); otherwise allocates to `fallbackProviderId`.
 */
async function forceAllocateCash(db: Database, userId: string, fallbackProviderId: string) {
  await db.transaction(async (tx) => {
    const cashId = await ensureClientCashAccount(tx as unknown as Database, userId, "USD");
    const cashBal = await balanceOf(tx as unknown as Database, cashId);
    if (cashBal <= 0) return;

    const [existing] = await tx
      .select()
      .from(allocations)
      .where(and(eq(allocations.status, "active"), eq(allocations.userId, userId)))
      .orderBy(desc(allocations.startedAt))
      .limit(1);

    let accId: string;
    if (existing) {
      const [acc] = await tx
        .select({ id: ledgerAccounts.id })
        .from(ledgerAccounts)
        .where(
          and(
            eq(ledgerAccounts.kind, "client_allocation"),
            eq(ledgerAccounts.userId, userId),
            eq(ledgerAccounts.providerId, existing.providerId),
          ),
        )
        .orderBy(desc(ledgerAccounts.createdAt))
        .limit(1);
      accId = acc?.id ?? (await createAllocationAccount(tx as unknown as Database, userId, existing.providerId, "USD"));
      await tx
        .update(allocations)
        .set({ amount: sql`${allocations.amount} + ${cashBal}` })
        .where(eq(allocations.id, existing.id));
    } else {
      accId = await createAllocationAccount(tx as unknown as Database, userId, fallbackProviderId, "USD");
      await tx
        .insert(allocations)
        .values({ userId, providerId: fallbackProviderId, amount: cashBal, riskMultiplier: "1" });
    }

    await postWithin(tx as unknown as Database, {
      kind: "allocation",
      reference: `test-alloc:${userId}:${Date.now()}`,
      memo: "TEST auto-allocate for blow",
      createdBy: userId,
      currency: "USD",
      legs: [
        { accountId: cashId, amount: -cashBal },
        { accountId: accId, amount: cashBal },
      ],
    });
  });
}

/**
 * Instantly blow every active allocation (or one user's): drain each allocation
 * account to $0 as a loss and close its open positions. Simulates a wiped
 * account so you can confirm the blow-up flow works. For a targeted user, any
 * uncopied cash is allocated first so the whole account is wiped.
 */
export async function blowAllocations(
  db: Database,
  email?: string,
): Promise<{ ok: true; blown: number }> {
  let userId: string | undefined;
  if (email) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    userId = u?.id;
    if (!userId) return { ok: true, blown: 0 };

    // Sweep any available cash into an allocation first, so "blow my account"
    // wipes the whole balance — not just funds already copying a provider.
    const [prov] = await db
      .select({ id: signalProviders.id })
      .from(signalProviders)
      .where(eq(signalProviders.active, true))
      .limit(1);
    if (prov) await forceAllocateCash(db, userId, prov.id);
  }

  const allocs = await db
    .select()
    .from(allocations)
    .where(
      userId
        ? and(eq(allocations.status, "active"), eq(allocations.userId, userId))
        : eq(allocations.status, "active"),
    );

  let blown = 0;
  for (const a of allocs) {
    if (await drainAllocation(db, a)) blown++;
  }
  return { ok: true, blown };
}

/**
 * Drain one active allocation to $0 through a handful of realistic losing
 * trades (real trade history, not a reset). Returns true if it drained
 * anything. Shared by the manual blow and the auto-blow.
 */
async function drainAllocation(
  db: Database,
  a: { id: string; userId: string; providerId: string },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [acc] = await tx
      .select({ id: ledgerAccounts.id })
      .from(ledgerAccounts)
      .where(
        and(
          eq(ledgerAccounts.kind, "client_allocation"),
          eq(ledgerAccounts.userId, a.userId),
          eq(ledgerAccounts.providerId, a.providerId),
        ),
      )
      .orderBy(desc(ledgerAccounts.createdAt))
      .limit(1);
    if (!acc) return false;
    const bal = await balanceOf(tx as unknown as Database, acc.id);
    if (bal <= 0) return false;

    const systemPnl = await ensureSystemAccount(tx as unknown as Database, "system_pnl", "USD");

    // Close any positions currently open on this allocation.
    await tx
      .update(copyPositions)
      .set({ status: "closed", realizedPnl: 0, closedAt: new Date() })
      .where(and(eq(copyPositions.allocationId, a.id), eq(copyPositions.status, "open")));

    // Split the balance into a handful of losing trades so the account is
    // drained by real-looking trade history, not a single reset.
    const MKT = [
      { s: "BTCUSD", p: 68000 },
      { s: "ETHUSD", p: 3600 },
      { s: "SOLUSD", p: 170 },
      { s: "XRPUSD", p: 0.62 },
    ];
    const weights = [1, 1.4, 0.8, 1.2];
    const wSum = weights.reduce((s, w) => s + w, 0);
    let remaining = bal;
    for (let i = 0; i < weights.length; i++) {
      const loss = i === weights.length - 1 ? remaining : Math.min(remaining, Math.round((bal * weights[i]!) / wSum));
      if (loss <= 0) continue;
      remaining -= loss;

      const m = MKT[i % MKT.length]!;
      const side = i % 2 === 0 ? "buy" : "sell";
      const entry = m.p;
      const exit = side === "buy" ? entry * (1 - 0.03) : entry * (1 + 0.03); // 3% against it
      const closedAt = new Date(Date.now() - (weights.length - 1 - i) * 90_000);
      const openedAt = new Date(closedAt.getTime() - 30 * 60_000);

      const [pp] = await tx
        .insert(providerPositions)
        .values({
          providerId: a.providerId,
          symbol: m.s,
          side,
          entryPrice: String(entry),
          sizePct: "0.0500",
          stopLossPct: "0.0300",
          status: "closed",
          exitPrice: String(exit),
          closeReason: "stop_loss",
          openedAt,
          closedAt,
        })
        .returning({ id: providerPositions.id });

      await tx.insert(copyPositions).values({
        providerPositionId: pp!.id,
        allocationId: a.id,
        userId: a.userId,
        symbol: m.s,
        side,
        entryPrice: String(entry),
        stakeMinor: loss,
        status: "closed",
        exitPrice: String(exit),
        realizedPnl: -loss,
        openedAt,
        closedAt,
      });

      await postWithin(tx as unknown as Database, {
        kind: "trade_pnl",
        reference: `test-blow:${a.id}:${i}:${Date.now()}`,
        memo: `TEST blow-up — ${side.toUpperCase()} ${m.s} stopped out`,
        createdBy: a.userId,
        currency: "USD",
        legs: [
          { accountId: acc.id, amount: -loss },
          { accountId: systemPnl, amount: loss },
        ],
      });
    }

    await tx
      .update(allocations)
      .set({ realizedPnl: sql`${allocations.realizedPnl} - ${bal}` })
      .where(eq(allocations.id, a.id));
    return true;
  });
}

/**
 * Auto-blow: blow every active allocation that started copying more than
 * `days` ago (each account blows N days after it starts). Skips ones already
 * at $0. Called from the engine tick when the admin has set the days.
 */
export async function blowAgedAllocations(
  db: Database,
  days: number,
): Promise<{ blown: number }> {
  if (!(days > 0)) return { blown: 0 };
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const aged = await db
    .select({ id: allocations.id, userId: allocations.userId, providerId: allocations.providerId })
    .from(allocations)
    .where(and(eq(allocations.status, "active"), lte(allocations.startedAt, cutoff)));

  let blown = 0;
  for (const a of aged) {
    if (await drainAllocation(db, a)) blown++;
  }
  return { blown };
}
