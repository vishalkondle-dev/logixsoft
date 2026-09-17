import * as z from 'zod';
import type { JsonSessionRow, JsonUserRow } from '../types/auth-schema';
import { AssertSame, Equal, Expect } from '../types/utils';

/**
 * Mobile phone number schema supporting 10-digit Indian numbers and E.164 international format.
 */
export const PhoneNumberSchema = z
  .string()
  .trim()
  .min(10, 'Phone number must be at least 10 digits')
  .max(16, 'Phone number must not exceed 16 digits')
  .regex(/^\+?[1-9]\d{9,14}$/, 'Please enter a valid phone number (e.g. +919876543210 or 9876543210)')
  .meta({ description: 'User mobile number in E.164 or 10-digit format', example: '+919876543210' });

/**
 * Request payload to initiate WhatsApp OTP delivery.
 */
export const SendOtpRequestSchema = z.object({
  phoneNumber: PhoneNumberSchema,
});

/**
 * Response returned after dispatching OTP.
 * userExists flag informs the client whether registration (name input) is required.
 */
export const SendOtpResponseSchema = z.object({
  success: z.boolean().meta({ description: 'Indicates whether OTP was dispatched', example: true }),
  message: z.string().meta({ description: 'Status message', example: 'OTP sent successfully to WhatsApp' }),
  userExists: z.boolean().meta({ description: 'Whether the user is already registered', example: false }),
});

/**
 * Request payload to verify WhatsApp OTP and finalize login/registration.
 */
export const VerifyOtpRequestSchema = z.object({
  phoneNumber: PhoneNumberSchema,
  otp: z
    .string()
    .trim()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain digits only')
    .meta({ description: '6-digit OTP received via WhatsApp', example: '123456' }),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters')
    .optional()
    .meta({ description: 'Full name of user (required if registering for the first time)', example: 'Rajesh Kumar' }),
});

/**
 * Authenticated user profile schema.
 *
 * SSOT: mirrors the `user` DB table exactly (dates as ISO strings).
 * The assertion below fails the build if this schema ever drifts from
 * the table definition — update table + schema + mapper together.
 */
export const AuthUserSchema = z.object({
  id: z.string().meta({ description: 'Unique user identifier' }),
  name: z.string().meta({ description: 'User full name', example: 'Rajesh Kumar' }),
  email: z.string().nullable().meta({ description: 'User email address' }),
  emailVerified: z.boolean().meta({ description: 'Whether email is verified' }),
  phoneNumber: z.string().nullable().meta({ description: 'User phone number', example: '+919876543210' }),
  phoneNumberVerified: z.boolean().meta({ description: 'Whether phone number is verified' }),
  image: z.string().nullable().meta({ description: 'User profile avatar URL' }),
  role: z.string().meta({ description: 'User permission role', example: 'CUSTOMER' }),
  createdAt: z.string().meta({ description: 'Account creation timestamp (ISO)' }),
  updatedAt: z.string().meta({ description: 'Last account update timestamp (ISO)' }),
});

type _AuthUserMatchesUserRow = Expect<AssertSame<z.infer<typeof AuthUserSchema>, JsonUserRow>>;

/**
 * Active authentication session payload.
 *
 * SSOT: `user` mirrors the user table exactly; `session` is a deliberate
 * projection of the session table (raw session token never crosses the wire).
 */
export const AuthSessionSchema = z.object({
  user: AuthUserSchema,
  session: z.object({
    id: z.string().meta({ description: 'Session identifier' }),
    userId: z.string().meta({ description: 'User ID associated with session' }),
    expiresAt: z.string().meta({ description: 'Session expiry timestamp (ISO)' }),
  }),
});

type _AuthSessionMatchesSessionRow = Expect<
  AssertSame<
    z.infer<typeof AuthSessionSchema>['session'],
    Pick<JsonSessionRow, 'id' | 'userId' | 'expiresAt'>
  >
>;
