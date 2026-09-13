"use client";

import { useHydrated, useStore } from "@/lib/store";
import { WalletView } from "./WalletView";
import { RealWallet } from "./RealWallet";

/**
 * Real accounts get the ledger-backed wallet (M-Pesa deposits, real balance,
 * real allocations). Demo sessions keep the simulated wallet.
 */
export function WalletRouter() {
  const hydrated = useHydrated();
  const sessionMode = useStore((s) => s.sessionMode);
  if (!hydrated) return null;
  return sessionMode === "real" ? <RealWallet /> : <WalletView />;
}
