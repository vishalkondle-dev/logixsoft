/**
 * Cloudflare Workers & Node.js compatible MinIO / S3 Storage Client.
 *
 * Implements AWS Signature Version 4 (SigV4) using native Web Crypto (crypto.subtle)
 * and fetch, requiring ZERO external dependencies.
 */

export interface StorageClientConfig {
  /**
   * S3/MinIO API endpoint URL.
   * Defaults to 'https://storage.logixsoft.in'
   */
  endpoint?: string;

  /**
   * Target bucket name (e.g. 'restro', 'varunfs').
   */
  bucket: string;

  /**
   * Access Key ID / MinIO Username (e.g. 'vishalkondledev').
   */
  accessKeyId: string;

  /**
   * Secret Access Key / MinIO Password (e.g. 'Vammavg@1605').
   */
  secretAccessKey: string;

  /**
   * AWS / MinIO Region. Defaults to 'us-east-1'.
   */
  region?: string;

  /**
   * Custom public URL prefix if different from `${endpoint}/${bucket}`.
   */
  publicUrl?: string;

  /**
   * Use path-style bucket routing (e.g. `endpoint/bucket/key`).
   * Defaults to `true` (standard for MinIO).
   */
  forcePathStyle?: boolean;

  /**
   * Custom fetch function (defaults to global fetch).
   */
  fetch?: typeof fetch;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

export interface FileMetadata {
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface StorageFile {
  key: string;
  size: number;
  etag?: string;
  lastModified?: Date;
}

export interface ListFilesOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListFilesResult {
  files: StorageFile[];
  prefixes: string[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

// --- Web Crypto SigV4 Helper Functions ---

async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes as any);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as any,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service = 's3'
): Promise<Uint8Array> {
  const kDate = await hmac(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return await hmac(kService, 'aws4_request');
}

function uriEncode(string: string, encodeSlash = true): string {
  let result = '';
  for (let i = 0; i < string.length; i++) {
    const ch = string[i];
    if (
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= 'a' && ch <= 'z') ||
      (ch >= '0' && ch <= '9') ||
      ch === '_' ||
      ch === '-' ||
      ch === '~' ||
      ch === '.'
    ) {
      result += ch;
    } else if (ch === '/' && !encodeSlash) {
      result += ch;
    } else {
      const hex = ch.charCodeAt(0).toString(16).toUpperCase();
      result += '%' + (hex.length === 1 ? '0' + hex : hex);
    }
  }
  return result;
}

/**
 * MinIO & S3 Storage Client configured for a specific bucket and credentials.
 */
export class StorageClient {
  public readonly endpoint: string;
  public readonly bucket: string;
  public readonly accessKeyId: string;
  public readonly secretAccessKey: string;
  public readonly region: string;
  public readonly publicUrlBase: string;
  public readonly forcePathStyle: boolean;
  private customFetch: typeof fetch;

  constructor(config: StorageClientConfig) {
    if (!config.bucket) {
      throw new Error('StorageClient requires a bucket name.');
    }
    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error('StorageClient requires accessKeyId and secretAccessKey.');
    }

    this.endpoint = (config.endpoint || 'https://storage.logixsoft.in').replace(/\/+$/, '');
    this.bucket = config.bucket;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.region = config.region || 'us-east-1';
    this.forcePathStyle = config.forcePathStyle !== false;
    this.publicUrlBase = (
      config.publicUrl || `${this.endpoint}/${this.bucket}`
    ).replace(/\/+$/, '');
    this.customFetch = config.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (null as any));
  }

  /**
   * Constructs the full resource URL for a given object key.
   */
  private getResourceUrl(key: string, queryParams?: Record<string, string>): string {
    const cleanKey = key.replace(/^\/+/, '');
    const baseUrl = this.forcePathStyle
      ? `${this.endpoint}/${this.bucket}/${cleanKey}`
      : `${this.endpoint.replace('://', `://${this.bucket}.`)}/${cleanKey}`;

    if (!queryParams || Object.keys(queryParams).length === 0) {
      return baseUrl;
    }

    const query = Object.entries(queryParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    return `${baseUrl}?${query}`;
  }

  /**
   * Signs and executes an S3 HTTP request using AWS SigV4.
   */
  private async signedRequest(
    method: 'GET' | 'PUT' | 'DELETE' | 'HEAD' | 'POST',
    key: string,
    options: {
      body?: Uint8Array | string;
      headers?: Record<string, string>;
      queryParams?: Record<string, string>;
    } = {}
  ): Promise<Response> {
    const cleanKey = key.replace(/^\/+/, '');
    const urlString = this.getResourceUrl(cleanKey, options.queryParams);
    const parsedUrl = new URL(urlString);

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const payloadHash = options.body ? await sha256(options.body) : await sha256('');

    const normalizedHeaders: Record<string, string> = {
      host: parsedUrl.host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
    };

    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        if (v !== undefined && v !== null) {
          normalizedHeaders[k.toLowerCase()] = String(v).trim();
        }
      }
    }

    // Canonical Headers & Signed Headers
    const sortedHeaderKeys = Object.keys(normalizedHeaders).sort();

    const canonicalHeaders = sortedHeaderKeys
      .map((k) => `${k}:${normalizedHeaders[k]}\n`)
      .join('');

    const signedHeaders = sortedHeaderKeys.join(';');

    // Canonical Query String
    const sortedQueryParams = Array.from(parsedUrl.searchParams.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    const canonicalQueryString = sortedQueryParams
      .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
      .join('&');

    // Canonical URI
    const canonicalUri = uriEncode(parsedUrl.pathname, false);

    // Canonical Request
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // String to Sign
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await sha256(canonicalRequest),
    ].join('\n');

    // Calculate Signature
    const signingKey = await getSigningKey(this.secretAccessKey, dateStamp, this.region);
    const signatureBytes = await hmac(signingKey, stringToSign);
    const signature = Array.from(signatureBytes, (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');

    // Authorization Header
    normalizedHeaders[
      'Authorization'
    ] = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const reqInit: RequestInit = {
      method,
      headers: normalizedHeaders,
      body: options.body as any,
    };

    return await this.customFetch(urlString, reqInit);
  }

  /**
   * Uploads an object to the bucket.
   *
   * @param key - Destination object key / path (e.g. 'images/avatar.png')
   * @param data - Content as string, Uint8Array, ArrayBuffer, or Blob
   * @param options - Optional content type and metadata
   */
  async upload(
    key: string,
    data: string | Uint8Array | ArrayBuffer | Blob,
    options: UploadOptions = {}
  ): Promise<{ key: string; url: string; etag?: string }> {
    let bytes: Uint8Array;
    let autoContentType = options.contentType;

    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data);
      if (!autoContentType) autoContentType = 'text/plain; charset=utf-8';
    } else if (data instanceof Uint8Array) {
      bytes = data;
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
      bytes = new Uint8Array(await data.arrayBuffer());
      if (!autoContentType && data.type) autoContentType = data.type;
    } else {
      bytes = new Uint8Array(data as any);
    }

    const headers: Record<string, string> = {};
    if (autoContentType) {
      headers['Content-Type'] = autoContentType;
    }
    if (options.cacheControl) {
      headers['Cache-Control'] = options.cacheControl;
    }
    if (options.metadata) {
      for (const [k, v] of Object.entries(options.metadata)) {
        headers[`x-amz-meta-${k.toLowerCase()}`] = v;
      }
    }

    const response = await this.signedRequest('PUT', key, {
      body: bytes,
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Failed to upload object "${key}" (${response.status}): ${errText}`
      );
    }

    const etag = response.headers.get('etag')?.replace(/"/g, '') || undefined;
    const url = this.getPublicUrl(key);

    return { key, url, etag };
  }

  /**
   * Downloads an object as raw bytes. Returns `null` if the object does not exist.
   */
  async download(key: string): Promise<Uint8Array | null> {
    const response = await this.signedRequest('GET', key);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Failed to download object "${key}" (${response.status}): ${errText}`
      );
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  /**
   * Downloads an object and decodes it as a UTF-8 text string. Returns `null` if 404.
   */
  async downloadText(key: string): Promise<string | null> {
    const bytes = await this.download(key);
    if (!bytes) return null;
    return new TextDecoder().decode(bytes);
  }

  /**
   * Downloads an object and parses it as JSON. Returns `null` if 404.
   */
  async downloadJson<T = unknown>(key: string): Promise<T | null> {
    const text = await this.downloadText(key);
    if (!text) return null;
    return JSON.parse(text) as T;
  }

  /**
   * Checks if an object exists in the bucket.
   */
  async exists(key: string): Promise<boolean> {
    const response = await this.signedRequest('HEAD', key);
    if (response.status === 200) return true;
    if (response.status === 404) return false;
    return response.ok;
  }

  /**
   * Retrieves metadata and HTTP headers for an object without fetching its body.
   */
  async head(key: string): Promise<FileMetadata | null> {
    const response = await this.signedRequest('HEAD', key);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const size = parseInt(response.headers.get('content-length') || '0', 10);
    const contentType = response.headers.get('content-type') || undefined;
    const etag = response.headers.get('etag')?.replace(/"/g, '') || undefined;
    const lastModifiedHeader = response.headers.get('last-modified');
    const lastModified = lastModifiedHeader ? new Date(lastModifiedHeader) : undefined;

    const metadata: Record<string, string> = {};
    response.headers.forEach((val, name) => {
      if (name.startsWith('x-amz-meta-')) {
        metadata[name.replace('x-amz-meta-', '')] = val;
      }
    });

    return {
      size,
      contentType,
      etag,
      lastModified,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  /**
   * Deletes an object from the bucket.
   */
  async delete(key: string): Promise<boolean> {
    const response = await this.signedRequest('DELETE', key);
    return response.ok || response.status === 204 || response.status === 404;
  }

  /**
   * Deletes multiple objects in sequence.
   * Returns count of successfully processed deletions.
   */
  async deleteMany(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (await this.delete(key)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Generates a presigned time-limited GET download URL.
   *
   * @param key - Object key to download
   * @param expiresInSeconds - URL validity window in seconds (default: 3600 = 1 hour)
   */
  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return this.createPresignedUrl('GET', key, expiresInSeconds);
  }

  /**
   * Generates a presigned time-limited PUT upload URL for direct client browser uploads.
   *
   * @param key - Destination object key
   * @param options - Expiration time and optional Content-Type restriction
   */
  async getSignedUploadUrl(
    key: string,
    options: { expiresInSeconds?: number; contentType?: string } = {}
  ): Promise<string> {
    const expiresIn = options.expiresInSeconds || 900; // 15 mins default
    return this.createPresignedUrl('PUT', key, expiresIn, options.contentType);
  }

  /**
   * Core Presigned URL generator using query-string authentication.
   */
  private async createPresignedUrl(
    method: 'GET' | 'PUT',
    key: string,
    expiresInSeconds: number,
    contentType?: string
  ): Promise<string> {
    const cleanKey = key.replace(/^\/+/, '');
    const baseUrl = this.getResourceUrl(cleanKey);
    const parsedUrl = new URL(baseUrl);

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': Math.min(604800, Math.max(1, expiresInSeconds)).toString(),
      'X-Amz-SignedHeaders': 'host',
    };

    if (contentType && method === 'PUT') {
      queryParams['X-Amz-SignedHeaders'] = 'content-type;host';
    }

    // Sorted canonical query params
    const sortedKeys = Object.keys(queryParams).sort();
    const canonicalQueryString = sortedKeys
      .map((k) => `${uriEncode(k)}=${uriEncode(queryParams[k])}`)
      .join('&');

    const canonicalHeaders =
      contentType && method === 'PUT'
        ? `content-type:${contentType.trim()}\nhost:${parsedUrl.host}\n`
        : `host:${parsedUrl.host}\n`;

    const canonicalRequest = [
      method,
      uriEncode(parsedUrl.pathname, false),
      canonicalQueryString,
      canonicalHeaders,
      queryParams['X-Amz-SignedHeaders'],
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await sha256(canonicalRequest),
    ].join('\n');

    const signingKey = await getSigningKey(this.secretAccessKey, dateStamp, this.region);
    const signatureBytes = await hmac(signingKey, stringToSign);
    const signature = Array.from(signatureBytes, (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');

    return `${baseUrl}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  /**
   * Returns the direct public URL for an object.
   */
  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, '');
    return `${this.publicUrlBase}/${cleanKey}`;
  }

  /**
   * Lists objects in the bucket with optional prefix filtering.
   */
  async list(options: ListFilesOptions = {}): Promise<ListFilesResult> {
    const queryParams: Record<string, string> = {
      'list-type': '2',
    };
    if (options.prefix) queryParams['prefix'] = options.prefix;
    if (options.maxKeys) queryParams['max-keys'] = options.maxKeys.toString();
    if (options.continuationToken) {
      queryParams['continuation-token'] = options.continuationToken;
    }

    const response = await this.signedRequest('GET', '', { queryParams });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to list objects in bucket "${this.bucket}": ${err}`);
    }

    const xml = await response.text();
    const files: StorageFile[] = [];
    const prefixes: string[] = [];

    // Simple regex extraction for lightweight edge compatibility
    const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
    let match: RegExpExecArray | null;

    while ((match = contentsRegex.exec(xml)) !== null) {
      const block = match[1];
      const keyMatch = block.match(/<Key>(.*?)<\/Key>/);
      const sizeMatch = block.match(/<Size>(.*?)<\/Size>/);
      const etagMatch = block.match(/<ETag>(.*?)<\/ETag>/);
      const lastModMatch = block.match(/<LastModified>(.*?)<\/LastModified>/);

      if (keyMatch) {
        files.push({
          key: keyMatch[1],
          size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
          etag: etagMatch ? etagMatch[1].replace(/&quot;|"/g, '') : undefined,
          lastModified: lastModMatch ? new Date(lastModMatch[1]) : undefined,
        });
      }
    }

    const isTruncatedMatch = xml.match(/<IsTruncated>(.*?)<\/IsTruncated>/);
    const isTruncated = isTruncatedMatch ? isTruncatedMatch[1] === 'true' : false;

    const nextTokenMatch = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/);
    const nextContinuationToken = nextTokenMatch ? nextTokenMatch[1] : undefined;

    return {
      files,
      prefixes,
      isTruncated,
      nextContinuationToken,
    };
  }

  /**
   * Ensures the target bucket exists in MinIO/S3. If not, attempts to create it.
   */
  async createBucketIfNotExists(): Promise<boolean> {
    const headRes = await this.signedRequest('HEAD', '');
    if (headRes.ok || headRes.status === 200) {
      return true; // Bucket already exists
    }

    if (headRes.status === 404) {
      const putRes = await this.signedRequest('PUT', '');
      return putRes.ok;
    }

    return false;
  }
}

/**
 * Creates a configured StorageClient for interacting with MinIO / S3.
 *
 * @example
 * ```ts
 * export const restroStorage = createStorageClient({
 *   bucket: 'restro',
 *   accessKeyId: process.env.MINIO_ACCESS_KEY,
 *   secretAccessKey: process.env.MINIO_SECRET_KEY,
 * });
 *
 * await restroStorage.upload('menu/item-1.jpg', fileBuffer, { contentType: 'image/jpeg' });
 * const downloadUrl = await restroStorage.getSignedDownloadUrl('menu/item-1.jpg', 3600);
 * ```
 */
export function createStorageClient(config: StorageClientConfig): StorageClient {
  return new StorageClient(config);
}
