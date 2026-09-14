import { describe, expect, it } from 'vitest';
import {
  TOTP_DIGITS,
  TOTP_STEP_MS,
  base32Decode,
  base32Encode,
  generateSecret,
  otpauthUri,
  totpAt,
  verifyTotp,
} from '../../api/_lib/totp';

// RFC 6238 appendix B (SHA-1): shared secret is the ASCII string
// "12345678901234567890". The 6-digit OTP equals value mod 10^6.
const RFC_SECRET_ASCII = '12345678901234567890';
const rfcSecret = base32Encode(Buffer.from(RFC_SECRET_ASCII, 'ascii'));

const rfc6238Vectors: Array<{ timeSec: number; code: string }> = [
  { timeSec: 59, code: '287082' },
  { timeSec: 1111111109, code: '081804' },
  { timeSec: 1111111111, code: '050471' },
  { timeSec: 1234567890, code: '005924' },
  { timeSec: 2000000000, code: '279037' },
  { timeSec: 20000000000, code: '353130' },
];

describe('base32 codec', () => {
  it('matches the standard alphabet for a known input', () => {
    // "Hello!" (6 bytes) → 10 base32 chars; the codec emits no padding.
    expect(base32Encode(Buffer.from('Hello!', 'ascii'))).toBe('JBSWY3DPEE');
    expect(base32Encode(Buffer.from('Hello', 'ascii'))).toBe('JBSWY3DP');
  });

  it('round-trips arbitrary bytes', () => {
    const raw = Buffer.from([1, 2, 3, 250, 251, 252, 253, 254, 255]);
    expect(base32Decode(base32Encode(raw)).toString('hex')).toBe(raw.toString('hex'));
  });

  it('encodes the RFC 6238 secret', () => {
    // GEZDGNBV... is the base32 of "12345678901234567890"
    expect(rfcSecret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });
});

describe('generateSecret', () => {
  it('produces canonical base32 secrets of the requested entropy', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBe(32); // 20 bytes → ceil(160/5) chars
    expect(generateSecret(32).length).toBe(52); // 32 bytes → 256 bits
    expect(generateSecret()).not.toBe(generateSecret());
  });
});

describe('totpAt (RFC 6238 vectors)', () => {
  it('reproduces every official SHA-1 test vector at 6 digits', () => {
    for (const { timeSec, code } of rfc6238Vectors) {
      expect(totpAt(rfcSecret, timeSec * 1000)).toBe(code);
    }
  });

  it('emits TOTP_DIGITS digits and changes value every step', () => {
    const a = totpAt(rfcSecret, 1000 * TOTP_STEP_MS);
    const b = totpAt(rfcSecret, 1000 * TOTP_STEP_MS + TOTP_STEP_MS);
    expect(a).toMatch(new RegExp(`^\\d{${TOTP_DIGITS}}$`));
    expect(a).not.toBe(b);
  });
});

describe('verifyTotp', () => {
  it('accepts the current code and codes within the drift window', () => {
    const now = 1_700_000_000_000;
    const current = totpAt(rfcSecret, now);
    const previous = totpAt(rfcSecret, now - TOTP_STEP_MS);
    const next = totpAt(rfcSecret, now + TOTP_STEP_MS);
    expect(verifyTotp(rfcSecret, current, { now })).toBe(true);
    expect(verifyTotp(rfcSecret, previous, { now })).toBe(true);
    expect(verifyTotp(rfcSecret, next, { now })).toBe(true);
  });

  it('rejects codes outside the window and malformed input', () => {
    const now = 1_700_000_000_000;
    const farPast = totpAt(rfcSecret, now - 3 * TOTP_STEP_MS);
    expect(verifyTotp(rfcSecret, farPast, { now })).toBe(false);
    expect(verifyTotp(rfcSecret, '000000', { now: totpAt(rfcSecret, now) === '000000' ? now + TOTP_STEP_MS : now })).toBe(false);
    expect(verifyTotp(rfcSecret, '12ab56', { now })).toBe(false);
    expect(verifyTotp(rfcSecret, '12345', { now })).toBe(false);
    expect(verifyTotp(rfcSecret, '', { now })).toBe(false);
  });
});

describe('otpauthUri', () => {
  it('builds a standard provisioning URI', () => {
    const uri = otpauthUri('ABC234DEF', 'si.rao@hry.nic.in');
    expect(uri).toBe('otpauth://totp/Haryana%20Police%20OSINT:si.rao%40hry.nic.in?secret=ABC234DEF&issuer=Haryana%20Police%20OSINT&algorithm=SHA1&digits=6&period=30');
  });
});
