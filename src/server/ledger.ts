import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { ledgerAccounts, ledgerEntries, ledgerTransactions } from "@/db/schema";

/**
 * Immutable double-entry ledger.
 *
 * Every movement of money is a transaction made of ≥2 signed entries that sum
 * to exactly zero — money is only ever moved between accounts, never created or
 * destroyed. A balance is the sum of an account's entries, never a mutable
 * column, so it can always be reconciled and can never silently drift.
 *
 * Amounts are integer minor units (cents). Positive credits an account,
 * negative debits it.
 */

type AccountKind =
  | "client_cash"
  | "client_allocation"
  | "system_deposits_clearing"
  | "system_withdrawals_clearing"
  | "system_fees"
  | "system_pnl";

type TxnKind =
  | "deposit"
  | "withdrawal"
  | "allocation"
  | "deallocation"
  | "fee"
  | "trade_pnl"
  | "adjustment";

export type Leg = { accountId: string; amount: number };

/** Convert a decimal currency amount (e.g. 12.34) to integer cents (1234). */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

/** Convert integer cents back to a decimal currency amount. */
export function toMajor(minor: number): number {
  return minor / 100;
}

/** Fetch (creating if absent) a system-level ledger account of a given kind. */
export async function ensureSystemAccount(
  db: Database,
  kind: Extract<
    AccountKind,
    | "system_deposits_clearing"
    | "system_withdrawals_clearing"
    | "system_fees"
    | "system_pnl"
  >,
  currency = "USD",
): Promise<string> {
  const existing = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.kind, kind), sql`${ledgerAccounts.userId} is null`))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [row] = await db
    .insert(ledgerAccounts)
    .values({ kind, currency })
    .returning({ id: ledgerAccounts.id });
  return row!.id;
}

/** Fetch (creating if absent) a client's cash account. */
export async function ensureClientCashAccount(
  db: Database,
  userId: string,
  currency = "USD",
): Promise<string> {
  const existing = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(
      and(eq(ledgerAccounts.kind, "client_cash"), eq(ledgerAccounts.userId, userId)),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [row] = await db
    .insert(ledgerAccounts)
    .values({ kind: "client_cash", userId, currency })
    .returning({ id: ledgerAccounts.id });
  return row!.id;
}

/** Create a per-allocation account holding funds committed to one provider. */
export async function createAllocationAccount(
  db: Database,
  userId: string,
  providerId: string,
  currency = "USD",
): Promise<string> {
  const [row] = await db
    .insert(ledgerAccounts)
    .values({ kind: "client_allocation", userId, providerId, currency })
    .returning({ id: ledgerAccounts.id });
  return row!.id;
}

export type PostInput = {
  kind: TxnKind;
  reference: string;
  memo?: string;
  metadata?: unknown;
  createdBy?: string;
  legs: Leg[];
  currency?: string;
};

/**
 * Post a balanced transaction using the given executor (which may be a
 * transaction handle). Assumes the caller has already opened a transaction, so
 * it does NOT open one itself — that keeps a caller's multi-step operation
 * atomic without nesting savepoints. Throws, writing nothing, if the legs do
 * not sum to zero.
 */
export async function postWithin(db: Database, input: PostInput): Promise<string> {
  const sum = input.legs.reduce((s, l) => s + l.amount, 0);
  if (sum !== 0) {
    throw new Error(
      `Unbalanced ledger transaction: legs sum to ${sum}, must be 0 (${input.reference}).`,
    );
  }
  if (input.legs.length < 2) {
    throw new Error("A ledger transaction needs at least two entries.");
  }

  const [txn] = await db
    .insert(ledgerTransactions)
    .values({
      kind: input.kind,
      reference: input.reference,
      memo: input.memo,
      metadata: input.metadata ?? null,
      createdBy: input.createdBy,
    })
    .returning({ id: ledgerTransactions.id });

  await db.insert(ledgerEntries).values(
    input.legs.map((l) => ({
      transactionId: txn!.id,
      accountId: l.accountId,
      amount: l.amount,
      currency: input.currency ?? "USD",
    })),
  );

  return txn!.id;
}

/** Post a balanced transaction standalone, wrapped in its own transaction. */
export async function post(db: Database, input: PostInput): Promise<string> {
  return db.transaction((tx) => postWithin(tx as unknown as Database, input));
}

/** Current balance of an account, in minor units, summed from its entries. */
export async function balanceOf(db: Database, accountId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::bigint`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, accountId));
  return Number(row?.total ?? 0);
}

/** A client's spendable cash balance, in minor units. */
export async function clientCashBalance(db: Database, userId: string): Promise<number> {
  const cashId = await ensureClientCashAccount(db, userId);
  return balanceOf(db, cashId);
}
