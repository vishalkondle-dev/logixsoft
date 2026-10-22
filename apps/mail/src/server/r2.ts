import { CONFIG } from "./config";

export const R2_BUCKET = "mailflare-attachments";

export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string = "application/octet-stream"
): Promise<boolean> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CONFIG.CF_API_TOKEN}`,
      "Content-Type": contentType,
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to upload object ${key} to R2:`, err);
    throw new Error(`R2 upload failed: ${res.statusText}`);
  }

  return true;
}

export async function getFromR2(
  key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${CONFIG.CF_API_TOKEN}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const err = await res.text();
    console.error(`Failed to get object ${key} from R2:`, err);
    throw new Error(`R2 download failed: ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}
