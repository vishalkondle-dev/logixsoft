import * as z from 'zod';

export const HealthResponseSchema = z.object({
  status: z.string().meta({ description: 'Service health status', example: 'ok' }),
  service: z.string().meta({ description: 'Service identifier', example: 'logix-dine-api' }),
  timestamp: z.string().meta({ description: 'Current ISO timestamp' }),
});
