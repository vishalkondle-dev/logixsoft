import { formatChatId, normalizeMedia } from './format';
import type {
  WhatsAppClientConfig,
  SendTextMessageOptions,
  SendMediaMessageOptions,
  SendDocumentMessageOptions,
  SendLocationOptions,
  SendOtpOptions,
  WhatsAppResponse,
  SessionInfo,
} from './types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_KEY = 'owa_k1_176d3ffb80ff1aef35d980e8181d5e04ed256bf78d6346dc629cf6f05ed1334e';

export class WhatsAppClient {
  private url: string;
  private apiKey: string;
  private sessionName: string;
  private cachedSessionId?: string;
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(config: WhatsAppClientConfig = {}) {
    const envUrl =
      typeof process !== 'undefined' && process.env
        ? process.env.WA_API_URL || process.env.OPENWA_API_URL
        : undefined;

    const envKey =
      typeof process !== 'undefined' && process.env
        ? process.env.WA_API_KEY || process.env.OPENWA_API_KEY
        : undefined;

    const envSession =
      typeof process !== 'undefined' && process.env
        ? process.env.WA_SESSION_NAME || process.env.WA_SESSION_ID
        : undefined;

    // Use localhost if available on server, or public wa.logixsoft.in
    this.url = (config.url || envUrl || 'http://127.0.0.1:2785').replace(/\/+$/, '');
    this.apiKey = config.apiKey || envKey || DEFAULT_KEY;
    this.sessionName = config.sessionName || config.sessionId || envSession || 'logixsoft';
    this.fetchFn = config.fetch || globalThis.fetch.bind(globalThis);
    this.timeoutMs = config.timeoutMs ?? 30_000;

    if (config.sessionId && UUID_REGEX.test(config.sessionId)) {
      this.cachedSessionId = config.sessionId;
    }
  }

  /**
   * Internal request helper
   */
  private async request<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
        ...(options.headers as Record<string, string>),
      };

      const res = await this.fetchFn(`${this.url}${path}`, {
        ...options,
        headers,
        signal: controller?.signal,
      });

      if (timeout) clearTimeout(timeout);

      const data = (await res.json().catch(() => ({}))) as T;
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: !res.ok ? (data as any)?.message || (data as any)?.error || `HTTP ${res.status}` : undefined,
      };
    } catch (err: any) {
      if (timeout) clearTimeout(timeout);
      return {
        ok: false,
        status: 500,
        data: {} as T,
        error: err?.name === 'AbortError' ? `Request timed out after ${this.timeoutMs}ms` : err?.message,
      };
    }
  }

  /**
   * List all configured WhatsApp sessions and their statuses.
   */
  async getSessions(): Promise<SessionInfo[]> {
    const res = await this.request<SessionInfo[]>('/api/sessions', { method: 'GET' });
    return res.ok && Array.isArray(res.data) ? res.data : [];
  }

  /**
   * Resolves the UUID of the target WhatsApp session.
   */
  async resolveSessionId(preferredSession?: string): Promise<string> {
    const target = preferredSession || this.sessionName;

    // If already a valid UUID
    if (UUID_REGEX.test(target)) {
      return target;
    }

    if (this.cachedSessionId && !preferredSession) {
      return this.cachedSessionId;
    }

    const sessions = await this.getSessions();
    if (sessions.length === 0) {
      throw new Error('No WhatsApp sessions found on OpenWA gateway.');
    }

    // Match by name
    const byName = sessions.find((s) => s.name.toLowerCase() === target.toLowerCase());
    if (byName) {
      if (!preferredSession) this.cachedSessionId = byName.id;
      return byName.id;
    }

    // Match first active session
    const readySession = sessions.find((s) => s.status === 'ready');
    if (readySession) {
      if (!preferredSession) this.cachedSessionId = readySession.id;
      return readySession.id;
    }

    // Fallback to first session
    return sessions[0].id;
  }

  /**
   * Send a plain text message.
   */
  async sendText(options: SendTextMessageOptions): Promise<WhatsAppResponse> {
    try {
      const sessionId = await this.resolveSessionId(options.sessionId);
      const chatId = formatChatId(options.to);

      const res = await this.request<{ messageId: string; timestamp: number }>(
        `/api/sessions/${sessionId}/messages/send-text`,
        {
          method: 'POST',
          body: JSON.stringify({
            chatId,
            text: options.text,
            mentions: options.mentions,
          }),
        }
      );

      if (!res.ok) {
        return {
          success: false,
          error: res.error,
          statusCode: res.status,
        };
      }

      return {
        success: true,
        messageId: res.data?.messageId,
        timestamp: res.data?.timestamp,
        statusCode: res.status,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to send WhatsApp text message',
      };
    }
  }

  /**
   * Send an image with an optional caption.
   */
  async sendImage(options: SendMediaMessageOptions): Promise<WhatsAppResponse> {
    try {
      const sessionId = await this.resolveSessionId(options.sessionId);
      const chatId = formatChatId(options.to);
      const media = normalizeMedia(options.media, {
        filename: options.filename,
        mimetype: options.mimetype,
      });

      const res = await this.request<{ messageId: string; timestamp: number }>(
        `/api/sessions/${sessionId}/messages/send-image`,
        {
          method: 'POST',
          body: JSON.stringify({
            chatId,
            ...media,
            caption: options.caption,
            mentions: options.mentions,
          }),
        }
      );

      if (!res.ok) {
        return {
          success: false,
          error: res.error,
          statusCode: res.status,
        };
      }

      return {
        success: true,
        messageId: res.data?.messageId,
        timestamp: res.data?.timestamp,
        statusCode: res.status,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to send WhatsApp image',
      };
    }
  }

  /**
   * Send a document or generic attachment (e.g. PDF, Word, Excel, ZIP).
   */
  async sendDocument(options: SendDocumentMessageOptions): Promise<WhatsAppResponse> {
    try {
      const sessionId = await this.resolveSessionId(options.sessionId);
      const chatId = formatChatId(options.to);
      const media = normalizeMedia(options.media, {
        filename: options.filename || 'attachment.pdf',
        mimetype: options.mimetype,
      });

      const res = await this.request<{ messageId: string; timestamp: number }>(
        `/api/sessions/${sessionId}/messages/send-document`,
        {
          method: 'POST',
          body: JSON.stringify({
            chatId,
            ...media,
            caption: options.caption,
            mentions: options.mentions,
          }),
        }
      );

      if (!res.ok) {
        return {
          success: false,
          error: res.error,
          statusCode: res.status,
        };
      }

      return {
        success: true,
        messageId: res.data?.messageId,
        timestamp: res.data?.timestamp,
        statusCode: res.status,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to send WhatsApp document',
      };
    }
  }

  /**
   * Alias for sendDocument.
   */
  async sendFile(options: SendDocumentMessageOptions): Promise<WhatsAppResponse> {
    return this.sendDocument(options);
  }

  /**
   * Send a video file with an optional caption.
   */
  async sendVideo(options: SendMediaMessageOptions): Promise<WhatsAppResponse> {
    try {
      const sessionId = await this.resolveSessionId(options.sessionId);
      const chatId = formatChatId(options.to);
      const media = normalizeMedia(options.media, {
        filename: options.filename || 'video.mp4',
        mimetype: options.mimetype || 'video/mp4',
      });

      const res = await this.request<{ messageId: string; timestamp: number }>(
        `/api/sessions/${sessionId}/messages/send-video`,
        {
          method: 'POST',
          body: JSON.stringify({
            chatId,
            ...media,
            caption: options.caption,
            mentions: options.mentions,
          }),
        }
      );

      return {
        success: res.ok,
        messageId: res.data?.messageId,
        timestamp: res.data?.timestamp,
        error: res.error,
        statusCode: res.status,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to send WhatsApp video',
      };
    }
  }

  /**
   * Send a location pin.
   */
  async sendLocation(options: SendLocationOptions): Promise<WhatsAppResponse> {
    try {
      const sessionId = await this.resolveSessionId(options.sessionId);
      const chatId = formatChatId(options.to);

      const res = await this.request<{ messageId: string; timestamp: number }>(
        `/api/sessions/${sessionId}/messages/send-location`,
        {
          method: 'POST',
          body: JSON.stringify({
            chatId,
            latitude: options.latitude,
            longitude: options.longitude,
            title: options.title,
            address: options.address,
          }),
        }
      );

      return {
        success: res.ok,
        messageId: res.data?.messageId,
        timestamp: res.data?.timestamp,
        error: res.error,
        statusCode: res.status,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to send WhatsApp location',
      };
    }
  }

  /**
   * Send a formatted OTP verification message.
   */
  async sendOtp(options: SendOtpOptions): Promise<WhatsAppResponse> {
    const app = options.appName || 'Logixsoft';
    const expiry = options.expiryMinutes || 10;
    const text = `*${app} Verification Code*\n\nYour security code is: *${options.otp}*\n\nThis code is valid for ${expiry} minutes. Please do not share this code with anyone.`;

    return this.sendText({
      to: options.to,
      text,
      sessionId: options.sessionId,
    });
  }

  /**
   * Check gateway connectivity and health.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.request<{ status: string }>('/api/health', { method: 'GET' });
      return res.ok && res.data?.status === 'ok';
    } catch {
      return false;
    }
  }
}

export function createWhatsAppClient(config?: WhatsAppClientConfig): WhatsAppClient {
  return new WhatsAppClient(config);
}
