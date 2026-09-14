/**
 * RFC 6238 TOTP (time-based one-time passwords) — pure Node, zero dependencies.
 *
 * Powers the MFA-ready architecture (spec §22): secrets are base32 (RFC 4648),
 * codes are 6 digits over a 30 s step with HMAC-SHA1 — the profile used by
 * Google Authenticator, Authy, and hardware tokens alike.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const TOTP_STEP_MS = 30_000;
export const TOTP_DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

/** HOTP core (RFC 4226) at a given Unix-ms instant — exported for test vectors. */
export function totpAt(secret: string, timeMs: number, stepMs = TOTP_STEP_MS, digits = TOTP_DIGITS): string {
  const counter = Math.floor(timeMs / stepMs);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter % 2 ** 32, 4);
  const hmac = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * Constant-time verification with a ±1 step clock-skew window.
 * Non-numeric garbage simply fails; it never throws.
 */
export function verifyTotp(secret: string, code: string, options: { window?: number; now?: number } = {}): boolean {
  const clean = String(code ?? '').replace(/\D/g, '');
  if (clean.length !== TOTP_DIGITS) return false;
  const now = options.now ?? Date.now();
  const window = Math.max(0, options.window ?? 1);
  const candidate = Buffer.from(clean);
  for (let drift = -window; drift <= window; drift++) {
    const expected = Buffer.from(totpAt(secret, now + drift * TOTP_STEP_MS));
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) return true;
  }
  return false;
}

/** otpauth:// URI for authenticator-app enrollment QR codes. */
export function otpauthUri(secret: string, account: string, issuer = 'Haryana Police OSINT'): string {
  return (
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer)}` +
    `&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_MS / 1000}`
  );
}
