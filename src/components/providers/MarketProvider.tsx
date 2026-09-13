"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { INSTRUMENTS, nextTick, type Instrument } from "@/lib/market";

export type Quote = {
  price: number;
  prev: number;
  /** Percent change against the instrument's session open. */
  changePct: number;
  dir: 1 | -1 | 0;
};

type MarketContextValue = {
  quotes: Record<string, Quote>;
  prices: Record<string, number>;
  live: boolean;
};

const seedQuotes = (): Record<string, Quote> =>
  Object.fromEntries(
    INSTRUMENTS.map((i) => [
      i.id,
      { price: i.base, prev: i.base, changePct: i.drift, dir: 0 as const },
    ]),
  );

const MarketContext = createContext<MarketContextValue>({
  quotes: seedQuotes(),
  prices: Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i.base])),
  live: false,
});

const TICK_MS = 1100;

/** Our crypto instrument ids mapped to Binance ticker symbols. */
const LIVE_CRYPTO: Record<string, string> = {
  BTCUSD: "BTCUSDT",
  ETHUSD: "ETHUSDT",
  SOLUSD: "SOLUSDT",
  XRPUSD: "XRPUSDT",
};
const BINANCE_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(LIVE_CRYPTO).map(([id, sym]) => [sym, id]),
);

/**
 * Drives every price on the site from one interval. Ticking starts only after
 * mount, so the server-rendered quote (the instrument's base price) is what
 * the client renders on its first pass too.
 */
export function MarketProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>(seedQuotes);
  const [live, setLive] = useState(false);
  const opens = useRef<Record<string, number>>(
    Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i.base / (1 + i.drift / 100)])),
  );

  useEffect(() => {
    setLive(true);
    const byId: Record<string, Instrument> = Object.fromEntries(
      INSTRUMENTS.map((i) => [i.id, i]),
    );

    const id = window.setInterval(() => {
      setQuotes((current) => {
        const next: Record<string, Quote> = {};
        for (const key of Object.keys(current)) {
          // Crypto is driven by the real Binance feed below — don't overwrite it.
          if (LIVE_CRYPTO[key]) {
            next[key] = current[key]!;
            continue;
          }
          const inst = byId[key]!;
          const prev = current[key]!.price;
          // Only a subset of the board moves on any given tick, which reads far
          // more like a real feed than every row flickering in lockstep.
          const price = Math.random() < 0.55 ? nextTick(prev, inst) : prev;
          const open = opens.current[key] ?? inst.base;
          next[key] = {
            price,
            prev,
            changePct: ((price - open) / open) * 100,
            dir: price > prev ? 1 : price < prev ? -1 : 0,
          };
        }
        return next;
      });
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, []);

  // Real-time crypto quotes from Binance's public stream (no API key). These
  // symbols then match the live chart exactly.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: number | null = null;

    const streams = Object.values(LIVE_CRYPTO)
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join("/");

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

      ws.onmessage = (evt) => {
        try {
          const { data } = JSON.parse(evt.data);
          const symbol = BINANCE_TO_ID[data.s];
          if (!symbol) return;
          const price = parseFloat(data.c); // last price
          const changePct = parseFloat(data.P); // 24h change %
          setQuotes((current) => {
            const prev = current[symbol]?.price ?? price;
            return {
              ...current,
              [symbol]: {
                price,
                prev,
                changePct,
                dir: price > prev ? 1 : price < prev ? -1 : 0,
              },
            };
          });
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        if (!closed) retry = window.setTimeout(connect, 4000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      ws?.close();
    };
  }, []);

  const value = useMemo<MarketContextValue>(
    () => ({
      quotes,
      prices: Object.fromEntries(Object.entries(quotes).map(([k, v]) => [k, v.price])),
      live,
    }),
    [quotes, live],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  return useContext(MarketContext);
}

export function useQuote(symbol: string): Quote {
  const { quotes } = useMarket();
  return quotes[symbol] ?? { price: 0, prev: 0, changePct: 0, dir: 0 };
}
