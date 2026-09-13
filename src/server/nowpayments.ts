import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * NOWPayments crypto deposits.
 *
 * Non-custodial: NOWPayments watches the chain and settles to YOUR wallet, then
 * fires a signed IPN webhook. We create a payment (a unique deposit address),
 * and credit the ledger only from a webhook whose signature we've verified —
 * never from the browser. Stablecoins (USDT/USDC) are 1:1 with USD, so a
 * deposit credits the same USD amount the user asked for.
 */

const API = "https://api.nowpayments.io/v1";

export function isCryptoConfigured(): boolean {
  return Boolean(process.env.NOWPAYMENTS_API_KEY);
}

export type CreatedPayment = {
  nowPaymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  status: string;
};

/**
 * USD we shave off the invoice so a sending-exchange's network fee doesn't leave
 * the payment underpaid (which NOWPayments never settles). We invoice
 * `amount - BUFFER`; the client sends the full amount, loses ~1–2 to the fee,
 * and the ~BUFFER-larger transfer still clears the invoice → the payment
 * finishes and lands in the balance. We then credit whatever actually arrived.
 */
const UNDERPAY_BUFFER_USD = 3;

/** Create a crypto payment → a unique deposit address for the given USD amount. */
export async function createCryptoPayment(input: {
  amountUsd: number;
  payCurrency: string; // e.g. "usdttrc20"
  orderId: string;
  callbackUrl: string;
}): Promise<{ ok: true; payment: CreatedPayment } | { ok: false; error: string }> {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) return { ok: false, error: "Crypto payments are not configured yet." };

  // Invoice a little under the requested amount so an exchange withdrawal fee
  // doesn't leave it short of completing.
  const invoiceUsd = Math.max(1, input.amountUsd - UNDERPAY_BUFFER_USD);

  try {
    const res = await fetch(`${API}/payment`, {
      method: "POST",
      headers: { "x-api-key": key, "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        price_amount: invoiceUsd,
        price_currency: "usd",
        pay_currency: input.payCurrency,
        ipn_callback_url: input.callbackUrl,
        order_id: input.orderId,
        order_description: "PrimeStone deposit",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !data.pay_address) {
      return { ok: false, error: String(data.message ?? "Could not create a crypto payment.") };
    }
    // Show the client the full amount to send (invoice + buffer), so what lands
    // after their exchange fee still clears the invoice.
    const invoicePay = Number(data.pay_amount);
    const displayPay = Math.round((invoicePay + UNDERPAY_BUFFER_USD) * 100) / 100;
    return {
      ok: true,
      payment: {
        nowPaymentId: String(data.payment_id),
        payAddress: String(data.pay_address),
        payAmount: displayPay,
        payCurrency: String(data.pay_currency),
        status: String(data.payment_status ?? "waiting"),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Crypto request failed." };
  }
}

/** Poll a payment's status directly (reconciliation, in case the IPN is missed). */
export async function getCryptoStatus(
  nowPaymentId: string,
): Promise<{ status: string; actuallyPaid: number } | null> {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${API}/payment/${nowPaymentId}`, {
      headers: { "x-api-key": key },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      status: String(data.payment_status ?? "waiting"),
      actuallyPaid: Number(data.actually_paid ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Verify an IPN webhook signature: HMAC-SHA512 of the alphabetically key-sorted
 * JSON body, keyed with the IPN secret, compared to the x-nowpayments-sig header.
 */
export function verifyIpnSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;
  try {
    const params = JSON.parse(rawBody) as Record<string, unknown>;
    const sorted = JSON.stringify(params, Object.keys(params).sort());
    const expected = createHmac("sha512", secret).update(sorted).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** A finished payment is fully paid and settled — safe to credit. */
export function isPaidStatus(status: string): boolean {
  return status === "finished";
}

/**
 * Statuses where coins have actually landed and we should credit whatever
 * arrived — includes `partially_paid` (the client sent less than the invoice).
 * We credit the real received amount, not the requested one, so a short payment
 * still credits its true value instead of getting stuck.
 */
export function isCreditableStatus(status: string): boolean {
  return status === "finished" || status === "partially_paid";
}

export function isFailedStatus(status: string): boolean {
  return status === "failed" || status === "expired" || status === "refunded";
}

/**
 * USD minor units to credit for a USDT deposit, from the amount actually paid.
 * Our crypto option is USDT only (1:1 with USD), so the received USDT is the
 * USD value. Returns 0 if nothing arrived.
 */
export function creditedMinorFromPaid(actuallyPaid: number): number {
  if (!(actuallyPaid > 0)) return 0;
  return Math.round(actuallyPaid * 100);
}
