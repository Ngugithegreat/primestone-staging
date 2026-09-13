import "server-only";

/**
 * Safaricom Daraja (M-Pesa) client — STK Push (Lipa na M-Pesa Online).
 *
 * Credentials come from the environment; nothing is hard-coded. Set
 * MPESA_ENVIRONMENT to "sandbox" while testing and "production" once Safaricom
 * grants go-live. Amounts are whole KES (M-Pesa does not do cents).
 */

type MpesaEnv = "sandbox" | "production";

function config() {
  const env = (process.env.MPESA_ENVIRONMENT as MpesaEnv) ?? "sandbox";
  const base =
    env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  // Trim every credential — a trailing space or newline pasted into the env
  // (very common) otherwise corrupts the Basic-auth header or STK password and
  // Safaricom answers 400.
  const consumerKey = (process.env.MPESA_CONSUMER_KEY ?? "").trim();
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET ?? "").trim();
  const shortcode = (process.env.MPESA_SHORTCODE ?? "174379").trim();
  const passkey = (process.env.MPESA_PASSKEY ?? "").trim();
  const callbackUrl = (process.env.MPESA_CALLBACK_URL ?? "").trim();
  // "CustomerPayBillOnline" for a Pay Bill shortcode (default), or
  // "CustomerBuyGoodsOnline" if the shortcode is a Buy Goods / Till number.
  const transactionType = process.env.MPESA_TRANSACTION_TYPE ?? "CustomerPayBillOnline";
  // PartyB = the paybill/till the customer's money goes to. On a converted or
  // organisation shortcode this differs from the Head Office number that signs
  // the request (BusinessShortCode = MPESA_SHORTCODE). Defaults to the shortcode.
  const partyB = process.env.MPESA_PARTY_B || shortcode;
  return {
    env, base, consumerKey, consumerSecret, shortcode, passkey, callbackUrl, transactionType, partyB,
  };
}

export function isMpesaConfigured(): boolean {
  const c = config();
  return Boolean(c.consumerKey && c.consumerSecret && c.passkey);
}

/** The API base URL + environment, so other M-Pesa modules (B2C) can reuse it. */
export function mpesaContext(): { base: string; env: MpesaEnv } {
  const c = config();
  return { base: c.base, env: c.env };
}

/** yyyyMMddHHmmss in EAT (UTC+3) — used for both the password and the request. */
function timestamp(now = new Date()): string {
  const eat = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${eat.getUTCFullYear()}${p(eat.getUTCMonth() + 1)}${p(eat.getUTCDate())}` +
    `${p(eat.getUTCHours())}${p(eat.getUTCMinutes())}${p(eat.getUTCSeconds())}`
  );
}

/** Normalise a Kenyan number to the 2547XXXXXXXX format Daraja requires. */
export function normalizeMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  return digits;
}

export async function getAccessToken(): Promise<string> {
  const c = config();
  const auth = Buffer.from(`${c.consumerKey}:${c.consumerSecret}`).toString("base64");
  const res = await fetch(`${c.base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) {
    // Surface Safaricom's own reason instead of a bare status — the OAuth body
    // says whether it's bad credentials, a wrong environment, etc.
    const detail = await res.text().catch(() => "");
    let reason = "";
    try {
      reason = (JSON.parse(detail) as { errorMessage?: string })?.errorMessage ?? "";
    } catch {
      reason = detail.slice(0, 120);
    }
    console.error(`[mpesa auth] ${res.status} env=${c.env} keyLen=${c.consumerKey.length} ${detail}`);
    throw new Error(`M-Pesa auth failed (${res.status})${reason ? `: ${reason}` : ""}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("M-Pesa auth returned no token");
  return data.access_token;
}

export type StkPushResult =
  | { ok: true; checkoutRequestId: string; merchantRequestId: string; customerMessage: string }
  | { ok: false; error: string };

/**
 * Trigger an STK Push so the customer gets a PIN prompt on their phone.
 * The actual crediting happens later, in the callback — never here.
 */
export async function stkPush(input: {
  phone: string;
  amount: number; // whole KES
  accountReference: string;
  description?: string;
}): Promise<StkPushResult> {
  const c = config();
  if (!isMpesaConfigured()) return { ok: false, error: "M-Pesa is not configured." };
  if (!c.callbackUrl) return { ok: false, error: "MPESA_CALLBACK_URL is not set." };

  const ts = timestamp();
  const password = Buffer.from(`${c.shortcode}${c.passkey}${ts}`).toString("base64");
  const msisdn = normalizeMsisdn(input.phone);

  try {
    const token = await getAccessToken();
    const res = await fetch(`${c.base}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        BusinessShortCode: c.shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: c.transactionType,
        Amount: Math.max(1, Math.round(input.amount)),
        PartyA: msisdn,
        PartyB: c.partyB,
        PhoneNumber: msisdn,
        CallBackURL: c.callbackUrl,
        AccountReference: input.accountReference.slice(0, 12),
        TransactionDesc: (input.description ?? "Deposit").slice(0, 20),
      }),
    });

    const data = (await res.json()) as Record<string, string>;
    console.log("[stkPush]", JSON.stringify(data));
    if (data.ResponseCode === "0") {
      return {
        ok: true,
        checkoutRequestId: data.CheckoutRequestID!,
        merchantRequestId: data.MerchantRequestID!,
        customerMessage: data.CustomerMessage ?? "Check your phone to authorise the payment.",
      };
    }
    return { ok: false, error: data.errorMessage ?? data.ResponseDescription ?? "STK push failed." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "M-Pesa request failed." };
  }
}

export type StkQueryResult =
  | { status: "success"; resultDesc: string; resultCode?: string }
  | { status: "failed"; resultDesc: string; resultCode?: string }
  | { status: "pending"; resultDesc: string; resultCode?: string };

/**
 * Ask Safaricom for the result of an STK Push directly (the STK Query API).
 * This is our reconciliation path — deposits are confirmed even when the async
 * callback never arrives, which in sandbox is most of the time.
 */
export async function stkQuery(checkoutRequestId: string): Promise<StkQueryResult> {
  const c = config();
  const ts = timestamp();
  const password = Buffer.from(`${c.shortcode}${c.passkey}${ts}`).toString("base64");

  try {
    const token = await getAccessToken();
    const res = await fetch(`${c.base}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        BusinessShortCode: c.shortcode,
        Password: password,
        Timestamp: ts,
        CheckoutRequestID: checkoutRequestId,
      }),
    });
    const data = (await res.json()) as Record<string, string>;
    // Log the raw Safaricom response so the exact ResultCode is visible in the
    // Vercel function logs when diagnosing a failed deposit.
    console.log("[stkQuery]", JSON.stringify(data));

    // Still being processed → Safaricom answers with an errorCode, treat as pending.
    if (data.errorCode || data.ResponseCode !== "0") {
      return { status: "pending", resultDesc: data.errorMessage ?? data.ResponseDescription ?? "Processing" };
    }
    const code = String(data.ResultCode);
    if (code === "0") return { status: "success", resultDesc: data.ResultDesc ?? "Success", resultCode: code };

    // Only these are terminal, user-facing failures. Crucially, code 4999
    // ("the transaction is still under processing") and any other/unknown code
    // stay PENDING — Safaricom hasn't finished, so we keep polling and let the
    // callback or reconcile cron credit it. Marking 4999 as failed is what made
    // paid deposits show "didn't go through" the instant the STK was sent.
    const TERMINAL_FAILURES: Record<string, string> = {
      "1032": "Request cancelled on the phone.",
      "1037": "Timed out — the prompt wasn't answered in time.",
      "1": "Insufficient M-Pesa balance.",
      "2001": "The M-Pesa PIN entered was wrong.",
      "1019": "The transaction expired.",
      "1025": "Unable to process — please try again.",
    };
    if (code in TERMINAL_FAILURES) {
      return { status: "failed", resultDesc: TERMINAL_FAILURES[code], resultCode: code };
    }
    return { status: "pending", resultDesc: data.ResultDesc ?? "Still processing", resultCode: code };
  } catch (e) {
    return { status: "pending", resultDesc: e instanceof Error ? e.message : "Query failed" };
  }
}

/** Parse the fields we need out of Safaricom's STK callback body. */
export function parseStkCallback(body: unknown): {
  checkoutRequestId: string | null;
  success: boolean;
  receipt: string | null;
  amount: number | null;
  phone: string | null;
} {
  const stk = (body as { Body?: { stkCallback?: Record<string, unknown> } })?.Body?.stkCallback;
  if (!stk) return { checkoutRequestId: null, success: false, receipt: null, amount: null, phone: null };

  const checkoutRequestId = (stk.CheckoutRequestID as string) ?? null;
  const success = stk.ResultCode === 0 || stk.ResultCode === "0";

  const items =
    (stk.CallbackMetadata as { Item?: { Name: string; Value: unknown }[] } | undefined)?.Item ?? [];
  const find = (name: string) => items.find((i) => i.Name === name)?.Value;

  return {
    checkoutRequestId,
    success,
    receipt: (find("MpesaReceiptNumber") as string) ?? null,
    amount: (find("Amount") as number) ?? null,
    phone: find("PhoneNumber") ? String(find("PhoneNumber")) : null,
  };
}
