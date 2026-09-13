import "server-only";
import { Resend } from "resend";
import { COMPANY, fullAddress } from "@/lib/company";

/**
 * Transactional email via Resend.
 *
 * Configure with RESEND_API_KEY and EMAIL_FROM. If they are not set, emails are
 * skipped (logged) rather than throwing — so registration never fails just
 * because email isn't wired up yet.
 */

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? `${COMPANY.name} <onboarding@resend.dev>`;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const resend = client();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${input.subject}" to ${input.to}`);
    return { ok: true, skipped: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (error) {
      console.error("[email] send failed:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] send threw:", e);
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/* -------------------------------------------------------------------------- */
/*  Templates — light by default, with a real dark-mode variant so the email  */
/*  matches the recipient's device theme instead of being auto-inverted.      */
/* -------------------------------------------------------------------------- */

const BRAND = "#00b487"; // slightly deeper mint so it stays legible on white too
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Shared page chrome. Inline styles = light theme; the <style> block flips to
 *  dark under prefers-color-scheme for clients that honour it (Apple Mail, etc).
 *  Gmail strips the <style> and keeps the clean light design, then applies its
 *  own gentle dark treatment — consistent either way. */
function shell(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    @media (prefers-color-scheme: dark) {
      .ps-bg { background:#05070c !important; }
      .ps-card { background:#0b0f17 !important; border-color:rgba(255,255,255,0.08) !important; }
      .ps-mark, .ps-title { color:#ffffff !important; }
      .ps-text { color:#c7d2e0 !important; }
      .ps-muted { color:#8b97a8 !important; }
      .ps-foot { color:#647588 !important; }
      .ps-chip { background:rgba(0,223,164,0.10) !important; border-color:rgba(0,223,164,0.25) !important; color:#5eead4 !important; }
      .ps-code { background:#05070c !important; border-color:rgba(255,255,255,0.10) !important; color:#ffffff !important; }
    }
  </style>
  </head>
  <body class="ps-bg" style="margin:0;padding:0;background:#eef2f7;font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;" class="ps-bg">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr><td class="ps-mark" style="padding:0 4px 20px;font-size:21px;font-weight:800;letter-spacing:-0.02em;color:#0b1220;">
            Prime<span style="color:${BRAND};">Stone</span>
          </td></tr>
          <tr><td class="ps-card" style="background:#ffffff;border:1px solid #e5eaf1;border-radius:18px;padding:30px;">
            <h1 class="ps-title" style="margin:0 0 14px;font-size:20px;font-weight:700;color:#0b1220;">${title}</h1>
            ${body}
          </td></tr>
          <tr><td class="ps-foot" style="padding:20px 6px 0;font-size:11.5px;line-height:1.7;color:#8b97a8;">
            ${COMPANY.name} · ${fullAddress()}<br/>
            Regulated by the ${COMPANY.regulator}. Trading carries risk; you can lose your capital.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function p(text: string): string {
  return `<p class="ps-text" style="margin:0 0 16px;font-size:14.5px;line-height:1.65;color:#3d4a5c;">${text}</p>`;
}

function muted(text: string): string {
  return `<p class="ps-muted" style="margin:0 0 22px;font-size:13px;line-height:1.6;color:#7a8699;">${text}</p>`;
}

function strong(text: string): string {
  return `<strong class="ps-title" style="color:#0b1220;">${text}</strong>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND};color:#ffffff;font-weight:600;
    text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;">${label}</a>`;
}

/** A big, easy-to-read verification / one-time code. */
function codeBlock(code: string): string {
  return `<div class="ps-code" style="margin:4px 0 22px;background:#f5f8fb;border:1px solid #e5eaf1;border-radius:12px;
    padding:18px;text-align:center;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:30px;font-weight:700;
    letter-spacing:0.32em;color:#0b1220;">${code}</div>`;
}

/* -------------------------------------------------------------------------- */

export function welcomeEmail(input: {
  firstName: string;
  loginUrl: string;
  verifyCode?: string;
}): { subject: string; html: string } {
  const verifySection = input.verifyCode
    ? `${p("First, let's confirm this email is yours. Enter this 6-digit code on the verification screen:")}
       ${codeBlock(input.verifyCode)}
       ${muted("The code expires in 30 minutes. If you didn't create a PrimeStone account, you can ignore this email.")}`
    : "";
  return {
    subject: `Welcome to ${COMPANY.name}`,
    html: shell(
      `Welcome aboard, ${input.firstName}.`,
      `${p(`Your ${COMPANY.name} account is ready — browse verified strategy providers, fund your account, and start copying, all from your dashboard.`)}
       ${verifySection}
       ${button(input.loginUrl, "Go to my dashboard")}`,
    ),
  };
}

/** Standalone "verify your email" message (used for resends). */
export function verifyEmail(input: { firstName: string; code: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: `Your PrimeStone verification code: ${input.code}`,
    html: shell(
      "Verify your email",
      `${p(`Hi ${input.firstName}, enter this code to verify your email address:`)}
       ${codeBlock(input.code)}
       ${muted("The code expires in 30 minutes. If you didn't request it, you can safely ignore this email.")}`,
    ),
  };
}

export function depositCreditedEmail(input: {
  firstName: string;
  amount: string;
  method: string;
  dashboardUrl: string;
}) {
  return {
    subject: `Deposit received — ${input.amount}`,
    html: shell(
      "Your deposit is in 🎉",
      `${p(`Hi ${input.firstName}, we've credited your account with ${strong(input.amount)}.`)}
       ${muted(`Method: ${input.method}. It's ready to allocate to a strategy provider.`)}
       ${button(input.dashboardUrl, "View my balance")}`,
    ),
  };
}

export function withdrawalPaidEmail(input: { firstName: string; amount: string; dashboardUrl: string }) {
  return {
    subject: `Withdrawal sent — ${input.amount}`,
    html: shell(
      "Your withdrawal is on its way",
      `${p(`Hi ${input.firstName}, we've sent ${strong(input.amount)}.`)}
       ${muted("It should reflect on your M-Pesa shortly.")}
       ${button(input.dashboardUrl, "View transactions")}`,
    ),
  };
}

export function withdrawalRejectedEmail(input: {
  firstName: string;
  amount: string;
  reason?: string;
  dashboardUrl: string;
}) {
  return {
    subject: `Withdrawal not processed — ${input.amount} returned`,
    html: shell(
      "Withdrawal returned to your balance",
      `${p(`Hi ${input.firstName}, your withdrawal request for ${strong(input.amount)} couldn't be processed${input.reason ? `: ${input.reason}` : ""}. The funds have been returned to your available balance.`)}
       ${button(input.dashboardUrl, "View my balance")}`,
    ),
  };
}

export function kycApprovedEmail(input: { firstName: string; dashboardUrl: string }) {
  return {
    subject: "Your identity is verified ✅",
    html: shell(
      "You're verified",
      `${p(`Great news ${input.firstName} — your identity has been confirmed. Withdrawals are now enabled on your account.`)}
       ${button(input.dashboardUrl, "Go to my account")}`,
    ),
  };
}

export function kycRejectedEmail(input: { firstName: string; reason?: string; verifyUrl: string }) {
  return {
    subject: "Identity verification needs another look",
    html: shell(
      "We couldn't verify your documents",
      `${p(`Hi ${input.firstName}, we weren't able to verify your identity${input.reason ? `: ${input.reason}` : ""}. Please re-submit clear, valid documents and we'll review again.`)}
       ${button(input.verifyUrl, "Re-submit documents")}`,
    ),
  };
}

export function passwordResetEmail(input: { firstName: string; resetUrl: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: `Reset your ${COMPANY.name} password`,
    html: shell(
      "Reset your password",
      `${p(`Hi ${input.firstName}, we received a request to reset your password. Tap below to choose a new one — the link expires in 60 minutes.`)}
       <p style="margin:0 0 22px;">${button(input.resetUrl, "Reset password")}</p>
       ${muted("If you didn't request this, you can safely ignore this email — your password stays the same.")}`,
    ),
  };
}
