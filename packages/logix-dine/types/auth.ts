import type * as z from 'zod';
import type {
  PhoneNumberSchema,
  SendOtpRequestSchema,
  SendOtpResponseSchema,
  VerifyOtpRequestSchema,
  AuthUserSchema,
  AuthSessionSchema,
} from '../schemas/auth';

/**
 * Validated phone number string
 */
export type PhoneNumber = z.infer<typeof PhoneNumberSchema>;

/**
 * Request payload for sending WhatsApp OTP
 */
export type SendOtpRequest = z.infer<typeof SendOtpRequestSchema>;

/**
 * Response payload from sending WhatsApp OTP
 */
export type SendOtpResponse = z.infer<typeof SendOtpResponseSchema>;

/**
 * Request payload for verifying WhatsApp OTP
 */
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

/**
 * Specialized payload for returning user login (strictly phone and OTP)
 */
export type LoginPayload = Pick<VerifyOtpRequest, 'phoneNumber' | 'otp'>;

/**
 * Specialized payload for new user registration (phone, OTP, and name required)
 */
export type RegisterPayload = Pick<VerifyOtpRequest, 'phoneNumber' | 'otp'> & {
  name: string;
};

/**
 * Authenticated user profile type derived from AuthUserSchema
 */
export type AuthUser = z.infer<typeof AuthUserSchema>;

/**
 * User profile view without sensitive system timestamps
 */
export type PublicAuthUser = Omit<AuthUser, 'createdAt' | 'updatedAt'>;

/**
 * Full session representation derived from AuthSessionSchema
 */
export type AuthSession = z.infer<typeof AuthSessionSchema>;
