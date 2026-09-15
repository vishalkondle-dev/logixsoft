export interface WhatsAppClientConfig {
  /**
   * Base URL of the OpenWA WhatsApp Gateway.
   * Defaults to process.env.WA_API_URL or 'http://127.0.0.1:2785' (or 'https://wa.logixsoft.in').
   */
  url?: string;
  /**
   * API Key header token for OpenWA (X-Api-Key).
   * Defaults to process.env.WA_API_KEY, process.env.OPENWA_API_KEY, or the system default key.
   */
  apiKey?: string;
  /**
   * The target WhatsApp session ID or name.
   * Defaults to process.env.WA_SESSION_NAME || 'logixsoft'.
   * If a session name is provided, it is automatically resolved to its active session ID.
   */
  sessionId?: string;
  sessionName?: string;
  /** Custom fetch implementation (defaults to global fetch) */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds (defaults to 30,000 ms) */
  timeoutMs?: number;
}

export type MediaSource = string | Uint8Array | ArrayBuffer;

export interface SendTextMessageOptions {
  /**
   * Phone number or chat ID.
   * Accepts raw numbers (e.g. "9876543210", "+91 98765 43210", "919876543210@c.us") or group IDs ("123456789@g.us").
   */
  to: string;
  /** Text message to send */
  text: string;
  /** Optional WhatsApp IDs (@c.us) to mention */
  mentions?: string[];
  /** Optional session override */
  sessionId?: string;
}

export interface SendMediaMessageOptions {
  /** Phone number or chat ID */
  to: string;
  /**
   * Media content:
   * - Public HTTP/HTTPS URL
   * - Base64 encoded string
   * - Uint8Array / Buffer / ArrayBuffer
   */
  media: MediaSource;
  /** MIME type of media (required if base64/binary, e.g. "image/jpeg", "image/png", "application/pdf") */
  mimetype?: string;
  /** File name (e.g. "invoice.pdf", "photo.jpg") */
  filename?: string;
  /** Optional caption to display below the media */
  caption?: string;
  /** Optional WhatsApp IDs (@c.us) to mention */
  mentions?: string[];
  /** Optional session override */
  sessionId?: string;
}

export interface SendDocumentMessageOptions extends SendMediaMessageOptions {}

export interface SendLocationOptions {
  /** Phone number or chat ID */
  to: string;
  /** Latitude coordinate */
  latitude: number;
  /** Longitude coordinate */
  longitude: number;
  /** Optional title or name of the location */
  title?: string;
  /** Optional address string */
  address?: string;
  /** Optional session override */
  sessionId?: string;
}

export interface SendOtpOptions {
  /** Phone number or chat ID */
  to: string;
  /** The OTP code */
  otp: string;
  /** Application or business name (defaults to 'Logixsoft') */
  appName?: string;
  /** Validity duration in minutes (defaults to 10) */
  expiryMinutes?: number;
  /** Optional session override */
  sessionId?: string;
}

export interface WhatsAppResponse {
  /** Whether the message was successfully dispatched to WhatsApp */
  success: boolean;
  /** WhatsApp Message ID assigned by the gateway (e.g. true_917822914442@c.us_3EB0...) */
  messageId?: string;
  /** Unix timestamp in seconds when the message was accepted */
  timestamp?: number;
  /** Error message if sending failed */
  error?: string;
  /** HTTP status code */
  statusCode?: number;
}

export interface SessionInfo {
  id: string;
  name: string;
  status: 'starting' | 'scan_qr' | 'authenticating' | 'ready' | 'failed' | 'disconnected';
  phone?: string;
  pushName?: string;
  connectedAt?: string;
  lastActive?: string;
  lastError?: string | null;
}
