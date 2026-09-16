import type * as z from 'zod';
import type { HealthResponseSchema } from '../schemas/health';

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
