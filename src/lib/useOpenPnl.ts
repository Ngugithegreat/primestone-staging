"use client";

import { useEffect, useRef, useState } from "react";
import { getQuotes, unrealizedPnlMinor, type RealOpenPosition } from "./accountClient";

/**
 * Live total unrealized P&L (USD minor) across a real account's open copied
 * positions — polls real quotes and marks each position to the risk model.
 */
export function useLiveOpenPnl(positions: RealOpenPosition[], pollMs = 5000): number {
  const [pnlMinor, setPnlMinor] = useState(0);
  const symbols = Array.from(new Set(positions.map((p) => p.symbol)));
  const key = symbols.slice().sort().join(",");
  const posRef = useRef(positions);
  posRef.current = positions;

  useEffect(() => {
    if (key === "") {
      setPnlMinor(0);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const q = await getQuotes(key.split(","));
      if (cancelled) return;
      const total = posRef.current.reduce(
        (s, p) => s + (unrealizedPnlMinor(p, q[p.symbol]) ?? 0),
        0,
      );
      setPnlMinor(total);
    };
    run();
    const id = window.setInterval(run, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [key, pollMs]);

  return pnlMinor;
}
