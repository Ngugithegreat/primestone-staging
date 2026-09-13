import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  allocations,
  copyPositions,
  ledgerAccounts,
  providerPositions,
  signalProviders,
} from "@/db/schema";
import { balanceOf, ensureSystemAccount, postWithin } from "./ledger";
import { getLiveQuotes, instrumentLabel, priceableSymbols } from "./marketData";
import { getRiskPct } from "./settings";

/**
 * The copy-trade engine.
 *
 * A signal provider opens a position (symbol, side, real entry price, and a
 * `sizePct` of each subscriber's allocation). That position is mirrored into a
 * `copy_positions` row for every active allocation, sized to that allocation.
 * As real prices move the positions are marked to market for display; when the
 * provider closes, every mirror settles its realized P&L to the ledger — money
 * moves between the client's allocation account and the house (`system_pnl`),
 * with the provider's performance fee taken from profits (`system_fees`).
 *
 * Settlement mode is controlled by COPY_SETTLEMENT:
 *   • "live"  — closes post real ledger transactions (real money moves).
 *   • "paper" — (default) positions open, mark, and close with recorded P&L,
 *               but NOTHING touches the ledger. Safe to run before you're ready
 *               to move real balances; flip to "live" when you are.
 *
 * The ledger invariant (every transaction's entries sum to zero, nothing
 * created or destroyed) holds in both modes.
 */

const MAX_OPEN_PER_PROVIDER = 4;
const OPEN_PROBABILITY = 0.35; // chance a provider opens a new position on a tick
const DISCRETIONARY_CLOSE_PROB = 0.08; // chance an in-profit-window position is closed early
const MAX_HOLD_MS = 8 * 60 * 60 * 1000; // force-close after 8h
const MIN_STAKE_MINOR = 100; // don't mirror sub-$1 slices

export type SettlementMode = "live" | "paper";

export function settlementMode(): SettlementMode {
  return process.env.COPY_SETTLEMENT === "live" ? "live" : "paper";
}

/* -------------------------------------------------------------------------- */
/*  Opening a provider position → mirror into every active allocation          */
/* -------------------------------------------------------------------------- */

export async function openProviderPosition(
  db: Database,
  input: {
    providerId: string;
    symbol: string;
    side: "buy" | "sell";
    price: number;
    sizePct: number; // fraction of allocation, e.g. 0.05
    stopLossPct?: number | null;
    takeProfitPct?: number | null;
  },
): Promise<{ ok: true; positionId: string; mirrors: number } | { ok: false; error: string }> {
  if (!(input.price > 0)) return { ok: false, error: "A real entry price is required." };
  if (!(input.sizePct > 0)) return { ok: false, error: "sizePct must be positive." };

  return db.transaction(async (tx) => {
    const [pos] = await tx
      .insert(providerPositions)
      .values({
        providerId: input.providerId,
        symbol: input.symbol,
        side: input.side,
        entryPrice: String(input.price),
        sizePct: input.sizePct.toFixed(4),
        stopLossPct: input.stopLossPct != null ? input.stopLossPct.toFixed(4) : null,
        takeProfitPct: input.takeProfitPct != null ? input.takeProfitPct.toFixed(4) : null,
      })
      .returning({ id: providerPositions.id });

    // Mirror to every active allocation to this provider, sized to each one.
    const active = await tx
      .select()
      .from(allocations)
      .where(
        and(
          eq(allocations.providerId, input.providerId),
          eq(allocations.status, "active"),
        ),
      );

    let mirrors = 0;
    for (const a of active) {
      // Risk `sizePct` of the copier's CURRENT allocation balance (principal +
      // settled P&L), so risk shrinks as an account draws down — and a blown
      // account (≈$0) simply stops opening new positions.
      const accId = await allocationAccountId(tx as unknown as Database, a.userId, a.providerId);
      const balance = accId ? await balanceOf(tx as unknown as Database, accId) : a.amount;
      const stake = Math.round(balance * input.sizePct);
      if (stake < MIN_STAKE_MINOR) continue;
      await tx.insert(copyPositions).values({
        providerPositionId: pos!.id,
        allocationId: a.id,
        userId: a.userId,
        symbol: input.symbol,
        side: input.side,
        entryPrice: String(input.price),
        stakeMinor: stake,
      });
      mirrors++;
    }

    return { ok: true as const, positionId: pos!.id, mirrors };
  });
}

/* -------------------------------------------------------------------------- */
/*  Closing a provider position → settle every mirror                          */
/* -------------------------------------------------------------------------- */

/**
 * Realized P&L, sized to the RISK put on the trade.
 *
 * `riskMinor` is the amount the copier risked (a % of their allocation). We
 * normalise the real price move against the stop-loss distance: at the stop the
 * copier loses their full risk (−risk); a take-profit at ~1.5× the stop pays
 * ~1.5× the risk. This keeps dollar P&L meaningful (real $ swings, not cents)
 * while still being driven entirely by real price movement. Loss floored at the
 * risked amount; gain capped at 3× so a single trade can't balloon absurdly.
 */
export function positionPnl(
  side: "buy" | "sell",
  entry: number,
  exit: number,
  riskMinor: number,
  slPct: number,
): number {
  if (!(entry > 0) || !(slPct > 0)) return 0;
  const dir = side === "buy" ? 1 : -1;
  const moveFrac = ((exit - entry) / entry) * dir;
  const normalized = moveFrac / slPct; // −1 ≈ stop-loss, +tp/sl ≈ take-profit
  const clamped = Math.max(-1, Math.min(3, normalized));
  return Math.round(riskMinor * clamped);
}

/** Latest allocation ledger account for a (user, provider) pair. */
async function allocationAccountId(
  db: Database,
  userId: string,
  providerId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.kind, "client_allocation"),
        eq(ledgerAccounts.userId, userId),
        eq(ledgerAccounts.providerId, providerId),
      ),
    )
    .orderBy(desc(ledgerAccounts.createdAt))
    .limit(1);
  return row?.id ?? null;
}

export async function closeProviderPosition(
  db: Database,
  input: { positionId: string; exitPrice: number; reason?: string },
): Promise<
  | { ok: true; settled: number; netPnlMinor: number; feeMinor: number }
  | { ok: false; error: string }
> {
  if (!(input.exitPrice > 0)) return { ok: false, error: "A real exit price is required." };
  const mode = settlementMode();

  return db.transaction(async (tx) => {
    const [pos] = await tx
      .select()
      .from(providerPositions)
      .where(eq(providerPositions.id, input.positionId))
      .limit(1);
    if (!pos) return { ok: false as const, error: "Position not found." };
    if (pos.status === "closed") return { ok: false as const, error: "Position already closed." };

    const [provider] = await tx
      .select()
      .from(signalProviders)
      .where(eq(signalProviders.id, pos.providerId))
      .limit(1);
    const feeBps = provider?.feeBps ?? 0;

    const mirrors = await tx
      .select()
      .from(copyPositions)
      .where(
        and(
          eq(copyPositions.providerPositionId, input.positionId),
          eq(copyPositions.status, "open"),
        ),
      );

    const entry = Number(pos.entryPrice);
    const slPct = pos.stopLossPct ? Number(pos.stopLossPct) : 0.02;
    let settled = 0;
    let netTotal = 0;
    let feeTotal = 0;

    const systemPnl = await ensureSystemAccount(tx as unknown as Database, "system_pnl", "USD");
    const systemFees = await ensureSystemAccount(tx as unknown as Database, "system_fees", "USD");

    for (const m of mirrors) {
      let pnl = positionPnl(m.side, entry, input.exitPrice, m.stakeMinor, slPct);

      // Never let a settlement drive a client's allocation account negative.
      if (mode === "live" && pnl < 0) {
        const accId = await allocationAccountId(tx as unknown as Database, m.userId, pos.providerId);
        if (accId) {
          const bal = await balanceOf(tx as unknown as Database, accId);
          if (bal + pnl < 0) pnl = -bal;
        }
      }

      const fee = pnl > 0 ? Math.round((pnl * feeBps) / 10_000) : 0;
      const net = pnl - fee; // what actually lands in the client's allocation

      if (mode === "live" && pnl !== 0) {
        const accId = await allocationAccountId(tx as unknown as Database, m.userId, pos.providerId);
        if (accId) {
          const legs = [
            { accountId: systemPnl, amount: -pnl },
            { accountId: accId, amount: net },
          ];
          if (fee > 0) legs.push({ accountId: systemFees, amount: fee });
          await postWithin(tx as unknown as Database, {
            kind: "trade_pnl",
            reference: `copytrade:${m.id}`,
            memo: `${pos.side.toUpperCase()} ${pos.symbol} via ${provider?.name ?? "provider"}`,
            metadata: {
              providerPositionId: pos.id,
              copyPositionId: m.id,
              entry,
              exit: input.exitPrice,
              grossPnl: pnl,
              fee,
            },
            createdBy: m.userId,
            currency: "USD",
            legs,
          });

          // Keep the allocation's running realized P&L in sync.
          await tx
            .update(allocations)
            .set({ realizedPnl: sql`${allocations.realizedPnl} + ${net}` })
            .where(eq(allocations.id, m.allocationId));
        }
      }

      await tx
        .update(copyPositions)
        .set({
          status: "closed",
          exitPrice: String(input.exitPrice),
          realizedPnl: net,
          closedAt: new Date(),
        })
        .where(eq(copyPositions.id, m.id));

      settled++;
      netTotal += net;
      feeTotal += fee;
    }

    await tx
      .update(providerPositions)
      .set({
        status: "closed",
        exitPrice: String(input.exitPrice),
        closeReason: input.reason ?? "manual",
        closedAt: new Date(),
      })
      .where(eq(providerPositions.id, input.positionId));

    return { ok: true as const, settled, netPnlMinor: netTotal, feeMinor: feeTotal };
  });
}

/* -------------------------------------------------------------------------- */
/*  The automated strategy — one tick                                          */
/* -------------------------------------------------------------------------- */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Advance the engine by one tick against REAL prices:
 *   1. Close any open provider position that hit its stop / target, aged out,
 *      or was closed at the strategy's discretion.
 *   2. Possibly open a new position for each active provider.
 *
 * Only instruments with a live price source are traded, so with no
 * MARKET_DATA_API_KEY set it trades crypto only (which is always live).
 */
/**
 * Margin call. When an allocation's equity falls below the minimum tradeable
 * stake it is effectively blown, so liquidate its still-open positions at $0
 * P&L — the account is out. This mirrors a real broker closing everything at a
 * margin call: a dead account stops trading and can't revive on a lingering
 * winning position. Voiding at $0 moves no money (opening never debited the
 * allocation; only closes settle P&L), so the ledger is untouched.
 */
export async function liquidateBlownAllocations(db: Database): Promise<number> {
  const active = await db
    .select({ id: allocations.id, userId: allocations.userId, providerId: allocations.providerId })
    .from(allocations)
    .where(eq(allocations.status, "active"));

  let voided = 0;
  for (const a of active) {
    const accId = await allocationAccountId(db, a.userId, a.providerId);
    const bal = accId ? await balanceOf(db, accId) : 0;
    if (bal >= MIN_STAKE_MINOR) continue; // still has equity to trade

    const openMirrors = await db
      .select({ id: copyPositions.id, entryPrice: copyPositions.entryPrice })
      .from(copyPositions)
      .where(and(eq(copyPositions.allocationId, a.id), eq(copyPositions.status, "open")));

    for (const m of openMirrors) {
      await db
        .update(copyPositions)
        .set({ status: "closed", realizedPnl: 0, exitPrice: m.entryPrice, closedAt: new Date() })
        .where(eq(copyPositions.id, m.id));
      voided++;
    }
  }
  return voided;
}

export async function runEngineTick(
  db: Database,
): Promise<{ opened: number; closed: number; priced: number; mode: SettlementMode }> {
  const mode = settlementMode();
  // Margin-call any blown accounts first, so they stop trading.
  const voided = await liquidateBlownAllocations(db);
  // Admin-configurable risk per trade (% of each copier's balance).
  const riskFraction = (await getRiskPct(db)) / 100;
  const quotes = await getLiveQuotes();
  const symbols = Object.keys(quotes);
  if (symbols.length === 0) return { opened: 0, closed: voided, priced: 0, mode };

  const providers = await db
    .select()
    .from(signalProviders)
    .where(eq(signalProviders.active, true));
  if (providers.length === 0) return { opened: 0, closed: voided, priced: symbols.length, mode };

  // Which providers currently have money copying them?
  const activeAllocs = await db
    .select({ providerId: allocations.providerId })
    .from(allocations)
    .where(eq(allocations.status, "active"));
  const hasSubscribers = new Set(activeAllocs.map((a) => a.providerId));

  let opened = 0;
  let closed = voided;
  const nowMs = Date.now();

  for (const provider of providers) {
    const open = await db
      .select()
      .from(providerPositions)
      .where(
        and(
          eq(providerPositions.providerId, provider.id),
          eq(providerPositions.status, "open"),
        ),
      );

    // 1 — manage exits
    for (const pos of open) {
      const price = quotes[pos.symbol];
      if (price == null) continue; // can't price it this tick; leave it open
      const entry = Number(pos.entryPrice);
      const sl = pos.stopLossPct != null ? Number(pos.stopLossPct) : null;
      const tp = pos.takeProfitPct != null ? Number(pos.takeProfitPct) : null;
      const age = nowMs - new Date(pos.openedAt).getTime();

      let reason: string | null = null;
      if (pos.side === "buy") {
        if (tp != null && price >= entry * (1 + tp)) reason = "take_profit";
        else if (sl != null && price <= entry * (1 - sl)) reason = "stop_loss";
      } else {
        if (tp != null && price <= entry * (1 - tp)) reason = "take_profit";
        else if (sl != null && price >= entry * (1 + sl)) reason = "stop_loss";
      }
      if (!reason && age > MAX_HOLD_MS) reason = "timeout";
      if (!reason && Math.random() < DISCRETIONARY_CLOSE_PROB) reason = "discretionary";

      if (reason) {
        const res = await closeProviderPosition(db, {
          positionId: pos.id,
          exitPrice: price,
          reason,
        });
        if (res.ok) closed++;
      }
    }

    // 2 — maybe open a new position (only if someone is copying this provider)
    const stillOpen = open.filter((p) => p.status === "open").length;
    if (
      hasSubscribers.has(provider.id) &&
      stillOpen < MAX_OPEN_PER_PROVIDER &&
      Math.random() < OPEN_PROBABILITY
    ) {
      const symbol = pick(symbols);
      const price = quotes[symbol]!;
      const side: "buy" | "sell" = Math.random() < 0.5 ? "buy" : "sell";
      const sizePct = riskFraction; // admin-set risk % of the copier's balance
      const stopLossPct = 0.012 + Math.random() * 0.018; // 1.2%–3.0% adverse move = full risk
      const takeProfitPct = 0.018 + Math.random() * 0.03; // 1.8%–4.8% (~1.5× the stop)

      const res = await openProviderPosition(db, {
        providerId: provider.id,
        symbol,
        side,
        price,
        sizePct,
        stopLossPct,
        takeProfitPct,
      });
      if (res.ok) opened++;
    }
  }

  return { opened, closed, priced: symbols.length, mode };
}

/* -------------------------------------------------------------------------- */
/*  Reads for the dashboard                                                     */
/* -------------------------------------------------------------------------- */

export type OpenCopyPosition = {
  id: string;
  symbol: string;
  label: string;
  side: "buy" | "sell";
  entryPrice: number;
  stakeMinor: number;
  /** Stop-loss distance (fraction of price) — needed to mark P&L to the risk. */
  slPct: number;
  provider: string;
  openedAt: string;
};

/** A user's currently-open copied positions, for live marking on the client. */
export async function listOpenCopyPositions(
  db: Database,
  userId: string,
): Promise<OpenCopyPosition[]> {
  const rows = await db
    .select({
      pos: copyPositions,
      slPct: providerPositions.stopLossPct,
      providerName: signalProviders.name,
    })
    .from(copyPositions)
    .innerJoin(providerPositions, eq(copyPositions.providerPositionId, providerPositions.id))
    .innerJoin(signalProviders, eq(providerPositions.providerId, signalProviders.id))
    .where(and(eq(copyPositions.userId, userId), eq(copyPositions.status, "open")))
    .orderBy(desc(copyPositions.openedAt));

  return rows.map((r) => ({
    id: r.pos.id,
    symbol: r.pos.symbol,
    label: instrumentLabel(r.pos.symbol),
    side: r.pos.side,
    entryPrice: Number(r.pos.entryPrice),
    stakeMinor: r.pos.stakeMinor,
    slPct: r.slPct ? Number(r.slPct) : 0.02,
    provider: r.providerName,
    openedAt: new Date(r.pos.openedAt).toISOString(),
  }));
}

export type ClosedCopyPosition = {
  id: string;
  symbol: string;
  label: string;
  side: "buy" | "sell";
  entryPrice: number;
  exitPrice: number | null;
  stakeMinor: number;
  realizedPnl: number;
  provider: string;
  closedAt: string;
};

/** A user's closed copied trades, newest first — the real trade history. */
export async function listClosedCopyPositions(
  db: Database,
  userId: string,
  limit = 60,
): Promise<ClosedCopyPosition[]> {
  const rows = await db
    .select({ pos: copyPositions, providerName: signalProviders.name })
    .from(copyPositions)
    .innerJoin(providerPositions, eq(copyPositions.providerPositionId, providerPositions.id))
    .innerJoin(signalProviders, eq(providerPositions.providerId, signalProviders.id))
    .where(and(eq(copyPositions.userId, userId), eq(copyPositions.status, "closed")))
    .orderBy(desc(copyPositions.closedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.pos.id,
    symbol: r.pos.symbol,
    label: instrumentLabel(r.pos.symbol),
    side: r.pos.side,
    entryPrice: Number(r.pos.entryPrice),
    exitPrice: r.pos.exitPrice ? Number(r.pos.exitPrice) : null,
    stakeMinor: r.pos.stakeMinor,
    realizedPnl: r.pos.realizedPnl,
    provider: r.providerName,
    closedAt: r.pos.closedAt ? new Date(r.pos.closedAt).toISOString() : "",
  }));
}

/**
 * The live value of a user's active allocations, read from the ledger (principal
 * plus any settled P&L still sitting in the allocation account). Keyed by
 * providerId; also returns the total. This is the authoritative "money copying"
 * figure, since realized P&L settles into these accounts.
 */
export async function activeAllocationValues(
  db: Database,
  userId: string,
): Promise<{ totalMinor: number; byProvider: Record<string, number> }> {
  const active = await db
    .select({ providerId: allocations.providerId })
    .from(allocations)
    .where(and(eq(allocations.userId, userId), eq(allocations.status, "active")));

  const providerIds = Array.from(new Set(active.map((a) => a.providerId)));
  const byProvider: Record<string, number> = {};
  let totalMinor = 0;
  for (const providerId of providerIds) {
    const accId = await allocationAccountId(db, userId, providerId);
    const bal = accId ? await balanceOf(db, accId) : 0;
    byProvider[providerId] = bal;
    totalMinor += bal;
  }
  return { totalMinor, byProvider };
}

/** Total realized copy-trade P&L (net of fees) a user has banked. */
export async function realizedCopyPnl(db: Database, userId: string): Promise<number> {
  const rows = await db
    .select({ v: copyPositions.realizedPnl })
    .from(copyPositions)
    .where(and(eq(copyPositions.userId, userId), eq(copyPositions.status, "closed")));
  return rows.reduce((s, r) => s + (r.v ?? 0), 0);
}

/** Distinct symbols across a user's open positions — for the quote endpoint. */
export async function openSymbolsForUser(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ symbol: copyPositions.symbol })
    .from(copyPositions)
    .where(and(eq(copyPositions.userId, userId), eq(copyPositions.status, "open")));
  return Array.from(new Set(rows.map((r) => r.symbol)));
}

// Re-export so callers can validate requested symbols against what's priceable.
export { priceableSymbols };
