import crypto from 'node:crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getKey(customKey?: string): Buffer {
  const keyStr = customKey || config.masterEncryptionKey;
  if (/^[0-9a-fA-F]{64}$/.test(keyStr)) {
    return Buffer.from(keyStr, 'hex');
  }
  return crypto.createHash('sha256').update(keyStr).digest();
}

/**
 * Encrypts an object or string using AES-256-GCM.
 * Returns a serialized format: iv:authTag:ciphertext (hex encoded)
 */
export function encryptJson(data: any, customKey?: string): string {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey(customKey);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string back to an object or string.
 */
export function decryptJson<T = any>(encryptedPayload: string, customKey?: string): T {
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }

    const [ivHex, authTagHex, cipherText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getKey(customKey);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted as unknown as T;
    }
  } catch (err: any) {
    throw new Error(`Failed to decrypt credentials: ${err.message}`);
  }
}
