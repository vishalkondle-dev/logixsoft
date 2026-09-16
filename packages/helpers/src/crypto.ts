import crypto from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Constant-time string equality check to prevent timing attacks.
 * Safe for comparing cryptographic signatures, API tokens, and secrets.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generates a cryptographically secure random alphanumeric string (Base62).
 *
 * @param length - The number of characters to generate (default: 24)
 */
export function generateRandomString(length = 24): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  const alphabetLength = ALPHABET.length;

  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % alphabetLength];
  }

  return result;
}

/**
 * Generates a Stripe-style prefixed identifier (e.g. `order_k7x9...`, `user_8ab2...`).
 *
 * @param prefix - Prefix identifying the resource type (e.g., 'order', 'user', 'tx')
 * @param length - Length of the random string part (default: 24)
 *
 * @example
 * ```ts
 * generateId('order') // -> 'order_7kx92j4Lm01Q...'
 * generateId('key')   // -> 'key_9fA2...'
 * ```
 */
export function generateId(prefix?: string, length = 24): string {
  const id = generateRandomString(length);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generates a secure random hex token (e.g. for session tokens, password resets, or API secrets).
 *
 * @param byteLength - Number of random bytes to generate (default: 32 bytes -> 64 hex characters)
 */
export function generateToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Generates a cryptographically secure numeric OTP code.
 *
 * @param length - Number of digits in the OTP (default: 6)
 *
 * @example
 * ```ts
 * generateNumericOtp(6) // -> '582910'
 * ```
 */
export function generateNumericOtp(length = 6): string {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const num = crypto.randomInt(min, max);
  return num.toString();
}

/**
 * Computes a SHA-256 hex digest of a string or Buffer.
 *
 * @param data - The data to hash
 */
export function hashSha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Computes an HMAC-SHA256 hex signature.
 *
 * @param data - The message or payload string to sign
 * @param secret - Secret key used for signing
 */
export function signHmacSha256(data: string | Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verifies an HMAC-SHA256 signature using timing-safe comparison.
 * Protects against side-channel timing attacks when verifying webhooks or API calls.
 *
 * @param data - The payload that was signed
 * @param secret - The shared secret key
 * @param signature - The signature to verify against
 */
export function verifyHmacSha256(
  data: string | Buffer,
  secret: string,
  signature: string
): boolean {
  try {
    const expected = signHmacSha256(data, secret);
    return timingSafeEqual(expected, signature);
  } catch {
    return false;
  }
}
