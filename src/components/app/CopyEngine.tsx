"use client";

import { useEffect, useRef } from "react";
import { useMarket } from "@/components/providers/MarketProvider";
import { getInstrument, round, type Side } from "@/lib/market";
import { useStore } from "@/lib/store";
import { getTrader } from "@/lib/traders";

/**
 * Headless background worker for the authenticated app.
 *
 * Two jobs:
 *  1. Enforce stop-loss and take-profit on open positions as quotes move.
 *  2. Mirror new signals from active copy relationships, sized against the
 *     allocation the user set for that provider.
 *
 * Renders nothing.
 */
export function CopyEngine() {
  const { prices, live } = useMarket();
  const sessionMode = useStore((s) => s.sessionMode);
  const positions = useStore((s) => s.positions);
  const copies = useStore((s) => s.copies);

  // The simulated trading engine only runs for demo sessions. On a real (live)
  // account, copied trades are handled by the backend, never this demo loop.
  const demo = sessionMode !== "real";

  // Read through refs inside the interval so the timer isn't torn down and
  // recreated on every price tick.
  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  const copiesRef = useRef(copies);
  copiesRef.current = copies;

  /* ---- Stop-loss / take-profit ------------------------------------------ */
  useEffect(() => {
    if (!demo || !live || positions.length === 0) return;
    const { closePosition, pushToast } = useStore.getState();

    for (const p of positions) {
      const price = prices[p.symbol];
      if (price == null) continue;

      const hitSl =
        p.sl != null && (p.side === "buy" ? price <= p.sl : price >= p.sl);
      const hitTp =
        p.tp != null && (p.side === "buy" ? price >= p.tp : price <= p.tp);

      if (hitSl || hitTp) {
        closePosition(p.id, hitSl ? p.sl! : p.tp!, hitSl ? "sl" : "tp");
        pushToast({
          tone: hitSl ? "error" : "success",
          title: hitSl ? "Stop-loss hit" : "Take-profit hit",
          body: `${p.symbol} ${p.side.toUpperCase()} ${p.lots} closed at ${hitSl ? p.sl : p.tp}.`,
        });
      }
    }
  }, [prices, positions, live, demo]);

  /* ---- Mirrored signals -------------------------------------------------- */
  useEffect(() => {
    if (!demo || !live) return;

    const timer = window.setInterval(() => {
      const active = copiesRef.current.filter((c) => c.status === "active");
      if (active.length === 0) return;
      // Providers do not fire constantly — most ticks are quiet.
      if (Math.random() > 0.42) return;

      const copy = active[Math.floor(Math.random() * active.length)]!;
      const trader = getTrader(copy.traderId);
      if (!trader) return;

      const symbol = trader.markets[Math.floor(Math.random() * trader.markets.length)]!;
      const inst = getInstrument(symbol);
      const price = pricesRef.current[symbol];
      if (price == null) return;

      const side: Side = Math.random() < 0.56 ? "buy" : "sell";

      // Size the mirrored order to the allocation: risk ~1.5% of the
      // allocation on the trade, scaled by the user's risk multiplier.
      const riskBudget = copy.allocated * 0.015 * copy.riskMultiplier;
      const stopDistance = price * inst.vol * 2.4;
      const rawLots = riskBudget / (stopDistance * inst.contractSize);
      const lots = round(Math.max(0.01, Math.min(rawLots, 5)), 2);

      const sl = round(side === "buy" ? price - stopDistance : price + stopDistance, inst.digits);
      const tp = round(
        side === "buy" ? price + stopDistance * 1.8 : price - stopDistance * 1.8,
        inst.digits,
      );

      const { openPosition, pushToast } = useStore.getState();
      const result = openPosition({
        symbol,
        side,
        lots,
        price,
        sl,
        tp,
        copiedFrom: copy.traderId,
      });

      if (result.ok) {
        pushToast({
          tone: "info",
          title: `Signal mirrored · ${trader.name}`,
          body: `${side.toUpperCase()} ${lots} ${symbol} at ${price}`,
        });
      }
    }, 24_000);

    return () => window.clearInterval(timer);
  }, [live, demo]);

  /* ---- Copy stop-loss ---------------------------------------------------- */
  useEffect(() => {
    if (!demo || !live) return;

    const timer = window.setInterval(() => {
      const state = useStore.getState();
      for (const copy of state.copies) {
        if (copy.status !== "active" || copy.copyStopLoss == null) continue;

        const drawdown = (-copy.realizedPnl / copy.allocated) * 100;
        if (drawdown < copy.copyStopLoss) continue;

        // Threshold breached: unwind everything from this provider and cut the link.
        for (const p of state.positions.filter((x) => x.copiedFrom === copy.traderId)) {
          state.closePosition(p.id, pricesRef.current[p.symbol] ?? p.entry, "copy-stopped");
        }
        state.stopCopy(copy.id);
        state.pushToast({
          tone: "error",
          title: "Copy stop-loss triggered",
          body: `${getTrader(copy.traderId)?.name ?? "Provider"} hit -${copy.copyStopLoss}%. All copied positions were closed.`,
        });
      }
    }, 8_000);

    return () => window.clearInterval(timer);
  }, [live, demo]);

  return null;
}
