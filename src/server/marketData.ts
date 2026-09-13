import "server-only";

/**
 * Real, live market prices for the copy-trade engine.
 *
 * Real client money settles against these quotes, so they must be REAL — never
 * the simulated chart feed used for the practice desk. Two sources:
 *
 *   • Crypto — Binance's public ticker (keyless), with Coinbase as a fallback.
 *     Works out of the box, no signup.
 *   • Everything else (forex, metals, indices, stocks) — Twelve Data, which
 *     needs a free/paid API key in MARKET_DATA_API_KEY. Until that key is set,
 *     those instruments simply have no live price and the engine won't trade
 *     them; crypto keeps working.
 *
 * Quotes are cached in-process for a few seconds so a burst of requests (the
 * dashboard marking positions, the engine tick) doesn't hammer the upstream.
 */

export type Feed = "crypto" | "twelvedata";

type Registered = {
  /** Our internal instrument id, e.g. "BTCUSD". */
  id: string;
  feed: Feed;
  /** The symbol as the upstream feed names it. */
  ext: string;
  label: string;
};

/**
 * The instruments the engine can price. Crypto is always live; the rest come
 * online the moment MARKET_DATA_API_KEY is set.
 */
export const MARKET_REGISTRY: Registered[] = [
  // -- Crypto (keyless, live now) -----------------------------------------
  { id: "BTCUSD", feed: "crypto", ext: "BTCUSDT", label: "Bitcoin" },
  { id: "ETHUSD", feed: "crypto", ext: "ETHUSDT", label: "Ethereum" },
  { id: "SOLUSD", feed: "crypto", ext: "SOLUSDT", label: "Solana" },
  { id: "XRPUSD", feed: "crypto", ext: "XRPUSDT", label: "Ripple" },

  // -- Forex (needs MARKET_DATA_API_KEY) ----------------------------------
  { id: "EURUSD", feed: "twelvedata", ext: "EUR/USD", label: "Euro / US Dollar" },
  { id: "GBPUSD", feed: "twelvedata", ext: "GBP/USD", label: "Pound / US Dollar" },
  { id: "USDJPY", feed: "twelvedata", ext: "USD/JPY", label: "US Dollar / Yen" },
  { id: "AUDUSD", feed: "twelvedata", ext: "AUD/USD", label: "Aussie / US Dollar" },

  // -- Metals -------------------------------------------------------------
  { id: "XAUUSD", feed: "twelvedata", ext: "XAU/USD", label: "Gold" },
  { id: "XAGUSD", feed: "twelvedata", ext: "XAG/USD", label: "Silver" },

  // -- Indices ------------------------------------------------------------
  { id: "US100", feed: "twelvedata", ext: "NDX", label: "Nasdaq 100" },
  { id: "US30", feed: "twelvedata", ext: "DJI", label: "Dow Jones 30" },
];

const BY_ID: Record<string, Registered> = Object.fromEntries(
  MARKET_REGISTRY.map((r) => [r.id, r]),
);

export function marketDataConfigured(feed: Feed): boolean {
  if (feed === "crypto") return true;
  return Boolean(process.env.MARKET_DATA_API_KEY);
}

/** The instrument ids that currently have a real, live price source. */
export function priceableSymbols(): string[] {
  return MARKET_REGISTRY.filter((r) => marketDataConfigured(r.feed)).map((r) => r.id);
}

/* -------------------------------------------------------------------------- */
/*  Cache                                                                       */
/* -------------------------------------------------------------------------- */

const CACHE_TTL_MS = 5_000;
const cache = new Map<string, { price: number; at: number }>();

function now(): number {
  return Date.now();
}

function readCache(ids: string[]): { hit: Record<string, number>; missing: Registered[] } {
  const hit: Record<string, number> = {};
  const missing: Registered[] = [];
  for (const id of ids) {
    const reg = BY_ID[id];
    if (!reg || !marketDataConfigured(reg.feed)) continue;
    const c = cache.get(id);
    if (c && now() - c.at < CACHE_TTL_MS) hit[id] = c.price;
    else missing.push(reg);
  }
  return { hit, missing };
}

function store(id: string, price: number) {
  cache.set(id, { price, at: now() });
}

/* -------------------------------------------------------------------------- */
/*  Upstream fetchers                                                           */
/* -------------------------------------------------------------------------- */

async function fetchCrypto(regs: Registered[]): Promise<Record<string, number>> {
  if (regs.length === 0) return {};
  const out: Record<string, number> = {};

  // Primary: one batched Binance request for every crypto symbol.
  try {
    const symbols = JSON.stringify(regs.map((r) => r.ext));
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbols)}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    if (res.ok) {
      const rows = (await res.json()) as { symbol: string; price: string }[];
      const byExt = new Map(rows.map((r) => [r.symbol, Number(r.price)]));
      for (const reg of regs) {
        const p = byExt.get(reg.ext);
        if (p && p > 0) {
          out[reg.id] = p;
          store(reg.id, p);
        }
      }
    }
  } catch {
    /* fall through to Coinbase for anything still missing */
  }

  // Fallback: Coinbase spot, one request per still-missing symbol.
  const stillMissing = regs.filter((r) => out[r.id] == null);
  await Promise.all(
    stillMissing.map(async (reg) => {
      try {
        const base = reg.ext.replace(/USDT$/, "");
        const res = await fetch(`https://api.coinbase.com/v2/prices/${base}-USD/spot`, {
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { amount?: string } };
        const p = Number(data.data?.amount);
        if (p > 0) {
          out[reg.id] = p;
          store(reg.id, p);
        }
      } catch {
        /* leave it missing — the engine skips symbols it can't price */
      }
    }),
  );

  return out;
}

async function fetchTwelveData(regs: Registered[]): Promise<Record<string, number>> {
  const key = process.env.MARKET_DATA_API_KEY;
  if (!key || regs.length === 0) return {};
  const out: Record<string, number> = {};
  try {
    const symbolList = regs.map((r) => r.ext).join(",");
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbolList)}&apikey=${key}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as unknown;

    const readOne = (v: unknown): number => {
      if (v && typeof v === "object" && "price" in v) return Number((v as { price: string }).price);
      return NaN;
    };

    if (regs.length === 1) {
      // Single-symbol responses are the bare { price } object.
      const p = readOne(data);
      if (p > 0) {
        out[regs[0]!.id] = p;
        store(regs[0]!.id, p);
      }
    } else {
      const map = data as Record<string, unknown>;
      for (const reg of regs) {
        const p = readOne(map[reg.ext]);
        if (p > 0) {
          out[reg.id] = p;
          store(reg.id, p);
        }
      }
    }
  } catch {
    /* return whatever we have */
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Real prices for the given instrument ids. Returns a map keyed by our internal
 * id; symbols with no live source (or a failed fetch) are simply absent.
 */
export async function getQuotes(ids: string[]): Promise<Record<string, number>> {
  const { hit, missing } = readCache(ids);
  if (missing.length === 0) return hit;

  const crypto = missing.filter((r) => r.feed === "crypto");
  const td = missing.filter((r) => r.feed === "twelvedata");

  const [c, t] = await Promise.all([fetchCrypto(crypto), fetchTwelveData(td)]);
  return { ...hit, ...c, ...t };
}

/** Real prices for every instrument the engine can currently price. */
export async function getLiveQuotes(): Promise<Record<string, number>> {
  return getQuotes(priceableSymbols());
}

export function instrumentLabel(id: string): string {
  return BY_ID[id]?.label ?? id;
}
