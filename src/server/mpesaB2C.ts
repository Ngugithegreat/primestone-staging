import "server-only";
import { getAccessToken, mpesaContext, normalizeMsisdn } from "./mpesa";
import { siteUrl } from "@/lib/siteUrl";

/**
 * Safaricom Daraja B2C — automated payouts (Business to Customer), used to send
 * an approved withdrawal straight to the client's M-Pesa. The actual settlement
 * of our ledger happens later, in the result callback — never here.
 *
 * B2C needs credentials beyond the STK ones: an API operator (InitiatorName)
 * with the B2C role and its encrypted password (SecurityCredential). The paying
 * shortcode defaults to MPESA_SHORTCODE (the single Paybill), and the result /
 * timeout URLs default to this app's own endpoints.
 */

function config() {
  const initiatorName = (process.env.MPESA_INITIATOR_NAME ?? "").trim();
  const securityCredential = (process.env.MPESA_SECURITY_CREDENTIAL ?? "").trim();
  const shortcode = (process.env.MPESA_B2C_SHORTCODE ?? process.env.MPESA_SHORTCODE ?? "").trim();
  // "BusinessPayment" (default), "SalaryPayment" or "PromotionPayment".
  const commandId = (process.env.MPESA_B2C_COMMAND_ID ?? "BusinessPayment").trim();
  const base = siteUrl();
  // Anti-forgery token appended to the result URL when MPESA_CALLBACK_SECRET is
  // set — a forged "success" result would otherwise mark a payout paid without
  // money ever leaving. Reuses the same secret as the STK callback.
  const secret = (process.env.MPESA_CALLBACK_SECRET ?? "").trim();
  const q = secret ? `?token=${encodeURIComponent(secret)}` : "";
  const resultUrl = (process.env.MPESA_B2C_RESULT_URL ?? `${base}/api/payments/mpesa/b2c-result${q}`).trim();
  const timeoutUrl = (process.env.MPESA_B2C_TIMEOUT_URL ?? `${base}/api/payments/mpesa/b2c-timeout${q}`).trim();
  return { initiatorName, securityCredential, shortcode, commandId, resultUrl, timeoutUrl };
}

export function isB2CConfigured(): boolean {
  const c = config();
  return Boolean(c.initiatorName && c.securityCredential && c.shortcode && c.resultUrl);
}

export type B2CResult =
  | { ok: true; conversationId: string; originatorConversationId: string }
  | { ok: false; error: string };

/**
 * Queue a B2C payment. Safaricom accepts it synchronously (ResponseCode "0")
 * and delivers the real outcome asynchronously to the ResultURL.
 */
export async function sendB2C(input: {
  phone: string;
  amountKes: number; // whole KES
  remarks?: string;
  occasion?: string;
}): Promise<B2CResult> {
  const c = config();
  if (!isB2CConfigured()) return { ok: false, error: "M-Pesa B2C is not configured." };
  const { base } = mpesaContext();
  const msisdn = normalizeMsisdn(input.phone);

  try {
    const token = await getAccessToken();
    const res = await fetch(`${base}/mpesa/b2c/v1/paymentrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        InitiatorName: c.initiatorName,
        SecurityCredential: c.securityCredential,
        CommandID: c.commandId,
        Amount: Math.max(1, Math.round(input.amountKes)),
        PartyA: c.shortcode,
        PartyB: msisdn,
        Remarks: (input.remarks ?? "Withdrawal").slice(0, 100),
        QueueTimeOutURL: c.timeoutUrl,
        ResultURL: c.resultUrl,
        Occasion: (input.occasion ?? "").slice(0, 100),
      }),
    });
    const data = (await res.json()) as Record<string, string>;
    console.log("[b2c]", JSON.stringify(data));
    if (data.ResponseCode === "0") {
      return {
        ok: true,
        conversationId: data.ConversationID!,
        originatorConversationId: data.OriginatorConversationID!,
      };
    }
    return { ok: false, error: data.errorMessage ?? data.ResponseDescription ?? "B2C request failed." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "B2C request failed." };
  }
}

/** Parse the fields we need out of Safaricom's B2C result callback body. */
export function parseB2CResult(body: unknown): {
  conversationId: string | null;
  success: boolean;
  resultCode: string | null;
  resultDesc: string | null;
  receipt: string | null;
} {
  const r = (body as { Result?: Record<string, unknown> })?.Result;
  if (!r) {
    return { conversationId: null, success: false, resultCode: null, resultDesc: null, receipt: null };
  }
  const conversationId = (r.ConversationID as string) ?? null;
  const resultCode = r.ResultCode != null ? String(r.ResultCode) : null;
  const success = resultCode === "0";
  const resultDesc = (r.ResultDesc as string) ?? null;

  const items =
    (r.ResultParameters as { ResultParameter?: { Key: string; Value: unknown }[] } | undefined)
      ?.ResultParameter ?? [];
  const receipt = (items.find((i) => i.Key === "TransactionReceipt")?.Value as string) ?? null;

  return { conversationId, success, resultCode, resultDesc, receipt };
}
