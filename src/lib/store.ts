"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type AccountTypeId, getAccountType } from "./accounts";
import type { IdType, KycDocument, KycStatus } from "./kyc";
import { getInstrument, pnlOf, round, type Side } from "./market";
import { seeded, uid } from "./utils";
import { TRADERS } from "./traders";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type User = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  accountType: AccountTypeId;
  leverage: number;
  createdAt: number;
  kycVerified: boolean;
};

export type KycSubmission = {
  status: KycStatus;
  idType: IdType;
  idNumberMasked: string;
  dateOfBirth: string;
  residentialAddress: string;
  documents: KycDocument[];
  submittedAt: number | null;
  reviewedAt: number | null;
  rejectionReason: string | null;
};

const EMPTY_KYC: KycSubmission = {
  status: "unverified",
  idType: "National ID",
  idNumberMasked: "",
  dateOfBirth: "",
  residentialAddress: "",
  documents: [],
  submittedAt: null,
  reviewedAt: null,
  rejectionReason: null,
};

export type Position = {
  id: string;
  symbol: string;
  side: Side;
  lots: number;
  entry: number;
  openedAt: number;
  sl: number | null;
  tp: number | null;
  /** Set when the trade came from a copied strategy provider. */
  copiedFrom: string | null;
  commission: number;
  swap: number;
};

export type ClosedPosition = Position & {
  exit: number;
  closedAt: number;
  pnl: number;
  closeReason: "manual" | "sl" | "tp" | "copy-stopped";
};

export type Copy = {
  id: string;
  traderId: string;
  allocated: number;
  /** Multiplier applied to the provider's position size. */
  riskMultiplier: number;
  copyStopLoss: number | null;
  startedAt: number;
  status: "active" | "paused";
  realizedPnl: number;
  openPnl: number;
  tradesCopied: number;
};

export type Txn = {
  id: string;
  kind: "deposit" | "withdrawal";
  method: "mpesa" | "crypto" | "card" | "bank";
  amount: number;
  fee: number;
  status: "completed" | "pending" | "processing" | "failed";
  reference: string;
  detail: string;
  createdAt: number;
};

export type Toast = {
  id: string;
  title: string;
  body?: string;
  tone: "success" | "error" | "info";
};

type State = {
  hydrated: boolean;
  user: User | null;
  balance: number;
  demoCredit: number;
  positions: Position[];
  history: ClosedPosition[];
  copies: Copy[];
  txns: Txn[];
  toasts: Toast[];
  watchlist: string[];
  kyc: KycSubmission;
  /** "real" = authenticated against the Postgres backend; "demo" = local only. */
  sessionMode: "real" | "demo" | null;
};

type Actions = {
  register: (input: Omit<User, "createdAt" | "kycVerified">) => void;
  signIn: (email: string) => void;
  /** Populate app state from a real, server-authenticated user. */
  signInReal: (input: {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    accountType: AccountTypeId;
    leverage: number;
    kycVerified: boolean;
  }) => void;
  signOut: () => void;
  updateUser: (patch: Partial<User>) => void;

  openPosition: (input: {
    symbol: string;
    side: Side;
    lots: number;
    price: number;
    sl?: number | null;
    tp?: number | null;
    copiedFrom?: string | null;
  }) => { ok: boolean; message: string };
  closePosition: (id: string, price: number, reason?: ClosedPosition["closeReason"]) => void;
  closeAll: (prices: Record<string, number>) => void;
  modifyPosition: (id: string, patch: { sl?: number | null; tp?: number | null }) => void;

  startCopy: (traderId: string, allocated: number, riskMultiplier: number, copyStopLoss: number | null) => { ok: boolean; message: string };
  stopCopy: (id: string) => void;
  toggleCopy: (id: string) => void;
  adjustCopy: (id: string, patch: Partial<Pick<Copy, "allocated" | "riskMultiplier" | "copyStopLoss">>) => void;

  deposit: (input: { method: Txn["method"]; amount: number; detail: string }) => Txn;
  withdraw: (input: { method: Txn["method"]; amount: number; detail: string }) => { ok: boolean; message: string; txn?: Txn };
  settleTxn: (id: string) => void;

  submitKyc: (input: {
    idType: IdType;
    idNumberMasked: string;
    dateOfBirth: string;
    residentialAddress: string;
    documents: KycDocument[];
  }) => void;
  /** Used by the admin console to approve or reject the live session's submission. */
  reviewKyc: (status: Extract<KycStatus, "verified" | "rejected">, reason?: string) => void;
  resetKyc: () => void;
  /** Sync the KYC status from the server (real, ledger-backed accounts). */
  setKycStatus: (status: KycStatus) => void;
  /** Switch between the real (ledger) account and the demo practice account. */
  setSessionMode: (mode: "real" | "demo") => void;

  toggleWatch: (symbol: string) => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  resetDemo: () => void;
};

export type Store = State & Actions;

/* -------------------------------------------------------------------------- */
/*  Seed data — a brand-new account still has something to look at             */
/* -------------------------------------------------------------------------- */

const DAY = 86_400_000;

function seedTxns(now: number, credit: number): Txn[] {
  return [
    {
      id: uid("tx"),
      kind: "deposit",
      method: "mpesa",
      amount: credit,
      fee: 0,
      status: "completed",
      reference: "PS-WELCOME-01",
      detail: "Welcome demo credit",
      createdAt: now,
    },
  ];
}

/**
 * Back-fills a plausible trade history so the portfolio analytics have
 * something real to compute over on day one.
 */
function seedHistory(
  now: number,
  accountType: AccountTypeId,
  credit: number,
): ClosedPosition[] {
  const rand = seeded(20260721);
  const acct = getAccountType(accountType);
  const symbols = ["EURUSD", "XAUUSD", "BTCUSD", "US100", "GBPUSD", "USDJPY", "ETHUSD", "NVDA"];
  const out: ClosedPosition[] = [];

  for (let i = 0; i < 24; i++) {
    const symbol = symbols[Math.floor(rand() * symbols.length)]!;
    const inst = getInstrument(symbol);
    const side: Side = rand() > 0.46 ? "buy" : "sell";
    const lots = round(0.02 + rand() * 0.38, 2);
    const entry = round(inst.base * (1 + (rand() - 0.5) * 0.03), inst.digits);
    const openedAt = now - (i + 1) * DAY * (0.4 + rand()) - rand() * DAY;
    const commission = round(lots * acct.commissionPerLot, 2);

    // Draw the result first, then solve for the exit price that produces it.
    // Sizing every trade off a fixed fraction of the account keeps the demo
    // history proportionate whichever account type was opened, instead of
    // letting a single gold or bitcoin trade dominate the whole curve.
    const win = rand() < 0.62;
    const riskUnit = credit * 0.008;
    const pnl = round(
      win ? riskUnit * (0.8 + rand() * 2.4) : -riskUnit * (0.5 + rand() * 1.1),
      2,
    );
    const direction = side === "buy" ? 1 : -1;
    const exit = round(
      entry + (pnl + commission) / (direction * lots * inst.contractSize),
      inst.digits,
    );

    out.push({
      id: uid("h"),
      symbol,
      side,
      lots,
      entry,
      exit,
      openedAt,
      closedAt: openedAt + (0.5 + rand() * 20) * 3_600_000,
      sl: null,
      tp: null,
      copiedFrom: rand() < 0.55 ? TRADERS[Math.floor(rand() * TRADERS.length)]!.id : null,
      commission,
      swap: 0,
      pnl,
      closeReason: win ? "tp" : rand() < 0.5 ? "sl" : "manual",
    });
  }

  return out.sort((a, b) => b.closedAt - a.closedAt);
}

function seedPositions(now: number): Position[] {
  const rand = seeded(778811);
  const picks: Array<[string, Side, number, string | null]> = [
    ["XAUUSD", "buy", 0.25, "kw-mwangi"],
    ["EURUSD", "buy", 0.5, "elena-fischer"],
    ["BTCUSD", "sell", 0.08, null],
    ["US100", "buy", 0.3, "david-chen"],
  ];

  return picks.map(([symbol, side, lots, copiedFrom]) => {
    const inst = getInstrument(symbol);
    return {
      id: uid("p"),
      symbol,
      side,
      lots,
      entry: round(inst.base * (1 + (rand() - 0.55) * 0.012), inst.digits),
      openedAt: now - rand() * DAY * 3,
      sl: null,
      tp: null,
      copiedFrom,
      commission: 0,
      swap: 0,
    };
  });
}

function seedCopies(now: number): Copy[] {
  return [
    {
      id: uid("c"),
      traderId: "kw-mwangi",
      allocated: 2_500,
      riskMultiplier: 1,
      copyStopLoss: 30,
      startedAt: now - DAY * 46,
      status: "active",
      realizedPnl: 412.86,
      openPnl: 0,
      tradesCopied: 38,
    },
    {
      id: uid("c"),
      traderId: "elena-fischer",
      allocated: 1_500,
      riskMultiplier: 0.5,
      copyStopLoss: 25,
      startedAt: now - DAY * 19,
      status: "active",
      realizedPnl: 138.42,
      openPnl: 0,
      tradesCopied: 61,
    },
    {
      id: uid("c"),
      traderId: "david-chen",
      allocated: 1_000,
      riskMultiplier: 1.5,
      copyStopLoss: null,
      startedAt: now - DAY * 8,
      status: "paused",
      realizedPnl: -64.2,
      openPnl: 0,
      tradesCopied: 12,
    },
  ];
}

const EMPTY: State = {
  hydrated: false,
  user: null,
  balance: 0,
  demoCredit: 0,
  positions: [],
  history: [],
  copies: [],
  txns: [],
  toasts: [],
  watchlist: ["EURUSD", "XAUUSD", "BTCUSD", "US100", "GBPUSD"],
  kyc: EMPTY_KYC,
  sessionMode: null,
};

/* -------------------------------------------------------------------------- */
/*  Store                                                                      */
/* -------------------------------------------------------------------------- */

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      register: (input) => {
        const now = Date.now();
        const credit = getAccountType(input.accountType).demoCredit;
        // A brand-new account starts clean: no copied positions, no active
        // copies, no history. Trades only begin once the user chooses a
        // provider to copy (or places their own).
        set({
          user: { ...input, createdAt: now, kycVerified: false },
          balance: credit,
          demoCredit: credit,
          positions: [],
          history: [],
          copies: [],
          txns: seedTxns(now, credit),
          toasts: [],
          kyc: EMPTY_KYC,
          sessionMode: "demo",
        });
      },

      signIn: (email) => {
        const existing = get().user;
        if (existing) return;
        const now = Date.now();
        const credit = getAccountType("standard").demoCredit;
        const name = email.split("@")[0] ?? "Trader";
        set({
          user: {
            firstName: name.charAt(0).toUpperCase() + name.slice(1),
            lastName: "",
            email,
            phone: "",
            country: "Kenya",
            accountType: "standard",
            leverage: 500,
            createdAt: now,
            kycVerified: false,
          },
          balance: credit,
          demoCredit: credit,
          positions: [],
          history: [],
          copies: [],
          txns: seedTxns(now, credit),
          kyc: EMPTY_KYC,
          sessionMode: "demo",
        });
      },

      signInReal: (input) => {
        const now = Date.now();
        const existing = get();
        // Preserve any app state already loaded for this session; only seed
        // fresh demo trading state when there is none yet.
        const needsSeed = !existing.user || existing.sessionMode == null;
        const credit = getAccountType(input.accountType).demoCredit;
        set({
          user: { ...input, createdAt: now },
          // Default new sessions to the real account; preserve a demo choice.
          sessionMode: existing.sessionMode ?? "real",
          ...(needsSeed
            ? {
                balance: credit,
                demoCredit: credit,
                // Clean start — no copies or positions until the user subscribes.
                positions: [],
                history: [],
                copies: [],
                txns: seedTxns(now, credit),
                kyc: input.kycVerified
                  ? { ...EMPTY_KYC, status: "verified" as const }
                  : EMPTY_KYC,
              }
            : {}),
        });
      },

      signOut: () => set({ ...EMPTY, hydrated: true }),

      updateUser: (patch) => {
        const user = get().user;
        if (!user) return;
        set({ user: { ...user, ...patch } });
      },

      openPosition: ({ symbol, side, lots, price, sl = null, tp = null, copiedFrom = null }) => {
        const state = get();
        if (!state.user) return { ok: false, message: "Sign in to place an order." };
        if (lots <= 0) return { ok: false, message: "Volume must be greater than zero." };

        const inst = getInstrument(symbol);
        const acct = getAccountType(state.user.accountType);
        const notional = price * lots * inst.contractSize;
        const margin = notional / state.user.leverage;

        if (margin > state.balance) {
          return {
            ok: false,
            message: `Not enough free margin. This order needs $${margin.toFixed(2)}.`,
          };
        }

        const commission = round(lots * acct.commissionPerLot, 2);
        const position: Position = {
          id: uid("p"),
          symbol,
          side,
          lots,
          entry: price,
          openedAt: Date.now(),
          sl,
          tp,
          copiedFrom,
          commission,
          swap: 0,
        };

        set({
          positions: [position, ...state.positions],
          balance: round(state.balance - commission, 2),
        });
        return { ok: true, message: `${side === "buy" ? "Bought" : "Sold"} ${lots} ${symbol} at ${price}` };
      },

      closePosition: (id, price, reason = "manual") => {
        const state = get();
        const pos = state.positions.find((p) => p.id === id);
        if (!pos) return;

        const inst = getInstrument(pos.symbol);
        const pnl = round(pnlOf(pos.side, pos.entry, price, pos.lots, inst), 2);

        const closed: ClosedPosition = {
          ...pos,
          exit: price,
          closedAt: Date.now(),
          pnl,
          closeReason: reason,
        };

        // Copied trades settle their P&L against the copy allocation too.
        const copies = pos.copiedFrom
          ? state.copies.map((c) =>
              c.traderId === pos.copiedFrom
                ? { ...c, realizedPnl: round(c.realizedPnl + pnl, 2), tradesCopied: c.tradesCopied + 1 }
                : c,
            )
          : state.copies;

        set({
          positions: state.positions.filter((p) => p.id !== id),
          history: [closed, ...state.history],
          balance: round(state.balance + pnl, 2),
          copies,
        });
      },

      closeAll: (prices) => {
        const state = get();
        if (!state.positions.length) return;
        for (const pos of [...state.positions]) {
          const price = prices[pos.symbol] ?? pos.entry;
          get().closePosition(pos.id, price, "manual");
        }
      },

      modifyPosition: (id, patch) =>
        set({
          positions: get().positions.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }),

      startCopy: (traderId, allocated, riskMultiplier, copyStopLoss) => {
        const state = get();
        if (!state.user) return { ok: false, message: "Sign in to copy a trader." };
        if (state.copies.some((c) => c.traderId === traderId && c.status !== "paused")) {
          return { ok: false, message: "You are already copying this trader." };
        }
        if (allocated > state.balance) {
          return { ok: false, message: "Allocation exceeds your available balance." };
        }

        const copy: Copy = {
          id: uid("c"),
          traderId,
          allocated,
          riskMultiplier,
          copyStopLoss,
          startedAt: Date.now(),
          status: "active",
          realizedPnl: 0,
          openPnl: 0,
          tradesCopied: 0,
        };
        set({ copies: [copy, ...state.copies] });
        return { ok: true, message: "Copying started. New signals will mirror to your account." };
      },

      stopCopy: (id) => set({ copies: get().copies.filter((c) => c.id !== id) }),

      toggleCopy: (id) =>
        set({
          copies: get().copies.map((c) =>
            c.id === id ? { ...c, status: c.status === "active" ? "paused" : "active" } : c,
          ),
        }),

      adjustCopy: (id, patch) =>
        set({ copies: get().copies.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),

      deposit: ({ method, amount, detail }) => {
        const state = get();
        const instant = method === "card" || method === "mpesa";
        const txn: Txn = {
          id: uid("tx"),
          kind: "deposit",
          method,
          amount: round(amount, 2),
          fee: 0,
          status: instant ? "completed" : "processing",
          reference: `PS-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
          detail,
          createdAt: Date.now(),
        };
        set({
          txns: [txn, ...state.txns],
          balance: instant ? round(state.balance + amount, 2) : state.balance,
        });
        return txn;
      },

      withdraw: ({ method, amount, detail }) => {
        const state = get();
        // Identity verification is a hard gate on the money leaving.
        if (state.kyc.status !== "verified") {
          return {
            ok: false,
            message: "Verify your identity before withdrawing.",
          };
        }
        const fee = method === "crypto" ? 2.5 : method === "bank" ? 15 : 0;
        const total = amount + fee;
        if (total > state.balance) {
          return { ok: false, message: "Amount plus fee exceeds your available balance." };
        }
        const txn: Txn = {
          id: uid("tx"),
          kind: "withdrawal",
          method,
          amount: round(amount, 2),
          fee,
          status: "pending",
          reference: `PS-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
          detail,
          createdAt: Date.now(),
        };
        set({ txns: [txn, ...state.txns], balance: round(state.balance - total, 2) });
        return { ok: true, message: "Withdrawal submitted for processing.", txn };
      },

      settleTxn: (id) => {
        const state = get();
        const txn = state.txns.find((t) => t.id === id);
        if (!txn || txn.status === "completed") return;
        set({
          txns: state.txns.map((t) => (t.id === id ? { ...t, status: "completed" } : t)),
          balance:
            txn.kind === "deposit" ? round(state.balance + txn.amount, 2) : state.balance,
        });
      },

      submitKyc: ({ idType, idNumberMasked, dateOfBirth, residentialAddress, documents }) => {
        set({
          kyc: {
            status: "pending",
            idType,
            idNumberMasked,
            dateOfBirth,
            residentialAddress,
            documents,
            submittedAt: Date.now(),
            reviewedAt: null,
            rejectionReason: null,
          },
        });
        get().pushToast({
          tone: "success",
          title: "Documents submitted",
          body: "Your identity check is now under review. Withdrawals unlock once approved.",
        });
      },

      reviewKyc: (status, reason) => {
        const kyc = get().kyc;
        if (kyc.status === "unverified") return;
        set({
          kyc: {
            ...kyc,
            status,
            reviewedAt: Date.now(),
            rejectionReason: status === "rejected" ? (reason ?? "Submission could not be verified.") : null,
          },
          user: get().user ? { ...get().user!, kycVerified: status === "verified" } : null,
        });
      },

      resetKyc: () => set({ kyc: EMPTY_KYC }),

      setKycStatus: (status) => {
        const { kyc, user } = get();
        set({
          kyc: { ...kyc, status },
          user: user ? { ...user, kycVerified: status === "verified" } : user,
        });
      },

      setSessionMode: (mode) => set({ sessionMode: mode }),

      toggleWatch: (symbol) => {
        const list = get().watchlist;
        set({
          watchlist: list.includes(symbol)
            ? list.filter((s) => s !== symbol)
            : [...list, symbol],
        });
      },

      pushToast: (t) => {
        const toast = { ...t, id: uid("t") };
        set({ toasts: [...get().toasts, toast] });
        setTimeout(() => get().dismissToast(toast.id), 4600);
      },

      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

      resetDemo: () => {
        const user = get().user;
        if (!user) return;
        const now = Date.now();
        const credit = getAccountType(user.accountType).demoCredit;
        set({
          balance: credit,
          demoCredit: credit,
          positions: seedPositions(now),
          history: seedHistory(now, user.accountType, credit),
          copies: seedCopies(now),
          txns: seedTxns(now, credit),
        });
      },
    }),
    {
      // v2: dropped `user`/`sessionMode` from persistence (auth is now
      // server-cookie only). New key so stale v1 blobs — which still hold a
      // `user` — are abandoned rather than rehydrated into a password-less login.
      name: "primestone.session.v2",
      storage: createJSONStorage(() => localStorage),
      // NB: `user` is deliberately NOT persisted. Who is signed in is decided
      // ONLY by the httpOnly server session cookie (validated via /api/auth/me),
      // never by localStorage. `sessionMode` IS persisted — it's just a UI
      // preference (real vs demo view) and grants no access on its own.
      partialize: (s) => ({
        balance: s.balance,
        demoCredit: s.demoCredit,
        positions: s.positions,
        history: s.history,
        copies: s.copies,
        txns: s.txns,
        watchlist: s.watchlist,
        sessionMode: s.sessionMode,
      }),
    },
  ),
);

/**
 * Gates the authenticated UI until after the first client paint.
 *
 * `persist` reads localStorage synchronously while the store module is
 * evaluating, so the data is already in place by the time this effect runs.
 * Flipping the flag from an effect (rather than from `onRehydrateStorage`)
 * means the first client render still matches the server HTML, so there is no
 * hydration mismatch — and it avoids touching `useStore` before it is assigned.
 */
export function useHydrated() {
  const hydrated = useStore((s) => s.hydrated);
  useEffect(() => {
    if (!useStore.getState().hydrated) useStore.setState({ hydrated: true });
  }, []);
  return hydrated;
}

/* -------------------------------------------------------------------------- */
/*  Derived selectors                                                          */
/* -------------------------------------------------------------------------- */

export function openPnl(positions: Position[], prices: Record<string, number>) {
  return positions.reduce((sum, p) => {
    const inst = getInstrument(p.symbol);
    const price = prices[p.symbol] ?? p.entry;
    return sum + pnlOf(p.side, p.entry, price, p.lots, inst);
  }, 0);
}

export function usedMargin(positions: Position[], prices: Record<string, number>, leverage: number) {
  return positions.reduce((sum, p) => {
    const inst = getInstrument(p.symbol);
    const price = prices[p.symbol] ?? p.entry;
    return sum + (price * p.lots * inst.contractSize) / leverage;
  }, 0);
}

export type PortfolioStats = {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  gross: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalVolume: number;
};

export function portfolioStats(history: ClosedPosition[]): PortfolioStats {
  const wins = history.filter((h) => h.pnl > 0);
  const losses = history.filter((h) => h.pnl <= 0);
  const grossWin = wins.reduce((s, h) => s + h.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, h) => s + h.pnl, 0));

  return {
    total: history.length,
    wins: wins.length,
    losses: losses.length,
    winRate: history.length ? (wins.length / history.length) * 100 : 0,
    gross: grossWin - grossLoss,
    bestTrade: history.length ? Math.max(...history.map((h) => h.pnl)) : 0,
    worstTrade: history.length ? Math.min(...history.map((h) => h.pnl)) : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    totalVolume: history.reduce((s, h) => s + h.lots, 0),
  };
}
