"use client";

import { useEffect, useId, useRef } from "react";
import type { TimeframeId } from "@/lib/market";

/**
 * Live market chart powered by TradingView's embeddable widget — real,
 * professional price data for every symbol, with no API key. We map our
 * instrument ids to TradingView's exchange:symbol format.
 */

const TV_SYMBOL: Record<string, string> = {
  EURUSD: "FX:EURUSD",
  GBPUSD: "FX:GBPUSD",
  USDJPY: "FX:USDJPY",
  AUDUSD: "FX:AUDUSD",
  USDCAD: "FX:USDCAD",
  USDCHF: "FX:USDCHF",
  XAUUSD: "OANDA:XAUUSD",
  XAGUSD: "OANDA:XAGUSD",
  BTCUSD: "BINANCE:BTCUSDT",
  ETHUSD: "BINANCE:ETHUSDT",
  SOLUSD: "BINANCE:SOLUSDT",
  XRPUSD: "BINANCE:XRPUSDT",
  US100: "CAPITALCOM:US100",
  US30: "CAPITALCOM:US30",
  GER40: "CAPITALCOM:DE40",
  AAPL: "NASDAQ:AAPL",
  TSLA: "NASDAQ:TSLA",
  NVDA: "NASDAQ:NVDA",
};

const TV_INTERVAL: Record<TimeframeId, string> = {
  M5: "5",
  M15: "15",
  H1: "60",
  H4: "240",
  D1: "D",
};

const SCRIPT_SRC = "https://s3.tradingview.com/tv.js";

declare global {
  interface Window {
    TradingView?: { widget: new (config: Record<string, unknown>) => unknown };
  }
}

function loadTv(): Promise<void> {
  return new Promise((resolve) => {
    if (window.TradingView) return resolve();
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export function LiveChart({
  symbol,
  timeframe,
}: {
  symbol: string;
  timeframe: TimeframeId;
}) {
  const rawId = useId();
  const containerId = `tv_${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadTv().then(() => {
      if (cancelled || !ref.current || !window.TradingView) return;
      ref.current.innerHTML = "";
      new window.TradingView.widget({
        container_id: containerId,
        autosize: true,
        symbol: TV_SYMBOL[symbol] ?? "OANDA:XAUUSD",
        interval: TV_INTERVAL[timeframe] ?? "60",
        timezone: "Africa/Nairobi",
        theme: "dark",
        style: "1", // candles
        locale: "en",
        toolbar_bg: "#070a11",
        enable_publishing: false,
        hide_side_toolbar: true,
        allow_symbol_change: false,
        withdateranges: true,
        details: false,
        backgroundColor: "#070a11",
        gridColor: "rgba(255,255,255,0.05)",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, containerId]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/[0.07] bg-ink-900">
      <div id={containerId} ref={ref} className="h-full w-full" />
    </div>
  );
}
