import "server-only";

/**
 * Live FX for funding. Clients pay in KES (M-Pesa) but the trading account is
 * denominated in USD — so we convert at the current rate on deposit.
 *
 * Uses the free, key-less open.er-api.com feed, cached in-process for a few
 * minutes, with a sane fallback if it is ever unreachable so a deposit is never
 * blocked by the rate lookup.
 */

let cached: { rate: number; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;
const FALLBACK_USD_KES = 129;

/** KES per 1 USD (e.g. ~129). */
export async function usdKesRate(): Promise<number> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.rate;

  // Allow an override for testing / manual control.
  const override = Number(process.env.USD_KES_RATE);
  if (Number.isFinite(override) && override > 0) {
    cached = { rate: override, at: Date.now() };
    return override;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.KES;
    if (rate && rate > 0) {
      cached = { rate, at: Date.now() };
      return rate;
    }
  } catch {
    /* fall through to fallback */
  }
  return cached?.rate ?? FALLBACK_USD_KES;
}

/** Convert KES minor units to USD minor units at the current rate. */
export async function kesToUsdMinor(kesMinor: number): Promise<{ usdMinor: number; rate: number }> {
  const rate = await usdKesRate();
  return { usdMinor: Math.round(kesMinor / rate), rate };
}

/**
 * The client chooses a USD amount; M-Pesa charges KES. Returns the whole-KES
 * amount to charge, the USD minor units to credit, and the rate used.
 */
export async function usdToKesCharge(
  amountUsd: number,
): Promise<{ kesWhole: number; usdMinor: number; rate: number }> {
  const rate = await usdKesRate();
  return {
    kesWhole: Math.max(1, Math.round(amountUsd * rate)),
    usdMinor: Math.round(amountUsd * 100),
    rate,
  };
}
