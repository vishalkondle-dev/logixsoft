import { WhatsAppClient, createWhatsAppClient } from './client';
import type {
  WhatsAppClientConfig,
  SendTextMessageOptions,
  SendMediaMessageOptions,
  SendDocumentMessageOptions,
  SendLocationOptions,
  SendOtpOptions,
  WhatsAppResponse,
  MediaSource,
} from './types';

/**
 * Default global WhatsAppClient instance configured via environment variables:
 * - WA_API_URL / OPENWA_API_URL (defaults to http://127.0.0.1:2785 or https://wa.logixsoft.in)
 * - WA_API_KEY / OPENWA_API_KEY
 * - WA_SESSION_NAME (defaults to 'logixsoft')
 */
export const waClient = new WhatsAppClient();

/**
 * Send a plain text message via WhatsApp.
 *
 * @example
 * ```ts
 * import { sendWhatsAppText } from '@logixsoft/wa';
 *
 * const res = await sendWhatsAppText('919876543210', 'Hello from Logixsoft!');
 * if (res.success) {
 *   console.log('Dispatched messageId:', res.messageId);
 * }
 * ```
 */
export async function sendWhatsAppText(
  to: string,
  text: string,
  options?: Omit<SendTextMessageOptions, 'to' | 'text'>,
  config?: WhatsAppClientConfig
): Promise<WhatsAppResponse> {
  const client = config ? new WhatsAppClient(config) : waClient;
  return client.sendText({ to, text, ...options });
}

/**
 * Send an image with an optional caption.
 *
 * @example
 * ```ts
 * import { sendWhatsAppImage } from '@logixsoft/wa';
 *
 * await sendWhatsAppImage('919876543210', 'https://example.com/receipt.jpg', {
 *   caption: 'Your Payment Receipt'
 * });
 * ```
 */
export async function sendWhatsAppImage(
  to: string,
  image: MediaSource,
  options?: Omit<SendMediaMessageOptions, 'to' | 'media'>,
  config?: WhatsAppClientConfig
): Promise<WhatsAppResponse> {
  const client = config ? new WhatsAppClient(config) : waClient;
  return client.sendImage({ to, media: image, ...options });
}

/**
 * Send a document / attachment (e.g. PDF, Word, Excel).
 *
 * @example
 * ```ts
 * import { sendWhatsAppDocument } from '@logixsoft/wa';
 *
 * await sendWhatsAppDocument('919876543210', pdfBuffer, {
 *   filename: 'Invoice_1024.pdf',
 *   caption: 'Thank you for your business!'
 * });
 * ```
 */
export async function sendWhatsAppDocument(
  to: string,
  document: MediaSource,
  options?: Omit<SendDocumentMessageOptions, 'to' | 'media'>,
  config?: WhatsAppClientConfig
): Promise<WhatsAppResponse> {
  const client = config ? new WhatsAppClient(config) : waClient;
  return client.sendDocument({ to, media: document, ...options });
}

/**
 * Alias for sendWhatsAppDocument.
 */
export const sendWhatsAppFile = sendWhatsAppDocument;

/**
 * Send an OTP verification message.
 *
 * @example
 * ```ts
 * import { sendWhatsAppOtp } from '@logixsoft/wa';
 *
 * await sendWhatsAppOtp('919876543210', '582910', { appName: 'Logixsoft PG' });
 * ```
 */
export async function sendWhatsAppOtp(
  to: string,
  otp: string,
  options?: Omit<SendOtpOptions, 'to' | 'otp'>,
  config?: WhatsAppClientConfig
): Promise<WhatsAppResponse> {
  const client = config ? new WhatsAppClient(config) : waClient;
  return client.sendOtp({ to, otp, ...options });
}

/**
 * Send a geographic location pin.
 */
export async function sendWhatsAppLocation(
  to: string,
  location: { latitude: number; longitude: number; title?: string; address?: string },
  config?: WhatsAppClientConfig
): Promise<WhatsAppResponse> {
  const client = config ? new WhatsAppClient(config) : waClient;
  return client.sendLocation({ to, ...location });
}

export { WhatsAppClient, createWhatsAppClient };
export * from './types';
export * from './format';
export default waClient;
