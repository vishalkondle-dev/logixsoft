import { openApi } from 'hono-zod-openapi';
import * as z from 'zod';

export const ErrorResponseSchema = z.object({
  error: z.string().meta({ description: 'Error title or code' }),
  message: z.string().optional().meta({ description: 'Detailed error message' }),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean().meta({ description: 'Operation success flag' }),
});

export interface ApiDocOptions {
  summary: string;
  description?: string;
  tags?: string[];
  security?: Record<string, string[]>[];
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  headers?: z.ZodType;
  responses: Record<number | string, z.ZodType | any>;
}

/**
 * Creates OpenAPI documentation middleware with validate: false on inputs.
 * This guarantees rich OpenAPI 3.1 documentation in /doc and Scalar UI
 * while allowing existing handlers to control validation and errors.
 */
export function apiDoc(options: ApiDocOptions) {
  const request: any = {};
  if (options.params) request.param = { schema: options.params, validate: false };
  if (options.query) request.query = { schema: options.query, validate: false };
  if (options.body) request.json = { schema: options.body, validate: false };
  if (options.headers) request.header = { schema: options.headers, validate: false };

  return openApi({
    summary: options.summary,
    description: options.description,
    tags: options.tags,
    security: options.security,
    ...(Object.keys(request).length > 0 ? { request } : {}),
    responses: options.responses,
  });
}
