// Minimal ULID generator (Crockford base32, lexicographically sortable).
// No external dependency; uses crypto.getRandomValues for the random component.
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
const TIME_LEN = 10;
const RAND_LEN = 16;

function randomChar(): string {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  // map 0..255 into 0..31
  return ENCODING[bytes[0] & 0x1f];
}

function encodeTime(now: number): string {
  let str = '';
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    const mod = now % 32;
    str = ENCODING[mod] + str;
    now = (now - mod) / 32;
  }
  return str;
}

export function ulid(seedTime: number = Date.now()): string {
  let rand = '';
  for (let i = 0; i < RAND_LEN; i++) rand += randomChar();
  return encodeTime(seedTime) + rand;
}

/** quick non-ULID id for ephemeral things (projects, diary fallbacks) */
export function shortId(prefix = ''): string {
  return prefix + ulid().slice(0, 12).toLowerCase();
}
