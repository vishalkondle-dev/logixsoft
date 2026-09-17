import { createAuthClient } from 'better-auth/client';
import { phoneNumberClient } from 'better-auth/client/plugins';
import type {
  SendOtpResponse,
  AuthUser,
  AuthSession,
} from '@logixsoft/logix-dine/types/auth';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'https://dine-api.logixsoft.in';

/**
 * Better Auth client communicating directly with the backend API.
 * Does not use any local /api route on the web app.
 * Strictly uses cookies with credentials: 'include'.
 * No tokens stored in localStorage.
 */
export const authClient = createAuthClient({
  baseURL: API_BASE,
  basePath: '/auth',
  plugins: [phoneNumberClient()],
  fetchOptions: {
    credentials: 'include',
  },
});

/**
 * Initiate WhatsApp OTP verification directly against the API service.
 */
export async function sendOtp(phoneNumber: string): Promise<SendOtpResponse> {
  const res = await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ phoneNumber }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Failed to dispatch WhatsApp OTP');
  }

  return data as SendOtpResponse;
}

/**
 * Verify WhatsApp OTP directly against the API service.
 * For new users, passes `name` to complete registration.
 * On success, HttpOnly session cookie is set across the .logixsoft.in domain.
 */
export async function verifyOtp(params: {
  phoneNumber: string;
  otp: string;
  name?: string;
}): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Failed to verify verification code');
  }

  return data as AuthSession;
}
