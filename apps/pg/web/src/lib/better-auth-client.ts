import { createAuthClient } from 'better-auth/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://payment-api.logixsoft.in';

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/auth',
});

