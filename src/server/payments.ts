import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditLog, payments, users } from "@/db/schema";
import {
  ensureClientCashAccount,
  ensureSystemAccount,
  postWithin,
  toMinor,
} from "./ledger";
import {
  depositCreditedEmail,
  sendEmail,
  withdrawalPaidEmail,
  withdrawalRejectedEmail,
} from "./email";
import { siteUrl } from "@/lib/siteUrl";

const fmtUsd = (minor: number) =>
  `$${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Payments.
 *
 * A deposit is only credited to a client's cash account from a CONFIRMED
 * payment — never from a browser response. The PSP's reference (e.g. an M-Pesa
 * receipt) is stored under a unique constraint, so a retried or duplicated
 * callback can never credit the account twice.
 *
 * The M-Pesa/card/crypto network calls live in the route handlers that call
 * these functions; here we own the state machine and the ledger effects.
 */

type Provider = "mpesa" | "card" | "crypto" | "bank";

/** Record a deposit intent (before the PSP confirms). Returns the payment id. */
export async function initiateDeposit(
  db: Database,
  input: {
    userId: string;
    provider: Provider;
    amount: number; // charged amount, major units (e.g. KES)
    currency?: string; // currency of `amount`
    /** USD minor units to credit on confirmation (after FX). Defaults to the charged amount. */
    creditedAmount?: number;
    fxRate?: number;
    providerRequestId?: string;
    destination?: string;
  },
): Promise<string> {
  if (input.amount <= 0) throw new Error("Deposit amount must be positive.");
  const [row] = await db
    .insert(payments)
    .values({
      userId: input.userId,
      provider: input.provider,
      kind: "deposit",
      amount: toMinor(input.amount),
      currency: input.currency ?? "USD",
      creditedAmount: input.creditedAmount ?? toMinor(input.amount),
      fxRate: input.fxRate != null ? String(input.fxRate) : null,
      status: "pending",
      providerRequestId: input.providerRequestId,
      destination: input.destination,
    })
    .returning({ id: payments.id });
  return row!.id;
}

/**
 * Confirm a deposit from a PSP callback and credit the client's cash.
 *
 * Idempotent: keyed on `externalRef`. If a payment with that reference is
 * already completed, this is a no-op and returns `alreadyProcessed: true`.
 */
export async function confirmDeposit(
  db: Database,
  input: {
    paymentId: string;
    externalRef: string;
    rawCallback?: unknown;
    /**
     * Credit exactly this many USD minor units instead of the amount the user
     * requested. Used for crypto, where we credit whatever actually arrived
     * on-chain (not the invoice amount), so an under/over-payment reflects the
     * real received value.
     */
    creditMinorOverride?: number;
  },
): Promise<{ ok: boolean; alreadyProcessed: boolean }> {
  const result = await db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, input.paymentId))
      .limit(1);
    if (!payment) throw new Error("Payment not found.");
    if (payment.status === "completed")
      return { ok: true, alreadyProcessed: true, credited: null as CreditedInfo | null };

    // A different payment already used this receipt → duplicate callback.
    const dupe = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.externalRef, input.externalRef))
      .limit(1);
    if (dupe[0] && dupe[0].id !== input.paymentId) {
      return { ok: false, alreadyProcessed: true, credited: null as CreditedInfo | null };
    }

    // The account is denominated in USD; credit the converted amount — or the
    // actual received amount when an override is given (crypto). An override is
    // respected even when it's 0: a partially_paid crypto callback whose funds
    // aren't counted yet must credit nothing, NOT fall back to the invoice
    // amount (that over-credited — e.g. $300 credited for 8.45 USDT received).
    const creditMinor =
      input.creditMinorOverride !== undefined
        ? input.creditMinorOverride
        : payment.creditedAmount ?? payment.amount;
    if (!(creditMinor > 0)) {
      // Nothing real has arrived yet — leave the payment pending, don't complete.
      return { ok: false, alreadyProcessed: false, credited: null as CreditedInfo | null };
    }
    const clearing = await ensureSystemAccount(tx as unknown as Database, "system_deposits_clearing", "USD");
    const cash = await ensureClientCashAccount(tx as unknown as Database, payment.userId, "USD");

    const txnId = await postWithin(tx as unknown as Database, {
      kind: "deposit",
      reference: `deposit:${input.externalRef}`,
      memo: `${payment.provider} deposit (${payment.amount / 100} ${payment.currency})`,
      metadata: { paymentId: payment.id, fxRate: payment.fxRate },
      createdBy: payment.userId,
      currency: "USD",
      legs: [
        { accountId: clearing, amount: -creditMinor },
        { accountId: cash, amount: creditMinor },
      ],
    });

    await tx
      .update(payments)
      .set({
        status: "completed",
        externalRef: input.externalRef,
        rawCallback: (input.rawCallback ?? null) as object | null,
        ledgerTransactionId: txnId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    return {
      ok: true,
      alreadyProcessed: false,
      credited: { userId: payment.userId, minor: creditMinor, provider: payment.provider },
    };
  });

  // Notify the client — after commit, best-effort (never blocks/fails crediting).
  if (result.ok && !result.alreadyProcessed && result.credited) {
    await notifyDepositCredited(db, result.credited).catch((e) =>
      console.error("[email] deposit notify failed:", e),
    );
  }
  return { ok: result.ok, alreadyProcessed: result.alreadyProcessed };
}

type CreditedInfo = { userId: string; minor: number; provider: string };

async function notifyDepositCredited(db: Database, c: CreditedInfo) {
  const [u] = await db.select().from(users).where(eq(users.id, c.userId)).limit(1);
  if (!u?.email) return;
  const e = depositCreditedEmail({
    firstName: u.firstName,
    amount: fmtUsd(c.minor),
    method: c.provider === "mpesa" ? "M-Pesa" : c.provider === "crypto" ? "Crypto (USDT)" : c.provider,
    dashboardUrl: `${siteUrl()}/wallet`,
  });
  await sendEmail({ to: u.email, subject: e.subject, html: e.html });
}

/**
 * Request a withdrawal. Hard-gated on KYC: an unverified account cannot move
 * money out. Debits cash immediately into a withdrawals clearing account; the
 * payout to the PSP is settled separately.
 */
export async function requestWithdrawal(
  db: Database,
  input: {
    userId: string;
    provider: Provider;
    amount: number; // major units
    fee?: number; // major units
    destination: string;
    currency?: string;
  },
): Promise<{ ok: true; paymentId: string } | { ok: false; error: string }> {
  const currency = input.currency ?? "USD";
  const amount = toMinor(input.amount);
  const fee = toMinor(input.fee ?? 0);

  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) return { ok: false, error: "User not found." };
  if (user.kycStatusCache !== "verified") {
    return { ok: false, error: "Identity verification is required before withdrawing." };
  }
  if (amount <= 0) return { ok: false, error: "Withdrawal amount must be positive." };

  return db.transaction(async (tx) => {
    const cash = await ensureClientCashAccount(tx as unknown as Database, input.userId, currency);
    const clearing = await ensureSystemAccount(tx as unknown as Database, "system_withdrawals_clearing", currency);
    const feeAcct = await ensureSystemAccount(tx as unknown as Database, "system_fees", currency);

    // Balance check inside the transaction to avoid a race.
    const { balanceOf } = await import("./ledger");
    const available = await balanceOf(tx as unknown as Database, cash);
    if (amount + fee > available) {
      return { ok: false as const, error: "Amount plus fee exceeds your available balance." };
    }

    const legs = [
      { accountId: cash, amount: -(amount + fee) },
      { accountId: clearing, amount },
    ];
    if (fee > 0) legs.push({ accountId: feeAcct, amount: fee });

    const txnId = await postWithin(tx as unknown as Database, {
      kind: "withdrawal",
      reference: `withdrawal:${input.userId}:${Date.now()}`,
      memo: `${input.provider} withdrawal`,
      createdBy: input.userId,
      currency,
      legs,
    });

    const [row] = await tx
      .insert(payments)
      .values({
        userId: input.userId,
        provider: input.provider,
        kind: "withdrawal",
        amount,
        feeAmount: fee,
        currency,
        status: "pending",
        destination: input.destination,
        ledgerTransactionId: txnId,
      })
      .returning({ id: payments.id });

    return { ok: true as const, paymentId: row!.id };
  });
}

export async function listPayments(db: Database, userId: string) {
  return db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt));
}

/* -------------------------------------------------------------------------- */
/*  Withdrawal settlement (manual — C2B paybills can't auto-payout)            */
/* -------------------------------------------------------------------------- */

/**
 * Mark a pending withdrawal as paid, once the operator has sent the money out
 * of band (e.g. an M-Pesa send-money). The client's cash was already debited
 * into the withdrawals-clearing account at request time, so this only flips the
 * payment to completed and records who did it.
 */
export async function completeWithdrawal(
  db: Database,
  input: { paymentId: string; reviewerId?: string | null; externalRef?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
    if (!p || p.kind !== "withdrawal") return { ok: false as const, error: "Withdrawal not found." };
    if (p.status !== "pending") return { ok: false as const, error: "This withdrawal is already processed." };

    await tx
      .update(payments)
      .set({
        status: "completed",
        externalRef: input.externalRef?.trim() || p.externalRef,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, p.id));

    await tx.insert(auditLog).values({
      actorId: input.reviewerId ?? null,
      action: "withdrawal.paid",
      targetType: "payment",
      targetId: p.id,
      metadata: input.externalRef ? { externalRef: input.externalRef } : null,
    });
    return { ok: true as const, userId: p.userId, amount: p.amount };
  });

  if (result.ok) {
    await notifyWithdrawal(db, result.userId, result.amount, "paid").catch((e) =>
      console.error("[email] withdrawal paid notify failed:", e),
    );
    return { ok: true };
  }
  return result;
}

async function notifyWithdrawal(
  db: Database,
  userId: string,
  minor: number,
  kind: "paid" | "rejected",
  reason?: string,
) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.email) return;
  const dashboardUrl = `${siteUrl()}/wallet`;
  const e =
    kind === "paid"
      ? withdrawalPaidEmail({ firstName: u.firstName, amount: fmtUsd(minor), dashboardUrl })
      : withdrawalRejectedEmail({ firstName: u.firstName, amount: fmtUsd(minor), reason, dashboardUrl });
  await sendEmail({ to: u.email, subject: e.subject, html: e.html });
}

/**
 * Reject a pending withdrawal and return the funds to the client's cash. Fully
 * reverses the request-time ledger movement (amount from clearing, and any fee
 * from the fees account, both back to cash), so the ledger stays balanced.
 */
export async function rejectWithdrawal(
  db: Database,
  input: { paymentId: string; reviewerId?: string | null; reason?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
    if (!p || p.kind !== "withdrawal") return { ok: false as const, error: "Withdrawal not found." };
    if (p.status !== "pending") return { ok: false as const, error: "This withdrawal is already processed." };

    const currency = p.currency;
    const cash = await ensureClientCashAccount(tx as unknown as Database, p.userId, currency);
    const clearing = await ensureSystemAccount(tx as unknown as Database, "system_withdrawals_clearing", currency);

    const legs = [
      { accountId: clearing, amount: -p.amount },
      { accountId: cash, amount: p.amount + p.feeAmount },
    ];
    if (p.feeAmount > 0) {
      const feeAcct = await ensureSystemAccount(tx as unknown as Database, "system_fees", currency);
      legs.push({ accountId: feeAcct, amount: -p.feeAmount });
    }

    await postWithin(tx as unknown as Database, {
      kind: "adjustment",
      reference: `withdrawal-reversal:${p.id}`,
      memo: "Withdrawal rejected — funds returned",
      createdBy: input.reviewerId ?? undefined,
      currency,
      legs,
    });

    await tx
      .update(payments)
      .set({
        status: "cancelled",
        rawCallback: input.reason ? { rejected: input.reason } : null,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, p.id));

    await tx.insert(auditLog).values({
      actorId: input.reviewerId ?? null,
      action: "withdrawal.rejected",
      targetType: "payment",
      targetId: p.id,
      metadata: input.reason ? { reason: input.reason } : null,
    });
    return { ok: true as const, userId: p.userId, amount: p.amount };
  });

  if (result.ok) {
    await notifyWithdrawal(db, result.userId, result.amount, "rejected", input.reason).catch((e) =>
      console.error("[email] withdrawal rejected notify failed:", e),
    );
    return { ok: true };
  }
  return result;
}

/** Find a withdrawal by the M-Pesa B2C ConversationID stored at payout time. */
export async function findWithdrawalByConversationId(db: Database, conversationId: string) {
  const [p] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.kind, "withdrawal"), eq(payments.providerRequestId, conversationId)))
    .limit(1);
  return p ?? null;
}

/** Record the B2C ConversationID against a withdrawal so its result can match. */
export async function attachPayoutRef(db: Database, paymentId: string, conversationId: string) {
  await db
    .update(payments)
    .set({ providerRequestId: conversationId, updatedAt: new Date() })
    .where(eq(payments.id, paymentId));
}

/**
 * Manually credit a user's account (admin) — for when a real payment failed to
 * reflect. Records it as a completed deposit (provider "bank") and runs it
 * through the normal crediting path, so it shows in the deposits list, the
 * user's history and totals, and the client gets the deposit-credited email.
 */
export async function adminCreditUser(
  db: Database,
  input: { userId: string; amountUsd: number; note?: string; reviewerId?: string | null },
): Promise<{ ok: true; name: string; amountMinor: number } | { ok: false; error: string }> {
  const usdMinor = toMinor(input.amountUsd);
  if (!(usdMinor > 0)) return { ok: false, error: "Amount must be positive." };

  const [u] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!u) return { ok: false, error: "User not found." };

  const paymentId = await initiateDeposit(db, {
    userId: input.userId,
    provider: "bank",
    amount: usdMinor,
    currency: "USD",
    creditedAmount: usdMinor,
  });
  await confirmDeposit(db, {
    paymentId,
    externalRef: `manual:${paymentId}`,
    rawCallback: { source: "admin-manual-fund", note: input.note ?? null, reviewerId: input.reviewerId ?? null },
  });

  await db.insert(auditLog).values({
    actorId: input.reviewerId ?? null,
    action: "deposit.manual_credit",
    targetType: "payment",
    targetId: paymentId,
    metadata: { userId: input.userId, amountMinor: usdMinor, note: input.note ?? null },
  });

  return { ok: true, name: `${u.firstName} ${u.lastName}`.trim() || u.email, amountMinor: usdMinor };
}

/** All deposits with the depositing user, newest first (admin). */
export async function listDeposits(db: Database, opts?: { status?: string }) {
  const rows = await db
    .select({ payment: payments, user: users })
    .from(payments)
    .innerJoin(users, eq(payments.userId, users.id))
    .where(eq(payments.kind, "deposit"))
    .orderBy(desc(payments.createdAt));
  return opts?.status ? rows.filter((r) => r.payment.status === opts.status) : rows;
}

/** Pending deposits (any provider) — for the reconciliation cron. */
export async function listPendingDeposits(db: Database) {
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.kind, "deposit"), eq(payments.status, "pending")));
}

/** All withdrawal requests with the requesting user, newest first. */
export async function listWithdrawals(db: Database, opts?: { status?: string }) {
  const rows = await db
    .select({ payment: payments, user: users })
    .from(payments)
    .innerJoin(users, eq(payments.userId, users.id))
    .where(eq(payments.kind, "withdrawal"))
    .orderBy(desc(payments.createdAt));
  return opts?.status ? rows.filter((r) => r.payment.status === opts.status) : rows;
}
