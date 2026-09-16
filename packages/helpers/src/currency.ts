export interface UpiUriParams {
  /**
   * Payee Virtual Payment Address (e.g. 'merchant@okhdfcbank')
   */
  pa: string;

  /**
   * Payee Name (e.g. 'Logixsoft Technologies')
   */
  pn: string;

  /**
   * Transaction Amount in Rupees (e.g. 150.50) or in Paise
   */
  amount: number;

  /**
   * If true, treats the `amount` param as paise rather than rupees (default: false)
   */
  isPaise?: boolean;

  /**
   * Transaction Reference ID (e.g. 'order_1024')
   */
  tr: string;

  /**
   * Transaction note or description (e.g. 'Payment for Invoice #1024')
   */
  tn?: string;

  /**
   * Currency code (defaults to 'INR')
   */
  cu?: string;

  /**
   * Merchant Category Code (optional 4 digits)
   */
  mc?: string;
}

/**
 * Safely converts Rupees to integer Paise (1 INR = 100 paise).
 * Avoids IEEE-754 floating-point rounding bugs (e.g. 19.99 * 100 = 1998.9999999999998).
 *
 * @param rupees - Amount in rupees (number or numeric string)
 *
 * @example
 * ```ts
 * toPaise(100.50) // -> 10050
 * toPaise('19.99') // -> 1999
 * ```
 */
export function toPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    rupees = parseFloat(rupees.trim());
  }

  if (isNaN(rupees) || !isFinite(rupees)) {
    return 0;
  }

  return Math.round(rupees * 100);
}

/**
 * Converts integer Paise to Rupees with 2 decimal precision.
 *
 * @param paise - Amount in paise (e.g. 10050)
 *
 * @example
 * ```ts
 * toRupees(10050) // -> 100.5
 * toRupees(1999)  // -> 19.99
 * ```
 */
export function toRupees(paise: number): number {
  if (isNaN(paise) || !isFinite(paise)) {
    return 0;
  }

  return Number((paise / 100).toFixed(2));
}

/**
 * Formats amount in paise to Indian Rupee currency notation using the Indian numbering system.
 * (e.g. 125000 paise -> "₹1,250.00", 100000000 paise -> "₹10,00,000.00").
 *
 * @param paise - Amount in integer paise
 * @param options - Formatting options
 *
 * @example
 * ```ts
 * formatINR(125000)                               // -> "₹1,250.00"
 * formatINR(125000, { showSymbol: false })        // -> "1,250.00"
 * formatINR(100000000)                            // -> "₹10,00,000.00"
 * ```
 */
export function formatINR(
  paise: number,
  options: { showSymbol?: boolean; showDecimals?: boolean } = {}
): string {
  const { showSymbol = true, showDecimals = true } = options;
  const rupees = toRupees(paise);

  const formatter = new Intl.NumberFormat('en-IN', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return formatter.format(rupees);
}

/**
 * Builds a standardized UPI deep link payment URI (`upi://pay?...`).
 *
 * @param params - UPI payment parameters
 *
 * @example
 * ```ts
 * const uri = buildUpiUri({
 *   pa: 'merchant@okhdfcbank',
 *   pn: 'Logixsoft',
 *   amount: 50000,
 *   isPaise: true,
 *   tr: 'order_123',
 *   tn: 'Order 123',
 * });
 * // -> "upi://pay?pa=merchant%40okhdfcbank&pn=Logixsoft&am=500.00&tr=order_123&cu=INR&tn=Order%20123"
 * ```
 */
export function buildUpiUri(params: UpiUriParams): string {
  const rupees = params.isPaise ? toRupees(params.amount) : params.amount;
  const amountFormatted = rupees.toFixed(2);

  const query = new URLSearchParams();
  query.set('pa', params.pa.trim());
  query.set('pn', params.pn.trim());
  query.set('am', amountFormatted);
  query.set('tr', params.tr.trim());
  query.set('cu', params.cu ?? 'INR');

  if (params.tn) {
    query.set('tn', params.tn.trim());
  }
  if (params.mc) {
    query.set('mc', params.mc.trim());
  }

  return `upi://pay?${query.toString()}`;
}

/**
 * Parses a `upi://pay?...` deep link into a structured parameters object.
 *
 * @param uri - The UPI payment URI
 */
export function parseUpiUri(uri: string): Partial<UpiUriParams> | null {
  if (!uri || !uri.startsWith('upi://pay?')) {
    return null;
  }

  try {
    const queryString = uri.replace('upi://pay?', '');
    const searchParams = new URLSearchParams(queryString);

    const pa = searchParams.get('pa');
    const pn = searchParams.get('pn');
    const am = searchParams.get('am');
    const tr = searchParams.get('tr');
    const tn = searchParams.get('tn') ?? undefined;
    const cu = searchParams.get('cu') ?? undefined;
    const mc = searchParams.get('mc') ?? undefined;

    if (!pa || !pn || !am || !tr) {
      return null;
    }

    return {
      pa,
      pn,
      amount: parseFloat(am),
      isPaise: false,
      tr,
      tn,
      cu,
      mc,
    };
  } catch {
    return null;
  }
}
