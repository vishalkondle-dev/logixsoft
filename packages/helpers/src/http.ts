/**
 * Standard HTTP Status Codes
 */
export const HttpStatus = {
  // 2xx Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // 3xx Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

/**
 * Standard error structure for API errors
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Standard success response envelope
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Standard error response envelope
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
  timestamp: string;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Constructs a standardized successful API response envelope.
 *
 * @param data - The response payload
 * @param meta - Optional metadata (e.g. pagination, execution time)
 *
 * @example
 * ```ts
 * return c.json(successResponse({ user }));
 * // -> { success: true, data: { user: ... }, timestamp: "2026-09-16T..." }
 * ```
 */
export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>
): ApiSuccessResponse<T> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (meta !== undefined) {
    response.meta = meta;
  }

  return response;
}

/**
 * Constructs a standardized error API response envelope.
 *
 * @param message - User-friendly error message
 * @param code - Machine-readable error code (e.g. 'INVALID_INPUT', 'NOT_FOUND')
 * @param details - Optional error details (e.g. field-level validation errors)
 *
 * @example
 * ```ts
 * return c.json(errorResponse('Order not found', 'NOT_FOUND'), 404);
 * // -> { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' }, timestamp: "2026-09-16T..." }
 * ```
 */
export function errorResponse(
  message: string,
  code = 'BAD_REQUEST',
  details?: unknown
): ApiErrorResponse {
  const error: ApiError = {
    code,
    message,
  };

  if (details !== undefined) {
    error.details = details;
  }

  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Returns true if the status code represents a 2xx success.
 */
export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * Returns true if the status code represents a 4xx client error.
 */
export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

/**
 * Returns true if the status code represents a 5xx server error.
 */
export function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}
