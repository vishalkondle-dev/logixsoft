import crypto from 'node:crypto';

export interface BecknAuthHeader {
  keyId: string;
  algorithm: string;
  created: number;
  expires: number;
  headers: string[];
  signature: string;
}

/**
 * Parses Beckn Signature authorization header.
 * Example format:
 * Signature keyId="bap.example.com|key1|ed25519",algorithm="ed25519",created="1695800000",expires="1695800300",headers="(created) (expires) digest",signature="BASE64..."
 */
export function parseBecknAuthHeader(headerValue: string): BecknAuthHeader | null {
  try {
    const clean = headerValue.replace(/^Signature\s+/i, '').trim();
    const parts = clean.split(/,\s*(?=[a-zA-Z]+=)/);
    const result: Record<string, string> = {};

    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const rawVal = part.slice(eqIdx + 1).trim();
      const val = rawVal.replace(/^["']|["']$/g, '');
      result[key] = val;
    }

    if (!result.signature || !result.keyId) {
      return null;
    }

    return {
      keyId: result.keyId,
      algorithm: result.algorithm || 'ed25519',
      created: Number(result.created || Math.floor(Date.now() / 1000)),
      expires: Number(result.expires || Math.floor(Date.now() / 1000) + 300),
      headers: result.headers ? result.headers.split(' ') : ['(created)', '(expires)', 'digest'],
      signature: result.signature,
    };
  } catch {
    return null;
  }
}

/**
 * Creates digest string for Beckn payload (SHA-256 base64 or BLAKE2b).
 */
export function createBecknDigest(rawBody: string | Buffer): string {
  const hash = crypto.createHash('sha256').update(rawBody).digest('base64');
  return `SHA-256=${hash}`;
}

/**
 * Generates an Ed25519 keypair encoded in Base64 / PEM.
 */
export function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyBase64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKeyBase64: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

/**
 * Signs an outbound Beckn request or response with Ed25519.
 */
export function signBecknMessage(
  rawBody: string | Buffer,
  subscriberId: string,
  uniqueKeyId: string,
  privateKeyPemOrBase64: string,
  ttlSeconds = 300
): { authorizationHeader: string; digest: string } {
  const created = Math.floor(Date.now() / 1000);
  const expires = created + ttlSeconds;
  const digest = createBecknDigest(rawBody);

  const signingString = `(created): ${created}\n(expires): ${expires}\ndigest: ${digest}`;

  let privateKey: crypto.KeyObject;
  if (privateKeyPemOrBase64.includes('BEGIN PRIVATE KEY')) {
    privateKey = crypto.createPrivateKey(privateKeyPemOrBase64);
  } else {
    // DER base64
    const der = Buffer.from(privateKeyPemOrBase64, 'base64');
    privateKey = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  }

  const signature = crypto.sign(null, Buffer.from(signingString), privateKey).toString('base64');
  const keyId = `${subscriberId}|${uniqueKeyId}|ed25519`;

  const authorizationHeader = `Signature keyId="${keyId}",algorithm="ed25519",created="${created}",expires="${expires}",headers="(created) (expires) digest",signature="${signature}"`;

  return { authorizationHeader, digest };
}

/**
 * Verifies an inbound Beckn request signature using Ed25519.
 */
export function verifyBecknSignature(
  rawBody: string | Buffer,
  authHeader: string,
  publicKeyPemOrBase64: string
): boolean {
  try {
    const parsed = parseBecknAuthHeader(authHeader);
    if (!parsed) return false;

    // Check expiration with 60s clock drift tolerance
    const now = Math.floor(Date.now() / 1000);
    if (parsed.expires < now - 60) {
      return false;
    }

    const digest = createBecknDigest(rawBody);
    const signingString = `(created): ${parsed.created}\n(expires): ${parsed.expires}\ndigest: ${digest}`;

    let publicKey: crypto.KeyObject;
    if (publicKeyPemOrBase64.includes('BEGIN PUBLIC KEY')) {
      publicKey = crypto.createPublicKey(publicKeyPemOrBase64);
    } else {
      const der = Buffer.from(publicKeyPemOrBase64, 'base64');
      publicKey = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    }

    const signatureBuffer = Buffer.from(parsed.signature, 'base64');
    return crypto.verify(null, Buffer.from(signingString), publicKey, signatureBuffer);
  } catch (err) {
    return false;
  }
}
