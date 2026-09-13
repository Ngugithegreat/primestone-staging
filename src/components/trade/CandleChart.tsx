"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  generateCandles,
  getInstrument,
  getTimeframe,
  type Candle,
  type TimeframeId,
} from "@/lib/market";
import { timeShort } from "@/lib/format";

export type ChartOverlay = {
  price: number;
  label: string;
  color: string;
  dashed?: boolean;
};

const PAD_RIGHT = 66;
const PAD_BOTTOM = 26;
const PAD_TOP = 14;

const COLORS = {
  up: "#00dfa4",
  down: "#f43f5e",
  upFill: "rgba(0,223,164,0.85)",
  downFill: "rgba(244,63,94,0.85)",
  grid: "rgba(255,255,255,0.045)",
  axis: "rgba(255,255,255,0.08)",
  text: "#64748b",
  crosshair: "rgba(255,255,255,0.28)",
};

/**
 * Candlestick chart on a 2D canvas.
 *
 * History is generated deterministically per (symbol, timeframe) and only the
 * final candle tracks the live quote, so the chart stays stable while still
 * showing a bar that breathes.
 */
export function CandleChart({
  symbol,
  timeframe,
  price,
  overlays = [],
  height = 420,
  showVolume = true,
}: {
  symbol: string;
  timeframe: TimeframeId;
  price: number;
  overlays?: ChartOverlay[];
  height?: number;
  showVolume?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: height });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<Candle | null>(null);

  const inst = getInstrument(symbol);
  const tf = getTimeframe(timeframe);

  const barCount = Math.max(40, Math.min(110, Math.floor(size.w / 11)));

  // The anchor is quantised to the timeframe so it doesn't churn every render.
  const anchor = useMemo(() => {
    const now = Date.now();
    return now - (now % tf.ms);
  }, [tf.ms]);

  const history = useMemo(
    () => generateCandles(symbol, timeframe, barCount, anchor),
    [symbol, timeframe, barCount, anchor],
  );

  // Merge the live quote into the final bar.
  const candles = useMemo(() => {
    if (!history.length) return history;
    const out = history.slice();
    const last = { ...out[out.length - 1]! };
    last.c = price;
    last.h = Math.max(last.h, price);
    last.l = Math.min(last.l, price);
    out[out.length - 1] = last;
    return out;
  }, [history, price]);

  /* -- Sizing ------------------------------------------------------------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  /* -- Draw --------------------------------------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const plotW = w - PAD_RIGHT;
    const volH = showVolume ? 52 : 0;
    const plotH = h - PAD_BOTTOM - PAD_TOP - volH;

    const highs = candles.map((c) => c.h);
    const lows = candles.map((c) => c.l);
    let max = Math.max(...highs);
    let min = Math.min(...lows);
    const pad = (max - min) * 0.08 || max * 0.001;
    max += pad;
    min -= pad;
    const span = max - min || 1;

    const yOf = (p: number) => PAD_TOP + (1 - (p - min) / span) * plotH;
    const step = plotW / candles.length;
    const bodyW = Math.max(1.5, Math.min(14, step * 0.62));

    /* Grid + price axis */
    ctx.font =
      '500 10.5px ui-monospace, "SF Mono", "JetBrains Mono", monospace';
    ctx.textBaseline = "middle";

    const gridLines = 6;
    for (let i = 0; i <= gridLines; i++) {
      const p = min + (span * i) / gridLines;
      const y = Math.round(yOf(p)) + 0.5;
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();

      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "left";
      ctx.fillText(p.toFixed(inst.digits), plotW + 8, y);
    }

    /* Vertical grid + time axis */
    const timeEvery = Math.max(1, Math.round(candles.length / 7));
    ctx.textAlign = "center";
    candles.forEach((c, i) => {
      if (i % timeEvery !== 0) return;
      const x = Math.round(i * step + step / 2) + 0.5;
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP);
      ctx.lineTo(x, PAD_TOP + plotH + volH);
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(timeShort(c.t), x, h - PAD_BOTTOM / 2);
    });

    /* Volume */
    if (showVolume) {
      const maxVol = Math.max(...candles.map((c) => c.v));
      const volTop = PAD_TOP + plotH + 8;
      candles.forEach((c, i) => {
        const x = i * step + (step - bodyW) / 2;
        const bh = (c.v / maxVol) * (volH - 12);
        ctx.fillStyle = c.c >= c.o ? "rgba(0,223,164,0.20)" : "rgba(244,63,94,0.20)";
        ctx.fillRect(x, volTop + (volH - 12 - bh), bodyW, bh);
      });
    }

    /* Candles */
    candles.forEach((c, i) => {
      const up = c.c >= c.o;
      const cx = i * step + step / 2;
      const x = cx - bodyW / 2;

      ctx.strokeStyle = up ? COLORS.up : COLORS.down;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(cx) + 0.5, yOf(c.h));
      ctx.lineTo(Math.round(cx) + 0.5, yOf(c.l));
      ctx.stroke();

      const yo = yOf(c.o);
      const yc = yOf(c.c);
      const top = Math.min(yo, yc);
      const bh = Math.max(1.2, Math.abs(yc - yo));
      ctx.fillStyle = up ? COLORS.upFill : COLORS.downFill;
      ctx.fillRect(x, top, bodyW, bh);
    });

    /* Overlays (entry / SL / TP) */
    for (const o of overlays) {
      if (o.price < min || o.price > max) continue;
      const y = Math.round(yOf(o.price)) + 0.5;
      ctx.save();
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 1;
      if (o.dashed) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
      ctx.restore();

      const label = o.label;
      ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = o.color;
      roundRect(ctx, 6, y - 8, tw + 12, 16, 3);
      ctx.fill();
      ctx.fillStyle = "#04060a";
      ctx.textAlign = "center";
      ctx.fillText(label, 6 + (tw + 12) / 2, y);
    }

    /* Current price */
    const lastUp = candles[candles.length - 1]!.c >= candles[candles.length - 1]!.o;
    const py = Math.round(yOf(price)) + 0.5;
    ctx.save();
    ctx.strokeStyle = lastUp ? COLORS.up : COLORS.down;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(plotW, py);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = lastUp ? COLORS.up : COLORS.down;
    roundRect(ctx, plotW + 3, py - 9, PAD_RIGHT - 8, 18, 3);
    ctx.fill();
    ctx.fillStyle = "#04060a";
    ctx.font = '600 10.5px ui-monospace, "SF Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText(price.toFixed(inst.digits), plotW + 3 + (PAD_RIGHT - 8) / 2, py);

    /* Crosshair */
    if (cursor && cursor.x < plotW) {
      ctx.save();
      ctx.strokeStyle = COLORS.crosshair;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(cursor.x) + 0.5, PAD_TOP);
      ctx.lineTo(Math.round(cursor.x) + 0.5, PAD_TOP + plotH + volH);
      ctx.moveTo(0, Math.round(cursor.y) + 0.5);
      ctx.lineTo(plotW, Math.round(cursor.y) + 0.5);
      ctx.stroke();
      ctx.restore();

      const hoverPrice = min + (1 - (cursor.y - PAD_TOP) / plotH) * span;
      if (cursor.y > PAD_TOP && cursor.y < PAD_TOP + plotH) {
        ctx.fillStyle = "#1a2333";
        roundRect(ctx, plotW + 3, cursor.y - 9, PAD_RIGHT - 8, 18, 3);
        ctx.fill();
        ctx.fillStyle = "#e6edf7";
        ctx.font = '500 10.5px ui-monospace, "SF Mono", monospace';
        ctx.textAlign = "center";
        ctx.fillText(
          hoverPrice.toFixed(inst.digits),
          plotW + 3 + (PAD_RIGHT - 8) / 2,
          cursor.y,
        );
      }
    }
  }, [candles, size, price, inst.digits, overlays, cursor, showVolume]);

  /* -- Interaction -------------------------------------------------------- */
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursor({ x, y });

    const plotW = size.w - PAD_RIGHT;
    const step = plotW / candles.length;
    const idx = Math.floor(x / step);
    setHovered(candles[idx] ?? null);
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none"
      style={{ height }}
      onMouseMove={onMove}
      onMouseLeave={() => {
        setCursor(null);
        setHovered(null);
      }}
    >
      <canvas ref={canvasRef} className="block cursor-crosshair" />

      {hovered && (
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-x-3 gap-y-0.5 rounded-lg border border-white/[0.08] bg-ink-900/92 px-2.5 py-1.5 text-[11px] backdrop-blur-md">
          {(
            [
              ["O", hovered.o],
              ["H", hovered.h],
              ["L", hovered.l],
              ["C", hovered.c],
            ] as const
          ).map(([k, v]) => (
            <span key={k} className="tnum text-slate-400">
              {k}{" "}
              <span className={hovered.c >= hovered.o ? "text-mint-400" : "text-rose-400"}>
                {v.toFixed(inst.digits)}
              </span>
            </span>
          ))}
          <span className="tnum text-slate-500">Vol {hovered.v.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
