import crypto from 'node:crypto';
import { timingSafeEqual } from '@logixsoft/helpers/crypto';

/**
 * Computes an HMAC-SHA256 hex digest.
 */
export function signHmacSha256(data: string | Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verifies an HMAC-SHA256 signature with constant-time equality check.
 * Supports hex or base64 signatures and optional "sha256=" prefix (like GitHub/Zomato).
 */
export function verifyHmacSignature(
  rawBody: string | Buffer,
  secret: string,
  providedSignature?: string | null
): boolean {
  if (!providedSignature || !secret) {
    return false;
  }

  try {
    const cleanSignature = providedSignature.replace(/^sha256=/, '').trim();
    const expectedHex = signHmacSha256(rawBody, secret);

    if (timingSafeEqual(expectedHex.toLowerCase(), cleanSignature.toLowerCase())) {
      return true;
    }

    // Try base64 comparison if provided signature is base64
    const expectedBase64 = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    if (timingSafeEqual(expectedBase64, cleanSignature)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
