import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  account,
  rateLimit,
  session,
  user,
  verification,
} from '../schemas/auth-schema';

/**
 * Row types derived from the Drizzle auth schema tables.
 * Shared across api and web so DB shapes stay in one place.
 */

/** Auth user table row (select) */
export type UserRow = InferSelectModel<typeof user>;
/** Auth user table row (insert) */
export type NewUserRow = InferInsertModel<typeof user>;

/** Session table row (select) */
export type SessionRow = InferSelectModel<typeof session>;
/** Session table row (insert) */
export type NewSessionRow = InferInsertModel<typeof session>;

/** Account table row (select) */
export type AccountRow = InferSelectModel<typeof account>;
/** Account table row (insert) */
export type NewAccountRow = InferInsertModel<typeof account>;

/** Verification table row (select) — used for OTP codes */
export type VerificationRow = InferSelectModel<typeof verification>;
/** Verification table row (insert) */
export type NewVerificationRow = InferInsertModel<typeof verification>;

/** Rate-limit table row (select) */
export type RateLimitRow = InferSelectModel<typeof rateLimit>;
/** Rate-limit table row (insert) */
export type NewRateLimitRow = InferInsertModel<typeof rateLimit>;