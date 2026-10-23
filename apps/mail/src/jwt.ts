export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  avatar_url?: string | null;
  status_message?: string | null;
  bio?: string | null;
  signature?: string | null;
  sound_enabled?: number;
}

async function getJwtKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof buffer === "string") {
    bytes = new TextEncoder().encode(buffer);
  } else if (buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(buffer);
  } else {
    bytes = buffer;
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function signJwt(
  payload: AuthUser,
  secret: string,
  expiresInSeconds: number = 30 * 86400
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await getJwtKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const encodedSignature = base64UrlEncode(signature);

  return `${data}.${encodedSignature}`;
}

export async function verifyJwt(token: string, secret: string): Promise<AuthUser | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const data = `${headerB64}.${payloadB64}`;
    const key = await getJwtKey(secret);
    const sigBytes = base64UrlDecode(sigB64);

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as unknown as BufferSource,
      new TextEncoder().encode(data)
    );
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null; // Token expired
    }

    if (!payload.id || !payload.email) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name || payload.email.split("@")[0],
      role: payload.role || "user",
      avatar_url: payload.avatar_url || null,
      status_message: payload.status_message || null,
      bio: payload.bio || null,
      signature: payload.signature || null,
      sound_enabled: payload.sound_enabled !== undefined ? payload.sound_enabled : 1,
    };
  } catch {
    return null;
  }
}
