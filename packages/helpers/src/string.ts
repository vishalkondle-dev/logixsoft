/**
 * Masks an email address for privacy and receipts (e.g. 'v***e@logixsoft.in').
 *
 * @param email - The email address to mask
 * @returns Masked email string, or original string if invalid format
 *
 * @example
 * ```ts
 * maskEmail('vishal.kondle@logixsoft.in') // -> 'v***e@logixsoft.in'
 * maskEmail('hi@example.com')             // -> 'h*@example.com'
 * ```
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return email;
  }

  const [username, domain] = email.split('@');
  if (!username || !domain) {
    return email;
  }

  if (username.length <= 1) {
    return `*@${domain}`;
  }

  if (username.length === 2) {
    return `${username[0]}*@${domain}`;
  }

  const firstChar = username[0];
  const lastChar = username[username.length - 1];
  return `${firstChar}***${lastChar}@${domain}`;
}

/**
 * Masks a phone number showing only the trailing digits.
 *
 * @param phone - Phone number string
 * @param visibleDigits - Number of trailing digits to leave visible (default: 4)
 *
 * @example
 * ```ts
 * maskPhone('9876543210')       // -> '******3210'
 * maskPhone('+919876543210', 4) // -> '+91 ****** 3210'
 * ```
 */
export function maskPhone(phone: string, visibleDigits = 4): string {
  if (!phone) return phone;

  const trimmed = phone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (digitsOnly.length <= visibleDigits) {
    return phone;
  }

  const visible = digitsOnly.slice(-visibleDigits);
  const maskedCount = digitsOnly.length - visibleDigits;
  const maskedPart = '*'.repeat(maskedCount);

  if (trimmed.startsWith('+')) {
    const countryCodeLength = trimmed.length - digitsOnly.length + (digitsOnly.length > 10 ? digitsOnly.length - 10 : 0);
    const prefix = trimmed.slice(0, countryCodeLength);
    return `${prefix} ${maskedPart} ${visible}`.trim();
  }

  return `${maskedPart}${visible}`;
}

/**
 * Masks an API key, secret, or token showing only prefix and suffix.
 *
 * @param secret - Secret string to mask
 * @param visiblePrefix - Number of characters to keep at start (default: 8)
 * @param visibleSuffix - Number of characters to keep at end (default: 4)
 *
 * @example
 * ```ts
 * maskSecret('pg_live_8f3a9e21b7c4d019') // -> 'pg_live_...d019'
 * ```
 */
export function maskSecret(secret: string, visiblePrefix = 8, visibleSuffix = 4): string {
  if (!secret) return secret;
  if (secret.length <= visiblePrefix + visibleSuffix) {
    return '*'.repeat(secret.length);
  }

  const start = secret.slice(0, visiblePrefix);
  const end = secret.slice(-visibleSuffix);
  return `${start}...${end}`;
}

/**
 * Converts a string into a URL-friendly slug.
 *
 * @param text - The text to slugify
 *
 * @example
 * ```ts
 * slugify('Logixsoft UPI Payment Gateway!') // -> 'logixsoft-upi-payment-gateway'
 * ```
 */
export function slugify(text: string): string {
  if (!text) return '';

  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric chars except space and hyphen
    .replace(/[\s_-]+/g, '-') // replace spaces, underscores with hyphen
    .replace(/^-+|-+$/g, ''); // strip leading and trailing hyphens
}

/**
 * Capitalizes the first character of a string.
 */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Converts a string (including snake_case, kebab-case, or camelCase) to Title Case.
 *
 * @example
 * ```ts
 * titleCase('payment_order_status') // -> 'Payment Order Status'
 * titleCase('upiPaymentGateway')    // -> 'Upi Payment Gateway'
 * ```
 */
export function titleCase(text: string): string {
  if (!text) return '';

  return text
    .replace(/([A-Z])/g, ' $1') // split camelCase
    .replace(/[_-]+/g, ' ') // replace snake_case and kebab-case with space
    .trim()
    .split(/\s+/)
    .map((word) => capitalize(word.toLowerCase()))
    .join(' ');
}

/**
 * Converts a string to camelCase.
 *
 * @example
 * ```ts
 * camelCase('payment_order_id') // -> 'paymentOrderId'
 * ```
 */
export function camelCase(text: string): string {
  if (!text) return '';

  const words = text
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());

  return words;
}

/**
 * Converts a string to snake_case.
 *
 * @example
 * ```ts
 * snakeCase('paymentOrderId') // -> 'payment_order_id'
 * ```
 */
export function snakeCase(text: string): string {
  if (!text) return '';

  return text
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/**
 * Converts a string to kebab-case.
 *
 * @example
 * ```ts
 * kebabCase('paymentOrderId') // -> 'payment-order-id'
 * ```
 */
export function kebabCase(text: string): string {
  if (!text) return '';

  return text
    .replace(/([A-Z])/g, '-$1')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/**
 * Truncates a string to a specified length with an optional ellipsis suffix.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum allowed length including suffix
 * @param options - Options for suffix and word boundary preservation
 *
 * @example
 * ```ts
 * truncate('Payment received for invoice #1024', 20)
 * // -> 'Payment received...'
 * ```
 */
export function truncate(
  text: string,
  maxLength: number,
  options?: { suffix?: string; preserveWords?: boolean }
): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  const suffix = options?.suffix ?? '...';
  const targetLength = Math.max(0, maxLength - suffix.length);

  if (options?.preserveWords) {
    const truncated = text.slice(0, targetLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      return `${truncated.slice(0, lastSpace)}${suffix}`;
    }
  }

  return `${text.slice(0, targetLength)}${suffix}`;
}

/**
 * Extracts initials from a full name (e.g. for user avatars).
 *
 * @param name - The full name (e.g. 'Vishal Kondle')
 * @param maxInitials - Maximum number of initials to return (default: 2)
 *
 * @example
 * ```ts
 * getInitials('Vishal Kondle') // -> 'VK'
 * getInitials('Logixsoft')      // -> 'L'
 * ```
 */
export function getInitials(name: string, maxInitials = 2): string {
  if (!name) return '';

  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  return words
    .slice(0, maxInitials)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/**
 * Strips HTML tags and decodes common HTML entities.
 *
 * @param html - HTML string
 *
 * @example
 * ```ts
 * stripHtml('<p>Hello <b>World</b>&nbsp;!</p>') // -> 'Hello World !'
 * ```
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes and collapses multiple whitespace characters, tabs, and newlines into single spaces.
 */
export function normalizeWhitespace(text: string): string {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Pluralizes a word based on a count.
 *
 * @param count - The quantity
 * @param singular - Singular form of the word
 * @param plural - Optional custom plural form (defaults to singular + 's')
 *
 * @example
 * ```ts
 * pluralize(1, 'transaction')             // -> '1 transaction'
 * pluralize(5, 'transaction')             // -> '5 transactions'
 * pluralize(2, 'category', 'categories') // -> '2 categories'
 * ```
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}
