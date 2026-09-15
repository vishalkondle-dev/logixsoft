import { MailClient, createMailClient } from './client.js';
import type {
  SendMailOptions,
  SendMailResponse,
  OtpMailOptions,
  WelcomeMailOptions,
  MailClientConfig,
} from './types.js';

/**
 * Default global MailClient instance configured via environment variables:
 * - MAIL_WORKER_URL / NEXT_PUBLIC_MAIL_WORKER_URL (defaults to https://mail.logixsoft.in)
 * - MAIL_API_KEY / MAIL_WORKER_API_KEY / API_KEY
 */
export const mailClient = new MailClient();

/**
 * Send an email using the Logixsoft Mail Worker.
 *
 * @example
 * ```ts
 * import { sendMail } from '@logixsoft/mail';
 *
 * const res = await sendMail({
 *   to: 'user@example.com',
 *   subject: 'Welcome to Logixsoft',
 *   html: '<h1>Welcome!</h1><p>Thanks for joining.</p>'
 * });
 *
 * if (!res.success) {
 *   console.error('Failed:', res.error);
 * }
 * ```
 */
export async function sendMail(
  options: SendMailOptions,
  config?: MailClientConfig
): Promise<SendMailResponse> {
  const client = config ? new MailClient(config) : mailClient;
  return client.send(options);
}

/**
 * Send an email and throw an Error if sending fails.
 */
export async function sendMailOrThrow(
  options: SendMailOptions,
  config?: MailClientConfig
): Promise<string> {
  const client = config ? new MailClient(config) : mailClient;
  return client.sendOrThrow(options);
}

/**
 * Send a clean, branded OTP / verification code email.
 *
 * @example
 * ```ts
 * import { sendOtpEmail } from '@logixsoft/mail';
 *
 * await sendOtpEmail({
 *   to: 'user@example.com',
 *   otp: '849201',
 *   appName: 'Logixsoft PG'
 * });
 * ```
 */
export async function sendOtpEmail(
  options: OtpMailOptions,
  config?: MailClientConfig
): Promise<SendMailResponse> {
  const client = config ? new MailClient(config) : mailClient;
  return client.sendOtp(options);
}

/**
 * Send a clean, branded welcome email to a new user.
 *
 * @example
 * ```ts
 * import { sendWelcomeEmail } from '@logixsoft/mail';
 *
 * await sendWelcomeEmail({
 *   to: 'user@example.com',
 *   name: 'John Doe',
 *   appName: 'Logixsoft PG',
 *   loginUrl: 'https://payment.logixsoft.in/login'
 * });
 * ```
 */
export async function sendWelcomeEmail(
  options: WelcomeMailOptions,
  config?: MailClientConfig
): Promise<SendMailResponse> {
  const client = config ? new MailClient(config) : mailClient;
  return client.sendWelcome(options);
}

export { MailClient, createMailClient };
export * from './types.js';
export default mailClient;
