const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const INDIAN_PHONE_REGEX = /^(?:\+91|91|0)?[6-9]\d{9}$/;
const UPI_VPA_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/**
 * Validates whether a value is a valid email address.
 *
 * @example
 * ```ts
 * isEmail('merchant@logixsoft.in') // -> true
 * isEmail('invalid@')              // -> false
 * ```
 */
export function isEmail(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return EMAIL_REGEX.test(value.trim());
}

/**
 * Validates whether a value is a valid HTTP/HTTPS URL.
 *
 * @example
 * ```ts
 * isUrl('https://wa.logixsoft.in') // -> true
 * isUrl('invalid-url')             // -> false
 * ```
 */
export function isUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates whether a value is a valid 10-digit Indian mobile number
 * (optionally prefixed with +91, 91, or 0, starting with 6, 7, 8, or 9).
 *
 * @example
 * ```ts
 * isIndianPhone('9876543210')     // -> true
 * isIndianPhone('+919876543210') // -> true
 * isIndianPhone('1234567890')     // -> false
 * ```
 */
export function isIndianPhone(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const str = String(value).trim().replace(/[\s-]/g, '');
  return INDIAN_PHONE_REGEX.test(str);
}

/**
 * Validates whether a value is a valid UPI Virtual Payment Address (VPA / UPI ID).
 *
 * @example
 * ```ts
 * isVpa('merchant@okhdfcbank') // -> true
 * isVpa('9876543210@paytm')    // -> true
 * isVpa('invalid-vpa')         // -> false
 * ```
 */
export function isVpa(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return UPI_VPA_REGEX.test(trimmed) && trimmed.length <= 50;
}

/**
 * Validates whether a value is a valid UUID (v1, v3, v4, or v5).
 *
 * @example
 * ```ts
 * isUuid('123e4567-e89b-12d3-a456-426614174000') // -> true
 * ```
 */
export function isUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
}

/**
 * Validates whether a value is numeric (number or numeric string).
 */
export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') {
    return !isNaN(value) && isFinite(value);
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
}

/**
 * Validates whether a value is a valid 6-digit Indian Postal Code (PIN Code).
 *
 * @example
 * ```ts
 * isPostalCode('500081') // -> true
 * isPostalCode('012345') // -> false
 * ```
 */
export function isPostalCode(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  return PINCODE_REGEX.test(String(value).trim());
}

/**
 * Validates that a string is non-empty after trimming.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
