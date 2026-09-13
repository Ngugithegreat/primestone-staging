import "server-only";
import { createHmac, randomBytes } from "node:crypto";

/**
 * TOTP (RFC 6238) — authenticator-app 2FA, implemented on node:crypto so there's
 * no third-party auth dependency. SHA-1, 6 digits, 30s period (what Google
 * Authenticator, Authy, 1Password etc. all default to).
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh base32 TOTP secret. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secretBuf: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Verify a 6-digit code against the secret, allowing ±1 time window for skew. */
export function verifyTotp(secret: string, code: string): boolean {
  const clean = (code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const secretBuf = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let w = -1; w <= 1; w++) {
    if (hotp(secretBuf, counter + w) === clean) return true;
  }
  return false;
}

/** The otpauth:// URI an authenticator app scans. */
export function otpauthUrl(email: string, secret: string): string {
  const label = encodeURIComponent(`PrimeStone:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: "PrimeStone",
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
