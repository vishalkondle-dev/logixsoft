import type {
  MailClientConfig,
  SendMailOptions,
  SendMailResponse,
  OtpMailOptions,
  WelcomeMailOptions,
  MailAttachment,
} from './types.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function encodeAttachmentContent(content: string | Uint8Array | ArrayBuffer): string {
  if (typeof content === 'string') {
    return content;
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(content)) {
    return content.toString('base64');
  }
  if (content instanceof Uint8Array) {
    let binary = '';
    const bytes = content;
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  if (content instanceof ArrayBuffer) {
    return encodeAttachmentContent(new Uint8Array(content));
  }
  return String(content);
}

export class MailClient {
  private url: string;
  private apiKey?: string;
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(config: MailClientConfig = {}) {
    const envUrl =
      typeof process !== 'undefined' && process.env
        ? process.env.MAIL_WORKER_URL || process.env.NEXT_PUBLIC_MAIL_WORKER_URL
        : undefined;

    const envKey =
      typeof process !== 'undefined' && process.env
        ? process.env.MAIL_API_KEY ||
          process.env.MAIL_WORKER_API_KEY ||
          process.env.API_KEY
        : undefined;

    this.url = (config.url || envUrl || 'https://mail.logixsoft.in').replace(/\/+$/, '');
    this.apiKey = config.apiKey || envKey;
    this.fetchFn = config.fetch || globalThis.fetch.bind(globalThis);
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  /**
   * Send an email through the Logixsoft Mail Worker.
   */
  async send(options: SendMailOptions): Promise<SendMailResponse> {
    if (Array.isArray(options.to)) {
      const results = await Promise.all(
        options.to.map((recipient) => this.send({ ...options, to: recipient }))
      );
      const failed = results.find((r) => !r.success);
      return failed || results[0] || { success: true };
    }

    const { to, subject, from } = options;
    const body =
      options.body ||
      options.html ||
      (options.text
        ? `<div style="font-family: sans-serif; line-height: 1.5;">${escapeHtml(options.text).replace(/\n/g, '<br/>')}</div>`
        : '');

    if (!to || !subject || !body) {
      return {
        success: false,
        error: 'Missing required email fields: to, subject, and body/html are required.',
      };
    }

    let attachments: Array<{ filename: string; content: string; contentType?: string }> | undefined;
    if (options.attachments && options.attachments.length > 0) {
      attachments = options.attachments.map((att: MailAttachment) => ({
        filename: att.filename,
        content: encodeAttachmentContent(att.content),
        contentType: att.contentType || 'application/octet-stream',
      }));
    }

    const payload = {
      to,
      subject,
      body,
      from,
      attachments,
    };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : null;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }

      const endpoint = `${this.url}/send-email`;
      const response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller?.signal,
      });

      if (timeout) clearTimeout(timeout);

      const data = (await response.json().catch(() => ({}))) as Record<string, any>;

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Mail worker request failed with status ${response.status}`,
          statusCode: response.status,
        };
      }

      return {
        success: true,
        messageId: data.messageId,
        statusCode: response.status,
      };
    } catch (err: any) {
      if (timeout) clearTimeout(timeout);
      const isTimeout = err?.name === 'AbortError';
      return {
        success: false,
        error: isTimeout
          ? `Mail request timed out after ${this.timeoutMs}ms`
          : err?.message || 'Failed to communicate with Mail Worker',
      };
    }
  }

  /**
   * Send an email and throw an Error if delivery fails.
   */
  async sendOrThrow(options: SendMailOptions): Promise<string> {
    const res = await this.send(options);
    if (!res.success) {
      throw new Error(res.error || 'Failed to send email');
    }
    return res.messageId || 'OK';
  }

  /**
   * Send a pre-formatted, professional One-Time Password (OTP) verification email.
   */
  async sendOtp(options: OtpMailOptions): Promise<SendMailResponse> {
    const appName = options.appName || 'Logixsoft';
    const expiry = options.expiryMinutes || 10;
    const subject = `Your ${appName} Verification Code: ${options.otp}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #333333; margin: 0; padding: 30px 10px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <tr>
      <td style="padding: 36px 32px; text-align: center;">
        <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px; font-weight: 700;">Verification Code</h2>
        <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.5;">
          Use the verification code below to complete your sign-in with <strong>${escapeHtml(appName)}</strong>.
        </p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 18px 24px; display: inline-block; margin-bottom: 24px; letter-spacing: 6px; font-size: 32px; font-weight: 800; color: #1f2937;">
          ${escapeHtml(options.otp)}
        </div>
        <p style="margin: 0; color: #6b7280; font-size: 13px;">
          This code is valid for <strong>${expiry} minutes</strong>. If you did not request this, you can safely ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
        &copy; ${new Date().getFullYear()} ${escapeHtml(appName)}. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.send({
      to: options.to,
      subject,
      html,
      from: options.from,
    });
  }

  /**
   * Send a pre-formatted, professional welcome onboarding email.
   */
  async sendWelcome(options: WelcomeMailOptions): Promise<SendMailResponse> {
    const appName = options.appName || 'Logixsoft';
    const subject = `Welcome to ${appName}!`;
    const greeting = options.name ? `Hi ${escapeHtml(options.name)},` : 'Hello,';
    const loginUrl = options.loginUrl || 'https://logixsoft.in';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #333333; margin: 0; padding: 30px 10px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <tr>
      <td style="padding: 36px 32px;">
        <h2 style="margin: 0 0 16px; color: #111827; font-size: 24px; font-weight: 700;">Welcome to ${escapeHtml(appName)}</h2>
        <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
          ${greeting}
        </p>
        <p style="margin: 0 0 24px; color: #374151; font-size: 15px; line-height: 1.6;">
          Thank you for signing up. Your account is ready, and you can now get started exploring our platform and services.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${escapeHtml(loginUrl)}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 600; text-decoration: none; display: inline-block;">
            Go to Dashboard &rarr;
          </a>
        </div>
        <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
          If you have any questions or need support, reply directly to this email or visit our help center.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
        &copy; ${new Date().getFullYear()} ${escapeHtml(appName)}. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.send({
      to: options.to,
      subject,
      html,
      from: options.from,
    });
  }

  /**
   * Check whether the mail worker is reachable.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.fetchFn(this.url, { method: 'GET' });
      // The worker returns HTTP 405 "Method not allowed" for GET, confirming it is up and reachable
      return res.status === 405 || res.ok;
    } catch {
      return false;
    }
  }
}

export function createMailClient(config?: MailClientConfig): MailClient {
  return new MailClient(config);
}
