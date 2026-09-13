import { seeded } from "./utils";

export type AssetClass = "forex" | "crypto" | "metals" | "indices" | "stocks";

export type Instrument = {
  id: string;
  name: string;
  cls: AssetClass;
  base: number;
  digits: number;
  /** Per-bar volatility as a fraction of price. */
  vol: number;
  /** Raw spread in price units. */
  spread: number;
  /** Units of the base asset in one standard lot. */
  contractSize: number;
  /** Nominal 24h drift used to seed the daily change, in percent. */
  drift: number;
};

export const INSTRUMENTS: Instrument[] = [
  // -- Forex ---------------------------------------------------------------
  { id: "EURUSD", name: "Euro / US Dollar",        cls: "forex",   base: 1.0865,   digits: 5, vol: 0.0011, spread: 0.00008, contractSize: 100_000, drift: 0.24 },
  { id: "GBPUSD", name: "Pound / US Dollar",       cls: "forex",   base: 1.2712,   digits: 5, vol: 0.0014, spread: 0.00011, contractSize: 100_000, drift: -0.18 },
  { id: "USDJPY", name: "US Dollar / Yen",         cls: "forex",   base: 156.42,   digits: 3, vol: 0.0013, spread: 0.012,   contractSize: 100_000, drift: 0.41 },
  { id: "AUDUSD", name: "Aussie / US Dollar",      cls: "forex",   base: 0.6634,   digits: 5, vol: 0.0016, spread: 0.00013, contractSize: 100_000, drift: -0.36 },
  { id: "USDCAD", name: "US Dollar / Loonie",      cls: "forex",   base: 1.3721,   digits: 5, vol: 0.0012, spread: 0.00014, contractSize: 100_000, drift: 0.09 },
  { id: "USDCHF", name: "US Dollar / Franc",       cls: "forex",   base: 0.8944,   digits: 5, vol: 0.0011, spread: 0.00013, contractSize: 100_000, drift: 0.15 },

  // -- Metals --------------------------------------------------------------
  { id: "XAUUSD", name: "Gold / US Dollar",        cls: "metals",  base: 2412.60,  digits: 2, vol: 0.0038, spread: 0.28,    contractSize: 100,     drift: 0.87 },
  { id: "XAGUSD", name: "Silver / US Dollar",      cls: "metals",  base: 30.84,    digits: 3, vol: 0.0061, spread: 0.021,   contractSize: 5_000,   drift: 1.42 },

  // -- Crypto --------------------------------------------------------------
  { id: "BTCUSD", name: "Bitcoin",                 cls: "crypto",  base: 68_940.0, digits: 1, vol: 0.0072, spread: 12.5,    contractSize: 1,       drift: 2.31 },
  { id: "ETHUSD", name: "Ethereum",                cls: "crypto",  base: 3_642.80, digits: 2, vol: 0.0089, spread: 1.4,     contractSize: 1,       drift: 3.06 },
  { id: "SOLUSD", name: "Solana",                  cls: "crypto",  base: 172.34,   digits: 2, vol: 0.0141, spread: 0.09,    contractSize: 10,      drift: -2.14 },
  { id: "XRPUSD", name: "Ripple",                  cls: "crypto",  base: 0.6218,   digits: 4, vol: 0.0118, spread: 0.0006,  contractSize: 1_000,   drift: 1.08 },

  // -- Indices -------------------------------------------------------------
  { id: "US100",  name: "Nasdaq 100",              cls: "indices", base: 19_842.0, digits: 1, vol: 0.0044, spread: 1.4,     contractSize: 1,       drift: 0.63 },
  { id: "US30",   name: "Dow Jones 30",            cls: "indices", base: 39_218.0, digits: 1, vol: 0.0031, spread: 2.2,     contractSize: 1,       drift: 0.28 },
  { id: "GER40",  name: "DAX 40",                  cls: "indices", base: 18_476.0, digits: 1, vol: 0.0039, spread: 1.8,     contractSize: 1,       drift: -0.44 },

  // -- Stocks --------------------------------------------------------------
  { id: "AAPL",   name: "Apple Inc.",              cls: "stocks",  base: 214.32,   digits: 2, vol: 0.0052, spread: 0.04,    contractSize: 100,     drift: 0.72 },
  { id: "TSLA",   name: "Tesla Inc.",              cls: "stocks",  base: 246.18,   digits: 2, vol: 0.0106, spread: 0.06,    contractSize: 100,     drift: -1.93 },
  { id: "NVDA",   name: "NVIDIA Corp.",            cls: "stocks",  base: 128.44,   digits: 2, vol: 0.0094, spread: 0.05,    contractSize: 100,     drift: 2.88 },
];

export const INSTRUMENT_MAP: Record<string, Instrument> = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.id, i]),
);

export function getInstrument(id: string): Instrument {
  return INSTRUMENT_MAP[id] ?? INSTRUMENTS[0]!;
}

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  forex: "Forex",
  crypto: "Crypto",
  metals: "Metals",
  indices: "Indices",
  stocks: "Stocks",
};

/* -------------------------------------------------------------------------- */
/*  Candles                                                                    */
/* -------------------------------------------------------------------------- */

export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export const TIMEFRAMES = [
  { id: "M5", label: "5m", ms: 5 * 60_000, volScale: 0.28 },
  { id: "M15", label: "15m", ms: 15 * 60_000, volScale: 0.48 },
  { id: "H1", label: "1H", ms: 60 * 60_000, volScale: 1 },
  { id: "H4", label: "4H", ms: 4 * 60 * 60_000, volScale: 1.9 },
  { id: "D1", label: "1D", ms: 24 * 60 * 60_000, volScale: 4.2 },
] as const;

export type TimeframeId = (typeof TIMEFRAMES)[number]["id"];

export function getTimeframe(id: TimeframeId) {
  return TIMEFRAMES.find((t) => t.id === id) ?? TIMEFRAMES[2];
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic OHLC history. The same (symbol, timeframe, count, anchor)
 * always yields the same series, so SSR and hydration agree.
 *
 * The walk is a mean-reverting GBM with slow-cycling regimes, which gives the
 * trends and consolidations that make a chart read as a real market rather
 * than as noise.
 */
export function generateCandles(
  symbolId: string,
  timeframe: TimeframeId,
  count: number,
  anchorTime: number,
): Candle[] {
  const inst = getInstrument(symbolId);
  const tf = getTimeframe(timeframe);
  const rand = seeded(hash(symbolId + timeframe) + count);

  const stepVol = inst.vol * tf.volScale;
  const candles: Candle[] = [];

  // Walk backwards from the anchor so the final candle is "now".
  const startTime = anchorTime - (count - 1) * tf.ms;

  let price = inst.base * (1 - inst.drift / 100) * (0.94 + rand() * 0.12);
  let regime = 0;
  let regimeLeft = 0;

  for (let i = 0; i < count; i++) {
    if (regimeLeft <= 0) {
      regime = (rand() - 0.45) * stepVol * 0.85;
      regimeLeft = 8 + Math.floor(rand() * 26);
    }
    regimeLeft--;

    const open = price;
    // Box–Muller for a normal shock, plus the regime drift and a gentle pull
    // back toward the instrument's base price.
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    const shock = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const reversion = (inst.base - price) / inst.base * 0.02;
    const change = shock * stepVol + regime + reversion;

    const close = open * (1 + change);
    const wick = Math.abs(change) * 0.85 + stepVol * (0.25 + rand() * 0.75);
    const high = Math.max(open, close) * (1 + wick * rand());
    const low = Math.min(open, close) * (1 - wick * rand());

    candles.push({
      t: startTime + i * tf.ms,
      o: round(open, inst.digits),
      h: round(high, inst.digits),
      l: round(low, inst.digits),
      c: round(close, inst.digits),
      v: Math.round(400 + rand() * 3200 + Math.abs(change) * 90_000),
    });

    price = close;
  }

  // Rebase so the final close lands exactly on the instrument's quoted price.
  const drift = inst.base / candles[candles.length - 1]!.c;
  if (Number.isFinite(drift) && drift > 0) {
    for (const c of candles) {
      c.o = round(c.o * drift, inst.digits);
      c.h = round(c.h * drift, inst.digits);
      c.l = round(c.l * drift, inst.digits);
      c.c = round(c.c * drift, inst.digits);
    }
  }

  return candles;
}

export function round(value: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function formatPrice(value: number, digits: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * One live tick. Small mean-reverting random walk around the seed price so
 * quotes drift believably without wandering off over a long session.
 */
export function nextTick(current: number, inst: Instrument) {
  const shock = (Math.random() - 0.5) * 2;
  const reversion = (inst.base - current) / inst.base * 0.05;
  const next = current * (1 + shock * inst.vol * 0.22 + reversion);
  return round(next, inst.digits);
}

/** Sparkline points for the ticker tape and trader cards. */
export function sparkline(symbolId: string, points = 26): number[] {
  const rand = seeded(hash(symbolId) + points);
  const out: number[] = [];
  let v = 50;
  for (let i = 0; i < points; i++) {
    v += (rand() - 0.48) * 14;
    v = Math.max(6, Math.min(94, v));
    out.push(v);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  P&L                                                                        */
/* -------------------------------------------------------------------------- */

export type Side = "buy" | "sell";

export function pnlOf(
  side: Side,
  entry: number,
  current: number,
  lots: number,
  inst: Instrument,
) {
  const direction = side === "buy" ? 1 : -1;
  return (current - entry) * direction * lots * inst.contractSize;
}

/** Margin required at a given leverage, in account currency. */
export function marginOf(price: number, lots: number, inst: Instrument, leverage: number) {
  return (price * lots * inst.contractSize) / leverage;
}

/** One pip in price units — 4th decimal, or 2nd for JPY-style 3-digit quotes. */
export function pipSize(inst: Instrument) {
  if (inst.cls !== "forex") return 10 ** -(inst.digits - 1);
  return inst.digits === 3 ? 0.01 : 0.0001;
}
