import type { SessionPayload } from './cache';

/**
 * High-performance, zero-dependency JWT utility using Web Crypto API (crypto.subtle).
 * Fully compatible with Cloudflare Workers (workerd) and Node.js 18+.
 */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface JwtSessionClaims {
  sub: string;
  user: SessionPayload['user'];
  memberships: SessionPayload['memberships'];
  iat: number;
  exp: number;
}

/**
 * Sign a SessionPayload into a standard HMAC-SHA256 JWT.
 * Contains user info + all restaurant memberships + all permitted outletIds.
 * Enables zero-DB-call authentication & authorization across isolates.
 */
export async function signSessionJwt(
  payload: SessionPayload,
  secret: string,
  ttlSeconds = 7 * 24 * 3600 // 7 days
): Promise<string> {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'HS256', typ: 'JWT' };
  const claims: JwtSessionClaims = {
    sub: payload.user.id,
    user: payload.user,
    memberships: payload.memberships,
    iat: now,
    exp: now + ttlSeconds,
  };

  const b64Header = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const b64Claims = base64UrlEncode(enc.encode(JSON.stringify(claims)));
  const data = `${b64Header}.${b64Claims}`;

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const b64Signature = base64UrlEncode(new Uint8Array(signature));

  return `${data}.${b64Signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 JWT into a SessionPayload.
 * Returns null if signature is invalid or token is expired.
 */
export async function verifySessionJwt(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;

    const [b64Header, b64Claims, b64Signature] = parts;
    const data = `${b64Header}.${b64Claims}`;
    const enc = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = base64UrlDecode(b64Signature);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data));
    if (!isValid) return null;

    const claimsBytes = base64UrlDecode(b64Claims);
    const claims = JSON.parse(new TextDecoder().decode(claimsBytes)) as JwtSessionClaims;

    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && now > claims.exp) {
      return null; // Expired
    }

    if (!claims.user || !claims.memberships) {
      return null;
    }

    return {
      user: claims.user,
      memberships: claims.memberships,
    };
  } catch {
    return null;
  }
}
