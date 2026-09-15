import type { MediaSource } from './types';

/**
 * Normalizes phone numbers into WhatsApp Chat IDs (e.g. 917822914442@c.us or 123456@g.us).
 * Automatically prepends country code 91 for 10-digit Indian numbers.
 */
export function formatChatId(to: string, defaultCountryCode = '91'): string {
  const trimmed = to.trim();

  // If already a valid WhatsApp JID
  if (trimmed.endsWith('@c.us') || trimmed.endsWith('@g.us')) {
    return trimmed;
  }
  if (trimmed.endsWith('@s.whatsapp.net')) {
    return trimmed.replace('@s.whatsapp.net', '@c.us');
  }

  // Strip non-numeric characters
  let digits = trimmed.replace(/\D/g, '');

  // Handle Indian 10-digit mobile numbers
  if (digits.length === 10) {
    digits = `${defaultCountryCode}${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = `${defaultCountryCode}${digits.slice(1)}`;
  }

  return `${digits}@c.us`;
}

/**
 * Guesses common MIME type from a file name extension.
 */
export function guessMimeType(filename?: string): string {
  if (!filename) return 'application/octet-stream';
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'pdf':
      return 'application/pdf';
    case 'mp4':
      return 'video/mp4';
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case 'txt':
      return 'text/plain';
    case 'csv':
      return 'text/csv';
    case 'zip':
      return 'application/zip';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Normalizes a MediaSource into an HTTP URL or Base64 payload.
 */
export function normalizeMedia(
  media: MediaSource,
  options: { mimetype?: string; filename?: string } = {}
): { url?: string; base64?: string; mimetype?: string; filename?: string } {
  const filename = options.filename;
  let mimetype = options.mimetype || guessMimeType(filename);

  if (typeof media === 'string') {
    // If HTTP / HTTPS URL
    if (media.startsWith('http://') || media.startsWith('https://')) {
      return { url: media, mimetype, filename };
    }

    // If data URL: data:image/png;base64,...
    if (media.startsWith('data:')) {
      const match = media.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return {
          base64: match[2],
          mimetype: match[1] || mimetype,
          filename,
        };
      }
    }

    // Plain base64 string
    return {
      base64: media,
      mimetype,
      filename,
    };
  }

  // Binary buffer / Uint8Array / ArrayBuffer
  let base64 = '';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(media)) {
    base64 = media.toString('base64');
  } else if (media instanceof Uint8Array) {
    let binary = '';
    const len = media.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(media[i]);
    }
    base64 = btoa(binary);
  } else if (media instanceof ArrayBuffer) {
    return normalizeMedia(new Uint8Array(media), options);
  } else {
    base64 = String(media);
  }

  return {
    base64,
    mimetype,
    filename,
  };
}
