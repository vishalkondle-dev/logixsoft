/**
 * Creates an object composed of the picked object properties.
 *
 * @param obj - The source object
 * @param keys - Array of property keys to pick
 *
 * @example
 * ```ts
 * pick({ a: 1, b: 2, c: 3 }, ['a', 'c']) // -> { a: 1, c: 3 }
 * ```
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  if (!obj) return result;

  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Creates an object composed of the own and inherited enumerable property paths of obj that are not omitted.
 *
 * @param obj - The source object
 * @param keys - Array of property keys to omit
 *
 * @example
 * ```ts
 * omit({ a: 1, b: 2, c: 3 }, ['b']) // -> { a: 1, c: 3 }
 * ```
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  if (!obj) return result;

  for (const key of keys) {
    delete result[key];
  }

  return result;
}

/**
 * Splits an array into chunks of a specified size.
 *
 * @param array - Array to split
 * @param size - Chunk size (minimum 1)
 *
 * @example
 * ```ts
 * chunk([1, 2, 3, 4, 5], 2) // -> [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunk<T>(array: T[], size: number): T[][] {
  if (!Array.isArray(array) || size <= 0) {
    return [];
  }

  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
}

/**
 * Groups array items by a key or an extractor function.
 *
 * @param array - Array to group
 * @param keyFn - Property name or function returning group key
 *
 * @example
 * ```ts
 * groupBy(orders, (o) => o.status)
 * // -> { PENDING: [...], SUCCESS: [...] }
 * ```
 */
export function groupBy<T, K extends PropertyKey>(
  array: T[],
  keyFn: ((item: T) => K) | keyof T
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  if (!Array.isArray(array)) return result;

  const fn = typeof keyFn === 'function' ? keyFn : (item: T) => item[keyFn] as unknown as K;

  for (const item of array) {
    const key = fn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }

  return result;
}

/**
 * Returns a deduplicated array of items.
 *
 * @param array - Array to deduplicate
 * @param keyFn - Optional key selector for object uniqueness
 *
 * @example
 * ```ts
 * unique([1, 2, 2, 3]) // -> [1, 2, 3]
 * unique(users, (u) => u.id)
 * ```
 */
export function unique<T>(array: T[], keyFn?: (item: T) => unknown): T[] {
  if (!Array.isArray(array)) return [];

  if (!keyFn) {
    return Array.from(new Set(array));
  }

  const seen = new Set<unknown>();
  const result: T[] = [];

  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

/**
 * Deeply clones an object or array using structuredClone (with JSON fallback).
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

/**
 * Checks if a value is empty (null, undefined, empty string, empty array, or empty object).
 *
 * @example
 * ```ts
 * isEmpty(null)      // -> true
 * isEmpty([])        // -> true
 * isEmpty({})        // -> true
 * isEmpty('')        // -> true
 * isEmpty([1])       // -> false
 * isEmpty({ a: 1 })  // -> false
 * ```
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}
