export interface MailAttachment {
  /** The name of the attachment file (e.g. "invoice.pdf") */
  filename: string;
  /**
   * Attachment content. Can be:
   * - A base64-encoded string
   * - A Uint8Array / Buffer / ArrayBuffer (will be automatically base64-encoded)
   */
  content: string | Uint8Array | ArrayBuffer;
  /** MIME type of the attachment (defaults to "application/octet-stream") */
  contentType?: string;
}

export interface SendMailOptions {
  /** Recipient email address or an array of recipient email addresses */
  to: string | string[];
  /** Subject line of the email */
  subject: string;
  /** HTML body content of the email */
  body?: string;
  /** Alias for body (HTML content) */
  html?: string;
  /** Plain text fallback, converted into simple HTML formatting if body/html is omitted */
  text?: string;
  /** Optional custom sender address (defaults to the worker's configured SMTP_USER) */
  from?: string;
  /** Optional file attachments */
  attachments?: MailAttachment[];
}

export interface MailClientConfig {
  /**
   * URL of the deployed Mail Worker.
   * Defaults to process.env.MAIL_WORKER_URL, process.env.NEXT_PUBLIC_MAIL_WORKER_URL, or 'https://mail.logixsoft.in'.
   */
  url?: string;
  /**
   * API Key required for authentication with the Mail Worker.
   * Defaults to process.env.MAIL_API_KEY, process.env.MAIL_WORKER_API_KEY, or process.env.API_KEY.
   */
  apiKey?: string;
  /** Optional custom fetch implementation (defaults to global fetch) */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds (defaults to 15,000 ms) */
  timeoutMs?: number;
}

export interface SendMailResponse {
  /** Whether the email was accepted and sent successfully */
  success: boolean;
  /** The message ID or SMTP response line returned by the server on success */
  messageId?: string;
  /** Error message if sending failed */
  error?: string;
  /** HTTP status code returned by the worker */
  statusCode?: number;
}

export interface OtpMailOptions {
  /** Recipient email address */
  to: string;
  /** The OTP or verification code */
  otp: string;
  /** Name of the application (defaults to 'Logixsoft') */
  appName?: string;
  /** Number of minutes before the code expires (defaults to 10) */
  expiryMinutes?: number;
  /** Optional sender address override */
  from?: string;
}

export interface WelcomeMailOptions {
  /** Recipient email address */
  to: string;
  /** User's display name or username */
  name?: string;
  /** Name of the application (defaults to 'Logixsoft') */
  appName?: string;
  /** URL for the user to log in or get started */
  loginUrl?: string;
  /** Optional sender address override */
  from?: string;
}
